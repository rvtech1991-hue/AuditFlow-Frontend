# AuditFlow — SQL Investigation Queries

> **Purpose:** a screen-by-screen and general-purpose SQL Server (T-SQL) query reference for
> investigating bugs by checking what's actually in the database — not a schema doc. For table
> definitions/relationships see [`DatabaseStructure.md`](./DatabaseStructure.md); for which backend
> files own a module see [`ArchitectureFlow.md`](./ArchitectureFlow.md). This doc just answers
> "which query do I run to check screen X's data?"
>
> All queries are **read-only (`SELECT`)** and safe to run against a dev/local copy of the `AuditFlow`
> database. Don't run ad-hoc `UPDATE`/`DELETE` against production data from this doc — if a fix
> requires a data change, do it through the application or a reviewed migration, not a manual patch.

---

## 0. Before you start

- **Every custom table has `IsDeleted`/`DeletedAt`/`DeletedBy`.** The app's global query filter hides
  `IsDeleted = 1` rows automatically — most queries below add `AND IsDeleted = 0` to match what the
  app would actually see. Drop that filter deliberately when you're investigating "why did this
  disappear" (§1.4).
- **`AuditLogs` and `TaskStatusHistories` are never soft-deleted** — no `IsDeleted` filter needed on
  those two.
- **Tenant isolation is enforced by `TenantId`.** When investigating, filter by `TenantId` the same
  way the app would — a query missing that filter can show you cross-tenant rows the UI would never
  actually display, which looks like a bug but isn't one.
- **All primary keys are `uniqueidentifier` (GUID)**, application-generated. Swap in real GUIDs (or a
  `WHERE Email = '...'` / `WHERE TaskNumber = '...'` lookup) wherever you see a `@Placeholder` below.
- **Enums are plain integers** — every query that touches one decodes it with `CASE` so results are
  readable without a lookup table open in another tab. Full enum reference: §0.1.
