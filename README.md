# Ticket Desk

A facility-management ticketing app implementing the flow in the supplied wireframe: a Client POC
raises a ticket, the system routes it to the owning Department as a group, any Department POC from
that department sets the priority and assigns a Technician, who submits an assessment, which a
Department POC from that department then reviews and closes.

Stack: React 18 + Material UI (Vite) · Django 5 + Django REST Framework · SQLite

---

## 1. Prerequisites

| Tool | Version |
|---|---|
| Python | 3.10+ |
| Node.js | 18+ (ships with npm) |

Nothing else is needed — the database is SQLite and is created by the migration step.

## 2. Installation & running

### Quick start (macOS / Linux)

```bash
./setup.sh          # installs backend + frontend deps, migrates, seeds 36 tickets
./run-backend.sh    # terminal 1  -> http://127.0.0.1:8000
./run-frontend.sh   # terminal 2  -> http://localhost:5173
```

### Quick start (Windows)

```bat
setup.bat
:: then, in two terminals
cd backend  && venv\Scripts\python manage.py runserver 8000
cd frontend && npm run dev
```

### Manual steps

```bash
# Backend
cd backend
python3 -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_data                          # loads demo data
python manage.py runserver 8000

# Frontend (second terminal)
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to Django, so no CORS or `.env` setup is needed.

> There is no login. Use the "Acting as" dropdown in the top bar to switch between a Client POC, a
> Department POC and a Technician — the available actions on a ticket change with the role **and**
> with the acting Department POC's own department, since a ticket only accepts action from a POC in
> the department it's actually routed to.

## 3. Test commands

```bash
# Backend — 17 tests (API success, validation, workflow rules, department-ownership rules, pagination)
cd backend && python manage.py test

# Frontend — 10 tests (component rendering, conditional UI, client validation)
cd frontend && npm test
```

Both suites pass from a clean checkout.

## 4. API endpoints

Base URL: `http://127.0.0.1:8000/api`

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/bootstrap/` | People, departments, offices + floors, issue types, priorities (one round-trip for all dropdowns) |
| `GET` | `/tickets/` | **Paginated** listing. Params: `tab=open\|closed`, `page`, `page_size`, `search`, `priority` (CSV), `department`, `status`, `sort=newest\|oldest\|recently_updated` |
| `POST` | `/tickets/` | Create a ticket → `201` with the full detail payload, or `400` with field errors |
| `GET` | `/tickets/{id}/` | Ticket detail including the activity trail |
| `POST` | `/tickets/{id}/assign-worker/` | A Department POC from the ticket's own department sets the priority and assigns a technician, together, in one request. Body: `{"technician": id, "priority": "LOW\|MEDIUM\|HIGH\|CRITICAL"}` |
| `POST` | `/tickets/{id}/change-department/` | Re-route the ticket to a different department; clears the technician, the recorded POC and the priority, since the new department hasn't triaged it yet. Body: `{"department": id}` |
| `POST` | `/tickets/{id}/assessment/` | Technician outcome. Body: `{"outcome": "FULLY_RESOLVED\|PARTIALLY_RESOLVED\|SUGGEST_CHANGE", "note": "..."}` |
| `POST` | `/tickets/{id}/mark-resolved/` | Creator or a Department POC from the ticket's own department closes the ticket |
| `POST` | `/tickets/{id}/reopen/` | Reopen a closed ticket |
| `POST` | `/tickets/{id}/comments/` | Add a comment. Body: `{"body": "..."}` |

Since there is no auth, the acting user is sent as the header **`X-Actor-Id: <person id>`** on every
write. Status codes used: `200` OK, `201` Created, `400` validation/business-rule failure, `404`
unknown ticket.

Example:

```bash
curl -X POST http://127.0.0.1:8000/api/tickets/ -H 'Content-Type: application/json' \
  -d '{"office":1,"issues":[1],"floors":[2,3],"description":"AC not cooling","created_by":1}'

curl -X POST http://127.0.0.1:8000/api/tickets/1/assign-worker/ \
  -H 'Content-Type: application/json' -H 'X-Actor-Id: 3' \
  -d '{"technician":7,"priority":"HIGH"}'
```

## 5. Data model

```
Department 1─┬─* IssueType        IssueType *─* Ticket        (issues raised)
             ├─* Person           Office     1─* Floor
             └─* Ticket           Floor      *─* Ticket        (affected floors)
