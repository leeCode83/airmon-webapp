/**
 * Domain rules for the air monitor. One source of truth: thresholds, status
 * mapping, formatters and chart series all read from here. Pure functions only.
 */

/** Air quality verdict, as the ESP32 firmware writes it to Supabase. */
export type AirStatus = "BAIK" | "SEDANG" | "BURUK";

/** One row of the Supabase `log` table. */
export interface AirLog {
  /** Row timestamp (ISO 8601), set by Postgres `now()`. */
  ts: string;
  /** MQ-135 gas reading, raw ADC 0–4095. ~100–110 in clean air. */
  gas: number;
  /** Temperature in °C. */
  temp: number;
  /** Relative humidity in %RH. */
  hum: number;
  /** LDR reading, raw ADC. Above {@link LDR_NIGHT} means dark. */
  ldr: number;
  /** Fan state: 1 on, 0 off. */
  fan: 0 | 1;
  /** Firmware verdict for {@link gas}. */
  status: AirStatus;
}

/** Gas (raw ADC) at or above this is SEDANG. Mirrors firmware `GAS_SEDANG`. */
export const GAS_SEDANG = 700;
/** Gas (raw ADC) at or above this is BURUK. Mirrors firmware `GAS_BURUK`. */
export const GAS_BURUK = 1200;
/** LDR (raw ADC) above this means night. Mirrors firmware `LDR_GELAP`; the module reads high in the dark. */
export const LDR_NIGHT = 3500;
/** Temperature cutoff in °C by day. Mirrors firmware `TEMP_DAY`. */
export const TEMP_DAY = 35.0;
/** Temperature cutoff in °C at night. Mirrors firmware `TEMP_NIGHT`. */
export const TEMP_NIGHT = 30.0;
/** One chart bucket: 5 minutes. */
export const BUCKET_MS = 5 * 60_000;
/** Buckets in the window: 36 x 5 min = 3 hours. */
export const BUCKETS = 36;
/** The window the dashboard shows, in milliseconds. */
export const WINDOW_MS = BUCKETS * BUCKET_MS;

/**
 * Classify a gas reading. Boundaries match the firmware calibration:
 * 699 → BAIK, 700 → SEDANG, 1199 → SEDANG, 1200 → BURUK.
 * @param gas - Raw ADC value from the MQ-135.
 */
export function statusForGas(gas: number): AirStatus {
  if (gas >= GAS_BURUK) return "BURUK";
  if (gas >= GAS_SEDANG) return "SEDANG";
  return "BAIK";
}

/**
 * Day/night from the LDR. The module reads high in the dark, so night is `> LDR_NIGHT`.
 * @param ldr - Raw ADC value from the LDR.
 */
export function isNight(ldr: number): boolean {
  return ldr > LDR_NIGHT;
}

/**
 * Temperature cutoff for the time of day: 30 °C at night, 35 °C by day, the
 * same rule the firmware applies before writing `status`.
 * @param night - Result of {@link isNight}.
 */
export function tempLimit(night: boolean): number {
  return night ? TEMP_NIGHT : TEMP_DAY;
}

/**
 * Fan state as words, for display.
 * @param fan - 0 or 1 from the log row.
 */
export function fanLabel(fan: 0 | 1): "ON" | "OFF" {
  return fan ? "ON" : "OFF";
}

/** Shared number formatter, en locale, tabular-friendly. */
const nf = (min: number, max: number) =>
  new Intl.NumberFormat("en", { minimumFractionDigits: min, maximumFractionDigits: max });

/** Gas as a grouped integer: 2778 → "2,778". */
export function formatGas(gas: number): string {
  return nf(0, 0).format(gas);
}

/** Temperature at fixed 1 decimal: 31.5. */
export function formatTemp(temp: number): string {
  return nf(1, 1).format(temp);
}

/** Humidity at fixed 1 decimal: 64.2. */
export function formatHum(hum: number): string {
  return nf(1, 1).format(hum);
}

/**
 * Time-of-day label for chart x axes and the freshness stamp: "14:32".
 * @param ts - ISO timestamp (or Date).
 */
