import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Badge, Button, Card, CellPerson } from "../components/ui";
import { useRole } from "../lib/RoleContext";
import type { Role } from "../types";
import {
  addTaskComment,
  addTaskDocument,
  getRoleScopedTasks,
  getTaskById,
  taskAuditTimeline,
  taskComments,
  taskDirectory,
  taskDocuments,
  taskStatusHistory,
  updateTaskStatus,
  type AuditTask,
  type TaskPriority,
  type TaskStatus,
} from "../mock-data/tasks";

type TabKey = "overview" | "comments" | "documents" | "status" | "timeline";

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "comments", label: "Comments" },
  { key: "documents", label: "Documents" },
  { key: "status", label: "Status history" },
  { key: "timeline", label: "Audit timeline" },
];

const statusOptions: TaskStatus[] = ["open", "progress", "resolved", "closed"];
const priorityOptions: TaskPriority[] = ["High", "Medium", "Low"];
const statusTrail: TaskStatus[] = ["open", "progress", "resolved", "closed"];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value.includes("T") ? value : `${value}T00:00:00`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function statusLabel(status: TaskStatus) {
  if (status === "progress") return "In progress";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function badgeStatus(status: TaskStatus) {
  return status === "resolved" ? "progress" : status;
}

function assigneesForCompany(company: string) {
  return taskDirectory.find((item) => item.company === company)?.assignees ?? taskDirectory.flatMap((item) => item.assignees);
}

function statusOptionsForRole(role: Role, currentStatus: TaskStatus) {
  if (role === "Auditor") return statusOptions;
  return currentStatus === "closed" ? (["closed"] as TaskStatus[]) : statusOptions.filter((status) => status !== "closed");
}

function OverviewTab({ task, role, canEditFields, onStatusChange }: { task: AuditTask; role: Role; canEditFields: boolean; onStatusChange: (status: TaskStatus) => void }) {
  const [, forceRender] = useState(0);
  const company = taskDirectory.find((item) => item.company === task.company) ?? taskDirectory[0];
  const canManageClosure = role === "Auditor";
  const statusControlLocked = !canManageClosure && task.status === "closed";
  const visibleStatusOptions = statusOptionsForRole(role, task.status);

  const updateTask = (updates: Partial<AuditTask>) => {
    Object.assign(task, updates);
    forceRender((count) => count + 1);
  };

  const fieldProps = { readOnly: !canEditFields, disabled: !canEditFields };

  return (
    <div className="task-details-grid">
      <Card>
        <div className="task-overview-form">
          <label>
            Title
            <input value={task.title} onChange={(event) => updateTask({ title: event.currentTarget.value })} readOnly={!canEditFields} />
          </label>
          <label>
            Description
            <textarea value={task.description} onChange={(event) => updateTask({ description: event.currentTarget.value })} readOnly={!canEditFields} />
          </label>
          <div className="field-row">
            <label>
              Company
              <select value={task.company} onChange={(event) => updateTask({ company: event.currentTarget.value, subCompany: taskDirectory.find((item) => item.company === event.currentTarget.value)?.subCompanies[0] ?? task.subCompany })} disabled={!canEditFields}>
                {taskDirectory.map((item) => <option key={item.company}>{item.company}</option>)}
              </select>
            </label>
            <label>
              Sub-company
              <select value={task.subCompany} onChange={(event) => updateTask({ subCompany: event.currentTarget.value })} disabled={!canEditFields}>
                {company.subCompanies.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
          </div>
          <div className="field-row">
            <label>
              Assignee
              <select
                value={task.assignee}
                onChange={(event) => {
                  const assignee = assigneesForCompany(task.company).find((item) => item.name === event.currentTarget.value);
                  updateTask({ assignee: event.currentTarget.value, assigneeEmail: assignee?.email ?? task.assigneeEmail, assigneeInitials: assignee?.initials ?? task.assigneeInitials });
                }}
                disabled={!canEditFields}
              >
                {assigneesForCompany(task.company).map((item) => <option key={item.email}>{item.name}</option>)}
              </select>
            </label>
            <label>
              Priority
              <select value={task.priority} onChange={(event) => updateTask({ priority: event.currentTarget.value as TaskPriority })} disabled={!canEditFields}>
                {priorityOptions.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
          </div>
          <div className="field-row">
            <label>
              Due date
              <input type="date" value={task.dueDate} onChange={(event) => updateTask({ dueDate: event.currentTarget.value })} {...fieldProps} />
            </label>
            <label>
              Status
              <select value={task.status} onChange={(event) => onStatusChange(event.currentTarget.value as TaskStatus)} disabled={statusControlLocked}>
                {visibleStatusOptions.map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}
              </select>
            </label>
          </div>
        </div>
      </Card>

      <Card title="Task fields">
        <div className="task-fact-list">
          <span><strong>Task ID</strong>{task.id}</span>
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

function CommentsTab({ taskId }: { taskId: string }) {
  const { user, role } = useRole();
  const [body, setBody] = useState("");
  const [version, setVersion] = useState(0);
  const comments = taskComments.filter((comment) => comment.taskId === taskId);

  const addComment = (event: FormEvent) => {
    event.preventDefault();
    if (!body.trim()) return;
    addTaskComment(taskId, user.name, role, body.trim());
    setBody("");
    setVersion(version + 1);
  };

  return (
    <Card>
      <form className="comment-composer" onSubmit={addComment}>
        <textarea value={body} onChange={(event) => setBody(event.currentTarget.value)} placeholder="Add a comment..." />
        <Button type="submit" variant="primary" disabled={!body.trim()}>Add comment</Button>
      </form>
      <div className="activity-list">
        {comments.map((comment) => (
          <article key={comment.id} className="activity-item">
            <CellPerson initials={comment.author.split(" ").map((part) => part[0]).join("").slice(0, 2)} name={comment.author} meta={`${comment.role} - ${formatDateTime(comment.createdAt)}`} />
            <p>{comment.body}</p>
          </article>
        ))}
      </div>
    </Card>
  );
}

function DocumentsTab({ task }: { task: AuditTask }) {
  const { user } = useRole();
  const [version, setVersion] = useState(0);
  const documents = taskDocuments.filter((document) => document.taskId === task.id);

  const uploadFiles = (event: ChangeEvent<HTMLInputElement>) => {
    Array.from(event.currentTarget.files ?? []).forEach((file) => addTaskDocument(task.id, user.name, file.name));
    event.currentTarget.value = "";
    setVersion(version + 1);
  };

  return (
    <Card>
      <label className="details-upload">
        <input type="file" multiple onChange={uploadFiles} />
        <span>Upload documents</span>
        <small>Mock upload list for evidence files and supporting schedules.</small>
      </label>
      <div className="document-list">
        {documents.map((document) => (
          <div key={document.id} className="document-row">
            <strong>{document.name}</strong>
            <span>{document.size} - {document.uploadedBy} - {formatDateTime(document.uploadedAt)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function StatusHistoryTab({ taskId }: { taskId: string }) {
  const entries = taskStatusHistory.filter((entry) => entry.taskId === taskId).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return (
    <Card>
      <div className="status-trail">
        {statusTrail.map((status) => {
          const entry = entries.find((item) => item.to === status);
          return (
            <div key={status} className={`status-step ${entry ? "complete" : ""}`}>
              <span aria-hidden="true" />
              <strong>{statusLabel(status)}</strong>
              <small>{entry ? `${entry.actor} - ${formatDateTime(entry.createdAt)}` : "Pending"}</small>
              {entry?.comment ? <p>{entry.comment}</p> : null}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function TimelineTab({ taskId }: { taskId: string }) {
  const entries = taskAuditTimeline.filter((entry) => entry.taskId === taskId);

  return (
    <Card>
      <div className="timeline-list">
        {entries.map((entry) => (
          <article key={entry.id} className="timeline-item">
            <span />
            <div>
              <strong>{entry.action}</strong>
              <small>{entry.actor} - {formatDateTime(entry.createdAt)}</small>
              <p>{entry.detail}</p>
            </div>
          </article>
        ))}
      </div>
    </Card>
  );
}

export function TaskDetailsPage() {
  const { taskId = "" } = useParams();
  const navigate = useNavigate();
  const { role, user } = useRole();
  const initialTask = getTaskById(taskId);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [taskVersion, setTaskVersion] = useState(0);
  const [reopenModalOpen, setReopenModalOpen] = useState(false);
  const [reopenComment, setReopenComment] = useState("");
  const task = useMemo(() => getTaskById(taskId), [taskId, taskVersion]);
  const canAccess = Boolean(initialTask && getRoleScopedTasks(role, user.email).some((item) => item.id === taskId));
  const canEditFields = role !== "Employee";

  if (!initialTask) return <Navigate to="/tasks" replace />;
  if (!canAccess) return <Navigate to="/dashboard" replace />;
  if (!task) return null;
  const primaryDocument = taskDocuments.find((document) => document.taskId === task.id);

  const changeStatus = (status: TaskStatus, comment?: string) => {
    if (role !== "Auditor" && (status === "closed" || task.status === "closed")) return;
    updateTaskStatus(task.id, status, user.name, comment);
    setTaskVersion((version) => version + 1);
  };

  const closeTask = () => changeStatus("closed");
  const reopenTask = (event: FormEvent) => {
    event.preventDefault();
    if (!reopenComment.trim()) return;
    changeStatus("progress", reopenComment.trim());
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
            <Badge status={badgeStatus(task.status)} label={statusLabel(task.status)} />
          </div>
          <p>{task.id} - {task.company} / {task.subCompany}</p>
        </div>
        {role === "Auditor" ? (
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
        <div className="task-intro-meta"><span>{task.id}</span><Badge status={badgeStatus(task.status)} label={statusLabel(task.status)} /><span className="priority-pill">{task.priority} priority</span></div>
        <p>{task.description}</p>
        {primaryDocument ? <button className="task-document-chip" type="button" onClick={() => setActiveTab("documents")}><i className="ti ti-file" />{primaryDocument.name}</button> : null}
      </Card>

      <div className="task-tabs" role="tablist" aria-label="Task details tabs">
        {tabs.map((tab) => (
          <button key={tab.key} className={activeTab === tab.key ? "active" : ""} type="button" onClick={() => setActiveTab(tab.key)}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" ? <OverviewTab task={task} role={role} canEditFields={canEditFields} onStatusChange={changeStatus} /> : null}
      {activeTab === "comments" ? <CommentsTab taskId={task.id} /> : null}
      {activeTab === "documents" ? <DocumentsTab task={task} /> : null}
      {activeTab === "status" ? <StatusHistoryTab taskId={task.id} /> : null}
      {activeTab === "timeline" ? <TimelineTab taskId={task.id} /> : null}

      {reopenModalOpen ? (
        <div className="modal-backdrop" role="presentation">
          <form className="modal-panel reopen-modal" role="dialog" aria-modal="true" aria-label="Reopen task" onSubmit={reopenTask}>
            <header className="modal-header">
              <h2 className="card-title" style={{ margin: 0 }}>Reopen task</h2>
              <button className="icon-button" type="button" aria-label="Close" onClick={() => setReopenModalOpen(false)}>x</button>
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
