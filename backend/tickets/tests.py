from django.test import TestCase
from rest_framework.test import APIClient

from .models import (
    Activity,
    Department,
    Floor,
    IssueType,
    Office,
    Person,
    Priority,
    Role,
    Ticket,
    TicketStatus,
)


class BaseSetup(TestCase):
    def setUp(self):
        self.client_api = APIClient()
        self.maintenance = Department.objects.create(name="Maintenance")
        self.it = Department.objects.create(name="IT")
        self.office = Office.objects.create(name="Harness-1317")
        self.f2 = Floor.objects.create(office=self.office, label="2F", order=0)
        self.f3 = Floor.objects.create(office=self.office, label="3F", order=1)
        self.other_office = Office.objects.create(name="Nimbus-88")
        self.other_floor = Floor.objects.create(office=self.other_office, label="4F")

        self.client_poc = Person.objects.create(
            name="Chaitanya M", role=Role.CLIENT_POC, office=self.office
        )
        self.dept_poc = Person.objects.create(
            name="Dhananjaya Murthy", role=Role.DEPARTMENT_POC, department=self.maintenance
        )
        self.other_dept_poc = Person.objects.create(
            name="Vikram Shah", role=Role.DEPARTMENT_POC, department=self.it
        )
        self.tech = Person.objects.create(
            name="Prakash Kumar", role=Role.TECHNICIAN, department=self.maintenance
        )
        self.it_tech = Person.objects.create(
            name="Arjun Menon", role=Role.TECHNICIAN, department=self.it
        )
        self.issue = IssueType.objects.create(
            name="AC not cooling", department=self.maintenance,
            default_priority=Priority.HIGH, is_quick_issue=True,
        )

    def create_ticket(self, **overrides):
        payload = {
            "office": self.office.id,
            "issues": [self.issue.id],
            "floors": [self.f2.id, self.f3.id],
            "description": "AC stopped cooling on 2F and 3F.",
            "created_by": self.client_poc.id,
        }
        payload.update(overrides)
        return self.client_api.post("/api/tickets/", payload, format="json")


class TicketCreationTests(BaseSetup):
    def test_create_ticket_returns_201_with_no_priority_or_specific_poc_yet(self):
        response = self.create_ticket()
        self.assertEqual(response.status_code, 201)
        ticket = Ticket.objects.get(pk=response.data["id"])
        # Department is derived server-side from the selected issues, but priority
        # is left for the Department POC to decide, and no specific person is
        # pre-assigned — the ticket belongs to the department as a group.
        self.assertEqual(ticket.priority, Priority.UNSET)
        self.assertEqual(ticket.department, self.maintenance)
        self.assertIsNone(ticket.department_poc)
        self.assertEqual(ticket.status, TicketStatus.PENDING_ASSIGNMENT)
        # "created" + "routed to department" events are logged on the activity trail.
        self.assertEqual(ticket.activities.count(), 2)

    def test_multi_floor_office_requires_at_least_one_floor(self):
        response = self.create_ticket(floors=[])
        self.assertEqual(response.status_code, 400)
        self.assertIn("floors", response.data)
        self.assertEqual(Ticket.objects.count(), 0)

    def test_floor_must_belong_to_selected_office(self):
        response = self.create_ticket(floors=[self.other_floor.id])
        self.assertEqual(response.status_code, 400)
        self.assertIn("floors", response.data)

    def test_at_least_one_issue_is_required(self):
        response = self.create_ticket(issues=[])
        self.assertEqual(response.status_code, 400)
        self.assertIn("issues", response.data)


