import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, Card, CellPerson } from "../components/ui";
import { useRole } from "../lib/RoleContext";
import { ApiError } from "../lib/apiClient";
import { MAX_UPLOAD_SIZE_BYTES, MAX_UPLOAD_SIZE_MB } from "../lib/config";
import { getUsersForRole } from "../services/users";
import { parseApiDateTime, todayDateInputValue } from "../lib/dateTime";
import {
  addComment,
  assignTask,
  changeTaskStatus,
  deleteAttachment,
  getTaskDetail,
  updateTask,
  uploadAttachment,
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

function statusLabel(status: TaskStatus) {
  if (status === "progress") return "In progress";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function statusOptionsForRole(role: Role): Array<Exclude<TaskStatus, "overdue">> {
  const base: Array<Exclude<TaskStatus, "overdue">> = ["open", "progress", "resolved", "closed", "reopened"];
  // Only an Auditor can move a task to Closed or Reopened (BACKEND_INTEGRATION_GUIDE SS1).
  if (role === "Auditor") return base;
  return base.filter((status) => status !== "closed" && status !== "reopened");
}

function OverviewTab({
  task,
  role,
  onSaveFields,
  onReassign,
  onStatusChange,
  isSaving,
  isStatusSaving,
}: {
  task: TaskDetail;
  role: Role;
  onSaveFields: (fields: { title: string; description: string; priority: TaskPriority; dueDate: string }) => void;
  onReassign: (assigneeId: string, assigneeName: string) => void;
  onStatusChange: (status: Exclude<TaskStatus, "overdue">) => void;
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
  const visibleStatusOptions = statusOptionsForRole(role);

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
              <select value={task.status === "overdue" ? "open" : task.status} onChange={(event) => onStatusChange(event.currentTarget.value as Exclude<TaskStatus, "overdue">)} disabled={!canChangeStatus || isStatusSaving}>
                {visibleStatusOptions.map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}
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
  const mutation = useMutation({
    mutationFn: () => addComment(task.id, user.name, role, body.trim()),
    onSuccess: () => {
      setBody("");
      queryClient.invalidateQueries({ queryKey: ["task", task.id] });
    },
  });

  return (
    <Card>
      {canComment ? (
        <form className="comment-composer" onSubmit={(event: FormEvent) => { event.preventDefault(); if (body.trim()) mutation.mutate(); }}>
          <textarea value={body} onChange={(event) => setBody(event.currentTarget.value)} placeholder="Add a comment..." />
          <Button type="submit" variant="primary" disabled={!body.trim() || mutation.isPending}>{mutation.isPending ? "Posting..." : "Add comment"}</Button>
        </form>
      ) : null}
      {mutation.isError ? <p className="form-error">{mutation.error instanceof ApiError ? mutation.error.detail : "Couldn't post the comment."}</p> : null}
      <div className="activity-list">
        {task.comments.map((comment) => (
          <article key={comment.id} className="activity-item">
            <CellPerson initials={comment.author.split(" ").map((part) => part[0]).join("").slice(0, 2)} name={comment.author} meta={`${comment.role} - ${formatDateTime(comment.createdAt)}`} />
            <p>{comment.body}</p>
          </article>
        ))}
      </div>
    </Card>
  );
}

function DocumentsTab({ task, canUpload }: { task: TaskDetail; canUpload: boolean }) {
  const { user } = useRole();
  const queryClient = useQueryClient();
  const [uploadError, setUploadError] = useState("");
  const uploadMutation = useMutation({
    mutationFn: (files: File[]) => Promise.all(files.map((file) => uploadAttachment(task.id, file, user.name))),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["task", task.id] }),
    onError: (err) => setUploadError(err instanceof ApiError ? err.detail : "Couldn't upload the file."),
  });
  const deleteMutation = useMutation({
    mutationFn: (attachmentId: string) => deleteAttachment(task.id, attachmentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["task", task.id] }),
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
      <div className="document-list">
        {task.attachments.map((document) => (
          <div key={document.id} className="document-row">
            <div className="document-row-info">
              <strong>{document.name}</strong>
              <span>{document.sizeLabel} - {document.uploadedBy} - {formatDateTime(document.uploadedAt)}</span>
            </div>
            {canUpload ? <button className="icon-button" type="button" aria-label={`Delete ${document.name}`} onClick={() => deleteMutation.mutate(document.id)}><i className="ti ti-trash" /></button> : null}
          </div>
        ))}
      </div>
    </Card>
  );
}

function TimelineTab({ task }: { task: TaskDetail }) {
  const entries = task.timeline;

  return (
    <Card>
      <div className="status-trail">
        {statusTrail.map((status) => {
          const entry = entries.find((item) => item.toStatus === status);
          // "Open" is the task's starting status, not something reached via a logged
          // transition — no timeline entry is ever recorded for it, so treat it as always
          // satisfied from creation instead of leaving it stuck on "Pending".
          const isImplicitOpen = status === "open" && !entry;
          const complete = Boolean(entry) || isImplicitOpen;
          return (
            <div key={status} className={`status-step ${complete ? "complete" : ""}`}>
              <span aria-hidden="true" />
              <strong>{statusLabel(status)}</strong>
              <small>
                {entry
                  ? `${entry.actor} - ${formatDateTime(entry.createdAt)}`
                  : isImplicitOpen
                    ? `${task.createdBy} - ${formatDate(task.createdOn)}`
                    : "Pending"}
              </small>
              {entry?.reason ? <p>{entry.reason}</p> : null}
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

  const taskQuery = useQuery({ queryKey: ["task", taskId], queryFn: () => getTaskDetail(taskId, role, user.email), enabled: Boolean(taskId) });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["task", taskId] });
  const saveFieldsMutation = useMutation({
    mutationFn: (fields: { title: string; description: string; priority: TaskPriority; dueDate: string }) => updateTask(taskId, fields),
    onSuccess: invalidate,
  });
  const reassignMutation = useMutation({
    mutationFn: ({ assigneeId, assigneeName }: { assigneeId: string; assigneeName: string }) => assignTask(taskId, assigneeId, assigneeName),
    onSuccess: invalidate,
  });
  const statusMutation = useMutation({
    mutationFn: ({ status, reason }: { status: Exclude<TaskStatus, "overdue">; reason?: string }) => changeTaskStatus(taskId, status, user.name, reason),
    onSuccess: invalidate,
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
      <div className="task-details-header">
        <div>
          <button className="view-all-link" type="button" onClick={() => navigate("/tasks")}>Back to tasks</button>
          <div className="task-heading-line">
            <h2>{task.title}</h2>
            <Badge status={task.status} />
          </div>
          <p>{task.taskNumber} - {task.company} / {task.subCompany}</p>
        </div>
        {canManageClosure ? (
          <div className="task-action-buttons">
            {task.status === "closed" ? (
              <Button variant="primary" onClick={() => setReopenModalOpen(true)}>Reopen</Button>
            ) : (
              <Button variant="primary" onClick={closeTask}>Close task</Button>
            )}
          </div>
        ) : null}
      </div>

      <Card className="task-intro-card">
        <div className="task-intro-meta"><span>{task.taskNumber}</span><Badge status={task.status} /><span className="priority-pill">{task.priority} priority</span></div>
        <p>{task.description}</p>
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
        />
      ) : null}
      {activeTab === "comments" ? <CommentsTab task={task} canComment={canComment} /> : null}
      {activeTab === "documents" ? <DocumentsTab task={task} canUpload={canComment} /> : null}
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
