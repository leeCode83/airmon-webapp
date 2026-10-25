"use client";

/**
 * React glue over `lib/poll.ts`: one polling loop per time range, shared state
 * for the screen. Falls back to demo data when Supabase env vars are unset.
 */
import { useEffect, useState } from "react";
import type { AirLog } from "@/lib/air";
import { demoLogs } from "@/lib/demo";
import { createPoller, type Poller } from "@/lib/poll";
import { getRecentLogs, getSupabase } from "@/lib/supabase";

/** Selectable history windows. `limit` = rows at the firmware's 5 s cadence. */
export const RANGES = [
  { key: "30m", label: "30 min", limit: 360 },
  { key: "1h", label: "1 hour", limit: 720 },
  { key: "6h", label: "6 hours", limit: 4320 },
] as const;

/** Key of a selectable window. */
export type RangeKey = (typeof RANGES)[number]["key"];

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
 * Poll `log` for the newest `limit` rows, keeping old rows on screen while a
 * refresh is in flight.
 * @param limit - Newest rows to keep: the active range's limit.
 */
export function useAirData(limit: number): AirData {
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
        setRows(demoLogs().slice(-limit));
        setState("live");
        setLastUpdated(new Date());
        return;
      }
      try {
        setRows(await getRecentLogs(limit));
        setState("live");
        setLastUpdated(new Date());
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Unknown error");
        setState("error");
      }
    }

    poller = createPoller(fetchNow, POLL_MS);
    return () => poller?.stop();
  }, [limit, demo, nonce]);

  return { rows, state, lastUpdated, errorMsg, demo, retry: () => setNonce((n) => n + 1) };
}
