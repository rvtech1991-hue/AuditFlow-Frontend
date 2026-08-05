import { jwtDecode } from "jwt-decode";

// Standard .NET ClaimTypes URIs used by the backend's JWT — see BACKEND_INTEGRATION_GUIDE SS5.
const CLAIM_URIS = {
  userId: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier",
  email: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
  role: "http://schemas.microsoft.com/ws/2008/06/identity/claims/role",
} as const;

const ALL_ZEROS_TENANT_GUID = "00000000-0000-0000-0000-000000000000";

type RawClaims = Record<string, string | string[] | undefined>;

export type DecodedAccessToken = {
  userId: string;
  email: string;
  /** Backend role string, e.g. "Auditor" — map through roleMapping before using in UI. */
  role: string;
  /** Null for PlatformAdmin (all-zeros GUID normalized to null). */
  tenantId: string | null;
  fullName: string;
  companyId?: string;
  subCompanyId?: string;
  mappedCompanyIds: string[];
};

function getClaim(claims: RawClaims, key: string): string | undefined {
  const value = claims[key];
  return Array.isArray(value) ? value[0] : value;
}

function getClaimArray(claims: RawClaims, key: string): string[] {
  const value = claims[key];
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export function decodeAccessToken(accessToken: string): DecodedAccessToken {
  const claims = jwtDecode<RawClaims>(accessToken);
  const rawTenantId = getClaim(claims, "tenant_id");

  return {
    userId: getClaim(claims, CLAIM_URIS.userId) ?? "",
    email: getClaim(claims, CLAIM_URIS.email) ?? "",
    role: getClaim(claims, CLAIM_URIS.role) ?? "",
    tenantId: !rawTenantId || rawTenantId === ALL_ZEROS_TENANT_GUID ? null : rawTenantId,
    fullName: getClaim(claims, "full_name") ?? "",
    companyId: getClaim(claims, "company_id"),
    subCompanyId: getClaim(claims, "sub_company_id"),
    mappedCompanyIds: getClaimArray(claims, "mapped_company_id"),
  };
}

export function isTokenExpired(accessToken: string): boolean {
  try {
    const { exp } = jwtDecode<{ exp?: number }>(accessToken);
    return typeof exp === "number" ? Date.now() >= exp * 1000 : false;
  } catch {
    return true;
  }
}
