/**
 * Supabase I/O for the `log` table. Nothing else lives here: no domain rules,
 * no polling. Uses the publishable key from env — RLS allows anon SELECT only.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { WEEK_MS, type AirLog } from "./air";

/** Table name the ESP32 firmware writes to. */
const TABLE = "log";

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
 * Charts bucket it downstream.
 *
 * Supabase caps every request at 1,000 rows (`db.max_rows`), so the window is
 * paged through with `.range` until a short page. Ascending order comes from
 * reversing the newest-first pages.
 * @returns Rows ascending by `ts`; empty array when none in the window.
 * @throws When the query fails (offline, bad env, missing table).
 */
export async function getWeekLogs(): Promise<AirLog[]> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase env vars are not set");
  const since = new Date(Date.now() - WEEK_MS).toISOString();
  const PAGE = 1000; // the server's own hard cap per request
  const out: AirLog[] = [];
  for (let offset = 0; offset < 20 * PAGE; offset += PAGE) {
    // ponytail: one request per 1,000 rows per poll; raise db.max_rows or aggregate in a view if the window ever needs more
    const { data, error } = await sb
      .from(TABLE)
      .select("ts, gas, temp, hum, ldr, fan, status")
      .gte("ts", since)
      .order("ts", { ascending: false })
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as AirLog[];
    out.push(...page);
    if (page.length < PAGE) break;
  }
  return out.reverse();
}
