# AuditFlow — Backend API Integration Guide

**Purpose of this document:** this is the single, self-contained brief for wiring the AuditFlow
React frontend to the real .NET backend. It's written so a fresh session can pick this up with
**zero prior context** and start integrating immediately — no need to re-explain the product, the
backend, or the frontend's current state.

**Written:** 2026-08-05. Backend commit `72e2130` on `main` (pushed). Verified against the actual
current code on both sides, not against older design docs — where an older doc
(`2 - API_SPECIFICATION.md`) disagrees with what's below, **this document wins**; it reflects
deliberate corrections made after that spec was written.

---

## 1. Product context

AuditFlow is a **multi-tenant SaaS platform** for audit firms to track findings ("tasks") raised
against the companies they audit, from discovery through to auditor sign-off.

**Tenancy hierarchy:** `Tenant` (the audit firm, the paying customer) → `Company` (the firm's audit
client) → `SubCompany` (division/region, optional) → `User`. A user belongs to exactly one tenant.

**Roles** (backend enum name → what they do):
| Backend role string | What they do |
|---|---|
| `PlatformAdmin` | AuditFlow's own internal staff. Manages tenants/subscriptions/billing. **Deliberately has zero access to any tenant's audit content** — no Tasks, no Companies, no standard/executive Dashboard, no Reports. This is enforced server-side; don't try to route around it in the UI either. |
| `Auditor` | The audit firm's own staff. Creates Companies, invites Users, creates/manages Tasks, can be mapped across multiple Companies. Only role that can move a task to `Closed` or `Reopened`. |
| `CompanyAdmin` | Self-service user management for their own company; **view-only on tasks** (no create/edit/assign, no title/description/priority/due-date changes — server-enforced). |
| `Employee` | Works assigned tasks: status changes, comments, attachments only. Can never change title, description, assignee, priority, or due date — server-enforced, not just hidden in the UI. |

**Core task lifecycle:** `Open → InProgress → Resolved → Closed`, with `Reopened` requiring a
mandatory reason. `Resolved` means "awaiting auditor sign-off" — **not** done. Only an Auditor can
move a task to `Closed`. Every transition is appended to an immutable audit timeline.

---

## 2. Where everything lives

| What | Path |
|---|---|
| Backend repo | `C:\Rakesh\My Workspace\My Developments\Projects\AuditFlow-Backend\AuditFlow-Backend\AuditFlow-Backend` |
| Frontend repo | `C:\Rakesh\My Workspace\My Developments\Projects\AuditFlow-Frontend\AuditFlow-Frontend` |
| Product requirements (17-screen spec, business rules, design system) | `Project_Docs\Audit_Flow_Docs\1 - AuditFlow-Requirements.docx` |
| Old API spec (**partially stale** — see §11 for the specific corrections made since) | `Project_Docs\Audit_Flow_Docs\2 - API_SPECIFICATION.md` |
| Interactive HTML mockups of all screens | `Project_Docs\Audit_Flow_Docs\3 - mockup-audit-saas-all-screens.html` |
| **This document** | `Project_Docs\Audit_Flow_Docs\4 - BACKEND_INTEGRATION_GUIDE.md` |
| Postman collection (already updated to match current backend) | `AuditFlow-Backend\...\postman\AuditFlow.postman_collection.json` |
| DB schema reference | `Project_Docs\Audit_Flow_Docs\DatabaseStructure.md` |

---

## 3. Running the backend locally

```bash
cd "C:\Rakesh\My Workspace\My Developments\Projects\AuditFlow-Backend\AuditFlow-Backend\AuditFlow-Backend"
dotnet run --project src/AuditFlow.API --urls http://localhost:5298
```

- Health check: `GET http://localhost:5298/health` → `200` when ready (takes ~10-12s to start).
- Swagger UI (dev only): `http://localhost:5298/` (root).
- DB: local SQL Server, database `AuditFlow`, connection string in
  `src/AuditFlow.API/appsettings.json` (`Server=localhost;...;Trusted_Connection=True`). All
  migrations are applied; nothing to run manually unless you add a new migration.

**Seed accounts** (password for all: `TestPass123!`):
| Email | Role |
|---|---|
| `platformadmin@seed.test` | PlatformAdmin |
| `auditor@seed.test` | Auditor |
| `companyadmin@seed.test` | CompanyAdmin |
| `employee@seed.test` | Employee |

### ⚠️ CORS must be updated before the frontend can call this API

