import { apiClient, ApiError, type PagedResult } from "../lib/apiClient";
import { API_MODE } from "../lib/config";
import {
  createCompany as mockCreateCompany,
  deleteCompany as mockDeleteCompany,
  getCompaniesForRole as mockGetCompaniesForRole,
  getCompanyById as mockGetCompanyById,
  updateCompany as mockUpdateCompany,
  type CompanyInput,
} from "../mock-data/companies";
import type { Role } from "../types";

export type SubCompanyEntry = {
  id: string;
  name: string;
  location: string;
  userCount: number;
  activeTaskCount: number;
};

export type CompanyEntry = {
  id: string;
  name: string;
  industry: string;
  primaryContactEmail: string;
  status: "Active" | "Archived";
  onboardedOn: string;
  userCount: number;
  activeTaskCount: number;
  subCompanyCount: number;
  // Full list when available (always populated in mock mode and by getCompanyById; the live
  // list endpoint only returns subCompanyCount, not the nested rows — see mapCompanyListItem).
  subCompanies: SubCompanyEntry[];
};

export type CompanyStatistics = {
  totalSubCompanies: number;
  activeSubCompanies: number;
  totalUsers: number;
  activeUsers: number;
  totalTasks: number;
  openTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  completedThisMonth: number;
};

export type BulkImportResult = {
  totalRows: number;
  successfulRows: number;
  failedRows: number;
  errors: Array<{ rowNumber: number; field: string; message: string }>;
};

// Field names verified directly against the backend source (CompanyDtos.cs,
// CompanyQueries.cs, CompanyCommands.cs) rather than guessed — see BACKEND_INTEGRATION_GUIDE SS8.
type RawSubCompanyListItem = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  userCount: number;
  taskCount: number;
  createdAt: string;
};

type RawCompanyListItem = {
  id: string;
  name: string;
  industry: string | null;
  status: number;
  onboardedAt: string | null;
  subCompanyCount: number;
  userCount: number;
  taskCount: number;
  createdAt: string;
};

type RawCompanyDetail = RawCompanyListItem & {
  primaryContactEmail: string | null;
  description: string | null;
  subCompanies: RawSubCompanyListItem[];
};

function mapCompanyStatus(value: number): "Active" | "Archived" {
  // CompanyStatus: 1 Active, 2 Inactive, 3 Onboarding — the frontend only distinguishes
  // Active/Archived, so "Onboarding" is treated as active rather than invented as a third state.
  return value === 2 ? "Archived" : "Active";
}

function mapSubCompany(raw: RawSubCompanyListItem): SubCompanyEntry {
  return {
    id: raw.id,
    name: raw.name,
    // The backend has no "location" field on a sub-company — `description` is the closest
    // free-text field available, reused here (unverified against a live response).
    location: raw.description ?? "",
    userCount: raw.userCount,
    activeTaskCount: raw.taskCount,
  };
}

function mapCompanyListItem(raw: RawCompanyListItem): CompanyEntry {
  return {
    id: raw.id,
    name: raw.name,
    industry: raw.industry ?? "",
    primaryContactEmail: "",
    status: mapCompanyStatus(raw.status),
    onboardedOn: (raw.onboardedAt ?? raw.createdAt).slice(0, 10),
    userCount: raw.userCount,
    activeTaskCount: raw.taskCount,
    subCompanyCount: raw.subCompanyCount,
    subCompanies: [],
  };
}

function mapCompanyDetail(raw: RawCompanyDetail): CompanyEntry {
  return {
    ...mapCompanyListItem(raw),
    primaryContactEmail: raw.primaryContactEmail ?? "",
    subCompanies: raw.subCompanies.map(mapSubCompany),
  };
}

function mockToEntry(company: ReturnType<typeof mockGetCompaniesForRole>[number]): CompanyEntry {
  return { ...company, subCompanyCount: company.subCompanies.length };
}

export async function getCompaniesForRole(role: Role): Promise<CompanyEntry[]> {
  if (API_MODE === "mock") {
    return mockGetCompaniesForRole(role).map(mockToEntry);
  }
  const data = await apiClient.get<PagedResult<RawCompanyListItem>>("/companies", { pageSize: 100 });
  return data.items.map(mapCompanyListItem);
}

export async function getCompanyById(companyId: string): Promise<CompanyEntry | undefined> {
  if (API_MODE === "mock") {
    const company = mockGetCompanyById(companyId);
    return company ? mockToEntry(company) : undefined;
  }
  try {
    const data = await apiClient.get<RawCompanyDetail>(`/companies/${companyId}`);
    return mapCompanyDetail(data);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return undefined;
    throw err;
  }
}

