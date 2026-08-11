# AuditFlow — Architecture & Flow Diagrams

> Companion to [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) (narrative context, roles, gaps). This file is the visual/structural reference — system topology, request lifecycle, auth flow, tenancy model, and module maps. Diagrams use Mermaid (renders natively on GitHub and in most Markdown viewers).

---

## 1. System Overview

```mermaid
flowchart LR
    subgraph Client["Browser"]
        SPA["React 19 SPA (Vite)\nsrc/main.tsx"]
    end

    subgraph FE["Frontend Layer"]
        RQ["TanStack Query\ncache + dedup"]
        AC["apiClient.ts\nfetch wrapper + auth"]
        SVC["services/*.ts\nmock/live branch per fn"]
        MOCK["mock-data/*.ts\n(VITE_API_MODE=mock)"]
    end

    subgraph BE[".NET 8 Backend (AuditFlow.API)"]
        MW["GlobalExceptionHandlingMiddleware"]
        CTRL["Controllers\n(thin, MediatR dispatch)"]
        MED["MediatR Pipeline\nValidation → Logging → Performance"]
        HND["Feature Handlers\nApplication layer"]
        HUB["NotificationHub\n(SignalR)"]
    end

    subgraph DATA["Data & Infra"]
        DB[("SQL Server\nAuditFlow DB")]
        HF["Hangfire\n(background jobs, same DB)"]
        FS["File Storage\n(Local / Azure Blob / S3)"]
        MAIL["Email Provider\n(Dev / SMTP / SendGrid / ACS)"]
    end

    SPA --> RQ --> AC
    AC -->|"VITE_API_MODE=live"| SVC
    SVC -->|mock| MOCK
    SVC -->|live| AC
    AC -->|"HTTPS + Bearer JWT\n/api/v1/*"| MW --> CTRL --> MED --> HND
    HND --> DB
    HND --> HF
    HND --> FS
    HND --> MAIL
    HND -.->|push| HUB -.->|WebSocket| SPA
```

---

## 2. Backend: Clean Architecture Layers

```mermaid
flowchart TB
    subgraph API["AuditFlow.API"]
        C1["Controllers\n(build Command/Query, dispatch, wrap ApiResponse)"]
        MID["Middleware\n(GlobalExceptionHandlingMiddleware)"]
        HUB2["NotificationHub / SignalRRealtimeNotifier"]
    end

    subgraph APP["AuditFlow.Application"]
        FEAT["Features/&lt;Module&gt;/{Commands,Queries}/Handlers"]
        VAL["Validators (FluentValidation)"]
        PIPE["Pipeline Behaviors\nValidation → Logging → Performance"]
        IFACE["Interfaces\nICurrentUserService, ITenantScopeService,\nIApplicationDbContext, IRealtimeNotifier"]
    end

    subgraph INFRA["AuditFlow.Infrastructure"]
        EF["ApplicationDbContext (EF Core)\n+ global tenant/soft-delete query filters"]
        REPO["Repositories\nRepository&lt;T&gt; + per-entity"]
        IDENT["Identity/JWT services\nJwtTokenService, TotpMfaService"]
        PROV["Provider factories\nEmail, FileStorage"]
        BGJOB["Hangfire jobs\nDailyDigestBackgroundService"]
    end

    subgraph DOM["AuditFlow.Domain"]
        ENT["Entities (BaseEntity)\nTenant, Company, SubCompany, User,\nTaskItem, Comment, Attachment, ..."]
        ENUM["Enums"]
        EVT["Domain Events\n(modeled, NOT wired — dead code)"]
    end

    C1 --> FEAT
    MID -.-> C1
    FEAT --> PIPE
    PIPE --> VAL
    FEAT --> IFACE
    IFACE -.implemented by.-> INFRA
    FEAT --> ENT
    REPO --> EF --> DOM
    HUB2 -.-> HND2["Handlers via IRealtimeNotifier"]

    style DOM fill:#1a2a4a,color:#fff
    style EVT stroke-dasharray: 5 5
```

