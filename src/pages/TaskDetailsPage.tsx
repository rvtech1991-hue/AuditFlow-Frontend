import { ChangeEvent, ClipboardEvent, FormEvent, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, Card, CellPerson, Toast, type ToastState } from "../components/ui";
import { useRole } from "../lib/RoleContext";
import { ApiError } from "../lib/apiClient";
import { MAX_UPLOAD_SIZE_BYTES, MAX_UPLOAD_SIZE_MB } from "../lib/config";
import { extractPastedImages } from "../lib/clipboardImages";
import { getUsersForRole } from "../services/users";
import { parseApiDateTime, todayDateInputValue } from "../lib/dateTime";
import {
  addComment,
  assignTask,
  changeTaskStatus,
  deleteAttachment,
  downloadAttachment,
  getTaskDetail,
  updateTask,
  uploadAttachment,
  type TaskAttachment,
  type TaskDetail,
  type TaskPriority,
  type TaskStatus,
} from "../services/tasks";
import type { Role } from "../types";

type TabKey = "overview" | "comments" | "documents" | "timeline";

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "comments", label: "Comments" },
  { key: "documents", label: "Documents" },
  { key: "timeline", label: "Timeline" },
];

const priorityOptions: TaskPriority[] = ["Critical", "High", "Medium", "Low"];
const statusTrail: Array<Exclude<TaskStatus, "overdue">> = ["open", "progress", "resolved", "closed"];

function formatDate(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value.includes("T") ? value : `${value}T00:00:00`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(parseApiDateTime(value));
}

async function downloadTaskAttachment(attachment: TaskAttachment): Promise<void> {
  const blob = await downloadAttachment(attachment.id);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = attachment.name;
  link.click();
  URL.revokeObjectURL(url);
}

