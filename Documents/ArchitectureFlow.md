# AuditFlow — Architecture & Module File Map

**Purpose of this document:** a lookup table, not a tutorial. When asked to fix or add something in a
given module, the goal is to open *only* the files listed under that module below — not grep the whole
repo. Section 3 lists the handful of cross-cutting files that matter regardless of module. Section 5 is
the module-by-module file inventory. Section 7 has copy-paste "which files do I touch" recipes for the
most common request shapes.

This complements `DatabaseStructure.md` (schema/tables/relationships) — this document is about *code*,
not data.

## 1. Layer structure (Clean Architecture)

```
AuditFlow.API            → Controllers, Program.cs, middleware, SignalR hub. Thin: every action just
                            builds a Command/Query, sends it via MediatR, and returns the ApiResponse.
        ↓ references
AuditFlow.Application     → All business logic. Commands/Queries (MediatR requests), Handlers, Fluent
                            Validators, DTOs, pipeline Behaviors, and every cross-cutting interface
                            (ICurrentUserService, IApplicationDbContext, IEmailService, etc.) — interfaces
                            only, no implementation.
        ↓ references
AuditFlow.Domain          → Entities (BaseEntity-derived), enums. No dependency on anything else in the
                            solution. No EF/MediatR/ASP.NET references here.
        ↑ implemented by
AuditFlow.Infrastructure  → EF Core (ApplicationDbContext, Configurations, Migrations, Repositories),
                            Identity/JWT, email/file-storage providers, Hangfire jobs. Implements every
                            interface Application declares.
```

Dependency direction is strictly downward/inward (API → Application → Domain, Infrastructure → Application
→ Domain). Domain never references Application or Infrastructure. If a change requires Domain to know
about something in Infrastructure, that's a sign the abstraction belongs in an `Application/Common/Interfaces`
contract instead.

## 2. Request flow (how one HTTP call actually runs)

```
1. Controller action (AuditFlow.API/Controllers/*.cs)
   - builds a Command or Query object from route/query/body params
   - _mediator.Send(command) — that's it, no business logic in the controller

2. MediatR pipeline (registered in Application/DependencyInjection.cs, runs in this order):
   a. ValidationBehavior  → runs the matching FluentValidation validator (if one is registered for
      that request type); throws FluentValidation.ValidationException on failure, which
      GlobalExceptionHandlingMiddleware turns into a 400 ApiResponse
   b. LoggingBehavior     → logs "Handling {RequestName}" / "Handled {RequestName}" + result
   c. PerformanceBehavior → logs a warning if the handler takes >500ms (see the file for the exact
      threshold)

3. The Handler itself (Features/<Module>/{Commands,Queries}/Handlers/*.cs)
   - injects repositories (I*Repository) and/or IApplicationDbContext directly, plus whatever
     cross-cutting services it needs (ICurrentUserService, ITenantScopeService, INotificationService,
     IEmailService, IFileStorageService, ...)
   - reads ICurrentUserService for who's calling and ITenantScopeService for what they're allowed to
     see, applies business rules, talks to the repository/DbContext, returns ApiResponse<T>

4. EF Core (ApplicationDbContext) applies the global tenant + soft-delete query filters automatically
   on every query against a DbSet — see DatabaseStructure.md §3. The handler does not need to (and
   should not) hand-roll `.Where(t => t.TenantId == ...)` itself.

5. Controller wraps the returned ApiResponse in `StatusCode(result.StatusCode, result)` and that's the
   HTTP response.
```

Almost every bug fix or feature request touches only step 1 (controller) and step 3 (one handler file) —
steps 2 and 4 are shared plumbing that's already correct unless the change specifically concerns
validation ordering or tenant-filtering logic itself (in which case see §3).

## 3. Cross-cutting files (check these regardless of which module you're touching)

These aren't tied to one module — they run on every request or are shared by every handler.

