# AuditFlow Backend API Specification

**Version:** 1.0  
**Generated from:** Mockup screens + Product Blueprint  
**Total Endpoints:** ~85

---

## 1. Authentication & Authorization

| Screen | Endpoint | Method | Description | Roles |
|--------|----------|--------|-------------|-------|
| Sign In | `/api/auth/login` | POST | Email/password login, returns JWT + refresh token | All |
| Sign In | `/api/auth/refresh` | POST | Refresh access token using refresh token | All |
| Sign In | `/api/auth/forgot-password` | POST | Request password reset email | All |
| Sign In | `/api/auth/reset-password` | POST | Reset password with token | All |
| Accept Invite | `/api/invites/validate/{token}` | GET | Validate invite token, return invite details | Public |
| Accept Invite | `/api/invites/accept` | POST | Set password, activate account | Public |
| MFA | `/api/auth/mfa/setup` | POST | Setup TOTP MFA | All |
| MFA | `/api/auth/mfa/verify` | POST | Verify MFA code | All |

---

## 2. Dashboard (Performance Critical - Complex Queries)

| Screen | Endpoint | Method | Description | Performance Notes |
|--------|----------|--------|-------------|-------------------|
| Standard | `/api/dashboard/summary` | GET | KPIs: overdue, open, in-progress, closed-this-week counts | Pre-aggregated materialized view, refresh every 5 min |
| Standard | `/api/dashboard/weekly-tasks` | GET | This week's tasks (paginated, filtered by user scope) | Indexed on `CreatedAt`, `AssignedToUserId`, `CompanyId` |
| Standard | `/api/dashboard/status-breakdown` | GET | Donut chart data: Open/InProgress/Overdue/Closed counts | Same materialized view as summary |
| Standard | `/api/dashboard/announcements` | GET | Active auditor announcements for user's companies | Cached, invalidated on new announcement |
| Executive | `/api/dashboard/executive/kpis` | GET | Total tasks, closure rate, avg time to close, at-risk count | Materialized view per auditor+company scope |
| Executive | `/api/dashboard/executive/trend` | GET | Created vs Closed trend (last 8 weeks, filterable) | Pre-aggregated weekly buckets, filtered by CompanyId |
| Executive | `/api/dashboard/executive/status-mix` | GET | Status distribution donut | Same as standard but broader scope |
| Executive | `/api/dashboard/executive/company-health` | GET | Per-company: task count, overdue count, closure % | Indexed view on Company + Status + DueDate |
| Executive | `/api/dashboard/executive/risk-tasks` | GET | Top overdue tasks across portfolio | Indexed on DueDate + Status WHERE Overdue |
| Executive | `/api/dashboard/executive/team-workload` | GET | Open tasks per assignee | Group by AssignedToUserId, filtered by scope |

**Query Parameters for Executive Dashboard (all filterable):**
```
?companyId=&subCompanyId=&status=&dateRange=last8weeks&assigneeId=
```

---

## 3. Task Management

| Screen | Endpoint | Method | Description | Roles |
|--------|----------|--------|-------------|-------|
| Task Grid | `/api/tasks` | GET | Paginated, filterable, searchable task list | Auditor, CompanyAdmin, Employee |
| Task Grid | `/api/tasks/search` | GET | Autocomplete search by TaskId/Title (debounced) | Auditor, CompanyAdmin |
| Task Grid | `/api/tasks/filter-options` | GET | Distinct values for filter dropdowns | Auditor, CompanyAdmin |
| Task Grid (Full) | `/api/tasks` | GET | Same as above with `range=all` query param | Auditor |
| Create Task | `/api/tasks` | POST | Create new task with attachments | Auditor |
| Create Task | `/api/tasks/template` | GET | Download Excel template pre-filled with companies/sub-companies/users | Auditor |
| Create Task | `/api/tasks/validate-assignee` | GET | Validate assignee exists in selected company/sub-company | Auditor |
| Bulk Upload | `/api/tasks/bulk/validate` | POST | Upload Excel, validate rows, return preview (valid/invalid) | Auditor |
| Bulk Upload | `/api/tasks/bulk/import` | POST | Import validated rows, create tasks + notifications | Auditor |
| Task Details | `/api/tasks/{id}` | GET | Full task details: overview, comments, attachments, timeline | All (row-level filtered) |
| Task Details | `/api/tasks/{id}/comments` | GET | Paginated comments for task | All (row-level filtered) |
| Task Details | `/api/tasks/{id}/comments` | POST | Add comment (with optional attachment) | All (row-level filtered) |
| Task Details | `/api/tasks/{id}/status` | PATCH | Update status (Open→InProgress→Resolved→Closed/Reopen) | Auditor, Employee (assigned) |
| Task Details | `/api/tasks/{id}/assign` | PATCH | Reassign task (auditor only) | Auditor |
| Task Details | `/api/tasks/{id}/attachments` | POST | Upload attachment | Auditor, Employee (assigned) |
| Task Details | `/api/tasks/{id}/attachments/{attachmentId}` | DELETE | Delete attachment | Auditor, Employee (owner) |
| Task Details | `/api/tasks/{id}/timeline` | GET | Full audit timeline (immutable) | Auditor, CompanyAdmin |

