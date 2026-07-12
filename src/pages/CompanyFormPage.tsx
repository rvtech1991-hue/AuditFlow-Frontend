import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Button } from "../components/ui";
import { createCompany, getCompanyById, updateCompany, type CompanyInput } from "../mock-data/companies";

type SubCompanyDraft = CompanyInput["subCompanies"][number] & { localId: string };

function emptySubCompany(): SubCompanyDraft {
  return {
    localId: `new-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: "",
    location: "",
    userCount: 0,
    activeTaskCount: 0,
  };
}

function draftFromCompany(companyId: string | undefined): {
  name: string;
  industry: string;
  primaryContactEmail: string;
  subCompanies: SubCompanyDraft[];
} {
  const company = companyId ? getCompanyById(companyId) : undefined;
  if (!company) {
    return {
      name: "",
      industry: "",
      primaryContactEmail: "",
      subCompanies: [emptySubCompany()],
    };
  }

  return {
    name: company.name,
    industry: company.industry,
    primaryContactEmail: company.primaryContactEmail,
    subCompanies: company.subCompanies.map((subCompany) => ({ ...subCompany, localId: subCompany.id })),
  };
}

export function CompanyFormPage() {
  const { companyId } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(companyId);
  const existingCompany = companyId ? getCompanyById(companyId) : undefined;
  const initialDraft = useMemo(() => draftFromCompany(companyId), [companyId]);
  const [name, setName] = useState(initialDraft.name);
  const [industry, setIndustry] = useState(initialDraft.industry);
  const [primaryContactEmail, setPrimaryContactEmail] = useState(initialDraft.primaryContactEmail);
  const [subCompanies, setSubCompanies] = useState<SubCompanyDraft[]>(initialDraft.subCompanies);
  const hasSubCompany = subCompanies.some((subCompany) => subCompany.name.trim());
  const canSubmit = name.trim() && primaryContactEmail.trim() && hasSubCompany;

  if (isEdit && !existingCompany) return <Navigate to="/companies" replace />;

  const updateSubCompany = (localId: string, field: keyof Omit<SubCompanyDraft, "localId" | "id">, value: string) => {
    setSubCompanies((current) =>
      current.map((subCompany) => {
        if (subCompany.localId !== localId) return subCompany;
        if (field === "userCount" || field === "activeTaskCount") {
          return { ...subCompany, [field]: Number(value) };
        }
        return { ...subCompany, [field]: value };
      }),
    );
  };

  const removeSubCompany = (localId: string) => {
    setSubCompanies((current) => current.filter((subCompany) => subCompany.localId !== localId));
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    const payload: CompanyInput = {
      name,
      industry,
      primaryContactEmail,
      subCompanies: subCompanies.map(({ localId, ...subCompany }) => subCompany),
    };

    const company = isEdit && companyId ? updateCompany(companyId, payload) : createCompany(payload);
    navigate(company ? "/companies" : "/companies", { replace: true });
  };

  return (
    <main className="modal-route-page">
      <section className="company-form-modal" aria-labelledby="company-form-title">
        <div className="modal-route-heading">
          <div>
            <h2 id="company-form-title">{isEdit ? "Edit company" : "Add company"}</h2>
            <p>Create the company record and maintain nested sub-company rows in one place.</p>
          </div>
          <button className="modal-close-button" type="button" aria-label="Close" onClick={() => navigate("/companies")}><i className="ti ti-x" /></button>
        </div>

        <form className="company-form" onSubmit={handleSubmit}>
          <div className="field-row">
            <label className="field">
              <span>Company name</span>
              <input value={name} onChange={(event: ChangeEvent<HTMLInputElement>) => setName(event.currentTarget.value)} placeholder="Meridian Group" />
            </label>
            <label className="field">
              <span>Industry</span>
              <input value={industry} onChange={(event: ChangeEvent<HTMLInputElement>) => setIndustry(event.currentTarget.value)} placeholder="Retail and distribution" />
            </label>
          </div>

          <label className="field">
            <span>Primary contact email</span>
            <input type="email" value={primaryContactEmail} onChange={(event: ChangeEvent<HTMLInputElement>) => setPrimaryContactEmail(event.currentTarget.value)} placeholder="contact@company.com" />
          </label>

          <div className="sub-company-editor">
            <div className="sub-company-editor-header">
              <div>
                <strong>Sub-companies</strong>
                <span>{subCompanies.length} rows</span>
              </div>
              <button className="add-sub-company" type="button" onClick={() => setSubCompanies((current) => [...current, emptySubCompany()])}><i className="ti ti-plus" />Add another sub-company</button>
            </div>

            <div className="sub-company-row sub-company-row-head">
              <span>Name</span>
              <span>Location</span>
              <span>Users</span>
              <span>Open tasks</span>
              <span />
            </div>
            {subCompanies.map((subCompany) => (
              <div key={subCompany.localId} className="sub-company-row">
                <input value={subCompany.name} onChange={(event) => updateSubCompany(subCompany.localId, "name", event.currentTarget.value)} placeholder="Warehouse 3" />
                <input value={subCompany.location} onChange={(event) => updateSubCompany(subCompany.localId, "location", event.currentTarget.value)} placeholder="Mumbai" />
                <input type="number" min="0" value={subCompany.userCount} onChange={(event) => updateSubCompany(subCompany.localId, "userCount", event.currentTarget.value)} />
                <input type="number" min="0" value={subCompany.activeTaskCount} onChange={(event) => updateSubCompany(subCompany.localId, "activeTaskCount", event.currentTarget.value)} />
                <button className="icon-button" type="button" aria-label={`Remove ${subCompany.name || "sub-company row"}`} onClick={() => removeSubCompany(subCompany.localId)} disabled={subCompanies.length === 1}>
                  <i className="ti ti-trash" />
                </button>
              </div>
            ))}
          </div>

          <div className="modal-footer-actions">
            <Button type="button" onClick={() => navigate("/companies")}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={!canSubmit}>{isEdit ? "Save changes" : "Create company"}</Button>
          </div>
        </form>
      </section>
    </main>
  );
}
