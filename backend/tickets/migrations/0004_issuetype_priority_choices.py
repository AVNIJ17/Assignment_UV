from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("tickets", "0003_priority_unset")]

    operations = [
        migrations.AlterField(
            model_name="issuetype",
            name="default_priority",
            field=models.CharField(
                max_length=10,
                choices=[
                    ("UNSET", "Not Set"), ("LOW", "Low"), ("MEDIUM", "Medium"),
                    ("HIGH", "High"), ("CRITICAL", "Critical"),
                ],
                default="MEDIUM",
            ),
        ),
    ]