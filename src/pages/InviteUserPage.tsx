import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui";
import { useRole } from "../lib/RoleContext";
import { getCompaniesForRole } from "../mock-data/companies";
import { getUsersForRole, inviteUser, type AuditUser } from "../mock-data/users";

const auditorRoles: AuditUser["role"][] = ["Employee", "Company admin", "Auditor"];
const companyAdminRoles: AuditUser["role"][] = ["Employee", "Company admin"];

export function InviteUserPage() {
  const navigate = useNavigate();
  const { role } = useRole();
  const companies = useMemo(() => getCompaniesForRole(role), [role]);
  const allowedRoles = role === "Company admin" ? companyAdminRoles : auditorRoles;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState<AuditUser["role"]>("Employee");
  const [company, setCompany] = useState(companies[0]?.name ?? "");
  const selectedCompany = companies.find((item) => item.name === company) ?? companies[0];
  const [subCompany, setSubCompany] = useState("All sub-companies");
  const [reportingManager, setReportingManager] = useState("");
  const managerOptions = useMemo(
    () => getUsersForRole(role).filter((user) => user.status === "Active" && user.company === company && user.email !== email),
    [company, email, role],
  );
  const isAuditorInvite = selectedRole === "Auditor";
  const canSubmit = name.trim() && email.trim() && (isAuditorInvite || company);

  const changeCompany = (event: ChangeEvent<HTMLSelectElement>) => {
    setCompany(event.currentTarget.value);
    setSubCompany("All sub-companies");
    setReportingManager("");
  };

  const changeRole = (nextRole: AuditUser["role"]) => {
    setSelectedRole(nextRole);
    if (nextRole === "Auditor") {
      setReportingManager("");
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    inviteUser({
      name,
      email,
      role: selectedRole,
      company,
      subCompany: isAuditorInvite ? "All client companies" : subCompany,
      reportingManager: isAuditorInvite ? "" : reportingManager,
    });
    navigate("/users", { replace: true });
  };

  return (
    <main className="modal-route-page">
      <section className="invite-user-modal" aria-labelledby="invite-user-title">
        <div className="modal-route-heading">
          <div>
            <h2 id="invite-user-title">Invite user</h2>
            <p>They will receive an email invite to set their password and join AuditFlow.</p>
          </div>
          <button className="modal-close-button" type="button" aria-label="Close" onClick={() => navigate("/users")}>x</button>
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
                <button key={item} className={`chip ${selectedRole === item ? "active" : ""}`} type="button" onClick={() => changeRole(item)}>
                  {item}
                </button>
              ))}
            </div>
          </div>

          {!isAuditorInvite ? (
            <>
              <div className="field-row">
                <label className="field">
                  <span>Company</span>
                  <select value={company} onChange={changeCompany} disabled={role === "Company admin"}>
                    {companies.map((item) => <option key={item.id}>{item.name}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>Sub-company access</span>
                  <select value={subCompany} onChange={(event) => setSubCompany(event.currentTarget.value)}>
                    <option>All sub-companies</option>
                    {selectedCompany?.subCompanies.map((item) => <option key={item.id}>{item.name}</option>)}
                  </select>
                </label>
              </div>

              <div className="invite-note-section">
                <label className="field">
                  <span>Reporting manager</span>
                  <select value={reportingManager} onChange={(event) => setReportingManager(event.currentTarget.value)}>
                    <option value="">None</option>
                    {managerOptions.map((user) => <option key={user.id} value={user.name}>{user.name} - {user.company}</option>)}
                  </select>
                </label>
                <div className="notification-note">
                  <span>i</span>
                  <p>Task notification emails include this manager on CC when one is selected.</p>
                </div>
              </div>
            </>
          ) : (
            <div className="notification-note">
              <span>i</span>
              <p>Auditor users are added to the firm workspace and can manage companies, users, tasks, and reports across client companies.</p>
            </div>
          )}

          <div className="modal-footer-actions">
            <Button type="button" onClick={() => navigate("/users")}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={!canSubmit}>Send invite</Button>
          </div>
        </form>
      </section>
    </main>
  );
}
