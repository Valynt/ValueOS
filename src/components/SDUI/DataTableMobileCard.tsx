/**
 * DataTable Mobile Card View
 * 
 * Card-based layout for mobile devices (<768px).
 * Optimized for touch interactions with 44x44px minimum targets.
 * 
 * Phase 1: Critical Accessibility Fixes - Day 2
 */

import React from 'react';
import type { DataTableColumn } from './DataTable';

interface DataTableMobileCardProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  keyField: keyof T;
  selectable?: boolean;
  selectedRows: T[];
  onSelectRow?: (row: T) => void;
  onRowClick?: (row: T, index: number) => void;
  getCellValue: (row: T, column: DataTableColumn<T>) => unknown;
}

export function DataTableMobileCard<T extends Record<string, unknown>>({
  data,
  columns,
  keyField,
  selectable = false,
  selectedRows = [],
  onSelectRow,
  onRowClick,
  getCellValue,
}: DataTableMobileCardProps<T>) {
  const isRowSelected = (row: T) => {
    return selectedRows.some((r) => r[keyField] === row[keyField]);
  };

  return (
    <div className="sdui-data-table-mobile-cards">
      {data.map((row, index) => {
        const isSelected = isRowSelected(row);
        
        return (
          <div
            key={String(row[keyField])}
            className={`sdui-data-table-mobile-card ${
              isSelected ? 'sdui-data-table-mobile-card-selected' : ''
            } ${onRowClick ? 'sdui-data-table-mobile-card-clickable' : ''}`}
            onClick={() => onRowClick?.(row, index)}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && onRowClick) {
                e.preventDefault();
                onRowClick(row, index);
              }
            }}
            role="article"
            tabIndex={onRowClick ? 0 : undefined}
            aria-label={`Data row ${index + 1}`}
          >
            {/* Selection checkbox */}
            {selectable && (
              <div className="sdui-data-table-mobile-card-checkbox tap-target">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => {
                    e.stopPropagation();
                    onSelectRow?.(row);
                  }}
                  aria-label={`Select row ${index + 1}`}
                />
              </div>
            )}

            {/* Card content */}
            <div className="sdui-data-table-mobile-card-content">
              {columns.map((column, colIndex) => {
                const value = getCellValue(row, column);
                const displayValue = column.render
                  ? column.render(value, row, index)
                  : String(value);

                // First column as title
                if (colIndex === 0) {
                  return (
                    <div key={column.id} className="sdui-data-table-mobile-card-title">
                      {displayValue}
                    </div>
                  );
                }

                // Other columns as key-value pairs
                return (
                  <div key={column.id} className="sdui-data-table-mobile-card-row">
                    <span className="sdui-data-table-mobile-card-label">
                      {column.header}:
                    </span>
                    <span className="sdui-data-table-mobile-card-value">
                      {displayValue}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <style>{`
        .sdui-data-table-mobile-cards {
          display: none;
        }

        @media (max-width: 768px) {
          .sdui-data-table-mobile-cards {
            display: flex;
            flex-direction: column;
            gap: 12px;
            padding: 12px;
          }
        }

        .sdui-data-table-mobile-card {
          background-color: #1A1A1A;
          border: 1px solid #444444;
          border-radius: 8px;
          padding: 16px;
          display: flex;
          gap: 12px;
          transition: all 150ms ease;
        }

        .sdui-data-table-mobile-card-clickable {
          cursor: pointer;
        }

        .sdui-data-table-mobile-card-clickable:hover {
          background-color: #222222;
          border-color: #555555;
        }

        .sdui-data-table-mobile-card-clickable:focus {
          outline: 2px solid #00FF00;
          outline-offset: 2px;
        }

        .sdui-data-table-mobile-card-selected {
          background-color: #0A3A0A;
          border-color: #00FF00;
        }

        .sdui-data-table-mobile-card-checkbox {
          flex-shrink: 0;
        }

        .sdui-data-table-mobile-card-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .sdui-data-table-mobile-card-title {
          font-size: 16px;
          font-weight: 600;
          color: #FFFFFF;
          margin-bottom: 4px;
        }

        .sdui-data-table-mobile-card-row {
          display: flex;
          gap: 8px;
          font-size: 14px;
        }

        .sdui-data-table-mobile-card-label {
          color: #C0C0C0;
          font-weight: 500;
          min-width: 100px;
          flex-shrink: 0;
        }

        .sdui-data-table-mobile-card-value {
          color: #FFFFFF;
          word-break: break-word;
        }
      `}</style>
    </div>
  );
}
