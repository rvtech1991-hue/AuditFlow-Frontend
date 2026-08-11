# Audit Management SaaS — Product Blueprint

Multi-tenant audit tracking platform. This document covers roles, information architecture, menu hierarchy, user journeys, and screen designs, based on the requirements provided, plus recommendations to consider before design sign-off.

---

## 1. User roles

| Role | Created by | Scope | Core capabilities |
|---|---|---|---|
| **Platform admin** | System / internal | Cross-tenant | Creates auditor accounts (tenants), manages subscriptions, views system health, no access to audit content itself |
| **Auditor** | Platform admin | One or more companies | Creates companies & sub-companies, creates and maps users, creates and assigns tasks, edits/closes/reopens tasks, posts dashboard announcements, views all reports |
| **Employee (assignee)** | Auditor | One or more companies/sub-companies (as mapped) | Views assigned tasks, updates status, comments, uploads documents, views own dashboard |
| **Company admin** | Auditor | Single company + its sub-companies | Self-service user management within their own org, views all tasks for their company, cannot create tasks |

**Note on the Auditor role:** the requirement describes one auditor account working across many companies (each with many sub-companies). In practice, audit firms usually have a *team* of auditors, not one person per tenant. Recommend modeling "Auditor" as a role that multiple named individuals within a firm can hold, rather than a single account — see §5.

---

## 2. Information architecture

```
Login & Authentication
├── Sign in
├── Forgot / reset password
└── (recommended) MFA challenge

Dashboard  [role-aware landing page]
├── Standard view
└── Executive view

Task
├── Task grid (default: current week, filterable)
├── Create new task            [Auditor only]
├── Bulk create tasks (Excel upload + downloadable template)   [Auditor only]
├── Task details                [drill-in from grid or search]
│   ├── Overview (ID, title, description, attachments)
│   ├── Comments & discussion
│   ├── Document uploads
│   ├── Status history
│   └── Audit timeline (full activity log)
└── Global search (task ID / description, autocomplete)

Admin                            [Platform admin]
├── Auditor accounts
└── System / tenant overview

Company management               [Auditor, Company admin]
├── Company list
├── Company create / edit
├── Sub-company create / edit
└── User management (create, edit, deactivate, map to company/sub-company)

Reports
├── Filter builder (company, sub-company, person, status, date range, search)
└── Export (Excel, PDF)

Notifications                    [recommended as first-class menu item]
├── Notification center (in-app)
└── Notification preferences

User profile
├── Theme toggle
├── Account details
└── Logout
```

### Navigation shell
- **Left sidebar**: Dashboard, Task, Reports, Company management (Auditor/Company admin only), Admin (Platform admin only) — persistent across the app.
- **Top bar**: global search, notification bell with unread count, profile menu.
- **Role gating**: sidebar items render conditionally by role; Task grid and Reports are row-level filtered by the user's company/sub-company mapping even when the menu item is visible to everyone.

---

## 3. Menu-to-role matrix

| Menu | Platform admin | Auditor | Company admin | Employee |
|---|:---:|:---:|:---:|:---:|
| Dashboard | – | Standard + Executive | Standard | Standard (own tasks) |
| Task — view | – | All tasks in scope | Company tasks | Assigned tasks only |
| Task — create | – | ✓ | – | – |
| Task — comment/update status/upload | – | ✓ | – | ✓ (assigned tasks) |
| Company management | – | ✓ | View only | – |
| User management | Auditor accounts only | ✓ | Own company only | – |
| Reports | – | ✓ | Own company | Own tasks |
| Admin | ✓ | – | – | – |
| Notifications / Profile | ✓ | ✓ | ✓ | ✓ |

---

## 4. User journeys

**Tenant onboarding**
Platform admin creates an auditor account → auditor signs in → creates Company records → creates Sub-company records under each company → creates Employee users → maps each employee to one or more companies/sub-companies.

**Audit-to-resolution loop**
Auditor performs an audit and finds a discrepancy → clicks "Create new task" → fills title, description, company/sub-company, assignee, priority, due date → attaches supporting evidence → submits.
→ System sends email + in-app notification to the assignee.
→ Employee opens the task from their dashboard or the grid → reviews details → adds a comment and/or uploads a document → changes status (e.g. Open → In progress).
→ System notifies the auditor of the status/comment change.
→ Employee marks the task Resolved / Closed pending auditor sign-off.
→ Auditor reviews the evidence, either closes the task or reopens it with a comment explaining why.
→ Every state change is appended to the task's audit timeline, immutable.

