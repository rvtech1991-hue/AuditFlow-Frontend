import type { RouteMeta } from "../types";
import { Badge, Button, Card, CellPerson, Chip, DonutChart, FieldRow, FormField, RowActionMenu, Table, Toggle, TrendChart } from "../components/ui";

const rows = [
  { id: "AF-1024", title: "Bank reconciliation mismatch", assignee: "Nisha Rao", status: "progress" },
  { id: "AF-1025", title: "GST document missing", assignee: "Dev Mehta", status: "overdue" },
  { id: "AF-1026", title: "Payroll approval evidence", assignee: "Anika Shah", status: "closed" },
];

export function PlaceholderPage({ route }: { route: RouteMeta }) {
  if (route.public) {
    return (
      <main className="main-area" style={{ width: "100%", marginLeft: 0 }}>
        <Card title={route.title}>
          <p className="page-subtitle">{route.subtitle}</p>
          <div style={{ marginTop: 18, maxWidth: 420 }}>
            <FormField label="Work email" placeholder="name@company.com" />
          </div>
        </Card>
      </main>
    );
  }

  return (
    <div className="placeholder-grid">
      <Card title="Foundation Preview">
        <p className="page-subtitle">Placeholder route for `{route.path}`. Feature screens are intentionally not built yet.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
          <Badge status="open" />
          <Badge status="progress" />
          <Badge status="overdue" />
          <Badge status="closed" />
          <Badge status="active" />
          <Badge status="invited" />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <Chip active>This week</Chip>
          <Chip>Company</Chip>
          <Button size="small">Default</Button>
          <Button size="small" variant="primary">Primary</Button>
        </div>
      </Card>

      <Card title="Forms">
        <FieldRow>
          <FormField label="Company" placeholder="Acme Ltd." />
          <FormField label="Sub-company" placeholder="North Unit" />
        </FieldRow>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 18 }}>
          <span className="page-subtitle">Email notifications</span>
          <Toggle checked />
        </div>
      </Card>

      <Card title="Charts">
        <div className="chart-card">
          <DonutChart segments={[{ value: 12, color: "var(--accent)" }, { value: 8, color: "var(--warning)" }, { value: 4, color: "var(--danger)" }, { value: 18, color: "var(--success)" }]} />
          <div style={{ flex: 1 }}>
            <TrendChart />
          </div>
        </div>
      </Card>

      <Card title="Grid Table" className="placeholder-table" >
        <Table
          rows={rows}
          columns={[
            { key: "id", header: "Task ID" },
            { key: "title", header: "Title" },
            { key: "assignee", header: "Assigned to", render: (row) => <CellPerson initials={String(row.assignee).slice(0, 2)} name={String(row.assignee)} /> },
            { key: "status", header: "Status", render: (row) => <Badge status={row.status as "progress" | "overdue" | "closed"} /> },
            {
              key: "actions",
              header: "",
              render: () => (
                <RowActionMenu
                  actions={[
                    { label: "Resend activation link", icon: "↗" },
                    { label: "Deactivate user", icon: "×", destructive: true, dividerBefore: true },
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
