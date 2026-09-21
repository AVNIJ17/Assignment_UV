from django.db.models import Q
from django.utils import timezone
from rest_framework import status as http
from rest_framework.decorators import action, api_view
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from .models import (
    Activity,
    AssessmentOutcome,
    Department,
    IssueType,
    Office,
    Person,
    Priority,
    Role,
    Ticket,
    TicketStatus,
)

from .serializers import (
    DepartmentSerializer,
    IssueTypeSerializer,
    OfficeSerializer,
    PersonSerializer,
    TicketCreateSerializer,
    TicketDetailSerializer,
    TicketListSerializer,
)

SORT_OPTIONS = {
    "newest": "-created_at",
    "oldest": "created_at",
    "recently_updated": "-updated_at",
}


def get_actor(request):
    """No auth in this assignment: the active person is sent as a header."""
    actor_id = request.headers.get("X-Actor-Id") or request.data.get("actor")
    person = Person.objects.filter(pk=actor_id).first()
    if not person:
        raise ValidationError({"actor": "A valid acting user is required."})
    return person


def require(condition, message):
    if not condition:
        raise ValidationError({"detail": message})


@api_view(["GET"])
def bootstrap(request):
    """Everything the SPA needs to render its dropdowns in one round-trip."""
    return Response(
        {
            "people": PersonSerializer(Person.objects.all(), many=True).data,
            "departments": DepartmentSerializer(Department.objects.all(), many=True).data,
            "offices": OfficeSerializer(Office.objects.prefetch_related("floors"), many=True).data,
            "issue_types": IssueTypeSerializer(IssueType.objects.all(), many=True).data,
            "priorities": [{"value": p[0], "label": p[1]} for p in Ticket._meta.get_field("priority").choices],
        }
    )