function statusLabel(status: TaskStatus) {
  if (status === "progress") return "In progress";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

// Mirrors TaskItem.CanChangeStatus on the backend exactly: an Employee can only move
// Open->InProgress, InProgress->Resolved/Open, or Resolved->InProgress, and can never touch a
// Closed or Reopened task at all (dead end - must wait for an Auditor). Offering anything wider
// here just lets the user pick a status the PATCH will then reject.
const EMPLOYEE_TRANSITIONS: Partial<Record<Exclude<TaskStatus, "overdue">, Array<Exclude<TaskStatus, "overdue">>>> = {
  open: ["progress"],
  progress: ["resolved", "open"],
  resolved: ["progress"],
};

function statusOptionsForRole(role: Role, currentStatus: Exclude<TaskStatus, "overdue">): Array<Exclude<TaskStatus, "overdue">> {
  if (role === "Auditor") {
    // The backend places no sequence restriction on an Auditor at all (TaskItem.CanChangeStatus
    // returns true unconditionally for Auditor/PlatformAdmin) - but the *current* status must
    // always be included as one of the options, or a dropdown left with only a single remaining
    // choice can never register a change (there's nothing to select away from - the browser
    // already shows it as selected, so picking it again fires no onChange event at all).
    if (currentStatus === "closed") return ["closed", "reopened"];
    if (currentStatus === "reopened") return ["reopened", "progress", "resolved", "closed"];
    return ["open", "progress", "resolved", "closed"];
  }

  // Employee: exact mirror of the backend dictionary above, plus the current status so the
  // select always has something to move away from.
  const nextOptions = EMPLOYEE_TRANSITIONS[currentStatus] ?? [];
  return nextOptions.length ? [currentStatus, ...nextOptions] : [];
}

function OverviewTab({
  task,
  role,
  onSaveFields,
  onReassign,
  onStatusChange,
  onRequestReopen,
  isSaving,
  isStatusSaving,
}: {
  task: TaskDetail;
  role: Role;
  onSaveFields: (fields: { title: string; description: string; priority: TaskPriority; dueDate: string }) => void;
  onReassign: (assigneeId: string, assigneeName: string) => void;
  onStatusChange: (status: Exclude<TaskStatus, "overdue">) => void;
  onRequestReopen: () => void;
  isSaving: boolean;
  isStatusSaving: boolean;
}) {
  // Only an Auditor can edit title/description/priority/due-date/assignee (PUT /tasks/{id} and
  // PATCH /tasks/{id}/assign are Auditor-only) — CompanyAdmin is view-only on tasks entirely,
  // and Employee can only change status/comments/attachments (BACKEND_INTEGRATION_GUIDE SS1).
  const canEditFields = role === "Auditor";
  const canChangeStatus = role === "Auditor" || role === "Employee";
  const usersQuery = useQuery({ queryKey: ["users", role], queryFn: () => getUsersForRole(role), enabled: canEditFields });
  const assigneeOptions = (usersQuery.data ?? []).filter((u) => u.status === "Active" && u.company === task.company);

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [dueDate, setDueDate] = useState(task.dueDate);
  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description);
    setPriority(task.priority);
    setDueDate(task.dueDate);
  }, [task.id, task.title, task.description, task.priority, task.dueDate]);

  const dirty = title !== task.title || description !== task.description || priority !== task.priority || dueDate !== task.dueDate;
  const currentStatus = task.status === "overdue" ? "open" : task.status;
  const visibleStatusOptions = statusOptionsForRole(role, currentStatus);

  return (
    <div className="task-details-grid">
      <Card>
        <div className="task-overview-form">
          <label>
            Title
            <input value={title} onChange={(event) => setTitle(event.currentTarget.value)} readOnly={!canEditFields} />
          </label>
          <label>
            Description
            <textarea value={description} onChange={(event) => setDescription(event.currentTarget.value)} readOnly={!canEditFields} />
          </label>
          <div className="field-row">
            <label>
              Company
              <input value={task.company} readOnly disabled />
            </label>
            <label>
              Sub-company
              <input value={task.subCompany} readOnly disabled />
            </label>
          </div>
          <div className="field-row">
            <label>
              Assignee
              <select
                value={task.assigneeEmail}
                onChange={(event) => {
                  const selected = assigneeOptions.find((item) => item.email === event.currentTarget.value);
                  if (selected) onReassign(selected.id, selected.name);
                }}
                disabled={!canEditFields}
              >
                {!assigneeOptions.some((item) => item.email === task.assigneeEmail) ? <option value={task.assigneeEmail}>{task.assignee}</option> : null}
                {assigneeOptions.map((item) => <option key={item.id} value={item.email}>{item.name}</option>)}
              </select>
            </label>
            <label>
              Priority
              <select value={priority} onChange={(event) => setPriority(event.currentTarget.value as TaskPriority)} disabled={!canEditFields}>
                {priorityOptions.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
          </div>
          <div className="field-row">
            <label>
              Due date
              <input type="date" value={dueDate} min={todayDateInputValue()} onChange={(event) => setDueDate(event.currentTarget.value)} readOnly={!canEditFields} disabled={!canEditFields} />
            </label>
            <label>
              Status
              <select
                value={currentStatus}
                onChange={(event) => {
                  const next = event.currentTarget.value as Exclude<TaskStatus, "overdue">;
                  // Reopening always requires a reason — hand off to the header's Reopen modal
                  // instead of firing a bare status PATCH that the backend would reject.
                  if (next === "reopened") {
                    onRequestReopen();
                    return;
                  }
                  onStatusChange(next);
                }}
                disabled={!canChangeStatus || isStatusSaving || visibleStatusOptions.length === 0}
              >
                {(visibleStatusOptions.length ? visibleStatusOptions : [currentStatus]).map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}
              </select>
              {/* Status saves immediately on change — it's a separate PATCH from the "Save
                  changes" button below, which only covers title/description/priority/due date. */}
              {canChangeStatus ? <small className="field-hint">{isStatusSaving ? "Updating status…" : "Changes here save immediately."}</small> : null}
            </label>
          </div>
          {canEditFields ? (
            <div className="modal-footer-actions">
              <Button variant="primary" disabled={!dirty || isSaving} onClick={() => onSaveFields({ title, description, priority, dueDate })}>
                {isSaving ? "Saving..." : "Save changes"}
              </Button>
            </div>
          ) : null}
        </div>
      </Card>

      <Card title="Task fields">
        <div className="task-fact-list">
          <span><strong>Task ID</strong>{task.taskNumber}</span>
          <span><strong>Created by</strong>{task.createdBy}</span>
          <span><strong>Created on</strong>{formatDate(task.createdOn)}</span>
          <span><strong>Assigned to</strong>{task.assigneeEmail}</span>
          <span><strong>Priority</strong>{task.priority}</span>
          <span><strong>Due date</strong>{formatDate(task.dueDate)}</span>
        </div>
      </Card>
    </div>
  );
}