---

## 4. Company Management

| Screen | Endpoint | Method | Description | Roles |
|--------|----------|--------|-------------|-------|
| Company List | `/api/companies` | GET | Paginated list of companies with sub-company counts, user counts | Auditor, CompanyAdmin (own) |
| Company List | `/api/companies/{id}/sub-companies` | GET | Sub-companies for a company | Auditor, CompanyAdmin |
| Create Company | `/api/companies` | POST | Create company + sub-companies in one transaction | Auditor |
| Create Company | `/api/companies/bulk-import` | POST | Bulk import sub-companies via CSV | Auditor |
| Manage Company | `/api/companies/{id}` | GET | Company details with all sub-companies | Auditor, CompanyAdmin |
| Manage Company | `/api/companies/{id}` | PATCH | Update company details | Auditor |
| Manage Company | `/api/companies/{id}/sub-companies` | POST | Add sub-company to existing company | Auditor |
| Manage Company | `/api/companies/{id}/sub-companies/{subId}` | PATCH | Update sub-company | Auditor |
| Manage Company | `/api/companies/{id}/sub-companies/{subId}` | DELETE | Delete sub-company (soft delete) | Auditor |

---

## 5. User Management

| Screen | Endpoint | Method | Description | Roles |
|--------|----------|--------|-------------|-------|
| User List | `/api/users` | GET | Paginated, filterable user list (role, company, status) | Auditor, CompanyAdmin (own company) |
| User List | `/api/users/filter-options` | GET | Distinct roles, companies, statuses for filters | Auditor, CompanyAdmin |
| Invite User | `/api/users/invite` | POST | Create user with Invited status, send invite email | Auditor, CompanyAdmin |
| Invite User | `/api/users/invite/validate-email` | GET | Check if email already exists | Auditor, CompanyAdmin |
| Invite User | `/api/users/managers` | GET | List potential reporting managers | Auditor, CompanyAdmin |
| User Actions | `/api/users/{id}/resend-invite` | POST | Resend activation link | Auditor, CompanyAdmin |
| User Actions | `/api/users/{id}/deactivate` | POST | Soft deactivate user | Auditor, CompanyAdmin |
| User Actions | `/api/users/{id}/activate` | POST | Reactivate deactivated user | Auditor, CompanyAdmin |
| User Actions | `/api/users/{id}` | PATCH | Update user (role, sub-company access, reporting manager) | Auditor, CompanyAdmin |
| User Details | `/api/users/{id}` | GET | User profile with company/sub-company mappings | Auditor, CompanyAdmin, Self |

---

## 6. Reports

| Screen | Endpoint | Method | Description | Performance |
|--------|----------|--------|-------------|-------------|
| Reports | `/api/reports/tasks` | GET | Filtered, paginated task report data | Indexed view, columnstore index |
| Reports | `/api/reports/tasks/export/excel` | GET | Stream Excel export (same filters) | Background job for >10k rows |
| Reports | `/api/reports/tasks/export/pdf` | GET | Generate PDF report (same filters) | Background job, return download URL |
| Reports | `/api/reports/filter-options` | GET | Distinct filter values for report builder | Cached |

