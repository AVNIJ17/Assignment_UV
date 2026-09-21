import random

from django.core.management.base import BaseCommand
from django.db import transaction

from tickets.models import (
    PRIORITY_RANK,
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

DEPARTMENTS = ["Maintenance", "Housekeeping", "IT", "Electrical"]

ISSUE_TYPES = [
    ("AC not cooling", "Maintenance", Priority.HIGH, True),
    ("Internet not working", "IT", Priority.CRITICAL, True),
    ("Pantry not cleaned", "Housekeeping", Priority.LOW, True),
    ("Lights flickering", "Electrical", Priority.MEDIUM, True),
    ("Water leakage", "Maintenance", Priority.HIGH, False),
    ("Washroom not cleaned", "Housekeeping", Priority.MEDIUM, False),
    ("Printer offline", "IT", Priority.LOW, False),
    ("Power socket dead", "Electrical", Priority.HIGH, False),
    ("Door lock jammed", "Maintenance", Priority.MEDIUM, False),
    ("Wi-Fi drops frequently", "IT", Priority.MEDIUM, False),
]

OFFICES = {"Harness-1317": ["1F", "2F", "3F"], "Vertex-204": ["GF", "1F"], "Nimbus-88": ["4F"]}

PEOPLE = [
    ("Chaitanya M", Role.CLIENT_POC, None, "Harness-1317"),
    ("Riya Nair", Role.CLIENT_POC, None, "Vertex-204"),
    ("Dhananjaya Murthy", Role.DEPARTMENT_POC, "Maintenance", None),
    ("Anita Rao", Role.DEPARTMENT_POC, "Housekeeping", None),
    ("Vikram Shah", Role.DEPARTMENT_POC, "IT", None),
    ("Sneha Patil", Role.DEPARTMENT_POC, "Electrical", None),
    ("Prakash Kumar", Role.TECHNICIAN, "Maintenance", None),
    ("Imran Sheikh", Role.TECHNICIAN, "Maintenance", None),
    ("Lata Devi", Role.TECHNICIAN, "Housekeeping", None),
    ("Arjun Menon", Role.TECHNICIAN, "IT", None),
    ("Ravi Teja", Role.TECHNICIAN, "Electrical", None),
]

DESCRIPTIONS = [
    "The air conditioning units on floors 2 and 3 have stopped cooling effectively since this "
    "morning. Multiple clients are complaining about uncomfortable temperatures.",
    "Issue started yesterday evening and is getting worse. Please look into it on priority.",
    "Recurring problem, third time this month. Requesting a permanent fix rather than a patch.",
    "",
]


class Command(BaseCommand):
    help = "Loads demo departments, offices, people, issue types and ~36 tickets."

    @transaction.atomic
    def handle(self, *args, **options):
        random.seed(7)
        for model in (Activity, Ticket, IssueType, Person, Floor, Office, Department):
            model.objects.all().delete()

        depts = {name: Department.objects.create(name=name) for name in DEPARTMENTS}
        offices = {}
        for name, floors in OFFICES.items():
            office = Office.objects.create(name=name)
            for i, label in enumerate(floors):
                Floor.objects.create(office=office, label=label, order=i)
            offices[name] = office

        people = []
        for name, role, dept, office in PEOPLE:
            people.append(
                Person.objects.create(
                    name=name, role=role,
                    department=depts.get(dept), office=offices.get(office),
                )
            )

        issues = [
            IssueType.objects.create(
                name=name, department=depts[dept],
                default_priority=priority, is_quick_issue=quick,
            )
            for name, dept, priority, quick in ISSUE_TYPES
        ]

        clients = [p for p in people if p.role == Role.CLIENT_POC]
        statuses = (
            [TicketStatus.PENDING_ASSIGNMENT] * 12
            + [TicketStatus.PENDING_ASSESSMENT] * 9
            + [TicketStatus.PENDING_POC_REVIEW] * 6
            + [TicketStatus.RESOLVED] * 6
            + [TicketStatus.CLOSED] * 3
        )

        for i, status in enumerate(statuses):
            client = clients[i % len(clients)]
            office = client.office
            picked = random.sample(issues, random.choice([1, 1, 2]))
            floors = list(office.floors.all())
            chosen_floors = random.sample(floors, min(len(floors), random.choice([1, 2])))
            department = picked[0].department
            poc = Person.objects.filter(role=Role.DEPARTMENT_POC, department=department).first()

            # A ticket only has a specific POC and a priority once someone has
            # actually acted on it — PENDING_ASSIGNMENT tickets belong to the
            # whole department as a group, unprioritised, same as a real one.
            worker_assigned = status != TicketStatus.PENDING_ASSIGNMENT
            technician = None
            if worker_assigned:
                technician = Person.objects.filter(
                    role=Role.TECHNICIAN, department=department
                ).first()

            ticket = Ticket.objects.create(
                title=", ".join(p.name for p in picked),
                description=random.choice(DESCRIPTIONS),
                office=office,
                priority=(
                    max((p.default_priority for p in picked), key=lambda x: PRIORITY_RANK[x])
                    if worker_assigned else Priority.UNSET
                ),
                status=status,
                department=department,
                created_by=client,
                department_poc=poc if worker_assigned else None,
                technician=technician,
            )
            ticket.issues.set(picked)
            ticket.floors.set(chosen_floors)

            Activity.objects.create(ticket=ticket, actor=client, verb="created")
            Activity.objects.create(
                ticket=ticket, verb="routed to department",
                from_value="Unassigned", to_value=department.name,
            )
            if worker_assigned and poc:
                Activity.objects.create(
                    ticket=ticket, actor=poc, verb="set priority.",
                    from_value="Not Set", to_value=dict(Priority.choices)[ticket.priority],
                )
                Activity.objects.create(
                    ticket=ticket, actor=poc, verb="assigned technician.",
                    from_value="Unassigned", to_value=str(technician),
                )
            if status in (TicketStatus.PENDING_POC_REVIEW, TicketStatus.RESOLVED, TicketStatus.CLOSED):
                Activity.objects.create(
                    ticket=ticket, actor=technician, verb="changed status of the ticket.",
                    from_value="Pending Technician Assessment", to_value="Fully Resolved",
                )
                
        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {Ticket.objects.count()} tickets, {Person.objects.count()} people."
            )
        )
