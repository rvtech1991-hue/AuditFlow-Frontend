export type ApiMode = "mock" | "live";

export const API_MODE: ApiMode = (import.meta.env.VITE_API_MODE as ApiMode | undefined) ?? "mock";

export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5298/api/v1";

export const isLiveApi = API_MODE === "live";

// Matches the backend's FileStorage:MaxFileSizeMB (appsettings.json) — kept in sync manually
// since the two run as separate deployments with no shared config source.
export const MAX_UPLOAD_SIZE_MB = 10;
export const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024;