`appsettings.json`'s `Application:CorsOrigins` currently only allows
`http://localhost:3000`/`:4200`. **Vite's dev server defaults to `http://localhost:5173`**, which
is not in that list — the first fetch call will fail with a CORS error until this is fixed. Add it:

```jsonc
"CorsOrigins": [ "http://localhost:3000", "http://localhost:4200", "http://localhost:5173", "https://localhost:3000", "https://localhost:4200" ],
```

(Confirm the frontend's actual dev port with `npm run dev` first — Vite will print it — in case
something else is already bound to 5173 and it falls back to 5174, etc.)

---

## 4. API basics

- **Base URL (dev):** `http://localhost:5298`
- **All routes are versioned:** every path is `/api/v1/...`. There is no unversioned fallback —
  requests to `/api/...` (no `v1`) 404.
- **Auth:** JWT Bearer. `Authorization: Bearer <accessToken>` header on every authenticated request.
- **Content type:** `application/json` for request/response bodies; file uploads use
  `multipart/form-data` (see §8, Files).

### Success response envelope

Every successful response (2xx) is wrapped the same way:

```json
{
  "success": true,
  "data": { /* the actual payload, shape varies per endpoint */ },
  "message": "Optional human-readable message, often null",
  "errors": [],
  "statusCode": 200,
  "correlationId": null,
  "errorCode": null
}
```

Always read the payload from `.data`. `PagedResult<T>`-shaped data looks like:
```json
{ "items": [ /* T[] */ ], "totalCount": 42, "pageNumber": 1, "pageSize": 20, "totalPages": 3, "hasPreviousPage": false, "hasNextPage": true }
```
(Check the actual field names against a live response — some list endpoints paginate, some don't;
see the endpoint table in §8 for which is which.)

### Error response envelope — RFC 9457 ProblemDetails

**Every** error (400/401/403/404/409/500, whether from a business-rule failure, a validation
failure, or an unhandled exception) uses the **same shape**, `application/problem+json`:

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.10",
  "title": "Conflict",
  "status": 409,
  "detail": "An auditor account already exists for the domain 'example.com'",
  "traceId": "00-...",
  "correlationId": "0HNNI...:00000001",
  "errorCode": "DUPLICATE_DOMAIN"
}
```

- **Build the UI's error handling around `errorCode`**, not `detail` (detail is a human sentence
  meant for direct display, but `errorCode` is the stable machine-readable key for logic like "show
  a specific inline field error" vs. "show a generic toast").
- One exception: automatic model-validation errors (malformed JSON, missing required field) come
  back as the standard ASP.NET `ValidationProblemDetails` shape instead, which has an `errors`
  object keyed by field name (`{"errors": {"email": ["..."]}}`) instead of a flat message — same
  `errorCode: "VALIDATION_ERROR"` extension though, so you can still branch on that.
- Common `errorCode` values you'll see across the API: `VALIDATION_ERROR`, `UNAUTHORIZED`,
  `FORBIDDEN`, `NOT_FOUND`, `USER_EXISTS`, `DUPLICATE_DOMAIN`, `INVALID_CREDENTIALS`,
  `INVALID_TOKEN`, `TOKEN_EXPIRED`, `INVITATION_USED`, `ACCOUNT_NOT_ACTIVE`, `INTERNAL_ERROR`.
  These aren't formally enumerated anywhere — expect to discover a few more per module as you wire
  it up; treat any unrecognized code as a generic-error fallback in the UI.

### JSON enum quirk — numeric, not string

**No `JsonStringEnumConverter` is registered.** Every enum field in a request body must be sent as
its **numeric** value, not the string name. E.g. `{"priority": 2}` for Medium, not
`{"priority": "Medium"}`. Response bodies also return enums as numbers. See §7 for the full
enum-value tables.

---

## 5. Auth & JWT

### Flow
1. `POST /api/v1/auth/login` with `{ email, password, rememberMe?, mfaCode? }` →
   `{ accessToken, refreshToken, expiresAt, user, requiresMfa }`.
2. Store both tokens (see §9 for where/how — this is a real decision the current frontend hasn't
   made yet, since it has no real auth at all today).
3. Attach `Authorization: Bearer <accessToken>` on every request.
4. On a `401`, call `POST /api/v1/auth/refresh` with `{ refreshToken }` to get a new pair; retry the
   original request once. If refresh also fails, sign the user out and redirect to `/signin`.
5. `POST /api/v1/auth/logout` with `{ refreshToken }` on sign-out (revokes it server-side).

Access tokens expire in **60 minutes**; refresh tokens in **7 days**. Refresh tokens rotate on use
(the old one is invalidated) — don't reuse a refresh token twice.

### JWT claims (decode the access token to read these — don't just trust local state)

| Claim | Example | Notes |
|---|---|---|
| `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier` | `2ac80182-...` | User ID (GUID) |
| `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name` | `auditor@seed.test` | Username (= email) |
| `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress` | `auditor@seed.test` | Email |
| `http://schemas.microsoft.com/ws/2008/06/identity/claims/role` | `Auditor` | **Exact backend role string** — `PlatformAdmin`/`Auditor`/`CompanyAdmin`/`Employee` |
| `tenant_id` | `00000000-...` or a real GUID | **Null-equivalent all-zeros GUID for PlatformAdmin** (they have no tenant) |
| `full_name` | `Seed Auditor` | Display name |
| `company_id` | GUID, only present for CompanyAdmin/Employee | Their home company |
| `sub_company_id` | GUID, only present if assigned | |
| `mapped_company_id` | zero or more, only for Auditor | An Auditor can be mapped to multiple companies via `UserCompanyMappings` — this claim repeats once per mapped company |

