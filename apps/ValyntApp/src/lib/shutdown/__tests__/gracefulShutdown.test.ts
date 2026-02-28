import { afterEach, describe, expect, it, vi } from "vitest";

import {
  __resetGracefulShutdownForTests,
  configureGracefulShutdown,
  initiateGracefulShutdown,
  registerShutdownHandler,
  wireProcessShutdownSignals,
} from "../gracefulShutdown";

describe("graceful shutdown", () => {
  afterEach(() => {
    __resetGracefulShutdownForTests();
    vi.restoreAllMocks();
  });

  it("wires SIGTERM/SIGINT and executes handlers in registration order", async () => {
    const order: string[] = [];
    const exitSpy = vi.fn();

    configureGracefulShutdown({ timeoutMs: 200, exit: exitSpy });
    registerShutdownHandler("first", async () => {
      order.push("first");
    });
    registerShutdownHandler("second", async () => {
      order.push("second");
    });

    wireProcessShutdownSignals(["SIGTERM", "SIGINT"]);
    const sigtermListeners = process.listeners("SIGTERM");
    await (sigtermListeners[sigtermListeners.length - 1] as () => Promise<void>)();

    expect(order).toEqual(["first", "second"]);
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it("uses same flow for secret reload and ignores duplicate shutdown attempts", async () => {
    const events: string[] = [];
    const exitSpy = vi.fn();

    configureGracefulShutdown({ timeoutMs: 200, exit: exitSpy });
    registerShutdownHandler("drain", async (reason) => {
      events.push(reason);
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    await Promise.all([
      initiateGracefulShutdown("SIGTERM"),
      initiateGracefulShutdown("secret-reload:SUPABASE_URL"),
    ]);

    expect(events).toEqual(["SIGTERM"]);
    expect(exitSpy).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(0);
  });


  it("allows long-running in-flight drain to complete when within configured timeout", async () => {
    vi.useFakeTimers();
    const exitSpy = vi.fn();
    const completed = vi.fn();

    configureGracefulShutdown({ timeoutMs: 2_000, exit: exitSpy });
    registerShutdownHandler("drainInflightExecutions", async () => {
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      completed();
    });

    const shutdownPromise = initiateGracefulShutdown("SIGTERM");
    await vi.advanceTimersByTimeAsync(1_600);
    await shutdownPromise;

    expect(completed).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(0);
    vi.useRealTimers();
  });

  it("forces termination when draining exceeds timeout", async () => {
    vi.useFakeTimers();
    const exitSpy = vi.fn();

    configureGracefulShutdown({ timeoutMs: 50, exit: exitSpy });
    registerShutdownHandler("slow-drain", async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
    });

    const shutdownPromise = initiateGracefulShutdown("SIGINT");
    await vi.advanceTimersByTimeAsync(60);
    await shutdownPromise;

    expect(exitSpy).toHaveBeenCalledWith(1);
    vi.useRealTimers();
  });
});
