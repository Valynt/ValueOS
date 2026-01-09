/**
 * Export Utilities
 * Provides export functionality for dashboards and data (PDF, PNG, Excel)
 */

import * as React from "react";

export interface ExportOptions {
  filename?: string;
  format: "pdf" | "png" | "excel";
  includeTimestamp?: boolean;
}

export interface ExportProgress {
  status: "preparing" | "capturing" | "generating" | "complete" | "error";
  progress: number;
  message?: string;
}

/**
 * Export element to PDF
 */
export async function exportToPDF(
  elementId: string,
  options: ExportOptions = { format: "pdf" },
  onProgress?: (progress: ExportProgress) => void
): Promise<Blob> {
  try {
    onProgress?.({
      status: "preparing",
      progress: 10,
      message: "Preparing export...",
    });

    // Lazy load dependencies
    const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
      import("jspdf"),
      import("html2canvas"),
    ]);

    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(`Element with ID "${elementId}" not found`);
    }

    onProgress?.({
      status: "capturing",
      progress: 30,
      message: "Capturing content...",
    });

    // Capture element as canvas
    const canvas = await html2canvas(element, {
      scale: 2, // Higher quality
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
    });

    onProgress?.({
      status: "generating",
      progress: 70,
      message: "Generating PDF...",
    });

    // Create PDF
    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    const pdf = new jsPDF({
      orientation: imgHeight > pageHeight ? "portrait" : "landscape",
      unit: "mm",
      format: "a4",
    });

    const imgData = canvas.toDataURL("image/png");
    pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);

    // Add metadata
    pdf.setProperties({
      title: options.filename || "Export",
      subject: "ValueOS Dashboard Export",
      author: "ValueOS",
      creator: "ValueOS Export Utility",
    });

    onProgress?.({
      status: "complete",
      progress: 100,
      message: "Export complete!",
    });

    // Return as blob
    return pdf.output("blob");
  } catch (error) {
    onProgress?.({
      status: "error",
      progress: 0,
      message: error instanceof Error ? error.message : "Export failed",
    });
    throw error;
  }
}

/**
 * Export element to PNG
 */
export async function exportToPNG(
  elementId: string,
  options: ExportOptions = { format: "png" },
  onProgress?: (progress: ExportProgress) => void
): Promise<Blob> {
  try {
    onProgress?.({
      status: "preparing",
      progress: 10,
      message: "Preparing export...",
    });

    // Lazy load dependencies
    const { default: html2canvas } = await import("html2canvas");

    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(`Element with ID "${elementId}" not found`);
    }

    onProgress?.({
      status: "capturing",
      progress: 50,
      message: "Capturing image...",
    });

    const canvas = await html2canvas(element, {
      scale: 3, // High quality for PNG
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
    });

    onProgress?.({
      status: "generating",
      progress: 90,
      message: "Generating PNG...",
    });

    // Convert to blob
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to generate PNG"));
          }
        },
        "image/png",
        1.0
      );
    });

    onProgress?.({
      status: "complete",
      progress: 100,
      message: "Export complete!",
    });

    return blob;
  } catch (error) {
    onProgress?.({
      status: "error",
      progress: 0,
      message: error instanceof Error ? error.message : "Export failed",
    });
    throw error;
  }
}

/**
 * Export data to Excel
 *
 * SECURITY: Using exceljs (more secure than xlsx)
 * - Input validation and sanitization
 * - Size limits to prevent resource exhaustion
 * - Object key sanitization to prevent prototype pollution
 */
