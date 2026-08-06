import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Badge, Card, CellPerson, Table } from "../components/ui";
import { useRole } from "../lib/RoleContext";
import { ApiError } from "../lib/apiClient";
import { getCompaniesForRole, getCompanyById } from "../services/companies";
import { getUsersForRole } from "../services/users";
import {
  downloadReportFile,
  exportTaskReport,
  getReportJobStatus,
  getTaskReport,
  reportStatusOptions,
  type ReportFilters,
  type ReportTaskRow,
} from "../services/reports";

const formatDate = (date: string) => (date ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${date}T00:00:00`)) : "—");

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ReportsPage() {
  const navigate = useNavigate();
  const { role, user } = useRole();

  const [companyId, setCompanyId] = useState("");
  const [subCompanyId, setSubCompanyId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [status, setStatus] = useState<ReportFilters["status"]>("all");
  const [dateRange, setDateRange] = useState<ReportFilters["dateRange"]>("all");
  const [exportError, setExportError] = useState("");
  const [exportingFormat, setExportingFormat] = useState<"excel" | "pdf" | null>(null);
  const [pendingJobId, setPendingJobId] = useState<string | null>(null);

  const companiesQuery = useQuery({ queryKey: ["companies", role], queryFn: () => getCompaniesForRole(role) });
  const companies = companiesQuery.data ?? [];
  const selectedCompany = companies.find((c) => c.id === companyId);

  const companyDetailQuery = useQuery({ queryKey: ["company", companyId], queryFn: () => getCompanyById(companyId), enabled: Boolean(companyId) });
  const subCompanies = companyDetailQuery.data?.subCompanies ?? [];

  const usersQuery = useQuery({ queryKey: ["users", role], queryFn: () => getUsersForRole(role) });
  const assignees = (usersQuery.data ?? []).filter((u) => !companyId || u.company === selectedCompany?.name);

  const filters: ReportFilters = { companyId: companyId || undefined, subCompanyId: subCompanyId || undefined, assigneeId: assigneeId || undefined, status, dateRange };
  const reportQuery = useQuery({ queryKey: ["report", role, user.email, filters], queryFn: () => getTaskReport(role, user.email, filters) });
  const rows = reportQuery.data ?? [];

  const chooseCompany = (value: string) => { setCompanyId(value); setSubCompanyId(""); setAssigneeId(""); };
  const chooseSubCompany = (value: string) => { setSubCompanyId(value); setAssigneeId(""); };

  // Polls a queued async export job until it completes, then downloads it — the sync export
  // endpoints 400 with EXPORT_TOO_LARGE above 10k rows (BACKEND_INTEGRATION_GUIDE SS8).
  const jobQuery = useQuery({
    queryKey: ["report-job", pendingJobId],
    queryFn: () => getReportJobStatus(pendingJobId!),
    enabled: Boolean(pendingJobId),
    refetchInterval: (query) => (query.state.data?.status === "completed" || query.state.data?.status === "failed" ? false : 3000),
  });

  useEffect(() => {
    if (!pendingJobId || !jobQuery.data) return;
    if (jobQuery.data.status === "completed") {
      const jobId = pendingJobId;
      setPendingJobId(null);
      downloadReportFile(jobId).then((blob) => triggerDownload(blob, `auditflow-report-${jobId}.xlsx`));
    } else if (jobQuery.data.status === "failed") {
      setExportError(jobQuery.data.errorMessage ?? "The export job failed.");
      setPendingJobId(null);
    }
  }, [pendingJobId, jobQuery.data]);

  const handleExport = async (format: "excel" | "pdf") => {
    setExportError("");
    setExportingFormat(format);
    try {
      const result = await exportTaskReport(format, role, user.email, filters);
      if (result.kind === "file") {
        triggerDownload(result.blob, result.fileName);
      } else {
        setPendingJobId(result.reportId);
      }
    } catch (err) {
      setExportError(err instanceof ApiError ? err.detail : "Couldn't export the report.");
    } finally {
      setExportingFormat(null);
    }
  };

  return (
    <div className="reports-page">
      <div className="reports-heading">
        <div><h2>Reports</h2><p>Build an exportable view of your scoped task data.</p></div>
        <div className="report-actions">
          <button
            type="button"
            className="export-btn export-btn-excel"
            onClick={() => handleExport("excel")}
            disabled={exportingFormat !== null || Boolean(pendingJobId)}
          >
            <span className="export-btn-icon">{exportingFormat === "excel" ? <span className="btn-spinner" /> : <i className="ti ti-file-spreadsheet" />}</span>
            {exportingFormat === "excel" ? "Exporting…" : "Export Excel"}
          </button>
          <button
            type="button"
            className="export-btn export-btn-pdf"
            onClick={() => handleExport("pdf")}
            disabled={exportingFormat !== null || Boolean(pendingJobId)}
          >
            <span className="export-btn-icon">{exportingFormat === "pdf" ? <span className="btn-spinner" /> : <i className="ti ti-file-type-pdf" />}</span>
            {exportingFormat === "pdf" ? "Exporting…" : "Export PDF"}
          </button>
        </div>
      </div>

      {pendingJobId ? <p className="data-state">Export queued — this report has more rows than can be exported instantly, processing in the background…</p> : null}
      {exportError ? <p className="form-error">{exportError}</p> : null}

      <Card className="report-filter-card">
        <h2 className="card-title">Filters</h2>
        <div className="report-filter-grid">
          <label>
            Company
            <select value={companyId} onChange={(event) => chooseCompany(event.target.value)} disabled={role === "Company admin"}>
              <option value="">{role === "Company admin" ? selectedCompany?.name ?? "Company locked" : "All companies"}</option>
              {companies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label>
            Sub-company
            <select value={subCompanyId} onChange={(event) => chooseSubCompany(event.target.value)} disabled={!companyId}>
              <option value="">All sub-companies</option>
              {subCompanies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label>
            Assignee
            <select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} disabled={role === "Employee"}>
              <option value="">{role === "Employee" ? "Assigned to you" : "All assignees"}</option>
              {assignees.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label>
            Status
            <select value={status} onChange={(event) => setStatus(event.target.value as ReportFilters["status"])}>
              {reportStatusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label>
            Date range
            <select value={dateRange} onChange={(event) => setDateRange(event.target.value as ReportFilters["dateRange"])}>
              <option value="all">All time</option>
              <option value="week">This week</option>
              <option value="last30">Last 30 days</option>
              <option value="quarter">Last quarter</option>
            </select>
          </label>
        </div>
      </Card>

      <Card className="report-results-card" title={reportQuery.isLoading ? "Loading…" : `${rows.length} result${rows.length === 1 ? "" : "s"}`}>
        {reportQuery.isLoading ? (
          <p className="data-state">Loading report…</p>
        ) : reportQuery.error ? (
          <p className="data-state is-error">{reportQuery.error instanceof ApiError ? reportQuery.error.detail : "Couldn't load the report."}</p>
        ) : (
          <Table<ReportTaskRow>
            rows={rows}
            onRowClick={(task) => navigate(`/tasks/${task.id}`)}
            emptyState="No tasks match the selected filters."
            columns={[
              { key: "id", header: "Task ID", render: (task) => <span className="link-button">{task.taskNumber}</span> },
              { key: "company", header: "Company", render: (task) => <span>{task.company}<small className="table-subline">{task.subCompany}</small></span> },
              { key: "title", header: "Title", render: (task) => <span className="task-title-button">{task.title}</span> },
              { key: "assignee", header: "Assigned to", render: (task) => <CellPerson initials={task.assigneeInitials} name={task.assignee} /> },
              { key: "status", header: "Status", render: (task) => <Badge status={task.status} /> },
              { key: "closedOn", header: "Closed on", render: (task) => task.closedOn ? formatDate(task.closedOn) : "—" },
            ]}
          />
        )}
      </Card>
    </div>
  );
}
