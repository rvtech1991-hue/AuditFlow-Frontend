import { ChangeEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Badge, Button, Toast, type ToastState } from "../components/ui";
import { useRole } from "../lib/RoleContext";
import { ApiError } from "../lib/apiClient";
import { API_MODE } from "../lib/config";
import { createMockTask, taskDirectory, type TaskPriority } from "../mock-data/tasks";
import {
  convertExcelFileToCsv,
  downloadTaskTemplate,
  getBulkReferenceData,
  importBulkTasks,
  isExcelFile,
  parseTaskCsv,
  validateBulkFile,
  validateBulkRow,
  type BulkReferenceData,
  type BulkRowInput,
} from "../services/tasks";

const priorities: TaskPriority[] = ["Critical", "High", "Medium", "Low"];

// ---------------------------------------------------------------------------
// Mock mode — unchanged from the original simulated flow (no real file is
// ever parsed; choosing any file just loads a fixed set of demo rows).
// ---------------------------------------------------------------------------

type MockBulkRow = {
  rowId: number;
  title: string;
  description: string;
  company: string;
  subCompany: string;
  assignee: string;
  priority: TaskPriority | "";
  dueDate: string;
};

type MockPreviewRow = MockBulkRow & { valid: boolean; reason: string };

const simulatedRows: MockBulkRow[] = [
  { rowId: 1, title: "Supplier master approval evidence", description: "Upload approval trail for supplier bank detail changes.", company: "Meridian Group", subCompany: "North Finance", assignee: "Nisha Rao", priority: "High", dueDate: "2026-07-18" },
  { rowId: 2, title: "Warehouse stock count sign-off", description: "Stock count sheet requires warehouse manager signature.", company: "Kestrel Logistics", subCompany: "Depot East", assignee: "Anika Shah", priority: "Medium", dueDate: "2026-07-22" },
  { rowId: 3, title: "", description: "Missing task title should be edited before import.", company: "Meridian Group", subCompany: "South Plant", assignee: "Dev Mehta", priority: "High", dueDate: "2026-07-19" },
  { rowId: 4, title: "Unknown assignee sample", description: "This row intentionally has an assignee outside the selected company.", company: "Patel & Co.", subCompany: "Shared Services", assignee: "Nisha Rao", priority: "Low", dueDate: "" },
];

function validateMockRow(row: MockBulkRow): MockPreviewRow {
  const company = taskDirectory.find((item) => item.company === row.company);
  const reasons: string[] = [];
  if (!row.title.trim()) reasons.push("Title is required");
  if (!row.description.trim()) reasons.push("Description is required");
  if (!company) reasons.push("Company is not recognized");
  if (company && !company.subCompanies.includes(row.subCompany)) reasons.push("Sub-company is not under company");
  if (company && !company.assignees.some((assignee) => assignee.name === row.assignee)) reasons.push("Assignee is not available for company");
  if (!row.priority) reasons.push("Priority is required");
  if (!row.dueDate) reasons.push("Due date is required");
  return { ...row, valid: reasons.length === 0, reason: reasons.join("; ") };
}

