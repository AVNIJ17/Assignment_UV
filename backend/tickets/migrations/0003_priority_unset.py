from django.db import migrations, models


def unset_priority_on_pending_tickets(apps, schema_editor):
    Ticket = apps.get_model("tickets", "Ticket")
    Ticket.objects.filter(status="PENDING_ASSIGNMENT").update(priority="UNSET")


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [("tickets", "0002_ticket_issue_no")]

    operations = [
        migrations.AlterField(
            model_name="ticket",
            name="priority",
            field=models.CharField(
                max_length=10,
                choices=[
                    ("UNSET", "Not Set"), ("LOW", "Low"), ("MEDIUM", "Medium"),
                    ("HIGH", "High"), ("CRITICAL", "Critical"),
                ],
                default="UNSET",
            ),
        ),
        migrations.RunPython(unset_priority_on_pending_tickets, noop_reverse),
    ]