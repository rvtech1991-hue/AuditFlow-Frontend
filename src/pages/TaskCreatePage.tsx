import { ChangeEvent, ClipboardEvent, FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useRole } from "../lib/RoleContext";
import { ApiError } from "../lib/apiClient";
import { getCompaniesForRole, getCompanyById } from "../services/companies";
import { getUsersForRole } from "../services/users";
import { createTask, uploadAttachment, type TaskPriority } from "../services/tasks";
import { todayDateInputValue } from "../lib/dateTime";
import { MAX_UPLOAD_SIZE_BYTES, MAX_UPLOAD_SIZE_MB } from "../lib/config";
import { extractPastedImages } from "../lib/clipboardImages";

const priorities: TaskPriority[] = ["Critical", "High", "Medium", "Low"];

export function TaskCreatePage() {
  const navigate = useNavigate();
  const { role, user } = useRole();

  const companiesQuery = useQuery({ queryKey: ["companies", role], queryFn: () => getCompaniesForRole(role) });
  const companies = companiesQuery.data ?? [];

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [subCompanyId, setSubCompanyId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("High");
  const [dueDate, setDueDate] = useState("");
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [submittedTaskNumber, setSubmittedTaskNumber] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!companyId && companies.length > 0) setCompanyId(companies[0].id);
  }, [companies, companyId]);

  const selectedCompany = companies.find((item) => item.id === companyId);

  const companyDetailQuery = useQuery({ queryKey: ["company", companyId], queryFn: () => getCompanyById(companyId), enabled: Boolean(companyId) });
  const subCompanies = companyDetailQuery.data?.subCompanies ?? [];

  useEffect(() => {
    if (subCompanies.length > 0 && !subCompanies.some((sc) => sc.id === subCompanyId)) setSubCompanyId(subCompanies[0].id);
  }, [subCompanies, subCompanyId]);

  const usersQuery = useQuery({ queryKey: ["users", role], queryFn: () => getUsersForRole(role) });
  const assignees = (usersQuery.data ?? []).filter((u) => u.status === "Active" && u.company === selectedCompany?.name);

  useEffect(() => {
    if (assignees.length > 0 && !assignees.some((a) => a.id === assigneeId)) setAssigneeId(assignees[0].id);
  }, [assignees, assigneeId]);

  const selectedAssignee = assignees.find((item) => item.id === assigneeId);
  const today = todayDateInputValue();

  const handleCompanyChange = (nextCompanyId: string) => {
    setCompanyId(nextCompanyId);
    setSubCompanyId("");
    setAssigneeId("");
  };

  const canSubmit = Boolean(title.trim() && description.trim() && dueDate && dueDate >= today && companyId && assigneeId) && !isSubmitting;

  // Shared by the file picker and paste-to-attach (Ctrl+V a screenshot) below — appends rather
  // than replacing, so pasting a screenshot doesn't wipe out files already picked.
  const addAttachmentFiles = (files: File[]) => {
    if (!files.length) return;
    const oversized = files.filter((file) => file.size > MAX_UPLOAD_SIZE_BYTES);
    if (oversized.length) {
      setError(`${oversized.map((file) => file.name).join(", ")} exceed${oversized.length === 1 ? "s" : ""} the ${MAX_UPLOAD_SIZE_MB}MB upload limit.`);
      return;
    }
    setError("");
    setAttachmentFiles((current) => [...current, ...files]);
  };

  const handlePaste = (event: ClipboardEvent) => addAttachmentFiles(extractPastedImages(event));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    // "YYYY-MM-DD" strings compare correctly lexicographically — belt-and-suspenders alongside
    // the date input's own `min`, since the submit button is JS-gated rather than natively
    // form-validated (a JS-disabled button never triggers the browser's own date-range check).
    if (dueDate < today) {
      setError("Due date can't be in the past.");
      return;
    }

    setError("");
    setIsSubmitting(true);
    try {
      const task = await createTask(
        {
          title: title.trim(),
          description: description.trim(),
          companyId,
          companyName: selectedCompany?.name ?? "",
          subCompanyId: subCompanyId || undefined,
          subCompanyName: subCompanies.find((sc) => sc.id === subCompanyId)?.name,
          assigneeId,
          assigneeName: selectedAssignee?.name ?? "",
          priority,
          dueDate,
        },
        user.name,
      );
      // Attachments go through the Files module against the real task id after creation,
      // matching TaskDetailsPage's upload flow — CreateTaskCommand accepts pre-uploaded
      // metadata, not raw files, so there's no way to attach them in the same call.
      for (const file of attachmentFiles) {
        await uploadAttachment(task.id, file, user.name, true);
      }
      setSubmittedTaskNumber(task.taskNumber);
      // Reset for the next entry — keep company/sub-company/assignee/priority as convenience
      // defaults (creating several tasks for the same company/assignee is the common case).
      setTitle("");
      setDescription("");
      setDueDate("");
      setAttachmentFiles([]);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="modal-route-page">
      <section className="task-create-modal" aria-labelledby="task-create-title">
        <div className="modal-route-heading">
          <div>
            <h2 id="task-create-title">Create new task</h2>
            <p>Log a discrepancy found during audit and assign it for resolution.</p>
          </div>
          <button className="modal-close-button" type="button" aria-label="Close" onClick={() => navigate("/tasks")}>
            <i className="ti ti-x" />
          </button>
        </div>

        <form className="task-create-form" onSubmit={handleSubmit} onPaste={handlePaste}>
          <div className="field">
            <label>Title</label>
            <input value={title} onChange={(event: ChangeEvent<HTMLInputElement>) => setTitle(event.currentTarget.value)} placeholder="e.g., Inventory count mismatch - Warehouse 3" required />
          </div>
          <div className="field">
            <label>Description</label>
            <textarea
              value={description}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setDescription(event.currentTarget.value)}
              placeholder="What did you find, and what was expected instead? Include figures if relevant."
              required
            />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Company</label>
              <select value={companyId} onChange={(event: ChangeEvent<HTMLSelectElement>) => handleCompanyChange(event.currentTarget.value)}>
                {companies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Sub-company</label>
              <select value={subCompanyId} onChange={(event: ChangeEvent<HTMLSelectElement>) => setSubCompanyId(event.currentTarget.value)}>
                {subCompanies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Assign to</label>
              <select value={assigneeId} onChange={(event: ChangeEvent<HTMLSelectElement>) => setAssigneeId(event.currentTarget.value)}>
                {assignees.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Priority</label>
              <select value={priority} onChange={(event: ChangeEvent<HTMLSelectElement>) => setPriority(event.currentTarget.value as TaskPriority)}>
                {priorities.map((item) => <option key={item}>{item}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Due date</label>
            <input type="date" value={dueDate} min={today} onChange={(event: ChangeEvent<HTMLInputElement>) => setDueDate(event.currentTarget.value)} required />
          </div>

          <div className="notification-note">
            <span aria-hidden="true">@</span>
            <p>
              <b>Notification on save -</b> To: {selectedAssignee?.email ?? "—"}. {selectedAssignee?.reportingManager ? `CC: ${selectedAssignee.reportingManager} (reporting manager).` : ""}
              {error ? <strong className="created-note"> {error}</strong> : submittedTaskNumber ? <strong className="created-note"> {submittedTaskNumber} created.</strong> : null}
            </p>
          </div>

          <label className="upload-dropzone">
            <input
              type="file"
              multiple
              onChange={(event) => {
                addAttachmentFiles(Array.from(event.currentTarget.files ?? []));
                event.currentTarget.value = "";
              }}
            />
            <i className="ti ti-cloud-upload" aria-hidden="true" />
            <p>{attachmentFiles.length ? attachmentFiles.map((file) => file.name).join(", ") : `Drag files here, click to upload, or paste (Ctrl+V) a screenshot — up to ${MAX_UPLOAD_SIZE_MB}MB each`}</p>
          </label>

          <div className="modal-footer-actions">
            <button className="btn" type="button" onClick={() => navigate("/tasks")}>{submittedTaskNumber ? "Close" : "Cancel"}</button>
            <button className="btn primary" type="submit" disabled={!canSubmit}>{isSubmitting ? "Creating..." : submittedTaskNumber ? "Create another" : "Create task"}</button>
          </div>
        </form>
      </section>
    </main>
  );
}
