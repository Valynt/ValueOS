/**
 * DataTable Component
 * 
 * Sortable, filterable data grid with dark theme styling.
 * Supports pagination, row selection, and virtual scrolling for large datasets.
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, Search, Download, Filter } from 'lucide-react';

export interface DataTableColumn<T = any> {
  id: string;
  header: string;
  accessor: keyof T | ((row: T) => any);
  sortable?: boolean;
  filterable?: boolean;
  width?: number | string;
  minWidth?: number;
  maxWidth?: number;
  align?: 'left' | 'center' | 'right';
  render?: (value: any, row: T, index: number) => React.ReactNode;
  headerRender?: () => React.ReactNode;
}

export interface DataTableProps<T = any> {
  data: T[];
  columns: DataTableColumn<T>[];
  keyField?: keyof T;
  selectable?: boolean;
  selectedRows?: T[];
  onSelectionChange?: (rows: T[]) => void;
  sortable?: boolean;
  filterable?: boolean;
  pagination?: boolean;
  pageSize?: number;
  virtualScroll?: boolean;
  rowHeight?: number;
  onRowClick?: (row: T, index: number) => void;
  onExport?: (data: T[]) => void;
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
}

type SortDirection = 'asc' | 'desc' | null;

interface SortState {
  columnId: string | null;
  direction: SortDirection;
}

/**
 * DataTable Component
 */