These long URI-style claim names are standard .NET `ClaimTypes` constants — any JS JWT-decode
library (e.g. `jwt-decode`) will hand you an object with these exact keys; write a small
`getClaim(token, 'role')`-style helper once and reuse it, don't inline the URIs everywhere.

### Role string mapping — backend vs. frontend

**The frontend's existing `Role` type does not match the backend's role strings.** The frontend
uses spaced/lowercase display strings (`"Platform admin"`, `"Company admin"`) while the backend/JWT
use PascalCase, no space (`PlatformAdmin`, `CompanyAdmin`). You need one canonical mapping used
everywhere role comparisons happen — don't scatter string transforms across components:

```ts
// backend role string -> frontend display Role
const roleFromClaim: Record<string, Role> = {
  PlatformAdmin: "Platform admin",
  Auditor: "Auditor",
  CompanyAdmin: "Company admin",
  Employee: "Employee",
};
```

### Other auth endpoints
- `POST /api/v1/auth/forgot-password` — `{ email }`, always returns success (no user enumeration).
- `POST /api/v1/auth/reset-password` — `{ email, token, newPassword }`.
- `POST /api/v1/auth/mfa/setup` / `/mfa/verify` / `/mfa/disable` — TOTP MFA, authenticated.
- `GET /api/v1/invites/validate/{token}` — public, validates an invite link, returns
  `{ invitationId, email, companyName, subCompanyName, role, expiresAt }`.
- `POST /api/v1/invites/accept` — public, `{ token, password, confirmPassword }` → same shape as
  login (sets the password, activates the account, returns tokens). **Note:** these two moved out
  of `/auth/*` into their own `/invites/*` resource after the old spec doc was written.

---

## 6. Multi-tenancy — what the frontend needs to know

Every list/detail endpoint is **automatically scoped server-side** to the caller's tenant (and, for
CompanyAdmin/Employee, to their own company) via a global EF Core query filter — **you never send a
`tenantId` in a request**. The one thing the UI does need to pass explicitly, on the endpoints that
accept it, is `companyId`/`subCompanyId` as an optional **narrowing** filter — an Auditor or
unrestricted caller can filter down; a CompanyAdmin/Employee's own scope always wins server-side
even if you pass something else (their query param is silently overridden, not rejected — don't
build UI logic that assumes a 403 in that case, it won't happen, they just get their own data back
regardless of what was asked for).

PlatformAdmin has no `tenantId`/`companyId` at all — it's a genuinely separate context (see §1).
Don't build any screen that expects a PlatformAdmin to see Task/Company/Dashboard/Report data; the
API will 403 (and per §11, the frontend's own `routes.ts` already correctly excludes PlatformAdmin
from most of those routes — the one place it currently doesn't is `/users`, see §11's gap list).

---

## 7. Domain enums — exact values

Send/receive these as **numbers** (see §4). Frontend equivalents shown where one already exists;
where marked "no equivalent," you'll need to extend the frontend's type.

