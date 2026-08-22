import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Badge, Button, Card, CellPerson, Chip, Pagination, Table } from "../components/ui";
import { useRole } from "../lib/RoleContext";
import { ApiError } from "../lib/apiClient";
import { getTaskFilterOptions, getTasks, TASK_PAGE_SIZE, type TaskEntry, type TaskStatus } from "../services/tasks";

// "Overdue" isn't a real backend status (it's a due-date-derived flag folded into the display
// status client-side — see displayTaskStatus), so it can't be sent as a `status` query param.
// It's filtered client-side against the already-fetched page instead, further down.
// "At risk" mirrors the executive dashboard's At-risk KPI (overdue OR due within 7 days) - also
// not a real backend status, filtered client-side against the already-fetched page below, same
// treatment as "Overdue" right above it.
const statusOptions: Array<{ label: string; value: TaskStatus | "all" | "atrisk" }> = [
  { label: "All statuses", value: "all" },
  { label: "Open", value: "open" },
  { label: "In progress", value: "progress" },
  { label: "Overdue", value: "overdue" },
  { label: "At risk", value: "atrisk" },
  { label: "Resolved", value: "resolved" },
  { label: "Reopened", value: "reopened" },
  { label: "Closed", value: "closed" },
];

function formatDate(date: string) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${date}T00:00:00`));
}

export function TaskGridPage({ mode = "week" }: { mode?: "week" | "all" }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { role, user } = useRole();
  const [company, setCompany] = useState("");
  const [subCompany, setSubCompany] = useState("");
  const [assignee, setAssignee] = useState("");
  const [status, setStatus] = useState<TaskStatus | "all" | "atrisk">("all");
  const [query, setQuery] = useState("");
  const [dateRange, setDateRange] = useState<"week" | "all" | "last30" | "quarter">(mode === "week" ? "week" : "all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setDateRange(mode === "week" ? "week" : "all");
  }, [mode]);

  useEffect(() => {
    setCompany("");
    setSubCompany("");
    setAssignee("");
    // A dashboard stat card / donut segment can deep-link here with a status pre-applied
    // (e.g. /tasks/all?status=open) — honor it once on arrival, same as any other reset default.
    setStatus((searchParams.get("status") as TaskStatus | "atrisk" | null) ?? "all");
    setQuery("");
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, role, user.email]);

  // Any filter change narrows/widens the result set, so a page number from before no longer
  // means the same thing — always land back on page 1 rather than risk showing an empty page.
  const setFilterAndResetPage = <T,>(setter: (value: T) => void, value: T) => {
    setter(value);
    setPage(1);
  };

  const filterOptionsQuery = useQuery({ queryKey: ["tasks", "filter-options", role], queryFn: () => getTaskFilterOptions(role, user.email) });
  const tasksQuery = useQuery({
    queryKey: ["tasks", role, user.email, dateRange, company, subCompany, assignee, status, query, page],
    queryFn: () => getTasks(role, user.email, { range: dateRange, company: company || undefined, subCompany: subCompany || undefined, assignee: assignee || undefined, status, query: query || undefined, page }),
  });

  const filterOptions = filterOptionsQuery.data ?? { companies: [], subCompanies: [], assignees: [] };
  // "Overdue"/"At risk" have no backend status to filter by — getTasks() matches them against the
  // full result set for the other filters and paginates that itself (see services/tasks.ts), so
  // the page returned here is already the correct "overdue-only"/"at-risk-only" page, in sync with
  // totalCount/totalPages below.
  const rows = tasksQuery.data?.items ?? [];
  const totalCount = tasksQuery.data?.totalCount ?? 0;
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * TASK_PAGE_SIZE + 1;
  const rangeEnd = totalCount === 0 ? 0 : rangeStart + rows.length - 1;
  const title = mode === "week" ? "Tasks" : "All tasks";
  const subtitle =
    mode === "week"
      ? "All tasks across your scoped companies — current week by default."
      : "All tasks across your scoped companies and historical audit periods.";

  return (
    <div className="task-page">
      <div className="task-actions-row">
        <div>
          <h2>{title}</h2>
          <p>{subtitle} {totalCount} tasks total.</p>
        </div>
        <div className="task-action-buttons">
          {mode === "week" ? (
            <Button className="list-toggle-btn" onClick={() => navigate("/tasks/all")}><i className="ti ti-list-details" />Full list</Button>
          ) : (
            <Button className="list-toggle-btn" onClick={() => navigate("/tasks")}><i className="ti ti-calendar-week" />Current week</Button>
          )}
          {role === "Auditor" ? (
            <>
            <Button className="upload-toggle-btn" onClick={() => navigate("/tasks/bulk-upload")}><i className="ti ti-file-upload" />Bulk upload</Button>
            <Button variant="primary" onClick={() => navigate("/tasks/new")}><i className="ti ti-plus" />Create new task</Button>
            </>
          ) : null}
        </div>
      </div>

      <Card>
        <div className="task-filter-row">
          <Chip active>{mode === "week" ? "This week" : dateRange === "all" ? "All time" : dateRange === "last30" ? "Last 30 days" : "Last quarter"}</Chip>
          <input className="task-filter-search" placeholder="Filter by task ID or description" value={query} onChange={(event) => setFilterAndResetPage(setQuery, event.currentTarget.value)} />
          <select value={company} onChange={(event) => setFilterAndResetPage(setCompany, event.currentTarget.value)} disabled={role === "Company admin"}>
            <option value="">{role === "Company admin" ? filterOptions.companies[0]?.label ?? "Company locked" : "Company: All"}</option>
            {filterOptions.companies.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <select value={subCompany} onChange={(event) => setFilterAndResetPage(setSubCompany, event.currentTarget.value)}>
            <option value="">Sub-company: All</option>
            {filterOptions.subCompanies.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <select value={assignee} onChange={(event) => setFilterAndResetPage(setAssignee, event.currentTarget.value)} disabled={role === "Employee"}>
            <option value="">{role === "Employee" ? "Assigned to you" : "Assignee: All"}</option>
            {filterOptions.assignees.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <select value={status} onChange={(event) => setFilterAndResetPage(setStatus, event.currentTarget.value as TaskStatus | "all" | "atrisk")}>
            {statusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          {mode === "all" ? (
            <select value={dateRange} onChange={(event) => setFilterAndResetPage(setDateRange, event.currentTarget.value as "week" | "all" | "last30" | "quarter")}>
              <option value="all">All time</option>
              <option value="week">This week</option>
              <option value="last30">Last 30 days</option>
              <option value="quarter">Last quarter</option>
            </select>
          ) : null}
        </div>

        {tasksQuery.isLoading ? (
          <p className="data-state">Loading tasks…</p>
        ) : tasksQuery.error ? (
          <p className="data-state is-error">{tasksQuery.error instanceof ApiError ? tasksQuery.error.detail : "Couldn't load tasks."}</p>
        ) : (
          <Table<TaskEntry>
            rows={rows}
            onRowClick={(task) => navigate(`/tasks/${task.id}`)}
            emptyState="No tasks match the selected filters."
            columns={[
              { key: "id", header: "Task ID", render: (task) => <span className="link-button">{task.taskNumber}</span> },
              { key: "title", header: "Description", render: (task) => <span className="task-title-button">{task.title}{task.description ? <small className="table-subline">{task.description}</small> : null}</span> },
              { key: "company", header: "Company", render: (task) => <span>{task.company}<small className="table-subline">{task.subCompany}</small></span> },
              { key: "createdOn", header: "Created on", render: (task) => formatDate(task.createdOn) },
              { key: "dueDate", header: "Due date", render: (task) => formatDate(task.dueDate) },
              ...(mode === "week" ? [{ key: "createdBy", header: "Created by" }] : []),
              { key: "assignee", header: "Assigned to", align: "left", render: (task) => <CellPerson initials={task.assigneeInitials} name={task.assignee} /> },
              { key: "status", header: "Status", align: "left", render: (task) => <Badge status={task.status} /> },
            ]}
          />
        )}

        <div className="pagination-footer">
          <span>
            {status === "overdue"
              ? `Showing ${rangeStart}-${rangeEnd} of ${totalCount} overdue tasks`
              : status === "atrisk"
                ? `Showing ${rangeStart}-${rangeEnd} of ${totalCount} at-risk tasks`
                : `Showing ${rangeStart}-${rangeEnd} of ${totalCount} scoped tasks`}
          </span>
          <Pagination page={page} totalPages={tasksQuery.data?.totalPages ?? 1} onChange={setPage} />
        </div>
      </Card>
    </div>
  );
}