| Concern | File(s) |
|---|---|
| DI wiring / startup / middleware pipeline / Swagger / CORS / rate limiting / Hangfire dashboard / SignalR hub mapping | `src/AuditFlow.API/Program.cs` |
| Turns exceptions into `ApiResponse` error JSON | `src/AuditFlow.API/Middleware/GlobalExceptionHandlingMiddleware.cs` |
| MediatR + FluentValidation + pipeline behavior registration | `src/AuditFlow.Application/DependencyInjection.cs` |
| Identity/JWT auth setup, every repository/service DI registration | `src/AuditFlow.Infrastructure/DependencyInjection.cs` |
| MediatR pipeline steps (run on **every** command/query) | `src/AuditFlow.Application/Common/Behaviors/{ValidationBehavior,LoggingBehavior,PerformanceBehavior}.cs` |
| The standard response envelope every handler returns | `src/AuditFlow.Application/Common/Models/{ApiResponse.cs,PagedResult.cs,IdentityOperationResult.cs}` |
| EF Core context: DbSets, global tenant+soft-delete query filters, audit-field stamping on save | `src/AuditFlow.Infrastructure/Persistence/ApplicationDbContext.cs` |
| Schema history | `src/AuditFlow.Infrastructure/Persistence/Migrations/*` |
| Generic repository base (`GetByIdAsync`, `AddAsync`, paging, etc.) | `src/AuditFlow.Application/Common/Repositories/IRepository.cs` + `src/AuditFlow.Infrastructure/Repositories/Repository.cs` |
| Every per-entity repository *contract* (one file, all interfaces) | `src/AuditFlow.Application/Common/Repositories/ISpecificRepositories.cs` |
| Who's calling (JWT claims → user id/tenant id/company id) | `src/AuditFlow.Application/Common/Interfaces/ICurrentUserService.cs` + `src/AuditFlow.Infrastructure/Services/CurrentUserService.cs` |
| What they're allowed to see (role → enforced company/assignee scope) | `src/AuditFlow.Application/Common/Interfaces/ITenantScopeService.cs` + `src/AuditFlow.Infrastructure/Services/TenantScopeService.cs` |
| Direct raw-SQL/EF context access contract used by handlers that don't go through a repository | `src/AuditFlow.Application/Common/Interfaces/IApplicationDbContext.cs` |
| JWT issuing/validation | `src/AuditFlow.Application/Common/Interfaces/IJwtTokenService.cs` + `src/AuditFlow.Infrastructure/Identity/JwtTokenService.cs` |
| Identity wrapper (create/activate/deactivate/reset password/roles) | `src/AuditFlow.Application/Common/Interfaces/IUserManagementService.cs` + `src/AuditFlow.Infrastructure/Identity/UserManagementService.cs` |
| `ICommand`/`ICommand<T>`/`IQuery<T>` marker interfaces | `src/AuditFlow.Application/Common/Interfaces/IRequestInterfaces.cs` |
| Bulk CSV/XLSX row parsing (shared by Tasks bulk-import and Companies bulk sub-company import) | `src/AuditFlow.Application/Common/Utilities/BulkFileRowReader.cs` |
| SQL Server `CONTAINS()` full-text search term builder (Tasks search) | `src/AuditFlow.Application/Common/Utilities/FullTextSearchHelper.cs` |
| Base entity (Id/CreatedAt/soft-delete columns every entity has) + every enum | `src/AuditFlow.Domain/Common/{BaseEntity.cs,Enums.cs}` |
| All 15 domain entities | `src/AuditFlow.Domain/Entities/*.cs` — see `DatabaseStructure.md` §5 for the full reference |
| All 13 EF Fluent configurations (indexes, FK delete behavior) | `src/AuditFlow.Infrastructure/Configurations/*.cs` — see `DatabaseStructure.md` §5 |
| Config sections (appsettings) | `src/AuditFlow.API/appsettings*.json` |

## 4. Conventions worth knowing before you go looking for a file

- **Commands and Queries for one module are usually in one flat file each**, not one-file-per-command:
  `Features/<Module>/Commands/<Module>Commands.cs` and `Features/<Module>/Queries/<Module>Queries.cs`.
  Response DTOs used only by that module are often defined at the bottom of the *same* file rather than
  in the `DTOs/` folder — check the Commands/Queries file itself before assuming a DTO lives in `DTOs/`.
- **Handlers are grouped by sub-concern into a few files per module**, not strictly one-handler-per-file
  (e.g. `UserLifecycleCommandHandlers.cs` holds `ResendInvitationCommandHandler` +
  `DeactivateUserCommandHandler` + `ActivateUserCommandHandler` together). §5's per-module tables give
  the exact handler → file mapping so you don't have to search.
- **`DTOs/` folder is inconsistent**: most modules have a `DTOs/<Module>/` subfolder
  (`DTOs/Users/UserDtos.cs`, `DTOs/Tasks/TaskDtos.cs`, `DTOs/Files/FileDtos.cs`, `DTOs/Dashboard/DashboardDtos.cs`,
  `DTOs/Admin/AdminDtos.cs`, `DTOs/Reports/ReportDtos.cs`), but **Companies' DTOs are a flat file directly
  under `DTOs/CompanyDtos.cs`**, no subfolder. Notifications and Auth have no dedicated DTOs file at all —
  their response classes live inside the Commands/Queries files.
- **Not every module has a Validators file.** Only Auth, Users, Companies, and Tasks do
  (`Validators/{Auth,Users,Companies,Tasks}/*CommandValidators.cs`). Dashboard, Files, Notifications,
  Reports, and Admin have no FluentValidation validators — their commands rely on basic model binding
  only, or the handler does its own manual checks.
- **Some query classes are defined in a `Commands` file, not `Queries`** — e.g.
  `GetReportFilterOptionsQuery` lives in `Features/Reports/Commands/ReportCommands.cs`
  (its handler is in `ReportCommandHandlers.cs`, not `ReportQueryHandlers.cs`), and
  `GetTaskStatisticsQuery` exists as two *separate* classes with the same name in two different
  namespaces — one in `Features/Tasks/Queries/TaskQueries.cs` (used by `TasksController`) and a
  near-identical one in `Features/Dashboard/Queries/DashboardQueries.cs` (used by `DashboardController`).
  They are not the same type — don't assume a single edit fixes both.