**UserRole** (`/api/v1/users` responses, JWT role claim uses the *string* name instead — see §5):
| Value | Backend name | Frontend `Role` |
|---|---|---|
| 1 | PlatformAdmin | `"Platform admin"` |
| 2 | Auditor | `"Auditor"` |
| 3 | CompanyAdmin | `"Company admin"` |
| 4 | Employee | `"Employee"` |

**AuditTaskStatus:**
| Value | Backend name | Frontend `Status` | Notes |
|---|---|---|---|
| 1 | Open | `"open"` | |
| 2 | InProgress | `"progress"` | |
| 3 | Resolved | **no equivalent** | "Awaiting auditor sign-off" — the frontend's `Status` type doesn't have this state at all today. This needs to be added; don't silently collapse it into `"progress"` or `"closed"`, it's a real, distinct, important state per the product's core loop (§1). |
| 4 | Closed | `"closed"` | |
| 5 | Reopened | **no equivalent** | Also missing from the frontend type — needs adding. |

`"overdue"` in the frontend's `Status` type isn't a real backend status — overdue-ness is a computed
boolean (`task.isOverdue`, derived from `dueDate` vs. now, independent of `status`) that's mixed
into most task response DTOs. Treat it as a derived UI badge, not a status value, when integrating.

**TaskPriority:**
| Value | Name |
|---|---|
| 1 | Low |
| 2 | Medium |
| 3 | High |
| 4 | Critical |

**UserStatus:**
| Value | Name | Frontend `User.status` |
|---|---|---|
| 1 | Invited | `"Invited"` |
| 2 | Active | `"Active"` |
| 3 | Deactivated | **no equivalent** — needs adding |

---

## 8. Complete endpoint reference, by frontend screen

Every path below is relative to `/api/v1`. Roles listed are the exact server-enforced
`[Authorize(Roles=...)]` — anything not listed 403s. Request/response types reference the C# DTO
names for grepping the backend source if you need exact field-level shape (they live under
`src/AuditFlow.Application/**/DTOs` and `**/Commands`/`**/Queries` — `Ctrl+Shift+F` the type name).

### Sign in — `SignInPage.tsx`
| Method | Path | Roles | Notes |
|---|---|---|---|
| POST | `/auth/login` | Public | See §5 |
| POST | `/auth/refresh` | Public | |
| POST | `/auth/forgot-password` | Public | |
| POST | `/auth/reset-password` | Public | |
| POST | `/auth/logout` | Any authenticated | |

### Accept invite — `AcceptInvitePage.tsx`
| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/invites/validate/{token}` | Public | |
| POST | `/invites/accept` | Public | |

### Dashboard (standard) — `DashboardPage.tsx`
| Method | Path | Roles |
|---|---|---|
| GET | `/dashboard/summary` | Auditor, CompanyAdmin, Employee |
| GET | `/dashboard/weekly-tasks` | Auditor, CompanyAdmin, Employee |
| GET | `/dashboard/status-breakdown` | Auditor, CompanyAdmin, Employee |
| GET | `/dashboard/announcements` | Auditor, CompanyAdmin, Employee |
| GET | `/dashboard/recent-activity` | Auditor, CompanyAdmin, Employee |
| GET | `/dashboard/overdue-tasks` | Auditor, CompanyAdmin, Employee |
| GET | `/dashboard/upcoming-deadlines` | Auditor, CompanyAdmin, Employee |
| GET | `/dashboard/task-statistics` | Auditor, CompanyAdmin, Employee |
| GET | `/dashboard/company-overview` | Auditor, CompanyAdmin |

### Dashboard (executive) — `DashboardPage.tsx` (`/dashboard/executive` route)
| Method | Path | Roles |
|---|---|---|
| GET | `/dashboard/executive/kpis` | Auditor, CompanyAdmin *(CompanyAdmin sees data scoped to their own company only — see §1/§6)* |
| GET | `/dashboard/executive/trend` | Auditor, CompanyAdmin |
| GET | `/dashboard/executive/status-mix` | Auditor, CompanyAdmin |
| GET | `/dashboard/executive/company-health` | Auditor, CompanyAdmin |
| GET | `/dashboard/executive/risk-tasks` | Auditor, CompanyAdmin |
| GET | `/dashboard/executive/team-workload` | Auditor, CompanyAdmin |

Query params (all optional, all six endpoints): `companyId`, `subCompanyId`, `dateRange`
(e.g. `last8weeks`), `assigneeId`.

### Tasks — `TaskGridPage.tsx` (both `/tasks` weekly and `/tasks/all`)
| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/tasks` | Auditor, CompanyAdmin, Employee | Paginated. `?range=this-week` (default) or `?range=all` for the two grid variants |
| GET | `/tasks/search` | Auditor, CompanyAdmin, Employee | Autocomplete, `?searchTerm=&limit=` |
| GET | `/tasks/filter-options` | Auditor, CompanyAdmin, Employee | Distinct values for filter dropdowns |
| GET | `/tasks/statistics` | Auditor, CompanyAdmin, Employee | |
| GET | `/tasks/validate-assignee` | Auditor, CompanyAdmin | |

