from django.db import migrations, models


def backfill_issue_numbers(apps, schema_editor):
    Ticket = apps.get_model("tickets", "Ticket")
    TicketSequence = apps.get_model("tickets", "TicketSequence")

    count = 0
    for count, ticket in enumerate(Ticket.objects.order_by("created_at", "id"), start=1):
        ticket.issue_no = f"{count:06d}"
        ticket.save(update_fields=["issue_no"])

    TicketSequence.objects.update_or_create(pk=1, defaults={"last_value": count})


def noop_reverse(apps, schema_editor):
    pass

class Migration(migrations.Migration):
    dependencies = [("tickets", "0001_initial")]

    operations = [
        migrations.CreateModel(
            name="TicketSequence",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("last_value", models.PositiveIntegerField(default=0)),
            ],
        ),
        migrations.AddField(
            model_name="ticket",
            name="issue_no",
            field=models.CharField(max_length=6, null=True, blank=True, editable=False, db_index=True),
        ),
        migrations.RunPython(backfill_issue_numbers, noop_reverse),
        migrations.AlterField(
            model_name="ticket",
            name="issue_no",
            field=models.CharField(max_length=6, unique=True, editable=False, db_index=True),
        ),
    ]