export function DataTable<T = any>({
  data,
  columns,
  keyField = 'id' as keyof T,
  selectable = false,
  selectedRows = [],
  onSelectionChange,
  sortable = true,
  filterable = true,
  pagination = true,
  pageSize = 10,
  virtualScroll = false,
  rowHeight = 48,
  onRowClick,
  onExport,
  loading = false,
  emptyMessage = 'No data available',
  className = '',
}: DataTableProps<T>) {
  const [sortState, setSortState] = useState<SortState>({ columnId: null, direction: null });
  const [filterText, setFilterText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const tableRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Get cell value
  const getCellValue = useCallback((row: T, column: DataTableColumn<T>) => {
    if (typeof column.accessor === 'function') {
      return column.accessor(row);
    }
    return row[column.accessor];
  }, []);

  // Filter data
  const filteredData = useMemo(() => {
    let result = [...data];

    // Global filter
    if (filterText) {
      result = result.filter((row) =>
        columns.some((column) => {
          const value = getCellValue(row, column);
          return String(value).toLowerCase().includes(filterText.toLowerCase());
        })
      );
    }

    // Column-specific filters
    Object.entries(columnFilters).forEach(([columnId, filterValue]) => {
      if (filterValue) {
        const column = columns.find((col) => col.id === columnId);
        if (column) {
          result = result.filter((row) => {
            const value = getCellValue(row, column);
            return String(value).toLowerCase().includes(filterValue.toLowerCase());
          });
        }
      }
    });

    return result;
  }, [data, filterText, columnFilters, columns, getCellValue]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortState.columnId || !sortState.direction) {
      return filteredData;
    }

    const column = columns.find((col) => col.id === sortState.columnId);
    if (!column) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aValue = getCellValue(a, column);
      const bValue = getCellValue(b, column);

      if (aValue === bValue) return 0;

      const comparison = aValue < bValue ? -1 : 1;
      return sortState.direction === 'asc' ? comparison : -comparison;
    });
  }, [filteredData, sortState, columns, getCellValue]);

  // Paginate data
  const paginatedData = useMemo(() => {
    if (!pagination) return sortedData;

    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return sortedData.slice(startIndex, endIndex);
  }, [sortedData, pagination, currentPage, pageSize]);

  // Virtual scroll data
  const visibleData = useMemo(() => {
    if (!virtualScroll) return paginatedData;

    const startIndex = Math.floor(scrollTop / rowHeight);
    const endIndex = startIndex + Math.ceil((tableRef.current?.clientHeight || 600) / rowHeight) + 1;
    return sortedData.slice(startIndex, Math.min(endIndex, sortedData.length));
  }, [virtualScroll, paginatedData, sortedData, scrollTop, rowHeight]);

  const displayData = virtualScroll ? visibleData : paginatedData;

  // Handle sort
  const handleSort = (columnId: string) => {
    setSortState((prev) => {
      if (prev.columnId !== columnId) {
        return { columnId, direction: 'asc' };
      }
      if (prev.direction === 'asc') {
        return { columnId, direction: 'desc' };
      }
      return { columnId: null, direction: null };
    });
  };

  // Handle selection
  const handleSelectAll = () => {
    if (selectedRows.length === sortedData.length) {
      onSelectionChange?.([]);
    } else {
      onSelectionChange?.(sortedData);
    }
  };

  const handleSelectRow = (row: T) => {
    const isSelected = selectedRows.some((r) => r[keyField] === row[keyField]);
    if (isSelected) {
      onSelectionChange?.(selectedRows.filter((r) => r[keyField] !== row[keyField]));
    } else {
      onSelectionChange?.([...selectedRows, row]);
    }
  };

  const isRowSelected = (row: T) => {
    return selectedRows.some((r) => r[keyField] === row[keyField]);
  };

  // Handle scroll for virtual scrolling
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (virtualScroll) {
      setScrollTop(e.currentTarget.scrollTop);
    }
  };

  // Export data
  const handleExport = () => {
    if (onExport) {
      onExport(sortedData);
    } else {
      // Default CSV export
      const csv = [
        columns.map((col) => col.header).join(','),
        ...sortedData.map((row) =>
          columns.map((col) => {
            const value = getCellValue(row, col);
            return `"${String(value).replace(/"/g, '""')}"`;
          }).join(',')
        ),
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'data.csv';
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const totalPages = Math.ceil(sortedData.length / pageSize);

  return (
    <div className={`sdui-data-table ${className}`}>
      {/* Toolbar */}
      {(filterable || onExport) && (
        <div className="sdui-data-table-toolbar">
          {filterable && (
            <div className="sdui-data-table-search">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="sdui-data-table-search-input"
              />
            </div>
          )}

          <div className="sdui-data-table-actions">
            {onExport && (
              <button
                onClick={handleExport}
                className="sdui-data-table-action-btn"
                title="Export data"
              >
                <Download size={16} />
                Export
              </button>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div
        ref={tableRef}
        className="sdui-data-table-container"
        onScroll={handleScroll}
        style={{
          maxHeight: virtualScroll ? '600px' : undefined,
          overflow: virtualScroll ? 'auto' : undefined,
        }}
      >
        {virtualScroll && (
          <div style={{ height: sortedData.length * rowHeight, position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                top: Math.floor(scrollTop / rowHeight) * rowHeight,
                width: '100%',
              }}
            >
              {renderTable()}
            </div>
          </div>
        )}
        {!virtualScroll && renderTable()}
      </div>

      {/* Pagination */}
      {pagination && !virtualScroll && totalPages > 1 && (
        <div className="sdui-data-table-pagination">
          <div className="sdui-data-table-pagination-info">
            Showing {(currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(currentPage * pageSize, sortedData.length)} of {sortedData.length} results
          </div>

          <div className="sdui-data-table-pagination-controls">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="sdui-data-table-pagination-btn"
            >
              Previous
            </button>

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }

              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`sdui-data-table-pagination-btn ${
                    currentPage === pageNum ? 'sdui-data-table-pagination-btn-active' : ''
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="sdui-data-table-pagination-btn"
            >
              Next
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .sdui-data-table {
          background-color: #1A1A1A;
          border-radius: 8px;
          border: 1px solid #444444;
          overflow: hidden;
        }

        .sdui-data-table-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          border-bottom: 1px solid #444444;
          gap: 16px;
        }

        .sdui-data-table-search {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
          max-width: 400px;
          padding: 8px 12px;
          background-color: #333333;
          border: 1px solid #444444;
          border-radius: 4px;
          color: #B3B3B3;
        }

        .sdui-data-table-search-input {
          flex: 1;
          background: transparent;
          border: none;
          color: #FFFFFF;
          font-size: 14px;
          outline: none;
        }

        .sdui-data-table-actions {
          display: flex;
          gap: 8px;
        }

        .sdui-data-table-action-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          background-color: transparent;
          border: 1px solid #39FF14;
          border-radius: 4px;
          color: #39FF14;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 150ms;
        }

        .sdui-data-table-action-btn:hover {
          background-color: rgba(57, 255, 20, 0.1);
        }

        .sdui-data-table-container {
          overflow-x: auto;
        }

        .sdui-data-table-table {
          width: 100%;
          border-collapse: collapse;
        }

        .sdui-data-table-header {
          background-color: #333333;
          border-bottom: 2px solid #444444;
        }

        .sdui-data-table-header-cell {
          padding: 12px 16px;
          text-align: left;
          color: #B3B3B3;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          white-space: nowrap;
        }

        .sdui-data-table-header-cell-sortable {
          cursor: pointer;
          user-select: none;
        }

        .sdui-data-table-header-cell-sortable:hover {
          color: #39FF14;
        }

        .sdui-data-table-header-content {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .sdui-data-table-body-row {
          border-bottom: 1px solid #444444;
          transition: background-color 150ms;
        }

        .sdui-data-table-body-row:hover {
          background-color: #333333;
        }

        .sdui-data-table-body-row-selected {
          background-color: rgba(57, 255, 20, 0.1);
        }

        .sdui-data-table-body-row-clickable {
          cursor: pointer;
        }

        .sdui-data-table-body-cell {
          padding: 12px 16px;
          color: #FFFFFF;
          font-size: 14px;
        }

        .sdui-data-table-checkbox {
          width: 16px;
          height: 16px;
          cursor: pointer;
        }

        .sdui-data-table-pagination {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          border-top: 1px solid #444444;
        }

        .sdui-data-table-pagination-info {
          color: #B3B3B3;
          font-size: 14px;
        }

        .sdui-data-table-pagination-controls {
          display: flex;
          gap: 4px;
        }

        .sdui-data-table-pagination-btn {
          padding: 6px 12px;
          background-color: transparent;
          border: 1px solid #444444;
          border-radius: 4px;
          color: #B3B3B3;
          font-size: 14px;
          cursor: pointer;
          transition: all 150ms;
        }

        .sdui-data-table-pagination-btn:hover:not(:disabled) {
          background-color: #333333;
          border-color: #39FF14;
          color: #39FF14;
        }

        .sdui-data-table-pagination-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .sdui-data-table-pagination-btn-active {
          background-color: #39FF14;
          border-color: #39FF14;
          color: #121212;
          font-weight: 600;
        }

        .sdui-data-table-empty {
          padding: 48px;
          text-align: center;
          color: #808080;
          font-size: 14px;
        }

        .sdui-data-table-loading {
          padding: 48px;
          text-align: center;
        }

        .sdui-data-table-spinner {
          display: inline-block;
          width: 32px;
          height: 32px;
          border: 3px solid #444444;
          border-top-color: #39FF14;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );

  function renderTable() {
    if (loading) {
      return (
        <div className="sdui-data-table-loading">
          <div className="sdui-data-table-spinner" />
        </div>
      );
    }

    if (displayData.length === 0) {
      return <div className="sdui-data-table-empty">{emptyMessage}</div>;
    }

    return (
      <table className="sdui-data-table-table">
        <thead className="sdui-data-table-header">
          <tr>
            {selectable && (
              <th className="sdui-data-table-header-cell" style={{ width: 48 }}>
                <input
                  type="checkbox"
                  checked={selectedRows.length === sortedData.length && sortedData.length > 0}
                  onChange={handleSelectAll}
                  className="sdui-data-table-checkbox"
                />
              </th>
            )}
            {columns.map((column) => (
              <th
                key={column.id}
                className={`sdui-data-table-header-cell ${
                  sortable && column.sortable !== false ? 'sdui-data-table-header-cell-sortable' : ''
                }`}
                style={{
                  width: column.width,
                  minWidth: column.minWidth,
                  maxWidth: column.maxWidth,
                  textAlign: column.align || 'left',
                }}
                onClick={() => sortable && column.sortable !== false && handleSort(column.id)}
              >
                <div className="sdui-data-table-header-content">
                  {column.headerRender ? column.headerRender() : column.header}
                  {sortable && column.sortable !== false && (
                    <>
                      {sortState.columnId === column.id ? (
                        sortState.direction === 'asc' ? (
                          <ChevronUp size={14} />
                        ) : (
                          <ChevronDown size={14} />
                        )
                      ) : (
                        <ChevronsUpDown size={14} />
                      )}
                    </>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayData.map((row, index) => {
            const isSelected = isRowSelected(row);
            return (
              <tr
                key={String(row[keyField])}
                className={`sdui-data-table-body-row ${
                  isSelected ? 'sdui-data-table-body-row-selected' : ''
                } ${onRowClick ? 'sdui-data-table-body-row-clickable' : ''}`}
                onClick={() => onRowClick?.(row, index)}
              >
                {selectable && (
                  <td className="sdui-data-table-body-cell">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleSelectRow(row);
                      }}
                      className="sdui-data-table-checkbox"
                    />
                  </td>
                )}
                {columns.map((column) => {
                  const value = getCellValue(row, column);
                  return (
                    <td
                      key={column.id}
                      className="sdui-data-table-body-cell"
                      style={{ textAlign: column.align || 'left' }}
                    >
                      {column.render ? column.render(value, row, index) : String(value)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }
}

export default DataTable;
