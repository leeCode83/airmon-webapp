"use client";

/**
 * One SVG line chart drawn by the taste-skill's charts.js (loaded from
 * /charts.js via next/script). Reused for gas, temperature and humidity.
 */
import { useEffect, useRef } from "react";
import { formatWeekLabel, type SeriesPoint } from "@/lib/air";

/** The slice of window.Charts the component uses. */
interface ChartsApi {
  line: (
    el: HTMLElement,
    opts: {
      labels: string[];
      series: { name: string; values: (number | null)[] }[];
      format: (v: number) => string;
      height: number;
      reference?: { value: number; label: string }[];
      xAt?: number[];
    },
  ) => void;
}

/** Props of {@link AirChart}. */
export interface AirChartProps {
  points: SeriesPoint[];
  /** Value formatter — also styles the y ticks. */
  format: (v: number) => string;
  /** Threshold lines with end labels, e.g. the SEDANG/BURUK cuts. */
  reference?: { value: number; label: string }[];
  height?: number;
  ariaLabel: string;
  /** True once /charts.js has executed; charts wait for it. */
  chartsReady: boolean;
}

/**
 * Draw the series; gaps (null buckets) break the line honestly.
 * @param props - See {@link AirChartProps}.
 */
export default function AirChart({
  points,
  format,
  reference,
  height = 220,
  ariaLabel,
  chartsReady,
}: AirChartProps) {
  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = elRef.current;
    if (!el || !chartsReady || points.length === 0) return;
    const Charts = (window as unknown as { Charts?: ChartsApi }).Charts;
    if (!Charts) return;
    // 6-hour buckets repeat the clock time daily; label a few evenly spaced
    // points with day + hour. Fewer on a narrow screen so they never touch.
    const maxLabels = el.clientWidth < 480 ? 4 : 6;
    const step = Math.max(1, Math.ceil(points.length / maxLabels));
    const xAt: number[] = [];
    for (let i = 0; i < points.length; i += step) xAt.push(i);
    Charts.line(el, {
      labels: points.map((p) => formatWeekLabel(new Date(p.t))),
      series: [{ name: ariaLabel, values: points.map((p) => p.v) }],
      format,
      height,
      reference,
      xAt,
    });
  }, [chartsReady, points, format, reference, height, ariaLabel]);

  if (points.length === 0) {
    return <div className="empty">No readings this week yet.</div>;
  }
  return <div className="chart" ref={elRef} role="img" aria-label={ariaLabel} />;
}
