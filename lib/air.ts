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
export const GAS_SEDANG = 500;
/** Gas (raw ADC) at or above this is BURUK. Mirrors firmware `GAS_BURUK`. */
export const GAS_BURUK = 2000;
/** LDR (raw ADC) above this means night. Mirrors firmware `LDR_GELAP`; the module reads high in the dark. */
export const LDR_NIGHT = 3500;

/**
 * Classify a gas reading. Boundaries match the firmware calibration:
 * 499 → BAIK, 500 → SEDANG, 1999 → SEDANG, 2000 → BURUK.
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

/** Chart series point: epoch ms + value. */
export interface SeriesPoint {
  /** Epoch milliseconds. */
  t: number;
  /** Averaged value for the bucket, or null when the bucket is empty. */
  v: number | null;
}

/**
 * Downsample rows into ≤ `maxPoints` equal time buckets, averaging each metric.
 * Keeps long windows (6 h ≈ 4,320 rows at 5 s) drawable as one SVG line. Empty
 * buckets stay null — an honest gap, not a fake flat line.
 * @param rows - Log rows, any order; sorted internally by timestamp.
 * @param pick - Value to plot per row, e.g. `(r) => r.gas`.
 * @param maxPoints - Bucket cap. Default 150.
 * @returns Points ascending in time; each point's `t` is its bucket start.
 */
export function buildSeries(
  rows: AirLog[],
  pick: (r: AirLog) => number,
  maxPoints = 150,
): SeriesPoint[] {
  if (rows.length === 0) return [];
  const sorted = [...rows].sort((a, b) => +new Date(a.ts) - +new Date(b.ts));
  const t0 = +new Date(sorted[0].ts);
  const t1 = +new Date(sorted[sorted.length - 1].ts);
  const width = Math.max((t1 - t0) / maxPoints, 1);

  const sums = new Map<number, { sum: number; n: number }>();
  for (const r of sorted) {
    const bucket = Math.floor((+new Date(r.ts) - t0) / width) * width + t0;
    const acc = sums.get(bucket) ?? { sum: 0, n: 0 };
    acc.sum += pick(r);
    acc.n += 1;
    sums.set(bucket, acc);
  }

  const out: SeriesPoint[] = [];
  for (let b = t0; b <= t1; b += width) {
    const acc = sums.get(b);
    out.push({ t: b, v: acc ? acc.sum / acc.n : null });
  }
  return out;
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
