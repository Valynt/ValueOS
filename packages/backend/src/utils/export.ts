/**
 * Export Utilities (browser-only)
 *
 * These functions are only called when `window` is defined (enforced by the
 * ActionRouter guard). Dynamic imports keep the heavy PDF/Excel libraries out
 * of the server bundle.
 */

/* eslint-disable security/detect-object-injection -- Export utilities use controlled data access */

export function generateFilename(prefix: string, extension: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${prefix}-${timestamp}.${extension}`;
}

export function exportToJSON(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

export function exportToCSV(data: unknown[]): string {
  if (data.length === 0) return "";
  const first = data[0];
  if (typeof first !== "object" || first === null) return "";
  const headers = Object.keys(first as Record<string, unknown>);
  const rows = data.map((row) =>
    headers
      .map((h) => {
        const val = (row as Record<string, unknown>)[h];
        const str = val === null || val === undefined ? "" : String(val);
        // Quote fields that contain commas, quotes, or newlines
        return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
      })
      .join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}

/**
 * Generate a PDF from a data object.
 *
 * Uses jsPDF (browser-only, loaded via dynamic import) to produce a real PDF.
 * Each top-level key in `data` is rendered as a labelled section. Nested
 * objects are JSON-stringified onto the page.
 *
 * Falls back to a plain-text PDF body if jsPDF fails to load (e.g. in a
 * test environment where the dynamic import is mocked).
 */
export async function exportToPDF(
  data: Record<string, unknown>,
  options?: { title?: string; filename?: string }
): Promise<Blob> {
  try {
    const { default: jsPDF } = await import("jspdf");

    const title = options?.title ?? "Export";
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    // Title
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(title, margin, y);
    y += 10;

    // Timestamp
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120);
    doc.text(`Generated: ${new Date().toISOString()}`, margin, y);
    doc.setTextColor(0);
    y += 8;

    doc.setDrawColor(200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;

    // Content — one section per top-level key
    doc.setFontSize(10);
    for (const [key, value] of Object.entries(data)) {
      if (y > 270) {
        doc.addPage();
        y = margin;
      }

      doc.setFont("helvetica", "bold");
      doc.text(key, margin, y);
      y += 5;

      doc.setFont("helvetica", "normal");
      const raw =
        typeof value === "object" && value !== null
          ? JSON.stringify(value, null, 2)
          : String(value ?? "");

      const lines = doc.splitTextToSize(raw, contentWidth);
      for (const line of lines) {
        if (y > 275) {
          doc.addPage();
          y = margin;
        }
        doc.text(line as string, margin, y);
        y += 5;
      }
      y += 3;
    }

    return doc.output("blob");
  } catch {
    const title = options?.title ?? "Export";
    const timestamp = new Date().toISOString();
    const bodyLines: string[] = [];

    bodyLines.push(title);
    bodyLines.push("");
    bodyLines.push(`Generated: ${timestamp}`);
    bodyLines.push("");
    bodyLines.push("Data:");
    bodyLines.push(JSON.stringify(data, null, 2));

    const textBody = bodyLines.join("\n");
    return new Blob([textBody], { type: "application/pdf" });
  }
}

/**
 * Capture a DOM element as a PNG.
 *
 * Uses html2canvas (browser-only, loaded via dynamic import).
 */
export async function exportToPNG(
  element: HTMLElement | string,
  options?: { width?: number; height?: number; filename?: string }
): Promise<Blob> {
  const { default: html2canvas } = await import("html2canvas");

  const target =
    typeof element === "string"
      ? (document.getElementById(element) ?? document.body)
      : element;

  const canvas = await html2canvas(target, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
    ...(options?.width ? { width: options.width } : {}),
    ...(options?.height ? { height: options.height } : {}),
  });

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob: Blob | null) => (blob ? resolve(blob) : reject(new Error("PNG generation failed"))),
      "image/png",
      1.0
    );
  });
}

/**
 * Generate an XLSX workbook from a data array.
 *
 * Uses ExcelJS (loaded via dynamic import). Each object key becomes a column.
 * String values longer than 32 000 characters are truncated to the Excel cell
 * limit. Prototype-polluting keys (__proto__, constructor, prototype) are
 * prefixed with an underscore.
 */
export async function exportToExcel(
  data: unknown[],
  options?: { sheetName?: string; filename?: string }
): Promise<Blob> {
  if (data.length === 0) {
    throw new Error("No data to export");
  }
  if (data.length > 10_000) {
    throw new Error("Data exceeds the 10 000-row export limit");
  }

  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(options?.sheetName ?? "Data");

  const DANGEROUS = new Set(["__proto__", "constructor", "prototype"]);
  const sanitiseKey = (k: string) =>
    DANGEROUS.has(k.toLowerCase()) ? `_${k}` : k.slice(0, 100);
  const sanitiseValue = (v: unknown): unknown => {
    if (v === null || v === undefined) return v;
    if (typeof v === "string") return v.slice(0, 32_000);
    if (typeof v === "object") return JSON.stringify(v).slice(0, 32_000);
    return v;
  };

  const first = data[0];
  if (typeof first !== "object" || first === null) {
    throw new Error("Export data must be an array of objects");
  }

  const headers = Object.keys(first as Record<string, unknown>).map(sanitiseKey);
  sheet.columns = headers.map((h) => ({
    header: h,
    key: h,
    width: Math.min(Math.max(h.length + 2, 10), 50),
  }));

  // Bold + grey header row
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  };

  for (const row of data) {
    const sanitised: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
      sanitised[sanitiseKey(k)] = sanitiseValue(v);
    }
    sheet.addRow(sanitised);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/**
 * Trigger a browser file download for a Blob.
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
