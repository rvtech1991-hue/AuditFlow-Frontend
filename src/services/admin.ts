import { apiClient, ApiError, type PagedResult } from "../lib/apiClient";
import { API_MODE } from "../lib/config";
import { toEndOfDayIso, toStartOfDayIso } from "../lib/dateTime";
import { createMockTenant, getMockAuditLog, getMockTenantById, getMockTenants, updateMockTenantStatus, type MockTenant } from "../mock-data/admin";

// Field names verified directly against the backend source (AdminQueries.cs, AdminCommands.cs)
// rather than guessed — see BACKEND_INTEGRATION_GUIDE SS8. Note: unlike almost everywhere else
// in the API, Plan/Status on the auditor-account *read* DTOs are plain strings ("Active",
// "Onboarding", ...), not numeric enums — but UpdateAuditorAccountCommand's Status field for
// *writes* is a real AuditorStatus enum and must be sent as a number. Two different DTOs, two
// different conventions for the same concept — easy to get backwards.
export type TenantEntry = {
  id: string;
  firmName: string;
  primaryContactEmail: string;
  companiesCount: number;
  usersCount: number;
  tasksCount: number;
  plan: string;
  status: string;
  createdAt: string;
};

export type TenantCompanySummary = { id: string; name: string; status: string; subCompaniesCount: number; usersCount: number; onboardedAt: string };
export type TenantUserSummary = { id: string; fullName: string; email: string; role: string; status: string; companyName: string; createdAt: string; lastLoginAt?: string };

export type TenantDetail = TenantEntry & {
  primaryContactName: string;
  trialEndsAt?: string;
  subscriptionEndsAt?: string;
  companies: TenantCompanySummary[];
  users: TenantUserSummary[];
};

export type PlatformHealth = {
  totalTenants: number;
  activeTenants: number;
  totalUsers: number;
  totalCompanies: number;
  // A platform-wide aggregate count, not per-tenant task content — doesn't conflict with
  // PlatformAdmin's zero-access-to-task-content boundary (SS1), which is about *which* tasks
  // exist for a given tenant, not a top-level total across the whole platform.
  totalTasks: number;
  databaseSizeBytes: number;
  lastBackupAt?: string;
  environment: string;
  version: string;
};

type RawAuditorAccountListItem = {
  id: string;
  firmName: string;
  primaryContactEmail: string;
  companiesCount: number;
  usersCount: number;
  tasksCount: number;
  plan: string;
  status: string;
  createdAt: string;
};

type RawAuditorAccountDetail = RawAuditorAccountListItem & {
  primaryContactName: string;
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
  companies: Array<{ id: string; name: string; status: string; subCompaniesCount: number; usersCount: number; onboardedAt: string }>;
  users: Array<{ id: string; fullName: string; email: string; role: string; status: string; companyName: string; createdAt: string; lastLoginAt: string | null }>;
};

function mapTenantListItem(raw: RawAuditorAccountListItem): TenantEntry {
  return { id: raw.id, firmName: raw.firmName, primaryContactEmail: raw.primaryContactEmail, companiesCount: raw.companiesCount, usersCount: raw.usersCount, tasksCount: raw.tasksCount, plan: raw.plan, status: raw.status, createdAt: raw.createdAt.slice(0, 10) };
}

function mapTenantDetail(raw: RawAuditorAccountDetail): TenantDetail {
  return {
    ...mapTenantListItem(raw),
    primaryContactName: raw.primaryContactName,
    trialEndsAt: raw.trialEndsAt ?? undefined,
    subscriptionEndsAt: raw.subscriptionEndsAt ?? undefined,
    companies: raw.companies,
    users: raw.users.map((u) => ({ ...u, lastLoginAt: u.lastLoginAt ?? undefined })),
  };
}

function mockToEntry(tenant: MockTenant): TenantEntry {
  return { id: tenant.id, firmName: tenant.firmName, primaryContactEmail: tenant.primaryContactEmail, companiesCount: tenant.companiesCount, usersCount: tenant.usersCount, tasksCount: tenant.tasksCount, plan: tenant.plan, status: tenant.status, createdAt: tenant.createdAt };
}

export async function getTenants(): Promise<TenantEntry[]> {
  if (API_MODE === "mock") return getMockTenants().map(mockToEntry);
  const data = await apiClient.get<PagedResult<RawAuditorAccountListItem>>("/admin/auditor-accounts", { pageSize: 100 });
  return data.items.map(mapTenantListItem);
}

export async function getTenantById(tenantId: string): Promise<TenantDetail | undefined> {
  if (API_MODE === "mock") {
    const tenant = getMockTenantById(tenantId);
    if (!tenant) return undefined;
    return { ...mockToEntry(tenant), primaryContactName: tenant.primaryContactName, companies: [], users: [] };
  }
  try {
    const data = await apiClient.get<RawAuditorAccountDetail>(`/admin/auditor-accounts/${tenantId}`);
    return mapTenantDetail(data);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return undefined;
    throw err;
  }
}

