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

export function updateMockTenantStatus(id: string, status: "Active" | "Suspended"): MockTenant {
  const tenant = mockTenants.find((t) => t.id === id);
  if (!tenant) throw new Error("Tenant not found");
  tenant.status = status;
  return tenant;
}

export type MockAuditLogEntry = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  oldValues?: string;
  newValues?: string;
  userEmail?: string;
  createdAt: string;
};

const mockAuditLog: MockAuditLogEntry[] = [
  { id: "AL-1", entityType: "Tenant", entityId: "TEN-1003", action: "TenantCreated", userEmail: "platformadmin@seed.test", createdAt: "2026-07-04T09:12:00Z" },
  { id: "AL-2", entityType: "ApplicationUser", entityId: "USR-2201", action: "UserDeactivated", oldValues: "{\"status\":\"Active\"}", newValues: "{\"status\":\"Deactivated\"}", userEmail: "r.sharma@auditfirm.com", createdAt: "2026-07-18T14:03:00Z" },
  { id: "AL-3", entityType: "Tenant", entityId: "TEN-1002", action: "TenantStatusChanged", oldValues: "{\"status\":\"Onboarding\"}", newValues: "{\"status\":\"Active\"}", userEmail: "platformadmin@seed.test", createdAt: "2026-07-22T11:47:00Z" },
  { id: "AL-4", entityType: "ApplicationUser", entityId: "USR-3110", action: "UserActivated", oldValues: "{\"status\":\"Deactivated\"}", newValues: "{\"status\":\"Active\"}", userEmail: "contact@nairaudit.com", createdAt: "2026-08-02T08:30:00Z" },
  { id: "AL-5", entityType: "Tenant", entityId: "TEN-1001", action: "Impersonation", userEmail: "platformadmin@seed.test", createdAt: "2026-08-09T16:21:00Z" },
];

export function getMockAuditLog(
  filters: { entityType?: string; action?: string; dateFrom?: string; dateTo?: string },
  page: number,
  pageSize: number,
): { items: MockAuditLogEntry[]; totalCount: number; pageNumber: number; totalPages: number } {
  let entries = mockAuditLog;
  if (filters.entityType) entries = entries.filter((e) => e.entityType === filters.entityType);
  if (filters.action) entries = entries.filter((e) => e.action === filters.action);
  if (filters.dateFrom) entries = entries.filter((e) => e.createdAt >= filters.dateFrom!);
  if (filters.dateTo) entries = entries.filter((e) => e.createdAt <= `${filters.dateTo}T23:59:59Z`);
  entries = [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const start = (page - 1) * pageSize;
  const items = entries.slice(start, start + pageSize);
  const totalPages = Math.max(1, Math.ceil(entries.length / pageSize));
  return { items, totalCount: entries.length, pageNumber: page, totalPages };
}