### Create task — `TaskCreatePage.tsx`
| Method | Path | Roles |
|---|---|---|
| POST | `/tasks` | Auditor |
| GET | `/tasks/template` | Auditor | Downloads a pre-filled Excel template |

### Bulk create tasks — `TaskBulkCreatePage.tsx`
| Method | Path | Roles | Notes |
|---|---|---|---|
| POST | `/tasks/bulk/validate` | Auditor | `multipart/form-data`, field `file`; returns valid/invalid row preview |
| POST | `/tasks/bulk/import` | Auditor | JSON body of the validated rows from the previous call |

### Task details — `TaskDetailsPage.tsx`
| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/tasks/{taskId}` | Auditor, CompanyAdmin, Employee | |
| PUT | `/tasks/{taskId}` | Auditor | Title/description/priority/due-date edit |
| DELETE | `/tasks/{taskId}` | Auditor | Soft delete |
| PATCH | `/tasks/{taskId}/assign` | Auditor | Reassign — **Auditor only**, CompanyAdmin cannot |
| PATCH | `/tasks/{taskId}/status` | Auditor, Employee | Status transitions, including Reopen (send a reason in the body) |
| GET/POST | `/tasks/{taskId}/comments` | GET: all 3 roles · POST: Auditor, Employee | |
| GET/POST | `/tasks/{taskId}/attachments` | GET: all 3 roles · POST: Auditor, Employee | POST is `multipart/form-data` |
| DELETE | `/tasks/{taskId}/attachments/{attachmentId}` | Auditor, Employee (owner only) | |
| GET | `/tasks/{taskId}/timeline` | Auditor, CompanyAdmin, Employee | Immutable audit trail |

### Reports — `ReportsPage.tsx`
| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/reports/tasks` | Auditor, CompanyAdmin | Paginated report data |
| GET | `/reports/filter-options` | Auditor, CompanyAdmin | |
| GET | `/reports/tasks/export/excel` | Auditor, CompanyAdmin | Streams a file directly for ≤10k rows |
| GET | `/reports/tasks/export/pdf` | Auditor, CompanyAdmin | Same |
| POST | `/reports/tasks/export/async` | Auditor, CompanyAdmin | For >10k rows — queues a background job, returns a `Report` record to poll |
| GET | `/reports` | Auditor, CompanyAdmin | Export history, paginated |
| GET | `/reports/{reportId}` | Auditor, CompanyAdmin | Poll job status |
| GET | `/reports/{reportId}/download` | Auditor, CompanyAdmin | Once the async job is done |

### Company management — `CompanyManagementPage.tsx`
| Method | Path | Roles |
|---|---|---|
| GET | `/companies` | Auditor, CompanyAdmin (sees only their own company) |
| GET | `/companies/{companyId}` | Auditor, CompanyAdmin |
| GET | `/companies/{companyId}/statistics` | Auditor, CompanyAdmin |
| GET | `/companies/{companyId}/sub-companies` | Auditor, CompanyAdmin |

### Add/edit company — `CompanyFormPage.tsx`
| Method | Path | Roles | Notes |
|---|---|---|---|
| POST | `/companies` | Auditor | Creates company + sub-companies in one call (send sub-company names as an array in the body) |
| PATCH | `/companies/{companyId}` | Auditor | |
| DELETE | `/companies/{companyId}` | Auditor | Soft delete |
| POST | `/companies/{companyId}/sub-companies` | Auditor | Add one sub-company to an *existing* company |
| PATCH | `/companies/{companyId}/sub-companies/{subCompanyId}` | Auditor | |
| DELETE | `/companies/{companyId}/sub-companies/{subCompanyId}` | Auditor | |
| POST | `/companies/{companyId}/sub-companies/bulk-import` | Auditor | CSV/`.xlsx` upload — **only works once the company already exists.** There is deliberately no "CSV import during initial company creation" endpoint — the product requirements doc itself flags that as a future enhancement, not a built flow. If the "Add company" screen's UI has a CSV-import affordance in the create step, wire it to create the company first (silently, via the same POST `/companies` call with zero sub-companies) then call this endpoint — don't block on backend work for it. |

