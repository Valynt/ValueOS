/**
 * Export Button Component
 * Reusable button with export menu for PDF, PNG, Excel
 */

import React, { useState, useEffect } from "react";
import { Download, FileText, Image, Table, Loader2 } from "lucide-react";
import { useExport, type ExportProgress } from "../utils/export";
import { useToast } from "./Common/Toast";

interface ExportButtonProps {
  elementId?: string;
  data?: any[];
  filename?: string;
  formats?: Array<"pdf" | "png" | "excel">;
  variant?: "default" | "compact";
  className?: string;
}

export function ExportButton({
  elementId,
  data,
  filename = "export",
  formats = ["pdf", "png", "excel"],
  variant = "default",
  className = "",
}: ExportButtonProps) {
  const [showMenu, setShowMenu] = useState(false);
  const { exportElement, exportData, progress, isExporting } = useExport();
  const toast = useToast();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showMenu) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showMenu]);

  const handleExport = async (format: "pdf" | "png" | "excel") => {
    setShowMenu(false);

    try {
      if (format === "excel") {
        if (!data || data.length === 0) {
          toast.error("Export failed", "No data available to export");
          return;
        }
        await exportData(data, filename);
        toast.success("Export complete", `Successfully exported to ${format}`);
      } else {
        if (!elementId) {
          toast.error("Export failed", "Element ID not provided");
          return;
        }
        await exportElement(elementId, format, filename);
        toast.success("Export complete", `Successfully exported to ${format}`);
      }
    } catch (error) {
      console.error("Export failed:", error);
      toast.error(
        "Export failed",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  };

  const formatIcons = {
    pdf: FileText,
    png: Image,
    excel: Table,
  };

  const formatLabels = {
    pdf: "Export as PDF",
    png: "Export as PNG",
    excel: "Export to Excel",
  };

  if (variant === "compact") {
    return (
      <div className={`relative ${className}`}>
        <button
          type="button"
          onClick={() => setShowMenu(!showMenu)}
          disabled={isExporting}
          aria-haspopup="true"
          aria-expanded={showMenu}
          aria-label="Export options"
          className="p-2 hover:bg-secondary rounded transition-colors disabled:opacity-50"
          title="Export"
        >
          {isExporting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
        </button>

        {showMenu && !isExporting && (
          <div
            role="menu"
            className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-lg z-50"
          >
            <div className="p-1">
              {formats.map((format) => {
                const Icon = formatIcons[format];
                return (
                  <button
                    key={format}
                    type="button"
                    role="menuitem"
                    onClick={() => handleExport(format)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary rounded transition-colors"
                  >
                    <Icon className="w-4 h-4" />
                    <span>{formatLabels[format]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setShowMenu(!showMenu)}
        disabled={isExporting}
        aria-haspopup="true"
        aria-expanded={showMenu}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-md flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {isExporting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{progress?.message || "Exporting..."}</span>
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            <span>Export</span>
          </>
        )}
      </button>

      {/* Progress Bar */}
      {isExporting && progress && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded p-2 shadow-lg">
          <div className="text-xs text-muted-foreground mb-1">
            {progress.message}
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Export Menu */}
      {showMenu && !isExporting && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 bg-card border border-border rounded-lg shadow-lg z-50"
        >
          <div className="p-2">
            <div className="text-xs font-semibold text-muted-foreground px-2 py-1 mb-1">
              Export Format
            </div>
            {formats.map((format) => {
              const Icon = formatIcons[format];
              return (
                <button
                  key={format}
                  type="button"
                  role="menuitem"
                  onClick={() => handleExport(format)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-secondary rounded transition-colors"
                >
                  <Icon className="w-4 h-4" />
                  <div className="text-left">
                    <div className="font-medium">{formatLabels[format]}</div>
                    <div className="text-xs text-muted-foreground">
                      {format === "pdf" && "Portable document"}
                      {format === "png" && "High quality image"}
                      {format === "excel" && "Spreadsheet format"}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {showMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowMenu(false)}
        />
      )}
    </div>
  );
}

export default ExportButton;
