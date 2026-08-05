export type MockTenant = {
  id: string;
  firmName: string;
  primaryContactEmail: string;
  primaryContactName: string;
  companiesCount: number;
  usersCount: number;
  tasksCount: number;
  plan: string;
  status: "Active" | "Onboarding" | "Suspended" | "Cancelled";
  createdAt: string;
  storageLabel: string;
};

export const mockTenants: MockTenant[] = [
  { id: "TEN-1001", firmName: "Sharma & Associates", primaryContactEmail: "r.sharma@auditfirm.com", primaryContactName: "Rhea Sharma", companiesCount: 3, usersCount: 29, tasksCount: 428, plan: "Growth", status: "Active", createdAt: "2026-01-12", storageLabel: "4.8 GB of 25 GB" },
  { id: "TEN-1002", firmName: "Nair Audit Partners", primaryContactEmail: "contact@nairaudit.com", primaryContactName: "Nikhil Nair", companiesCount: 7, usersCount: 64, tasksCount: 1186, plan: "Scale", status: "Active", createdAt: "2026-03-28", storageLabel: "12.6 GB of 100 GB" },
  { id: "TEN-1003", firmName: "Patel & Co.", primaryContactEmail: "admin@patelco.com", primaryContactName: "Pooja Patel", companiesCount: 2, usersCount: 11, tasksCount: 23, plan: "Starter", status: "Onboarding", createdAt: "2026-07-04", storageLabel: "0.4 GB of 10 GB" },
];

export function getMockTenants(): MockTenant[] {
  return mockTenants;
}

export function getMockTenantById(id: string): MockTenant | undefined {
  return mockTenants.find((t) => t.id === id);
}

function nextTenantId() {
  const max = mockTenants.reduce((latest, t) => {
    const numeric = Number(t.id.replace(/\D/g, ""));
    return Number.isFinite(numeric) ? Math.max(latest, numeric) : latest;
  }, 1000);
  return `TEN-${max + 1}`;
}

export function createMockTenant(input: { firmName: string; plan: string; contactName: string; contactEmail: string }): MockTenant {
  const tenant: MockTenant = {
    id: nextTenantId(),
    firmName: input.firmName,
    primaryContactEmail: input.contactEmail,
    primaryContactName: input.contactName,
    companiesCount: 0,
    usersCount: 0,
    tasksCount: 0,
    plan: input.plan,
    status: "Onboarding",
    createdAt: new Date().toISOString().slice(0, 10),
    storageLabel: "0 GB of 10 GB",
  };
  mockTenants.unshift(tenant);
  return tenant;
}
