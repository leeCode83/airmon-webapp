"use client";

/**
 * One SVG line chart drawn by the taste-skill's charts.js (loaded from
 * /charts.js via next/script). Reused for gas, temperature and humidity.
 */
import { useEffect, useRef } from "react";
import { chartDomain, formatTime, formatWeekTip, type SeriesPoint } from "@/lib/air";

/** The slice of window.Charts the component uses. */
interface ChartsApi {
  line: (
    el: HTMLElement,
    opts: {
      labels: string[];
      series: { name: string; values: (number | null)[]; colour?: string; dash?: boolean }[];
      format: (v: number) => string;
      height: number;
      reference?: { value: number; label: string }[];
      xAt?: number[];
      tips?: string[];
      min?: number;
      max?: number;
      /** Element to fill with the auto legend (two series or more). */
      legend?: HTMLElement;
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
  /** Second series drawn dashed (a projection, not a fact), with its legend entry. */
  compare?: { points: SeriesPoint[]; name: string };
  /** Short series name for the legend and tooltip; defaults to {@link ariaLabel}. */
  name?: string;
  height?: number;
  ariaLabel: string;
  /** True once /charts.js has executed; charts wait for it. */
  chartsReady: boolean;
}

/**
 * Draw the series; gaps (null buckets) break the line honestly, isolated
 * buckets render as dots inside the chart library.
 * @param props - See {@link AirChartProps}.
 */
export default function AirChart({
  points,
  format,
  reference,
  compare,
  name,
  height = 220,
  ariaLabel,
  chartsReady,
}: AirChartProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const legendRef = useRef<HTMLDivElement>(null);
  /** False when every bucket is null — e.g. the node last reported over 3 h ago. */
  const hasValues = points.some((p) => p.v != null);
  /** The dashed series only joins when it has something to draw — an empty forecast renders nothing. */
  const hasCompare = !!compare && compare.points.some((p) => p.v != null);

  useEffect(() => {
    const el = elRef.current;
    if (!el || !chartsReady || !hasValues) return;
    const Charts = (window as unknown as { Charts?: ChartsApi }).Charts;
    if (!Charts) return;
    // The 3-hour window spans one day, so axis labels carry the time and the
    // hover tooltip adds the date. A few evenly spaced labels; fewer on a
    // narrow screen so they never touch.
    const maxLabels = el.clientWidth < 480 ? 4 : 6;
    const step = Math.max(1, Math.ceil(points.length / maxLabels));
    const xAt: number[] = [];
    for (let i = 0; i < points.length; i += step) xAt.push(i);
    // Y domain from the data (plus the threshold lines) with a little padding,
    // so the line's height tracks the values instead of a fixed 0-based axis.
    const domain = chartDomain([
      ...points.flatMap((p) => (p.v == null ? [] : [p.v])),
      ...(hasCompare ? compare!.points.flatMap((p) => (p.v == null ? [] : [p.v])) : []),
      ...(reference?.map((r) => r.value) ?? []),
    ]);
    // The forecast hue: the chart token set's third colour, so the legend
    // swatch, line and tooltip dot resolve from one variable.
    const forecastColour =
      getComputedStyle(el).getPropertyValue("--chart-3").trim() || "#4a8ad6";
    Charts.line(el, {
      labels: points.map((p) => formatTime(new Date(p.t))),
      tips: points.map((p) => formatWeekTip(new Date(p.t))),
      series: [
        { name: name ?? ariaLabel, values: points.map((p) => p.v) },
        ...(hasCompare
          ? [
              {
                name: compare!.name,
                values: compare!.points.map((p) => p.v),
                colour: forecastColour,
                dash: true,
              },
            ]
          : []),
      ],
      format,
      height,
      reference,
      xAt,
      min: domain.min,
      max: domain.max,
      legend: legendRef.current ?? undefined,
    });
  }, [chartsReady, points, hasValues, hasCompare, compare, format, reference, height, ariaLabel, name]);

  if (!hasValues) {
    return <div className="empty">No readings in the last 3 hours.</div>;
  }
  return (
    <>
      <div className="legend-slot" ref={legendRef} />
      <div className="chart" ref={elRef} role="img" aria-label={ariaLabel} />
    </>
  );
}
