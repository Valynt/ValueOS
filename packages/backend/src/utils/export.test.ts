import * as XLSX from "xlsx";
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
    expect(Array.from(bytes.slice(0, 4))).toEqual([80, 75, 3, 4]); // ZIP local header

    const workbook = XLSX.read(bytes, { type: "array" });
    const worksheet = workbook.Sheets.Exports;
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

    expect(worksheet).toBeDefined();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ id: 1, name: "Acme", amount: 10.5 });
  });
});
