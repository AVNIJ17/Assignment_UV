from django.db import models, transaction


class Role(models.TextChoices):
    CLIENT_POC = "CLIENT_POC", "Client POC"
    DEPARTMENT_POC = "DEPARTMENT_POC", "Department POC"
    TECHNICIAN = "TECHNICIAN", "Technician"


class TicketStatus(models.TextChoices):
    PENDING_ASSIGNMENT = "PENDING_ASSIGNMENT", "Pending Technician Assignment"
    PENDING_ASSESSMENT = "PENDING_ASSESSMENT", "Pending Technician Assessment"
    PENDING_POC_REVIEW = "PENDING_POC_REVIEW", "Pending Department POC Review"
    RESOLVED = "RESOLVED", "Resolved"
    CLOSED = "CLOSED", "Closed"

    @classmethod
    def open_statuses(cls):
        return [cls.PENDING_ASSIGNMENT, cls.PENDING_ASSESSMENT, cls.PENDING_POC_REVIEW]

    @classmethod
    def closed_statuses(cls):
        return [cls.RESOLVED, cls.CLOSED]


class Priority(models.TextChoices):
    UNSET = "UNSET", "Not Set"
    LOW = "LOW", "Low"
    MEDIUM = "MEDIUM", "Medium"
    HIGH = "HIGH", "High"
    CRITICAL = "CRITICAL", "Critical"


PRIORITY_RANK = {"LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}


class Department(models.Model):
    name = models.CharField(max_length=80, unique=True)

    def __str__(self):
        return self.name


class Office(models.Model):
    """A client office/site, e.g. "Harness-1317"."""

    name = models.CharField(max_length=80, unique=True)

    def __str__(self):
        return self.name

    @property
    def has_multiple_floors(self):
        return self.floors.count() > 1


class Floor(models.Model):
    office = models.ForeignKey(Office, related_name="floors", on_delete=models.CASCADE)
    label = models.CharField(max_length=20)  # "2F"
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order"]
        unique_together = ("office", "label")

    def __str__(self):
        return f"{self.office.name} {self.label}"


class Person(models.Model):
    """Lightweight actor record. Real auth is out of scope for this assignment."""

    name = models.CharField(max_length=80)
    role = models.CharField(max_length=20, choices=Role.choices)
    department = models.ForeignKey(
        Department, null=True, blank=True, related_name="members", on_delete=models.SET_NULL
    )
    office = models.ForeignKey(
        Office, null=True, blank=True, related_name="people", on_delete=models.SET_NULL
    )

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.get_role_display()})"

    @property
    def initials(self):
        return "".join(part[0] for part in self.name.split()[:2]).upper()


class IssueType(models.Model):
    """Catalogue of selectable issues. `is_quick_issue` powers the Quick Issues chips."""

    name = models.CharField(max_length=80, unique=True)
    department = models.ForeignKey(Department, related_name="issue_types", on_delete=models.PROTECT)
    default_priority = models.CharField(
        max_length=10, choices=Priority.choices, default=Priority.MEDIUM
    )
    is_quick_issue = models.BooleanField(default=False)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

class TicketSequence(models.Model):
    """Single-row counter backing Ticket.issue_no."""

    last_value = models.PositiveIntegerField(default=0)

    @classmethod
    def next_issue_no(cls):
        with transaction.atomic():
            row, _ = cls.objects.select_for_update().get_or_create(pk=1)
            row.last_value += 1
            row.save(update_fields=["last_value"])
            return f"{row.last_value:06d}"

class Ticket(models.Model):
    issue_no = models.CharField(max_length=6, unique=True, editable=False, db_index=True)
    title = models.CharField(max_length=140, blank=True)
    description = models.TextField(blank=True)
    office = models.ForeignKey(Office, related_name="tickets", on_delete=models.PROTECT)
    floors = models.ManyToManyField(Floor, related_name="tickets", blank=True)
    issues = models.ManyToManyField(IssueType, related_name="tickets")
        # Blank until a Department POC sets it (clients do not choose the priority).
    priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.UNSET)
    status = models.CharField(
        max_length=25, choices=TicketStatus.choices, default=TicketStatus.PENDING_ASSIGNMENT
    )
    department = models.ForeignKey(
        Department, related_name="tickets", null=True, on_delete=models.SET_NULL
    )
    created_by = models.ForeignKey(
        Person, related_name="created_tickets", on_delete=models.PROTECT
    )
    department_poc = models.ForeignKey(
        Person, null=True, blank=True, related_name="poc_tickets", on_delete=models.SET_NULL
    )
    technician = models.ForeignKey(
        Person, null=True, blank=True, related_name="tech_tickets", on_delete=models.SET_NULL
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if not self.issue_no:
            self.issue_no = TicketSequence.next_issue_no()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"#{self.pk} {self.title}"

    @property
    def is_open(self):
        return self.status in TicketStatus.open_statuses()

    @property
    def location(self):
        floors = ", ".join(f.label for f in self.floors.all())
        return f"{self.office.name}; {floors}" if floors else self.office.name

    def assignees(self):
        people = []
        if self.department_poc:
            people.append(self.department_poc)
        if self.technician:
            people.append(self.technician)
        return people

    def action_required_for(self, role):
        """Which role currently owns the next step on this ticket."""
        mapping = {
            TicketStatus.PENDING_ASSIGNMENT: Role.DEPARTMENT_POC,
            TicketStatus.PENDING_ASSESSMENT: Role.TECHNICIAN,
            TicketStatus.PENDING_POC_REVIEW: Role.DEPARTMENT_POC,
        }
        return mapping.get(self.status) == role


class AssessmentOutcome(models.TextChoices):
    FULLY_RESOLVED = "FULLY_RESOLVED", "Fully Resolved"
    PARTIALLY_RESOLVED = "PARTIALLY_RESOLVED", "Partially Resolved"
    SUGGEST_CHANGE = "SUGGEST_CHANGE", "Suggest Department/Worker Change"


class Activity(models.Model):
    """Append-only audit trail rendered by the ACTIVITY panel."""

    class Kind(models.TextChoices):
        ACTION = "ACTION", "Action"
        COMMENT = "COMMENT", "Comment"

    ticket = models.ForeignKey(Ticket, related_name="activities", on_delete=models.CASCADE)
    actor = models.ForeignKey(
        Person, null=True, blank=True, related_name="activities", on_delete=models.SET_NULL
    )
    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.ACTION)
    verb = models.CharField(max_length=40, blank=True)  # created / auto-assigned / ...
    from_value = models.CharField(max_length=120, blank=True)
    to_value = models.CharField(max_length=120, blank=True)
    body = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]
        verbose_name_plural = "activities"

    def __str__(self):
        return f"{self.ticket_id}: {self.verb or 'comment'}"