**Report Filters:**
```
?companyId=&subCompanyId=&assigneeId=&status=&dateFrom=&dateTo=&search=
```

---

## 7. Notifications

| Screen | Endpoint | Method | Description |
|--------|----------|--------|-------------|
| Notification Center | `/api/notifications` | GET | Paginated in-app notifications (unread first) |
| Notification Center | `/api/notifications/unread-count` | GET | Unread count for bell badge |
| Notification Center | `/api/notifications/mark-read` | PATCH | Mark specific or all as read |
| Notification Center | `/api/notifications/preferences` | GET | User notification preferences |
| Notification Center | `/api/notifications/preferences` | PATCH | Update preferences (email, in-app, digest) |

---

## 8. Profile & Settings

| Screen | Endpoint | Method | Description |
|--------|----------|--------|-------------|
| Profile | `/api/users/me` | GET | Current user profile |
| Profile | `/api/users/me` | PATCH | Update profile (name, theme, preferences) |
| Profile | `/api/users/me/password` | POST | Change password |
| Profile | `/api/users/me/theme` | PATCH | Update theme (light/dark/system) |
| Profile | `/api/auth/logout` | POST | Invalidate refresh token |

---

## 9. Platform Admin (Separate API Base: `/api/admin`)

| Screen | Endpoint | Method | Description |
|--------|----------|--------|-------------|
| Auditor Accounts | `/api/admin/auditor-accounts` | GET | Paginated list of auditor firms |
| Auditor Accounts | `/api/admin/auditor-accounts` | POST | Create new auditor firm (tenant) |
| Auditor Accounts | `/api/admin/auditor-accounts/{id}` | GET | Firm details with companies, users, plan |
| Auditor Accounts | `/api/admin/auditor-accounts/{id}` | PATCH | Update firm (plan, status, contact) |
| Auditor Accounts | `/api/admin/auditor-accounts/{id}/impersonate` | POST | Generate impersonation token for support |
| System Health | `/api/admin/health` | GET | System metrics (tenants, users, tasks, DB size) |
| Audit Log | `/api/admin/audit-log` | GET | Immutable platform audit log (paginated, filterable) |

---

## 10. File Storage (Attachments)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/files/upload-url` | POST | Get presigned SAS URL for direct upload to Azure Blob/S3 |
| `/api/files/{fileId}` | GET | Download file (with auth check) |
| `/api/files/{fileId}` | DELETE | Delete file (soft) |

---

## Summary: Total API Endpoints ≈ 85

| Category | Count |
|----------|-------|
| Auth & Invites | 8 |
| Dashboard (Standard + Executive) | 10 |
| Task Management | 17 |
| Company Management | 8 |
| User Management | 10 |
| Reports | 4 |
| Notifications | 5 |
| Profile | 5 |
| Platform Admin | 7 |
| File Storage | 3 |
| **Total** | **~85** |

---

## Performance-Critical Endpoints (Require Special Optimization)

| Endpoint | Optimization Strategy |
|----------|----------------------|
| `GET /api/dashboard/summary` | Materialized view refreshed via pg_cron / Hangfire every 5 min |
| `GET /api/dashboard/executive/*` | Pre-aggregated weekly buckets in separate table, indexed by AuditorId+CompanyId |
| `GET /api/tasks` (paginated) | Composite index: `(CompanyId, Status, CreatedAt DESC)` + `AssignedToUserId` |
| `GET /api/tasks` (search) | PostgreSQL trigram index (pg_trgm) on Title + Description |
| `GET /api/reports/tasks` | Columnstore index (SQL Server) / TimescaleDB hypertable (PostgreSQL) |
| `GET /api/dashboard/executive/trend` | Pre-computed weekly aggregates per company |
| `GET /api/notifications/unread-count` | Redis cache per user, invalidated on new notification |

---

## Next Implementation Steps

1. **Data Models & EF Core Entities** - Define all entities with proper indexes, row-level security policies
2. **DTOs & Validation** - Request/Response DTOs with FluentValidation rules
3. **Project Structure** - Set up .NET 8 solution with Clean Architecture
4. **API Contract** - Generate OpenAPI spec for frontend type generation