function CommentsTab({ task, canComment }: { task: TaskDetail; canComment: boolean }) {
  const { user, role } = useRole();
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [pendingImages, setPendingImages] = useState<Array<{ file: File; previewUrl: string }>>([]);
  const [uploadError, setUploadError] = useState("");
  const [downloadError, setDownloadError] = useState("");

  // Object URLs (one per staged paste preview) must be revoked or they leak - a ref keeps the
  // unmount cleanup below reading the latest list instead of whatever was staged at mount time.
  const pendingImagesRef = useRef(pendingImages);
  pendingImagesRef.current = pendingImages;
  useEffect(() => {
    return () => pendingImagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
  }, []);

  const mutation = useMutation({
    mutationFn: async () => {
      const comment = await addComment(task.id, user.name, role, body.trim());
      // Sequential, not Promise.all - keeps the eventual attachment order on the comment matching
      // the order they were pasted in, same reasoning as DocumentsTab's multi-file upload.
      for (const { file } of pendingImages) {
        await uploadAttachment(task.id, file, user.name, false, comment.id);
      }
    },
    onSuccess: () => {
      setBody("");
      pendingImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      setPendingImages([]);
      queryClient.invalidateQueries({ queryKey: ["task", task.id] });
    },
  });
  const downloadMutation = useMutation({
    mutationFn: (attachment: TaskAttachment) => downloadTaskAttachment(attachment),
    onMutate: () => setDownloadError(""),
    onError: (err) => setDownloadError(err instanceof ApiError ? err.detail : "Couldn't download the file."),
  });

  const handlePaste = (event: ClipboardEvent) => {
    const images = extractPastedImages(event);
    if (!images.length) return;
    const oversized = images.filter((file) => file.size > MAX_UPLOAD_SIZE_BYTES);
    if (oversized.length) {
      setUploadError(`${oversized.map((file) => file.name).join(", ")} exceed${oversized.length === 1 ? "s" : ""} the ${MAX_UPLOAD_SIZE_MB}MB upload limit.`);
      return;
    }
    setUploadError("");
    setPendingImages((current) => [...current, ...images.map((file) => ({ file, previewUrl: URL.createObjectURL(file) }))]);
  };

  const removePendingImage = (index: number) => {
    setPendingImages((current) => {
      const target = current[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((_, i) => i !== index);
    });
  };

  return (
    <Card>
      {canComment ? (
        <form className="comment-composer" onSubmit={(event: FormEvent) => { event.preventDefault(); if (body.trim()) mutation.mutate(); }}>
          <textarea
            value={body}
            onChange={(event) => setBody(event.currentTarget.value)}
            onPaste={handlePaste}
            placeholder="Add a comment... (paste a screenshot with Ctrl+V to attach it)"
          />
          {pendingImages.length ? (
            <div className="comment-pending-images">
              {pendingImages.map((image, index) => (
                <div key={image.previewUrl} className="comment-pending-image">
                  <img src={image.previewUrl} alt={image.file.name} />
                  <button type="button" aria-label={`Remove ${image.file.name}`} onClick={() => removePendingImage(index)}>
                    <i className="ti ti-x" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          {uploadError ? <p className="form-error">{uploadError}</p> : null}
          <Button type="submit" variant="primary" disabled={!body.trim() || mutation.isPending}>{mutation.isPending ? "Posting..." : "Add comment"}</Button>
        </form>
      ) : null}
      {mutation.isError ? <p className="form-error">{mutation.error instanceof ApiError ? mutation.error.detail : "Couldn't post the comment."}</p> : null}
      {downloadError ? <p className="form-error">{downloadError}</p> : null}
      <div className="activity-list">
        {task.comments.map((comment) => (
          <article key={comment.id} className="activity-item">
            <CellPerson initials={comment.author.split(" ").map((part) => part[0]).join("").slice(0, 2)} name={comment.author} meta={`${comment.role} - ${formatDateTime(comment.createdAt)}`} />
            <p>{comment.body}</p>
            {comment.attachments.length ? (
              <div className="comment-attachments">
                {comment.attachments.map((attachment) => (
                  <button
                    key={attachment.id}
                    type="button"
                    className="task-document-chip"
                    disabled={downloadMutation.isPending && downloadMutation.variables?.id === attachment.id}
                    onClick={() => downloadMutation.mutate(attachment)}
                    title={`Download ${attachment.name} (${attachment.sizeLabel})`}
                  >
                    <i className="ti ti-paperclip" />
                    <span>{attachment.name}</span>
                    <i className="ti ti-download" />
                  </button>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </Card>
  );
}

function DocumentsTab({ task, attachments, canUpload }: { task: TaskDetail; attachments: TaskAttachment[]; canUpload: boolean }) {
  const { user } = useRole();
  const queryClient = useQueryClient();
  const [uploadError, setUploadError] = useState("");
  const [downloadError, setDownloadError] = useState("");
  const uploadMutation = useMutation({
    mutationFn: (files: File[]) => Promise.all(files.map((file) => uploadAttachment(task.id, file, user.name))),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["task", task.id] }),
    onError: (err) => setUploadError(err instanceof ApiError ? err.detail : "Couldn't upload the file."),
  });
  const deleteMutation = useMutation({
    mutationFn: (attachmentId: string) => deleteAttachment(task.id, attachmentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["task", task.id] }),
  });
  const downloadMutation = useMutation({
    mutationFn: (attachment: TaskAttachment) => downloadTaskAttachment(attachment),
    onMutate: () => setDownloadError(""),
    onError: (err) => setDownloadError(err instanceof ApiError ? err.detail : "Couldn't download the file."),
  });

  const uploadFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (!files.length) return;
    const oversized = files.filter((file) => file.size > MAX_UPLOAD_SIZE_BYTES);
    if (oversized.length) {
      setUploadError(`${oversized.map((file) => file.name).join(", ")} exceed${oversized.length === 1 ? "s" : ""} the ${MAX_UPLOAD_SIZE_MB}MB upload limit.`);
      return;
    }
    setUploadError("");
    uploadMutation.mutate(files);
  };

  return (
    <Card>
      {canUpload ? (
        <label className="details-upload">
          <input type="file" multiple onChange={uploadFiles} disabled={uploadMutation.isPending} />
          <span>{uploadMutation.isPending ? "Uploading..." : "Upload documents"}</span>
          <small>Evidence files and supporting schedules, up to {MAX_UPLOAD_SIZE_MB}MB each.</small>
        </label>
      ) : null}
      {uploadError ? <p className="form-error">{uploadError}</p> : null}
      {downloadError ? <p className="form-error">{downloadError}</p> : null}
      <div className="document-list">
        {attachments.map((document) => {
          const isDownloading = downloadMutation.isPending && downloadMutation.variables?.id === document.id;
          return (
            <div key={document.id} className="document-row">
              <div className="document-row-info">
                <strong>{document.name}</strong>
                <span>{document.sizeLabel} - {document.uploadedBy} - {formatDateTime(document.uploadedAt)}</span>
              </div>
              <div className="document-row-actions">
                <button className="icon-button" type="button" aria-label={`Download ${document.name}`} disabled={isDownloading} onClick={() => downloadMutation.mutate(document)}>
                  <i className="ti ti-download" />
                </button>
                {canUpload ? (
                  <button className="icon-button danger" type="button" aria-label={`Delete ${document.name}`} onClick={() => deleteMutation.mutate(document.id)}>
                    <i className="ti ti-trash" />
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function TimelineTab({ task }: { task: TaskDetail }) {
  const entries = task.timeline;

  const steps = statusTrail.map((status) => {
    const entry = entries.find((item) => item.toStatus === status);
    // "Open" is the task's starting status, not something reached via a logged
    // transition — no timeline entry is ever recorded for it, so treat it as always
    // satisfied from creation instead of leaving it stuck on "Pending".
    const isImplicitOpen = status === "open" && !entry;
    const complete = Boolean(entry) || isImplicitOpen;
    return { status, entry, isImplicitOpen, complete };
  });
  // The trail is a strict sequence (open -> progress -> resolved -> closed) — the "current"
  // stage is the furthest one actually reached, so it's the highest index still marked complete.
  const currentIndex = steps.reduce((latest, step, index) => (step.complete ? index : latest), 0);

  return (
    <Card>
      <div className="status-trail">
        {steps.map((step, index) => {
          // "Closed" is a terminal state — nothing comes after it, so even when it's the
          // furthest stage reached it should read as done (green check), not as an
          // actively-in-progress stage (blue pulse), which only makes sense for a stage
          // something is still moving through (open/in progress/resolved).
          const isPast = step.complete && (index < currentIndex || step.status === "closed");
          const isCurrent = step.complete && index === currentIndex && step.status !== "closed";
          const stepState = isPast ? "is-past" : isCurrent ? "is-current" : "is-upcoming";
          return (
            <div key={step.status} className={`status-step ${stepState}`}>
              <span className="status-step-dot" aria-hidden="true">
                {isPast ? <i className="ti ti-check" /> : isCurrent ? <i className="ti ti-point-filled" /> : null}
              </span>
              <div className="status-step-body">
                <strong>{statusLabel(step.status)}</strong>
                <small>
                  {step.entry
                    ? `${step.entry.actor} - ${formatDateTime(step.entry.createdAt)}`
                    : step.isImplicitOpen
                      ? `${task.createdBy} - ${formatDate(task.createdOn)}`
                      : "Pending"}
                </small>
                {step.entry?.reason ? <p>{step.entry.reason}</p> : null}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function TaskDetailsPage() {
  const { taskId = "" } = useParams();
  const navigate = useNavigate();
  const { role, user } = useRole();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [reopenModalOpen, setReopenModalOpen] = useState(false);
  const [reopenComment, setReopenComment] = useState("");
  const [toast, setToast] = useState<ToastState>(null);

  const taskQuery = useQuery({ queryKey: ["task", taskId], queryFn: () => getTaskDetail(taskId, role, user.email), enabled: Boolean(taskId) });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["task", taskId] });
  // Status/assignee changes shift which bucket this task falls into for the sidebar's Tasks
  // badge (dashboard summary), the grid, and reports — invalidate those alongside the task
  // itself so the counts update immediately instead of waiting for a poll or a page reload.
  const invalidateTaskCounts = () => {
    invalidate();
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    queryClient.invalidateQueries({ queryKey: ["report"] });
  };
  const saveFieldsMutation = useMutation({
    mutationFn: (fields: { title: string; description: string; priority: TaskPriority; dueDate: string }) => updateTask(taskId, fields),
    onSuccess: () => {
      invalidate();
      setToast({ kind: "success", message: "Changes saved successfully." });
    },
    onError: (err) => setToast({ kind: "error", message: err instanceof ApiError ? err.detail : "Couldn't save changes." }),
  });
  const reassignMutation = useMutation({
    mutationFn: ({ assigneeId, assigneeName }: { assigneeId: string; assigneeName: string }) => assignTask(taskId, assigneeId, assigneeName),
    onSuccess: () => {
      invalidateTaskCounts();
      setToast({ kind: "success", message: "Task reassigned successfully." });
    },
    onError: (err) => setToast({ kind: "error", message: err instanceof ApiError ? err.detail : "Couldn't reassign this task." }),
  });
  const statusMutation = useMutation({
    mutationFn: ({ status, reason }: { status: Exclude<TaskStatus, "overdue">; reason?: string }) => changeTaskStatus(taskId, status, user.name, reason),
    onSuccess: (_data, variables) => {
      invalidateTaskCounts();
      setToast({ kind: "success", message: `Status updated to "${statusLabel(variables.status)}".` });
    },
    onError: (err) => setToast({ kind: "error", message: err instanceof ApiError ? err.detail : "Couldn't update the status." }),
  });
  const attachmentDownloadMutation = useMutation({
    mutationFn: (attachment: TaskAttachment) => downloadTaskAttachment(attachment),
    onError: (err) => setToast({ kind: "error", message: err instanceof ApiError ? err.detail : "Couldn't download the file." }),
  });

  if (taskQuery.isLoading) {
    return <div className="task-details-page"><p className="data-state">Loading task…</p></div>;
  }
  if (taskQuery.error) {
    const detail = taskQuery.error instanceof ApiError ? taskQuery.error.detail : "Couldn't load this task.";
    return <div className="task-details-page"><p className="data-state is-error">{detail}</p></div>;
  }
  if (!taskQuery.data) return <Navigate to="/tasks" replace />;
  const task = taskQuery.data;
  // Split once here rather than in each consumer — attached-at-creation files show up top next
  // to the description, everything added later via the Documents tab shows there instead, and
  // anything pasted into a specific comment shows only inline under that comment (task.attachments
  // still carries those too - the backend needs TaskId set on them for its access checks - so they
  // must be excluded here or the same file would appear a second time in one of the lists below).
  const taskLevelAttachments = task.attachments.filter((attachment) => !attachment.commentId);
  const initialAttachments = taskLevelAttachments.filter((attachment) => attachment.isInitialUpload);
  const laterAttachments = taskLevelAttachments.filter((attachment) => !attachment.isInitialUpload);

  const canManageClosure = role === "Auditor";
  const canComment = role === "Auditor" || role === "Employee";

  const changeStatus = (status: Exclude<TaskStatus, "overdue">, reason?: string) => {
    if (role !== "Auditor" && (status === "closed" || status === "reopened")) return;
    statusMutation.mutate({ status, reason });
  };

  const closeTask = () => changeStatus("closed");
  const reopenTask = (event: FormEvent) => {
    event.preventDefault();
    if (!reopenComment.trim()) return;
    changeStatus("reopened", reopenComment.trim());
    setReopenComment("");
    setReopenModalOpen(false);
  };

  return (
    <div className="task-details-page">
      <Toast toast={toast} onDismiss={() => setToast(null)} />
      <div className="task-details-header">
        <div>
          <button className="task-back-link" type="button" onClick={() => navigate("/tasks")}><i className="ti ti-arrow-left" />Back to tasks</button>
          <div className="task-heading-line">
            <h2>{task.title}</h2>
          </div>
          <p>{task.taskNumber} - {task.company} / {task.subCompany}</p>
        </div>
        {canManageClosure ? (
          <div className="task-action-buttons">
            {task.status === "closed" ? (
              <Button variant="primary" onClick={() => setReopenModalOpen(true)}>Reopen</Button>
            ) : (
              <Button
                variant="primary"
                onClick={closeTask}
                disabled={task.status !== "resolved"}
                title={task.status !== "resolved" ? "Mark the task Resolved first — Closed requires auditor sign-off on a resolved task." : undefined}
              >
                Close task
              </Button>
            )}
          </div>
        ) : null}
      </div>

      <Card className="task-intro-card">
        <div className="task-intro-meta"><span>{task.taskNumber}</span><span className="priority-pill">{task.priority} priority</span><Badge status={task.status} /></div>
        <p>{task.description}</p>
        {initialAttachments.length ? (
          <div className="task-intro-attachments">
            {initialAttachments.map((attachment) => (
              <button
                key={attachment.id}
                type="button"
                className="task-document-chip"
                disabled={attachmentDownloadMutation.isPending && attachmentDownloadMutation.variables?.id === attachment.id}
                onClick={() => attachmentDownloadMutation.mutate(attachment)}
                title={`Download ${attachment.name} (${attachment.sizeLabel})`}
              >
                <i className="ti ti-paperclip" />
                <span>{attachment.name}</span>
                <i className="ti ti-download" />
              </button>
            ))}
          </div>
        ) : null}
      </Card>

      <div className="task-tabs" role="tablist" aria-label="Task details tabs">
        {tabs.map((tab) => (
          <button key={tab.key} className={activeTab === tab.key ? "active" : ""} type="button" onClick={() => setActiveTab(tab.key)}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" ? (
        <OverviewTab
          task={task}
          role={role}
          isSaving={saveFieldsMutation.isPending}
          isStatusSaving={statusMutation.isPending}
          onSaveFields={(fields) => saveFieldsMutation.mutate(fields)}
          onReassign={(assigneeId, assigneeName) => reassignMutation.mutate({ assigneeId, assigneeName })}
          onStatusChange={(status) => changeStatus(status)}
          onRequestReopen={() => setReopenModalOpen(true)}
        />
      ) : null}
      {activeTab === "comments" ? <CommentsTab task={task} canComment={canComment} /> : null}
      {activeTab === "documents" ? <DocumentsTab task={task} attachments={laterAttachments} canUpload={canComment} /> : null}
      {activeTab === "timeline" ? <TimelineTab task={task} /> : null}

      {reopenModalOpen ? (
        <div className="modal-backdrop" role="presentation">
          <form className="modal-panel reopen-modal" role="dialog" aria-modal="true" aria-label="Reopen task" onSubmit={reopenTask}>
            <header className="modal-header">
              <h2 className="card-title" style={{ margin: 0 }}>Reopen task</h2>
              <button className="icon-button" type="button" aria-label="Close" onClick={() => setReopenModalOpen(false)}>×</button>
            </header>
            <div className="modal-body">
              <label>
                Required comment
                <textarea value={reopenComment} onChange={(event) => setReopenComment(event.currentTarget.value)} placeholder="Explain why this task is being reopened." required />
              </label>
            </div>
            <footer className="modal-footer">
              <Button type="button" onClick={() => setReopenModalOpen(false)}>Cancel</Button>
              <Button type="submit" variant="primary" disabled={!reopenComment.trim()}>Reopen task</Button>
            </footer>
          </form>
        </div>
      ) : null}
    </div>
  );
}
