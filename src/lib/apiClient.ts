import { API_BASE_URL } from "./config";
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "./tokenStorage";

export type ApiSuccessEnvelope<T> = {
  success: true;
  data: T;
  message: string | null;
  errors: string[];
  statusCode: number;
  correlationId: string | null;
  errorCode: string | null;
};

export type PagedResult<T> = {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

/** Standardized shape every services/*.ts call rejects with — parsed from the backend's
 * RFC 9457 ProblemDetails (or ValidationProblemDetails) error responses. UI code should
 * branch on `errorCode`, not `detail` (see BACKEND_INTEGRATION_GUIDE §4). */
export class ApiError extends Error {
  readonly status: number;
  readonly errorCode: string;
  readonly detail: string;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(params: { status: number; errorCode: string; detail: string; fieldErrors?: Record<string, string[]> }) {
    super(params.detail);
    this.name = "ApiError";
    this.status = params.status;
    this.errorCode = params.errorCode;
    this.detail = params.detail;
    this.fieldErrors = params.fieldErrors;
  }
}

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

/** Registered once by the auth module at app startup — invoked when refresh itself fails,
 * so apiClient can trigger sign-out without importing RoleContext/auth service directly. */
export function setUnauthorizedHandler(handler: UnauthorizedHandler): void {
  unauthorizedHandler = handler;
}

async function parseErrorResponse(response: Response): Promise<ApiError> {
  let body: Record<string, unknown> | null = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!body) {
    return new ApiError({
      status: response.status,
      errorCode: "UNKNOWN_ERROR",
      detail: response.statusText || "An unexpected error occurred.",
    });
  }

  const errorCode = typeof body.errorCode === "string" ? body.errorCode : "UNKNOWN_ERROR";
  const detail = typeof body.detail === "string" ? body.detail : typeof body.title === "string" ? body.title : "An unexpected error occurred.";
  const fieldErrors = isFieldErrorsShape(body.errors) ? body.errors : undefined;

  return new ApiError({ status: response.status, errorCode, detail, fieldErrors });
}

function isFieldErrorsShape(value: unknown): value is Record<string, string[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every((v) => Array.isArray(v));
}

function buildUrl(path: string, params?: Record<string, unknown>): string {
  const url = new URL(API_BASE_URL.replace(/\/$/, "") + "/" + path.replace(/^\//, ""));
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

let refreshPromise: Promise<boolean> | null = null;

/** Ensures concurrent 401s from a burst of in-flight requests trigger exactly one
 * refresh call, not one per request (single-flight). */
async function refreshAccessToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) return false;

      try {
        const response = await fetch(buildUrl("/auth/refresh"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        if (!response.ok) return false;

        const envelope = (await response.json()) as ApiSuccessEnvelope<{ accessToken: string; refreshToken: string }>;
        setTokens(envelope.data.accessToken, envelope.data.refreshToken);
        return true;
      } catch {
        return false;
      }
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  params?: Record<string, unknown>;
  body?: unknown;
  /** Pass a FormData body as-is (file uploads) instead of JSON-encoding it. */
  isFormData?: boolean;
  /** Internal — prevents infinite retry loops after a refresh attempt. */
  _isRetry?: boolean;
  /** Public, pre-login endpoints (sign-in, forgot/reset password, invite validate/accept) must
   * never send whatever access token happens to be sitting in localStorage from a *different*,
   * unrelated session in the same browser — the backend's tenant-scoped query filters key off
   * "is there any authenticated principal at all", so a stale token silently made otherwise-valid
   * requests (e.g. looking up an invite by its own secret token) fail as if the resource didn't
   * exist. Also skips the 401-triggered refresh/sign-out flow, which doesn't apply here either. */
  skipAuth?: boolean;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", params, body, isFormData, _isRetry, skipAuth } = options;

  const headers: Record<string, string> = {};
  if (!skipAuth) {
    const accessToken = getAccessToken();
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  }
  if (!isFormData) headers["Content-Type"] = "application/json";

  const response = await fetch(buildUrl(path, params), {
    method,
    headers,
    body: body === undefined ? undefined : isFormData ? (body as FormData) : JSON.stringify(body),
  });

  if (response.status === 401 && !_isRetry && !skipAuth) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return request<T>(path, { ...options, _isRetry: true });
    }
    clearTokens();
    unauthorizedHandler?.();
    throw await parseErrorResponse(response);
  }

  if (!response.ok) {
    throw await parseErrorResponse(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  // File-download endpoints (§8, Files) return raw bytes, not the success envelope.
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return (await response.blob()) as unknown as T;
  }

  const envelope = (await response.json()) as ApiSuccessEnvelope<T>;
  return envelope.data;
}

export const apiClient = {
  get: <T>(path: string, params?: Record<string, unknown>, options?: { skipAuth?: boolean }) =>
    request<T>(path, { method: "GET", params, skipAuth: options?.skipAuth }),
  post: <T>(path: string, body?: unknown, params?: Record<string, unknown>, options?: { skipAuth?: boolean }) =>
    request<T>(path, { method: "POST", body, params, skipAuth: options?.skipAuth }),
  put: <T>(path: string, body?: unknown, params?: Record<string, unknown>) => request<T>(path, { method: "PUT", body, params }),
  patch: <T>(path: string, body?: unknown, params?: Record<string, unknown>) => request<T>(path, { method: "PATCH", body, params }),
  delete: <T>(path: string, params?: Record<string, unknown>) => request<T>(path, { method: "DELETE", params }),
  postForm: <T>(path: string, formData: FormData) => request<T>(path, { method: "POST", body: formData, isFormData: true }),
};
