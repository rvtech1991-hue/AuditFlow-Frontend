import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, Card, CellPerson, DonutChart, Table, Toast, Tooltip, TrendChart, type ToastState } from "../components/ui";
import type { DashboardTask } from "../mock-data/dashboard";
import { useRole } from "../lib/RoleContext";
import { todayDateInputValue } from "../lib/dateTime";
import {
  AUDIT_TASK_STATUS_ENUM,
  CHECKLIST_ITEM_STATUS_ENUM,
  exportExecutiveDashboardPdf,
  getAnnouncements,
  getDashboardCompanyScope,
  getExecutiveAging,
  getExecutiveCompanyHealth,
  getExecutiveKpis,
  getExecutiveReviewerPerformance,
  getExecutiveRiskTasks,
  getExecutiveStatusMix,
  getExecutiveTeamWorkload,
  getExecutiveTrend,
  getMyDay,
  getStatusBreakdown,
  getSummary,
  getWeeklyTasks,
  type ExecutiveFilters,
  type MyDayItem,
  type TrendPoint,
} from "../services/dashboard";
import { changeTaskStatus } from "../services/tasks";
import { updateChecklistItemStatus } from "../services/checklist";
import { mapChecklistItemStatusEnum, type ChecklistItemStatus } from "../lib/checklistMapping";
import { ApiError } from "../lib/apiClient";

function triggerDashboardDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2);
}

// `dueInDays` rounds toward zero for anything overdue by less than a full 24h, so a task overdue
// by a few hours reads as "0d overdue" — technically correct math, but "0" implies nothing's
// wrong on a red at-risk badge. Below a full day, say so in words instead of a misleading count.
function formatOverdueLabel(dueInDays: number) {
  const days = Math.abs(dueInDays);
  return days === 0 ? "Overdue today" : `${days}d overdue`;
}

function StatCard({ label, value, delta, tone = "default", progress, onClick, active }: { label: string; value: number | string; delta?: string; tone?: "default" | "hero" | "danger"; progress?: number; onClick?: () => void; active?: boolean }) {
  const Tag = onClick ? "button" : "section";
  return (
    <Tag className={`stat-card ${tone} ${onClick ? "is-clickable" : ""} ${active ? "is-active" : ""}`} type={onClick ? "button" : undefined} onClick={onClick}>
      <span className="stat-label">{label}</span>
      <strong>{value}</strong>
      {progress !== undefined ? <span className="stat-progress"><span style={{ width: `${progress}%` }} /></span> : null}
      {delta ? <span className="stat-delta">{delta}</span> : null}
    </Tag>
  );
}

function Legend({ items }: { items: Array<{ label: string; value: number; color: string; onClick?: () => void; active?: boolean }> }) {
  return (
    <div className="chart-legend">
      {items.map((item) => {
        const Tag = item.onClick ? "button" : "div";
        return (
          <Tag className={`legend-row ${item.onClick ? "is-clickable" : ""} ${item.active ? "is-active" : ""}`} type={item.onClick ? "button" : undefined} key={item.label} onClick={item.onClick}>
            <span className="legend-dot" style={{ background: item.color }} />
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </Tag>
        );
      })}
    </div>
  );
}

function DashboardBadge({ kind }: { kind: "new" | "enhanced" }) {
  return <span className={`dashboard-badge is-${kind}`}>{kind === "new" ? "New" : "Enhanced"}</span>;
}

// Fixed severity order (not alphabetical) so the bar list always reads worst-to-best top-to-bottom,
// paired with the --sev-1..4 escalation ramp (light/low -> dark/critical) from index.css.
const PRIORITY_ORDER: Array<{ key: "Critical" | "High" | "Medium" | "Low"; color: string }> = [
  { key: "Critical", color: "var(--sev-4)" },
  { key: "High", color: "var(--sev-3)" },
  { key: "Medium", color: "var(--sev-2)" },
  { key: "Low", color: "var(--sev-1)" },
];

const AGING_LABELS: Record<string, string> = { "0-7": "0–7 days", "8-14": "8–14 days", "15-30": "15–30 days", "30+": "30+ days" };
const AGING_COLORS: Record<string, string> = { "0-7": "var(--sev-1)", "8-14": "var(--sev-2)", "15-30": "var(--sev-3)", "30+": "var(--sev-4)" };