export async function createCompany(input: CompanyInput): Promise<CompanyEntry> {
  if (API_MODE === "mock") {
    return mockToEntry(mockCreateCompany(input));
  }
  const created = await apiClient.post<RawCompanyDetail>("/companies", {
    name: input.name,
    industry: input.industry || undefined,
    primaryContactEmail: input.primaryContactEmail || undefined,
    subCompanies: input.subCompanies.filter((sc) => sc.name.trim()).map((sc) => ({ name: sc.name, description: sc.location || undefined })),
  });
  return mapCompanyDetail(created);
}

export async function updateCompany(companyId: string, input: CompanyInput): Promise<CompanyEntry> {
  if (API_MODE === "mock") {
    const updated = mockUpdateCompany(companyId, input);
    if (!updated) throw new ApiError({ status: 404, errorCode: "NOT_FOUND", detail: "Company not found." });
    return mockToEntry(updated);
  }
  await apiClient.patch(`/companies/${companyId}`, {
    name: input.name,
    industry: input.industry || undefined,
    primaryContactEmail: input.primaryContactEmail || undefined,
  });
  await syncSubCompanies(companyId, input.subCompanies);
  const detail = await apiClient.get<RawCompanyDetail>(`/companies/${companyId}`);
  return mapCompanyDetail(detail);
}

/** There's no bulk "replace all sub-companies" endpoint — PATCH /companies/{id} doesn't touch
 * sub-companies at all, so an edit has to be reconciled against the three dedicated sub-company
 * endpoints (add/update/delete) individually. */
async function syncSubCompanies(companyId: string, drafts: CompanyInput["subCompanies"]): Promise<void> {
  const existing = await apiClient.get<PagedResult<RawSubCompanyListItem>>(`/companies/${companyId}/sub-companies`, { pageSize: 200 });
  const existingIds = new Set(existing.items.map((sc) => sc.id));
  const keptIds = new Set(drafts.map((d) => d.id).filter((id): id is string => Boolean(id)));

  const deletions = existing.items.filter((sc) => !keptIds.has(sc.id)).map((sc) => apiClient.delete(`/companies/${companyId}/sub-companies/${sc.id}`));
  const upserts = drafts
    .filter((draft) => draft.name.trim())
    .map((draft) =>
      draft.id && existingIds.has(draft.id)
        ? apiClient.patch(`/companies/${companyId}/sub-companies/${draft.id}`, { name: draft.name, description: draft.location || undefined, isActive: true })
        : apiClient.post(`/companies/${companyId}/sub-companies`, { name: draft.name, description: draft.location || undefined }),
    );

  await Promise.all([...deletions, ...upserts]);
}

export async function deleteCompany(companyId: string): Promise<void> {
  if (API_MODE === "mock") {
    mockDeleteCompany(companyId);
    return;
  }
  await apiClient.delete(`/companies/${companyId}`);
}

export async function getCompanyStatistics(companyId: string): Promise<CompanyStatistics> {
  if (API_MODE === "mock") {
    const company = mockGetCompanyById(companyId);
    const subCompanyCount = company?.subCompanies.length ?? 0;
    return {
      totalSubCompanies: subCompanyCount,
      activeSubCompanies: subCompanyCount,
      totalUsers: company?.userCount ?? 0,
      activeUsers: company?.userCount ?? 0,
      totalTasks: company?.activeTaskCount ?? 0,
      openTasks: company?.activeTaskCount ?? 0,
      inProgressTasks: 0,
      overdueTasks: 0,
      completedThisMonth: 0,
    };
  }
  return apiClient.get<CompanyStatistics>(`/companies/${companyId}/statistics`);
}

/** Only works once the company already exists — see BACKEND_INTEGRATION_GUIDE SS8. No UI in
 * this app currently triggers a CSV import (CompanyFormPage has no such affordance), so this is
 * unused for now; built for completeness against the documented endpoint. */
export async function bulkImportSubCompanies(companyId: string, file: File): Promise<BulkImportResult> {
  if (API_MODE === "mock") {
    return { totalRows: 0, successfulRows: 0, failedRows: 0, errors: [] };
  }
  const formData = new FormData();
  formData.append("file", file);
  return apiClient.postForm<BulkImportResult>(`/companies/${companyId}/sub-companies/bulk-import`, formData);
}
