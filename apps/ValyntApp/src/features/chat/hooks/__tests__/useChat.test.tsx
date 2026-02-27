import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChat } from "../useChat";
import { api } from "../../../../api/client/unified-api-client";
import { act } from "react";

// Mock the API client
vi.mock("../../../../api/client/unified-api-client", () => ({
  api: {
    chat: vi.fn(),
  },
}));

describe("useChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should initialize with default state", () => {
    const { result } = renderHook(() => useChat());

    expect(result.current.messages).toEqual([]);
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("should send message and update state on success", async () => {
    const mockResponse = {
      success: true,
      data: {
        success: true,
        data: {
          content: "Hello from AI",
          model: "mistralai/Mixtral-8x7B-Instruct-v0.1",
          usage: { totalTokens: 50 },
        },
      },
    };

    (api.chat as any).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("Hello");
    });

    // Check loading state (it's async so it would have toggled true then false)
    expect(result.current.isStreaming).toBe(false);

    // Check messages
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]).toMatchObject({
      role: "user",
      content: "Hello",
    });
    expect(result.current.messages[1]).toMatchObject({
      role: "assistant",
      content: "Hello from AI",
      metadata: {
        model: "mistralai/Mixtral-8x7B-Instruct-v0.1",
        tokens: 50,
      },
    });

    // Verify API call
    expect(api.chat).toHaveBeenCalledWith({
      prompt: "Hello",
      model: "mistralai/Mixtral-8x7B-Instruct-v0.1",
    });
  });

  it("should handle API failure", async () => {
    const mockResponse = {
      success: false,
      error: { message: "Network error" },
    };

    (api.chat as any).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("Hello");
    });

    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).toBe("Network error");
    expect(result.current.messages).toHaveLength(1); // User message is added before request
  });

  it("should handle logical failure in API response", async () => {
    const mockResponse = {
      success: true,
      data: {
        success: false,
        error: "Rate limit exceeded",
      },
    };

    (api.chat as any).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("Hello");
    });

    expect(result.current.error).toBe("Rate limit exceeded");
  });

  it("should clear messages", async () => {
    (api.chat as any).mockResolvedValue({
      success: true,
      data: { success: true, data: { content: "ok" } },
    });

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("Hi");
    });

    expect(result.current.messages.length).toBeGreaterThan(0);

    act(() => {
      result.current.clearMessages();
    });

    expect(result.current.messages).toEqual([]);
  });
});
