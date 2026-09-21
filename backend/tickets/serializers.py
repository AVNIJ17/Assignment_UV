from rest_framework import serializers

from .models import (
    Activity,
    Department,
    Floor,
    IssueType,
    Office,
    Person,
    Ticket,
    TicketStatus,
)


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ["id", "name"]


class FloorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Floor
        fields = ["id", "label"]


class OfficeSerializer(serializers.ModelSerializer):
    floors = FloorSerializer(many=True, read_only=True)
    has_multiple_floors = serializers.BooleanField(read_only=True)

    class Meta:
        model = Office
        fields = ["id", "name", "floors", "has_multiple_floors"]


class PersonSerializer(serializers.ModelSerializer):
    role_display = serializers.CharField(source="get_role_display", read_only=True)
    department_name = serializers.CharField(source="department.name", default=None, read_only=True)
    initials = serializers.CharField(read_only=True)

    class Meta:
        model = Person
        fields = ["id", "name", "role", "role_display", "department", "department_name", "initials"]


class IssueTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = IssueType
        fields = ["id", "name", "department", "default_priority", "is_quick_issue"]


class ActivitySerializer(serializers.ModelSerializer):
    actor = PersonSerializer(read_only=True)

    class Meta:
        model = Activity
        fields = ["id", "actor", "kind", "verb", "from_value", "to_value", "body", "created_at"]


class TicketListSerializer(serializers.ModelSerializer):
    """Shape used by the paginated listing cards."""

    title = serializers.SerializerMethodField()
    location = serializers.CharField(read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    priority_display = serializers.CharField(source="get_priority_display", read_only=True)
    created_by = PersonSerializer(read_only=True)
    assignees = PersonSerializer(many=True, read_only=True)
    is_open = serializers.BooleanField(read_only=True)
    issue_names = serializers.SerializerMethodField()

    class Meta:
        model = Ticket
        fields = [
            "id", "issue_no", "title", "location", "status", "status_display", "priority",
            "priority_display", "created_by", "assignees", "is_open", "issue_names",
            "created_at", "updated_at",
        ]

    def get_title(self, obj):
        return obj.title or ", ".join(i.name for i in obj.issues.all())

    def get_issue_names(self, obj):
        return [i.name for i in obj.issues.all()]


class TicketDetailSerializer(TicketListSerializer):
    activities = ActivitySerializer(many=True, read_only=True)
    department = DepartmentSerializer(read_only=True)
    floors = FloorSerializer(many=True, read_only=True)

    class Meta(TicketListSerializer.Meta):
        fields = TicketListSerializer.Meta.fields + [
            "description", "department", "floors", "activities", "closed_at",
        ]


class TicketCreateSerializer(serializers.ModelSerializer):
    issues = serializers.PrimaryKeyRelatedField(many=True, queryset=IssueType.objects.all())
    floors = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Floor.objects.all(), required=False
    )
    created_by = serializers.PrimaryKeyRelatedField(queryset=Person.objects.all())

    class Meta:
        model = Ticket
        fields = ["id", "office", "issues", "floors", "description", "created_by"]

    def validate_issues(self, value):
        if not value:
            raise serializers.ValidationError("Select at least one issue.")
        return value

    def validate(self, attrs):
        """Business rule: floors are mandatory for multi-floor offices and must
        belong to the selected office."""
        office = attrs["office"]
        floors = attrs.get("floors") or []
        if office.has_multiple_floors and not floors:
            raise serializers.ValidationError(
                {"floors": "This office has multiple floors, so at least one floor is required."}
            )
        wrong = [f.label for f in floors if f.office_id != office.id]
        if wrong:
            raise serializers.ValidationError(
                {"floors": f"Floor(s) {', '.join(wrong)} do not belong to {office.name}."}
            )
        return attrs

    def create(self, validated_data):
        issues = validated_data.pop("issues")
        floors = validated_data.pop("floors", [])
        ticket = Ticket.objects.create(**validated_data)
        ticket.issues.set(issues)
        ticket.floors.set(floors)

        # Priority is decided by the department, not the client — the ticket
        # starts unset and is prioritised when a Department POC assigns a worker.
        # Department is still derived from the issue catalogue, but the ticket is
        # routed to the department as a group, not to any one specific employee.
        ticket.title = ", ".join(i.name for i in issues)
        ticket.department = issues[0].department
        ticket.status = TicketStatus.PENDING_ASSIGNMENT
        ticket.save()

        Activity.objects.create(ticket=ticket, actor=ticket.created_by, verb="created")
        Activity.objects.create(
            ticket=ticket, actor=None, verb="routed to department",
            from_value="Unassigned", to_value=ticket.department.name if ticket.department else "Unassigned",
        )
        return ticket