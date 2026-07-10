import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Button, Card, CellPerson, Chip, Table } from "../components/ui";
import { useRole } from "../lib/RoleContext";
import { getTaskFilterOptions, queryTasks, type AuditTask, type TaskStatus } from "../mock-data/tasks";

const statusOptions: Array<{ label: string; value: TaskStatus | "all" }> = [
  { label: "All statuses", value: "all" },
  { label: "Open", value: "open" },
  { label: "In progress", value: "progress" },
  { label: "Overdue", value: "overdue" },
  { label: "Resolved", value: "resolved" },
  { label: "Closed", value: "closed" },
];

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${date}T00:00:00`));
}

function statusForBadge(status: TaskStatus) {
  return status === "resolved" ? "progress" : status;
}

function roleScopeText(role: string) {
  if (role === "Company admin") return "Server-scoped to Meridian Group company tasks.";
  if (role === "Employee") return "Server-scoped to tasks assigned to you.";
  if (role === "Platform admin") return "Platform admins cannot access audit task content.";
  return "Server-scoped to all companies mapped to this auditor.";
}

export function TaskGridPage({ mode = "week" }: { mode?: "week" | "all" }) {
  const navigate = useNavigate();
  const { role, user } = useRole();
  const [company, setCompany] = useState("");
  const [subCompany, setSubCompany] = useState("");
  const [assignee, setAssignee] = useState("");
  const [status, setStatus] = useState<TaskStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [dateRange, setDateRange] = useState<"week" | "all" | "last30" | "quarter">(mode === "week" ? "week" : "all");

  useEffect(() => {
    setDateRange(mode === "week" ? "week" : "all");
  }, [mode]);

  useEffect(() => {
    setCompany("");
    setSubCompany("");
    setAssignee("");
    setStatus("all");
    setQuery("");
  }, [mode, role, user.email]);

  const rows = useMemo(
    () =>
      queryTasks(role, user.email, {
        dateRange,
        company: company || undefined,
        subCompany: subCompany || undefined,
        assignee: assignee || undefined,
        status,
        query,
      }),
    [assignee, company, dateRange, query, role, status, subCompany, user.email],
  );

  const filterOptions = useMemo(() => getTaskFilterOptions(role, user.email), [role, user.email]);
  const showCompanyColumn = mode === "all";
  const title = mode === "week" ? "Task grid" : "Task - full list";
  const subtitle =
    mode === "week"
      ? "Current-week tasks after role scope and filters."
      : "All scoped companies and historical tasks, unscoped by week.";

  return (
    <div className="task-page">
      <div className="task-actions-row">
        <div>
          <h2>{title}</h2>
          <p>{subtitle} {rows.length} tasks visible. {roleScopeText(role)}</p>
        </div>
        <div className="task-action-buttons">
          {mode === "week" ? <Button onClick={() => navigate("/tasks/all")}>Full list</Button> : <Button onClick={() => navigate("/tasks")}>Current week</Button>}
          {role === "Auditor" ? (
            <>
            <Button onClick={() => navigate("/tasks/bulk-upload")}>Bulk upload</Button>
            <Button variant="primary" onClick={() => navigate("/tasks/new")}>Create new task</Button>
            </>
          ) : null}
        </div>
      </div>

      <Card>
        <div className="task-filter-row">
          <Chip active>{mode === "week" ? "This week" : dateRange === "all" ? "All time" : dateRange === "last30" ? "Last 30 days" : "Last quarter"}</Chip>
          <input className="task-filter-search" placeholder="Filter by task ID or description" value={query} onChange={(event) => setQuery(event.currentTarget.value)} />
          <select value={company} onChange={(event) => setCompany(event.currentTarget.value)} disabled={role === "Company admin"}>
            <option value="">{role === "Company admin" ? filterOptions.companies[0] ?? "Company locked" : "Company: All"}</option>
            {filterOptions.companies.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select value={subCompany} onChange={(event) => setSubCompany(event.currentTarget.value)}>
            <option value="">Sub-company: All</option>
            {filterOptions.subCompanies.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select value={assignee} onChange={(event) => setAssignee(event.currentTarget.value)} disabled={role === "Employee"}>
            <option value="">{role === "Employee" ? "Assigned to you" : "Assignee: All"}</option>
            {filterOptions.assignees.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select value={status} onChange={(event) => setStatus(event.currentTarget.value as TaskStatus | "all")}>
            {statusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          {mode === "all" ? (
            <select value={dateRange} onChange={(event) => setDateRange(event.currentTarget.value as "week" | "all" | "last30" | "quarter")}>
              <option value="all">All time</option>
              <option value="week">This week</option>
              <option value="last30">Last 30 days</option>
              <option value="quarter">Last quarter</option>
            </select>
          ) : null}
        </div>

        <Table<AuditTask>
          rows={rows}
          onRowClick={(task) => navigate(`/tasks/${task.id}`)}
          emptyState="No tasks match the selected filters."
          columns={[
            { key: "id", header: "Task ID", render: (task) => <span className="link-button">{task.id}</span> },
            { key: "title", header: "Description", render: (task) => <span className="task-title-button">{task.title}<small className="table-subline">{task.description}</small></span> },
            ...(showCompanyColumn ? [{ key: "company", header: "Company", render: (task: AuditTask) => <span>{task.company}<small className="table-subline">{task.subCompany}</small></span> }] : []),
            { key: "createdOn", header: "Created on", render: (task) => formatDate(task.createdOn) },
            { key: "dueDate", header: "Due date", render: (task) => formatDate(task.dueDate) },
            ...(mode === "week" ? [{ key: "createdBy", header: "Created by" }] : []),
            { key: "assignee", header: "Assigned to", render: (task) => <CellPerson initials={task.assigneeInitials} name={task.assignee} /> },
            { key: "status", header: "Status", render: (task) => <Badge status={statusForBadge(task.status)} label={task.status === "resolved" ? "Resolved" : undefined} /> },
          ]}
        />

        <div className="pagination-footer">
          <span>Showing {rows.length} of {rows.length} scoped tasks</span>
          <div>
            <Button size="small">Prev</Button>
            {mode === "all" ? <Button size="small" variant="primary">1</Button> : null}
            <Button size="small">Next</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
