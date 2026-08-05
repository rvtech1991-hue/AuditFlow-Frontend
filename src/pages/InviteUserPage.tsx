import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "../components/ui";
import { useRole } from "../lib/RoleContext";
import { ApiError } from "../lib/apiClient";
import { getCompaniesForRole, getCompanyById } from "../services/companies";
import { getManagers, inviteUser, type AuditUser } from "../services/users";

const auditorRoles: AuditUser["role"][] = ["Employee", "Company admin", "Auditor"];
const companyAdminRoles: AuditUser["role"][] = ["Employee", "Company admin"];

export function InviteUserPage() {
  const navigate = useNavigate();
  const { role, user } = useRole();
  const companiesQuery = useQuery({ queryKey: ["companies", role], queryFn: () => getCompaniesForRole(role) });
  const companies = companiesQuery.data ?? [];
  const allowedRoles = role === "Company admin" ? companyAdminRoles : auditorRoles;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState<AuditUser["role"]>("Employee");
  const [companyId, setCompanyId] = useState("");
  const [subCompanyId, setSubCompanyId] = useState("");
  const [reportingManagerId, setReportingManagerId] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Default to the first company once the list loads (mirrors the old synchronous default).
  useEffect(() => {
    if (!companyId && companies.length > 0) setCompanyId(companies[0].id);
  }, [companies, companyId]);

  const selectedCompany = companies.find((item) => item.id === companyId);
  const isAuditorInvite = selectedRole === "Auditor";

  // Sub-company names/ids aren't on the list endpoint's response — fetch the company detail
  // once one is selected (see services/companies.ts).
  const companyDetailQuery = useQuery({
    queryKey: ["company", companyId],
    queryFn: () => getCompanyById(companyId),
    enabled: Boolean(companyId) && !isAuditorInvite,
  });
  const subCompanies = companyDetailQuery.data?.subCompanies ?? [];

  const managersQuery = useQuery({
    queryKey: ["managers", companyId],
    queryFn: () => getManagers(role, companyId, selectedCompany?.name ?? "", user.email),
    enabled: Boolean(companyId) && !isAuditorInvite,
  });
  const managerOptions = managersQuery.data ?? [];

  const canSubmit = Boolean(name.trim() && email.trim() && companyId) && !isSubmitting;

  const changeCompany = (event: ChangeEvent<HTMLSelectElement>) => {
    setCompanyId(event.currentTarget.value);
    setSubCompanyId("");
    setReportingManagerId("");
  };

  const changeRole = (nextRole: AuditUser["role"]) => {
    setSelectedRole(nextRole);
    if (nextRole === "Auditor") {
      setReportingManagerId("");
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    const subCompany = subCompanies.find((sc) => sc.id === subCompanyId);
    const manager = managerOptions.find((m) => m.id === reportingManagerId);

    setError("");
    setIsSubmitting(true);
    try {
      await inviteUser({
        name,
        email,
        role: selectedRole,
        // The backend maps an Auditor to this company via UserCompanyMapping at invite time
        // even though Auditors aren't scoped to a single company long-term (SS8) — a real
        // CompanyId is required regardless of role, there's no "no company" option server-side.
        companyId,
        companyName: selectedCompany?.name ?? "",
        subCompanyId: isAuditorInvite ? undefined : subCompanyId || undefined,
        subCompanyName: isAuditorInvite ? undefined : subCompany?.name,
        reportingManagerId: isAuditorInvite ? undefined : reportingManagerId || undefined,
        reportingManagerName: isAuditorInvite ? undefined : manager?.name,
      });
      navigate("/users", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="modal-route-page">
      <section className="invite-user-modal" aria-labelledby="invite-user-title">
        <div className="modal-route-heading">
          <div>
            <h2 id="invite-user-title">Invite user</h2>
            <p>They will receive an email invite to set their password and join AuditFlow.</p>
          </div>
          <button className="modal-close-button" type="button" aria-label="Close" onClick={() => navigate("/users")}><i className="ti ti-x" /></button>
        </div>

        <form className="invite-user-form" onSubmit={handleSubmit}>
          <div className="field-row">
            <label className="field">
              <span>Full name</span>
              <input value={name} onChange={(event) => setName(event.currentTarget.value)} placeholder="Ananya Verma" />
            </label>
            <label className="field">
              <span>Email</span>
              <input type="email" value={email} onChange={(event) => setEmail(event.currentTarget.value)} placeholder="a.verma@meridian.com" />
            </label>
          </div>

          <div className="field">
            <label>Role</label>
            <div className="role-chip-row" role="group" aria-label="User role">
              {allowedRoles.map((item) => (
                <button key={item} className={`chip ${selectedRole === item ? "active-chip" : ""}`} type="button" onClick={() => changeRole(item)}>
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="field-row">
            <label className="field">
              <span>Company</span>
              <select value={companyId} onChange={changeCompany} disabled={role === "Company admin"}>
                {companies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            {!isAuditorInvite ? (
              <label className="field">
                <span>Sub-company access</span>
                <select value={subCompanyId} onChange={(event) => setSubCompanyId(event.currentTarget.value)}>
                  <option value="">All sub-companies</option>
                  {subCompanies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
            ) : null}
          </div>

          {!isAuditorInvite ? (
            <div className="invite-note-section">
              <label className="field">
                <span>Reporting manager</span>
                <select value={reportingManagerId} onChange={(event) => setReportingManagerId(event.currentTarget.value)}>
                  <option value="">None</option>
                  {managerOptions.map((manager) => <option key={manager.id} value={manager.id}>{manager.name} - {manager.company}</option>)}
                </select>
              </label>
              <div className="notification-note">
                <span>i</span>
                <p>Task notification emails include this manager on CC when one is selected.</p>
              </div>
            </div>
          ) : (
            <div className="notification-note">
              <span>i</span>
              <p>Auditor users are added to the firm workspace and can manage companies, users, tasks, and reports across client companies. They're initially mapped to the company selected above and can be mapped to more companies later.</p>
            </div>
          )}

          {error ? <p className="form-error">{error}</p> : null}

          <div className="modal-footer-actions">
            <Button type="button" onClick={() => navigate("/users")}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={!canSubmit}>{isSubmitting ? "Sending..." : "Send invite"}</Button>
          </div>
        </form>
      </section>
    </main>
  );
}