**Dependency rule:** `API → Application → Domain`, `Infrastructure → Application → Domain`. Domain never references anything else. `AuditFlow.Shared` is scaffold-only, ignore.

---

## 3. Request Lifecycle (a typical write, e.g. "create Task")

```mermaid
sequenceDiagram
    participant UI as React Page
    participant RQ as TanStack Query
    participant AC as apiClient.ts
    participant CTRL as TasksController
    participant MED as MediatR Pipeline
    participant HND as CreateTaskCommandHandler
    participant TSS as ITenantScopeService
    participant DB as SQL Server (EF Core)
    participant RT as SignalR / Notification

    UI->>RQ: useMutation(createTask)
    RQ->>AC: apiClient.post("/tasks", draft)
    AC->>AC: attach Bearer token
    AC->>CTRL: POST /api/v1/tasks
    CTRL->>MED: mediator.Send(CreateTaskCommand)
    MED->>MED: ValidationBehavior (FluentValidation)
    MED->>MED: LoggingBehavior
    MED->>HND: handle()
    HND->>TSS: enforce company/assignee scope
    HND->>DB: insert TaskItem (+ TaskStatusHistory)
    DB-->>HND: saved (audit fields auto-stamped)
    HND->>RT: notify assignee (in-app + SignalR push)
    HND-->>CTRL: ApiResponse<TaskDetail>
    CTRL-->>AC: 201 + ApiResponse envelope
    AC-->>RQ: unwrap .data
    RQ-->>UI: cache updated, re-render
    RT-->>UI: (if connected) live notification badge update
```

**On 401:** `apiClient.ts` performs a single-flight refresh (`POST /auth/refresh`), retries the original request once; if refresh fails, clears tokens, calls the registered `unauthorizedHandler` (wired by `RoleContext`), and clears the whole Query cache.

---

## 4. Multi-Tenancy & Access Scoping

```mermaid
flowchart TD
    REQ["Incoming request\n+ JWT (tenant_id, role, company_id, sub_company_id)"] --> AUTHZ["[Authorize(Roles=...)]\nattribute check"]
    AUTHZ -->|fail| R403["403 (empty body)"]
    AUTHZ -->|pass| HANDLER["MediatR Handler"]
    HANDLER --> GQF["EF Global Query Filter\n!IsDeleted && TenantId == caller's tenant"]
    GQF --> TSS2{"Role?"}
    TSS2 -->|Platform admin| ZERO["TenantId = null →\nfilter yields zero tenant rows\n(admin queries use IgnoreQueryFilters explicitly)"]
    TSS2 -->|"Auditor (mapped)"| WIDE["GetEnforcedCompanyIds()\nrestricted to UserCompanyMapping rows,\nset at invite time"]
    TSS2 -->|"Auditor (unmapped)"| WIDE2["Unrestricted within tenant\n(no UserCompanyMapping rows)"]
    TSS2 -->|Company admin| SCOPED1["GetEnforcedCompanyId()\nclient-supplied companyId overridden, not just checked"]
    TSS2 -->|Employee| SCOPED2["GetEnforcedAssigneeId()\nalways own tasks only"]
    WIDE --> DB2[(SQL Server)]
    WIDE2 --> DB2
    SCOPED1 --> DB2
    SCOPED2 --> DB2
    ZERO --> DB2
```

Key point: tenant isolation is **row-level, shared database** — not database-per-tenant. Two independent layers enforce it: the EF global filter (tenant boundary) and `ITenantScopeService` (company/assignee boundary within a tenant). Both are server-side; the frontend's `routes.ts` access map is a UX convenience on top, not the actual security boundary.

---

## 5. Auth & Session Flow

