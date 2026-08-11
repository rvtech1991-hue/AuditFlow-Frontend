import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Card, Pagination, RowActionMenu, Table } from "../components/ui";
import { ApiError } from "../lib/apiClient";
import { API_MODE } from "../lib/config";
import { parseApiDateTime } from "../lib/dateTime";
import { AUDIT_LOG_PAGE_SIZE, createTenant, getAuditLog, getPlatformHealth, getTenantById, getTenants, updateTenantStatus, type AuditLogEntry, type TenantEntry } from "../services/admin";

const formatDate = (value: string) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T00:00:00`));
const formatDateTime = (value: string) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(parseApiDateTime(value));
const initials = (name: string) => name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function statusToBadge(status: string) {
  if (status === "Active") return "active";
  if (status === "Onboarding") return "invited";
  if (status === "Suspended") return "overdue";
  return "closed"; // Cancelled
}

export function TenantListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tenantsQuery = useQuery({ queryKey: ["tenants"], queryFn: getTenants });
  const statusMutation = useMutation({
    mutationFn: (vars: { tenantId: string; status: "Active" | "Suspended" }) => updateTenantStatus(vars.tenantId, vars.status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tenants"] }),
  });

  if (tenantsQuery.isLoading) {
    return <div className="platform-page"><p className="data-state">Loading auditor accounts…</p></div>;
  }
  if (tenantsQuery.error) {
    const detail = tenantsQuery.error instanceof ApiError ? tenantsQuery.error.detail : "Couldn't load auditor accounts.";
    return <div className="platform-page"><p className="data-state is-error">{detail}</p></div>;
  }

  const tenants = tenantsQuery.data ?? [];
  return (
    <>
      <header className="platform-topbar"><div><h1>Auditor accounts</h1><p>{tenants.length} firm{tenants.length === 1 ? "" : "s"} on the platform</p></div><Link to="/admin/tenants/new" className="btn primary platform-primary"><i className="ti ti-plus" />Create auditor account</Link></header>
      <section className="card tenant-table-card">
        <div className="tenant-table-wrap">
          <Table<TenantEntry>
            rows={tenants}
            onRowClick={(tenant) => navigate(`/admin/tenants/${tenant.id}`)}
            emptyState="No auditor accounts yet."
            columns={[
              { key: "firmName", header: "Firm", render: (tenant) => <strong>{tenant.firmName}</strong> },
              { key: "primaryContactEmail", header: "Primary contact" },
              { key: "companiesCount", header: "Companies", align: "left" },
              { key: "usersCount", header: "Users", align: "left" },
              { key: "tasksCount", header: "Tasks", align: "left" },
              { key: "plan", header: "Plan", align: "left" },
              { key: "status", header: "Status", align: "left", render: (tenant) => <Badge status={statusToBadge(tenant.status)} label={tenant.status} /> },
              {
                key: "actions",
                header: "",
                align: "right",
                // Suspended accounts stay a licensing/access lever, not a data-loss action - there's
                // no "Cancelled" option here, that's a separate, more permanent decision this menu
                // deliberately doesn't offer. Every new tenant starts in Onboarding (Tenant.cs) and
                // nothing ever auto-promotes it - a PlatformAdmin has to explicitly activate it,
                // same status-update endpoint as suspend/reactivate.
                render: (tenant) => {
                  const isOnboarding = tenant.status === "Onboarding";
                  const isActive = tenant.status === "Active";
                  const isSuspended = tenant.status === "Suspended";
                  if (!isOnboarding && !isActive && !isSuspended) return null;
                  return (
                    <span onClick={(event) => event.stopPropagation()}>
                      <RowActionMenu
                        actions={[
                          ...(isOnboarding ? [{
                            label: "Activate account",
                            icon: "Restore",
                            onClick: () => statusMutation.mutate({ tenantId: tenant.id, status: "Active" }),
                          }] : []),
                          ...(isActive ? [{
                            label: "Suspend account",
                            icon: "Deactivate",
                            destructive: true,
                            onClick: () => statusMutation.mutate({ tenantId: tenant.id, status: "Suspended" }),
                          }] : []),
                          ...(isSuspended ? [{
                            label: "Reactivate account",
                            icon: "Restore",
                            onClick: () => statusMutation.mutate({ tenantId: tenant.id, status: "Active" }),
                          }] : []),
                        ]}
                      />
                    </span>
                  );
                },
              },
            ]}
          />
        </div>
      </section>
    </>
  );
}

export function CreateTenantPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [firmName, setFirmName] = useState("");
  const [plan, setPlan] = useState("Growth");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [created, setCreated] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = Boolean(firmName.trim() && contactName.trim() && contactEmail.trim()) && !isSubmitting;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setError("");
    setIsSubmitting(true);
    try {
      await createTenant({ firmName: firmName.trim(), plan, contactName: contactName.trim(), contactEmail: contactEmail.trim() });
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      setCreated(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="tenant-form-page">
      <button type="button" className="back-link" onClick={() => navigate("/admin/tenants")}>← Auditor accounts</button>
      <section className="card tenant-form-card">
        <div className="tenant-form-heading"><div><h1>Create auditor account</h1><p>Provision a new audit-firm tenant and its first Auditor login.</p></div></div>
        {created ? (
          <div className="tenant-created">
            <i className="ti ti-circle-check" />
            <div><strong>Auditor account created</strong><p>The firm workspace and initial auditor invitation are ready.</p></div>
            <button className="btn primary platform-primary" onClick={() => navigate("/admin/tenants")}>Back to accounts</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="field-row">
              <label className="admin-field">Audit firm name<input required value={firmName} onChange={(event) => setFirmName(event.currentTarget.value)} placeholder="e.g. Verma Audit Partners" /></label>
              <label className="admin-field">Plan<select value={plan} onChange={(event) => setPlan(event.currentTarget.value)}><option>Starter</option><option>Growth</option><option>Scale</option></select></label>
            </div>
            <div className="field-row">
              <label className="admin-field">Primary contact name<input required value={contactName} onChange={(event) => setContactName(event.currentTarget.value)} placeholder="Full name" /></label>
              <label className="admin-field">Primary contact email<input type="email" required value={contactEmail} onChange={(event) => setContactEmail(event.currentTarget.value)} placeholder="name@firm.com" /></label>
            </div>
            <p className="page-subtitle">This contact becomes the firm's first Auditor login — they'll receive an email invite to set their password.</p>
            {error ? <p className="form-error">{error}</p> : null}
            <div className="tenant-form-actions">
              <button type="button" className="btn" onClick={() => navigate("/admin/tenants")}>Cancel</button>
              <button className="btn primary platform-primary" type="submit" disabled={!canSubmit}>{isSubmitting ? "Creating..." : "Create auditor account"}</button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

export function TenantDetailPage() {
  const { tenantId = "" } = useParams();
  const tenantQuery = useQuery({ queryKey: ["tenant", tenantId], queryFn: () => getTenantById(tenantId), enabled: Boolean(tenantId) });

  if (tenantQuery.isLoading) {
    return <div className="tenant-detail-page"><p className="data-state">Loading tenant…</p></div>;
  }
  if (tenantQuery.error) {
    const detail = tenantQuery.error instanceof ApiError ? tenantQuery.error.detail : "Couldn't load this tenant.";
    return <div className="tenant-detail-page"><p className="data-state is-error">{detail}</p></div>;
  }
  if (!tenantQuery.data) return <Navigate to="/admin/tenants" replace />;
  const tenant = tenantQuery.data;

  return (
    <div className="tenant-detail-page">
      <Link className="back-link" to="/admin/tenants">← Auditor accounts</Link>
      <header className="tenant-detail-heading">
        <div><div className="tenant-icon"><i className="ti ti-building-bank" /></div><div><h1>{tenant.firmName}</h1><p>Tenant overview · joined {formatDate(tenant.createdAt)}</p></div></div>
        <Badge status={statusToBadge(tenant.status)} label={tenant.status} />
      </header>
      <div className="tenant-detail-grid">
        <section className="card">
          <h2 className="card-title">Subscription</h2>
          <dl className="detail-list">
            <div><dt>Plan</dt><dd>{tenant.plan}</dd></div>
            {tenant.subscriptionEndsAt ? <div><dt>Renewal</dt><dd>{formatDate(tenant.subscriptionEndsAt)}</dd></div> : null}
            {tenant.trialEndsAt ? <div><dt>Trial ends</dt><dd>{formatDate(tenant.trialEndsAt)}</dd></div> : null}
            <div><dt>Workspace status</dt><dd>{tenant.status}</dd></div>
          </dl>
        </section>
        <section className="card">
          <h2 className="card-title">Usage</h2>
          <div className="tenant-metrics"><div><strong>{tenant.companiesCount}</strong><span>Companies</span></div><div><strong>{tenant.usersCount}</strong><span>Users</span></div></div>
        </section>
        <section className="card detail-contacts">
          <h2 className="card-title">Primary contact</h2>
          <div className="contact-avatar">{initials(tenant.primaryContactName)}</div>
          <strong>{tenant.primaryContactName}</strong>
          <a href={`mailto:${tenant.primaryContactEmail}`}>{tenant.primaryContactEmail}</a>
          <span>Tenant owner</span>
        </section>
      </div>
    </div>
  );
}

export function SystemOverviewPage() {
  const healthQuery = useQuery({ queryKey: ["platform-health"], queryFn: getPlatformHealth });

  if (healthQuery.isLoading) {
    return <><header className="platform-topbar"><div><h1>System overview</h1><p>Platform health and tenant usage at a glance</p></div></header><p className="data-state">Loading…</p></>;
  }
  if (healthQuery.error || !healthQuery.data) {
    const detail = healthQuery.error instanceof ApiError ? healthQuery.error.detail : "Couldn't load system health.";
    return <><header className="platform-topbar"><div><h1>System overview</h1><p>Platform health and tenant usage at a glance</p></div></header><p className="data-state is-error">{detail}</p></>;
  }

  const health = healthQuery.data;
  return (
    <>
      <header className="platform-topbar"><div><h1>System overview</h1><p>Platform health and tenant usage at a glance</p></div></header>
      <div className="system-metrics">
        <Metric label="Active firms" value={String(health.activeTenants)} icon="ti-building-bank" />
        <Metric label="Total users" value={health.totalUsers.toLocaleString()} icon="ti-users" />
        <Metric label="Total companies" value={health.totalCompanies.toLocaleString()} icon="ti-building" />
        <Metric label="Total tasks" value={health.totalTasks.toLocaleString()} icon="ti-checkbox" />
      </div>
      <p className="system-metrics-hint">Click any card to see the per-firm breakdown behind that number.</p>
      {API_MODE === "mock" ? (
        <section className="card system-status">
          <h2 className="card-title">Service health</h2>
          {["Application API", "Database", "Notifications", "File storage"].map((service) => <div key={service}><span><i className="ti ti-circle-check" />{service}</span><strong>Operational</strong></div>)}
        </section>
      ) : (
        <section className="card system-status">
          <h2 className="card-title">Environment</h2>
          <div className="tenant-metrics">
            <div><strong>{health.environment}</strong><span>Environment</span></div>
            <div><strong>{health.version}</strong><span>Version</span></div>
            <div><strong>{formatBytes(health.databaseSizeBytes)}</strong><span>Database size</span></div>
          </div>
        </section>
      )}
    </>
  );
}

const entityTypeOptions = ["ApplicationUser", "Tenant", "Company", "SubCompany", "TaskItem"];
const actionOptions = [
  "Created", "Updated", "Deleted", "StatusChanged", "Assigned", "CommentAdded",
  "AttachmentUploaded", "AttachmentDeleted", "UserInvited", "UserActivated", "UserDeactivated",
  "CompanyCreated", "CompanyUpdated", "SubCompanyCreated", "SubCompanyUpdated", "BulkImport",
  "Login", "Logout", "PasswordChanged", "MfaEnabled", "MfaDisabled", "Impersonation",
];
// "UserDeactivated" -> "User deactivated" — splits on the enum's PascalCase word boundaries
// rather than maintaining a separate label for all 22 AuditAction values.
const actionLabel = (action: string) => action.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());

export function AuditLogPage() {
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const setFilterAndResetPage = <T,>(setter: (value: T) => void, value: T) => {
    setter(value);
    setPage(1);
  };

  const auditLogQuery = useQuery({
    queryKey: ["admin", "audit-log", entityType, action, dateFrom, dateTo, page],
    queryFn: () => getAuditLog({ entityType: entityType || undefined, action: action || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, page }),
  });

  const rows = auditLogQuery.data?.items ?? [];
  const totalCount = auditLogQuery.data?.totalCount ?? 0;
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * AUDIT_LOG_PAGE_SIZE + 1;
  const rangeEnd = totalCount === 0 ? 0 : rangeStart + rows.length - 1;

  return (
    <>
      <header className="platform-topbar"><div><h1>Audit log</h1><p>Platform-wide administrative activity across every firm.</p></div></header>
      <Card className="audit-log-card">
        <div className="task-filter-row">
          <select value={entityType} onChange={(event) => setFilterAndResetPage(setEntityType, event.currentTarget.value)}>
            <option value="">Entity: All</option>
            {entityTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          <select value={action} onChange={(event) => setFilterAndResetPage(setAction, event.currentTarget.value)}>
            <option value="">Action: All</option>
            {actionOptions.map((option) => <option key={option} value={option}>{actionLabel(option)}</option>)}
          </select>
          <label className="audit-log-date-field">
            From
            <input type="date" value={dateFrom} onChange={(event) => setFilterAndResetPage(setDateFrom, event.currentTarget.value)} />
          </label>
          <label className="audit-log-date-field">
            To
            <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => setFilterAndResetPage(setDateTo, event.currentTarget.value)} />
          </label>
          {entityType || action || dateFrom || dateTo ? (
            <button
              type="button"
              className="btn"
              onClick={() => {
                setEntityType("");
                setAction("");
                setDateFrom("");
                setDateTo("");
                setPage(1);
              }}
            >
              Clear filters
            </button>
          ) : null}
        </div>

        {auditLogQuery.isLoading ? (
          <p className="data-state">Loading audit log…</p>
        ) : auditLogQuery.error ? (
          <p className="data-state is-error">{auditLogQuery.error instanceof ApiError ? auditLogQuery.error.detail : "Couldn't load the audit log."}</p>
        ) : (
          <Table<AuditLogEntry>
            rows={rows}
            emptyState="No activity matches the selected filters."
            columns={[
              { key: "createdAt", header: "When", render: (entry) => formatDateTime(entry.createdAt) },
              { key: "userEmail", header: "Actor", render: (entry) => entry.userEmail ?? <span className="muted-cell">System</span> },
              { key: "action", header: "Action", render: (entry) => actionLabel(entry.action) },
              {
                key: "entityType",
                header: "Entity",
                render: (entry) => (
                  <span>
                    {entry.entityType}
                    <small className="table-subline">{entry.entityId}</small>
                  </span>
                ),
              },
              {
                key: "newValues",
                header: "Details",
                render: (entry) =>
                  entry.newValues || entry.oldValues ? (
                    <span className="audit-log-details">
                      {entry.oldValues ? <span className="audit-log-old">{entry.oldValues}</span> : null}
                      {entry.newValues ? <span className="audit-log-new">{entry.newValues}</span> : null}
                    </span>
                  ) : (
                    <span className="muted-cell">—</span>
                  ),
              },
            ]}
          />
        )}

        <div className="pagination-footer">
          <span>Showing {rangeStart}-{rangeEnd} of {totalCount} entries</span>
          <Pagination page={page} totalPages={auditLogQuery.data?.totalPages ?? 1} onChange={setPage} />
        </div>
      </Card>
    </>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <Link className="card system-metric" to="/admin/tenants" title={`See the per-firm breakdown for ${label.toLowerCase()}`}>
      <span className="system-metric-icon"><i className={`ti ${icon}`} /></span>
      <i className="ti ti-chevron-right system-metric-chevron" aria-hidden="true" />
      <span>{label}</span>
      <strong>{value}</strong>
    </Link>
  );
}
