# AuditFlow Frontend — Instructions for Claude

Full context lives in [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) (product vision, roles, both repos' architecture, conventions, known gaps) and [`ARCHITECTURE.md`](./ARCHITECTURE.md) (diagrams). **Read both before starting any non-trivial task** — they exist specifically so context doesn't need to be re-explained or re-derived by scanning the codebase each session. Below is the condensed version for quick orientation; the two files above are authoritative on any detail.

## What this is

Multi-tenant SaaS for audit firms. Hierarchy: `Tenant (audit firm) → Company (client) → SubCompany → Users`. Four roles: **Platform admin** (manages tenants, zero access to audit content), **Auditor** (full tenant access, creates/closes tasks), **Company admin** (view-only tasks, manages own company's users), **Employee** (works assigned tasks only).

Two repos, developed together:
- **This repo** — React 19 + Vite SPA.
- **Backend** — `C:\Rakesh\My Workspace\My Developments\Projects\AuditFlow-Backend\AuditFlow-Backend\AuditFlow-Backend`, .NET 8 Clean Architecture. Run: `dotnet run --project src/AuditFlow.API --urls http://localhost:5298`.

Shared docs: `Documents\4 - BACKEND_INTEGRATION_GUIDE.md` (in this repo) is the authoritative API contract reference (JWT claims, enum-over-the-wire behavior, error envelope, endpoint↔screen map) — cited by section number throughout `src/services/*.ts`.

## Critical things not to get wrong

- **Real entry point is `src/main.tsx`** (Vite SPA). `next.config.js`, `app/`, `src/App.jsx`, `src/main.jsx`, `vite.config.js`, `tailwind.config.js` are dead leftovers from an abandoned Next.js scaffold — never edit or build against them.
- **Every `src/services/*.ts` function branches on `VITE_API_MODE`** (`mock` → `src/mock-data/*.ts`, `live` → `apiClient`). Preserve this pattern for new functions; don't remove the mock path without the user's explicit go-ahead.
- **Backend enums are plain integers over JSON**, never strings — always go through `src/lib/*Mapping.ts` (task status/priority, role, notification kind), never assume a string value.
- **`"overdue"` is a synthetic, client-only status** — never sent to or received from the backend.
- **Company admin is view-only on Tasks and Companies** (deliberate, server-enforced) — don't reintroduce write UI for them based on an older doc.
- **Tenant/company/assignee scoping is enforced server-side** (EF global query filter + `ITenantScopeService`); `src/lib/routes.ts` role gating is a UX layer on top, not the real security boundary — don't treat frontend route guards as sufficient for anything security-sensitive.
- Branch on `ApiError.errorCode`, never on `.detail` text, when handling API errors.

## Working conventions

- TanStack Query is the only data/cache layer — don't introduce another.
- Follow the existing `RawXxx` type + `mapXxx()` converter split in services files rather than consuming backend DTOs directly in components.
- No test framework or linter is configured in this repo currently.
- After any change that shifts architecture, conventions, or the known-gaps list, update the relevant section of `PROJECT_CONTEXT.md`/`ARCHITECTURE.md` directly rather than leaving them to go stale.
- These docs are dated snapshots (last synced 2026-08-07, backend commit `72e2130`) — for anything load-bearing, verify against current code rather than trusting the doc blindly, especially the "known gaps" lists.
