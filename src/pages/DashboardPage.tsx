import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Badge, Button, Card, CellPerson, DonutChart, Table, TrendChart } from "../components/ui";
import type { DashboardTask } from "../mock-data/dashboard";
import { useRole } from "../lib/RoleContext";
import {
  getAnnouncements,
  getExecutiveCompanyHealth,
  getExecutiveKpis,
  getExecutiveRiskTasks,
  getExecutiveStatusMix,
  getExecutiveTeamWorkload,
  getExecutiveTrend,
  getStatusBreakdown,
  getSummary,
  getWeeklyTasks,
  type ExecutiveFilters,
} from "../services/dashboard";
import { getCompaniesForRole, getCompanyById } from "../services/companies";
import { ApiError } from "../lib/apiClient";

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2);
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

function StandardDashboard() {
  const navigate = useNavigate();
  const [dismissedAnnouncementId, setDismissedAnnouncementId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<DashboardTask["status"] | null>(null);

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
  // Toggling the same status again clears the filter — click Open, click Open again, back to
  // the full list — rather than needing a separate "clear" action for the common case.
  const toggleStatusFilter = (status: DashboardTask["status"]) => setStatusFilter((current) => (current === status ? null : status));
  const visibleWeeklyTasks = statusFilter ? weeklyTasks.filter((task) => task.status === statusFilter) : weeklyTasks;
  const statusFilterLabel = statusFilter === "progress" ? "In progress" : statusFilter ? statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1) : null;
  const donutItems = breakdown
    ? [
        { label: "Open", value: breakdown.open, color: "var(--text-faint)", onClick: () => toggleStatusFilter("open"), active: statusFilter === "open" },
        { label: "In progress", value: breakdown.inProgress, color: "var(--warning)", onClick: () => toggleStatusFilter("progress"), active: statusFilter === "progress" },
        { label: "Overdue", value: breakdown.overdue, color: "var(--danger)", onClick: () => toggleStatusFilter("overdue"), active: statusFilter === "overdue" },
        { label: "Closed", value: breakdown.closed, color: "var(--success)", onClick: () => toggleStatusFilter("closed"), active: statusFilter === "closed" },
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
        <StatCard label="Overdue tasks" value={summary.overdueTasks} tone="hero" onClick={() => toggleStatusFilter("overdue")} active={statusFilter === "overdue"} />
        <StatCard label="Open" value={summary.openTasks} onClick={() => toggleStatusFilter("open")} active={statusFilter === "open"} />
        <StatCard label="In progress" value={summary.inProgressTasks} onClick={() => toggleStatusFilter("progress")} active={statusFilter === "progress"} />
        <StatCard label="Closed this week" value={summary.completedThisWeek} onClick={() => toggleStatusFilter("closed")} active={statusFilter === "closed"} />
      </div>

      <div className="dashboard-two-col">
        <Card title={statusFilterLabel ? `This week's tasks — ${statusFilterLabel}` : "This week's tasks"}>
          {statusFilterLabel ? (
            <button className="chip active-chip dashboard-filter-chip" type="button" onClick={() => setStatusFilter(null)}>
              Filtered: {statusFilterLabel} <i className="ti ti-x" />
            </button>
          ) : null}
          <Table<DashboardTask>
            rows={visibleWeeklyTasks}
            emptyState={statusFilterLabel ? `No ${statusFilterLabel.toLowerCase()} tasks this week.` : "No tasks this week."}
            columns={[
              { key: "id", header: "Task ID", render: (task) => <button className="link-button" type="button" onClick={() => navigate(`/tasks/${task.id}`)}>{task.taskNumber}</button> },
              { key: "title", header: "Title" },
              { key: "assignee", header: "Assigned to", render: (task) => <CellPerson initials={task.assigneeInitials} name={task.assignee} /> },
              { key: "status", header: "Status", render: (task) => <Badge status={task.status} /> },
            ]}
          />
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

type ExecutiveFilterState = { companyId: string; subCompanyId: string; dateRange: string; status: string };

const defaultFilterState: ExecutiveFilterState = { companyId: "", subCompanyId: "", dateRange: "last8weeks", status: "all" };

function ExecutiveDashboard() {
  const { role } = useRole();
  const isCompanyAdmin = role === "Company admin";

  const companiesQuery = useQuery({ queryKey: ["companies", role], queryFn: () => getCompaniesForRole(role) });
  const scopedCompanies = isCompanyAdmin ? (companiesQuery.data ?? []).slice(0, 1) : companiesQuery.data ?? [];

  const [pending, setPending] = useState<ExecutiveFilterState>(defaultFilterState);
  const [applied, setApplied] = useState<ExecutiveFilterState>(defaultFilterState);

  // Lock CompanyAdmin to their one company as soon as the list loads.
  useEffect(() => {
    if (isCompanyAdmin && scopedCompanies[0] && !pending.companyId) {
      setPending((p) => ({ ...p, companyId: scopedCompanies[0].id }));
      setApplied((p) => ({ ...p, companyId: scopedCompanies[0].id }));
    }
  }, [isCompanyAdmin, scopedCompanies, pending.companyId]);

  const selectedCompany = (companiesQuery.data ?? []).find((c) => c.id === pending.companyId);
  const companyDetailQuery = useQuery({ queryKey: ["company", pending.companyId], queryFn: () => getCompanyById(pending.companyId), enabled: Boolean(pending.companyId) });
  const subCompanyOptions = companyDetailQuery.data?.subCompanies ?? [];

  const appliedCompany = (companiesQuery.data ?? []).find((c) => c.id === applied.companyId);
  // The "Status" filter has no server-side equivalent on any of the six executive endpoints
  // (verified against DashboardQueries.cs) — kept in the UI for now, not sent anywhere.
  const filters: ExecutiveFilters = { companyId: applied.companyId || undefined, companyName: appliedCompany?.name, subCompanyId: applied.subCompanyId || undefined, dateRange: applied.dateRange };
  const filterKey = [role, filters.companyId, filters.subCompanyId, filters.dateRange] as const;

  const kpisQuery = useQuery({ queryKey: ["exec-kpis", ...filterKey], queryFn: () => getExecutiveKpis(role, filters) });
  const trendQuery = useQuery({ queryKey: ["exec-trend", ...filterKey], queryFn: () => getExecutiveTrend(role, filters) });
  const statusMixQuery = useQuery({ queryKey: ["exec-status-mix", ...filterKey], queryFn: () => getExecutiveStatusMix(role, filters) });
  const companyHealthQuery = useQuery({ queryKey: ["exec-company-health", ...filterKey], queryFn: () => getExecutiveCompanyHealth(role, filters) });
  const riskTasksQuery = useQuery({ queryKey: ["exec-risk-tasks", ...filterKey], queryFn: () => getExecutiveRiskTasks(role, filters) });
  const workloadQuery = useQuery({ queryKey: ["exec-workload", ...filterKey], queryFn: () => getExecutiveTeamWorkload(role, filters) });

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
    { label: "Open", value: mix.open, color: "var(--text-faint)" },
    { label: "In progress", value: mix.inProgress, color: "var(--warning)" },
    { label: "Resolved", value: mix.resolved, color: "var(--accent-600)" },
    { label: "Closed", value: mix.closed, color: "var(--success)" },
    { label: "Reopened", value: mix.reopened, color: "var(--danger)" },
  ];
  const companyHealth = companyHealthQuery.data ?? [];
  const riskTasks = riskTasksQuery.data ?? [];
  const teamWorkload = workloadQuery.data ?? [];
  const maxWorkload = Math.max(1, ...teamWorkload.map((item) => item.count));

  return (
    <div className="dashboard-page">
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
              {(companiesQuery.data ?? []).map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
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
              <option value="last8weeks">Last 8 weeks</option><option value="last30days">Last 30 days</option><option value="lastquarter">Last quarter</option>
            </select>
          </label>
          <Button variant="primary" onClick={() => setApplied(pending)}>Apply filters</Button>
        </div>
        <p>{isCompanyAdmin ? "Company is locked to your organization; every chart below is scoped to that company." : "Every chart below recalculates from these filters."}</p>
      </Card>

      <div className="stat-grid">
        <StatCard label="Total tasks tracked" value={kpis.totalTasks} delta={selectedCompany ? `Scoped to ${selectedCompany.name}` : `Across ${scopedCompanies.length} ${scopedCompanies.length === 1 ? "company" : "companies"}`} tone="hero" />
        <StatCard label="Closure rate" value={`${kpis.closureRate}%`} delta="Target 80%" progress={kpis.closureRate} />
        <StatCard label="Avg. time to close" value={`${kpis.avgTimeToClose}d`} />
        <StatCard label="At-risk tasks" value={kpis.atRiskCount} delta="Past due or due soon" tone="danger" />
      </div>

      <div className="dashboard-two-col">
        <Card title="Created vs. closed — last 8 weeks">
          <TrendChart points={trendQuery.data} />
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
          <ol className="risk-list">
            {riskTasks.map((task) => (
              <li key={task.id}>
                <span><strong>{task.taskNumber}</strong>{task.title}</span>
                <Badge status="overdue" label={`${Math.abs(task.dueInDays)}d overdue`} />
              </li>
            ))}
          </ol>
        </Card>
      </div>

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
    </div>
  );
}

export function DashboardPage({ forceExecutive = false }: { forceExecutive?: boolean }) {
  const [searchParams] = useSearchParams();
  const { role } = useRole();
  const executive = role !== "Employee" && (forceExecutive || searchParams.get("view") === "executive");
  return executive ? <ExecutiveDashboard /> : <StandardDashboard />;
}
