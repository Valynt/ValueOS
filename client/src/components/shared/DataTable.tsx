/*
 * DataTable — Reusable, typed table with consistent header styling and row hover.
 * Replaces inline <table> patterns across Dashboard, Cases, Agents.
 *
 * Usage:
 *   <DataTable
 *     columns={[{ key: "name", label: "Name" }, { key: "value", label: "Value", align: "right" }]}
 *     data={items}
 *     renderRow={(item) => (
 *       <DataTable.Row key={item.id} onClick={() => navigate(`/items/${item.id}`)}>
 *         <DataTable.Cell>{item.name}</DataTable.Cell>
 *         <DataTable.Cell align="right">{item.value}</DataTable.Cell>
 *       </DataTable.Row>
 *     )}
 *   />
 */
import { cn } from "@/lib/utils";

export interface Column {
  key: string;
  label: string;
  align?: "left" | "center" | "right";
  /** Width class, e.g. "w-40" */
  width?: string;
}

interface DataTableProps<T> {
  columns: Column[];
  data: T[];
  renderRow: (item: T, index: number) => React.ReactNode;
  /** Optional: wrap in a Card with rounded corners */
  bordered?: boolean;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  renderRow,
  bordered = true,
  className,
}: DataTableProps<T>) {
  return (
    <div className={cn(bordered && "border border-border rounded-xl overflow-hidden bg-card", className)}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider",
                    col.width,
                    col.align === "right" ? "text-right" :
                    col.align === "center" ? "text-center" : "text-left"
                  )}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => renderRow(item, index))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

interface RowProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

function Row({ children, onClick, className }: RowProps) {
  return (
    <tr
      className={cn(
        "border-b border-border last:border-0 hover:bg-accent/30 transition-colors",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}

interface CellProps {
  children: React.ReactNode;
  align?: "left" | "center" | "right";
  className?: string;
}

function Cell({ children, align = "left", className }: CellProps) {
  return (
    <td
      className={cn(
        "px-5 py-4",
        align === "right" ? "text-right" :
        align === "center" ? "text-center" : "text-left",
        className
      )}
    >
      {children}
    </td>
  );
}

DataTable.Row = Row;
DataTable.Cell = Cell;
