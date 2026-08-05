import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "../components/ui";
import { ApiError } from "../lib/apiClient";
import { API_MODE } from "../lib/config";
import { createTenant, getPlatformHealth, getTenantById, getTenants } from "../services/admin";

const formatDate = (value: string) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T00:00:00`));
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
  const tenantsQuery = useQuery({ queryKey: ["tenants"], queryFn: getTenants });

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
          <table className="grid-table tenant-table">
            <thead><tr><th>Firm</th><th>Primary contact</th><th>Companies</th><th>Users</th><th>Plan</th><th>Status</th></tr></thead>
            <tbody>
              {tenants.map((tenant) => (
                <tr key={tenant.id} tabIndex={0} role="link" onClick={() => navigate(`/admin/tenants/${tenant.id}`)} onKeyDown={(event) => event.key === "Enter" && navigate(`/admin/tenants/${tenant.id}`)}>
                  <td><strong>{tenant.firmName}</strong></td>
                  <td>{tenant.primaryContactEmail}</td>
                  <td>{tenant.companiesCount}</td>
                  <td>{tenant.usersCount}</td>
                  <td>{tenant.plan}</td>
                  <td><Badge status={statusToBadge(tenant.status)} label={tenant.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
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

function Metric({ label, value, icon }: { label: string; value: string; icon: string }) {
  return <section className="card system-metric"><i className={`ti ${icon}`} /><span>{label}</span><strong>{value}</strong></section>;
}