class TicketViewSet(ModelViewSet):
    http_method_names = ["get", "post", "patch"]

    def get_queryset(self):
        qs = Ticket.objects.select_related(
            "office", "created_by", "department", "department_poc", "technician"
        ).prefetch_related("issues", "floors")
        p = self.request.query_params

        tab = p.get("tab", "open")
        if tab == "open":
            qs = qs.filter(status__in=TicketStatus.open_statuses())
        elif tab == "closed":
            qs = qs.filter(status__in=TicketStatus.closed_statuses())

        search = (p.get("search") or "").strip()
        if search:
            qs = qs.filter(
                Q(title__icontains=search)
                | Q(description__icontains=search)
                | Q(office__name__icontains=search)
            )
        if p.get("priority"):
            qs = qs.filter(priority__in=p.get("priority").split(","))
        if p.get("department"):
            qs = qs.filter(department_id=p.get("department"))
        if p.get("status"):
            qs = qs.filter(status=p.get("status"))
        return qs.order_by(SORT_OPTIONS.get(p.get("sort"), "-created_at"))

    def get_serializer_class(self):
        if self.action == "create":
            return TicketCreateSerializer
        if self.action in ("retrieve",):
            return TicketDetailSerializer
        return TicketListSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ticket = serializer.save()
        return Response(self._detail(ticket), status=http.HTTP_201_CREATED)

    def _detail(self, ticket):
        ticket.refresh_from_db()
        return TicketDetailSerializer(ticket).data

    def _log(self, ticket, actor, verb, from_value="", to_value="", body="", kind="ACTION"):
        Activity.objects.create(
            ticket=ticket, actor=actor, verb=verb, from_value=from_value,
            to_value=to_value, body=body, kind=kind,
        )

    @action(detail=True, methods=["post"], url_path="assign-worker")
    def assign_worker(self, request, pk=None):
        ticket = self.get_object()
        actor = get_actor(request)
        require(actor.role == Role.DEPARTMENT_POC, "Only a Department POC can assign a worker.")
        require(
            actor.department_id == ticket.department_id,
            "Only a Department POC from this ticket's own department can act on it.",
        )
        require(
            ticket.status in (TicketStatus.PENDING_ASSIGNMENT, TicketStatus.PENDING_POC_REVIEW),
            "This ticket is not awaiting a worker assignment.",
        )
        technician = Person.objects.filter(pk=request.data.get("technician")).first()
        require(technician and technician.role == Role.TECHNICIAN, "Select a valid technician.")
        require(
            technician.department_id == ticket.department_id,
            "The technician must belong to the ticket's department.",
        )
        priority = request.data.get("priority")
        require(
            priority in Priority.values and priority != Priority.UNSET,
            "Select a priority for this ticket.",
        )

        previous_technician = str(ticket.technician) if ticket.technician else "Unassigned"
        previous_priority = ticket.get_priority_display()

        ticket.technician = technician
        ticket.priority = priority
        ticket.department_poc = actor  # records who actually handled it, not a pre-assignment
        ticket.status = TicketStatus.PENDING_ASSESSMENT
        ticket.save()

        self._log(ticket, actor, "set priority.", previous_priority, dict(Priority.choices)[priority])
        self._log(ticket, actor, "assigned technician.", previous_technician, str(technician))
        return Response(self._detail(ticket))

    @action(detail=True, methods=["post"], url_path="change-department")
    def change_department(self, request, pk=None):
        ticket = self.get_object()
        actor = get_actor(request)
        require(actor.role == Role.DEPARTMENT_POC, "Only a Department POC can change department.")
        require(
            actor.department_id == ticket.department_id,
            "Only a Department POC from this ticket's own department can act on it.",
        )
        department = Department.objects.filter(pk=request.data.get("department")).first()
        require(department is not None, "Select a valid department.")
        require(department.id != ticket.department_id, "Ticket is already in that department.")
        previous = ticket.department.name if ticket.department else "Unassigned"
        ticket.department = department
        ticket.technician = None
        ticket.department_poc = None  # ownership moves to the new department as a group
        ticket.priority = Priority.UNSET  # the new department decides priority afresh
        ticket.status = TicketStatus.PENDING_ASSIGNMENT
        ticket.save()
        self._log(ticket, actor, "changed department.", previous, department.name)
        return Response(self._detail(ticket))
    
    @action(detail=True, methods=["post"])
    def assessment(self, request, pk=None):
        ticket = self.get_object()
        actor = get_actor(request)
        require(
            ticket.technician_id == actor.id,
            "Only the technician assigned to this ticket can submit an assessment.",
        )
        require(
            ticket.status == TicketStatus.PENDING_ASSESSMENT,
            "This ticket is not awaiting a technician assessment.",
        )
        outcome = request.data.get("outcome")
        require(outcome in AssessmentOutcome.values, "Select a valid assessment outcome.")
        note = (request.data.get("note") or "").strip()
        require(
            outcome == AssessmentOutcome.FULLY_RESOLVED or len(note) >= 10,
            "A note of at least 10 characters is required for this outcome.",
        )
        previous = ticket.get_status_display()
        ticket.status = TicketStatus.PENDING_POC_REVIEW
        ticket.save()
        self._log(
            ticket, actor, "changed status of the ticket.", previous,
            AssessmentOutcome(outcome).label,
        )
        if note:
            self._log(ticket, actor, "", body=note, kind="COMMENT")
        return Response(self._detail(ticket))

    @action(detail=True, methods=["post"], url_path="mark-resolved")
    def mark_resolved(self, request, pk=None):
        ticket = self.get_object()
        actor = get_actor(request)
        require(
            ticket.created_by_id == actor.id
            or (actor.role == Role.DEPARTMENT_POC and actor.department_id == ticket.department_id),
            "Only the ticket creator or a Department POC from this ticket's department can close it.",
        )
        require(ticket.is_open, "This ticket is already closed.")
        previous = ticket.get_status_display()
        ticket.status = TicketStatus.RESOLVED
        ticket.closed_at = timezone.now()
        ticket.save()
        self._log(ticket, actor, "marked the ticket resolved.", previous, "Resolved")
        return Response(self._detail(ticket))

    @action(detail=True, methods=["post"])
    def reopen(self, request, pk=None):
        ticket = self.get_object()
        actor = get_actor(request)
        require(not ticket.is_open, "This ticket is already open.")
        ticket.status = TicketStatus.PENDING_ASSIGNMENT
        ticket.closed_at = None
        ticket.technician = None
        ticket.save()
        self._log(ticket, actor, "reopened the ticket.", "Closed", "Pending Technician Assignment")
        return Response(self._detail(ticket))

    @action(detail=True, methods=["post"])
    def comments(self, request, pk=None):
        ticket = self.get_object()
        actor = get_actor(request)
        body = (request.data.get("body") or "").strip()
        require(body != "", "Comment cannot be empty.")
        self._log(ticket, actor, "", body=body, kind="COMMENT")
        return Response(self._detail(ticket), status=http.HTTP_201_CREATED)
