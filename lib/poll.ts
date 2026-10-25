/**
 * Interval polling with no React dependency, so the loop is testable with fake
 * timers. The React hook in `hooks/` is a thin wrapper over this.
 */

/** A running poller. */
export interface Poller {
  /** Run the task now, out of band, and reset the interval clock. */
  refresh(): Promise<void>;
  /** Clear the interval. Safe to call twice. */
  stop(): void;
}

/**
 * Start polling: the task runs immediately, then every `intervalMs`.
 * A tick is skipped while a previous run is still in flight, and a rejected
 * task never kills the loop (catches internally; the task reports its own errors).
 * @param fn - The task. Resolve = success; reject = failure (polling continues).
 * @param intervalMs - Milliseconds between ticks.
 * @returns A poller; call {@link Poller.stop} on teardown.
 */
export function createPoller(fn: () => Promise<void>, intervalMs: number): Poller {
  let timer: ReturnType<typeof setInterval> | null = null;
  let busy = false;

  async function run(): Promise<void> {
    if (busy) return;
    busy = true;
    try {
      await fn();
    } catch {
      // Keep the loop alive; the task owns its error state.
    }
    busy = false;
  }

  run();
  timer = setInterval(() => void run(), intervalMs);

  return {
    refresh: run,
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}