**Bulk task creation**
Auditor finds many similar findings across sub-companies (e.g. the same checklist gap in 40 sub-companies) → downloads the task template (pre-populated with that tenant's companies, sub-companies, and active users for validation) → fills it offline → uploads it back → system validates every row and shows a preview: valid rows ready to import, invalid rows flagged with the specific reason (unknown assignee, missing title, etc.) → auditor imports the valid rows; invalid rows are skipped, not blocking, and can be fixed and re-uploaded separately → each imported task triggers the same notification flow as a manually created one.

**User invitation**
Auditor or company admin fills the "Invite user" form → clicks Send invite → user record is created with status *Invited* → system emails a secure, time-limited link → user clicks it, lands on "Set your password," creates a password → account flips to *Active* → user can sign in. If the link expires, the inviter can resend from the Users list without recreating the record.

**Reporting**
Auditor or company admin opens Reports → filters by company, sub-company, assignee, status, and/or date range → reviews results → exports to Excel or PDF for the audit file / client deliverable.

---

## 5. Recommendations before locking the design

These are gaps or risks worth deciding on now, before screens are finalized — not blockers, just worth a conscious yes/no.

**Roles & access**
1. **Company admin role** — lets a company self-manage its own users instead of funneling every user request through the auditor. Reduces auditor workload as the client base scales past a handful of companies.
2. **Multiple auditors per firm** — model "auditor" as a role, not a single login, so an audit firm with a team can share a tenant.
3. **Watchers/CC on a task** — someone who should see updates but isn't the assignee (e.g. a client's CFO or the audit lead).

**Task workflow**
4. **Priority field** (High/Medium/Low) alongside status — needed to make "overdue" and dashboard sorting meaningful.
5. **Due date + SLA** — the requirement mentions an "overdue" dashboard card; overdue needs a due date to calculate against.
6. **Approval/sign-off step** — employee marks work done, but should the task auto-close or wait for auditor confirmation? (Journey above assumes the latter, matching a Jira-style workflow.)
7. **Task templates / bulk import** — **now in scope**, see §7 decisions and the Bulk create tasks screen. Template is downloadable from within the upload flow; true recurring "templates" (save a checklist as reusable) are still open — worth a separate yes/no.
8. **Document versioning** — if an employee re-uploads a corrected file, keep prior versions rather than overwrite.

**Notifications**
9. **Digest vs instant** — with 1000 auditors and many tasks, instant email per comment could flood inboxes; consider a daily digest option per user.

**Compliance & security** (relevant given the audit domain itself)
10. **Immutable audit log** — logins, task changes, document access should be append-only and tamper-evident, since the product's own credibility depends on it.
11. **Document retention policy** — how long are attachments and comments retained after a task closes.
12. **Field-level permissions** — confirm employees truly cannot edit title/description/assignee, only status/comments/attachments, at the API level, not just hidden in the UI.

**Scale & multi-tenancy** (architecture-level, flagged here since it shapes screen behavior)
13. **Tenant data isolation** — shared database with a `TenantId`/`CompanyId` column on every row (with row-level security) is the standard, cost-effective approach for this scale; a database-per-tenant model would be more isolated but harder to operate at 1000 tenants. Worth a deliberate choice, not a default.
14. **Global search scope** — since one auditor works across many companies, confirm search and the task grid should span all companies the auditor is mapped to, not just one at a time.

None of these require rework of what's already specified — they're additive. Happy to fold whichever ones are approved into the IA above before screen design starts.

---

## 6. Screen designs

Interactive mockups for Dashboard, Task creation, and Task details are provided inline in the conversation (not embedded in this document). They reflect the IA and roles above:

- **Dashboard** — status cards (open / in-progress / overdue), an announcement banner for auditor broadcasts, and a filterable view, with Standard vs Executive toggle.
- **Task creation** — form used by the Auditor role: title, description, company/sub-company, assignee, priority, due date, attachments.
- **Task details** — overview, comment thread with attachment support, status history, and full audit timeline, matching the Jira-style reference the requirements called out.

---

## 7. Decisions confirmed
| Item | Decision |
|---|---|
| Company admin role | **Confirmed, in scope.** Reflected in §1 roles and §3 menu-to-role matrix. |
| Task closure | **Employee resolves, auditor signs off to close.** Matches the lifecycle already shown: Open → In progress → Resolved → Closed, with Resolved meaning "awaiting auditor review," not "done." |
| Multi-tenant data isolation | **Shared database, `TenantId`/`CompanyId` column on every row, enforced via row-level security.** Standard, cost-effective at ~1000-tenant scale; carries into the architecture/data-model phase. |
| Bulk task creation | **Confirmed, in scope.** Excel upload with downloadable template, row-level validation, partial import (valid rows proceed, invalid rows are flagged and skipped rather than blocking the batch). |

Still open from §5, not yet decided: multiple auditors per firm as a shared role, watchers/CC on tasks, priority + due date fields, task templates/bulk import, document versioning, notification digest vs instant, immutable audit log, document retention policy, field-level permission enforcement, global search scope across companies. None of these block the remaining screens — flag anytime.

## 8. Confirmed non-functional requirements
- **Responsive across devices** — laptop, large desktop, tablet, and mobile. Screens above are designed desktop-first; each will need a defined mobile/tablet layout (likely: sidebar collapses to a bottom nav or hamburger drawer, grid/table views collapse to stacked cards).
- **Fast load, low latency, high throughput** — carries into architecture decisions: CDN for static assets, pagination/virtualized lists for the task grid, lazy-loaded charts, and caching for dashboard aggregates rather than recomputing on every load.

## 9. Suggested next steps
1. Confirm which §5 recommendations to accept, defer, or reject.
2. Lock the data model implied by this IA (Tenant, Company, SubCompany, User, Task, Comment, Attachment, StatusHistory, AuditLog) before wireframing further screens.
3. Design remaining screens: Sign in, Company/Sub-company management, User management, Reports, Notification center.
4. Move to technical architecture (multi-tenancy strategy, Azure service mapping, API contract) once the screen set is approved.
