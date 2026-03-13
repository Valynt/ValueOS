import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { exportToExcel, exportToPDF, exportToPNG } from "./export";

async function blobToUint8Array(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

describe("export utilities - real format generation", () => {
  it("exportToPDF should generate valid PDF bytes with proper MIME type", async () => {
    const blob = await exportToPDF({ id: "report-1", value: 42 }, { title: "Quarterly Report" });
    const bytes = await blobToUint8Array(blob);
    const decoded = new TextDecoder().decode(bytes);

    expect(blob.type).toBe("application/pdf");
    expect(decoded.startsWith("%PDF-")).toBe(true);
    expect(decoded.includes("%%EOF")).toBe(true);
  });

  it("exportToPNG should generate valid PNG bytes with proper MIME type", async () => {
    const blob = await exportToPNG("pipeline-chart", { width: 8, height: 8 });
    const bytes = await blobToUint8Array(blob);

    expect(blob.type).toBe("image/png");
    expect(Array.from(bytes.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  });

  it("exportToExcel should generate valid XLSX bytes with proper MIME type", async () => {
    const records = [
      { id: 1, name: "Acme", amount: 10.5 },
      { id: 2, name: "Globex", amount: 20 },
    ];

    const blob = await exportToExcel(records, { sheetName: "Exports" });
    const bytes = await blobToUint8Array(blob);

    expect(blob.type).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(Array.from(bytes.slice(0, 4))).toEqual([80, 75, 3, 4]); // ZIP local header (OOXML)

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes.buffer as ArrayBuffer);
    const worksheet = workbook.getWorksheet("Exports");

    expect(worksheet).toBeDefined();

    const rows: Record<string, unknown>[] = [];
    worksheet!.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return; // skip header
      const values = row.values as unknown[];
      rows.push({ id: values[1], name: values[2], amount: values[3] });
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ id: 1, name: "Acme", amount: 10.5 });
  });
});