- **Tests roughly mirror the handler grouping**: one `*HandlerTests.cs` file per module in
  `tests/AuditFlow.Application.Tests/Handlers/`, one `*ControllerTests.cs` per controller in
  `tests/AuditFlow.API.Tests/Controllers/` (mocks `IMediator`, checks status-code mapping only), one
  `*ControllerIntegrationTests.cs` per controller in `tests/AuditFlow.Integration.Tests/Web/` (real
  in-memory EF Core DB + real handlers, no mocking), and one `*CommandValidatorTests.cs`/
  `*QueryValidatorTests.cs` per module with validators, in `tests/AuditFlow.Application.Tests/Validators/`.
- **Repository interfaces are all declared in one file**, `Common/Repositories/ISpecificRepositories.cs`,
  even though each has its own implementation file in `Infrastructure/Repositories/`. Adding a new
  repository method means editing the interface there *and* its implementation — two files minimum,
  not one.

## 5. Module-by-module file map

For each module: the HTTP entry point, every request/response type, every handler (with which class
handles which request), validators, DTOs, which repositories/entities it touches, which cross-cutting
services it depends on, and its tests. This is the list to open for a change scoped to that module.

### 5.1 Auth
*Login, tokens, password reset, invitation acceptance, MFA. No `[Authorize]` at the controller level
(`[AllowAnonymous]` by default) — individual actions opt into `[Authorize]` (MFA endpoints, Logout).*

