/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";

import {
  exportToCSV,
  exportToExcel,
  exportToPDF,
  exportToPNG,
  generateFilename,
} from "../../utils/export";

describe("ActionRouter export contract helpers", () => {
  it("should generate pdf-compatible output for router downloads", async () => {
    const filename = generateFilename("artifact", "pdf");
    const blob = await exportToPDF({ artifactType: "artifact" }, { filename });
    const text = new TextDecoder().decode(await blob.arrayBuffer());

    expect(filename).toMatch(/^artifact-.*\.pdf$/);
    expect(blob.type).toBe("application/pdf");
    expect(text.startsWith("%PDF-")).toBe(true);
  });

  it("should generate png-compatible output for router downloads", async () => {
    const filename = generateFilename("artifact", "png");
    const blob = await exportToPNG("artifact", { width: 4, height: 4, filename });
    const header = Array.from(new Uint8Array(await blob.arrayBuffer()).slice(0, 8));

    expect(filename).toMatch(/^artifact-.*\.png$/);
    expect(blob.type).toBe("image/png");
    expect(header).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  });

  it("should generate xlsx-compatible output for excel exports", async () => {
    const filename = generateFilename("artifact", "xlsx");
    const blob = await exportToExcel([{ id: 1, name: "Row" }], { sheetName: "artifact" });
    const header = Array.from(new Uint8Array(await blob.arrayBuffer()).slice(0, 4));

    expect(filename).toMatch(/^artifact-.*\.xlsx$/);
    expect(blob.type).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(header).toEqual([80, 75, 3, 4]);
  });

  it("should generate csv text output with csv mime compatibility", () => {
    const csv = exportToCSV([{ id: 1, name: "Row" }]);

    expect(csv).toContain("id,name");
    expect(csv).toContain("1,Row");
  });
});