export function formatTime(ts: string | Date): string {
  const d = typeof ts === "string" ? new Date(ts) : ts;
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Time with seconds for the history table — rows land 5 s apart, so minutes
 * alone repeat: "14:32:05".
 * @param ts - ISO timestamp (or Date).
 */
export function formatClock(ts: string | Date): string {
  const d = typeof ts === "string" ? new Date(ts) : ts;
  const s = `${String(d.getSeconds()).padStart(2, "0")}`;
  return `${formatTime(d)}:${s}`;
}

/**
 * Hover detail for a chart bucket: date plus the exact bucket start,
 * "Oct 29, 19:50". The axis keeps the short time-only form.
 * @param ts - ISO timestamp (or Date).
 */
export function formatWeekTip(ts: string | Date): string {
  const d = typeof ts === "string" ? new Date(ts) : ts;
  const day = d.toLocaleString("en", { day: "numeric", month: "short" });
  return `${day}, ${formatTime(d)}`;
}

/**
 * Why a BURUK verdict is BURUK: one sentence per crossed cutoff, gas or
 * temperature or both. The firmware adds hysteresis before clearing BURUK,
 * so a BURUK row can name no live cause; callers must handle an empty list.
 * @param log - The row whose status needs explaining.
 */
export function badCauses(log: AirLog): string[] {
  const causes: string[] = [];
  if (log.gas >= GAS_BURUK) {
    causes.push(`Gas at ${formatGas(log.gas)} ADC, above the ${formatGas(GAS_BURUK)} cutoff.`);
  }
  const night = isNight(log.ldr);
  const limit = tempLimit(night);
  if (log.temp > limit) {
    causes.push(
      `Temperature at ${formatTemp(log.temp)} °C, above the ${formatTemp(limit)} °C ${night ? "night" : "day"} limit.`,
    );
  }
  return causes;
}

/** Chart series point: epoch ms + value. */
export interface SeriesPoint {
  /** Epoch milliseconds. */
  t: number;
  /** Averaged value for the bucket, or null when the bucket is empty. */
  v: number | null;
}

/**
 * Downsample rows into {@link BUCKETS} fixed 5-minute buckets covering the
 * window, averaging each metric. Buckets sit on local 5-minute boundaries and
 * end at the current 5-minute mark, so the axis always spans the last 3 hours
 * of wall clock — even when the node is offline and the newest row is stale.
 * Empty buckets stay null: an honest gap, not a fake flat line.
 * @param rows - Log rows, any order.
 * @param pick - Value to plot per row, e.g. `(r) => r.gas`.
 * @returns 36 points ascending in time; each point's `t` is its bucket start.
 */
export function windowSeries(rows: AirLog[], pick: (r: AirLog) => number): SeriesPoint[] {
  if (rows.length === 0) return [];
  // Anchor the newest bucket onto the local wall clock (5-minute marks), then
  // step back 35 buckets to cover the window. Rows older than the window clamp
  // into bucket 0; rows in the future (clock skew) clamp into the last bucket.
  const newest = new Date();
  newest.setMinutes(newest.getMinutes() - (newest.getMinutes() % 5), 0, 0);
  const lastStart = +newest;
  const t0 = lastStart - (BUCKETS - 1) * BUCKET_MS;
  const bucketOf = (t: number) =>
    Math.min(Math.max(Math.floor((t - t0) / BUCKET_MS), 0), BUCKETS - 1);

  const sums = new Map<number, { sum: number; n: number }>();
  for (const r of rows) {
    const bi = bucketOf(+new Date(r.ts));
    const acc = sums.get(bi) ?? { sum: 0, n: 0 };
    acc.sum += pick(r);
    acc.n += 1;
    sums.set(bi, acc);
  }

  const out: SeriesPoint[] = [];
  for (let bi = 0; bi < BUCKETS; bi++) {
    const acc = sums.get(bi);
    out.push({ t: t0 + bi * BUCKET_MS, v: acc ? acc.sum / acc.n : null });
  }
  return out;
}

/**
 * Padded y-axis domain for a chart: the values' extent grown 8% per side so
 * the line never touches the plot edge; a flat series gets ±10% of the value
 * (at least 1). The chart engine's nice-step ticks round these to clean
 * boundaries, so the line fills the plot and the jumps in the data read as
 * jumps in height.
 * @param values - Non-null series values, plus any reference-line values.
 */
export function chartDomain(values: number[]): { min: number; max: number } {
  if (values.length === 0) return { min: 0, max: 1 };
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = hi > lo ? (hi - lo) * 0.08 : Math.max(Math.abs(hi) * 0.1, 1);
  return { min: lo - pad, max: hi + pad };
}

/** Min / max / mean of one metric over a set of rows. */
export interface Summary {
  min: number;
  max: number;
  /** Arithmetic mean, unrounded — format at display. */
  avg: number;
}

/**
 * Reduce rows to min / max / avg of one metric. Empty input → all zeros.
 * @param rows - Log rows.
 * @param pick - Value to reduce, e.g. `(r) => r.temp`.
 */
export function computeSummary(rows: AirLog[], pick: (r: AirLog) => number): Summary {
  if (rows.length === 0) return { min: 0, max: 0, avg: 0 };
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  for (const r of rows) {
    const v = pick(r);
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }
  return { min, max, avg: sum / rows.length };
}