### User management — `UserManagementPage.tsx`
| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/users` | Auditor, CompanyAdmin | Paginated, filterable |
| GET | `/users/filter-options` | Auditor, CompanyAdmin | |
| GET | `/users/{userId}` | Auditor, CompanyAdmin | |
| PATCH | `/users/{userId}` | Auditor, CompanyAdmin | Role/company/sub-company/reporting-manager edit |
| POST | `/users/{userId}/resend-invite` | Auditor, CompanyAdmin | |
| POST | `/users/{userId}/deactivate` | Auditor, CompanyAdmin | |
| POST | `/users/{userId}/activate` | Auditor, CompanyAdmin | |
| POST | `/users/{userId}/reset-password` | Auditor, CompanyAdmin | Admin-initiated reset |

**Gap:** the frontend's `routes.ts` grants `Platform admin` access to `/users`, but the backend
403s PlatformAdmin on every one of these — see §11.

### Invite user — `InviteUserPage.tsx`
| Method | Path | Roles |
|---|---|---|
| POST | `/users/invite` | Auditor, CompanyAdmin |
| GET | `/users/invite/validate-email` | Auditor, CompanyAdmin |
| GET | `/users/managers` | Auditor, CompanyAdmin |

### Notifications — `NotificationsPage.tsx`
| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/notifications` | Any authenticated | Paginated, unread-first |
| GET | `/notifications/unread-count` | Any authenticated | For the bell badge |
| PATCH | `/notifications/mark-read` | Any authenticated | Body `{ "notificationId": "<guid>" }` to mark one, `{}` (omit the field) to mark **all** — single endpoint handles both, per the product spec |
| DELETE | `/notifications/{notificationId}` | Any authenticated | |
| GET | `/notifications/preferences` | Any authenticated | |
| PATCH | `/notifications/preferences` | Any authenticated | `{ emailNotificationsEnabled, inAppNotificationsEnabled, dailyDigestEnabled }` — this is the **only** notification-preferences endpoint; a second one used to exist under `/users/notification-preferences` and was deleted as a duplicate, don't look for it |

There's also a live SignalR hub at `/hubs/notifications` for real-time push (new task assigned,
status changed, comment added) — connect with the same Bearer token. Optional for v1 of the
integration; polling `/notifications/unread-count` is a fine fallback to start with.

