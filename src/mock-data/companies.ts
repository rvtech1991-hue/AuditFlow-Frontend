export type CompanyStatus = "Active" | "Archived";

export type SubCompany = {
  id: string;
  name: string;
  location: string;
  userCount: number;
  activeTaskCount: number;
};

export type AuditCompany = {
  id: string;
  name: string;
  industry: string;
  primaryContactEmail: string;
  status: CompanyStatus;
  onboardedOn: string;
  userCount: number;
  activeTaskCount: number;
  subCompanies: SubCompany[];
};

export type CompanyInput = {
  name: string;
  industry: string;
  primaryContactEmail: string;
  subCompanies: Array<Omit<SubCompany, "id"> & { id?: string }>;
};

export const auditCompanies: AuditCompany[] = [
  {
    id: "CO-1001",
    name: "Meridian Group",
    industry: "Retail and distribution",
    primaryContactEmail: "contact@meridian.com",
    status: "Active",
    onboardedOn: "2026-01-12",
    userCount: 14,
    activeTaskCount: 6,
    subCompanies: [
      { id: "SC-1001", name: "Warehouse 3", location: "Mumbai", userCount: 5, activeTaskCount: 2 },
      { id: "SC-1002", name: "North Finance", location: "Delhi", userCount: 4, activeTaskCount: 2 },
      { id: "SC-1003", name: "South Plant", location: "Chennai", userCount: 3, activeTaskCount: 1 },
      { id: "SC-1004", name: "Corporate", location: "Bengaluru", userCount: 2, activeTaskCount: 1 },
    ],
  },
  {
    id: "CO-1002",
    name: "Kestrel Logistics",
    industry: "Logistics",
    primaryContactEmail: "ops@kestrel.com",
    status: "Active",
    onboardedOn: "2026-04-19",
    userCount: 6,
    activeTaskCount: 2,
    subCompanies: [
      { id: "SC-1005", name: "Depot East", location: "Kolkata", userCount: 3, activeTaskCount: 1 },
      { id: "SC-1006", name: "Depot West", location: "Ahmedabad", userCount: 3, activeTaskCount: 1 },
    ],
  },
  {
    id: "CO-1003",
    name: "Patel & Co.",
    industry: "Professional services",
    primaryContactEmail: "admin@patelco.com",
    status: "Active",
    onboardedOn: "2026-03-03",
    userCount: 9,
    activeTaskCount: 2,
    subCompanies: [
      { id: "SC-1007", name: "Shared Services", location: "Pune", userCount: 6, activeTaskCount: 1 },
      { id: "SC-1008", name: "Retail Audit", location: "Jaipur", userCount: 3, activeTaskCount: 1 },
    ],
  },
];

function nextNumericId(prefix: string, existingIds: string[]) {
  const max = existingIds.reduce((latest, id) => {
    const numeric = Number(id.replace(/\D/g, ""));
    return Number.isFinite(numeric) ? Math.max(latest, numeric) : latest;
  }, 1000);
  return `${prefix}-${max + 1}`;
}

function nextCompanyId() {
  return nextNumericId("CO", auditCompanies.map((company) => company.id));
}

function normalizeSubCompanies(subCompanies: CompanyInput["subCompanies"]) {
  const issuedIds = new Set(auditCompanies.flatMap((company) => company.subCompanies.map((subCompany) => subCompany.id)));
  return subCompanies
    .filter((subCompany) => subCompany.name.trim())
    .map((subCompany) => {
      const knownId = subCompany.id?.startsWith("SC-") ? subCompany.id : undefined;
      let id = knownId ?? nextNumericId("SC", Array.from(issuedIds));
      while (!knownId && issuedIds.has(id)) id = nextNumericId("SC", Array.from(issuedIds));
      issuedIds.add(id);
      return {
        id,
        name: subCompany.name.trim(),
        location: subCompany.location.trim(),
        userCount: Number(subCompany.userCount) || 0,
        activeTaskCount: Number(subCompany.activeTaskCount) || 0,
      };
    });
}

function summarizeUsers(subCompanies: SubCompany[]) {
  return subCompanies.reduce((total, subCompany) => total + subCompany.userCount, 0);
}

function summarizeTasks(subCompanies: SubCompany[]) {
  return subCompanies.reduce((total, subCompany) => total + subCompany.activeTaskCount, 0);
}

export function getCompaniesForRole(role: string) {
  if (role === "Company admin") {
    return auditCompanies.filter((company) => company.name === "Meridian Group");
  }
  return auditCompanies;
}

export function getCompanyById(companyId: string) {
  return auditCompanies.find((company) => company.id === companyId);
}

export function createCompany(input: CompanyInput) {
  const subCompanies = normalizeSubCompanies(input.subCompanies);
  const company: AuditCompany = {
    id: nextCompanyId(),
    name: input.name.trim(),
    industry: input.industry.trim(),
    primaryContactEmail: input.primaryContactEmail.trim(),
    status: "Active",
    onboardedOn: "2026-07-09",
    userCount: summarizeUsers(subCompanies),
    activeTaskCount: summarizeTasks(subCompanies),
    subCompanies,
  };
  auditCompanies.unshift(company);
  return company;
}

export function updateCompany(companyId: string, input: CompanyInput) {
  const company = getCompanyById(companyId);
  if (!company) return undefined;

  const subCompanies = normalizeSubCompanies(input.subCompanies);
  Object.assign(company, {
    name: input.name.trim(),
    industry: input.industry.trim(),
    primaryContactEmail: input.primaryContactEmail.trim(),
    userCount: summarizeUsers(subCompanies),
    activeTaskCount: summarizeTasks(subCompanies),
    subCompanies,
  });
  return company;
}

export function setCompanyStatus(companyId: string, status: CompanyStatus) {
  const company = getCompanyById(companyId);
  if (!company) return undefined;
  company.status = status;
  return company;
}

export function deleteCompany(companyId: string) {
  const index = auditCompanies.findIndex((company) => company.id === companyId);
  if (index === -1) return false;
  auditCompanies.splice(index, 1);
  return true;
}