- Table name ≠ entity name in a couple of places: the `TaskItem` entity → `Tasks` table, the
  `ApplicationUser` entity → `Users` table (renamed from Identity's `AspNetUsers`).

### 0.1 Enum decode reference

| Enum | Values |
|---|---|
| `UserRole` (`Users.Role`) | 1=PlatformAdmin, 2=Auditor, 3=CompanyAdmin, 4=Employee |
| `UserStatus` (`Users.Status`) | 1=Invited, 2=Active, 3=Deactivated |
| `AuditTaskStatus` (`Tasks.Status`, `TaskStatusHistories.FromStatus`/`ToStatus`) | 1=Open, 2=InProgress, 3=Resolved, 4=Closed, 5=Reopened |
| `TaskPriority` (`Tasks.Priority`) | 1=Low, 2=Medium, 3=High, 4=Critical |
| `CompanyStatus` (`Companies.Status`) | 1=Active, 2=Inactive, 3=Onboarding |
| `InvitationStatus` (`Invitations.Status`) | 1=Pending, 2=Accepted, 3=Expired, 4=Revoked |
| `NotificationType` (`Notifications.Type`) | 1=TaskAssigned, 2=TaskStatusChanged, 3=TaskCommented, 4=TaskReopened, 5=TaskClosed, 6=MentionedInComment, 7=InvitationReceived, 8=Announcement, 9=ReportReady |
| `NotificationChannel` (`Notifications.Channel`) | 1=InApp, 2=Email, 3=Both |
| `AuditAction` (`AuditLogs.Action`) | 1=Created, 2=Updated, 3=Deleted, 4=StatusChanged, 5=Assigned, 6=CommentAdded, 7=AttachmentUploaded, 8=AttachmentDeleted, 9=UserInvited, 10=UserActivated, 11=UserDeactivated, 12=CompanyCreated, 13=CompanyUpdated, 14=SubCompanyCreated, 15=SubCompanyUpdated, 16=BulkImport, 17=Login, 18=Logout, 19=PasswordChanged, 20=MfaEnabled, 21=MfaDisabled, 22=Impersonation |
| `FileStorageProvider` (`Attachments.StorageProvider`) | 1=Local, 2=AzureBlob, 3=AwsS3 |
| `ReportFormat` (`Reports.Format`) | 1=Excel, 2=Pdf |
| `ReportType` (`Reports.Type`) | 1=TaskReport, 2=UserActivityReport, 3=CompanyPerformanceReport |
| `ReportStatus` (`Reports.Status`) | 1=Pending, 2=Generating, 3=Completed, 4=Failed |
| `AuditorStatus` (`Tenants.Status`) | 1=Onboarding, 2=Active, 3=Suspended, 4=Cancelled |
| `ChecklistRecurrenceType` (`ChecklistItems.RecurrenceType`) | 1=OneTime, 2=Daily, 3=Weekly, 4=Monthly |
| `ChecklistItemStatus` (`ChecklistItems.Status`) | 1=Pending, 2=InProgress, 3=Completed |

`Tenants.Plan` is free text (`Starter`/`Growth`/`Scale`/`Enterprise` by convention), not an enum column.

---

## 1. General / cross-cutting queries

Use these first — most investigations start with "who is this user / what tenant are they in / what
does the audit trail say" before drilling into a specific screen.

### 1.1 Look up a user by email — role, tenant, company, status

**Scenario:** "User X says they can't see Y" — start here to confirm their actual role/scope, which
is often the whole answer.

```sql
SELECT
    u.Id, u.Email, u.FullName,
    CASE u.Role WHEN 1 THEN 'PlatformAdmin' WHEN 2 THEN 'Auditor' WHEN 3 THEN 'CompanyAdmin' WHEN 4 THEN 'Employee' END AS Role,
    CASE u.Status WHEN 1 THEN 'Invited' WHEN 2 THEN 'Active' WHEN 3 THEN 'Deactivated' END AS Status,
    u.TenantId, t.Name AS TenantName,
    u.CompanyId, c.Name AS CompanyName,
    u.SubCompanyId, sc.Name AS SubCompanyName,
    u.LastLoginAt, u.InvitedAt, u.ActivatedAt,
    u.MfaEnabled, u.LockoutEnd, u.AccessFailedCount, u.EmailConfirmed
FROM Users u
LEFT JOIN Tenants t ON t.Id = u.TenantId
LEFT JOIN Companies c ON c.Id = u.CompanyId
LEFT JOIN SubCompanies sc ON sc.Id = u.SubCompanyId
WHERE u.Email = 'user@example.com' AND u.IsDeleted = 0;
```

### 1.2 An Auditor's effective scope (mapped companies)

**Scenario:** "This Auditor can see Company A but not Company B" — a mapped Auditor is restricted to
`UserCompanyMappings` rows; an **unmapped** Auditor (zero rows here) is unrestricted within their
tenant. Check which situation you're in before assuming a bug.

```sql
SELECT ucm.UserId, u.Email, ucm.CompanyId, c.Name AS CompanyName, ucm.SubCompanyId, sc.Name AS SubCompanyName
FROM UserCompanyMappings ucm
JOIN Users u ON u.Id = ucm.UserId
JOIN Companies c ON c.Id = ucm.CompanyId
LEFT JOIN SubCompanies sc ON sc.Id = ucm.SubCompanyId
WHERE ucm.UserId = @UserId AND ucm.IsDeleted = 0;
```

If this returns **zero rows**, the Auditor is unmapped → unrestricted within their tenant (not a bug,
that's the documented fallthrough). If it returns rows, anything outside that company list is
correctly invisible to them — including on the company dropdown, task creation, and dashboards.

> **Reminder:** `mapped_company_id` is baked into the JWT at login. A row inserted here *after* the
> user's last login won't take effect until they log in again or refresh their token — if a mapping
> was just added and "still doesn't work," that's very often the actual cause, not a data bug.

### 1.3 Tenant snapshot — everything under one Auditor Account

**Scenario:** Getting oriented in an unfamiliar tenant before digging into a specific complaint.

```sql
SELECT t.Id, t.Name, t.Domain,
    CASE t.Status WHEN 1 THEN 'Onboarding' WHEN 2 THEN 'Active' WHEN 3 THEN 'Suspended' WHEN 4 THEN 'Cancelled' END AS Status,
    t.Plan, t.PrimaryContactEmail,
    (SELECT COUNT(*) FROM Companies WHERE TenantId = t.Id AND IsDeleted = 0) AS CompanyCount,
    (SELECT COUNT(*) FROM Users WHERE TenantId = t.Id AND IsDeleted = 0) AS UserCount,
    (SELECT COUNT(*) FROM Tasks WHERE TenantId = t.Id AND IsDeleted = 0) AS TaskCount
FROM Tenants t
WHERE t.Domain = 'acmeaudit.com' AND t.IsDeleted = 0;
```

### 1.4 "It disappeared" — check if a row was soft-deleted

**Scenario:** A task/company/user that a user swears existed is no longer visible anywhere in the UI.
The app's global filter hides `IsDeleted = 1` automatically, so the UI genuinely can't show it even
though the row is still physically present — this query deliberately ignores that filter.

```sql
SELECT Id, IsDeleted, DeletedAt, DeletedBy, CreatedAt, UpdatedAt
FROM Tasks            -- swap in Companies / SubCompanies / Users / Comments / Attachments / ChecklistItems
WHERE Id = @Id;        -- no IsDeleted filter here — this is the whole point
```

If `IsDeleted = 1`, it was intentionally deleted (or cascade-deleted from a parent) — check `DeletedBy`
against §1.5's audit-log query to find who and when.

### 1.5 Audit trail for a specific entity

**Scenario:** "Who changed/deleted this, and when?" — works for any entity type since `AuditLogs` is
polymorphic (`EntityType` + `EntityId`, no FK).

```sql
SELECT al.CreatedAt, al.Action,
    CASE al.Action WHEN 1 THEN 'Created' WHEN 2 THEN 'Updated' WHEN 3 THEN 'Deleted' WHEN 4 THEN 'StatusChanged'
        WHEN 5 THEN 'Assigned' WHEN 6 THEN 'CommentAdded' WHEN 7 THEN 'AttachmentUploaded' WHEN 8 THEN 'AttachmentDeleted'
        WHEN 9 THEN 'UserInvited' WHEN 10 THEN 'UserActivated' WHEN 11 THEN 'UserDeactivated' WHEN 12 THEN 'CompanyCreated'
        WHEN 13 THEN 'CompanyUpdated' WHEN 14 THEN 'SubCompanyCreated' WHEN 15 THEN 'SubCompanyUpdated' WHEN 16 THEN 'BulkImport'
        WHEN 17 THEN 'Login' WHEN 18 THEN 'Logout' WHEN 19 THEN 'PasswordChanged' WHEN 20 THEN 'MfaEnabled' WHEN 21 THEN 'MfaDisabled'
        WHEN 22 THEN 'Impersonation' END AS ActionName,
    u.Email AS ActorEmail, al.OldValuesJson, al.NewValuesJson, al.MetadataJson, al.IpAddress, al.CorrelationId
FROM AuditLogs al
LEFT JOIN Users u ON u.Id = al.UserId
WHERE al.EntityType = 'TaskItem' AND al.EntityId = @TaskId   -- EntityType examples: 'TaskItem','Company','ApplicationUser'
ORDER BY al.CreatedAt DESC;
```

### 1.6 Recent activity across a tenant (any user, any entity)

**Scenario:** "Something weird happened in this tenant around 3pm yesterday" — broad activity sweep
before you know which entity to target.

```sql
SELECT al.CreatedAt, al.EntityType, al.EntityId, al.Action, u.Email AS ActorEmail, al.CorrelationId
FROM AuditLogs al
LEFT JOIN Users u ON u.Id = al.UserId
WHERE al.TenantId = @TenantId
  AND al.CreatedAt BETWEEN '2026-08-14T00:00:00' AND '2026-08-15T00:00:00'
ORDER BY al.CreatedAt DESC;
```

### 1.7 A user's active sessions / refresh tokens

**Scenario:** "User says they got logged out unexpectedly" or checking whether a reuse-detection
revocation actually fired (a replayed refresh token revokes **all** of a user's sessions).

```sql
SELECT Id, ExpiresAt, RevokedAt, ReplacedByTokenHash, CreatedAt
FROM RefreshTokens
WHERE UserId = @UserId
ORDER BY CreatedAt DESC;
```

A wave of rows with the same-ish `RevokedAt` timestamp and populated `ReplacedByTokenHash` chains is
normal rotation. Many rows revoked at *once* with no chain (all `RevokedAt` equal, `ReplacedByTokenHash`
null) points at reuse-detection kicking in — a stolen/replayed token.

### 1.8 Pending / stuck invitations

**Scenario:** "I invited someone and they never got in."

```sql
SELECT i.Email, i.FullName,
    CASE i.Role WHEN 1 THEN 'PlatformAdmin' WHEN 2 THEN 'Auditor' WHEN 3 THEN 'CompanyAdmin' WHEN 4 THEN 'Employee' END AS Role,
    CASE i.Status WHEN 1 THEN 'Pending' WHEN 2 THEN 'Accepted' WHEN 3 THEN 'Expired' WHEN 4 THEN 'Revoked' END AS Status,
    i.ExpiresAt, i.AcceptedAt, inviter.Email AS InvitedByEmail, accepter.Email AS AcceptedByEmail
FROM Invitations i
LEFT JOIN Users inviter ON inviter.Id = i.InvitedByUserId
LEFT JOIN Users accepter ON accepter.Id = i.AcceptedByUserId
WHERE i.TenantId = @TenantId AND i.IsDeleted = 0
ORDER BY i.CreatedAt DESC;
```

`Status = 1` (Pending) past `ExpiresAt` is a link that will fail to accept even though it still shows
as "Pending" in this raw query — the expiry check happens at accept-time in the handler, not as a
background job flipping the status column. Compare `ExpiresAt` to `GETUTCDATE()` yourself.

### 1.9 A user's unread-notification count (matches the topbar bell)

```sql
SELECT COUNT(*) AS UnreadCount
FROM Notifications
WHERE UserId = @UserId AND IsRead = 0 AND IsDeleted = 0;
```

### 1.10 Async report export status (Hangfire-backed)

**Scenario:** "My export has been 'Generating' forever."

```sql
SELECT r.Id, r.Name,
    CASE r.Type WHEN 1 THEN 'TaskReport' WHEN 2 THEN 'UserActivityReport' WHEN 3 THEN 'CompanyPerformanceReport' END AS Type,
    CASE r.Format WHEN 1 THEN 'Excel' WHEN 2 THEN 'Pdf' END AS Format,
    CASE r.Status WHEN 1 THEN 'Pending' WHEN 2 THEN 'Generating' WHEN 3 THEN 'Completed' WHEN 4 THEN 'Failed' END AS Status,
    r.TotalRecords, r.ErrorMessage, r.CreatedAt, r.CompletedAt, u.Email AS RequestedByEmail
FROM Reports r
JOIN Users u ON u.Id = r.RequestedByUserId
WHERE r.TenantId = @TenantId
ORDER BY r.CreatedAt DESC;
```

If stuck on `Generating`/`Pending` for a long time, cross-check the Hangfire tables in the same DB:

```sql
SELECT j.Id, j.StateName, j.CreatedAt, s.Name, s.Reason, s.Data
FROM [HangFire].Job j
LEFT JOIN [HangFire].State s ON s.JobId = j.Id AND s.Id = j.StateId
ORDER BY j.CreatedAt DESC;
```

`StateName = 'Failed'` with a `Reason`/stack trace in `Data` tells you why the export job died server-side.

### 1.11 Cross-tenant leak check (sanity check, not a routine query)

**Scenario:** Verifying a suspected tenant-isolation bug — this deliberately looks for rows that
*shouldn't* be able to exist if the app's invariants hold.

```sql
-- SubCompany.TenantId should always match its parent Company's TenantId (denormalized copy)
SELECT sc.Id, sc.TenantId AS SubCompanyTenantId, c.TenantId AS CompanyTenantId
FROM SubCompanies sc
JOIN Companies c ON c.Id = sc.CompanyId
WHERE sc.TenantId <> c.TenantId;

-- A Task's TenantId should always match its Company's TenantId
SELECT ta.Id, ta.TaskNumber, ta.TenantId AS TaskTenantId, c.TenantId AS CompanyTenantId
FROM Tasks ta
JOIN Companies c ON c.Id = ta.CompanyId
WHERE ta.TenantId <> c.TenantId;
```

Any rows returned here mean actual denormalization drift — a real bug, not a scoping misunderstanding.

### 1.12 Full-text search sanity check (Tasks title/description)

**Scenario:** Confirming whether a task should be matching the Task Grid's search box, independent of
the API layer.

```sql
SELECT Id, TaskNumber, Title
FROM Tasks
WHERE CONTAINS((Title, Description), '"budget*"') AND TenantId = @TenantId AND IsDeleted = 0;
```

If this returns nothing but you expect a match, check whether the full-text catalog
(`AuditFlowFullTextCatalog`) is populated/online — `SELECT * FROM sys.fulltext_catalogs;` — rather than
assuming the search term logic itself is wrong.

---

## 2. Auth screens (Sign In / Accept Invite / Forgot & Reset Password)

**Screens:** `SignInPage`, `AcceptInvitePage`, `ForgotPasswordPage`, `ResetPasswordPage`
**Tables:** `Users`, `RefreshTokens`, `Invitations`, `AuditLogs`

### 2.1 Why is login failing? (lockout / confirmation / status)

```sql
SELECT Email,
    CASE Status WHEN 1 THEN 'Invited' WHEN 2 THEN 'Active' WHEN 3 THEN 'Deactivated' END AS Status,
    EmailConfirmed, LockoutEnabled, LockoutEnd, AccessFailedCount, MfaEnabled
FROM Users
WHERE Email = 'user@example.com' AND IsDeleted = 0;
```

`AccessFailedCount >= 5` with `LockoutEnd` in the future = locked out (5 attempts / 15 min, per the
documented policy). `Status = 1` (Invited, never activated) means they haven't accepted their invite
yet — that's an Accept-Invite problem, not a login bug.

### 2.2 Recent login/logout events for a user

```sql
SELECT al.CreatedAt, CASE al.Action WHEN 17 THEN 'Login' WHEN 18 THEN 'Logout' END AS Event, al.IpAddress, al.UserAgent
FROM AuditLogs al
WHERE al.UserId = @UserId AND al.Action IN (17, 18)
ORDER BY al.CreatedAt DESC;
```

### 2.3 Validate an invite token (Accept-Invite page)

```sql
SELECT Email, FullName,
    CASE Role WHEN 1 THEN 'PlatformAdmin' WHEN 2 THEN 'Auditor' WHEN 3 THEN 'CompanyAdmin' WHEN 4 THEN 'Employee' END AS Role,
    CASE Status WHEN 1 THEN 'Pending' WHEN 2 THEN 'Accepted' WHEN 3 THEN 'Expired' WHEN 4 THEN 'Revoked' END AS Status,
    ExpiresAt, Token
FROM Invitations
WHERE Token = @TokenFromUrl AND IsDeleted = 0;
```

A "this invite link is invalid" complaint is almost always `Status <> 1` or `ExpiresAt < GETUTCDATE()`
here — confirm before assuming a frontend routing bug.

---

## 3. Dashboard — Standard (`DashboardPage`, standard view)

**Tables:** `Tasks`, `Users`, `Companies`, `Notifications`, `Announcements` (read-only aggregates —
Dashboard writes nothing).

### 3.1 Reproduce the summary tiles (open/overdue/resolved counts) for one user's scope

```sql
SELECT
    SUM(CASE WHEN Status = 1 THEN 1 ELSE 0 END) AS OpenCount,
    SUM(CASE WHEN Status = 2 THEN 1 ELSE 0 END) AS InProgressCount,
    SUM(CASE WHEN Status = 3 THEN 1 ELSE 0 END) AS ResolvedCount,
    SUM(CASE WHEN Status = 4 THEN 1 ELSE 0 END) AS ClosedCount,
    SUM(CASE WHEN Status IN (1,2) AND DueDate < GETUTCDATE() THEN 1 ELSE 0 END) AS OverdueCount  -- synthetic client status, computed the same way here
FROM Tasks
WHERE TenantId = @TenantId
  AND AssignedToUserId = @UserId   -- drop this line for an Auditor/CompanyAdmin scope instead of Employee
  AND IsDeleted = 0;
```

Remember `"overdue"` is never a stored value — it's always `Status IN (Open, InProgress) AND DueDate <
now`, recomputed on read both server- and client-side. If the dashboard shows an overdue count that
doesn't match this query, the discrepancy is in *when* each side evaluates "now," not the underlying data.

### 3.2 Upcoming deadlines widget

```sql
SELECT TaskNumber, Title, DueDate,
    CASE Priority WHEN 1 THEN 'Low' WHEN 2 THEN 'Medium' WHEN 3 THEN 'High' WHEN 4 THEN 'Critical' END AS Priority
FROM Tasks
WHERE TenantId = @TenantId AND AssignedToUserId = @UserId
  AND Status IN (1,2) AND DueDate BETWEEN GETUTCDATE() AND DATEADD(DAY, 7, GETUTCDATE())
  AND IsDeleted = 0
ORDER BY DueDate ASC;
```

### 3.3 Recent activity widget

```sql
SELECT TOP 20 al.CreatedAt, al.EntityType, al.Action, u.Email AS ActorEmail
FROM AuditLogs al
LEFT JOIN Users u ON u.Id = al.UserId
WHERE al.TenantId = @TenantId
ORDER BY al.CreatedAt DESC;
```

### 3.4 Active announcements a user should be seeing

```sql
SELECT a.Title, a.Content, a.StartsAt, a.ExpiresAt, a.IsPinned, a.TargetCompanyId
FROM Announcements a
WHERE a.TenantId = @TenantId
  AND a.IsActive = 1
  AND a.StartsAt <= GETUTCDATE() AND (a.ExpiresAt IS NULL OR a.ExpiresAt >= GETUTCDATE())
  AND (a.TargetCompanyId IS NULL OR a.TargetCompanyId = @UserCompanyId)  -- NULL = tenant-wide
  AND a.IsDeleted = 0
ORDER BY a.IsPinned DESC, a.StartsAt DESC;
```

If a company-targeted announcement isn't showing for a user, check `TargetCompanyId` matches their
`CompanyId` exactly — there's no sub-company-level targeting, only company-level or tenant-wide.

---

## 4. Dashboard — Executive suite (Auditor-only, same page as §3)

**Tables:** `Tasks`, `Companies`, `Users`. Backed by a 60-second in-process cache (`IMemoryCache`,
keyed per-user+filters) — **a task edit can take up to 60s to show up here**, so if a number looks
stale, re-check after a minute before assuming a data bug (see `PROJECT_CONTEXT.md` known gaps).

### 4.1 KPI tile validation

```sql
SELECT
    COUNT(*) AS TotalTasks,
    SUM(CASE WHEN Status = 4 THEN 1 ELSE 0 END) AS ClosedTasks,
    AVG(CASE WHEN Status = 4 AND ClosedAt IS NOT NULL THEN DATEDIFF(HOUR, CreatedAt, ClosedAt) END) AS AvgResolutionHours,
    SUM(CASE WHEN Status IN (1,2) AND DueDate < GETUTCDATE() THEN 1 ELSE 0 END) AS OverdueTasks
FROM Tasks
WHERE TenantId = @TenantId AND IsDeleted = 0
  AND CreatedAt BETWEEN @RangeStart AND @RangeEnd;
```

### 4.2 Company health breakdown

```sql
SELECT c.Name AS CompanyName,
    COUNT(ta.Id) AS TotalTasks,
    SUM(CASE WHEN ta.Status IN (1,2) AND ta.DueDate < GETUTCDATE() THEN 1 ELSE 0 END) AS OverdueTasks,
    SUM(CASE WHEN ta.Priority = 4 THEN 1 ELSE 0 END) AS CriticalTasks
FROM Companies c
LEFT JOIN Tasks ta ON ta.CompanyId = c.Id AND ta.IsDeleted = 0
WHERE c.TenantId = @TenantId AND c.IsDeleted = 0
GROUP BY c.Name
ORDER BY OverdueTasks DESC;
```

### 4.3 Team workload

```sql
SELECT u.FullName, u.Email,
    SUM(CASE WHEN ta.Status IN (1,2) THEN 1 ELSE 0 END) AS OpenAssignedTasks,
    SUM(CASE WHEN ta.Status IN (1,2) AND ta.DueDate < GETUTCDATE() THEN 1 ELSE 0 END) AS OverdueAssignedTasks
FROM Users u
LEFT JOIN Tasks ta ON ta.AssignedToUserId = u.Id AND ta.IsDeleted = 0
WHERE u.TenantId = @TenantId AND u.IsDeleted = 0 AND u.Role = 4  -- Employee
GROUP BY u.FullName, u.Email
ORDER BY OpenAssignedTasks DESC;
```

### 4.4 High-risk tasks list (overdue + high/critical priority)

```sql
SELECT ta.TaskNumber, ta.Title, c.Name AS CompanyName, u.FullName AS AssignedTo, ta.DueDate,
    CASE ta.Priority WHEN 3 THEN 'High' WHEN 4 THEN 'Critical' END AS Priority
FROM Tasks ta
JOIN Companies c ON c.Id = ta.CompanyId
LEFT JOIN Users u ON u.Id = ta.AssignedToUserId
WHERE ta.TenantId = @TenantId AND ta.IsDeleted = 0
  AND ta.Priority IN (3,4) AND ta.Status IN (1,2) AND ta.DueDate < GETUTCDATE()
ORDER BY ta.DueDate ASC;
```

---

## 5. Task Grid (`TaskGridPage`, week/all modes)

**Tables:** `Tasks`, `Companies`, `SubCompanies`, `Users`

### 5.1 Reproduce the grid's default query (filter by company + status, newest first)

This mirrors the composite index `(CompanyId, Status, CreatedAt DESC)` the grid is built around —
useful for confirming a task's absence isn't a pagination/sort artifact.

```sql
SELECT TaskNumber, Title,
    CASE Status WHEN 1 THEN 'Open' WHEN 2 THEN 'InProgress' WHEN 3 THEN 'Resolved' WHEN 4 THEN 'Closed' WHEN 5 THEN 'Reopened' END AS Status,
    CASE Priority WHEN 1 THEN 'Low' WHEN 2 THEN 'Medium' WHEN 3 THEN 'High' WHEN 4 THEN 'Critical' END AS Priority,
    DueDate, CreatedAt
FROM Tasks
WHERE TenantId = @TenantId AND CompanyId = @CompanyId AND IsDeleted = 0
  AND (@StatusFilter IS NULL OR Status = @StatusFilter)
ORDER BY CreatedAt DESC;
```

### 5.2 "Week" mode — tasks due this week

```sql
SELECT TaskNumber, Title, DueDate, AssignedToUserId
FROM Tasks
WHERE TenantId = @TenantId AND IsDeleted = 0
  AND DueDate BETWEEN @WeekStart AND @WeekEnd;
```

### 5.3 Why can't Employee X see task Y? (assignee scoping)

```sql
SELECT Id, TaskNumber, AssignedToUserId, CreatedByUserId, CompanyId
FROM Tasks
WHERE Id = @TaskId;
```

For an Employee, the server silently overrides any filter to `AssignedToUserId = <their own id>` — if
`AssignedToUserId` doesn't match the Employee in question, this is correct/expected behavior, not a
bug, no matter what `CreatedByUserId` says.

### 5.4 Task counts per status (used for grid tab badges)

```sql
SELECT
    CASE Status WHEN 1 THEN 'Open' WHEN 2 THEN 'InProgress' WHEN 3 THEN 'Resolved' WHEN 4 THEN 'Closed' WHEN 5 THEN 'Reopened' END AS Status,
    COUNT(*) AS Count
FROM Tasks
WHERE TenantId = @TenantId AND CompanyId = @CompanyId AND IsDeleted = 0
GROUP BY Status;
```

---

## 6. Task Create & Bulk Create (`TaskCreatePage`, `TaskBulkCreatePage`)

**Tables:** `Tasks`, `TaskStatusHistories`, `Companies`, `SubCompanies`, `Users`, `AuditLogs`

### 6.1 Confirm a newly created task landed correctly (single create)

```sql
SELECT TaskNumber, Title, Status, Priority, CompanyId, SubCompanyId, AssignedToUserId, CreatedByUserId, DueDate, CreatedAt
FROM Tasks
WHERE TaskNumber = 'TSK-20260815-ABCD1234';
```

`Status` should be `1` (Open) on every fresh create — anything else on a brand-new task points at a
handler bug, not a data issue.

### 6.2 Every task created in one bulk-import batch

**Scenario:** "Some rows from my CSV/Excel upload didn't make it in." Bulk import is non-blocking
per-row, so a partial batch is expected — this confirms exactly which rows landed.

```sql
SELECT ta.TaskNumber, ta.Title, ta.CreatedAt
FROM Tasks ta
WHERE ta.TenantId = @TenantId AND ta.CreatedByUserId = @UserId
  AND ta.CreatedAt BETWEEN @UploadStartedAt AND DATEADD(MINUTE, 2, @UploadStartedAt)
ORDER BY ta.CreatedAt;
```

Cross-check against the `BulkImport` audit-log entry for the row-level success/failure detail the
grid itself won't show after the fact:

```sql
SELECT al.CreatedAt, al.NewValuesJson, al.MetadataJson
FROM AuditLogs al
WHERE al.TenantId = @TenantId AND al.Action = 16   -- BulkImport
  AND al.UserId = @UserId
ORDER BY al.CreatedAt DESC;
```

### 6.3 Confirm the opening `TaskStatusHistory` row exists

Every task should have exactly one history row from its creation (`FromStatus IS NULL`,
`ToStatus = 1`), appended automatically inside `TaskItem.UpdateStatus()`/creation — not a separate
handler call, so its absence points at something unusual.

```sql
SELECT TaskId, FromStatus, ToStatus, ChangedByUserId, Reason, CreatedAt
FROM TaskStatusHistories
WHERE TaskId = @TaskId
ORDER BY CreatedAt ASC;
```

---

## 7. Task Details (`TaskDetailsPage` — Overview / Comments / Documents / Timeline tabs)

**Tables:** `Tasks`, `Comments`, `Attachments`, `TaskStatusHistories`, `Notifications`

### 7.1 Overview tab — full task record

```sql
SELECT ta.*, c.Name AS CompanyName, sc.Name AS SubCompanyName,
    assignee.FullName AS AssignedToName, creator.FullName AS CreatedByName, closer.FullName AS ClosedByName
FROM Tasks ta
JOIN Companies c ON c.Id = ta.CompanyId
LEFT JOIN SubCompanies sc ON sc.Id = ta.SubCompanyId
LEFT JOIN Users assignee ON assignee.Id = ta.AssignedToUserId
LEFT JOIN Users creator ON creator.Id = ta.CreatedByUserId
LEFT JOIN Users closer ON closer.Id = ta.ClosedByUserId
WHERE ta.TaskNumber = 'TSK-20260815-ABCD1234' AND ta.IsDeleted = 0;
```

### 7.2 Timeline tab — full status history

```sql
SELECT h.CreatedAt,
    CASE h.FromStatus WHEN 1 THEN 'Open' WHEN 2 THEN 'InProgress' WHEN 3 THEN 'Resolved' WHEN 4 THEN 'Closed' WHEN 5 THEN 'Reopened' END AS FromStatus,
    CASE h.ToStatus WHEN 1 THEN 'Open' WHEN 2 THEN 'InProgress' WHEN 3 THEN 'Resolved' WHEN 4 THEN 'Closed' WHEN 5 THEN 'Reopened' END AS ToStatus,
    u.FullName AS ChangedBy, h.Reason
FROM TaskStatusHistories h
JOIN Users u ON u.Id = h.ChangedByUserId
WHERE h.TaskId = @TaskId
ORDER BY h.CreatedAt ASC;
```

A `Reopened` transition (`ToStatus = 5`) with a blank/null `Reason` would violate the "mandatory
reason on reopen" business rule — that's a validator-bypass bug if you ever see one.

### 7.3 Comments tab — thread including replies

```sql
SELECT cm.Id, cm.ParentCommentId, cm.Content, cm.IsEdited, cm.EditedAt, cm.CreatedAt, u.FullName AS Author
FROM Comments cm
JOIN Users u ON u.Id = cm.AuthorId
WHERE cm.TaskId = @TaskId AND cm.IsDeleted = 0
ORDER BY cm.CreatedAt ASC;
```

`ParentCommentId IS NULL` = top-level comment; non-null = a reply (only one level of nesting is
supported, so a reply's own `ParentCommentId` should never point at another reply).

### 7.4 Documents tab — attachments on the task itself vs. on comments

**Scenario:** the "creation-vs-Documents-tab split" — an attachment can belong to the `Task` directly
or to one of its `Comments`; the Documents tab is specifically task-level attachments, not everything.

```sql
-- Task-level attachments (what the Documents tab shows)
SELECT at.FileName, at.ContentType, at.FileSize, at.Version, at.PreviousVersionId, u.FullName AS UploadedBy, at.CreatedAt
FROM Attachments at
JOIN Users u ON u.Id = at.UploadedByUserId
WHERE at.TaskId = @TaskId AND at.CommentId IS NULL AND at.IsDeleted = 0
ORDER BY at.CreatedAt DESC;

-- Comment-level attachments (shown inline in the Comments tab instead)
SELECT at.FileName, at.CommentId, u.FullName AS UploadedBy, at.CreatedAt
FROM Attachments at
JOIN Users u ON u.Id = at.UploadedByUserId
WHERE at.TaskId = @TaskId AND at.CommentId IS NOT NULL AND at.IsDeleted = 0
ORDER BY at.CreatedAt DESC;
```

### 7.5 Attachment version chain (re-upload history for one file)

```sql
WITH VersionChain AS (
    SELECT Id, FileName, Version, PreviousVersionId, CreatedAt
    FROM Attachments WHERE Id = @LatestAttachmentId
    UNION ALL
    SELECT a.Id, a.FileName, a.Version, a.PreviousVersionId, a.CreatedAt
    FROM Attachments a JOIN VersionChain vc ON a.Id = vc.PreviousVersionId
)
SELECT * FROM VersionChain ORDER BY Version DESC;
```

### 7.6 Notifications fired for this task (assignment/status/comment alerts)

```sql
SELECT n.CreatedAt,
    CASE n.Type WHEN 1 THEN 'TaskAssigned' WHEN 2 THEN 'TaskStatusChanged' WHEN 3 THEN 'TaskCommented' WHEN 4 THEN 'TaskReopened' WHEN 5 THEN 'TaskClosed' END AS Type,
    recipient.Email AS RecipientEmail, actor.Email AS ActorEmail, n.IsRead
FROM Notifications n
JOIN Users recipient ON recipient.Id = n.UserId
LEFT JOIN Users actor ON actor.Id = n.ActorUserId
WHERE n.TaskId = @TaskId
ORDER BY n.CreatedAt DESC;
```

If a status change/comment happened but no row shows here, that's a `Notifications`/`INotificationService`
bug, not a UI bug — the write should be atomic with the task/comment change (see §6 of
`ArchitectureFlow.md`, "cross-module side effects").

---

## 8. My Checklist (`ChecklistPage` — "My Checklist" / "Team Activity")

**Table:** `ChecklistItems` (fully separate from `Tasks` — no assignor/assignee, everyone manages only
their own). `GET /checklist` also merges in the user's assigned Tasks that have a due date — that half
comes from `Tasks`, not this table, so check §5/§7 too if a task-sourced row looks wrong.

### 8.1 A user's own checklist items

```sql
SELECT ci.Title, ci.Description,
    CASE ci.RecurrenceType WHEN 1 THEN 'OneTime' WHEN 2 THEN 'Daily' WHEN 3 THEN 'Weekly' WHEN 4 THEN 'Monthly' END AS Recurrence,
    CASE ci.Status WHEN 1 THEN 'Pending' WHEN 2 THEN 'InProgress' WHEN 3 THEN 'Completed' END AS Status,
    ci.DueDate, ci.CompletedAt, ci.ParentTemplateId
FROM ChecklistItems ci
WHERE ci.UserId = @UserId AND ci.IsDeleted = 0
ORDER BY ci.DueDate ASC;
```

### 8.2 Recurring-item template vs. its generated occurrences

**Scenario:** "My daily checklist item stopped generating new occurrences." A template row has
`RecurrenceType <> OneTime` and `ParentTemplateId IS NULL`; each day's occurrence is a separate row
pointing back at it via `ParentTemplateId`, produced by `ChecklistRecurrenceBackgroundService` (runs
once daily, in-process — not Hangfire).

```sql
-- The template itself
SELECT Id, Title, RecurrenceType, DueDate AS FirstOccurrenceDueDate
FROM ChecklistItems
WHERE Id = @TemplateId AND ParentTemplateId IS NULL;

-- Every occurrence generated from it
SELECT Id, DueDate, Status, CreatedAt
FROM ChecklistItems
WHERE ParentTemplateId = @TemplateId AND IsDeleted = 0
ORDER BY DueDate DESC;
```

If the most recent occurrence's `DueDate` is more than one recurrence-period old, the background
service likely didn't run (check API host uptime around that date) rather than a per-item bug.

### 8.3 Team Activity view (Auditor/Company admin only — per-person aggregate)

```sql
SELECT u.FullName,
    SUM(CASE WHEN ci.Status = 1 THEN 1 ELSE 0 END) AS Pending,
    SUM(CASE WHEN ci.Status = 2 THEN 1 ELSE 0 END) AS InProgress,
    SUM(CASE WHEN ci.Status = 3 THEN 1 ELSE 0 END) AS Completed,
    SUM(CASE WHEN ci.DueDate < GETUTCDATE() AND ci.Status <> 3 THEN 1 ELSE 0 END) AS Overdue
FROM Users u
LEFT JOIN ChecklistItems ci ON ci.UserId = u.Id AND ci.IsDeleted = 0
WHERE u.TenantId = @TenantId AND u.CompanyId = @CompanyId AND u.IsDeleted = 0
GROUP BY u.FullName;
```

Same `ITenantScopeService` scoping as everywhere else applies here — a Company admin only ever sees
their own company's users, regardless of what's passed from the client.

---

## 9. Reports (`ReportsPage`)

**Tables:** `Tasks` (source data), `Reports` (export job tracking — see §1.10 for job-status queries)

### 9.1 Reproduce a filtered export's row count (sync vs. async threshold check)

**Scenario:** "Why did my export queue instead of downloading immediately?" — the sync/async split is
purely row-count-based (>10,000 rows → async/Hangfire).

```sql
SELECT COUNT(*) AS MatchingRowCount
FROM Tasks
WHERE TenantId = @TenantId AND IsDeleted = 0
  AND (@CompanyId IS NULL OR CompanyId = @CompanyId)
  AND (@Status IS NULL OR Status = @Status)
  AND CreatedAt BETWEEN @RangeStart AND @RangeEnd;
```

### 9.2 A specific report job's parameters (what filters were actually applied)

```sql
SELECT Name, ParametersJson, TotalRecords, StoragePath, ErrorMessage
FROM Reports
WHERE Id = @ReportId;
```

`ParametersJson` is the serialized filter set the export actually ran with — compare it against what
the user says they selected on screen if the row count looks wrong.

---

## 10. Company Management & Company Form (`CompanyManagementPage`, `CompanyFormPage`)

**Tables:** `Companies`, `SubCompanies`

### 10.1 Company list as the page would show it, with live task/user counts

```sql
SELECT c.Id, c.Name, c.Industry,
    CASE c.Status WHEN 1 THEN 'Active' WHEN 2 THEN 'Inactive' WHEN 3 THEN 'Onboarding' END AS Status,
    c.OnboardedAt,
    (SELECT COUNT(*) FROM Users WHERE CompanyId = c.Id AND IsDeleted = 0) AS UserCount,
    (SELECT COUNT(*) FROM Tasks WHERE CompanyId = c.Id AND IsDeleted = 0) AS TaskCount
FROM Companies c
WHERE c.TenantId = @TenantId AND c.IsDeleted = 0
ORDER BY c.Name;
```

> Remember a mapped Auditor's company dropdown/list is further filtered to `UserCompanyMappings` —
> see §1.2 before assuming a company "missing from the list" is a data bug.

### 10.2 SubCompanies for one company (edit-form's sync target)

**Scenario:** the frontend has no bulk "replace all sub-companies" endpoint — edits diff client-side
and call add/update/delete individually, so a partial save is possible if one call in the sequence
fails.

```sql
SELECT Id, Name, Description, IsActive, CreatedAt, UpdatedAt
FROM SubCompanies
WHERE CompanyId = @CompanyId AND IsDeleted = 0
ORDER BY Name;
```

### 10.3 Why won't this Company delete?

**Scenario:** delete cascades to `SubCompanies` at the DB level, but `Users`/`Tasks` FKs are `Restrict`
— those must be dealt with first or the delete fails at the database.

```sql
SELECT
    (SELECT COUNT(*) FROM Users WHERE CompanyId = @CompanyId AND IsDeleted = 0) AS ActiveUsers,
    (SELECT COUNT(*) FROM Tasks WHERE CompanyId = @CompanyId AND IsDeleted = 0) AS ActiveTasks;
```

Non-zero on either means the delete will (correctly) fail until those rows are reassigned/removed.

---

## 11. User Management & Invite User (`UserManagementPage`, `InviteUserPage`)

**Tables:** `Users`, `Invitations`, `UserCompanyMappings`

### 11.1 User list as the page would show it

```sql
SELECT u.Id, u.FullName, u.Email,
    CASE u.Role WHEN 1 THEN 'PlatformAdmin' WHEN 2 THEN 'Auditor' WHEN 3 THEN 'CompanyAdmin' WHEN 4 THEN 'Employee' END AS Role,
    CASE u.Status WHEN 1 THEN 'Invited' WHEN 2 THEN 'Active' WHEN 3 THEN 'Deactivated' END AS Status,
    c.Name AS CompanyName, sc.Name AS SubCompanyName, mgr.FullName AS ReportingManager, u.ExternalReportingManagerEmail
FROM Users u
LEFT JOIN Companies c ON c.Id = u.CompanyId
LEFT JOIN SubCompanies sc ON sc.Id = u.SubCompanyId
LEFT JOIN Users mgr ON mgr.Id = u.ReportingManagerId
WHERE u.TenantId = @TenantId AND u.IsDeleted = 0
  AND (@CompanyId IS NULL OR u.CompanyId = @CompanyId)   -- CompanyAdmin's own scope, applied server-side
ORDER BY u.FullName;
```

### 11.2 Confirm an Auditor invite also created its `UserCompanyMapping` row

**Scenario:** an invited Auditor should always get mapped to the company chosen on the invite form —
if that row is missing, the Auditor ends up effectively "unmapped" (unrestricted within tenant) instead
of scoped the way the inviter intended.

```sql
SELECT i.Email, i.CompanyId AS InvitedForCompanyId, ucm.CompanyId AS MappedCompanyId, ucm.Id AS MappingRowId
FROM Invitations i
LEFT JOIN Users u ON u.Email = i.Email AND u.TenantId = i.TenantId
LEFT JOIN UserCompanyMappings ucm ON ucm.UserId = u.Id AND ucm.CompanyId = i.CompanyId
WHERE i.Email = 'newauditor@example.com' AND i.Role = 2;   -- Role 2 = Auditor
```

`MappingRowId IS NULL` after acceptance = the mapping never got created — a real handler bug, not a
scoping quirk.

### 11.3 Reporting-manager chain for one user (potential-managers list source)

```sql
SELECT u.FullName AS Employee, mgr.FullName AS Manager, mgr.Role AS ManagerRole
FROM Users u
LEFT JOIN Users mgr ON mgr.Id = u.ReportingManagerId
WHERE u.Id = @UserId;
```

---

## 12. Notifications Page (`NotificationsPage`, Topbar bell)

**Table:** `Notifications`

### 12.1 Full notification inbox for a user

```sql
SELECT n.Title, n.Message,
    CASE n.Type WHEN 1 THEN 'TaskAssigned' WHEN 2 THEN 'TaskStatusChanged' WHEN 3 THEN 'TaskCommented' WHEN 4 THEN 'TaskReopened'
        WHEN 5 THEN 'TaskClosed' WHEN 6 THEN 'MentionedInComment' WHEN 7 THEN 'InvitationReceived' WHEN 8 THEN 'Announcement' WHEN 9 THEN 'ReportReady' END AS Type,
    CASE n.Channel WHEN 1 THEN 'InApp' WHEN 2 THEN 'Email' WHEN 3 THEN 'Both' END AS Channel,
    n.IsRead, n.ReadAt, n.CreatedAt, n.TaskId
FROM Notifications n
WHERE n.UserId = @UserId AND n.IsDeleted = 0
ORDER BY n.CreatedAt DESC;
```

### 12.2 A user's notification preferences (why they aren't getting emails)

```sql
SELECT Email, EmailNotificationsEnabled, InAppNotificationsEnabled, DailyDigestEnabled
FROM Users
WHERE Id = @UserId;
```

`EmailNotificationsEnabled = 0` explains missing emails even when the in-app `Notifications` row exists
correctly — the row's `Channel` value reflects intent, not necessarily actual delivery, since instant
emails from Task events are a known gap (only the daily digest reliably fires — see
`PROJECT_CONTEXT.md` known gaps).

---

## 13. Profile Page (`ProfilePage`)

**Table:** `Users`

### 13.1 A user's current profile/preference state

```sql
SELECT FullName, Email, PhoneNumber, Theme, EmailNotificationsEnabled, InAppNotificationsEnabled,
    DailyDigestEnabled, MfaEnabled, LastLoginAt
FROM Users
WHERE Id = @UserId;
```

Note: full-name self-service editing is a known gap — if `FullName` looks wrong, it was set at
invite/creation time, not via a profile edit the user performed themselves.

---

## 14. Platform Admin — Tenant List / Create Tenant / Tenant Detail (`PlatformAdminPages.tsx`)

**Tables:** `Tenants`, plus cross-tenant aggregates over `Companies`/`Users`

### 14.1 Tenant list as the page would show it

```sql
SELECT t.Id, t.Name, t.Domain, t.Plan,
    CASE t.Status WHEN 1 THEN 'Onboarding' WHEN 2 THEN 'Active' WHEN 3 THEN 'Suspended' WHEN 4 THEN 'Cancelled' END AS Status,
    t.PrimaryContactEmail, t.TrialEndsAt, t.SubscriptionEndsAt,
    (SELECT COUNT(*) FROM Users WHERE TenantId = t.Id AND IsDeleted = 0) AS UserCount
FROM Tenants t
WHERE t.IsDeleted = 0
ORDER BY t.CreatedAt DESC;
```

### 14.2 Tenant Detail — full drill-down for one Auditor Account

```sql
SELECT * FROM Tenants WHERE Id = @TenantId;

SELECT Id, Name, Status FROM Companies WHERE TenantId = @TenantId AND IsDeleted = 0;

SELECT Id, FullName, Email, Role, Status FROM Users WHERE TenantId = @TenantId AND IsDeleted = 0;
```

### 14.3 Status-transition history for a tenant (Onboarding→Active, Active↔Suspended)

Tenants themselves don't have their own status-history table — reconstruct from `AuditLogs`:

```sql
SELECT al.CreatedAt, al.OldValuesJson, al.NewValuesJson, u.Email AS ChangedByEmail
FROM AuditLogs al
LEFT JOIN Users u ON u.Id = al.UserId
WHERE al.EntityType = 'Tenant' AND al.EntityId = @TenantId AND al.Action = 2   -- Updated
ORDER BY al.CreatedAt DESC;
```

---

## 15. Platform Admin — System Overview (`SystemOverviewPage`)

**Tables:** cross-tenant aggregates; raw SQL against `sys.master_files`/`msdb.dbo.backupset` for health.

### 15.1 Platform-wide counts (mirrors the health/overview tiles)

```sql
SELECT
    (SELECT COUNT(*) FROM Tenants WHERE IsDeleted = 0) AS TotalTenants,
    (SELECT COUNT(*) FROM Tenants WHERE IsDeleted = 0 AND Status = 2) AS ActiveTenants,
    (SELECT COUNT(*) FROM Companies WHERE IsDeleted = 0) AS TotalCompanies,
    (SELECT COUNT(*) FROM Users WHERE IsDeleted = 0) AS TotalUsers,
    (SELECT COUNT(*) FROM Tasks WHERE IsDeleted = 0) AS TotalTasks;
```

### 15.2 Database size (what backs the live-queried tile)

```sql
SELECT DB_NAME() AS DatabaseName,
    SUM(size) * 8.0 / 1024 AS SizeMB
FROM sys.master_files
WHERE database_id = DB_ID();
```

`lastBackupAt` on this screen is a **known placeholder**, not a live query — don't treat a stale/blank
value there as a bug to chase.

---

## 16. Platform Admin — Audit Log (`AuditLogPage`)

**Table:** `AuditLogs` (platform-wide, cross-tenant — Platform admin queries use `IgnoreQueryFilters()`
to see past their own `TenantId = null`)

### 16.1 Reproduce the Audit Log page's filtered view

```sql
SELECT al.CreatedAt, t.Name AS TenantName, al.EntityType, al.EntityId,
    CASE al.Action WHEN 1 THEN 'Created' WHEN 2 THEN 'Updated' WHEN 3 THEN 'Deleted' WHEN 4 THEN 'StatusChanged'
        WHEN 5 THEN 'Assigned' WHEN 9 THEN 'UserInvited' WHEN 17 THEN 'Login' WHEN 18 THEN 'Logout'
        WHEN 22 THEN 'Impersonation' END AS ActionName,
    u.Email AS ActorEmail, al.IpAddress
FROM AuditLogs al
LEFT JOIN Tenants t ON t.Id = al.TenantId
LEFT JOIN Users u ON u.Id = al.UserId
WHERE (@TenantId IS NULL OR al.TenantId = @TenantId)
  AND (@Action IS NULL OR al.Action = @Action)
  AND al.CreatedAt BETWEEN @RangeStart AND @RangeEnd
ORDER BY al.CreatedAt DESC;
```

### 16.2 Impersonation events specifically (support tool audit)

```sql
SELECT al.CreatedAt, admin.Email AS PlatformAdminEmail, al.MetadataJson, al.IpAddress
FROM AuditLogs al
JOIN Users admin ON admin.Id = al.UserId
WHERE al.Action = 22   -- Impersonation
ORDER BY al.CreatedAt DESC;
```

`MetadataJson` carries which tenant/account was impersonated — parse it (`OPENJSON`) if you need it as
a real column rather than eyeballing the JSON blob.

---

## 17. Quick index — screen → primary table(s)

| Screen | Primary table(s) | Section |
|---|---|---|
| Sign In / Accept Invite / Forgot/Reset Password | `Users`, `Invitations`, `RefreshTokens` | §2 |
| Dashboard (Standard) | `Tasks`, `Announcements` | §3 |
| Dashboard (Executive) | `Tasks`, `Companies`, `Users` | §4 |
| Task Grid | `Tasks` | §5 |
| Task Create / Bulk Create | `Tasks`, `TaskStatusHistories` | §6 |
| Task Details | `Tasks`, `Comments`, `Attachments`, `TaskStatusHistories`, `Notifications` | §7 |
| My Checklist / Team Activity | `ChecklistItems` | §8 |
| Reports | `Tasks`, `Reports` | §9 |
| Company Management / Company Form | `Companies`, `SubCompanies` | §10 |
| User Management / Invite User | `Users`, `Invitations`, `UserCompanyMappings` | §11 |
| Notifications | `Notifications` | §12 |
| Profile | `Users` | §13 |
| Admin: Tenant List/Detail | `Tenants` | §14 |
| Admin: System Overview | cross-tenant aggregates | §15 |
| Admin: Audit Log | `AuditLogs` | §16 |
