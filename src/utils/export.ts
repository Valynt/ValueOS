/**
 * Export Utilities
 * Provides export functionality for dashboards and data (PDF, PNG, Excel)
 */

import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import * as XLSX from "xlsx";

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

    onProgress?.({
      status: "generating",
      progress: 50,
      message: "Generating Excel file...",
    });

    // Filter columns if specified
    let exportData = data;
    if (options.columns) {
      exportData = data.map((row) => {
        const filtered: any = {};
        options.columns!.forEach((col) => {
          if (row.hasOwnProperty(col)) {
            filtered[col] = row[col];
          }
        });
        return filtered;
      });
    }

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(exportData);

    // Auto-size columns
    const colWidths = Object.keys(exportData[0] || {}).map((key) => ({
      wch:
        Math.max(
          key.length,
          ...exportData.map((row) => String(row[key] || "").length)
        ) + 2,
    }));
    worksheet["!cols"] = colWidths;

    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      options.sheetName || "Data"
    );

    onProgress?.({
      status: "generating",
      progress: 80,
      message: "Finalizing...",
    });

    // Generate binary string
    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });
    const blob = new Blob([excelBuffer], {
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
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, -5);
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

  const exportElement = async (
    elementId: string,
    format: "pdf" | "png",
    filename?: string
  ) => {
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
      const blob = await exportToExcel(
        data,
        { format: "excel", ...options },
        setProgress
      );

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

import React from "react";
