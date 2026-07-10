import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Badge, Button, Card, CellPerson, DonutChart, Table, TrendChart } from "../components/ui";
import { companies, dashboardTasks, trendDeltas, workload, type DashboardTask } from "../mock-data/dashboard";
import { useRole } from "../lib/RoleContext";

const statusOrder = ["open", "progress", "overdue", "closed"] as const;

function countStatus(tasks: DashboardTask[]) {
  return statusOrder.reduce((totals, status) => ({ ...totals, [status]: tasks.filter((task) => task.status === status).length }), {
    open: 0,
    progress: 0,
    overdue: 0,
    closed: 0,
  });
}

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2);
}

function StatCard({ label, value, delta, tone = "default" }: { label: string; value: number | string; delta: string; tone?: "default" | "hero" | "danger" }) {
  return (
    <section className={`stat-card ${tone}`}>
      <span className="stat-label">{label}</span>
      <strong>{value}</strong>
      <span className="stat-delta">{delta}</span>
    </section>
  );
}

function Legend({ items }: { items: Array<{ label: string; value: number; color: string }> }) {
  return (
    <div className="chart-legend">
      {items.map((item) => (
        <div className="legend-row" key={item.label}>
          <span className="legend-dot" style={{ background: item.color }} />
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

function StandardDashboard() {
  const [showAnnouncement, setShowAnnouncement] = useState(true);
  const navigate = useNavigate();
  const totals = countStatus(dashboardTasks);
  const donutItems = [
    { label: "Open", value: totals.open, color: "var(--text-faint)" },
    { label: "In progress", value: totals.progress, color: "var(--warning)" },
    { label: "Overdue", value: totals.overdue, color: "var(--danger)" },
    { label: "Closed", value: totals.closed, color: "var(--success)" },
  ];

  return (
    <div className="dashboard-page">
      {showAnnouncement ? (
        <section className="announcement-banner">
          <div>
            <strong>Quarter-close evidence deadline is Friday.</strong>
            <p>Auditor broadcasts appear here for everyone in scope.</p>
          </div>
          <button type="button" aria-label="Dismiss announcement" onClick={() => setShowAnnouncement(false)}>×</button>
        </section>
      ) : null}

      <div className="stat-grid">
        <StatCard label="Overdue tasks" value={totals.overdue} delta={trendDeltas.overdue} tone="hero" />
        <StatCard label="Open" value={totals.open} delta={trendDeltas.open} />
        <StatCard label="In progress" value={totals.progress} delta={trendDeltas.progress} />
        <StatCard label="Closed this week" value={totals.closed} delta={trendDeltas.closed} />
      </div>

      <div className="dashboard-two-col">
        <Card title="This week's tasks">
          <Table<DashboardTask>
            rows={dashboardTasks.slice(0, 5)}
            columns={[
              { key: "id", header: "Task ID", render: (task) => <button className="link-button" type="button" onClick={() => navigate(`/tasks/${task.id}`)}>{task.id}</button> },
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

function ExecutiveDashboard() {
  const { role } = useRole();
  const isCompanyAdmin = role === "Company admin";
  const scopedCompanies = isCompanyAdmin ? companies.slice(0, 1) : companies;
  const scopedTasks = isCompanyAdmin ? dashboardTasks.filter((task) => task.company === scopedCompanies[0].name) : dashboardTasks;
  const totals = countStatus(scopedTasks);
  const statusMix = [
    { label: "Open", value: totals.open, color: "var(--text-faint)" },
    { label: "In progress", value: totals.progress, color: "var(--warning)" },
    { label: "Overdue", value: totals.overdue, color: "var(--danger)" },
    { label: "Closed", value: totals.closed, color: "var(--success)" },
  ];
  const totalTasks = scopedTasks.length;
  const closureRate = totalTasks ? Math.round((totals.closed / totalTasks) * 100) : 0;
  const atRisk = scopedTasks.filter((task) => task.status === "overdue").length;

  const highestRisk = [...scopedTasks].filter((task) => task.dueInDays < 0).sort((a, b) => a.dueInDays - b.dueInDays).slice(0, 4);
  const maxWorkload = Math.max(...workload.map((item) => item.count));

  return (
    <div className="dashboard-page">
      <Card className="filter-card">
        <div className="filter-grid">
          <label>
            Company
            <select disabled={isCompanyAdmin} defaultValue={scopedCompanies[0].name}>
              {scopedCompanies.map((company) => <option key={company.name}>{company.name}</option>)}
            </select>
          </label>
          <label>
            Sub-company
            <select><option>All sub-companies</option>{scopedCompanies.flatMap((company) => company.subCompanies).map((sub) => <option key={sub}>{sub}</option>)}</select>
          </label>
          <label>
            Status
            <select><option>All statuses</option><option>Open</option><option>In progress</option><option>Overdue</option><option>Closed</option></select>
          </label>
          <label>
            Date range
            <select><option>Last 8 weeks</option><option>Last 30 days</option><option>Last quarter</option><option>Custom range</option></select>
          </label>
          <Button variant="primary">Apply filters</Button>
        </div>
        <p>{isCompanyAdmin ? "Company is locked to your organization; every chart below is scoped to that company." : "Every chart below recalculates from these filters."}</p>
      </Card>

      <div className="stat-grid">
        <StatCard label="Total tasks tracked" value={totalTasks} delta="+14 added in range" />
        <StatCard label="Closure rate" value={`${closureRate}%`} delta="Target 80%" />
        <StatCard label="Avg. time to close" value="5.8d" delta="-0.7d vs prior range" />
        <StatCard label="At-risk tasks" value={atRisk} delta="Past due or due soon" tone="danger" />
      </div>

      <div className="dashboard-two-col">
        <Card title="Created vs. closed — last 8 weeks">
          <TrendChart />
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
            {scopedCompanies.map((company) => (
              <div className="progress-row" key={company.name}>
                <div>
                  <strong>{company.name}</strong>
                  <span>{company.open} open · {company.overdue} overdue</span>
                </div>
                <div className="progress-track"><span style={{ width: `${company.closureRate}%` }} /></div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Highest-risk tasks">
          <ol className="risk-list">
            {highestRisk.map((task) => (
              <li key={task.id}>
                <span><strong>{task.id}</strong>{task.title}</span>
                <Badge status="overdue" label={`${Math.abs(task.dueInDays)}d overdue`} />
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <Card title="Team workload">
        <div className="workload-list">
          {workload.map((item) => (
            <div className="workload-row" key={item.name}>
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
