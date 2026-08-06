import type { ReactNode } from "react";

type Column<T extends object> = {
  key: keyof T | string;
  header: string;
  render?: (row: T) => ReactNode;
  /** Inline style, not a CSS class — deliberately immune to whatever generic nth-child/:has()
   * alignment rules a shared `.grid-table` stylesheet might apply to "whichever column happens
   * to sit last/second-to-last", which has repeatedly mis-targeted columns by position alone. */
  align?: "left" | "center" | "right";
};

type TableProps<T extends object> = {
  columns: Column<T>[];
  rows: T[];
  emptyState?: ReactNode;
  onRowClick?: (row: T) => void;
};

export function Table<T extends object>({ columns, rows, emptyState, onRowClick }: TableProps<T>) {
  return (
    <table className="grid-table">
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={String(column.key)} style={column.align ? { textAlign: column.align } : undefined}>{column.header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length ? (
          rows.map((row, index) => (
            <tr
              key={String((row as { id?: unknown }).id ?? index)}
              className={onRowClick ? "clickable-row" : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={() => onRowClick?.(row)}
              onKeyDown={(event) => {
                if (onRowClick && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault();
                  onRowClick(row);
                }
              }}
            >
              {columns.map((column) => (
                <td key={String(column.key)} style={column.align ? { textAlign: column.align } : undefined}>{column.render ? column.render(row) : String(row[column.key as keyof T] ?? "")}</td>
              ))}
            </tr>
          ))
        ) : (
          <tr>
            <td className="table-empty" colSpan={columns.length}>{emptyState ?? "No rows to show."}</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

export function CellPerson({ initials, name, meta }: { initials: string; name: string; meta?: string }) {
  return (
    <span className="cell-person">
      <span className="avatar">{initials}</span>
      <span>
        {name}
        {meta ? <small style={{ display: "block", color: "var(--text-muted)", fontWeight: 500 }}>{meta}</small> : null}
      </span>
    </span>
  );
}