Office     1─* Ticket             Person     1─* Ticket        (created_by / department_poc / technician)
Ticket     1─* Activity
```

| Model | Notes |
|---|---|
| `Department` | Maintenance, Housekeeping, IT, Electrical |
| `Office` / `Floor` | A client site (e.g. `Harness-1317`) and its floors. `has_multiple_floors` drives the conditional floor picker in the form |
| `Person` | Name + `role` (`CLIENT_POC` / `DEPARTMENT_POC` / `TECHNICIAN`) + department. Stands in for authenticated users |
| `IssueType` | Selectable issue catalogue; `is_quick_issue` powers the Quick Issues chips, `department` drives auto-routing. `default_priority` is retained as reference metadata but no longer auto-sets a ticket's priority (see §7) |
| `TicketSequence` | Single-row counter that atomically hands out the next 6-digit `issue_no` (`000001`, `000002`, …), assigned once at creation and never reused |
| `Ticket` | Core entity. M2M to `IssueType` and `Floor`, FKs to `Office`, `Department` and three `Person` roles. `status` moves through `PENDING_ASSIGNMENT → PENDING_ASSESSMENT → PENDING_POC_REVIEW → RESOLVED/CLOSED`. `priority` starts `UNSET` and is set by whichever Department POC assigns the first worker |
| `Activity` | Append-only audit trail (`ACTION` or `COMMENT`) rendered by the ACTIVITY panel with from → to transitions |

**Meaningful relationships:** `Ticket ↔ IssueType` (many-to-many), `Ticket ↔ Floor` (many-to-many,
constrained to the ticket's own office), and `Ticket → Activity` (one-to-many).

### Server-side business rules

1. **Floors are mandatory for multi-floor offices**, and every selected floor must belong to the
   selected office (rejects cross-office tampering that the UI can't produce).
2. At least one issue is required.
3. **Department is derived server-side** from the selected issues; **priority is intentionally left
   unset (`UNSET`)** at creation — the client never sets it, and neither does the issue catalogue.
4. **A ticket belongs to its department as a group, not to one pre-assigned person.** Only a
   Department POC from the ticket's own department may assign a worker, change its department, or
   close it — a POC from any other department is rejected, even though the "Department POC" role
   check alone would otherwise pass.
5. **Assigning a worker sets the priority in the same request** — a Department POC must supply both
   `technician` and a non-`UNSET` `priority` together, and the technician must belong to the ticket's
   department.
6. Only the **assigned technician** may submit the assessment, and only while the ticket is awaiting
   assessment.
7. A partial resolution or a department-change suggestion requires a note of at least 10 characters.
8. Only the ticket creator or a **Department POC from the ticket's own department** may close it, and
   only while it is open.

## 6. Sample data

`python manage.py seed_data` wipes and reloads the demo dataset: 4 departments, 3 offices (6 floors),
11 people, 10 issue types and **36 tickets** — 27 open (3 pages at 10 per page) and 9 closed —
spread across all statuses with pre-populated activity trails. Tickets still sitting in
*Pending Technician Assignment* are seeded with `priority: UNSET` and no `department_poc`, matching
what a newly created ticket looks like in the live app; tickets further along have both set, as if a
Department POC had already acted on them. Re-run the command any time to reset.

## 7. Assumptions

- **No authentication.** The brief says auth isn't required, so `Person` records stand in for users
  and the role is switched from the app bar. Every write carries `X-Actor-Id`; the same rule checks
  would sit on the authenticated user in a real build.
- **Department-level ownership, not person-level.** A new ticket is routed to the department that
  owns its first selected issue, but not to any one pre-assigned POC — it belongs to the department
  as a group. Whichever Department POC actually assigns the first worker is then recorded on the
  ticket (`department_poc`) as a record of who handled it, not as a gatekeeper for who's allowed to.
- **Priority is decided by the department, not derived from the issue.** A new ticket starts with
  priority *Not Set*; the acting Department POC sets it — together with assigning a technician —
  once they've actually reviewed the ticket. Only the people triaging it know how urgent it really is.
- **Changing a ticket's department resets its triage.** Technician, recorded POC and priority are all
  cleared and the ticket returns to *Pending Technician Assignment*, since the new department hasn't
  looked at it yet.
- **Issue numbers are sequential and permanent.** Every ticket gets a 6-digit `issue_no` from a
  dedicated counter table, assigned once at creation; it's never reused or renumbered even if tickets
  are later deleted.
- **Ticket title is derived** from the selected issue names, since the wireframe shows no title field.
- **"Technician Closed" is not terminal.** The technician's assessment moves the ticket to
  *Pending Department POC Review*; the POC makes the final close, matching wireframe screen 4.
- **Tabs map to status groups:** Open = the three pending statuses, Closed = Resolved/Closed.
- The client's "Mark Resolved" is available on any open ticket, as shown in wireframe screen 1.
- A single office is preselected from the acting client's profile; the picker still allows changing it.

## 8. Limitations

- No authentication, permissions or rate limiting beyond the department-ownership check; role checks
  are advisory, not cryptographically enforced.
- No file/photo attachments on tickets or comments.
- No notifications (email/push) on assignment or status change.
- Search is a simple `icontains` scan — fine for 36 rows, not for 36,000.
- Activity filter tabs and pagination state are not reflected in the URL, so they don't survive a
  page reload or a shared link.
- No optimistic UI: every action waits for the server round-trip.
- SQLite only; PostgreSQL would need a settings change (no other code changes).
- `IssueType.default_priority` remains in the schema but is currently unused by the UI — a natural
  next step is surfacing it to the Department POC as a suggested starting priority.

## 9. Time spent

Roughly **9–10 hours** — about 3 on the initial backend (models, API, workflow rules, tests), 4 on
the frontend (components, screens, states, tests), 1 on documentation, and 2 more iterating on the
issue-numbering feature and the department-group ownership rework

## 10. What I would do next with more time

1. **Real auth** — Django sessions or JWT, with DRF permission classes replacing the `X-Actor-Id`
   header, plus per-role queryset scoping (a client should only see their own office's tickets).
2. **URL-driven listing state** — put tab, filters, sort and page into query params so views are
   shareable and reload-safe; add cursor pagination for large datasets.
3. **Server-driven capabilities** — return an `available_actions` array per ticket so the CTA panel
   and the listing's "Action Required" badge never have to independently re-derive workflow rules
   that already live in the backend.
4. **Surface `default_priority` as a suggestion** in the priority picker the Department POC sees when
   assigning a worker, rather than leaving it as unused metadata.
5. **Richer tests** — a full workflow integration test, MSW-backed tests for the listing page's
   loading/error/empty paths, and an accessibility audit with axe.
6. **Product depth** — attachments, SLA timers with breach warnings, email notifications, an
   assignment load-balancer, and full-text search via Postgres `SearchVector`.

## 11. AI-assisted development disclosure

I used Claude (Anthropic) as a pair-programming assistant while building this. It helped scaffold
boilerplate (Django settings, serializer/view skeletons, MUI component shells), draft the seed
script and test cases, and review this README for gaps. It also helped me identify and fix a real
permission bug it noticed while implementing a later change: the "Action Required" badge was
checking only role, not department, so a Department POC could see the badge on tickets outside their
own department that they had no actual permission to act on.

All architectural decisions — the data model, the status machine, where each business rule lives, the
role-aware CTA design, the department-group ownership model and the component split — were mine, and
every file was reviewed, run and adjusted by hand. Both test suites were executed locally and the
full workflow was verified end-to-end via the running app and `curl`. I'm happy to walk through,
debug or extend any part of this code in the follow-up discussion.

---

## Project layout


```
ticket-system/
├── backend/
│   ├── config/              # settings, urls, wsgi
│   ├── tickets/
│   │   ├── models.py        # Department, Office, Floor, Person, IssueType, Ticket, Activity
│   │   ├── serializers.py   # list / detail / create serializers + validation
│   │   ├── views.py         # TicketViewSet with workflow actions, filtering, bootstrap
│   │   ├── pagination.py    # 10 per page
│   │   ├── tests.py         # 15 tests
│   │   └── management/commands/seed_data.py
│   ├── manage.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/client.js        # fetch wrapper + error flattening
│   │   ├── context/AppContext.jsx
│   │   ├── components/          # StatusChip, PriorityChip, PersonBadge, StateView,
│   │   │                        # TicketCard, FiltersBar, CreateTicketDialog,
│   │   │                        # ActivityFeed, CtaPanel
│   │   ├── pages/               # TicketListPage, TicketDetailPage
│   │   └── tests/               # 10 tests
│   ├── package.json
│   └── vite.config.js
├── setup.sh / setup.bat / run-backend.sh / run-frontend.sh
└── README.md
```
 
