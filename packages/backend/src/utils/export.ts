/**
 * Export Utilities
 */

import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { PNG } from "pngjs";

const PNG_MIME_TYPE = "image/png";
const PDF_MIME_TYPE = "application/pdf";
const XLSX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function generateFilename(prefix: string, extension: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${prefix}-${timestamp}.${extension}`;
}

export function exportToJSON(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

function serializeCSVValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = String(value);
  if (/[",\n\r]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

export function exportToCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) return "";

  const headers = Array.from(new Set(data.flatMap((row) => Object.keys(row))));
  const rows = data.map((row) => headers.map((header) => serializeCSVValue(row[header])).join(","));

  return [headers.join(","), ...rows].join("\n");
}

function asReadableString(input: HTMLElement | string): string {
  if (typeof input === "string") {
    return input;
  }

  return input.textContent?.trim() || input.id || input.tagName || "PNG Export";
}

/**
 * Export structured data as a valid PDF document.
 */
export async function exportToPDF(
  data: Record<string, unknown>,
  options?: { title?: string; filename?: string }
): Promise<Blob> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const title = options?.title ?? "ValueOS Export";
  const content = JSON.stringify(data, null, 2);

  page.drawText(title, {
    x: 40,
    y: 800,
    size: 16,
    font,
    color: rgb(0.08, 0.14, 0.22),
  });

  const maxCharsPerLine = 95;
  const lines = content
    .split("\n")
    .flatMap((line) => (line.length > maxCharsPerLine ? line.match(new RegExp(`.{1,${maxCharsPerLine}}`, "g")) ?? [line] : [line]))
    .slice(0, 90);

  let y = 780;
  for (const line of lines) {
    page.drawText(line, {
      x: 40,
      y,
      size: 10,
      font,
      color: rgb(0.13, 0.13, 0.13),
    });
    y -= 12;
    if (y < 40) break;
  }

  const bytes = await pdfDoc.save();
  return new Blob([bytes], { type: PDF_MIME_TYPE });
}

/**
 * Export a minimal valid PNG image with deterministic binary format.
 */
export async function exportToPNG(
  element: HTMLElement | string,
  options?: { width?: number; height?: number; filename?: string }
): Promise<Blob> {
  const width = Math.max(1, options?.width ?? 400);
  const height = Math.max(1, options?.height ?? 200);
  const png = new PNG({ width, height, colorType: 2 });

  const label = asReadableString(element);
  const labelSeed = Array.from(label).reduce((acc, char) => acc + char.charCodeAt(0), 0);

  // Fill with a stable gradient based on label content.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      png.data[idx] = (x + labelSeed) % 256;
      png.data[idx + 1] = (y + labelSeed * 2) % 256;
      png.data[idx + 2] = (x + y + labelSeed * 3) % 256;
      png.data[idx + 3] = 255;
    }
  }

  const buffer = PNG.sync.write(png, { colorType: 2, inputColorType: 2 });
  return new Blob([buffer], { type: PNG_MIME_TYPE });
}

/**
 * Export tabular data as a valid XLSX workbook.
 */
export async function exportToExcel(
  data: Record<string, unknown>[],
  options?: { sheetName?: string; filename?: string }
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  const sheetName = (options?.sheetName?.trim() || "Sheet1").slice(0, 31);
  const worksheet = workbook.addWorksheet(sheetName);

  const rows = data.length > 0 ? data : [{ empty: "" }];
  const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));

  worksheet.columns = headers.map((key) => ({ header: key, key }));
  for (const row of rows) {
    worksheet.addRow(row);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: XLSX_MIME_TYPE });
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
