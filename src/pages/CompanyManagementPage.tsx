import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Button, Card, RowActionMenu, Table } from "../components/ui";
import { useRole } from "../lib/RoleContext";
import { getCompaniesForRole, setCompanyStatus, type AuditCompany } from "../mock-data/companies";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function companyInitials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function subCompanyPreview(company: AuditCompany) {
  const visible = company.subCompanies.slice(0, 3);
  const hiddenCount = company.subCompanies.length - visible.length;
  return (
    <span className="company-sub-list">
      {visible.map((subCompany) => <span key={subCompany.id}>{subCompany.name}</span>)}
      {hiddenCount > 0 ? <span>+{hiddenCount} more</span> : null}
    </span>
  );
}

export function CompanyManagementPage() {
  const navigate = useNavigate();
  const { role } = useRole();
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState("");
  const canManage = role === "Auditor";
  const scopedCompanies = useMemo(() => getCompaniesForRole(role), [role, version]);
  const visibleCompanies = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return scopedCompanies;
    return scopedCompanies.filter((company) => `${company.name} ${company.industry} ${company.primaryContactEmail}`.toLowerCase().includes(normalized));
  }, [query, scopedCompanies]);

  const totalSubCompanies = visibleCompanies.reduce((total, company) => total + company.subCompanies.length, 0);
  const totalUsers = visibleCompanies.reduce((total, company) => total + company.userCount, 0);

  const toggleCompanyStatus = (company: AuditCompany) => {
    setCompanyStatus(company.id, company.status === "Active" ? "Archived" : "Active");
    setVersion((current) => current + 1);
  };

  return (
    <div className="company-page">
      <div className="task-actions-row">
        <div>
          <h2>Company management</h2>
          <p>
            {visibleCompanies.length} companies, {totalSubCompanies} sub-companies, {totalUsers} users.
            {canManage ? " Auditor workspace has full company controls." : " Company admin access is view only and scoped to your company."}
          </p>
        </div>
        {canManage ? <Button variant="primary" onClick={() => navigate("/companies/new")}>Add company</Button> : null}
      </div>

      <Card className="company-summary-grid">
        <div>
          <span className="stat-label">Companies</span>
          <strong>{visibleCompanies.length}</strong>
        </div>
        <div>
          <span className="stat-label">Sub-companies</span>
          <strong>{totalSubCompanies}</strong>
        </div>
        <div>
          <span className="stat-label">Active tasks</span>
          <strong>{visibleCompanies.reduce((total, company) => total + company.activeTaskCount, 0)}</strong>
        </div>
      </Card>

      <Card>
        <div className="task-filter-row">
          <input className="task-filter-search" value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Search company, industry, email" />
        </div>
        <Table<AuditCompany>
          rows={visibleCompanies}
          emptyState="No companies match the selected filters."
          columns={[
            {
              key: "name",
              header: "Company",
              render: (company) => (
                <span className="company-name-cell">
                  <span className="company-icon">{companyInitials(company.name)}</span>
                  <span>
                    <strong>{company.name}</strong>
                    <small>{company.industry}</small>
                  </span>
                </span>
              ),
            },
            { key: "primaryContactEmail", header: "Primary contact" },
            { key: "subCompanies", header: "Sub-companies", render: subCompanyPreview },
            { key: "userCount", header: "Users" },
            { key: "activeTaskCount", header: "Open tasks" },
            { key: "onboardedOn", header: "Onboarded", render: (company) => formatDate(company.onboardedOn) },
            { key: "status", header: "Status", render: (company) => <Badge status={company.status === "Active" ? "active" : "closed"} label={company.status} /> },
            {
              key: "actions",
              header: "",
              render: (company) => canManage ? (
                <RowActionMenu
                  actions={[
                    { label: "Edit company", icon: "Edit", onClick: () => navigate(`/companies/${company.id}/edit`) },
                    {
                      label: company.status === "Active" ? "Archive company" : "Restore company",
                      icon: company.status === "Active" ? "Archive" : "Restore",
                      destructive: company.status === "Active",
                      dividerBefore: true,
                      onClick: () => toggleCompanyStatus(company),
                    },
                  ]}
                />
              ) : (
                <span className="view-only-note">View only</span>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