### Profile — `ProfilePage.tsx`
| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/users/me` | Any authenticated | |
| PATCH | `/users/me` | Any authenticated | Display name only |
| POST | `/users/me/password` | Any authenticated | Change own password |
| PATCH | `/users/me/theme` | Any authenticated | `{ "theme": "light" \| "dark" \| "system" }` |

### Platform admin — `PlatformAdminPages.tsx`
| Method | Path | Notes |
|---|---|---|
| GET | `/admin/health` | System metrics |
| GET | `/admin/auditor-accounts` | Paginated tenant list |
| GET | `/admin/auditor-accounts/{tenantId}` | |
| POST | `/admin/auditor-accounts` | Creates the tenant **and** its first Auditor (invited, not yet activated — they get an email with an accept-invite link, same flow as §5) |
| PATCH | `/admin/auditor-accounts/{tenantId}` | Plan/status/contact |
| POST | `/admin/auditor-accounts/{tenantId}/impersonate` | Support impersonation — issues a token as the tenant's primary Auditor |
| GET | `/admin/audit-log` | Platform-wide immutable audit log |

All PlatformAdmin-only (`[Authorize(Roles = "PlatformAdmin")]`).

### Files (used inline by Task attachments and Reports, not a standalone screen)
| Method | Path | Notes |
|---|---|---|
| POST | `/files/upload-url` | Get a presigned URL for direct-to-storage upload |
| POST | `/files/upload` | Or upload straight through the API, `multipart/form-data` |
| GET | `/files/{fileId}` | **Streams the file bytes** (this moved — used to be `/files/download/{fileId}`) |
| GET | `/files/{fileId}/metadata` | JSON metadata (filename, size, content-type) — **this is the old plain `/files/{fileId}`**, it moved to add `/metadata` |
| GET | `/files/download-url/{fileId}` | Presigned download URL, `?expiry=` |
| DELETE | `/files/{fileId}` | Soft delete |

---

## 9. Current frontend state — what exists, what doesn't

Confirmed by reading the actual repo (`AuditFlow-Frontend`), not assumed:

- **Stack:** React 19 + TypeScript + Vite 6 + React Router 7 + Tailwind. No React Query/SWR, no
  axios — no HTTP client of any kind is set up yet.
- **`src/mock-data/*.ts`** (`auth.ts`, `tasks.ts`, `companies.ts`, `users.ts`, `dashboard.ts`) —
  synchronous, in-memory fixture data with query/filter helper functions (e.g. `queryTasks(role,
  email, filters)`) that pages call directly and synchronously.
- **`src/lib/RoleContext.tsx`** — the *entire* current "auth" system. `signIn(email)` derives a
  fake role by pattern-matching the email string (contains `"platform"` → Platform admin, contains
  `"company"` → Company admin, etc.) and stores role/email/name in `localStorage` under keys
  `auditflow-auth`/`-role`/`-email`/`-name`. **Password is captured in the sign-in form but never
  read or validated.** This whole file needs to be replaced by real JWT-based auth — don't try to
  patch it incrementally, it's structurally a different (synchronous, client-only) model to a real
  async token-based one.
- **`src/lib/routes.ts`** — route table + role-based nav, already keyed on the same `Role` type.
  Structurally fine to keep; just needs the JWT-role-mapping from §5 feeding into it instead of
  `RoleContext`'s pattern-matching.
- **`src/types/index.ts`** — `Role`, `Status`, `User`, `RouteMeta`, `NavItem`, `InviteDetails`. No
  `tenantId` anywhere in `User` — needs adding. `Status` is missing `Resolved`/`Reopened` (§7).
- **No `.env` / `.env.example` file exists yet.** `.gitignore` already has the standard `.env*`
  patterns ready, just no file has been created.
- **No loading/error states anywhere** — every page assumes mock data is present synchronously.
  Wiring real async fetches means adding loading/error UI per page, not just swapping the data
  source.

---

## 10. Mock-data cutover strategy — keep mock data working as a fallback, make it configurable

You explicitly want mock data to keep working (not be ripped out) until the real integration is
verified, then removed later — and configurable in the meantime. Recommended approach, fitted to
this specific codebase:

### 1. One env var as the master switch

`.env.local` (gitignored, developer-specific):
```
VITE_API_MODE=mock   # or "live"
VITE_API_BASE_URL=http://localhost:5298/api/v1
```
Commit a `.env.example` with the same keys and safe defaults (`VITE_API_MODE=mock`) so the repo is
self-documenting and a fresh clone works with zero setup.

### 2. New `src/services/` layer — one file per backend module

Mirror the backend's module boundaries: `services/auth.ts`, `services/tasks.ts`,
`services/companies.ts`, `services/users.ts`, `services/dashboard.ts`,
`services/notifications.ts`, `services/reports.ts`, `services/files.ts`, `services/admin.ts`.

Each exported function checks the mode and either delegates to the existing mock function or calls
the real API client — **keep the function signatures as close as possible to the existing
`mock-data` functions** so page components change minimally:

```ts
// services/tasks.ts
import { queryTasks as mockQueryTasks } from "../mock-data/tasks";
import { apiClient } from "../lib/apiClient";
import { API_MODE } from "../lib/config";

export async function queryTasks(role: Role, email: string, filters: TaskFilters): Promise<AuditTask[]> {
  if (API_MODE === "mock") {
    return mockQueryTasks(role, email, filters); // wrapped as a resolved Promise - keeps call sites async either way
  }
  return apiClient.get("/tasks", { params: toApiFilters(filters) }).then(mapTasksResponse);
}
```

Page components import from `services/*` instead of `mock-data/*` — that's the **only** change
needed in most pages (plus adding loading/error state around the now-async call, and error display
using the `errorCode`/ProblemDetails contract from §4). **`mock-data/*.ts` stays completely
untouched** the whole time — it's still directly reachable, still the demo/offline path, and can be
deleted later in one clean pass once every module is verified live, without archaeology through
half-migrated files.

### 3. Shared `src/lib/apiClient.ts`

One fetch wrapper used by every `services/*.ts` file, responsible for:
- Prefixing `VITE_API_BASE_URL`.
- Attaching `Authorization: Bearer <token>` from wherever tokens end up being stored (§5 — this is
  a real decision to make: `localStorage` is simplest and matches the existing `RoleContext`
  pattern, but is XSS-exposed; an httpOnly cookie set by the backend would be more secure but the
  backend doesn't currently issue one — that's a bigger change. Simplest correct path for v1:
  `localStorage`, matching what's already there, revisit later if there's a security review).
- Parsing `application/problem+json` error bodies into one typed `ApiError` shape (`{ errorCode,
  detail, status }`) that every `services/*` caller and every page's error-handling code can rely on
  uniformly — this is the payoff of the backend's unified ProblemDetails work (§4), don't let each
  page parse errors differently.
- One-shot 401 → refresh-token → retry, per §5.

### 4. Rollout order

Suggested module sequence, each step fully working (build, manual click-through, mock fallback
still selectable via the env var) before moving to the next:

1. **Auth** (sign in, accept invite, forgot/reset password, logout) — unblocks everything else,
   since every other module needs a real token.
2. **Profile** — smallest surface, good smoke test of the auth+apiClient plumbing end to end.
3. **Dashboard** (standard) — read-only, good second smoke test.
4. **Companies**, **Users** — needed before Tasks (task creation depends on company/user pickers).
5. **Tasks** (grid, create, bulk create, details) — the largest module, do it once the supporting
   data (companies/users) is real.
6. **Dashboard (executive)**, **Reports**, **Notifications**.
7. **Platform admin** — separate role, can be done any time after Auth; low risk of touching
   anything else.

### 5. When to remove mock data

Only once every module above is switched to `live` mode in the default `.env.example` and verified
against the real backend end to end — don't remove any individual `mock-data/*.ts` file just
because its corresponding `services/*.ts` file has a live branch; keep the whole set together until
the user explicitly says to cut it over, since a partially-mocked app is worse than a fully-mocked
one for demo/offline purposes.

---

## 11. Known gaps and deliberate decisions — don't re-derive these, don't re-litigate them

- **PlatformAdmin has zero access to Task/Company/Dashboard/Report data**, by explicit product
  design (§1). The frontend's `routes.ts` currently grants `Platform admin` access to `/users` —
  that's a real mismatch, the backend 403s them there. Fix on the frontend side (remove
  `"Platform admin"` from that route's `access` array) rather than requesting a backend change;
  the zero-access boundary is intentional and was confirmed with the product owner.
- **Executive Dashboard**: Auditor (full scope) + CompanyAdmin (own company only) — not
  PlatformAdmin. This was a deliberate, confirmed decision (see §1), not an oversight.
- **Company bulk-import-at-company-creation doesn't exist** (§8, Add/edit company) — confirmed
  deferred in the product requirements doc itself, not a backend gap to fix before integrating.
- **Task reassign is Auditor-only** — CompanyAdmin cannot reassign, despite being able to view
  tasks. Enforced server-side.
- **All routes are versioned (`/api/v1/...`)** and use RFC 9457 ProblemDetails for every error —
  if you're cross-referencing the older `2 - API_SPECIFICATION.md`, mentally add `/v1` to every
  path and don't trust that doc's specific verb (PUT vs PATCH) for a handful of endpoints; §8 above
  is the current source of truth, verified directly against the running code.
- **No email-sending in local dev** — `Email:Provider` defaults to `Development`, which writes
  emails to `C:\AuditFlow\EmailPickup` instead of sending them. Invite links / password-reset links
  will be in there as `.eml` files during local integration testing, not in an actual inbox.
- **Numeric enums only in JSON** (§4/§7) — this trips people up the most; if a request 400s with
  `VALIDATION_ERROR` and the field looks right, check you didn't send an enum as a string.

---

## 12. Verification checklist per module

For each module as you integrate it:
- [ ] Build succeeds, mock mode still works (`VITE_API_MODE=mock`, unchanged behavior)
- [ ] Live mode works against `dotnet run` + local DB (`VITE_API_MODE=live`)
- [ ] Loading state shows during the fetch
- [ ] Error state shows on a forced failure (e.g. stop the backend mid-session) — check the
      `errorCode` is what you expect, not a raw stack trace or blank screen
- [ ] Role-gated actions correctly hide/disable for roles that would 403 (don't rely on the 403
      alone — hide the button too, matching what `routes.ts`/`navItems` already do for navigation)
- [ ] A 401 (expired token) triggers the refresh flow, not an immediate logout
