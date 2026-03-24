// apps/ValyntApp/src/components/EntityTable.tsx
import { Search, ChevronUp, ChevronDown } from "lucide-react";
import React, { useState, useCallback, useMemo } from "react";

import { cn } from "@/lib/utils";

interface Column<T> {
  key: keyof T;
  label: string;
  sortable?: boolean;
  render?: (value: unknown, item: T) => React.ReactNode;
}

interface EntityTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (item: T) => void;
  filterKey?: keyof T;
  emptyMessage?: string;
  className?: string;
}

const tableContainerClasses = "bg-[var(--vds-color-surface)] border border-[var(--vds-color-border)] rounded-lg overflow-hidden";
const tableClasses = "min-w-full";
const headerRowClasses = "bg-[var(--vds-color-surface-2)] border-b border-[var(--vds-color-border)]";
const headerCellClasses = "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--vds-color-text-secondary)]";
const rowClasses = "border-t border-[var(--vds-color-border)] transition-colors duration-150";
const rowHoverClasses = "hover:bg-[var(--vds-color-surface-2)]/50 cursor-pointer";
const cellClasses = "px-4 py-3 text-sm text-[var(--vds-color-text-primary)]";
const filterInputClasses = "w-full px-4 py-2 bg-[var(--vds-color-surface)] border border-[var(--vds-color-border)] rounded-lg text-sm text-[var(--vds-color-text-primary)] placeholder:text-[var(--vds-color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--vds-color-primary)]/30";

function EntityTable<T extends Record<string, unknown>>({
  data,
  columns,
  onRowClick,
  filterKey,
  emptyMessage = "No items found",
  className,
}: EntityTableProps<T>) {
  const [filter, setFilter] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: keyof T; direction: "asc" | "desc" } | null>(null);

  const filteredData = useMemo(() => {
    let result = filterKey
      ? data.filter((item) => String(item[filterKey]).toLowerCase().includes(filter.toLowerCase()))
      : [...data];

    if (sortConfig) {
      result.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [data, filterKey, filter, sortConfig]);

  const handleSort = useCallback((key: keyof T) => {
    setSortConfig((current) => {
      if (!current || current.key !== key) {
        return { key, direction: "asc" };
      }
      if (current.direction === "asc") {
        return { key, direction: "desc" };
      }
      return null;
    });
  }, []);

  return (
    <div className={cn("space-y-3", className)}>
      {filterKey && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--vds-color-text-muted)]" aria-hidden="true" />
          <input
            type="text"
            placeholder="Filter..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className={cn(filterInputClasses, "pl-10")}
            aria-label="Filter table"
          />
        </div>
      )}

      <div className={tableContainerClasses}>
        <table className={tableClasses} role="table" aria-label="Entity table">
          <thead>
            <tr className={headerRowClasses}>
              {columns.map((col) => (
                <th key={String(col.key)} className={headerCellClasses} scope="col">
                  {col.sortable ? (
                    <button
                      onClick={() => handleSort(col.key)}
                      className="inline-flex items-center gap-1 hover:text-[var(--vds-color-text-primary)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vds-color-primary)]/30 rounded"
                      aria-label={`Sort by ${col.label}`}
                    >
                      {col.label}
                      {sortConfig?.key === col.key && (
                        sortConfig.direction === "asc"
                          ? <ChevronUp className="w-3 h-3" aria-hidden="true" />
                          : <ChevronDown className="w-3 h-3" aria-hidden="true" />
                      )}
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className={cn(cellClasses, "text-center text-[var(--vds-color-text-muted)] py-8")}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              filteredData.map((item, index) => (
                <tr
                  key={index}
                  className={cn(rowClasses, onRowClick && rowHoverClasses)}
                  onClick={() => onRowClick?.(item)}
                  role={onRowClick ? "button" : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={onRowClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onRowClick(item); } } : undefined}
                >
                  {columns.map((col) => (
                    <td key={String(col.key)} className={cellClasses}>
                      {col.render ? col.render(item[col.key], item) : String(item[col.key])}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-[var(--vds-color-text-muted)]">
        Showing {filteredData.length} of {data.length} items
      </div>
    </div>
  );
}

export default EntityTable;