// Net created-minus-closed per period, rendered as a diverging strip beneath the trend line so
// "is the backlog growing or shrinking" reads at a glance instead of requiring mental subtraction
// of two overlapping lines. Derived entirely from data the trend chart already fetched — no extra
// request.
function BacklogStrip({ points }: { points: TrendPoint[] }) {
  if (!points.length) return null;
  const nets = points.map((p) => p.created - p.closed);
  const maxAbs = Math.max(1, ...nets.map((n) => Math.abs(n)));

  return (
    <>
      <div className="backlog-strip" style={{ gridTemplateColumns: `repeat(${points.length}, 1fr)` }}>
        {nets.map((net, index) => {
          const pct = Math.max(10, Math.round((Math.abs(net) / maxAbs) * 42));
          return (
            <div
              className="backlog-bar"
              key={points[index].period}
              title={`${points[index].period}: ${net >= 0 ? "+" : ""}${net} (${net >= 0 ? "backlog grew" : "backlog shrank"})`}
            >
              <span className="zero-line" />
              <span
                className="fill"
                style={{
                  background: net >= 0 ? "var(--danger)" : "var(--success)",
                  top: net >= 0 ? `${50 - pct}%` : "50%",
                  bottom: net >= 0 ? "50%" : `${50 - pct}%`,
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="backlog-legend">
        <span><i style={{ background: "var(--danger)" }} />Backlog grew</span>
        <span><i style={{ background: "var(--success)" }} />Backlog shrank</span>
      </div>
    </>
  );
}

function sevClassForPriority(priority: MyDayItem["priority"]): string {
  if (priority === "Critical") return "sev-4";
  if (priority === "High") return "sev-3";
  if (priority === "Medium") return "sev-2";
  return "sev-1"; // Low, or a Personal item with no priority at all
}

function formatDueLabel(dueDate: string, isOverdue: boolean): string {
  const due = new Date(dueDate);
  const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
  const dueDayStart = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  if (isOverdue) {
    // Diff calendar-day boundaries, not raw timestamps — a task due at 11pm yesterday and one due
    // at 1am yesterday are both "1d overdue" today, even though they're 22 hours apart in real time.
    const diffDays = Math.round((todayStart.getTime() - dueDayStart.getTime()) / 86_400_000);
    return formatOverdueLabel(diffDays);
  }
  if (dueDayStart.getTime() === todayStart.getTime()) {
    return due.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return due.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function MyDayRow({ item, onOpenTask, onStart, onMarkResolved, onComplete }: {
  item: MyDayItem;
  onOpenTask: (taskId: string) => void;
  onStart: (item: MyDayItem) => void;
  onMarkResolved: (item: MyDayItem) => void;
  onComplete: (item: MyDayItem) => void;
}) {
  const isTask = item.source === "AuditTask";
  const metaParts: ReactNode[] = [
    <span key="src" className={`myday-source ${isTask ? "task" : "personal"}`}>{isTask ? "TASK" : "PERSONAL"}</span>,
  ];
  if (isTask) {
    metaParts.push(<span key="num" className="mono">{item.taskNumber}</span>);
    if (item.assignedByName) {
      metaParts.push(
        <span key="by" className="assignee">
          <span className="myday-av">{initials(item.assignedByName)}</span>{item.assignedByName}
        </span>,
      );
    }
  } else {
    metaParts.push(<span key="personal-note">Personal checklist item</span>);
  }

  return (
    <div className={`myday-row ${item.isOverdue ? "is-overdue" : ""}`}>
      <span className={`sev-dot ${sevClassForPriority(item.priority)}`} />
      <div className="myday-main">
        <div className="myday-title">{item.title}</div>
        <div className="myday-meta">{metaParts}</div>
      </div>
      <span className="myday-due">{formatDueLabel(item.dueDate, item.isOverdue)}</span>
      {isTask && item.statusEnum === AUDIT_TASK_STATUS_ENUM.Open ? (
        <button type="button" className="myday-quick start" onClick={() => onStart(item)}><i>▶</i>Start</button>
      ) : isTask && item.statusEnum === AUDIT_TASK_STATUS_ENUM.InProgress ? (
        <button type="button" className="myday-quick resolve" onClick={() => onMarkResolved(item)}><i>✓</i>Mark resolved</button>
      ) : (
        <span />
      )}
      {isTask ? (
        <button type="button" className="myday-chevron" aria-label="Open task" onClick={() => onOpenTask(item.taskId!)}>→</button>
      ) : (
        <button type="button" className="myday-check" aria-label="Mark complete" onClick={() => onComplete(item)}>✓</button>
      )}
    </div>
  );
}

function MyDayGroupSection({ title, tone, items, totalCount, onViewAll, ...actions }: {
  title: string;
  tone: "overdue" | "today" | "week";
  items: MyDayItem[];
  totalCount: number;
  onViewAll: () => void;
  onOpenTask: (taskId: string) => void;
  onStart: (item: MyDayItem) => void;
  onMarkResolved: (item: MyDayItem) => void;
  onComplete: (item: MyDayItem) => void;
}) {
  if (totalCount === 0) return null;
  const overflow = totalCount - items.length;
  return (
    <div className={`myday-group ${tone}`}>
      <div className="myday-group-head"><span className="myday-group-title">{title}</span><span className="myday-group-count">{totalCount}</span></div>
      <div className="myday-rows">
        {items.map((item) => <MyDayRow key={item.id} item={item} {...actions} />)}
        {overflow > 0 ? <button type="button" className="myday-overflow" onClick={onViewAll}>+{overflow} more — view all</button> : null}
      </div>
    </div>
  );
}

function MyDayCard() {
  const navigate = useNavigate();
  const { user } = useRole();
  const queryClient = useQueryClient();
  const [toast, setToast] = useState<ToastState>(null);

  const query = useQuery({ queryKey: ["dashboard", "my-day", user.email], queryFn: () => getMyDay(user.email) });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    queryClient.invalidateQueries({ queryKey: ["checklist"] });
  };

  const taskStatusMutation = useMutation({
    mutationFn: (vars: { taskId: string; status: "progress" | "resolved" }) => changeTaskStatus(vars.taskId, vars.status, user.name),
    onSuccess: (_data, vars) => {
      invalidate();
      setToast({ kind: "success", message: vars.status === "progress" ? "Task started." : "Marked resolved — awaiting auditor sign-off." });
    },
    onError: (err) => setToast({ kind: "error", message: err instanceof ApiError ? err.detail : "Couldn't update that task." }),
  });

  // Mutation-level onSuccess always invalidates, regardless of direction; the toast (and whether
  // it offers an "Undo") is per-call, since completing an item and undoing that need different messages.
  const checklistStatusMutation = useMutation({
    mutationFn: (vars: { id: string; status: ChecklistItemStatus }) => updateChecklistItemStatus(vars.id, vars.status),
    onSuccess: invalidate,
    onError: () => setToast({ kind: "error", message: "Couldn't update that item — try again." }),
  });

  const completeChecklistItem = (item: MyDayItem) => {
    const previousStatus = mapChecklistItemStatusEnum(item.statusEnum);
    checklistStatusMutation.mutate(
      { id: item.id, status: "Completed" },
      {
        onSuccess: () =>
          setToast({
            kind: "success",
            message: "Nice work — marked complete.",
            action: {
              label: "Undo",
              onClick: () =>
                checklistStatusMutation.mutate(
                  { id: item.id, status: previousStatus },
                  { onSuccess: () => setToast({ kind: "success", message: "Restored to your board." }) },
                ),
            },
          }),
      },
    );
  };

  if (query.isLoading) return <Card className="myday-card"><p className="data-state">Loading your day…</p></Card>;
  if (query.error || !query.data) return null; // non-critical widget — a failure here shouldn't block the rest of the dashboard

  const data = query.data;
  const groupActions = {
    onOpenTask: (taskId: string) => taskId && navigate(`/tasks/${taskId}`),
    onStart: (item: MyDayItem) => taskStatusMutation.mutate({ taskId: item.taskId!, status: "progress" }),
    onMarkResolved: (item: MyDayItem) => taskStatusMutation.mutate({ taskId: item.taskId!, status: "resolved" }),
    onComplete: completeChecklistItem,
  };

  const urgentOverdueCount = data.overdue.items.filter((i) => i.priority === "Critical" || i.priority === "High").length;
  const progressPercent = data.totalToday === 0 ? 0 : Math.round((100 * data.completedToday) / data.totalToday);
  const isEmpty = data.overdue.totalCount === 0 && data.dueToday.totalCount === 0 && data.dueThisWeek.totalCount === 0;

  return (
    <Card className="myday-card">
      <div className="myday-head-row">
        <div>
          <div className="card-title">My Day <span className="dashboard-badge is-new">NEW</span></div>
          <p className="card-sub">Every task assigned to you and every personal checklist item, grouped by urgency, worst first.</p>
        </div>
        {data.totalToday > 0 ? (
          <div className="myday-progress">
            <div className="myday-progress-num">{data.completedToday} <span>of {data.totalToday} wrapped up today</span></div>
            <div className="myday-progress-bar"><div className="myday-progress-fill" style={{ width: `${progressPercent}%` }} /></div>
          </div>
        ) : null}
      </div>

      {urgentOverdueCount > 0 ? (
        <div className="myday-focus"><i>⚠</i> {urgentOverdueCount} Critical/High item{urgentOverdueCount === 1 ? " is" : "s are"} overdue — start with these.</div>
      ) : null}

      {isEmpty ? (
        <p className="data-state">You're all caught up — nothing overdue or due this week.</p>
      ) : (
        <>
          <MyDayGroupSection title="Overdue" tone="overdue" items={data.overdue.items} totalCount={data.overdue.totalCount} onViewAll={() => navigate("/checklist")} {...groupActions} />
          <MyDayGroupSection title="Due Today" tone="today" items={data.dueToday.items} totalCount={data.dueToday.totalCount} onViewAll={() => navigate("/checklist")} {...groupActions} />
          <MyDayGroupSection title="Due This Week" tone="week" items={data.dueThisWeek.items} totalCount={data.dueThisWeek.totalCount} onViewAll={() => navigate("/checklist")} {...groupActions} />

          <div className="legend-note">
            <span><span className="dot" style={{ background: "var(--sev-4)" }} />Critical</span>
            <span><span className="dot" style={{ background: "var(--sev-3)" }} />High</span>
            <span><span className="dot" style={{ background: "var(--sev-2)" }} />Medium</span>
            <span><span className="dot" style={{ background: "var(--sev-1)" }} />Low</span>
          </div>
        </>
      )}

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </Card>
  );
}

function StandardDashboard() {
  const navigate = useNavigate();
  const [dismissedAnnouncementId, setDismissedAnnouncementId] = useState<string | null>(null);

  const summaryQuery = useQuery({ queryKey: ["dashboard", "summary"], queryFn: getSummary });
  const weeklyTasksQuery = useQuery({ queryKey: ["dashboard", "weekly-tasks"], queryFn: getWeeklyTasks });
  const statusBreakdownQuery = useQuery({ queryKey: ["dashboard", "status-breakdown"], queryFn: getStatusBreakdown });
  // Non-critical widget — a failure here shouldn't block the rest of the dashboard from rendering.
  const announcementsQuery = useQuery({ queryKey: ["dashboard", "announcements"], queryFn: getAnnouncements });

  if (summaryQuery.isLoading || weeklyTasksQuery.isLoading || statusBreakdownQuery.isLoading) {
    return (
      <div className="dashboard-page">
        <p className="data-state">Loading dashboard…</p>
      </div>
    );
  }

  const firstError = summaryQuery.error ?? weeklyTasksQuery.error ?? statusBreakdownQuery.error;
  if (firstError || !summaryQuery.data) {
    const detail = firstError instanceof ApiError ? firstError.detail : "Couldn't load the dashboard.";
    return (
      <div className="dashboard-page">
        <p className="data-state is-error">{detail}</p>
      </div>
    );
  }

  const summary = summaryQuery.data;
  const weeklyTasks = weeklyTasksQuery.data ?? [];
  const breakdown = statusBreakdownQuery.data;
  const announcement = announcementsQuery.data?.[0];
  // The stat cards and donut legend show system-wide counts (from /dashboard/summary and
  // /dashboard/status-breakdown), not just the 5 rows in the "Recently created tasks" preview below —
  // so filtering navigates to the full Tasks grid (which already supports a ?status= deep link)
  // rather than filtering the tiny preview table, where the matching rows usually aren't present.
  const goToStatus = (status: DashboardTask["status"]) => navigate(`/tasks/all?status=${status}`);
  const donutItems = breakdown
    ? [
        { label: "Open", value: breakdown.open, color: "var(--text-faint)", onClick: () => goToStatus("open") },
        { label: "In progress", value: breakdown.inProgress, color: "var(--warning)", onClick: () => goToStatus("progress") },
        { label: "Overdue", value: breakdown.overdue, color: "var(--danger)", onClick: () => goToStatus("overdue") },
        { label: "Closed", value: breakdown.closed, color: "var(--success)", onClick: () => goToStatus("closed") },
      ]
    : [];

  return (
    <div className="dashboard-page">
      {announcement && announcement.id !== dismissedAnnouncementId ? (
        <section className="announcement-banner">
          <div>
            <strong>{announcement.title}</strong>
            <p>{announcement.content}</p>
          </div>
          <button type="button" aria-label="Dismiss announcement" onClick={() => setDismissedAnnouncementId(announcement.id)}>×</button>
        </section>
      ) : null}

      <div className="stat-grid">
        <StatCard label="Overdue tasks" value={summary.overdueTasks} tone="hero" onClick={() => goToStatus("overdue")} />
        <StatCard label="Open" value={summary.openTasks} onClick={() => goToStatus("open")} />
        <StatCard label="In progress" value={summary.inProgressTasks} onClick={() => goToStatus("progress")} />
        <StatCard label="Closed this week" value={summary.completedThisWeek} onClick={() => goToStatus("closed")} />
      </div>

      <MyDayCard />

      <div className="dashboard-two-col">
        <Card title="Recently created tasks">
          <div className="dashboard-week-table">
            <Table<DashboardTask>
              rows={weeklyTasks}
              emptyState="No tasks created this week."
              columns={[
                { key: "id", header: "Task ID", render: (task) => <button className="link-button nowrap-cell" type="button" onClick={() => navigate(`/tasks/${task.id}`)}>{task.taskNumber}</button> },
                { key: "title", header: "Title", render: (task) => <Tooltip label={task.title}><span className="ellipsis-cell">{task.title}</span></Tooltip> },
                { key: "company", header: "Company", render: (task) => <Tooltip label={`${task.company} — ${task.subCompany}`}><span className="table-company-cell">{task.company}<small className="table-subline">{task.subCompany}</small></span></Tooltip> },
                { key: "assignee", header: "Assigned to", align: "left", render: (task) => <Tooltip label={task.assignee}><CellPerson initials={task.assigneeInitials} name={task.assignee} /></Tooltip> },
                { key: "status", header: "Status", align: "left", render: (task) => <Badge status={task.status} /> },
              ]}
            />
          </div>
          <button className="view-all-link" type="button" onClick={() => navigate("/tasks")}>View all →</button>
        </Card>

        <Card title="Task status breakdown">
          <div className="donut-layout">
            <DonutChart segments={donutItems.map(({ value, color }) => ({ value, color }))} size={132} />
            <Legend items={donutItems} />
          </div>
        </Card>
      </div>
    </div>
  );
}

type ExecutiveFilterState = { companyId: string; subCompanyId: string; dateRange: string; customFrom: string; customTo: string; status: string };

const defaultFilterState: ExecutiveFilterState = { companyId: "", subCompanyId: "", dateRange: "last8weeks", customFrom: "", customTo: "", status: "all" };

function ExecutiveDashboard() {
  const navigate = useNavigate();
  const { role } = useRole();
  const isCompanyAdmin = role === "Company admin";
  // Same deep-link mechanism the Standard dashboard's stat cards already use
  // (/tasks/all?status=X) — "atrisk" is a client-only pseudo-status TaskGridPage filters for,
  // same treatment as its existing "overdue" one.
  const goToTasks = (status?: string) => navigate(status ? `/tasks/all?status=${status}` : "/tasks/all");

  // Scoped to companies the caller actually has task-data access to (their UserCompanyMapping
  // rows) — not the company-management listing, which for an Auditor deliberately shows every
  // company in the tenant. See getDashboardCompanyScope for why those are different lists.
  const companiesQuery = useQuery({ queryKey: ["dashboard-company-scope", role], queryFn: () => getDashboardCompanyScope(role) });
  const allCompanies = companiesQuery.data?.companies ?? [];
  const scopedCompanies = isCompanyAdmin ? allCompanies.slice(0, 1) : allCompanies;

  const [pending, setPending] = useState<ExecutiveFilterState>(defaultFilterState);
  const [applied, setApplied] = useState<ExecutiveFilterState>(defaultFilterState);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Lock CompanyAdmin to their one company as soon as the list loads.
  useEffect(() => {
    if (isCompanyAdmin && scopedCompanies[0] && !pending.companyId) {
      setPending((p) => ({ ...p, companyId: scopedCompanies[0].id }));
      setApplied((p) => ({ ...p, companyId: scopedCompanies[0].id }));
    }
  }, [isCompanyAdmin, scopedCompanies, pending.companyId]);

  const selectedCompany = allCompanies.find((c) => c.id === pending.companyId);
  const subCompanyOptions = (companiesQuery.data?.subCompanies ?? []).filter((sc) => sc.companyId === pending.companyId);

  const appliedCompany = allCompanies.find((c) => c.id === applied.companyId);
  // Status now has a real server-side equivalent on the KPIs/trend/status-mix endpoints (see
  // ApplyStatusFilter in DashboardRepository) — Company health/risk-tasks/team-workload
  // deliberately stay unfiltered by it, matching how they already ignore company/date scope.
  const isCustomRange = applied.dateRange === "custom";
  const filters: ExecutiveFilters = {
    companyId: applied.companyId || undefined,
    companyName: appliedCompany?.name,
    subCompanyId: applied.subCompanyId || undefined,
    // Sending both dateRange and dateFrom/dateTo would be ambiguous about which one the backend
    // should honor - ResolveDateWindow does prefer the explicit pair, but there's no reason to
    // rely on that precedence when omitting dateRange entirely says the same thing more directly.
    dateRange: isCustomRange ? undefined : applied.dateRange,
    dateFrom: isCustomRange ? applied.customFrom || undefined : undefined,
    dateTo: isCustomRange ? applied.customTo || undefined : undefined,
    status: applied.status !== "all" ? applied.status : undefined,
  };
  const filterKey = [role, filters.companyId, filters.subCompanyId, filters.dateRange, filters.dateFrom, filters.dateTo, filters.status] as const;

  const kpisQuery = useQuery({ queryKey: ["exec-kpis", ...filterKey], queryFn: () => getExecutiveKpis(role, filters) });
  const trendQuery = useQuery({ queryKey: ["exec-trend", ...filterKey], queryFn: () => getExecutiveTrend(role, filters) });
  const statusMixQuery = useQuery({ queryKey: ["exec-status-mix", ...filterKey], queryFn: () => getExecutiveStatusMix(role, filters) });
  const companyHealthQuery = useQuery({ queryKey: ["exec-company-health", ...filterKey], queryFn: () => getExecutiveCompanyHealth(role, filters) });
  const riskTasksQuery = useQuery({ queryKey: ["exec-risk-tasks", ...filterKey], queryFn: () => getExecutiveRiskTasks(role, filters) });
  const workloadQuery = useQuery({ queryKey: ["exec-workload", ...filterKey], queryFn: () => getExecutiveTeamWorkload(role, filters) });
  // Neither gates the page's loading/error state below (same treatment as companyHealthQuery/
  // riskTasksQuery/workloadQuery above) - a slow or failed secondary widget shouldn't block the
  // KPIs/trend/status-mix the page already considers "the dashboard is up."
  const agingQuery = useQuery({ queryKey: ["exec-aging", ...filterKey], queryFn: () => getExecutiveAging(role, filters) });
  const reviewerPerformanceQuery = useQuery({ queryKey: ["exec-reviewer-performance", ...filterKey], queryFn: () => getExecutiveReviewerPerformance(role, filters) });

  if (kpisQuery.isLoading || statusMixQuery.isLoading) {
    return (
      <div className="dashboard-page">
        <p className="data-state">Loading dashboard…</p>
      </div>
    );
  }

  const firstError = kpisQuery.error ?? statusMixQuery.error;
  if (firstError || !kpisQuery.data || !statusMixQuery.data) {
    const detail = firstError instanceof ApiError ? firstError.detail : "Couldn't load the executive dashboard.";
    return (
      <div className="dashboard-page">
        <p className="data-state is-error">{detail}</p>
      </div>
    );
  }

  const kpis = kpisQuery.data;
  const mix = statusMixQuery.data;
  const statusMix = [
    { label: "Open", value: mix.open, color: "var(--text-faint)", onClick: () => goToTasks("open") },
    { label: "In progress", value: mix.inProgress, color: "var(--warning)", onClick: () => goToTasks("progress") },
    { label: "Resolved", value: mix.resolved, color: "var(--accent-600)", onClick: () => goToTasks("resolved") },
    { label: "Closed", value: mix.closed, color: "var(--success)", onClick: () => goToTasks("closed") },
    { label: "Reopened", value: mix.reopened, color: "var(--danger)", onClick: () => goToTasks("reopened") },
  ];
  const companyHealth = companyHealthQuery.data ?? [];
  const riskTasks = riskTasksQuery.data ?? [];
  const teamWorkload = workloadQuery.data ?? [];
  const maxWorkload = Math.max(1, ...teamWorkload.map((item) => item.count));
  const priorityCounts = PRIORITY_ORDER.map((p) => ({ ...p, count: kpis.tasksByPriority[p.key] ?? 0 }));
  const maxPriority = Math.max(1, ...priorityCounts.map((p) => p.count));
  const agingBuckets = agingQuery.data ?? [];
  const maxAging = Math.max(1, ...agingBuckets.map((b) => b.count));
  const reviewerPerformance = reviewerPerformanceQuery.data ?? [];
  const maxReviewerClosed = Math.max(1, ...reviewerPerformance.map((r) => r.closedCount));

  const downloadPdf = async () => {
    setExportError(null);
    setExporting(true);
    try {
      const result = await exportExecutiveDashboardPdf(filters);
      triggerDashboardDownload(result.blob, result.fileName);
    } catch {
      setExportError("Couldn't generate the report — try again.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="dashboard-page">
      <div className="dashboard-export-row">
        <span>Share this view with management — print it or download a PDF snapshot.</span>
        <span className="dashboard-export-buttons">
          <Button size="small" onClick={() => window.print()}><i className="ti ti-printer" /> Print</Button>
          <Button size="small" variant="primary" disabled={exporting} onClick={downloadPdf}><i className="ti ti-download" /> {exporting ? "Generating…" : "Download PDF"}</Button>
        </span>
      </div>
      {exportError ? <p className="dashboard-export-error">{exportError}</p> : null}
      <Card className="filter-card">
        <div className="filter-grid">
          <label>
            Company
            <select
              disabled={isCompanyAdmin}
              value={pending.companyId}
              onChange={(event) => { const value = event.currentTarget.value; setPending((p) => ({ ...p, companyId: value, subCompanyId: "" })); }}
            >
              {!isCompanyAdmin ? <option value="">All companies</option> : null}
              {allCompanies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
            </select>
          </label>
          <label>
            Sub-company
            <select value={pending.subCompanyId} onChange={(event) => { const value = event.currentTarget.value; setPending((p) => ({ ...p, subCompanyId: value })); }} disabled={!pending.companyId}>
              <option value="">All sub-companies</option>
              {subCompanyOptions.map((sub) => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
            </select>
          </label>
          <label>
            Status
            <select value={pending.status} onChange={(event) => { const value = event.currentTarget.value; setPending((p) => ({ ...p, status: value })); }}>
              <option value="all">All statuses</option><option value="open">Open</option><option value="progress">In progress</option><option value="overdue">Overdue</option><option value="closed">Closed</option>
            </select>
          </label>
          <label>
            Date range
            <select value={pending.dateRange} onChange={(event) => { const value = event.currentTarget.value; setPending((p) => ({ ...p, dateRange: value })); }}>
              <option value="last8weeks">Last 8 weeks</option><option value="last30days">Last 30 days</option><option value="lastquarter">Last quarter</option><option value="custom">Custom range…</option>
            </select>
          </label>
          <Button
            variant="primary"
            disabled={pending.dateRange === "custom" && (!pending.customFrom || !pending.customTo)}
            onClick={() => setApplied(pending)}
          >
            Apply filters
          </Button>
        </div>
        {pending.dateRange === "custom" ? (
          <div className="filter-grid filter-grid-custom-dates">
            <label>
              From
              <input
                type="date"
                value={pending.customFrom}
                max={pending.customTo || todayDateInputValue()}
                onChange={(event) => { const value = event.currentTarget.value; setPending((p) => ({ ...p, customFrom: value })); }}
              />
            </label>
            <label>
              To
              <input
                type="date"
                value={pending.customTo}
                min={pending.customFrom || undefined}
                max={todayDateInputValue()}
                onChange={(event) => { const value = event.currentTarget.value; setPending((p) => ({ ...p, customTo: value })); }}
              />
            </label>
          </div>
        ) : null}
        <p>{isCompanyAdmin ? "Company is locked to your organization; every chart below is scoped to that company." : "Every chart below recalculates from these filters."}</p>
      </Card>

      <div className="stat-grid stat-grid-exec">
        <StatCard label="Total tasks tracked" value={kpis.totalTasks} delta={selectedCompany ? `Scoped to ${selectedCompany.name}` : `Across ${scopedCompanies.length} ${scopedCompanies.length === 1 ? "company" : "companies"}`} tone="hero" onClick={() => goToTasks()} />
        <StatCard label="Closure rate" value={`${kpis.closureRate}%`} delta="Target 80%" progress={kpis.closureRate} onClick={() => goToTasks("closed")} />
        <StatCard label="Avg. time to close" value={`${kpis.avgTimeToClose}d`} />
        <StatCard label="At-risk tasks" value={kpis.atRiskCount} delta="Past due or due soon" tone="danger" onClick={() => goToTasks("atrisk")} />
        <StatCard label="On-time closure" value={`${kpis.onTimeClosureRate}%`} delta="Closed by their due date" progress={kpis.onTimeClosureRate} />
      </div>

      <div className="dashboard-two-col">
        <Card title="Created vs. closed — last 8 weeks">
          <TrendChart points={trendQuery.data} />
          <div className="dashboard-card-head" style={{ marginTop: 18 }}>
            <h3 className="card-title" style={{ fontSize: 12.5 }}>Net backlog movement</h3>
            <DashboardBadge kind="new" />
          </div>
          {trendQuery.data ? <BacklogStrip points={trendQuery.data} /> : null}
        </Card>
        <Card title="Status mix">
          <div className="donut-layout">
            <DonutChart segments={statusMix.map(({ value, color }) => ({ value, color }))} size={132} />
            <Legend items={statusMix} />
          </div>
        </Card>
      </div>

      <div className="dashboard-two-col">
        <Card title="Company health">
          <div className="stack-list">
            {companyHealth.map((company) => (
              <div className="progress-row" key={company.id}>
                <div>
                  <strong>{company.name}</strong>
                  <span>{company.taskCount} open · {company.overdueCount} overdue</span>
                </div>
                <div className="progress-track"><span style={{ width: `${company.closureRate}%` }} /></div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Highest-risk tasks">
          {/* riskTasks is a top-N preview (currently 5), not the full at-risk set — this makes
              that explicit so it never reads as disagreeing with the At-risk KPI card above. */}
          <p style={{ margin: "-8px 0 12px", fontSize: 11.5, color: "var(--text-faint)" }}>
            Top {riskTasks.length} of {kpis.atRiskCount} at-risk task{kpis.atRiskCount === 1 ? "" : "s"}
          </p>
          <ol className="risk-list">
            {riskTasks.map((task) => (
              <li
                key={task.id}
                className="is-clickable"
                tabIndex={0}
                onClick={() => navigate(`/tasks/${task.id}`)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    navigate(`/tasks/${task.id}`);
                  }
                }}
              >
                <span><strong>{task.taskNumber}</strong>{task.title}</span>
                <Badge status="overdue" label={formatOverdueLabel(task.dueInDays)} />
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <div className="dashboard-two-col">
        <Card>
          <div className="dashboard-card-head">
            <h3 className="card-title">Priority mix</h3>
            <DashboardBadge kind="new" />
          </div>
          <div className="workload-list">
            {priorityCounts.map((p) => (
              <div className="workload-row" key={p.key}>
                <span className="cell-person">{p.key}</span>
                <div className="workload-track"><span style={{ width: `${(p.count / maxPriority) * 100}%`, background: p.color }} /></div>
                <strong>{p.count}</strong>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div className="dashboard-card-head">
            <h3 className="card-title">Overdue aging</h3>
            <DashboardBadge kind="new" />
          </div>
          <div className="workload-list">
            {agingBuckets.map((b) => (
              <div className="workload-row" key={b.bucket}>
                <span className="cell-person">{AGING_LABELS[b.bucket] ?? b.bucket}</span>
                <div className="workload-track"><span style={{ width: `${(b.count / maxAging) * 100}%`, background: AGING_COLORS[b.bucket] }} /></div>
                <strong>{b.count}</strong>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="dashboard-two-col">
        <Card title="Team workload">
          <div className="workload-list">
            {teamWorkload.map((item) => (
              <div className="workload-row" key={item.id}>
                <span className="cell-person"><span className="avatar">{initials(item.name)}</span>{item.name}</span>
                <div className="workload-track"><span style={{ width: `${(item.count / maxWorkload) * 100}%` }} /></div>
                <strong>{item.count}</strong>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div className="dashboard-card-head">
            <h3 className="card-title">Reviewer performance</h3>
            <DashboardBadge kind="new" />
          </div>
          <div className="workload-list">
            {reviewerPerformance.map((r) => (
              <div className="workload-row is-wide" key={r.id}>
                <span className="cell-person"><span className="avatar">{initials(r.name)}</span>{r.name}</span>
                <div className="workload-track"><span style={{ width: `${(r.closedCount / maxReviewerClosed) * 100}%` }} /></div>
                <span><strong>{r.closedCount}</strong><small>{r.avgTurnaroundDays}d avg</small></span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

export function DashboardPage({ forceExecutive = false }: { forceExecutive?: boolean }) {
  const [searchParams] = useSearchParams();
  const { role } = useRole();
  const executive = role !== "Employee" && (forceExecutive || searchParams.get("view") === "executive");
  return executive ? <ExecutiveDashboard /> : <StandardDashboard />;
}
