import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRole } from "../lib/RoleContext";
import { createMockTask, taskDirectory, type TaskPriority } from "../mock-data/tasks";

const priorities: TaskPriority[] = ["High", "Medium", "Low"];

export function TaskCreatePage() {
  const navigate = useNavigate();
  const { user } = useRole();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [company, setCompany] = useState(taskDirectory[0].company);
  const [subCompany, setSubCompany] = useState(taskDirectory[0].subCompanies[0]);
  const [assignee, setAssignee] = useState("A. Verma");
  const [priority, setPriority] = useState<TaskPriority>("High");
  const [dueDate, setDueDate] = useState("2026-07-12");
  const [attachmentNames, setAttachmentNames] = useState<string[]>([]);
  const [submittedTaskId, setSubmittedTaskId] = useState("");

  const selectedCompany = useMemo(() => taskDirectory.find((item) => item.company === company) ?? taskDirectory[0], [company]);
  const selectedAssignee = selectedCompany.assignees.find((item) => item.name === assignee) ?? selectedCompany.assignees[0];

  const handleCompanyChange = (nextCompany: string) => {
    const next = taskDirectory.find((item) => item.company === nextCompany) ?? taskDirectory[0];
    setCompany(next.company);
    setSubCompany(next.subCompanies[0]);
    setAssignee(next.assignees.some((item) => item.name === "A. Verma") ? "A. Verma" : next.assignees[0].name);
  };

  const canSubmit = title.trim() && description.trim() && dueDate;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    const task = createMockTask({
      title: title.trim(),
      description: description.trim(),
      company,
      subCompany,
      assignee,
      priority,
      dueDate,
      attachmentNames,
      createdBy: user.name,
    });

    setSubmittedTaskId(task.id);
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
            x
          </button>
        </div>

        <form className="task-create-form" onSubmit={handleSubmit}>
          <div className="field">
            <label>Title</label>
            <input value={title} onChange={(event: ChangeEvent<HTMLInputElement>) => setTitle(event.currentTarget.value)} placeholder="Inventory count mismatch - warehouse 3" required />
          </div>
          <div className="field">
            <label>Description</label>
            <textarea
              value={description}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setDescription(event.currentTarget.value)}
              placeholder="Describe the discrepancy, expected vs. actual figures."
              required
            />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Company</label>
              <select value={company} onChange={(event: ChangeEvent<HTMLSelectElement>) => handleCompanyChange(event.currentTarget.value)}>
                {taskDirectory.map((item) => <option key={item.company}>{item.company}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Sub-company</label>
              <select value={subCompany} onChange={(event: ChangeEvent<HTMLSelectElement>) => setSubCompany(event.currentTarget.value)}>
                {selectedCompany.subCompanies.map((item) => <option key={item}>{item}</option>)}
              </select>
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Assign to</label>
              <select value={assignee} onChange={(event: ChangeEvent<HTMLSelectElement>) => setAssignee(event.currentTarget.value)}>
                {selectedCompany.assignees.map((item) => <option key={item.email}>{item.name}</option>)}
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
            <input type="text" value="12 Jul 2026" readOnly onClick={() => setDueDate("2026-07-12")} />
          </div>

          <div className="notification-note">
            <span aria-hidden="true">@</span>
            <p>
              <b>Notification on save -</b> To: {selectedAssignee.email}. CC: r.sharma@auditflow.io (you) + s.nair@meridian.com (A. Verma's reporting manager).
              {submittedTaskId ? <strong className="created-note"> {submittedTaskId} created.</strong> : null}
            </p>
          </div>

          <label className="upload-dropzone">
            <input
              type="file"
              multiple
              onChange={(event) => setAttachmentNames(Array.from(event.currentTarget.files ?? []).map((file) => file.name))}
            />
            <span aria-hidden="true">Upload</span>
            <p>{attachmentNames.length ? attachmentNames.join(", ") : "Drag files here or click to upload"}</p>
          </label>

          <div className="modal-footer-actions">
            <button className="btn" type="button" onClick={() => navigate("/tasks")}>Cancel</button>
            <button className="btn primary" type="submit" disabled={!canSubmit}>{submittedTaskId ? "Create another" : "Create task"}</button>
          </div>
        </form>
      </section>
    </main>
  );
}
