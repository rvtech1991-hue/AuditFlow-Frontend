import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, Card, CellPerson, RowActionMenu, Table } from "../components/ui";
import { useRole } from "../lib/RoleContext";
import { ApiError } from "../lib/apiClient";
import { deactivateUser, getUsersForRole, resendActivationLink, type AuditUser, type AuditUserStatus } from "../services/users";

const statusOptions: Array<AuditUserStatus | "All"> = ["All", "Invited", "Active", "Deactivated"];

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function statusBadge(status: AuditUserStatus) {
  if (status === "Invited") return <Badge status="invited" label="Invited" />;
  if (status === "Deactivated") return <Badge status="deactivated" label="Deactivated" />;
  return <Badge status="active" label="Active" />;
}

export function UserManagementPage() {
  const navigate = useNavigate();
  const { role } = useRole();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<AuditUserStatus | "All">("All");
  const usersQuery = useQuery({ queryKey: ["users", role], queryFn: () => getUsersForRole(role) });
  const scopedUsers = usersQuery.data ?? [];
  const visibleUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return scopedUsers.filter((user) => {
      const matchesStatus = status === "All" || user.status === status;
      const matchesQuery = !normalized || `${user.name} ${user.email} ${user.role} ${user.company} ${user.subCompany}`.toLowerCase().includes(normalized);
      return matchesStatus && matchesQuery;
    });
  }, [query, scopedUsers, status]);
  const canInvite = role === "Auditor" || role === "Company admin";

  const invalidateUsers = () => queryClient.invalidateQueries({ queryKey: ["users", role] });
  const resendMutation = useMutation({ mutationFn: (user: AuditUser) => resendActivationLink(user.id), onSuccess: invalidateUsers });
  const deactivateMutation = useMutation({ mutationFn: (user: AuditUser) => deactivateUser(user.id), onSuccess: invalidateUsers });

  if (usersQuery.isLoading) {
    return <div className="user-page"><p className="data-state">Loading users…</p></div>;
  }
  if (usersQuery.error) {
    const detail = usersQuery.error instanceof ApiError ? usersQuery.error.detail : "Couldn't load users.";
    return <div className="user-page"><p className="data-state is-error">{detail}</p></div>;
  }

  return (
    <div className="user-page">
      <div className="task-actions-row">
        <div>
          <h2>Users</h2>
          <p>{scopedUsers.length} users across {new Set(scopedUsers.map((user) => user.company)).size} companies</p>
        </div>
        {canInvite ? <Button variant="primary" onClick={() => navigate("/users/new")}>Invite user</Button> : null}
      </div>

      <div className="user-filter-chips">
        <span className="chip active-chip"><i className="ti ti-users" />All roles</span>
        <span className="chip"><i className="ti ti-building" />Company: All</span>
        <span className="chip"><i className="ti ti-circle-check" />Status: {status}</span>
      </div>
      <Card className="user-table-card">
        <div className="task-filter-row user-search-row">
          <input className="task-filter-search" value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Search name, email, role, company" />
          <select value={status} onChange={(event) => setStatus(event.currentTarget.value as AuditUserStatus | "All")}>
            {statusOptions.map((option) => <option key={option}>{option}</option>)}
          </select>
        </div>
        <Table<AuditUser>
          rows={visibleUsers}
          emptyState="No users match the selected filters."
          columns={[
            { key: "name", header: "Name", render: (user) => <CellPerson initials={initials(user.name)} name={user.name} /> },
            { key: "email", header: "Email" },
            { key: "role", header: "Role" },
            {
              key: "company",
              header: "Company / Sub-company",
              render: (user) => (
                <span>
                  {user.company}
                  <small className="table-subline">{user.subCompany}</small>
                </span>
              ),
            },
            { key: "reportingManager", header: "Reporting manager", render: (user) => user.reportingManager || <span className="muted-cell">None</span> },
            { key: "status", header: "Status", render: (user) => statusBadge(user.status) },
            {
              key: "actions",
              header: "",
              render: (user) => (
                <RowActionMenu
                  actions={[
                    ...(user.status === "Invited" ? [{
                      label: "Resend activation link",
                      icon: "Send",
                      onClick: () => resendMutation.mutate(user),
                    }] : []),
                    {
                      label: "Deactivate user",
                      icon: "Deactivate",
                      destructive: true,
                      dividerBefore: true,
                      onClick: () => deactivateMutation.mutate(user),
                    },
                  ]}
                />
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
