"use client";

/**
 * React glue over `lib/poll.ts`: one polling loop for the 3-hour window, shared
 * state for the screen. Falls back to demo data when Supabase env vars are unset.
 */
import { useEffect, useState } from "react";
import type { AirLog } from "@/lib/air";
import { demoLogs } from "@/lib/demo";
import { createPoller, type Poller } from "@/lib/poll";
import { getSupabase, getWindowLogs } from "@/lib/supabase";

/** Poll cadence — the ESP32 inserts every 5 s, so 10 s never misses a beat. */
export const POLL_MS = 10_000;

/** Connection state of the screen. */
export type ConnState = "loading" | "live" | "error";

/** Everything the dashboard renders from. */
export interface AirData {
  rows: AirLog[];
  state: ConnState;
  lastUpdated: Date | null;
  /** Query failure message; only set when state is "error". */
  errorMsg: string;
  /** True when rendering demo data (env unset). */
  demo: boolean;
  /** Restart the loop now — the Retry control. */
  retry: () => void;
}

/**
 * Poll `log` for the last 3 hours of rows, keeping old rows on screen while a
 * refresh is in flight.
 */
export function useAirData(): AirData {
  const [rows, setRows] = useState<AirLog[]>([]);
  const [state, setState] = useState<ConnState>("loading");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [nonce, setNonce] = useState(0);
  const demo = !getSupabase();

  useEffect(() => {
    let poller: Poller | null = null;

    async function fetchNow(): Promise<void> {
      if (demo) {
        setRows(demoLogs());
        setState("live");
        setLastUpdated(new Date());
        return;
      }
      try {
        setRows(await getWindowLogs());
        setState("live");
        setLastUpdated(new Date());
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Unknown error");
        setState("error");
      }
    }

    poller = createPoller(fetchNow, POLL_MS);
    return () => poller?.stop();
  }, [demo, nonce]);

  return { rows, state, lastUpdated, errorMsg, demo, retry: () => setNonce((n) => n + 1) };
}
