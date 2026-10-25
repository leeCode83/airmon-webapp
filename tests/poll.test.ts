import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPoller } from "@/lib/poll";

const INTERVAL = 10_000;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("createPoller", () => {
  it("runs the task immediately, then on every interval", async () => {
    let calls = 0;
    const p = createPoller(async () => {
      calls++;
    }, INTERVAL);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(INTERVAL);
    expect(calls).toBe(2);
    await vi.advanceTimersByTimeAsync(2 * INTERVAL);
    expect(calls).toBe(4);
    p.stop();
  });

  it("keeps polling after a rejected task", async () => {
    let calls = 0;
    const p = createPoller(async () => {
      calls++;
      if (calls === 1) throw new Error("boom");
    }, INTERVAL);
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(INTERVAL);
    expect(calls).toBe(2);
    p.stop();
  });

  it("skips a tick while the previous run is still in flight", async () => {
    let calls = 0;
    let resolve!: () => void;
    const p = createPoller(
      () =>
        new Promise<void>((r) => {
          resolve = () => {
            calls++;
            r();
          };
        }),
      INTERVAL,
    );
    await vi.advanceTimersByTimeAsync(3 * INTERVAL);
    resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toBe(1);
    p.stop();
  });

  it("stop halts the interval", async () => {
    let calls = 0;
    const p = createPoller(async () => {
      calls++;
    }, INTERVAL);
    p.stop();
    await vi.advanceTimersByTimeAsync(6 * INTERVAL);
    expect(calls).toBe(1);
  });
});
