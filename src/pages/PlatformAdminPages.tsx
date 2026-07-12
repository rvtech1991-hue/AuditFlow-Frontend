import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Badge } from "../components/ui";

type Tenant = { id: string; firm: string; contact: string; contactName: string; companies: number; users: number; plan: "Growth" | "Scale" | "Starter"; status: "Active" | "Onboarding"; joined: string; storage: string; tasks: number; renewal: string };

const tenants: Tenant[] = [
  { id: "sharma-associates", firm: "Sharma & Associates", contact: "r.sharma@auditfirm.com", contactName: "Rhea Sharma", companies: 3, users: 29, plan: "Growth", status: "Active", joined: "Jan 12, 2026", storage: "4.8 GB of 25 GB", tasks: 428, renewal: "Jan 12, 2027" },
  { id: "nair-audit-partners", firm: "Nair Audit Partners", contact: "contact@nairaudit.com", contactName: "Nikhil Nair", companies: 7, users: 64, plan: "Scale", status: "Active", joined: "Mar 28, 2026", storage: "12.6 GB of 100 GB", tasks: 1_186, renewal: "Mar 28, 2027" },
  { id: "patel-co", firm: "Patel & Co.", contact: "admin@patelco.com", contactName: "Pooja Patel", companies: 2, users: 11, plan: "Starter", status: "Onboarding", joined: "Jul 4, 2026", storage: "0.4 GB of 10 GB", tasks: 23, renewal: "Jul 4, 2027" },
];

const statusToBadge = (status: Tenant["status"]) => status === "Active" ? "active" : "invited";

export function TenantListPage() {
  const navigate = useNavigate();
  return <><header className="platform-topbar"><div><h1>Auditor accounts</h1><p>12 firms on the platform</p></div><Link to="/admin/tenants/new" className="btn primary platform-primary"><i className="ti ti-plus" />Create auditor account</Link></header><section className="card tenant-table-card"><div className="tenant-table-wrap"><table className="grid-table tenant-table"><thead><tr><th>Firm</th><th>Primary contact</th><th>Companies</th><th>Users</th><th>Plan</th><th>Status</th></tr></thead><tbody>{tenants.map((tenant) => <tr key={tenant.id} tabIndex={0} role="link" onClick={() => navigate(`/admin/tenants/${tenant.id}`)} onKeyDown={(event) => event.key === "Enter" && navigate(`/admin/tenants/${tenant.id}`)}><td><strong>{tenant.firm}</strong></td><td>{tenant.contact}</td><td>{tenant.companies}</td><td>{tenant.users}</td><td>{tenant.plan}</td><td><Badge status={statusToBadge(tenant.status)} label={tenant.status} /></td></tr>)}</tbody></table></div></section></>;
}

export function CreateTenantPage() {
  const navigate = useNavigate(); const [created, setCreated] = useState(false);
  return <div className="tenant-form-page"><button type="button" className="back-link" onClick={() => navigate("/admin/tenants")}>← Auditor accounts</button><section className="card tenant-form-card"><div className="tenant-form-heading"><div><h1>Create auditor account</h1><p>Provision a new audit-firm tenant and its first Auditor login.</p></div></div>{created ? <div className="tenant-created"><i className="ti ti-circle-check" /><div><strong>Auditor account created</strong><p>The firm workspace and initial auditor invitation are ready.</p></div><button className="btn primary platform-primary" onClick={() => navigate("/admin/tenants")}>Back to accounts</button></div> : <form onSubmit={(event) => { event.preventDefault(); setCreated(true); }}><div className="field-row"><label className="admin-field">Audit firm name<input required placeholder="e.g. Verma Audit Partners" /></label><label className="admin-field">Plan<select defaultValue="Growth"><option>Starter</option><option>Growth</option><option>Scale</option></select></label></div><div className="field-row"><label className="admin-field">Primary contact name<input required placeholder="Full name" /></label><label className="admin-field">Primary contact email<input type="email" required placeholder="name@firm.com" /></label></div><label className="admin-field">Initial auditor email<input type="email" required placeholder="auditor@firm.com" /></label><div className="tenant-form-actions"><button type="button" className="btn" onClick={() => navigate("/admin/tenants")}>Cancel</button><button className="btn primary platform-primary" type="submit">Create auditor account</button></div></form>}</section></div>;
}

export function TenantDetailPage() {
  const { tenantId = "" } = useParams(); const tenant = tenants.find((item) => item.id === tenantId);
  if (!tenant) return <TenantListPage />;
  return <div className="tenant-detail-page"><Link className="back-link" to="/admin/tenants">← Auditor accounts</Link><header className="tenant-detail-heading"><div><div className="tenant-icon"><i className="ti ti-building-bank" /></div><div><h1>{tenant.firm}</h1><p>Tenant overview · joined {tenant.joined}</p></div></div><Badge status={statusToBadge(tenant.status)} label={tenant.status} /></header><div className="tenant-detail-grid"><section className="card"><h2 className="card-title">Subscription</h2><dl className="detail-list"><div><dt>Plan</dt><dd>{tenant.plan}</dd></div><div><dt>Renewal</dt><dd>{tenant.renewal}</dd></div><div><dt>Workspace status</dt><dd>{tenant.status}</dd></div></dl></section><section className="card"><h2 className="card-title">Usage</h2><div className="tenant-metrics"><div><strong>{tenant.companies}</strong><span>Companies</span></div><div><strong>{tenant.users}</strong><span>Users</span></div><div><strong>{tenant.tasks.toLocaleString()}</strong><span>Tasks</span></div></div><p className="storage-usage"><i className="ti ti-database" /> {tenant.storage}</p></section><section className="card detail-contacts"><h2 className="card-title">Primary contact</h2><div className="contact-avatar">{tenant.contactName.split(" ").map((part) => part[0]).join("")}</div><strong>{tenant.contactName}</strong><a href={`mailto:${tenant.contact}`}>{tenant.contact}</a><span>Tenant owner</span></section></div></div>;
}

export function SystemOverviewPage() { return <><header className="platform-topbar"><div><h1>System overview</h1><p>Platform health and tenant usage at a glance</p></div></header><div className="system-metrics"><Metric label="Active firms" value="12" icon="ti-building-bank" /><Metric label="Active users" value="412" icon="ti-users" /><Metric label="Tasks this month" value="2,846" icon="ti-checkbox" /><Metric label="Service uptime" value="99.98%" icon="ti-heartbeat" /></div><section className="card system-status"><h2 className="card-title">Service health</h2>{["Application API", "Database", "Notifications", "File storage"].map((service) => <div key={service}><span><i className="ti ti-circle-check" />{service}</span><strong>Operational</strong></div>)}</section></>;
}

function Metric({ label, value, icon }: { label: string; value: string; icon: string }) { return <section className="card system-metric"><i className={`ti ${icon}`} /><span>{label}</span><strong>{value}</strong></section>; }
