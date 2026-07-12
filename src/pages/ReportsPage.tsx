import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Button, Card, CellPerson, Table } from "../components/ui";
import { useRole } from "../lib/RoleContext";
import { getTaskFilterOptions, queryTasks, type AuditTask, type TaskStatus } from "../mock-data/tasks";

const statusOptions: Array<{ label: string; value: TaskStatus | "all" }> = [
  { label: "All statuses", value: "all" }, { label: "Open", value: "open" }, { label: "In progress", value: "progress" }, { label: "Overdue", value: "overdue" }, { label: "Resolved", value: "resolved" }, { label: "Closed", value: "closed" },
];

const formatDate = (date: string) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${date}T00:00:00`));
const badgeStatus = (status: TaskStatus) => status === "resolved" ? "progress" : status;
const labelStatus = (status: TaskStatus) => status === "progress" ? "In progress" : status.charAt(0).toUpperCase() + status.slice(1);

function downloadStub(format: "excel" | "pdf", rows: AuditTask[]) {
  const header = "Task ID\tCompany\tSub-company\tTitle\tAssigned to\tStatus\tDue date";
  const body = rows.map((task) => [task.id, task.company, task.subCompany, task.title, task.assignee, labelStatus(task.status), task.dueDate].join("\t"));
  const content = [`AuditFlow filtered task report`, `Generated ${new Date().toLocaleString()}`, "", header, ...body].join("\n");
  const blob = new Blob([content], { type: format === "excel" ? "application/vnd.ms-excel" : "application/pdf" });
  const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
  anchor.href = url; anchor.download = `auditflow-report.${format === "excel" ? "xls" : "pdf"}`; anchor.click(); URL.revokeObjectURL(url);
}

export function ReportsPage() {
  const navigate = useNavigate(); const { role, user } = useRole();
  const [company, setCompany] = useState(""); const [subCompany, setSubCompany] = useState(""); const [assignee, setAssignee] = useState(""); const [status, setStatus] = useState<TaskStatus | "all">("all"); const [dateRange, setDateRange] = useState<"all" | "week" | "last30" | "quarter">("all");
  const options = useMemo(() => getTaskFilterOptions(role, user.email), [role, user.email]);
  const subCompanies = useMemo(() => Array.from(new Set(queryTasks(role, user.email, { company: company || undefined, dateRange: "all" }).map((task) => task.subCompany))), [company, role, user.email]);
  const assignees = useMemo(() => Array.from(new Set(queryTasks(role, user.email, { company: company || undefined, subCompany: subCompany || undefined, dateRange: "all" }).map((task) => task.assignee))), [company, role, subCompany, user.email]);
  const rows = useMemo(() => queryTasks(role, user.email, { company: company || undefined, subCompany: subCompany || undefined, assignee: assignee || undefined, status, dateRange }), [assignee, company, dateRange, role, status, subCompany, user.email]);
  const chooseCompany = (value: string) => { setCompany(value); setSubCompany(""); setAssignee(""); };
  const chooseSubCompany = (value: string) => { setSubCompany(value); setAssignee(""); };

  return <div className="reports-page"><div className="reports-heading"><div><h2>Reports</h2><p>Build an exportable view of your scoped task data.</p></div><div className="report-actions"><Button size="small" onClick={() => downloadStub("excel", rows)}><i className="ti ti-file-spreadsheet" />Export Excel</Button><Button size="small" onClick={() => downloadStub("pdf", rows)}><i className="ti ti-file-type-pdf" />Export PDF</Button></div></div><Card className="report-filter-card"><h2 className="card-title">Filters</h2><div className="report-filter-grid"><label>Company<select value={company} onChange={(event) => chooseCompany(event.target.value)} disabled={role === "Company admin"}><option value="">{role === "Company admin" ? options.companies[0] ?? "Company locked" : "All companies"}</option>{options.companies.map((item) => <option key={item}>{item}</option>)}</select></label><label>Sub-company<select value={subCompany} onChange={(event) => chooseSubCompany(event.target.value)}><option value="">All sub-companies</option>{subCompanies.map((item) => <option key={item}>{item}</option>)}</select></label><label>Assignee<select value={assignee} onChange={(event) => setAssignee(event.target.value)} disabled={role === "Employee"}><option value="">{role === "Employee" ? "Assigned to you" : "All assignees"}</option>{assignees.map((item) => <option key={item}>{item}</option>)}</select></label><label>Status<select value={status} onChange={(event) => setStatus(event.target.value as TaskStatus | "all")}>{statusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label>Date range<select value={dateRange} onChange={(event) => setDateRange(event.target.value as typeof dateRange)}><option value="all">All time</option><option value="week">This week</option><option value="last30">Last 30 days</option><option value="quarter">Last quarter</option></select></label></div></Card><Card className="report-results-card" title={`${rows.length} result${rows.length === 1 ? "" : "s"}`}><Table<AuditTask> rows={rows} onRowClick={(task) => navigate(`/tasks/${task.id}`)} emptyState="No tasks match the selected filters." columns={[{ key: "id", header: "Task ID", render: (task) => <span className="link-button">{task.id}</span> }, { key: "company", header: "Company", render: (task) => <span>{task.company}<small className="table-subline">{task.subCompany}</small></span> }, { key: "title", header: "Title", render: (task) => <span className="task-title-button">{task.title}</span> }, { key: "assignee", header: "Assigned to", render: (task) => <CellPerson initials={task.assigneeInitials} name={task.assignee} /> }, { key: "status", header: "Status", render: (task) => <Badge status={badgeStatus(task.status)} label={labelStatus(task.status)} /> }, { key: "dueDate", header: "Closed on", render: (task) => task.status === "closed" ? formatDate(task.dueDate) : "—" }]} /></Card></div>;
}