```mermaid
sequenceDiagram
    participant UI as SignInPage
    participant AC as apiClient
    participant AUTH as AuthController
    participant DB as SQL Server

    UI->>AC: POST /auth/login {email, password}
    AC->>AUTH: forward
    AUTH->>DB: verify credentials (Identity)
    alt MFA enabled
        AUTH-->>UI: { requiresMfa: true } (no tokens)
        UI->>AUTH: POST /auth/login { ..., mfaCode }
        AUTH->>DB: verify TOTP / recovery code
    end
    AUTH->>DB: issue access token (60min) + refresh token (7d, SHA-256 hashed)
    AUTH-->>UI: { accessToken, refreshToken, expiresAt }
    UI->>UI: tokenStorage.set (sessionStorage; also localStorage if "Keep me signed in")
    UI->>UI: jwt-decode → RoleContext user (role, tenantId, companyId, ...)

    Note over UI,AUTH: Later — any 401 response
    UI->>AUTH: POST /auth/refresh (single-flight, deduped)
    AUTH->>DB: validate + rotate refresh token\n(reuse detection: replay revokes ALL sessions)
    AUTH-->>UI: new token pair
    UI->>UI: retry original request once
```

Frontend role bootstrap (`RoleContext.tsx`): in `mock` mode, restores a fake session from `localStorage` flags with a topbar role-switcher for manual testing; in `live` mode, role/tenant/company are **purely JWT-derived** — there is no separate "current user" fetch on boot beyond decoding the stored token.

**Token storage is `sessionStorage`-first, not `localStorage`** (changed 2026-08-11 — see `PROJECT_CONTEXT.md` §4 for the full "why", it was a real cross-account data-leak bug, not a preference). On load, `tokenStorage.ts` copies an existing `localStorage` session into `sessionStorage` *only if this tab doesn't already have its own* — so a tab that has ever independently logged in stays fully isolated from whatever any other tab does afterward. `apiClient.ts`'s `skipAuth` option keeps public endpoints (login, forgot/reset-password, invite validate/accept) from ever attaching a stray token from an unrelated session, which otherwise tripped the backend's tenant query filter on requests that should never have been treated as authenticated at all.

---

## 6. Frontend Routing & Shell Selection

```mermaid
flowchart TD
    ENTRY["main.tsx: QueryClientProvider → RoleProvider → BrowserRouter"] --> ROUTES["routes.ts table\n{path, access, ...}"]
    ROUTES --> PR["ProtectedRoute"]
    PR -->|"!isAuthenticated"| SIGNIN["redirect → /signin\n(preserve intended path)"]
    PR -->|"role not in access[]"| FALLBACK["redirect → /admin/tenants (Platform admin)\nor /dashboard (everyone else)"]
    PR -->|allowed| SHELLPICK{"which shell?"}
    SHELLPICK -->|"most routes"| APPSHELL["AppShell\n(Sidebar + Topbar)"]
    SHELLPICK -->|"/tasks/new, /tasks/bulk-upload,\n/companies/new, /companies/:id/edit,\n/users/new"| BARE["No shell\n(full-page form)"]
    SHELLPICK -->|"/admin/*"| PASHELL["PlatformAdminShell"]
    APPSHELL --> PAGE["Page component"]
    BARE --> PAGE
    PASHELL --> PAGE
    ROUTES -->|"public: true"| PUBLICSWITCH["PublicPage switch\n/signin, /invite/accept,\n/forgot-password, /reset-password"]
```

If a route exists in `routes.ts` but has no matching branch in `main.tsx`'s switch, it silently renders `PlaceholderPage`. `/admin/audit-log` was the one real remaining case of this — fixed 2026-08-11 (`AuditLogPage`, filters + pagination against the `GET /admin/audit-log` endpoint, which already existed backend-side).

---

## 7. Module ↔ Layer Map

Quick lookup: which frontend service and backend controller/handler folder own a given feature area.

