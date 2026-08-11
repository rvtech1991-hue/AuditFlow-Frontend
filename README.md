# AuditFlow — Frontend

React 19 + Vite SPA for AuditFlow, a multi-tenant SaaS platform audit firms use to track audit findings ("Tasks") raised against the companies they audit, from discovery through auditor sign-off.

**New to this project?** Start with [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) — full product vision, tenancy/role model, and both frontend and backend architecture in one place. See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for diagrams (system topology, request lifecycle, auth flow, module map).

## Quickstart

```bash
npm install
npm run dev       # http://localhost:5173
```

By default the app runs against **mock data** — no backend required. See [Modes](#modes) to point it at a real backend.

## Scripts

```bash
npm run dev        # Vite dev server
npm run build       # tsc type-check + production build → dist/
npm run preview     # serve the dist/ build locally
```

## Modes

Controlled by `.env.local` (copy from `.env.example`):

| Var | Values | Purpose |
|---|---|---|
| `VITE_API_MODE` | `mock` \| `live` | `mock` serves everything from `src/mock-data/*.ts` + localStorage fake auth (with a role-switcher in the topbar). `live` calls the real backend. |
| `VITE_API_BASE_URL` | e.g. `http://localhost:5298/api/v1` | Backend base URL, only used in `live` mode. |

To run against the real backend, start it separately:

```bash
cd "../../AuditFlow-Backend/AuditFlow-Backend/AuditFlow-Backend"
dotnet run --project src/AuditFlow.API --urls http://localhost:5298
```

Seed test accounts (password `TestPass123!`): `auditor@seed.test`, `companyadmin@seed.test`, `employee@seed.test`, `platformadmin@seed.test`.

## Stack

React 19 · React Router 7 · TanStack Query 5 · TypeScript · Vite 6 · Tailwind CSS. No test framework or linter is currently configured.

> Note: this repo also contains a `next.config.js`, `app/`, `src/App.jsx`/`src/main.jsx`, `vite.config.js`, `tailwind.config.js` — these are **dead leftovers** from an abandoned Next.js scaffold and are not part of the running app. The real entry point is `src/main.tsx`; real configs are the `.ts` variants (`vite.config.ts`, `tailwind.config.ts`, `tsconfig.app.json`).

## Project layout

```
src/
  main.tsx           # app entry: providers + routing
  lib/                # routing table, API client, auth/token/JWT, enum mappings
  services/           # one file per backend module — mock/live branch per function
  mock-data/          # fixtures used in VITE_API_MODE=mock
  components/ui/       # design-system primitives (Button, Table, Modal, ...)
  components/layout/   # AppShell, Sidebar, Topbar, AuthShell, PlatformAdminShell
  pages/               # one file (or a few) per route
  types/               # shared TS types
```

## Docs

- [`CLAUDE.md`](./CLAUDE.md) — condensed instructions auto-loaded by Claude Code each session; points into the two files below.
- [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) — product vision, roles/tenancy model, full frontend + backend architecture, known gaps, conventions.
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — diagrams: system overview, backend layers, request lifecycle, multi-tenancy scoping, auth flow, routing, data model, module map.
- [`src/components/README.md`](./src/components/README.md) — UI foundation / design token build notes.
- [`Documents/4 - BACKEND_INTEGRATION_GUIDE.md`](./Documents/4%20-%20BACKEND_INTEGRATION_GUIDE.md) — the authoritative API contract reference — read it before any backend integration work. The `Documents/` folder also holds the original requirements doc, API spec, visual mockup, architecture/database/auth-testing references, and the product blueprint — browse it directly for the full set.
