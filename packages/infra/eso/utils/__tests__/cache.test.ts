import { beforeEach, describe, expect, it, vi } from "vitest";

import { Cache } from "../cache.js";

describe("Cache", () => {
  let cache: Cache;

  beforeEach(() => {
    cache = new Cache(1000); // 1 second TTL for testing
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should set and get data within TTL", () => {
    cache.set("key", "value");
    expect(cache.get("key")).toBe("value");
  });

  it("should return null for expired data", () => {
    cache.set("key", "value", 500); // 500ms TTL
    vi.advanceTimersByTime(600);
    expect(cache.get("key")).toBeNull();
  });

  it("should return null for non-existent key", () => {
    expect(cache.get("nonexistent")).toBeNull();
  });

  it("should clear all data", () => {
    cache.set("key1", "value1");
    cache.set("key2", "value2");
    cache.clear();
    expect(cache.get("key1")).toBeNull();
    expect(cache.get("key2")).toBeNull();
  });

  it("should return correct size after cleaning expired entries", () => {
    cache.set("key1", "value1", 500);
    cache.set("key2", "value2");
    vi.advanceTimersByTime(600);
    expect(cache.size()).toBe(1); // key1 expired, key2 remains
  });

  it("should use default TTL when not specified", () => {
    cache.set("key", "value");
    vi.advanceTimersByTime(500);
    expect(cache.get("key")).toBe("value"); // Within default 1s
    vi.advanceTimersByTime(600);
    expect(cache.get("key")).toBeNull();
  });
});
