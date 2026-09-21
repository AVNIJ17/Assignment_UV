from django.contrib import admin

from .models import Activity, Department, Floor, IssueType, Office, Person, Ticket

admin.site.register([Department, Office, Floor, Person, IssueType, Ticket, Activity])
