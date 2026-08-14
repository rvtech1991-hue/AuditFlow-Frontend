import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, Card, CellPerson, Chip, Table, Toast, type ToastState } from "../components/ui";
import { useRole } from "../lib/RoleContext";
import { parseApiDateTime } from "../lib/dateTime";
import { CHECKLIST_STATUS_LABELS, RECURRENCE_LABELS, type ChecklistItemStatus, type ChecklistRecurrence } from "../lib/checklistMapping";
import {
  createChecklistItem,
  deleteChecklistItem,
  exportMyChecklist,
  exportTeamChecklist,
  getMyChecklist,
  getTeamChecklist,
  getTeamMemberChecklist,
  updateChecklistItem,
  updateChecklistItemStatus,
  type ChecklistFeedItem,
} from "../services/checklist";
import type { Status } from "../types";

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatDueDate(iso: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(parseApiDateTime(iso));
}

/** "YYYY-MM-DDTHH:mm" for a <input type="datetime-local">, defaulting to today at 6pm local. */
function defaultDueDateInputValue(): string {
  const d = new Date();
  d.setHours(18, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function initialsFrom(name: string): string {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function toInputValue(iso: string): string {
  const d = parseApiDateTime(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const STATUS_CYCLE: ChecklistItemStatus[] = ["Pending", "InProgress", "Completed"];

function nextStatus(current: ChecklistItemStatus): ChecklistItemStatus {
  return STATUS_CYCLE[(STATUS_CYCLE.indexOf(current) + 1) % STATUS_CYCLE.length];
}

function personalStatusPillClass(status: ChecklistItemStatus): string {
  if (status === "Completed") return "checklist-pill checklist-pill-done";
  if (status === "InProgress") return "checklist-pill checklist-pill-progress";
  return "checklist-pill checklist-pill-pending";
}

function isDone(item: ChecklistFeedItem): boolean {
  return item.status === "Completed" || item.status === "closed";
}

function groupOf(item: ChecklistFeedItem): "Overdue" | "Today" | "This week" | "Later" {
  if (item.isOverdue) return "Overdue";
  const due = parseApiDateTime(item.dueDate);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  const weekEnd = new Date(todayStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  if (due < todayEnd) return "Today";
  if (due < weekEnd) return "This week";
  return "Later";
}

const GROUP_ORDER: Array<"Overdue" | "Today" | "This week" | "Later"> = ["Overdue", "Today", "This week", "Later"];

type FilterKey = "all" | "today" | "completedToday" | "week" | "month" | "overdue";

function matchesFilter(item: ChecklistFeedItem, filter: FilterKey): boolean {
  if (filter === "all") return true;
  if (filter === "overdue") return item.isOverdue;
  const due = parseApiDateTime(item.dueDate);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  const dueToday = due >= todayStart && due < todayEnd;
  if (filter === "today") return dueToday;
  if (filter === "completedToday") return dueToday && isDone(item);
  const weekEnd = new Date(todayStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  if (filter === "week") return due >= todayStart && due < weekEnd;
  const monthEnd = new Date(todayStart);
  monthEnd.setMonth(monthEnd.getMonth() + 1);
  return due >= todayStart && due < monthEnd; // "month"
}

function groupItems(items: ChecklistFeedItem[]) {
  return GROUP_ORDER.map((group) => ({ group, items: items.filter((item) => groupOf(item) === group) })).filter((g) => g.items.length);
}

type ItemListProps = {
  items: ChecklistFeedItem[];
  readOnly: boolean;
  onNavigateTask: (taskId: string) => void;
  editingId?: string | null;
  editTitle?: string;
  onEditTitleChange?: (value: string) => void;
  editDueDate?: string;
  onEditDueDateChange?: (value: string) => void;
  onStartEdit?: (item: ChecklistFeedItem) => void;
  onCancelEdit?: () => void;
  onSaveEdit?: (item: ChecklistFeedItem) => void;
  savingEdit?: boolean;
  onToggleDone?: (item: ChecklistFeedItem) => void;
  onCycleStatus?: (item: ChecklistFeedItem) => void;
  onDelete?: (item: ChecklistFeedItem) => void;
};

function ChecklistItemList({
  items, readOnly, onNavigateTask, editingId, editTitle, onEditTitleChange, editDueDate, onEditDueDateChange,
  onStartEdit, onCancelEdit, onSaveEdit, savingEdit, onToggleDone, onCycleStatus, onDelete,
}: ItemListProps) {
  const grouped = groupItems(items);

  if (grouped.length === 0) {
    return <Card><p>Nothing here.</p></Card>;
  }

  return (
    <>
      {grouped.map(({ group, items: groupItems }) => (
        <div className="checklist-group" key={group}>
          <h3>{group}</h3>
          <div className="checklist-item-list">
            {groupItems.map((item) =>
              item.source === "AuditTask" ? (
                <div className="checklist-item checklist-item-audit" key={item.id} onClick={() => onNavigateTask(item.taskId!)}>
                  <div className="checklist-item-icon"><i className="ti ti-external-link" /></div>
                  <div className="checklist-item-body">
                    <div className="checklist-item-title">{item.title}</div>
                    <div className="checklist-item-meta">
                      <span className="checklist-legend-tag">Audit task</span>
                      {item.assignedByName ? <span className="checklist-item-from">Assigned by {item.assignedByName}</span> : null}
                      <span className={item.isOverdue ? "checklist-due checklist-due-overdue" : "checklist-due"}>{formatDueDate(item.dueDate)}</span>
                    </div>
                  </div>
                  <Badge status={item.status as Status} />
                </div>
              ) : !readOnly && editingId === item.id ? (
                <div className="checklist-item checklist-item-editing" key={item.id}>
                  <input type="text" value={editTitle} onChange={(event) => onEditTitleChange?.(event.currentTarget.value)} />
                  <input type="datetime-local" value={editDueDate} onChange={(event) => onEditDueDateChange?.(event.currentTarget.value)} />
                  <Button size="small" variant="primary" disabled={!editTitle?.trim() || savingEdit} onClick={() => onSaveEdit?.(item)}>Save</Button>
                  <Button size="small" onClick={onCancelEdit}>Cancel</Button>
                </div>
              ) : (
                <div className={`checklist-item ${item.status === "Completed" ? "checklist-item-done" : ""}`} key={item.id}>
                  {readOnly ? (
                    <div className={`checklist-checkbox ${item.status === "Completed" ? "is-checked" : ""}`}>
                      {item.status === "Completed" ? <i className="ti ti-check" /> : null}
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={`checklist-checkbox ${item.status === "Completed" ? "is-checked" : ""}`}
                      aria-label={item.status === "Completed" ? "Mark as pending" : "Mark as completed"}
                      onClick={() => onToggleDone?.(item)}
                    >
                      {item.status === "Completed" ? <i className="ti ti-check" /> : null}
                    </button>
                  )}
                  <div className="checklist-item-body">
                    <div className="checklist-item-title">{item.title}</div>
                    <div className="checklist-item-meta">
                      {item.recurrence ? <span className="checklist-recurrence-tag">{RECURRENCE_LABELS[item.recurrence]}</span> : null}
                      <span className={item.isOverdue ? "checklist-due checklist-due-overdue" : "checklist-due"}>{formatDueDate(item.dueDate)}</span>
                    </div>
                  </div>
                  {readOnly ? (
                    <span className={personalStatusPillClass(item.status as ChecklistItemStatus)}>{CHECKLIST_STATUS_LABELS[item.status as ChecklistItemStatus]}</span>
                  ) : (
                    <button type="button" className={personalStatusPillClass(item.status as ChecklistItemStatus)} onClick={() => onCycleStatus?.(item)} title="Click to change status">
                      {CHECKLIST_STATUS_LABELS[item.status as ChecklistItemStatus]}
                    </button>
                  )}
                  {readOnly ? null : (
                    <div className="checklist-item-actions">
                      <button type="button" title="Edit" onClick={() => onStartEdit?.(item)}><i className="ti ti-pencil" /></button>
                      <button type="button" title="Delete" onClick={() => onDelete?.(item)}><i className="ti ti-trash" /></button>
                    </div>
                  )}
                </div>
              ),
            )}
          </div>
        </div>
      ))}
    </>
  );
}

function StatCard({ n, label, tone, active, onClick }: { n: string | number; label: string; tone?: "good" | "bad" | "accent"; active?: boolean; onClick: () => void }) {
  return (
    <Card
      className={`checklist-stat-card checklist-stat-card-clickable ${tone ?? ""} ${active ? "is-active" : ""}`}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onClick();
          }
        }}
      >
        <div className="checklist-stat-n">{n}</div>
        <div className="checklist-stat-l">{label}</div>
      </div>
    </Card>
  );
}

export function ChecklistPage() {
  const navigate = useNavigate();
  const { role, user } = useRole();
  const canSeeTeam = role === "Auditor" || role === "Company admin";

  const [view, setView] = useState<"mine" | "team">("mine");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [toast, setToast] = useState<ToastState>(null);
  const [viewingMemberId, setViewingMemberId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [recurrence, setRecurrence] = useState<ChecklistRecurrence>("OneTime");
  const [dueDate, setDueDate] = useState(defaultDueDateInputValue());

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDueDate, setEditDueDate] = useState("");

  const [exporting, setExporting] = useState(false);

  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["checklist"] });

  const myQuery = useQuery({ queryKey: ["checklist", "mine", user.email], queryFn: () => getMyChecklist(user.email) });
  const teamQuery = useQuery({ queryKey: ["checklist", "team"], queryFn: () => getTeamChecklist(), enabled: canSeeTeam && view === "team" && !viewingMemberId });
  const memberQuery = useQuery({
    queryKey: ["checklist", "team-member", viewingMemberId],
    queryFn: () => getTeamMemberChecklist(viewingMemberId!),
    enabled: canSeeTeam && !!viewingMemberId,
  });

  const createMutation = useMutation({
    mutationFn: () => createChecklistItem({ title: title.trim(), recurrence, dueDate: new Date(dueDate).toISOString() }),
    onSuccess: () => {
      setTitle("");
      setRecurrence("OneTime");
      setDueDate(defaultDueDateInputValue());
      invalidate();
      setToast({ kind: "success", message: "Added to your checklist" });
    },
    onError: () => setToast({ kind: "error", message: "Couldn't add that item — try again" }),
  });

  const statusMutation = useMutation({
    mutationFn: (vars: { id: string; status: ChecklistItemStatus }) => updateChecklistItemStatus(vars.id, vars.status),
    onSuccess: invalidate,
    onError: () => setToast({ kind: "error", message: "Couldn't update status — try again" }),
  });

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; title: string; dueDateIso: string }) => updateChecklistItem(vars.id, { title: vars.title, dueDate: vars.dueDateIso }),
    onSuccess: () => {
      setEditingId(null);
      invalidate();
      setToast({ kind: "success", message: "Updated" });
    },
    onError: () => setToast({ kind: "error", message: "Couldn't save changes — try again" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteChecklistItem(id),
    onSuccess: () => {
      invalidate();
      setToast({ kind: "success", message: "Removed" });
    },
    onError: () => setToast({ kind: "error", message: "Couldn't remove that item — try again" }),
  });

  const startEdit = (item: ChecklistFeedItem) => {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditDueDate(toInputValue(item.dueDate));
  };

  const runExport = async (format: "excel" | "pdf") => {
    setExporting(true);
    try {
      const result = view === "team" ? await exportTeamChecklist(format) : await exportMyChecklist(format);
      triggerDownload(result.blob, result.fileName);
    } catch {
      setToast({ kind: "error", message: "Export failed — try again" });
    } finally {
      setExporting(false);
    }
  };

  const items = myQuery.data?.items ?? [];
  const filteredItems = items.filter((item) => matchesFilter(item, filter));

  const counts: Record<FilterKey, number> = {
    all: items.length,
    today: items.filter((i) => matchesFilter(i, "today")).length,
    completedToday: items.filter((i) => matchesFilter(i, "completedToday")).length,
    week: items.filter((i) => matchesFilter(i, "week")).length,
    month: items.filter((i) => matchesFilter(i, "month")).length,
    overdue: items.filter((i) => matchesFilter(i, "overdue")).length,
  };

  const heading = view === "mine" ? "My Checklist" : viewingMemberId ? (memberQuery.data?.fullName ?? "…") : "Team Activity";
  const subtitle =
    view === "mine"
      ? "Your own daily, weekly and monthly to-dos, plus anything assigned to you with a due date."
      : viewingMemberId
        ? `Read-only view of ${memberQuery.data?.fullName ?? "this person"}'s checklist activity.`
        : "Read-only view of everyone's checklist activity within your scope. Click a person to see their detail.";

  return (
    <div className="checklist-page">
      <div className="checklist-page-head">
        <div>
          <h2>{heading}</h2>
          <p>{subtitle}</p>
        </div>
        {canSeeTeam ? (
          <div className="checklist-view-toggle">
            <Button size="small" variant={view === "mine" ? "primary" : "outline"} onClick={() => { setView("mine"); setViewingMemberId(null); }}>My Checklist</Button>
            <Button size="small" variant={view === "team" ? "primary" : "outline"} onClick={() => { setView("team"); setViewingMemberId(null); }}>Team Activity</Button>
          </div>
        ) : null}
      </div>

      {view === "team" && viewingMemberId ? (
        <Button size="small" onClick={() => setViewingMemberId(null)}><i className="ti ti-arrow-left" /> Back to Team Activity</Button>
      ) : null}

      {!(view === "team" && viewingMemberId) ? (
        <div className="checklist-export-row">
          <span>
            {view === "mine"
              ? "Export your own activity — for your records or if asked to share it."
              : "Export everyone's activity in scope — for a status review."}
          </span>
          <span className="checklist-export-buttons">
            <Button size="small" disabled={exporting} onClick={() => runExport("excel")}><i className="ti ti-download" /> Excel</Button>
            <Button size="small" variant="primary" disabled={exporting} onClick={() => runExport("pdf")}><i className="ti ti-download" /> PDF</Button>
          </span>
        </div>
      ) : null}

      {view === "mine" ? (
        <>
          <div className="checklist-stat-row">
            <StatCard n={myQuery.data?.todayCount ?? 0} label="Today" active={filter === "today"} onClick={() => setFilter(filter === "today" ? "all" : "today")} />
            <StatCard n={myQuery.data?.completedTodayCount ?? 0} label="Completed today" tone="good" active={filter === "completedToday"} onClick={() => setFilter(filter === "completedToday" ? "all" : "completedToday")} />
            <StatCard n={myQuery.data?.overdueCount ?? 0} label="Overdue" tone="bad" active={filter === "overdue"} onClick={() => setFilter(filter === "overdue" ? "all" : "overdue")} />
            <StatCard n={`${myQuery.data?.weekCompletionRatePercent ?? 0}%`} label="This week's completion" tone="accent" active={filter === "week"} onClick={() => setFilter(filter === "week" ? "all" : "week")} />
          </div>

          <Card className="checklist-quick-add">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (!title.trim() || !dueDate) return;
                createMutation.mutate();
              }}
            >
              <input
                type="text"
                placeholder="What do you need to do?"
                value={title}
                onChange={(event) => setTitle(event.currentTarget.value)}
              />
              <select value={recurrence} onChange={(event) => setRecurrence(event.currentTarget.value as ChecklistRecurrence)}>
                {(Object.keys(RECURRENCE_LABELS) as ChecklistRecurrence[]).map((key) => (
                  <option key={key} value={key}>{RECURRENCE_LABELS[key]}</option>
                ))}
              </select>
              <input type="datetime-local" value={dueDate} onChange={(event) => setDueDate(event.currentTarget.value)} />
              <Button type="submit" variant="primary" disabled={!title.trim() || createMutation.isPending}>
                <i className="ti ti-plus" /> Add
              </Button>
            </form>
          </Card>

          <div className="checklist-chips">
            <button type="button" onClick={() => setFilter("all")}><Chip active={filter === "all"}>All {counts.all}</Chip></button>
            <button type="button" onClick={() => setFilter("today")}><Chip active={filter === "today"}>Today {counts.today}</Chip></button>
            <button type="button" onClick={() => setFilter("week")}><Chip active={filter === "week"}>This week {counts.week}</Chip></button>
            <button type="button" onClick={() => setFilter("month")}><Chip active={filter === "month"}>This month {counts.month}</Chip></button>
            <button type="button" onClick={() => setFilter("overdue")}><Chip active={filter === "overdue"}>Overdue {counts.overdue}</Chip></button>
          </div>

          <div className="checklist-legend">
            <span><span className="checklist-legend-dot" /> Your own item — click to update, or use the actions to edit/delete</span>
            <span><span className="checklist-legend-tag">Audit task</span> assigned to you — opens the real task, status managed there</span>
          </div>

          {myQuery.isLoading ? (
            <p>Loading your checklist…</p>
          ) : filteredItems.length === 0 ? (
            <Card><p>Nothing here — {filter === "all" ? "add your first item above." : "try a different filter."}</p></Card>
          ) : (
            <ChecklistItemList
              items={filteredItems}
              readOnly={false}
              onNavigateTask={(taskId) => navigate(`/tasks/${taskId}`)}
              editingId={editingId}
              editTitle={editTitle}
              onEditTitleChange={setEditTitle}
              editDueDate={editDueDate}
              onEditDueDateChange={setEditDueDate}
              onStartEdit={startEdit}
              onCancelEdit={() => setEditingId(null)}
              onSaveEdit={(item) => updateMutation.mutate({ id: item.id, title: editTitle.trim(), dueDateIso: new Date(editDueDate).toISOString() })}
              savingEdit={updateMutation.isPending}
              onToggleDone={(item) => statusMutation.mutate({ id: item.id, status: item.status === "Completed" ? "Pending" : "Completed" })}
              onCycleStatus={(item) => statusMutation.mutate({ id: item.id, status: nextStatus(item.status as ChecklistItemStatus) })}
              onDelete={(item) => {
                if (window.confirm("Delete this checklist item?")) deleteMutation.mutate(item.id);
              }}
            />
          )}
        </>
      ) : viewingMemberId ? (
        <>
          <div className="checklist-stat-row">
            <Card className="checklist-stat-card"><div className="checklist-stat-n">{memberQuery.data?.todayCount ?? 0}</div><div className="checklist-stat-l">Today</div></Card>
            <Card className="checklist-stat-card good"><div className="checklist-stat-n">{memberQuery.data?.completedTodayCount ?? 0}</div><div className="checklist-stat-l">Completed today</div></Card>
            <Card className="checklist-stat-card bad"><div className="checklist-stat-n">{memberQuery.data?.overdueCount ?? 0}</div><div className="checklist-stat-l">Overdue</div></Card>
            <Card className="checklist-stat-card accent"><div className="checklist-stat-n">{memberQuery.data?.weekCompletionRatePercent ?? 0}%</div><div className="checklist-stat-l">This week's completion</div></Card>
          </div>

          {memberQuery.isLoading ? (
            <p>Loading…</p>
          ) : (memberQuery.data?.items.length ?? 0) === 0 ? (
            <Card><p>No checklist activity for this person yet.</p></Card>
          ) : (
            <ChecklistItemList items={memberQuery.data!.items} readOnly onNavigateTask={(taskId) => navigate(`/tasks/${taskId}`)} />
          )}
        </>
      ) : (
        <Card>
          <Table
            columns={[
              { key: "fullName", header: "Person", render: (row) => <CellPerson initials={initialsFrom(row.fullName)} name={row.fullName} meta={row.role} /> },
              { key: "todayCount", header: "Today", align: "center" },
              { key: "completedTodayCount", header: "Completed today", align: "center" },
              { key: "overdueCount", header: "Overdue", align: "center" },
              { key: "weekCompletionRatePercent", header: "Week completion", align: "center", render: (row) => `${row.weekCompletionRatePercent}%` },
              { key: "lastUpdateAt", header: "Last update", render: (row) => (row.lastUpdateAt ? formatDueDate(row.lastUpdateAt) : "—") },
            ]}
            rows={(teamQuery.data ?? []).map((row) => ({ ...row, id: row.userId }))}
            emptyState="No one in your scope has any checklist activity yet."
            onRowClick={(row) => setViewingMemberId(row.userId)}
          />
        </Card>
      )}

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
