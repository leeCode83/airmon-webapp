/**
 * Supabase I/O for the `log` table. Nothing else lives here: no domain rules,
 * no polling. Uses the publishable key from env — RLS allows anon SELECT only.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { WEEK_MS, type AirLog } from "./air";

/** Table name the ESP32 firmware writes to. */
const TABLE = "log";

/** Safety cap: 7 days at the 5 s cadence is 120,960 rows. */
const WEEK_ROWS = 130_000;

let client: SupabaseClient | null = null;

/**
 * Shared Supabase client, built once from `NEXT_PUBLIC_SUPABASE_*` env vars.
 * @returns The client, or null when env is unset — the caller falls back to demo data.
 */
export function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  client ??= createClient(url, key);
  return client;
}

/**
 * Fetch the past week of `log`, ascending in time: the dashboard's one window.
 * Charts bucket it into 6-hour steps downstream.
 * @returns Rows ascending by `ts`; empty array when none in the window.
 * @throws When the query fails (offline, bad env, missing table).
 */
export async function getWeekLogs(): Promise<AirLog[]> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase env vars are not set");
  const since = new Date(Date.now() - WEEK_MS).toISOString();
  const { data, error } = await sb
    .from(TABLE)
    .select("ts, gas, temp, hum, ldr, fan, status")
    .gte("ts", since)
    .order("ts", { ascending: false })
    .limit(WEEK_ROWS); // ponytail: raw rows over the wire each poll; move averaging into a DB view when the payload hurts
  if (error) throw new Error(error.message);
  return ((data ?? []) as AirLog[]).reverse();
}