class TicketWorkflowTests(BaseSetup):
    def setUp(self):
        super().setUp()
        self.ticket = Ticket.objects.get(pk=self.create_ticket().data["id"])

    def post(self, path, actor, payload=None):
        return self.client_api.post(
            f"/api/tickets/{self.ticket.id}/{path}", payload or {},
            format="json", HTTP_X_ACTOR_ID=str(actor.id),
        )

    def test_department_poc_can_assign_technician_and_set_priority(self):
        response = self.post(
            "assign-worker/", self.dept_poc, {"technician": self.tech.id, "priority": "HIGH"}
        )
        self.assertEqual(response.status_code, 200)
        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.technician, self.tech)
        self.assertEqual(self.ticket.priority, Priority.HIGH)
        self.assertEqual(self.ticket.department_poc, self.dept_poc)
        self.assertEqual(self.ticket.status, TicketStatus.PENDING_ASSESSMENT)

    def test_assign_worker_requires_a_priority(self):
        response = self.post("assign-worker/", self.dept_poc, {"technician": self.tech.id})
        self.assertEqual(response.status_code, 400)
        self.ticket.refresh_from_db()
        self.assertIsNone(self.ticket.technician)

    def test_poc_from_a_different_department_cannot_act_on_this_ticket(self):
        response = self.post(
            "assign-worker/", self.other_dept_poc, {"technician": self.tech.id, "priority": "HIGH"}
        )
        self.assertEqual(response.status_code, 400)
        self.ticket.refresh_from_db()
        self.assertIsNone(self.ticket.technician)
        self.assertIsNone(self.ticket.department_poc)

    def test_technician_from_another_department_is_rejected(self):
        response = self.post(
            "assign-worker/", self.dept_poc, {"technician": self.it_tech.id, "priority": "HIGH"}
        )
        self.assertEqual(response.status_code, 400)
        self.ticket.refresh_from_db()
        self.assertIsNone(self.ticket.technician)

    def test_client_cannot_assign_a_worker(self):
        response = self.post(
            "assign-worker/", self.client_poc, {"technician": self.tech.id, "priority": "HIGH"}
        )
        self.assertEqual(response.status_code, 400)

    def test_only_assigned_technician_can_submit_assessment(self):
        self.post("assign-worker/", self.dept_poc, {"technician": self.tech.id, "priority": "HIGH"})
        rejected = self.post("assessment/", self.it_tech, {"outcome": "FULLY_RESOLVED"})
        self.assertEqual(rejected.status_code, 400)
        accepted = self.post("assessment/", self.tech, {"outcome": "FULLY_RESOLVED"})
        self.assertEqual(accepted.status_code, 200)
        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.status, TicketStatus.PENDING_POC_REVIEW)

    def test_partial_resolution_requires_a_note(self):
        self.post("assign-worker/", self.dept_poc, {"technician": self.tech.id, "priority": "HIGH"})
        response = self.post("assessment/", self.tech, {"outcome": "PARTIALLY_RESOLVED", "note": "x"})
        self.assertEqual(response.status_code, 400)

    def test_mark_resolved_moves_ticket_to_closed_tab(self):
        response = self.post("mark-resolved/", self.client_poc)
        self.assertEqual(response.status_code, 200)
        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.status, TicketStatus.RESOLVED)
        self.assertIsNotNone(self.ticket.closed_at)

    def test_comment_is_appended_to_activity(self):
        response = self.post("comments/", self.tech, {"body": "Compressor replaced."})
        self.assertEqual(response.status_code, 201)
        self.assertTrue(Activity.objects.filter(kind="COMMENT", body="Compressor replaced.").exists())

    def test_empty_comment_is_rejected(self):
        self.assertEqual(self.post("comments/", self.tech, {"body": "  "}).status_code, 400)


class TicketListingTests(BaseSetup):
    def setUp(self):
        super().setUp()
        for _ in range(23):
            self.create_ticket()

    def test_listing_is_paginated_at_ten_per_page(self):
        response = self.client_api.get("/api/tickets/?tab=open")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 23)
        self.assertEqual(len(response.data["results"]), 10)
        self.assertIsNotNone(response.data["next"])

        page3 = self.client_api.get("/api/tickets/?tab=open&page=3")
        self.assertEqual(len(page3.data["results"]), 3)
        self.assertIsNone(page3.data["next"])

    def test_closed_tab_excludes_open_tickets(self):
        ticket = Ticket.objects.first()
        self.client_api.post(
            f"/api/tickets/{ticket.id}/mark-resolved/", {},
            format="json", HTTP_X_ACTOR_ID=str(self.client_poc.id),
        )
        closed = self.client_api.get("/api/tickets/?tab=closed")
        self.assertEqual(closed.data["count"], 1)
        self.assertEqual(self.client_api.get("/api/tickets/?tab=open").data["count"], 22)

    def test_search_filters_by_office_name(self):
        hit = self.client_api.get("/api/tickets/?tab=open&search=Harness")
        self.assertEqual(hit.data["count"], 23)
        miss = self.client_api.get("/api/tickets/?tab=open&search=Nimbus")
        self.assertEqual(miss.data["count"], 0)