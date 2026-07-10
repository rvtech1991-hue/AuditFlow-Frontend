# AuditFlow Component Foundation

This project foundation includes the shared UI and layout primitives from `AuditFlow-Requirements.docx` sections 2 and 3. No feature screens are implemented yet; routes render placeholders so navigation can be exercised end to end.

## Design Tokens

Implemented in `src/index.css` as CSS variables and wired into `tailwind.config.ts`.

- Navy sidebar palette: `--navy-950`, `--navy-900`, `--navy-800`, `--navy-700`
- Accent blue: `--accent`, `--accent-600`, `--accent-100`
- App neutrals: `--bg`, `--surface`, `--border`, `--text`, `--text-muted`, `--text-faint`
- Status pairs: `--success`/`--success-bg`, `--warning`/`--warning-bg`, `--danger`/`--danger-bg`
- Inter font stack and §3 type scale: page title, card title, body/table text, eyebrow labels
- Shell spacing, card/input/modal radii, and card/accent/modal/menu shadows

## Layout

- `AppShell`: fixed 220px dark sidebar plus fluid main area with 26px/30px desktop padding.
- `Sidebar`: grouped navigation under Workspace, Manage, and Platform; active item fill plus 3px accent bar; footer avatar/name/role.
- `Topbar`: title/subtitle, global search, notification bell with unread dot, mock role switcher, profile avatar.
- Responsive behavior: below 860px the sidebar becomes a horizontal scrollable top nav; grids and paired fields collapse on smaller widths.

## UI Components

- `Card`: white surface, 14px radius, border, soft shadow, 18/20px padding.
- `Badge`: status pill with dot for `open`, `progress`, `overdue`, `closed`, `active`, and `invited`.
- `Chip`: neutral and active filter pill states.
- `Button`: default, primary gradient, and compact small variant.
- `FormField` and `FieldRow`: label/input/select/textarea with focus treatment and 2-up field rows.
- `Table` and `CellPerson`: grid-table styling, row hover tint, uppercase muted headers, initials avatar + name pattern.
- `Modal`: centered panel on tinted backdrop with header close button and Cancel/Primary footer.
- `Toggle`: pill switch with accent on-state.
- `RowActionMenu`: `···` trigger with anchored dropdown, optional divider, neutral and destructive actions.
- `DonutChart`: inline SVG stroked-circle donut using CSS token colors.
- `TrendChart`: inline SVG line/area chart using CSS token colors.

## Routing And Roles

- `RoleContext`: hardcoded mock auth state, defaulting to `Auditor`, with runtime role switching for menu visibility testing.
- Sidebar menu visibility follows the §2 menu-to-role matrix.
- Placeholder routes exist for the 17 required screens, including public auth/invite routes and platform admin tenant management.

## Module 2 Auth Screens

- `SignInPage`: mockup-matched split-screen sign-in shell with rotating testimonial, work email, password, keep-signed-in checkbox, forgot-password link, primary sign-in button, and no-self-signup footnote.
- `AcceptInvitePage`: same split shell with dynamic invite copy, disabled pre-filled email, create/confirm password, 10-character minimum validation, and account activation.
- `ForgotPasswordPage`: same visual language, email-entry state, and confirmation state after submitting.
- `AuthShell`: shared browser chrome, brand panel, testimonial area, and right-side form container for public auth flows.
- Route guard: unauthenticated users are redirected to `/signin` from protected app routes; public routes remain `/signin`, `/invite/accept`, and `/forgot-password`.

## Module 3 Dashboard

- `DashboardPage`: real `/dashboard` implementation with Standard and Executive views. Executive is selected with `/dashboard?view=executive`; the existing `/dashboard/executive` route also renders it.
- Standard view: dismissible announcement, four stat cards, weekly tasks table with task click-through, and task status breakdown donut.
- Executive view: topbar segmented Standard/Executive toggle, global filter bar, KPI cards, trend chart, status-mix donut, company health progress bars, highest-risk list, and team workload bars.
- Mock data: `src/mock-data/dashboard.ts` supplies realistic tasks, companies, trend deltas, and workload values.
- Role behavior: Company admins see Executive scoped to one company with the Company filter locked; Employees are kept on Standard view.