export async function exportToExcel(
  data: any[],
  options: ExportOptions & { sheetName?: string; columns?: string[] } = {
    format: "excel",
  },
  onProgress?: (progress: ExportProgress) => void
): Promise<Blob> {
  try {
    onProgress?.({
      status: "preparing",
      progress: 20,
      message: "Preparing data...",
    });

    if (!data || data.length === 0) {
      throw new Error("No data to export");
    }

    // Lazy load dependencies
    const ExcelJS = await import("exceljs");

    // SECURITY: Limit data size to prevent resource exhaustion
    const MAX_ROWS = 10000;
    if (data.length > MAX_ROWS) {
      throw new Error(`Data exceeds maximum limit of ${MAX_ROWS} rows for export`);
    }

    onProgress?.({
      status: "generating",
      progress: 50,
      message: "Generating Excel file...",
    });

    // SECURITY: Sanitize object keys to prevent prototype pollution
    const sanitizeKey = (key: string): string => {
      // Block dangerous keys
      const dangerousKeys = ["__proto__", "constructor", "prototype"];
      if (dangerousKeys.includes(key.toLowerCase())) {
        return `_${key}`;
      }
      // Limit key length
      return key.slice(0, 100);
    };

    const sanitizeValue = (value: any): any => {
      if (value === null || value === undefined) return value;
      if (typeof value === "string") {
        // Limit string length to prevent issues
        return value.slice(0, 32000); // Excel cell limit
      }
      if (typeof value === "object") {
        // Prevent deeply nested objects
        return JSON.stringify(value).slice(0, 32000);
      }
      return value;
    };

    // Filter columns if specified
    let exportData = data;
    if (options.columns) {
      exportData = data.map((row) => {
        const filtered: any = {};
        options.columns!.forEach((col) => {
          const safeKey = sanitizeKey(col);
          if (row.hasOwnProperty(col)) {
            filtered[safeKey] = sanitizeValue(row[col]);
          }
        });
        return filtered;
      });
    } else {
      // Sanitize all data
      exportData = data.map((row) => {
        const sanitized: any = {};
        Object.keys(row).forEach((key) => {
          const safeKey = sanitizeKey(key);
          sanitized[safeKey] = sanitizeValue(row[key]);
        });
        return sanitized;
      });
    }

    // Create workbook and worksheet using ExcelJS (SECURE: no vulnerabilities)
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(options.sheetName || "Data");

    // Add headers
    if (exportData.length > 0) {
      const headers = Object.keys(exportData[0]);
      worksheet.columns = headers.map((header) => ({
        header,
        key: header,
        width: Math.min(Math.max(header.length + 2, 10), 50),
      }));

      // Add rows
      exportData.forEach((row) => {
        worksheet.addRow(row);
      });

      // Style headers
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0E0E0" },
      };
    }

    onProgress?.({
      status: "generating",
      progress: 80,
      message: "Finalizing...",
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    onProgress?.({
      status: "complete",
      progress: 100,
      message: "Export complete!",
    });

    return blob;
  } catch (error) {
    onProgress?.({
      status: "error",
      progress: 0,
      message: error instanceof Error ? error.message : "Export failed",
    });
    throw error;
  }
}

/**
 * Download blob as file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate filename with timestamp
 */
export function generateFilename(
  base: string,
  extension: string,
  includeTimestamp: boolean = true
): string {
  if (includeTimestamp) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
    return `${base}_${timestamp}.${extension}`;
  }
  return `${base}.${extension}`;
}

/**
 * Hook for export functionality
 */
export function useExport() {
  const [progress, setProgress] = React.useState<ExportProgress | null>(null);
  const [isExporting, setIsExporting] = React.useState(false);

  const exportElement = async (elementId: string, format: "pdf" | "png", filename?: string) => {
    setIsExporting(true);
    try {
      const blob =
        format === "pdf"
          ? await exportToPDF(elementId, { format }, setProgress)
          : await exportToPNG(elementId, { format }, setProgress);

      const actualFilename = generateFilename(filename || "export", format);

      downloadBlob(blob, actualFilename);
    } catch (error) {
      console.error("Export failed:", error);
      throw error;
    } finally {
      setIsExporting(false);
      setTimeout(() => setProgress(null), 2000);
    }
  };

  const exportData = async (
    data: any[],
    filename?: string,
    options?: { sheetName?: string; columns?: string[] }
  ) => {
    setIsExporting(true);
    try {
      const blob = await exportToExcel(data, { format: "excel", ...options }, setProgress);

      const actualFilename = generateFilename(filename || "data", "xlsx");

      downloadBlob(blob, actualFilename);
    } catch (error) {
      console.error("Export failed:", error);
      throw error;
    } finally {
      setIsExporting(false);
      setTimeout(() => setProgress(null), 2000);
    }
  };

  return {
    exportElement,
    exportData,
    progress,
    isExporting,
  };
}