| | |
|---|---|
| Controller | `src/AuditFlow.API/Controllers/AuthController.cs` |
| Commands/Responses | `src/AuditFlow.Application/Features/Auth/Commands/AuthCommands.cs` (`LoginCommand`, `RefreshTokenCommand`, `ForgotPasswordCommand`, `ResetPasswordCommand`, `AcceptInvitationCommand`, `SetupMfaCommand`, `VerifyMfaCommand`, `DisableMfaCommand`, `ValidateInviteTokenCommand`, `LogoutCommand` + their response classes) |
| Handlers | `LoginCommandHandler.cs` · `RefreshTokenCommandHandler.cs` · `PasswordResetCommandHandlers.cs` (`ForgotPasswordCommandHandler`, `ResetPasswordCommandHandler`) · `AcceptInvitationCommandHandler.cs` · `MfaCommandHandlers.cs` (`SetupMfaCommandHandler`, `VerifyMfaCommandHandler`, `DisableMfaCommandHandler`) · `ValidateInviteTokenCommandHandler.cs` (also contains `LogoutCommandHandler`) — all in `Features/Auth/Commands/Handlers/` |
| Validators | `src/AuditFlow.Application/Validators/Auth/AuthCommandValidators.cs` |
| Repositories / DbContext | `IUserRepository`, `IRefreshTokenRepository`, `IInvitationRepository`, `IAuditLogRepository`; `IApplicationDbContext` directly (Login reads `UserCompanyMappings` for the Auditor's mapped-company JWT claim) |
| Domain entities | `ApplicationUser`, `RefreshToken`, `Invitation`, `AuditLog`, `UserCompanyMapping` |
| Depends on | `IUserManagementService`, `IJwtTokenService`, `IMfaService` (`TotpMfaService.cs`), `IEmailService` (invite/reset emails) |
| Tests | `API.Tests/Controllers/AuthControllerTests.cs` · `Application.Tests/Handlers/{AuthCommandHandlerTests.cs,MfaCommandHandlerTests.cs}` · `Application.Tests/Validators/AuthCommandValidatorTests.cs` · `Integration.Tests/Web/AuthControllerIntegrationTests.cs` |

### 5.2 Users
*Invite/CRUD/activate/deactivate/passwords/preferences. `[Authorize]` at controller level; several
actions further restricted to `Roles = "Auditor,CompanyAdmin"`.*

| | |
|---|---|
| Controller | `src/AuditFlow.API/Controllers/UsersController.cs` |
| Commands | `src/AuditFlow.Application/Features/Users/Commands/UserCommands.cs` |
| Queries | `src/AuditFlow.Application/Features/Users/Queries/UserQueries.cs` |
| Command handlers | `InviteUserCommandHandler.cs` · `UpdateUserCommandHandler.cs` · `UserLifecycleCommandHandlers.cs` (`ResendInvitationCommandHandler`, `DeactivateUserCommandHandler`, `ActivateUserCommandHandler`) · `UserPasswordCommandHandlers.cs` (`ChangeUserPasswordCommandHandler`, `ResetUserPasswordCommandHandler`) · `UserPreferenceCommandHandlers.cs` (`UpdateUserNotificationPreferencesCommandHandler`, `UpdateUserThemeCommandHandler`, `UpdateOwnProfileCommandHandler`) — all in `Features/Users/Commands/Handlers/` |
| Query handlers | `UserQueryHandlers.cs` (`GetUsersQueryHandler`, `GetUserByIdQueryHandler`, `GetUserProfileQueryHandler`, `GetPotentialManagersQueryHandler`, `ValidateUserEmailQueryHandler`, `GetUserFilterOptionsQueryHandler`) — in `Features/Users/Queries/Handlers/` |
| Validators | `src/AuditFlow.Application/Validators/Users/UserCommandValidators.cs` |
| DTOs | `src/AuditFlow.Application/DTOs/Users/UserDtos.cs` |
| Repositories | `IUserRepository`; `ICompanyRepository`/`ISubCompanyRepository` (assignment validation); `IInvitationRepository`; `IApplicationDbContext` (writes `UserCompanyMappings` when inviting an Auditor) |
| Domain entities | `ApplicationUser`, `Invitation`, `UserCompanyMapping`, `Company`, `SubCompany` |
| Depends on | `IUserManagementService`, `IEmailService` (invite emails), `INotificationService` (invite in-app notification) |
| Tests | `API.Tests/Controllers/UsersControllerTests.cs` · `Application.Tests/Handlers/{UserCommandHandlerTests.cs,UserSelfServiceHandlerTests.cs,UserQueryHandlerTests.cs}` · `Application.Tests/Validators/UserCommandValidatorTests.cs` · `Integration.Tests/{Web/UsersControllerIntegrationTests.cs,Repositories/UserRepositoryIntegrationTests.cs}` |

### 5.3 Companies
*Company + SubCompany CRUD, statistics, bulk sub-company import. Most mutating actions are
`Roles = "Auditor"`-only; reads also allow `CompanyAdmin`.*

| | |
|---|---|
| Controller | `src/AuditFlow.API/Controllers/CompaniesController.cs` |
| Commands | `src/AuditFlow.Application/Features/Companies/Commands/CompanyCommands.cs` |
| Queries | `src/AuditFlow.Application/Features/Companies/Queries/CompanyQueries.cs` |
| Command handlers | `CreateCompanyCommandHandler.cs` · `CompanyManagementCommandHandlers.cs` (`UpdateCompanyCommandHandler`, `DeleteCompanyCommandHandler`) · `SubCompanyCommandHandlers.cs` (`AddSubCompanyCommandHandler`, `UpdateSubCompanyCommandHandler`, `DeleteSubCompanyCommandHandler`) · `BulkImportSubCompaniesCommandHandler.cs` — all in `Features/Companies/Commands/Handlers/` |
| Query handlers | `CompanyQueryHandlers.cs` (`GetCompaniesQueryHandler`, `GetCompanyByIdQueryHandler`, `GetSubCompaniesQueryHandler`, `GetSubCompanyByIdQueryHandler`, `GetCompanyStatisticsQueryHandler`) — in `Features/Companies/Queries/Handlers/` |
| Validators | `src/AuditFlow.Application/Validators/Companies/CompanyCommandValidators.cs` |
| DTOs | `src/AuditFlow.Application/DTOs/CompanyDtos.cs` — **note: flat file, no `Companies/` subfolder** (see §4) |
| Repositories | `ICompanyRepository`, `ISubCompanyRepository`; `IUserRepository`/`ITaskRepository` (statistics rollups) |
| Domain entities | `Company`, `SubCompany` |
| Depends on | `BulkFileRowReader` (CSV/XLSX parsing for bulk sub-company import) |
| Tests | `API.Tests/Controllers/CompaniesControllerTests.cs` · `Application.Tests/Handlers/{CompanyCommandHandlerTests.cs,CompanyQueryHandlerTests.cs}` · `Application.Tests/Validators/CompanyCommandValidatorTests.cs` · `Integration.Tests/{Web/CompaniesControllerIntegrationTests.cs,Repositories/CompanyRepositoryIntegrationTests.cs}` |

### 5.4 Tasks
*The core audit work item: CRUD, assignment, status transitions, comments, attachments, search, bulk
import. The biggest module by file count.*

| | |
|---|---|
| Controller | `src/AuditFlow.API/Controllers/TasksController.cs` |
| Commands | `src/AuditFlow.Application/Features/Tasks/Commands/TaskCommands.cs` |
| Queries | `src/AuditFlow.Application/Features/Tasks/Queries/TaskQueries.cs` |
| Command handlers | `CreateTaskCommandHandler.cs` · `UpdateTaskCommandHandler.cs` · `UpdateTaskStatusCommandHandler.cs` · `ReassignTaskCommandHandler.cs` · `DeleteTaskCommandHandler.cs` · `TaskCommentCommandHandlers.cs` (`AddTaskCommentCommandHandler`, `UpdateTaskCommentCommandHandler`, `DeleteTaskCommentCommandHandler`) · `TaskAttachmentCommandHandlers.cs` (`UploadTaskAttachmentCommandHandler`, `DeleteTaskAttachmentCommandHandler`) · `BulkTaskCommandHandlers.cs` (`BulkUploadTasksCommandHandler`, `BulkImportTasksCommandHandler`) — all in `Features/Tasks/Commands/Handlers/` |
| Query handlers | `GetTaskByIdQueryHandler.cs` · `GetTasksQueryHandler.cs` · `TaskCommentAttachmentQueryHandlers.cs` (`GetTaskCommentsQueryHandler`, `GetTaskAttachmentsQueryHandler`) · `TaskAuxiliaryQueryHandlers.cs` (`SearchTasksQueryHandler`, `GetTaskFilterOptionsQueryHandler`, `GetTaskTimelineQueryHandler`, `ValidateTaskAssigneeQueryHandler`, `GetTaskStatisticsQueryHandler`, `DownloadTaskTemplateCommandHandler`) — all in `Features/Tasks/Queries/Handlers/` |
| Validators | `src/AuditFlow.Application/Validators/Tasks/TaskCommandValidators.cs` |
| DTOs | `src/AuditFlow.Application/DTOs/Tasks/TaskDtos.cs` |
| Repositories | `ITaskRepository`, `ICommentRepository`, `IAttachmentRepository`; `ICompanyRepository`/`ISubCompanyRepository`/`IUserRepository` (lookups/validation) |
| Domain entities | `TaskItem`, `Comment`, `Attachment`, `TaskStatusHistory` (auto-appended by `TaskItem.UpdateStatus()` — not a separate handler call) |
| Depends on | `INotificationService` + `IEmailService` (assignment/status-change/comment alerts — see §6), `FullTextSearchHelper` (search), `BulkFileRowReader` (bulk import) |
| Tests | `API.Tests/Controllers/TasksControllerTests.cs` · `Application.Tests/Handlers/{TaskCommandHandlerTests.cs,TaskQueryHandlerTests.cs}` · `Application.Tests/Validators/TaskCommandValidatorTests.cs` · `Integration.Tests/{Web/TasksControllerIntegrationTests.cs,Repositories/TaskRepositoryIntegrationTests.cs}` |

### 5.5 Dashboard
*Read-only aggregates for the standard dashboard plus an Auditor-only "executive" suite. No commands are
actually wired (see the callout below) — every endpoint is a query.*

| | |
|---|---|
| Controller | `src/AuditFlow.API/Controllers/DashboardController.cs` |
| Queries | `src/AuditFlow.Application/Features/Dashboard/Queries/DashboardQueries.cs` (standard: summary, task stats, recent activity, overdue/upcoming tasks, company overview, weekly tasks, status breakdown, announcements — plus the executive query classes: KPIs, trend, status mix, company health, risk tasks, team workload) |
| Query handlers | `DashboardStandardQueryHandlers.cs` (`GetDashboardSummaryQueryHandler`, `GetDashboardTaskStatisticsQueryHandler`, `GetRecentActivityQueryHandler`, `GetOverdueTasksQueryHandler`, `GetUpcomingDeadlinesQueryHandler`, `GetCompanyOverviewQueryHandler`, `GetWeeklyTasksQueryHandler`, `GetStatusBreakdownQueryHandler`, `GetAnnouncementsQueryHandler`) and `DashboardExecutiveQueryHandlers.cs` (`GetExecutiveKpisQueryHandler`, `GetTrendDataQueryHandler`, `GetCompanyHealthQueryHandler`, `GetTeamWorkloadQueryHandler`, `GetRiskTasksQueryHandler`, `GetExecutiveStatusMixQueryHandler`) — both in `Features/Dashboard/Queries/Handlers/` |
| Repository | `IDashboardRepository` / `DashboardRepository.cs` (`src/AuditFlow.Infrastructure/Repositories/`) — almost the entire module's data access is one repository, not split per-entity. `GetSummaryAsync`/`GetTaskStatisticsAsync` are `IMemoryCache`-backed (60s TTL, keyed per caller) |
| Domain entities | `TaskItem`, `ApplicationUser`, `Company`, `Notification`, `Announcement`, `AuditLog` (read-only, no writes from this module) |
| ⚠️ Known gap | `src/AuditFlow.Application/Features/Dashboard/Commands/DashboardCommands.cs` defines `CreateAnnouncementCommand`/`UpdateAnnouncementCommand`/`DeleteAnnouncementCommand`, but **no handler exists for any of them and no controller action calls them**. Announcements today are read-only via the API (presumably seeded directly). If asked to add announcement management, these three command classes already exist and just need handlers + controller actions — don't assume you're starting from zero, but don't assume they work today either. |
| Tests | `API.Tests/Controllers/DashboardControllerTests.cs` · `Application.Tests/Handlers/DashboardQueryHandlerTests.cs` · `Integration.Tests/Web/DashboardControllerIntegrationTests.cs` |

### 5.6 Files
*Upload/download/metadata for attachments. No dedicated `Attachment` business rules beyond storage —
task-specific attachment rules (linking to a Task/Comment) live in the Tasks module instead.*

| | |
|---|---|
| Controller | `src/AuditFlow.API/Controllers/FilesController.cs` |
| Commands | `src/AuditFlow.Application/Features/Files/Commands/FileCommands.cs` (`GetUploadUrlCommand`, `UploadFileCommand`, `DeleteFileCommand`) |
| Queries | `src/AuditFlow.Application/Features/Files/Queries/FileQueries.cs` (`GetDownloadUrlQuery`, `DownloadFileQuery`, `GetFileMetadataQuery`) |
| Handlers | `FileCommandHandlers.cs` (`GetUploadUrlCommandHandler`, `UploadFileCommandHandler`, `DeleteFileCommandHandler`) in `Features/Files/Commands/Handlers/`; `FileQueryHandlers.cs` (`GetDownloadUrlQueryHandler`, `DownloadFileQueryHandler`, `GetFileMetadataQueryHandler`) in `Features/Files/Queries/Handlers/` |
| DTOs | `src/AuditFlow.Application/DTOs/Files/FileDtos.cs` |
| Repositories | `IAttachmentRepository` |
| Domain entities | `Attachment` |
| Depends on | `IFileStorageService` (`src/AuditFlow.Infrastructure/Services/FileStorageService.cs` — factory over `LocalFileStorageService`/`AzureBlobStorageService`, selected by `FileStorage:Provider` config), `FileUploadValidationOptions` (`Common/Options/`) |
| Tests | `API.Tests/Controllers/FilesControllerTests.cs` · `Application.Tests/Handlers/{FileCommandHandlerTests.cs,FileQueryHandlerTests.cs}` · `Infrastructure.Tests/Services/FileStorageServiceTests.cs` · `Integration.Tests/Web/FilesControllerIntegrationTests.cs` |

### 5.7 Notifications
*The user's own notification inbox (read/unread/preferences). Note this is the **consumer-facing** half
— the piece that actually creates a `Notification` row is `INotificationService`, called from other
modules (Tasks, Users), not from here.*

| | |
|---|---|
| Controller | `src/AuditFlow.API/Controllers/NotificationsController.cs` |
| Commands | `src/AuditFlow.Application/Features/Notifications/Commands/NotificationCommands.cs` (`MarkNotificationAsReadCommand`, `MarkAllNotificationsAsReadCommand`, `UpdateNotificationPreferencesCommand`, `DeleteNotificationCommand`) |
| Queries | `src/AuditFlow.Application/Features/Notifications/Queries/NotificationQueries.cs` (`GetNotificationsQuery`, `GetUnreadCountQuery`, `GetNotificationPreferencesQuery`) |
| Handlers | `NotificationCommandHandlers.cs` (`MarkNotificationAsReadCommandHandler`, `MarkAllNotificationsAsReadCommandHandler`, `DeleteNotificationCommandHandler`, `UpdateNotificationPreferencesCommandHandler`) in `Features/Notifications/Commands/Handlers/`; `NotificationQueryHandlers.cs` (`GetNotificationsQueryHandler`, `GetUnreadCountQueryHandler`, `GetNotificationPreferencesQueryHandler`) in `Features/Notifications/Queries/Handlers/` |
| Repositories | `INotificationRepository` |
| Domain entities | `Notification` |
| **Where notifications actually get created** (not in this module) | `src/AuditFlow.Infrastructure/Services/NotificationService.cs` (`INotificationService`) — called from `CreateTaskCommandHandler`, `ReassignTaskCommandHandler`, `UpdateTaskStatusCommandHandler`, `TaskCommentCommandHandlers`, `InviteUserCommandHandler`. Pushes both the DB row and a live SignalR event. |
| Realtime delivery | `src/AuditFlow.Application/Common/Interfaces/IRealtimeNotifier.cs` + `src/AuditFlow.API/Realtime/SignalRRealtimeNotifier.cs` + `src/AuditFlow.API/Hubs/NotificationHub.cs` |
| Daily digest email | `src/AuditFlow.Infrastructure/BackgroundServices/DailyDigestBackgroundService.cs` — a hosted background service, not request-driven; reads `Notification`+`Users.DailyDigestEnabled` |
| Tests | `API.Tests/Controllers/NotificationsControllerTests.cs` · `Application.Tests/Handlers/{NotificationCommandHandlerTests.cs,NotificationQueryHandlerTests.cs}` · `Infrastructure.Tests/Services/NotificationServiceTests.cs` · `Integration.Tests/Web/NotificationsControllerIntegrationTests.cs` |

### 5.8 Reports
*Task-report data + Excel/PDF export, both synchronous (small) and async/queued via Hangfire (large,
>10,000 rows).*

| | |
|---|---|
| Controller | `src/AuditFlow.API/Controllers/ReportsController.cs` |
| Commands | `src/AuditFlow.Application/Features/Reports/Commands/ReportCommands.cs` (`ExportTasksReportCommand`, `RequestTaskReportExportCommand`, `GenerateTasksReportCommand`, **and** `GetReportFilterOptionsQuery` — a query defined in the Commands file, see §4) |
| Queries | `src/AuditFlow.Application/Features/Reports/Queries/ReportQueries.cs` (`GetReportByIdQuery`, `GetReportsQuery`, `DownloadReportQuery`) |
| Command handlers | `ReportCommandHandlers.cs` (`GenerateTasksReportCommandHandler`, `ExportTasksReportCommandHandler`, `RequestTaskReportExportCommandHandler`, `GetReportFilterOptionsQueryHandler`) in `Features/Reports/Commands/Handlers/` |
| Query handlers | `ReportQueryHandlers.cs` (`GetReportByIdQueryHandler`, `GetReportsQueryHandler`, `DownloadReportQueryHandler`) in `Features/Reports/Queries/Handlers/` |
| Background job | `src/AuditFlow.Application/Features/Reports/Jobs/ReportGenerationJob.cs` — the actual worker that runs when a Hangfire job fires for an async export; not called directly by any handler, only enqueued via `IReportExportQueue` |
| DTOs | `src/AuditFlow.Application/DTOs/Reports/ReportDtos.cs` |
| Repositories | `ITaskRepository`, `IReportRepository` |
| Domain entities | `Report`, `TaskItem` |
| Depends on | `IReportExportService` (`src/AuditFlow.Infrastructure/Services/ReportExportService.cs` — ClosedXML for Excel, QuestPDF for PDF), `IReportExportQueue` (`HangfireReportExportQueue.cs`, wraps `BackgroundJob.Enqueue`) |
| Tests | `API.Tests/Controllers/ReportsControllerTests.cs` · `Application.Tests/Handlers/{ReportCommandHandlerTests.cs,ReportQueryHandlerTests.cs}` · `Integration.Tests/Web/ReportsControllerIntegrationTests.cs` |

### 5.9 Admin
*PlatformAdmin-only: tenant (Auditor Account) lifecycle, system health, platform-wide audit log,
support impersonation. Route is `api/admin`, not `api/[controller]`.*

| | |
|---|---|
| Controller | `src/AuditFlow.API/Controllers/AdminController.cs` |
| Commands | `src/AuditFlow.Application/Features/Admin/Commands/AdminCommands.cs` (`CreateAuditorAccountCommand`, `UpdateAuditorAccountCommand`, `ImpersonateAuditorAccountCommand`) |
| Queries | `src/AuditFlow.Application/Features/Admin/Queries/AdminQueries.cs` (`GetAuditorAccountsQuery`, `GetAuditorAccountByIdQuery`, `GetSystemHealthQuery`, `GetAuditLogQuery`) |
| Command handlers | `AdminCommandHandlers.cs` (`CreateAuditorAccountCommandHandler`, `UpdateAuditorAccountCommandHandler`, `ImpersonateAuditorAccountCommandHandler`) in `Features/Admin/Commands/Handlers/` |
| Query handlers | `AdminQueryHandlers.cs` (`GetAuditorAccountsQueryHandler`, `GetAuditorAccountByIdQueryHandler`, `GetSystemHealthQueryHandler`, `GetAuditLogQueryHandler`) in `Features/Admin/Queries/Handlers/` |
| DTOs | `src/AuditFlow.Application/DTOs/Admin/AdminDtos.cs` |
| Repositories | `ITenantRepository`, `ICompanyRepository`, `IUserRepository`, `IAuditLogRepository`; `IApplicationDbContext` directly (`GetDatabaseSizeBytesAsync`/`GetLastBackupAtAsync` — raw SQL against `sys.master_files`/`msdb.dbo.backupset`, see `ApplicationDbContext.cs`) |
| Domain entities | `Tenant`, `Company`, `ApplicationUser`, `AuditLog` |
| Depends on | `IJwtTokenService` (impersonation issues a real access/refresh token pair for the tenant's account holder) |
| Tests | `API.Tests/Controllers/AdminControllerTests.cs` · `Application.Tests/Handlers/{AdminCommandHandlerTests.cs,AdminQueryHandlerTests.cs}` · `Integration.Tests/Web/AdminControllerIntegrationTests.cs` |

## 6. Cross-module side effects (things that don't show up if you only open one module's files)

Some actions ripple into other modules' tables/services. If you're changing one of these, check the
"also touches" column too — don't assume the change is contained to the module you started in.

| Action (module) | Also touches |
|---|---|
| Create/reassign/status-change/comment on a Task (Tasks) | `Notification` row + SignalR push (`INotificationService`), an email (`IEmailService`, gated by the recipient's `EmailNotificationsEnabled`), and — for status changes only — a `TaskStatusHistory` row (appended inside `TaskItem.UpdateStatus()` itself, not by the handler) |
| Invite a user (Users) | `Invitation` row, an email, an in-app `Notification`, and — if the invited role is `Auditor` — a `UserCompanyMapping` row |
| Login (Auth) | Reads `AspNetUserRoles` (via `UserManager.GetRolesAsync`) as the primary source of the JWT role claim, falling back to `Users.Role` only if empty (see `DatabaseStructure.md` §7); also reads `UserCompanyMappings` to embed `mapped_company_id` claims for Auditors |
| Delete a Company (Companies) | Cascades to `SubCompanies` at the DB level, but `Users`/`Tasks` FKs are `Restrict` — the handler must deal with those first or the delete will fail at the database, not be silently allowed |
| Async report export (Reports) | Queues a Hangfire job (`IReportExportQueue`/`HangfireReportExportQueue`) that later runs `ReportGenerationJob`, which writes the `Reports` row's status and — on completion — fires a `ReportReady` notification |
| Any write anywhere | Nothing to do manually — `ApplicationDbContext.SaveChangesAsync` auto-stamps `CreatedAt`/`CreatedBy`/`UpdatedAt`/`UpdatedBy`/soft-delete fields for every tracked entity; handlers never set these themselves |

## 7. "Where do I make this kind of change" — quick recipes

- **Add a new field to an existing entity** → add the property to the entity (`Domain/Entities/X.cs`),
  update its Fluent config if it needs a max-length/index/FK (`Infrastructure/Configurations/XConfiguration.cs`),
  add an EF migration (`dotnet ef migrations add ... --project src/AuditFlow.Infrastructure --startup-project src/AuditFlow.API`),
  then thread it through the relevant Command/Query + Response DTO + handler for whichever module
  surfaces it, and the matching validator if the field needs a rule.
- **Add a new endpoint to an existing module** → new method on the Controller; new `IRequest`-derived
  class in that module's `Commands.cs`/`Queries.cs`; new handler (either a new file or added to an
  existing grouped-handler file per §4's convention); register a validator rule only if that module
  already has a validators file (§4).
- **Fix a bug in one existing endpoint's behavior** → almost always just the one handler file from §5's
  table for that module — check §6 first in case the bug is actually a missing side-effect (e.g. "task
  reassignment doesn't notify the new assignee" is a Tasks handler bug, not a Notifications bug).
- **Change a validation rule** → the module's `*CommandValidators.cs` file only (§5), unless the module
  has none (Dashboard/Files/Notifications/Reports/Admin — see §4), in which case the check is inline in
  the handler itself.
- **Change what a role is allowed to do** → the `[Authorize(Roles = "...")]` attribute on the controller
  action (`Controllers/*.cs`). Handler-level extra restriction (e.g. "CompanyAdmin can view but not
  modify") is checked inside the handler or on the entity itself (e.g. `TaskItem.CanBeModifiedByUser`/
  `CanChangeStatus` in `Domain/Entities/TaskItem.cs`) — check both places.
- **Change tenant/company/assignee scoping rules** → `Infrastructure/Services/TenantScopeService.cs`
  (what "enforced" scope means per role) and/or `ApplicationDbContext.ConfigureGlobalFilters` (the
  filter every query gets automatically) — see `DatabaseStructure.md` §3. Don't add manual
  `WHERE TenantId ==` filtering in a handler; it's already applied globally and a second manual filter
  is redundant at best, wrong at worst if the enforced-scope logic differs from a naive tenant check.
- **Add/change an email or in-app notification** → `Infrastructure/Services/{EmailService.cs,EmailTemplates.cs,NotificationService.cs}`
  for the sending mechanism itself; the *calling* handler (per §6) for when/why it fires.
- **Change file storage behavior (local vs Azure Blob vs S3)** → `Infrastructure/Services/FileStorageService.cs`
  (the factory + both provider implementations) and `appsettings*.json`'s `FileStorage` section — not
  the Files module's handlers, which only call `IFileStorageService` and don't know which provider is active.
- **Add a new background job** → follow the `ReportGenerationJob.cs` (Application, the actual work) +
  `HangfireReportExportQueue.cs` (Infrastructure, the enqueue wrapper) split, and register it in
  `Infrastructure/DependencyInjection.cs` the way `IReportGenerationJob`/`IReportExportQueue` are
  registered there today. For a simple recurring job instead of a queued one-shot, see
  `DailyDigestBackgroundService.cs` (a plain `IHostedService`, no Hangfire involved) as the template.
- **Anything about the DB schema itself** (new table, new relationship, new index) → see
  `DatabaseStructure.md` in full; it's the authoritative reference for schema, not this document.

## 8. Full path index (for grep/glob convenience)

```
src/AuditFlow.API/
  Controllers/{Auth,Users,Companies,Tasks,Dashboard,Files,Notifications,Reports,Admin}Controller.cs
  Hubs/NotificationHub.cs
  Realtime/SignalRRealtimeNotifier.cs
  Middleware/GlobalExceptionHandlingMiddleware.cs
  Program.cs

src/AuditFlow.Application/
  Common/
    Behaviors/{ValidationBehavior,LoggingBehavior,PerformanceBehavior}.cs
    Interfaces/*.cs                          (every cross-cutting contract)
    Models/{ApiResponse,PagedResult,IdentityOperationResult}.cs
    Options/FileUploadValidationOptions.cs
    Repositories/{IRepository,ISpecificRepositories}.cs
    Utilities/{FullTextSearchHelper,BulkFileRowReader}.cs
  DTOs/{Admin,Dashboard,Files,Tasks,Users,Reports}/*Dtos.cs, DTOs/CompanyDtos.cs
  Features/<Module>/
    Commands/<Module>Commands.cs
    Commands/Handlers/*.cs
    Queries/<Module>Queries.cs
    Queries/Handlers/*.cs
  Validators/{Auth,Companies,Tasks,Users}/*CommandValidators.cs
  DependencyInjection.cs

src/AuditFlow.Domain/
  Common/{BaseEntity,Enums}.cs
  Entities/*.cs                              (15 entities — see DatabaseStructure.md)

src/AuditFlow.Infrastructure/
  Configurations/*Configuration.cs            (13 files — see DatabaseStructure.md)
  Identity/{UserManagementService,JwtTokenService}.cs
  Persistence/{ApplicationDbContext,FeatureFlagsOptions}.cs
  Persistence/Migrations/*.cs
  Repositories/{Repository,UserRepository,TaskRepository,CompanyRepository,TenantRepository,ReportRepository,DashboardRepository,OtherRepositories}.cs
  Services/{CurrentUserService,TenantScopeService,FileStorageService,EmailService,EmailTemplates,NotificationService,ReportExportService,HangfireReportExportQueue,TotpMfaService}.cs
  BackgroundServices/DailyDigestBackgroundService.cs
  DependencyInjection.cs

tests/
  AuditFlow.Domain.Tests/Entities/*Tests.cs
  AuditFlow.Application.Tests/{Handlers,Validators}/*Tests.cs, TestHelpers/FakeApplicationDbContext.cs
  AuditFlow.Infrastructure.Tests/{Identity,Services}/*Tests.cs
  AuditFlow.API.Tests/{Controllers,Middleware}/*Tests.cs
  AuditFlow.Integration.Tests/{Web,Repositories,Identity,Infrastructure}/*Tests.cs
```
