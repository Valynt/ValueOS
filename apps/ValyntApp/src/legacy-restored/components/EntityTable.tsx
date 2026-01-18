// /workspaces/ValueOS/src/components/EntityTable.tsx
import React, { useState } from "react";

interface Column<T> {
  key: keyof T;
  label: string;
  render?: (value: any, item: T) => React.ReactNode;
}

interface EntityTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (item: T) => void;
  filterKey?: keyof T;
}

function EntityTable<T extends Record<string, any>>({
  data,
  columns,
  onRowClick,
  filterKey,
}: EntityTableProps<T>) {
  const [filter, setFilter] = useState("");

  const filteredData = filterKey
    ? data.filter((item) => String(item[filterKey]).toLowerCase().includes(filter.toLowerCase()))
    : data;

  return (
    <div>
      {filterKey && (
        <input
          type="text"
          placeholder="Filter..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="mb-4 p-2 border rounded w-full"
        />
      )}
      <table className="min-w-full bg-white border">
        <thead>
          <tr className="bg-gray-50">
            {columns.map((col) => (
              <th key={String(col.key)} className="px-4 py-2 text-left text-gray-600">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredData.map((item, index) => (
            <tr
              key={index}
              className="border-t hover:bg-gray-50 cursor-pointer"
              onClick={() => onRowClick?.(item)}
            >
              {columns.map((col) => (
                <td key={String(col.key)} className="px-4 py-2">
                  {col.render ? col.render(item[col.key], item) : item[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default EntityTable;
