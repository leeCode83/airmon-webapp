/**
 * Deterministic demo dataset, used when Supabase env vars are unset so the
 * dashboard renders before `.env` is filled. Rows are built from the same
 * domain rules in `air.ts` (status from gas, fan follows status), so every
 * figure agrees — the skill's rule that totals are computed, never typed.
 */
import { statusForGas, type AirLog } from "./air";

/** Rows covered: 6 h at the firmware's 5 s cadence. */
const ROWS = 4320;
/** Seconds between rows. */
const STEP_S = 5;

/** Small seeded PRNG (mulberry32) — the same dataset on every call. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate the demo history: quiet room air, one cooking spike in the last
 * hour (gas past SEDANG then BURUK, fan on while the air is bad), temperature
 * and humidity drifting, LDR day/night from the real local hour.
 * @returns Rows ascending by `ts`, ending "now".
 */
export function demoLogs(): AirLog[] {
  const rand = rng(20261025);
  const now = Date.now();
  const hour = new Date().getHours();
  const day = hour >= 6 && hour < 18;
  const eventStartMin = 38; // cooking starts 38 minutes ago
  const rows: AirLog[] = [];

  for (let i = 0; i < ROWS; i++) {
    const agoS = (ROWS - 1 - i) * STEP_S;
    const agoMin = agoS / 60;
    const ts = new Date(now - agoS * 1000).toISOString();

    // Gas: baseline ~100–180, one event ramping to ~2,400 and decaying back.
    let gas = 115 + rand() * 60;
    const into = eventStartMin - agoMin; // minutes since the event began
    if (into > 0 && into < 14) {
      const ramp = Math.min(into / 2.5, 1); // ~2.5 min climb
      const fall = into > 8 ? 1 - (into - 8) / 6 : 1;
      gas += ramp * fall * (1600 + rand() * 800);
    }
    gas = Math.min(Math.round(gas), 4095);

    const status = statusForGas(gas);
    const temp = 30.2 + Math.sin(i / 900) * 1.3 + rand() * 0.4;
    const hum = 63 + Math.cos(i / 900) * 5 + rand() * 2;
    const ldr = day ? Math.round(220 + rand() * 500) : Math.round(3650 + rand() * 400);
    const fan: 0 | 1 = status === "BAIK" ? 0 : 1;

    rows.push({ ts, gas, temp: +temp.toFixed(1), hum: +hum.toFixed(1), ldr, fan, status });
  }
  return rows;
}