export type CreateTenantDraft = { firmName: string; plan: string; contactName: string; contactEmail: string };

export async function createTenant(draft: CreateTenantDraft): Promise<TenantEntry> {
  if (API_MODE === "mock") return mockToEntry(createMockTenant(draft));
  const data = await apiClient.post<RawAuditorAccountDetail>("/admin/auditor-accounts", {
    firmName: draft.firmName,
    primaryContactEmail: draft.contactEmail,
    primaryContactName: draft.contactName,
    plan: draft.plan,
  });
  return mapTenantListItem(data);
}

// Read DTOs send Status as a string ("Active", "Suspended", ...); the write DTO
// (UpdateAuditorAccountCommand) takes the real AuditorStatus enum as a number - see the note atop
// this file (SS8).
const auditorStatusEnum: Record<"Onboarding" | "Active" | "Suspended" | "Cancelled", number> = {
  Onboarding: 1,
  Active: 2,
  Suspended: 3,
  Cancelled: 4,
};

// Callers refetch the tenant list right after (its Status is the string-typed read DTO) rather
// than trust this endpoint's own response shape - UpdateAuditorAccountCommand's response DTO
// returns Status as the raw numeric enum and omits tasksCount entirely, neither of which matches
// TenantEntry, so there's nothing useful to map back here.
export async function updateTenantStatus(tenantId: string, status: "Active" | "Suspended"): Promise<void> {
  if (API_MODE === "mock") {
    updateMockTenantStatus(tenantId, status);
    return;
  }
  await apiClient.patch(`/admin/auditor-accounts/${tenantId}`, { status: auditorStatusEnum[status] });
}

export async function getPlatformHealth(): Promise<PlatformHealth> {
  if (API_MODE === "mock") {
    const tenants = getMockTenants();
    return {
      totalTenants: tenants.length,
      activeTenants: tenants.filter((t) => t.status === "Active").length,
      totalUsers: tenants.reduce((sum, t) => sum + t.usersCount, 0),
      totalCompanies: tenants.reduce((sum, t) => sum + t.companiesCount, 0),
      totalTasks: tenants.reduce((sum, t) => sum + t.tasksCount, 0),
      databaseSizeBytes: 512 * 1024 * 1024,
      environment: "Development",
      version: "mock",
    };
  }
  const data = await apiClient.get<{ totalTenants: number; activeTenants: number; totalUsers: number; totalCompanies: number; totalTasks: number; databaseSizeBytes: number; lastBackupAt: string | null; environment: string; version: string }>("/admin/health");
  return { ...data, lastBackupAt: data.lastBackupAt ?? undefined };
}

export const AUDIT_LOG_PAGE_SIZE = 25;

export type AuditLogEntry = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  userEmail?: string;
  oldValues?: string;
  newValues?: string;
  createdAt: string;
};

export type AuditLogPage = {
  items: AuditLogEntry[];
  totalCount: number;
  pageNumber: number;
  totalPages: number;
};

export type AuditLogFilters = {
  entityType?: string;
  action?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
};

type RawAuditLogEntry = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  oldValues: string | null;
  newValues: string | null;
  userEmail: string | null;
  createdAt: string;
};

function mapAuditLogEntry(raw: RawAuditLogEntry): AuditLogEntry {
  return {
    id: raw.id,
    entityType: raw.entityType,
    entityId: raw.entityId,
    action: raw.action,
    userEmail: raw.userEmail ?? undefined,
    oldValues: raw.oldValues ?? undefined,
    newValues: raw.newValues ?? undefined,
    createdAt: raw.createdAt,
  };
}

export async function getAuditLog(filters: AuditLogFilters = {}): Promise<AuditLogPage> {
  const page = filters.page ?? 1;
  if (API_MODE === "mock") return getMockAuditLog(filters, page, AUDIT_LOG_PAGE_SIZE);
  const data = await apiClient.get<PagedResult<RawAuditLogEntry>>("/admin/audit-log", {
    entityType: filters.entityType || undefined,
    action: filters.action || undefined,
    // Bare "YYYY-MM-DD" would have ASP.NET parse it as timezone-less midnight and compare directly
    // against UTC CreatedAt values — for "to" that's basically start-of-day, silently excluding
    // the entire rest of the selected day (see dateTime.ts). Converting both ends explicitly is
    // what makes "today" as both From and To actually return today's entries.
    dateFrom: filters.dateFrom ? toStartOfDayIso(filters.dateFrom) : undefined,
    dateTo: filters.dateTo ? toEndOfDayIso(filters.dateTo) : undefined,
    pageNumber: page,
    pageSize: AUDIT_LOG_PAGE_SIZE,
  });
  return { items: data.items.map(mapAuditLogEntry), totalCount: data.totalCount, pageNumber: data.pageNumber, totalPages: data.totalPages };
}
