/**
 * Tests for VersionHistoryService
 *
 * Focuses on the pure comparison and rollback-preview logic.
 * Supabase and BaseService are mocked so tests run without a database.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock supabase before importing the service
vi.mock("../lib/supabase.js", () => ({
  supabase: null,
  getSupabaseClient: vi.fn(),
  createServerSupabaseClient: vi.fn(),
}));

vi.mock("./BaseService.js", () => {
  const BaseService = class {
    protected supabase = {};
    protected log = vi.fn();
    protected validateRequired = vi.fn();
    protected clearCache = vi.fn();
    protected async executeRequest<T>(fn: () => Promise<T>): Promise<T> {
      return fn();
    }
  };
  return { BaseService };
});

import { VersionHistoryService, type SettingsVersion } from "../VersionHistoryService.js";

function makeVersion(overrides: Partial<SettingsVersion> = {}): SettingsVersion {
  return {
    id: "v1",
    settingKey: "theme",
    oldValue: null,
    newValue: { color: "blue", size: "medium" },
    scope: "organization",
    scopeId: "org-1",
    changedBy: "user-1",
    changeType: "update",
    createdAt: "2026-07-01T00:00:00Z",
    rolledBack: false,
    ...overrides,
  };
}

describe("VersionHistoryService.compareVersions", () => {
  let service: VersionHistoryService;

  beforeEach(() => {
    service = new VersionHistoryService();
  });

  it("returns empty differences when both versions have identical newValue", async () => {
    const v1 = makeVersion({ id: "v1", newValue: { color: "blue" } });
    const v2 = makeVersion({ id: "v2", newValue: { color: "blue" } });

    vi.spyOn(service as unknown as { getVersion: (id: string) => Promise<SettingsVersion> }, "getVersion")
      .mockResolvedValueOnce(v1)
      .mockResolvedValueOnce(v2);

    const result = await service.compareVersions("v1", "v2");
    expect(result.differences).toHaveLength(0);
  });

  it("detects changed fields", async () => {
    const v1 = makeVersion({ id: "v1", newValue: { color: "blue", size: "medium" } });
    const v2 = makeVersion({ id: "v2", newValue: { color: "red", size: "medium" } });

    vi.spyOn(service as unknown as { getVersion: (id: string) => Promise<SettingsVersion> }, "getVersion")
      .mockResolvedValueOnce(v1)
      .mockResolvedValueOnce(v2);

    const result = await service.compareVersions("v1", "v2");
    expect(result.differences).toHaveLength(1);
    expect(result.differences[0].field).toBe("color");
    expect(result.differences[0].value1).toBe("blue");
    expect(result.differences[0].value2).toBe("red");
  });

  it("detects added fields", async () => {
    const v1 = makeVersion({ id: "v1", newValue: { color: "blue" } });
    const v2 = makeVersion({ id: "v2", newValue: { color: "blue", size: "large" } });

    vi.spyOn(service as unknown as { getVersion: (id: string) => Promise<SettingsVersion> }, "getVersion")
      .mockResolvedValueOnce(v1)
      .mockResolvedValueOnce(v2);

    const result = await service.compareVersions("v1", "v2");
    expect(result.differences).toHaveLength(1);
    expect(result.differences[0].field).toBe("size");
    expect(result.differences[0].value1).toBeUndefined();
    expect(result.differences[0].value2).toBe("large");
  });

  it("detects removed fields", async () => {
    const v1 = makeVersion({ id: "v1", newValue: { color: "blue", deprecated: true } });
    const v2 = makeVersion({ id: "v2", newValue: { color: "blue" } });

    vi.spyOn(service as unknown as { getVersion: (id: string) => Promise<SettingsVersion> }, "getVersion")
      .mockResolvedValueOnce(v1)
      .mockResolvedValueOnce(v2);

    const result = await service.compareVersions("v1", "v2");
    expect(result.differences).toHaveLength(1);
    expect(result.differences[0].field).toBe("deprecated");
  });

  it("returns both version objects in the result", async () => {
    const v1 = makeVersion({ id: "v1" });
    const v2 = makeVersion({ id: "v2" });

    vi.spyOn(service as unknown as { getVersion: (id: string) => Promise<SettingsVersion> }, "getVersion")
      .mockResolvedValueOnce(v1)
      .mockResolvedValueOnce(v2);

    const result = await service.compareVersions("v1", "v2");
    expect(result.version1.id).toBe("v1");
    expect(result.version2.id).toBe("v2");
  });
});

describe("VersionHistoryService.getRollbackPreview", () => {
  let service: VersionHistoryService;

  beforeEach(() => {
    service = new VersionHistoryService();
  });

  it("returns current and rollback values", async () => {
    const version = makeVersion({
      oldValue: { color: "red" },
      newValue: { color: "blue" },
    });

    vi.spyOn(service as unknown as { getVersion: (id: string) => Promise<SettingsVersion> }, "getVersion")
      .mockResolvedValueOnce(version);

    const preview = await service.getRollbackPreview("v1");
    expect(preview.currentValue).toEqual({ color: "blue" });
    expect(preview.rollbackValue).toEqual({ color: "red" });
  });

  it("lists affected settings from oldValue keys", async () => {
    const version = makeVersion({
      oldValue: { theme: "dark", language: "en" },
      newValue: { theme: "light", language: "fr" },
    });

    vi.spyOn(service as unknown as { getVersion: (id: string) => Promise<SettingsVersion> }, "getVersion")
      .mockResolvedValueOnce(version);

    const preview = await service.getRollbackPreview("v1");
    expect(preview.affectedSettings).toContain("theme");
    expect(preview.affectedSettings).toContain("language");
  });

  it("returns empty affectedSettings when oldValue is null", async () => {
    const version = makeVersion({ oldValue: null, newValue: { x: 1 } });

    vi.spyOn(service as unknown as { getVersion: (id: string) => Promise<SettingsVersion> }, "getVersion")
      .mockResolvedValueOnce(version);

    const preview = await service.getRollbackPreview("v1");
    expect(preview.affectedSettings).toHaveLength(0);
  });
});
