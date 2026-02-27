import { beforeEach, describe, expect, it, vi } from "vitest";
import { storage, STORAGE_KEYS } from "./index";

describe("storage service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe("get", () => {
    it("returns parsed value from localStorage", () => {
      const mockValue = { name: "test" };
      vi.spyOn(localStorage, "getItem").mockReturnValue(JSON.stringify(mockValue));

      const result = storage.get("test_key");
      expect(result).toEqual(mockValue);
    });

    it("returns default value when key not found", () => {
      vi.spyOn(localStorage, "getItem").mockReturnValue(null);

      const result = storage.get("missing_key", "default");
      expect(result).toBe("default");
    });

    it("returns null when key not found and no default", () => {
      vi.spyOn(localStorage, "getItem").mockReturnValue(null);

      const result = storage.get("missing_key");
      expect(result).toBeNull();
    });
  });

  describe("set", () => {
    it("stores stringified value in localStorage", () => {
      const setItemSpy = vi.spyOn(localStorage, "setItem");
      const value = { foo: "bar" };

      storage.set("test_key", value);

      expect(setItemSpy).toHaveBeenCalledWith("valynt_test_key", JSON.stringify(value));
    });
  });

  describe("remove", () => {
    it("removes item from localStorage", () => {
      const removeItemSpy = vi.spyOn(localStorage, "removeItem");

      storage.remove("test_key");

      expect(removeItemSpy).toHaveBeenCalledWith("valynt_test_key");
    });
  });

  describe("STORAGE_KEYS", () => {
    it("has expected keys defined", () => {
      expect(STORAGE_KEYS.AUTH_TOKEN).toBe("auth_token");
      expect(STORAGE_KEYS.THEME).toBe("theme");
    });
  });
});
