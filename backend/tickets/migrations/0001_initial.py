import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Department',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=80, unique=True)),
            ],
        ),
        migrations.CreateModel(
            name='Office',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=80, unique=True)),
            ],
        ),
        migrations.CreateModel(
            name='IssueType',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=80, unique=True)),
                ('default_priority', models.CharField(choices=[('LOW', 'Low'), ('MEDIUM', 'Medium'), ('HIGH', 'High'), ('CRITICAL', 'Critical')], default='MEDIUM', max_length=10)),
                ('is_quick_issue', models.BooleanField(default=False)),
                ('department', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='issue_types', to='tickets.department')),
            ],
            options={
                'ordering': ['name'],
            },
        ),
        migrations.CreateModel(
            name='Floor',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('label', models.CharField(max_length=20)),
                ('order', models.PositiveIntegerField(default=0)),
                ('office', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='floors', to='tickets.office')),
            ],
            options={
                'ordering': ['order'],
                'unique_together': {('office', 'label')},
            },
        ),
        migrations.CreateModel(
            name='Person',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=80)),
                ('role', models.CharField(choices=[('CLIENT_POC', 'Client POC'), ('DEPARTMENT_POC', 'Department POC'), ('TECHNICIAN', 'Technician')], max_length=20)),
                ('department', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='members', to='tickets.department')),
                ('office', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='people', to='tickets.office')),
            ],
            options={
                'ordering': ['name'],
            },
        ),
        migrations.CreateModel(
            name='Ticket',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(blank=True, max_length=140)),
                ('description', models.TextField(blank=True)),
                ('priority', models.CharField(choices=[('LOW', 'Low'), ('MEDIUM', 'Medium'), ('HIGH', 'High'), ('CRITICAL', 'Critical')], default='MEDIUM', max_length=10)),
                ('status', models.CharField(choices=[('PENDING_ASSIGNMENT', 'Pending Technician Assignment'), ('PENDING_ASSESSMENT', 'Pending Technician Assessment'), ('PENDING_POC_REVIEW', 'Pending Department POC Review'), ('RESOLVED', 'Resolved'), ('CLOSED', 'Closed')], default='PENDING_ASSIGNMENT', max_length=25)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('closed_at', models.DateTimeField(blank=True, null=True)),
                ('created_by', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='created_tickets', to='tickets.person')),
                ('department', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='tickets', to='tickets.department')),
                ('department_poc', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='poc_tickets', to='tickets.person')),
                ('floors', models.ManyToManyField(blank=True, related_name='tickets', to='tickets.floor')),
                ('issues', models.ManyToManyField(related_name='tickets', to='tickets.issuetype')),
                ('office', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='tickets', to='tickets.office')),
                ('technician', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='tech_tickets', to='tickets.person')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='Activity',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('kind', models.CharField(choices=[('ACTION', 'Action'), ('COMMENT', 'Comment')], default='ACTION', max_length=10)),
                ('verb', models.CharField(blank=True, max_length=40)),
                ('from_value', models.CharField(blank=True, max_length=120)),
                ('to_value', models.CharField(blank=True, max_length=120)),
                ('body', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('actor', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='activities', to='tickets.person')),
                ('ticket', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='activities', to='tickets.ticket')),
            ],
            options={
                'verbose_name_plural': 'activities',
                'ordering': ['created_at', 'id'],
            },
        ),
    ]
