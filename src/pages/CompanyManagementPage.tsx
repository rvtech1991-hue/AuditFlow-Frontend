import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button, Card } from "../components/ui";
import { useRole } from "../lib/RoleContext";
import { ApiError } from "../lib/apiClient";
import { getCompaniesForRole, type CompanyEntry } from "../services/companies";

const formatDate = (value: string) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T00:00:00`));

function subCompanyPreview(company: CompanyEntry) {
  if (company.subCompanies.length === 0) {
    // The live list endpoint only returns a count, not the nested rows (see services/companies.ts).
    return company.subCompanyCount > 0 ? <span className="sub-list"><span className="sub-chip">{company.subCompanyCount} sub-companies</span></span> : null;
  }
  const visible = company.subCompanies.slice(0, 3);
  const hiddenCount = company.subCompanies.length - visible.length;
  return <span className="sub-list">{visible.map((subCompany) => <span className="sub-chip" key={subCompany.id}>{subCompany.name}</span>)}{hiddenCount > 0 ? <span className="sub-chip">+{hiddenCount} more</span> : null}</span>;
}

export function CompanyManagementPage() {
  const navigate = useNavigate();
  const { role } = useRole();
  const canManage = role === "Auditor";
  const companiesQuery = useQuery({ queryKey: ["companies", role], queryFn: () => getCompaniesForRole(role) });

  if (companiesQuery.isLoading) {
    return <div className="company-page"><p className="data-state">Loading companies…</p></div>;
  }
  if (companiesQuery.error || !companiesQuery.data) {
    const detail = companiesQuery.error instanceof ApiError ? companiesQuery.error.detail : "Couldn't load companies.";
    return <div className="company-page"><p className="data-state is-error">{detail}</p></div>;
  }

  const companies = companiesQuery.data;
  const totalSubCompanies = companies.reduce((total, company) => total + company.subCompanyCount, 0);
  return <div className="company-page"><div className="task-actions-row"><div><h2>Company management</h2><p>{companies.length} companies · {totalSubCompanies} sub-companies total</p></div>{canManage ? <Button variant="primary" onClick={() => navigate("/companies/new")}><i className="ti ti-plus" />Add company</Button> : null}</div><Card className="company-list-card">{companies.map((company, index) => <article className="company-row" key={company.id} style={index === 0 ? { borderTop: "none", paddingTop: 6 } : undefined}><span className="co-icon"><i className={`ti ${index === 0 ? "ti-building-skyscraper" : index === 1 ? "ti-building-store" : "ti-truck"}`} /></span><div className="company-row-content"><p className="co-name">{company.name}</p><p className="co-meta">{company.subCompanyCount} sub-companies · {company.userCount} users · onboarded {formatDate(company.onboardedOn)}</p>{subCompanyPreview(company)}</div>{canManage ? <Button size="small" onClick={() => navigate(`/companies/${company.id}/edit`)}><i className="ti ti-settings" />Manage</Button> : <span className="view-only-note">View only</span>}</article>)}</Card></div>;
}
