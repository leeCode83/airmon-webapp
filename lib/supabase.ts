/**
 * Supabase I/O for the `log` table. Nothing else lives here: no domain rules,
 * no polling. Uses the publishable key from env — RLS allows anon SELECT only.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AirLog } from "./air";

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
 * Fetch the newest rows of `log`, ascending in time.
 * @param limit - Max rows. 6 h at the firmware's 5 s cadence needs 4,320.
 * @returns Rows ascending by `ts`; empty array when the table is empty.
 * @throws When the query fails (offline, bad env, missing table).
 */
export async function getRecentLogs(limit: number): Promise<AirLog[]> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase env vars are not set");
  const { data, error } = await sb
    .from(TABLE)
    .select("ts, gas, temp, hum, ldr, fan, status")
    .order("ts", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as AirLog[]).reverse();
}
