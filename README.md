# Ticket Desk — Full Stack Take-Home

A facility-management ticketing app implementing the flow in the supplied wireframe: a Client POC
raises a ticket, the system auto-routes it to the Department POC, who assigns a Technician,
who submits an assessment, which the Department POC then reviews and closes.

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

> There is no login. Use the "Acting as" dropdown in the top bar to switch between a Client POC,a Department POC and a Technician — the available actions on a ticket change with the role.

## 3. Test commands

```bash
# Backend — 15 tests (API success, validation, workflow rules, pagination)
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
| `POST` | `/tickets/{id}/assign-worker/` | Department POC assigns a technician. Body: `{"technician": id}` |
| `POST` | `/tickets/{id}/change-department/` | Re-route the ticket. Body: `{"department": id}` |
| `POST` | `/tickets/{id}/assessment/` | Technician outcome. Body: `{"outcome": "FULLY_RESOLVED\|PARTIALLY_RESOLVED\|SUGGEST_CHANGE", "note": "..."}` |
| `POST` | `/tickets/{id}/mark-resolved/` | Creator or Department POC closes the ticket |
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
  -H 'Content-Type: application/json' -H 'X-Actor-Id: 3' -d '{"technician":7}'
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
| `IssueType` | Selectable issue catalogue; `is_quick_issue` powers the Quick Issues chips, `default_priority` drives auto-prioritisation, `department` drives auto-routing |
| `Ticket` | Core entity. M2M to `IssueType` and `Floor`, FKs to `Office`, `Department` and three `Person` roles. `status` moves through `PENDING_ASSIGNMENT → PENDING_ASSESSMENT → PENDING_POC_REVIEW → RESOLVED/CLOSED` |
| `Activity` | Append-only audit trail (`ACTION` or `COMMENT`) rendered by the ACTIVITY panel with from → to transitions |

**Meaningful relationships:** `Ticket ↔ IssueType` (many-to-many), `Ticket ↔ Floor` (many-to-many,
constrained to the ticket's own office), and `Ticket → Activity` (one-to-many).

### Server-side business rules

1. **Floors are mandatory for multi-floor offices**, and every selected floor must belong to the
   selected office (rejects cross-office tampering that the UI can't produce).
2. At least one issue is required.
3. Only a **Department POC** may assign a worker, and the technician must belong to the ticket's
   department.
4. Only the **assigned technician** may submit the assessment, and only while the ticket is awaiting
   assessment.
5. A partial resolution or a department-change suggestion requires a note of at least 10 characters.
6. Only the ticket creator or the Department POC may close it, and only while it is open.
7. Priority and owning department are derived server-side from the selected issues, never trusted
   from the client.

## 6. Sample data

`python manage.py seed_data` wipes and reloads the demo dataset: 4 departments, 3 offices (6 floors),
11 people, 10 issue types and **36 tickets** — 27 open (3 pages at 10 per page) and 9 closed —
spread across all statuses with pre-populated activity trails. Re-run it any time to reset.

## 7. Assumptions

- **No authentication.** The brief says auth isn't required, so `Person` records stand in for users
  and the role is switched from the app bar. Every write carries `X-Actor-Id`; the same rule checks
  would sit on the authenticated user in a real build.
- **Auto-assignment** routes a new ticket to the first Department POC of the department that owns the
  first selected issue. Real round-robin or load balancing is out of scope.
- **Priority is derived**, not entered by the client: the highest `default_priority` among the
  selected issues wins. Clients often over-report urgency, so this keeps the queue honest.
- **Ticket title is derived** from the selected issue names, since the wireframe shows no title field.
- **"Technician Closed" is not terminal.** The technician's assessment moves the ticket to
  *Pending Department POC Review*; the POC makes the final close, matching wireframe screen 4.
- **Tabs map to status groups:** Open = the three pending statuses, Closed = Resolved/Closed.
- The client's "Mark Resolved" is available on any open ticket, as shown in wireframe screen 1.
- A single office is preselected from the acting client's profile; the picker still allows changing it.

## 8. Limitations

- No authentication, permissions or rate limiting; role checks are advisory.
- No file/photo attachments on tickets or comments.
- No notifications (email/push) on assignment or status change.
- Search is a simple `icontains` scan — fine for 36 rows, not for 36,000.
- Activity filter tabs and pagination state are not reflected in the URL, so they don't survive a
  page reload or a shared link.
- No optimistic UI: every action waits for the server round-trip.
- SQLite only; PostgreSQL would need a settings change (no other code changes).

## 9. Time spent

Roughly **8 hours** — about 3 on the backend (models, API, workflow rules, tests), 4 on the frontend
(components, screens, states, tests) and 1 on documentation and polish.

## 10. What I would do next with more time

1. **Real auth** — Django sessions or JWT, with DRF permission classes replacing the `X-Actor-Id`
   header, plus per-role queryset scoping (a client should only see their own office's tickets).
2. **URL-driven listing state** — put tab, filters, sort and page into query params so views are
   shareable and reload-safe; add cursor pagination for large datasets.
3. **Server-driven capabilities** — return an `available_actions` array per ticket so the CTA panel
   never has to duplicate the workflow rules that already live in the backend.
4. **Richer tests** — a full workflow integration test, MSW-backed tests for the listing page's
   loading/error/empty paths, and an accessibility audit with axe.
5. **Product depth** — attachments, SLA timers with breach warnings, email notifications, an
   assignment load-balancer, and full-text search via Postgres `SearchVector`.

## 11. AI-assisted development disclosure

I used Claude (Anthropic) as a pair-programming assistant while building this. It helped scaffold
boilerplate (Django settings, serializer/view skeletons, MUI component shells), draft the seed
script and test cases, and review this README for gaps.

All architectural decisions — the data model, the status machine, where each business rule lives, the
role-aware CTA design and the component split — were mine, and every file was reviewed, run and
adjusted by hand. Both test suites were executed locally and the full workflow was verified
end-to-end via the running app and `curl`. I'm happy to walk through, debug or extend any part of
this code in the follow-up discussion.

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
 