function downloadMockTemplate() {
  const csv = "title,description,company,subCompany,assignee,priority,dueDate\n";
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "auditflow-task-template.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function MockBulkCreatePage() {
  const navigate = useNavigate();
  const { user } = useRole();
  const [rows, setRows] = useState<MockBulkRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [importedCount, setImportedCount] = useState(0);
  const previewRows = useMemo(() => rows.map(validateMockRow), [rows]);
  const validRows = previewRows.filter((row) => row.valid);
  const invalidRows = previewRows.filter((row) => !row.valid);

  const simulateUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    setFileName(file?.name ?? "task-import.csv");
    setRows(simulatedRows);
    setImportedCount(0);
    event.currentTarget.value = "";
  };

  const updateRow = (rowId: number, field: keyof MockBulkRow, value: string) => {
    setRows((current) => current.map((row) => (row.rowId === rowId ? { ...row, [field]: value } : row)));
  };

  const importValidRows = () => {
    validRows.forEach((row) => {
      createMockTask({ title: row.title.trim(), description: row.description.trim(), company: row.company, subCompany: row.subCompany, assignee: row.assignee, priority: row.priority as TaskPriority, dueDate: row.dueDate, createdBy: user.name });
    });
    setImportedCount((count) => count + validRows.length);
    setRows(invalidRows.map(({ valid: _valid, reason: _reason, ...row }) => row));
  };

  return (
    <main className="modal-route-page">
      <section className="bulk-upload-modal" aria-labelledby="bulk-upload-title">
        <div className="modal-route-heading">
          <div><h2 id="bulk-upload-title">Bulk create tasks</h2><p>Use this for audits that surface many findings at once — for example, the same checklist item across many sub-companies.</p></div>
          <button className="modal-close-button" type="button" aria-label="Close" onClick={() => navigate("/tasks")}><i className="ti ti-x" /></button>
        </div>
        <div className="bulk-step bulk-template-step"><span>1</span><div><strong>Download the template</strong><p>Pre-filled with your companies, sub-companies, and active users for validation.</p></div><Button size="small" onClick={downloadMockTemplate}><i className="ti ti-download" />Download .csv</Button></div>
        <div className="bulk-step-heading"><span>2</span><strong>Upload your filled file</strong></div>
        <label className="upload-dropzone bulk-upload-dropzone"><input type="file" accept=".csv,.xlsx,.xls" onChange={simulateUpload} /><i className="ti ti-cloud-upload" /><p>{fileName ? <><b>{fileName}</b> — uploaded and validated.</> : "Drag a CSV or Excel file here or click to upload"}</p></label>
        <div className="bulk-step-heading"><span>3</span><strong>Review before import</strong></div>
        {rows.length || importedCount ? (
          <div className="bulk-preview-content">
          <div className="bulk-summary">
            <strong>{validRows.length} valid</strong>
            <strong>{invalidRows.length} invalid</strong>
            {importedCount ? <span>{importedCount} rows imported in this session.</span> : null}
            <Button variant="primary" disabled={!validRows.length} onClick={importValidRows}>Import valid rows only</Button>
          </div>

          {rows.length ? (
            <div className="bulk-table-wrap">
              <table className="grid-table bulk-preview-table">
                <thead>
                  <tr><th>Row</th><th>Status</th><th>Title</th><th>Company / Sub-company</th><th>Assignee</th><th>Priority</th><th>Due date</th><th>Reason</th></tr>
                </thead>
                <tbody>
                  {previewRows.map((row) => (
                    <tr key={row.rowId}>
                      <td>{row.rowId}</td>
                      <td><Badge status={row.valid ? "active" : "overdue"} label={row.valid ? "Valid" : "Invalid"} /></td>
                      <td><input value={row.title} onChange={(event) => updateRow(row.rowId, "title", event.currentTarget.value)} placeholder="Task title" /></td>
                      <td>
                        <select value={row.company} onChange={(event) => updateRow(row.rowId, "company", event.currentTarget.value)}>
                          {taskDirectory.map((item) => <option key={item.company}>{item.company}</option>)}
                        </select>
                        <select value={row.subCompany} onChange={(event) => updateRow(row.rowId, "subCompany", event.currentTarget.value)}>
                          {taskDirectory.flatMap((item) => item.subCompanies).map((item) => <option key={item}>{item}</option>)}
                        </select>
                      </td>
                      <td>
                        <select value={row.assignee} onChange={(event) => updateRow(row.rowId, "assignee", event.currentTarget.value)}>
                          {taskDirectory.flatMap((item) => item.assignees).map((item) => <option key={`${item.email}-${row.rowId}`}>{item.name}</option>)}
                        </select>
                      </td>
                      <td>
                        <select value={row.priority} onChange={(event) => updateRow(row.rowId, "priority", event.currentTarget.value)}>
                          <option value="">Select</option>
                          {priorities.map((item) => <option key={item}>{item}</option>)}
                        </select>
                      </td>
                      <td><input type="date" value={row.dueDate} onChange={(event) => updateRow(row.rowId, "dueDate", event.currentTarget.value)} /></td>
                      <td className="bulk-reason">{row.reason || "Ready to import"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="page-subtitle">All valid rows have been imported. Upload another file to continue.</p>}
          </div>
        ) : <p className="bulk-empty-note">Upload a completed template to preview valid rows and fix any issues before import.</p>}
        <div className="modal-footer-actions"><Button type="button" onClick={() => navigate("/tasks")}>Cancel</Button><Button variant="primary" disabled={!validRows.length} onClick={importValidRows}>Import {validRows.length || ""} tasks</Button></div>
      </section>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Live mode — parses the uploaded CSV client-side (needed because the backend's
// validate response doesn't carry full row data back), calls the real validate
// endpoint for authoritative row-level errors, and re-checks edited rows
// locally against the same reference data the server itself uses.
// ---------------------------------------------------------------------------

type LivePreviewRow = BulkRowInput & { valid: boolean; reason: string };

function LiveBulkCreatePage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<LivePreviewRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [importedCount, setImportedCount] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const referenceQuery = useQuery({ queryKey: ["tasks", "bulk-reference"], queryFn: getBulkReferenceData });
  const reference: BulkReferenceData = referenceQuery.data ?? { companies: [], subCompanies: [], assignees: [] };

  const validRows = rows.filter((row) => row.valid);
  const invalidRows = rows.filter((row) => !row.valid);

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    setUploadError("");
    setIsUploading(true);
    setFileName(file.name);
    try {
      const csvFile = isExcelFile(file) ? await convertExcelFileToCsv(file) : file;
      const [text, outcomes] = await Promise.all([csvFile.text(), validateBulkFile(csvFile)]);
      const parsed = parseTaskCsv(text);
      const outcomeByRow = new Map(outcomes.map((o) => [o.rowNumber, o]));
      const validated = parsed.map((row) => {
        const outcome = outcomeByRow.get(row.rowNumber);
        return outcome ? { ...row, valid: outcome.valid, reason: outcome.reason } : { ...row, ...validateBulkRow(row, reference) };
      });
      setRows(validated);
      setImportedCount(0);
      const validCount = validated.filter((row) => row.valid).length;
      setToast({ kind: "success", message: `${file.name} uploaded — ${validCount} of ${validated.length} row(s) are valid.` });
    } catch (err) {
      const message = err instanceof ApiError ? err.detail : "Couldn't validate that file.";
      setUploadError(message);
      setToast({ kind: "error", message: `Upload failed: ${message}` });
      setRows([]);
    } finally {
      setIsUploading(false);
    }
  };

  const updateRow = (rowNumber: number, field: keyof BulkRowInput, value: string) => {
    setRows((current) =>
      current.map((row) => {
        if (row.rowNumber !== rowNumber) return row;
        const updated = { ...row, [field]: value };
        return { ...updated, ...validateBulkRow(updated, reference) };
      }),
    );
  };

  const importValidRows = async () => {
    setUploadError("");
    setIsImporting(true);
    try {
      const result = await importBulkTasks(validRows);
      setImportedCount((count) => count + result.importedCount);
      setRows(invalidRows);
      setToast({ kind: "success", message: `${result.importedCount} task(s) imported successfully.` });
    } catch (err) {
      const message = err instanceof ApiError ? err.detail : "Couldn't import those rows.";
      setUploadError(message);
      setToast({ kind: "error", message: `Import failed: ${message}` });
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const { fileName: downloadName, blob } = await downloadTaskTemplate();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = downloadName;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.detail : "Couldn't download the template.");
    }
  };

  const subCompanyOptionsFor = (companyName: string) => {
    const company = reference.companies.find((c) => c.name === companyName);
    return company ? reference.subCompanies.filter((sc) => sc.companyId === company.id) : [];
  };

  return (
    <main className="modal-route-page">
      <Toast toast={toast} onDismiss={() => setToast(null)} />
      <section className="bulk-upload-modal" aria-labelledby="bulk-upload-title">
        <div className="modal-route-heading">
          <div><h2 id="bulk-upload-title">Bulk create tasks</h2><p>Use this for audits that surface many findings at once — for example, the same checklist item across many sub-companies.</p></div>
          <button className="modal-close-button" type="button" aria-label="Close" onClick={() => navigate("/tasks")}><i className="ti ti-x" /></button>
        </div>
        <div className="bulk-step bulk-template-step"><span>1</span><div><strong>Download the template</strong><p>Excel file with columns: title, description, company, subCompany, assigneeEmail, priority, dueDate.</p></div><Button size="small" onClick={handleDownloadTemplate}><i className="ti ti-download" />Download .xlsx</Button></div>
        <div className="bulk-step-heading"><span>2</span><div><strong>Upload your filled file</strong><p>CSV or Excel (.xlsx/.xls) accepted.</p></div></div>
        <label className="upload-dropzone bulk-upload-dropzone"><input type="file" accept=".csv,.xlsx,.xls" onChange={handleUpload} disabled={isUploading} /><i className="ti ti-cloud-upload" /><p>{isUploading ? "Validating..." : fileName ? <><b>{fileName}</b> — uploaded and validated.</> : "Drag a CSV or Excel file here or click to upload"}</p></label>
        {uploadError ? <p className="form-error">{uploadError}</p> : null}
        <div className="bulk-step-heading"><span>3</span><strong>Review before import</strong></div>
        {rows.length || importedCount ? (
          <div className="bulk-preview-content">
          <div className="bulk-summary">
            <strong>{validRows.length} valid</strong>
            <strong>{invalidRows.length} invalid</strong>
            {importedCount ? <span>{importedCount} rows imported in this session.</span> : null}
            <Button variant="primary" disabled={!validRows.length || isImporting} onClick={importValidRows}>{isImporting ? "Importing..." : "Import valid rows only"}</Button>
          </div>

          {rows.length ? (
            <div className="bulk-table-wrap">
              <table className="grid-table bulk-preview-table">
                <thead>
                  <tr><th>Row</th><th>Status</th><th>Title</th><th>Company / Sub-company</th><th>Assignee email</th><th>Priority</th><th>Due date</th><th>Reason</th></tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.rowNumber}>
                      <td>{row.rowNumber}</td>
                      <td><Badge status={row.valid ? "active" : "overdue"} label={row.valid ? "Valid" : "Invalid"} /></td>
                      <td><input value={row.title} onChange={(event) => updateRow(row.rowNumber, "title", event.currentTarget.value)} placeholder="Task title" /></td>
                      <td>
                        <select value={row.company} onChange={(event) => { updateRow(row.rowNumber, "company", event.currentTarget.value); updateRow(row.rowNumber, "subCompany", ""); }}>
                          <option value="">Select company</option>
                          {reference.companies.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
                        </select>
                        <select value={row.subCompany} onChange={(event) => updateRow(row.rowNumber, "subCompany", event.currentTarget.value)}>
                          <option value="">None</option>
                          {subCompanyOptionsFor(row.company).map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
                        </select>
                      </td>
                      <td><input value={row.assigneeEmail} onChange={(event) => updateRow(row.rowNumber, "assigneeEmail", event.currentTarget.value)} placeholder="name@company.com" /></td>
                      <td>
                        <select value={row.priority} onChange={(event) => updateRow(row.rowNumber, "priority", event.currentTarget.value)}>
                          <option value="">Select</option>
                          {priorities.map((item) => <option key={item}>{item}</option>)}
                        </select>
                      </td>
                      <td><input type="date" value={row.dueDate} onChange={(event) => updateRow(row.rowNumber, "dueDate", event.currentTarget.value)} /></td>
                      <td className="bulk-reason">{row.reason || "Ready to import"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="page-subtitle">All valid rows have been imported. Upload another file to continue.</p>}
          </div>
        ) : <p className="bulk-empty-note">Upload a completed template to preview valid rows and fix any issues before import.</p>}
        <div className="modal-footer-actions"><Button type="button" onClick={() => navigate("/tasks")}>Cancel</Button><Button variant="primary" disabled={!validRows.length || isImporting} onClick={importValidRows}>Import {validRows.length || ""} tasks</Button></div>
      </section>
    </main>
  );
}

export function TaskBulkCreatePage() {
  return API_MODE === "mock" ? <MockBulkCreatePage /> : <LiveBulkCreatePage />;
}