| Module | Frontend service | Frontend pages | Backend controller | Backend feature folder | Key DB tables |
|---|---|---|---|---|---|
| Auth | `services/auth.ts` | SignInPage, AcceptInvitePage, ForgotPasswordPage, ResetPasswordPage | `AuthController`, invite endpoints | `Features/Auth` | Users (Identity), RefreshTokens, Invitations |
| Profile | `services/users.ts` (`/users/me*`) | ProfilePage | `UsersController` | `Features/Users` | Users |
| Dashboard | `services/dashboard.ts` | DashboardPage (Standard + Executive) | `DashboardController` | `Features/Dashboard` | Tasks, Companies (read-only aggregates) |
| Companies | `services/companies.ts` | CompanyManagementPage, CompanyFormPage | `CompaniesController` | `Features/Companies` | Companies, SubCompanies |
| Users | `services/users.ts` | UserManagementPage, InviteUserPage | `UsersController` | `Features/Users` | Users, Invitations, UserCompanyMappings |
| Tasks | `services/tasks.ts` | TaskGridPage, TaskCreatePage, TaskBulkCreatePage, TaskDetailsPage | `TasksController` | `Features/Tasks` | Tasks, Comments, Attachments, TaskStatusHistories |
| Reports | `services/reports.ts` | ReportsPage | `ReportsController` | `Features/Reports` | Tasks (query), Reports (async export jobs) |
| Notifications | `services/notifications.ts` | NotificationsPage, Topbar bell | `NotificationsController`, `NotificationHub` | `Features/Notifications` | Notifications |
| Platform Admin | `services/admin.ts` | PlatformAdminPages.tsx | `AdminController` | `Features/Admin` | Tenants, cross-tenant aggregates |
| Files | (embedded in `services/tasks.ts` uploads) | TaskDetailsPage attachments | `FilesController` | (Infrastructure file-storage factory) | Attachments |

Backend-side, `ArchitectureFlow.md` (backend repo root) has a deeper "which files to open" index per module — prefer it over re-deriving file lists by grepping.

---

## 8. Data Model Snapshot

```mermaid
erDiagram
    Tenant ||--o{ Company : has
    Company ||--o{ SubCompany : has
    Tenant ||--o{ ApplicationUser : has
    Company ||--o{ ApplicationUser : "scopes (CompanyAdmin/Employee)"
    ApplicationUser ||--o{ UserCompanyMapping : "mapped to (Auditor scoping — enforced)"
    Company ||--o{ UserCompanyMapping : "mapped via"
    ApplicationUser ||--o{ TaskItem : "assigned to"
    ApplicationUser ||--o{ TaskItem : "created by"
    Company ||--o{ TaskItem : "raised against"
    TaskItem ||--o{ Comment : has
    TaskItem ||--o{ Attachment : has
    TaskItem ||--o{ TaskStatusHistory : "append-only log"
    Comment ||--o{ Attachment : has
    Comment ||--o{ Comment : "replies (1 level)"
    ApplicationUser ||--o{ Notification : receives
    ApplicationUser ||--o{ RefreshToken : has
    Tenant ||--o{ Invitation : issues
    Tenant ||--o{ Report : "async export jobs"
```

Full column-level schema, indexes, and the module→table map live in the backend repo's `DatabaseStructure.md` — not duplicated here since it changes with migrations; re-read it directly when schema accuracy matters.

---

## 9. Known Architectural Gaps (see `PROJECT_CONTEXT.md` §3/§5 for full detail)

- Domain events subsystem: modeled, never wired.
- `AuditLog`/`TaskStatusHistory`: meant to be soft-delete-immune, not cleanly excluded from the global filter yet.
- Frontend debounce: only `GlobalSearch` (250ms); not centralized in `apiClient.ts` despite the horizontal-scale goal of baking dedup/debounce into the API layer.
- No CI/CD, no Dockerfile, no production secrets wired — deploy-readiness gaps, not functional gaps.
