# AuditFlow — Project Context (Master Reference)

> **Purpose of this file:** a single place that carries full product + architecture context for AuditFlow, so a new session (human or AI) doesn't need the whole backstory re-explained. Read this before starting any non-trivial task. If something here conflicts with the code, **the code wins** — update this file rather than trusting stale context.
>
> Companion docs: [`ARCHITECTURE.md`](./ARCHITECTURE.md) (diagrams/flows) and [`README.md`](./README.md) (quickstart). Backend-side equivalents live in the backend repo (see [Repos & Docs](#repos--docs) below).

Last synthesized: 2026-08-07, against frontend `main` and backend commit `72e2130` (per the integration guide). Re-verify anything load-bearing against current code before relying on it long-term — this is a snapshot, not a live source.

---

## 1. Product Vision

AuditFlow is a **multi-tenant SaaS platform for audit firms**. An audit firm (the paying customer — a "Tenant", shown as "Auditor Account" in the platform-admin UI) uses it to track audit findings ("Tasks") raised against the companies it audits, from discovery through auditor sign-off.

**Tenancy hierarchy** (the core mental model — internalize this before touching any module):

```
Tenant (audit firm / "Auditor Account")
  └── Company (an audit client of that firm)
        └── SubCompany (optional division/region within a client)
              └── Users (Auditor / Company admin / Employee)
```

**The four roles:**

| Role | Who they are | What they can do |
|---|---|---|
| **Platform admin** | AuditFlow's own internal staff | Creates tenants, manages plans/subscriptions, views system health. **Zero access to any tenant's audit content** — no Tasks, Companies, Dashboard, or Reports, by design (server-enforced, not a UI gap). |
| **Auditor** | The audit firm's staff | Full tenant-level access: creates Companies/SubCompanies, invites/manages Users, creates/assigns/closes/reopens Tasks, views all reports. Can be mapped across multiple Companies. |
| **Company admin** | Client-side admin at a Company | Self-service user management for their own company. **View-only on Tasks** — cannot create/edit/assign/reprioritize (server-enforced). |
| **Employee** | Works assigned tasks | Status changes, comments, attachments on tasks assigned to them only. Can never touch title/description/assignee/priority/due-date. |

**Task lifecycle:** `Open → InProgress → Resolved → Closed`, with `Reopened` requiring a mandatory reason. **`Resolved` means "awaiting auditor sign-off," not "done."** Only an Auditor can `Close` or `Reopen`. Every transition is appended to an immutable timeline (`TaskStatusHistory`).

**Core user journeys:**
- **Tenant onboarding**: Platform admin creates a Tenant → Auditor creates Companies/SubCompanies → invites Employees/Company admins → (optionally) maps Auditors to specific Companies.
- **Audit-to-resolution loop**: Auditor creates a Task → assignee is notified → Employee works it, updates status/comments/attachments → Auditor reviews and Closes or Reopens.
- **Bulk task creation**: CSV/Excel upload with per-row, non-blocking validation.
- **Reporting**: filtered task export to Excel/PDF, sync for small result sets, async (queued + polled) for large ones.

---

## 2. Repos & Docs

Two separate git repos, developed together:

| Repo | Path | Stack |
|---|---|---|
| **Frontend** (this repo) | `AuditFlow-Frontend/AuditFlow-Frontend` | React 19 + Vite 6 SPA |
| **Backend** | `AuditFlow-Backend/AuditFlow-Backend/AuditFlow-Backend` | .NET 8 Clean Architecture |

**Shared docs** (one level up from both repos): `Project_Docs/Audit_Flow_Docs/`
- `1 - AuditFlow-Requirements.docx` — original business requirements, screen-by-screen ("Module N" numbering referenced in frontend code comments).
- `2 - API_SPECIFICATION.md` — **superseded**, predates route versioning; kept for history only.
- `3 - mockup-audit-saas-all-screens.html` — visual mockup the UI was built against.
- `4 - BACKEND_INTEGRATION_GUIDE.md` — **the single most important cross-repo doc.** Written 2026-08-05 against backend commit `72e2130`. Documents exact JWT claim names, the numeric-enum-over-the-wire quirk, the ProblemDetails error envelope, a full endpoint↔screen mapping, the mock→live cutover strategy, and a list of deliberate decisions not to re-litigate. **Treat as source of truth over any other doc when they disagree.** Frontend `services/*.ts` files cite this doc by section number (§5, §7, §8...) throughout — read those comments in place before assuming a contract.
- `audit-saas-blueprint.md` — product vision / role matrix / non-functional requirements source.

**Backend repo root docs** (also worth knowing about, read on demand rather than duplicating here):
- `ArchitectureFlow.md` — a lookup table of "which files to open for module X"; genuinely useful, reuse rather than re-deriving.
- `DatabaseStructure.md` — full schema, indexes, module→table map.
- `AuditSummary.md` — engagement history + Production Readiness Checklist (§13 is the current, accurate gap list; older "~20% readiness" framing in §12 is explicitly stale).
- `ModuleWiseAuditReport.md`, `AuthTestingGuide.md` — module-by-module audit notes and a hands-on curl+SQL auth testing walkthrough.

**Frontend repo:** `src/components/README.md` documents the UI foundation build-out against the requirements doc's numbered sections — check it for design-token/component provenance.

---

## 3. Backend Architecture (.NET 8)

**Stack:** ASP.NET Core 8, EF Core 8 (SQL Server — switched from PostgreSQL mid-project), ASP.NET Identity, MediatR (CQRS), FluentValidation, Hangfire (background jobs, SQL-Server-storage), SignalR (real-time), Otp.NET (real TOTP MFA), ClosedXML (Excel), QuestPDF (PDF), Serilog. Full library list in `ARCHITECTURE.md`.

**Clean Architecture, 5 projects, strict inward dependencies** (`API → Application → Domain`, `Infrastructure → Application → Domain`; Domain depends on nothing):

- **`AuditFlow.Domain`** — entities (all inherit `BaseEntity`: CreatedAt/UpdatedAt/CreatedBy/UpdatedBy/IsDeleted), enums, guard clauses. Domain events (`TaskEvents.cs`, `DomainEventDispatcher`) are **fully modeled but never wired** — dead scaffolding, not a real event bus. Don't assume it fires anything.
- **`AuditFlow.Application`** — all business logic, one `Features/<Module>/{Commands,Queries}` pair per module, handlers via MediatR. Pipeline: `ValidationBehavior → LoggingBehavior → PerformanceBehavior` (warns >500ms). Cross-cutting interfaces (`ICurrentUserService`, `ITenantScopeService`, `IApplicationDbContext`) declared here, implemented in Infrastructure.
- **`AuditFlow.Infrastructure`** — EF Core `ApplicationDbContext`, repositories (generic `Repository<T>` + per-entity, all interfaces in one file `Common/Repositories/ISpecificRepositories.cs`, no `IUnitOfWork` — implicit UoW via shared scoped DbContext), Identity/JWT services, email/file-storage provider factories, `NotificationService`, Hangfire wrapper.
- **`AuditFlow.API`** — thin controllers (build Command/Query → `_mediator.Send` → wrap `ApiResponse<T>`), `GlobalExceptionHandlingMiddleware`, `NotificationHub` (SignalR).
- **`AuditFlow.Shared`** — dead scaffold, ignore.

**Standard envelope:** `ApiResponse<T>` = `{success, data, message, errors, statusCode, correlationId, errorCode}`. Errors are RFC 9457 ProblemDetails, keyed by machine-readable `errorCode` (frontend should branch on this, never on `detail` text). Paginated lists use `PagedResult<T>` = `{items, totalCount, pageNumber, pageSize, totalPages, hasPreviousPage, hasNextPage}`.

**⚠️ Enums are plain integers over the wire.** No `JsonStringEnumConverter` is registered — `{"priority": 2}` not `{"priority": "Medium"}`. This applies to every enum (`UserRole`, `AuditTaskStatus`, `TaskPriority`, `NotificationType`, etc). The frontend's `lib/*Mapping.ts` files are the translation layer — always check there first before assuming a value is a string.

### Multi-tenancy (critical to understand before touching any query)

Shared database, row-level isolation — **not** database-per-tenant.

1. **Global EF query filter** on nearly every tenant-scoped entity: `!IsDeleted && TenantId == <caller's tenant>`, applied automatically to every LINQ query so a handler can't leak cross-tenant data just by forgetting a `.Where()`. `AuditLogs`/`TaskStatusHistories` are *meant* to skip the soft-delete half (immutability) but this isn't cleanly implemented yet — a known gap.
2. **`ITenantScopeService`** (Application-layer, not an ASP.NET policy) adds company/assignee-level scoping on top: `GetEnforcedCompanyId()` for Company admin, `GetEnforcedAssigneeId()` for Employee. Client-supplied `companyId`/`assignedToUserId` params are **silently overridden**, not just validated, for these two roles — they always get their own scoped data, never a 403.
3. Platform admin has `TenantId = null`, so the global filter naturally returns zero tenant-scoped rows — matches the "no audit content access" product rule. Admin cross-tenant queries opt in explicitly via `.IgnoreQueryFilters()`.
4. **Known gap**: `UserCompanyMapping` (join table for scoping one Auditor to specific Companies) exists in the schema but nothing populates/consumes it yet — an Auditor "mapped" to specific companies currently still sees their whole tenant.

### Auth model

JWT Bearer, 60-min access token, 7-day refresh token (SHA-256-hashed at rest, rotated on use, reuse-detection revokes all sessions on replay). Real TOTP MFA (RFC 6238) with recovery codes. Lockout after 5 failed attempts / 15 min.

JWT claims: `nameidentifier`, `name`/`emailaddress`, `role` (string, e.g. `"Auditor"`), `tenant_id` (all-zeros for Platform admin), `full_name`, `company_id`/`sub_company_id` (Company admin/Employee only), `mapped_company_id` (repeated per mapping, for Auditors — see gap above).

Authorization is `[Authorize(Roles=...)]` attribute-based only — no custom policy handlers; row/data-level scoping lives in `ITenantScopeService` + the EF global filter instead. A bare 401/403 from `[Authorize]` returns an **empty body** (not the `ApiResponse` envelope); only business-rule 401s that reach a handler get the full JSON shape.

**Seed test accounts** (password `TestPass123!`, all one tenant): `platformadmin@seed.test`, `auditor@seed.test`, `companyadmin@seed.test`, `employee@seed.test`.

### Running the backend

```bash
cd "C:\Rakesh\My Workspace\My Developments\Projects\AuditFlow-Backend\AuditFlow-Backend\AuditFlow-Backend"
dotnet run --project src/AuditFlow.API --urls http://localhost:5298
```
- Health: `GET http://localhost:5298/health` (~10-12s startup).
- Swagger (dev only): `http://localhost:5298/`.
- DB: local SQL Server, Windows-auth, database `AuditFlow`. Apply migrations: `dotnet ef database update --project src/AuditFlow.Infrastructure --startup-project src/AuditFlow.API`.
- Dev email → `.html`/`.eml` files at `C:\AuditFlow\EmailPickup\` (no real SMTP in dev). Dev file storage → `C:\AuditFlow\FileStorage`. Logs → `C:\AuditFlow\Logs\`.
- Confirm `Application:CorsOrigins` in `appsettings.json` includes whatever port the Vite dev server actually runs on.

### Current known gaps (production-readiness, not "unbuilt")

All 10 functional modules are wired end-to-end and live-tested against a real DB — this is **not** early-stage stub code. What's actually left (backend `AuditSummary.md` §13):
- 🔴 No real secrets for Production env (deliberately blank, must come from env/Key Vault); no CI/CD or Dockerfile; dead disabled auto-migrate code in `Program.cs` should be deleted; `AuditLog`/`TaskStatusHistory` soft-delete exclusion not properly implemented.
- 🟠 `UserCompanyMapping` unused (see above); Admin health endpoint has placeholder DB-size/backup fields; instant emails (as opposed to in-app notification) never fire from Task events, only the daily digest works; no automated cross-tenant isolation tests (though `CrossTenantIsolationIntegrationTests.cs` may already exist — verify before assuming a gap).
- 🟡 No MFA/global-exception-middleware test coverage; one known-failing test (Windows path-separator bug); bulk import is CSV-only despite ClosedXML already being a dependency; no self-service full-name edit.
- 🟢 No dashboard caching (recomputes every request); `Redis` connection string configured but unused anywhere.

---

## 4. Frontend Architecture (React 19 + Vite)

**⚠️ Ignore the Next.js scaffold files** — `next.config.js`, `next-env.d.ts`, root `tsconfig.json`, `app/`, `src/App.jsx`, `src/main.jsx`, `vite.config.js`, `tailwind.config.js` are dead leftovers from an abandoned first approach. **The real app is a Vite SPA rooted at `src/main.tsx`**, real TS config is `tsconfig.app.json`, real Vite config is `vite.config.ts`, real Tailwind config is `tailwind.config.ts`.

**Confirmed stack:** React 19, react-router-dom 7 (`BrowserRouter`, no nested `<Outlet>` layouts — shell-wrapping is done by hand per-route), @tanstack/react-query 5 (sole data layer, no Redux/Zustand), jwt-decode, xlsx/SheetJS (pulled from a CDN tarball, not npm registry — flag in any dependency audit). No test framework, no ESLint/Prettier config.

**Entry flow:** `index.html` → `src/main.tsx` → `QueryClientProvider` → `RoleProvider` → `BrowserRouter` → per-route inline switch (built from `src/lib/routes.ts`) → `ProtectedRoute` (auth check → role/access check → picks shell: `AppShell` / `PlatformAdminShell` / none) → page component.

### Routing & access control (`src/lib/routes.ts`)

Single source of truth: `RouteMeta.access` is `"Public"` or a `Role[]`. Roles: `"Platform admin" | "Auditor" | "Company admin" | "Employee"` (note: **frontend role strings differ in casing/spacing from backend enum names** — `lib/roleMapping.ts` bridges `PlatformAdmin`/`Auditor`/`CompanyAdmin`/`Employee` JWT claims and numeric `UserRole` enum values to these display strings).

| Role | Access summary |
|---|---|
| Platform admin | `/admin/*` + `/notifications` + `/profile` only |
| Auditor | Everything except `/admin/*`: both dashboards, all task ops incl. create/bulk-upload, company CRUD, user invite (any role), reports |
| Company admin | Both dashboards (own company scope), tasks (view only, no create), no company CRUD, invite Employee/Company admin only |
| Employee | Standard dashboard only, tasks (view/grid, no create), reports, notifications, profile |

If a route in `routes.ts` doesn't have a matching branch in `main.tsx`'s switch, it silently falls back to `PlaceholderPage` rather than erroring — currently true for `/admin/audit-log`.

### Data-fetching & API layer

- **TanStack Query** (`src/lib/queryClient.ts`): 30s staleTime, no retry on 4xx, no refetch-on-focus, deliberately shared query keys across components (e.g. Sidebar + Dashboard both use `["dashboard","summary"]`) so requests dedupe. `queryClient.clear()` on sign-out.
- **`apiClient.ts`**: hand-rolled fetch wrapper (not axios). Attaches Bearer token, unwraps the `ApiResponse` envelope, returns `Blob` for non-JSON (file downloads), does **single-flight token refresh** on 401 (dedupes concurrent refreshes, retries original request once), throws typed `ApiError` (`status`/`errorCode`/`detail`/`fieldErrors`) parsed from ProblemDetails.
- **Mock/live cutover** (`src/lib/config.ts`, `VITE_API_MODE`): every function in every `src/services/*.ts` file follows `if (API_MODE === "mock") { ...mock-data... } return apiClient...(...)`. This branch-per-function pattern is the entire cutover mechanism — **preserve it** for any new service function; don't rip out the mock path without explicit confirmation ([[feedback_mock_data_cutover]]). `.env.example` defaults to `mock`; local dev `.env.local` is currently set to `live` against `http://localhost:5298/api/v1`.
- **Token storage**: plain `localStorage` (`auditflow-access-token`/`-refresh-token`), no cookies, no encryption.
- **Raw→Display DTO mapping**: nearly every service defines a `RawXxx` type matching exact backend JSON + a `mapXxx()` converting numeric enums → string unions, `null`→`undefined`, etc. New integration work should follow this same split, not consume backend shapes directly in components.
- **Enum mapping layer**: `lib/taskStatusMapping.ts`, `lib/taskPriorityMapping.ts`, `lib/roleMapping.ts`, `services/notifications.ts` (`KIND_FROM_ENUM`) — always check here before assuming a value's shape. `"overdue"` is a **synthetic, client-derived status** (never sent/received from the backend), computed from `isOverdue` + real status.

### Services layer (`src/services/*.ts` ↔ backend controllers)

| Service | Backend module | Notes |
|---|---|---|
| `auth.ts` | AuthController + `/invites/*` | Login/logout/forgot-reset-password/invite validate-accept. MFA-required response throws (no MFA UI built yet). |
| `admin.ts` | AdminController | Tenant CRUD, platform health. Read DTOs use string `Plan`/`Status`; write command uses numeric enum — inconsistent by design, documented inline. |
| `companies.ts` | CompaniesController | Company/SubCompany CRUD. No bulk "replace all sub-companies" endpoint — edits diff and call add/update/delete individually (`syncSubCompanies`). |
| `notifications.ts` | NotificationsController | List/unread-count/mark-read/delete/preferences. |
| `reports.ts` | ReportsController | Sync export (≤10k rows) with async-queued fallback on `EXPORT_TOO_LARGE`. |
| `users.ts` | UsersController | Profile, invite, activate/deactivate, managers list. |
| `dashboard.ts` | DashboardController | Standard + Executive suites. Executive's company filter deliberately reuses `/tasks/filter-options`, not `/companies`, because Auditors can browse companies they aren't individually mapped to. |
| `tasks.ts` | TasksController | Largest file (~740 lines): CRUD, assign, status/reopen, comments, attachments (`POST /files/upload`, deliberately not the separate presigned-attachment flow — mixing the two caused duplicate rows, per an inline post-mortem), bulk validate/import, CSV/Excel template handling via SheetJS. `TASK_PAGE_SIZE = 10`, explicitly chosen for scale. |

### UI system

Design tokens as CSS custom properties in `src/index.css` (~4133 lines, BEM-ish classes like `.btn`/`.card`/`.grid-table`), mirrored into `tailwind.config.ts`. Tailwind is configured but lightly used directly in JSX — most styling is semantic classes from `index.css`. Inter font + Tabler Icons, both via CDN, not npm packages.

Reusable primitives in `src/components/ui/` (barrel-exported): `Badge`, `Button`, `Card`, `Chip`, `DonutChart`/`TrendChart` (inline SVG, no chart library), `FormField`/`FieldRow`, `Modal`, `Pagination`, `RowActionMenu`, `Table`+`CellPerson`, `Toast`, `Toggle`, `Tooltip`.

Layout shells in `src/components/layout/`: `AppShell` (sidebar+topbar, most pages), `PlatformAdminShell` (separate simpler shell for `/admin/*`), `AuthShell` (split-screen public auth pages), `Sidebar`, `Topbar`, `GlobalSearch` (250ms debounced task search — the one explicit debounce in the codebase).

### Pages (`src/pages/*.tsx`)

Auth: `SignInPage`, `AcceptInvitePage`, `ForgotPasswordPage`, `ResetPasswordPage`. Core: `DashboardPage` (Standard + Executive in one file, ~18KB), `TaskGridPage` (week/all modes), `TaskCreatePage`, `TaskBulkCreatePage`, `TaskDetailsPage` (~21KB, tabs: Overview/Comments/Documents/Timeline), `ReportsPage`, `CompanyManagementPage`, `CompanyFormPage`, `UserManagementPage`, `InviteUserPage`, `NotificationsPage`, `ProfilePage`. Platform: `PlatformAdminPages.tsx` (multi-export: `TenantListPage`/`CreateTenantPage`/`TenantDetailPage`/`SystemOverviewPage`). Fallback: `PlaceholderPage`.

### Running the frontend

```bash
npm install
npm run dev       # Vite dev server, http://localhost:5173
npm run build      # tsc type-check (tsconfig.app.json) then vite build → dist/
npm run preview
```

Env vars (`.env.local`): `VITE_API_MODE` (`mock`|`live`), `VITE_API_BASE_URL` (e.g. `http://localhost:5298/api/v1`). In `mock` mode no backend is needed — everything runs from `src/mock-data/*.ts` + localStorage fake auth, with a role-switcher dropdown in the topbar (live mode hides this; role is purely JWT-derived).

### Conventions & gotchas worth preserving

- Every services function: mock/live branch, `RawXxx` type + `mapXxx()` converter.
- Branch on `ApiError.errorCode`, never on `.detail` text.
- `404` from a `getXById`-style call is translated to `undefined`/`null`, not thrown.
- Naming: `Entry`/`Detail` suffix for API read models, `Draft`/`Input` suffix for create/update payloads, `mock` prefix for fixtures.
- Heavy inline comments in `lib/`/`services/` encode real backend contract facts and past bug post-mortems (duplicate attachments, CSV date parsing, IST timezone offsets) — **read them before changing that code**, they're load-bearing documentation, not filler.
- Dedup exists (shared Query keys + single-flight refresh) but **debounce is ad hoc** (GlobalSearch only, not centralized in `apiClient.ts`) — a real gap against the "bake dedup/debounce into the API layer" scaling goal ([[feedback_perf_scale_priority]]).

---

## 5. Cross-Cutting Facts to Remember

- **Multi-tenant SaaS, plan for horizontal scale**: caching/dedup/debounce should be built into the API layer, not bolted on per-component. See gap above.
- **Mock data must keep working** behind `VITE_API_MODE` until the user explicitly confirms full cutover — don't delete the mock branches.
- **TanStack Query is the chosen data-fetching/caching layer** for `services/*.ts` — don't introduce a second one.
- **Docs disagree with each other on purpose, by date** — `2 - API_SPECIFICATION.md` and pre-2026-08-05 backend docs predate `/api/v1` route versioning and some verb/route decisions. `4 - BACKEND_INTEGRATION_GUIDE.md` (2026-08-05, commit `72e2130`) wins any conflict.
- **Company admin is view-only on Tasks and Companies** — this was a deliberate bug-fix during the backend engagement; don't reintroduce write access based on an older doc.
- **Platform admin's scope was repeatedly tightened** during the backend engagement (over-broad role grants found and removed) — current rule: `/admin/*` + universal self-service Profile actions only.
- **Prescribed integration rollout order** (from the integration guide, §10.4, useful if resuming staged work): Auth → Profile → Dashboard (standard) → Companies/Users → Tasks (grid/create/bulk/details) → Dashboard (executive)/Reports/Notifications → Platform admin. As of the last check, live-mode integration is substantially complete across modules (see recent commit history) — verify current state rather than assuming this order is still pending.
