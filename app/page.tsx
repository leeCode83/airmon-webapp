"use client";

/**
 * AirMon dashboard — one screen answering one question: is the air safe right
 * now? The verdict is the lead; sensors, charts and the table are its evidence.
 */
import { useMemo, useState } from "react";
import Image from "next/image";
import Script from "next/script";
import AirChart from "@/components/air-chart";
import ConnectionStamp from "@/components/connection-stamp";
import HistoryTable from "@/components/history-table";
import MetricsRow from "@/components/metrics-row";
import StatusPill from "@/components/status-pill";
import { useAirData } from "@/hooks/use-air-data";
import {
  badCauses,
  computeSummary,
  fanLabel,
  formatGas,
  formatHum,
  formatTemp,
  formatTime,
  weeklySeries,
  type AirLog,
  type AirStatus,
} from "@/lib/air";

const VERDICT_CLS: Record<AirStatus, string> = { BAIK: "pos", SEDANG: "warn", BURUK: "neg" };

/** Static verdict evidence. BURUK is explained live by {@link burukLine}. */
const VERDICT_LINE: Record<Exclude<AirStatus, "BURUK">, string> = {
  BAIK: "Gas below 500 ADC. Room air is clean.",
  SEDANG: "Gas above 500 ADC. Ventilate the room.",
};

/** BURUK evidence: one sentence per crossed cutoff; names the firmware hysteresis when neither is live. */
function burukLine(log: AirLog): string {
  const causes = badCauses(log);
  return causes.length > 0
    ? causes.join(" ")
    : "Sensor node raised this verdict; the reading is back under its cutoffs.";
}

/** Gas chart thresholds (module scope so the chart effect sees a stable value). */
const GAS_REFERENCE = [
  { value: 500, label: "SEDANG 500" },
  { value: 2000, label: "BURUK 2,000" },
];

export default function Page() {
  const [chartsReady, setChartsReady] = useState(false);
  const { rows, state, lastUpdated, errorMsg, demo, retry } = useAirData();

  const latest = rows.at(-1) ?? null;
  const gasSeries = useMemo(() => weeklySeries(rows, (r) => r.gas), [rows]);
  const tempSeries = useMemo(() => weeklySeries(rows, (r) => r.temp), [rows]);
  const humSeries = useMemo(() => weeklySeries(rows, (r) => r.hum), [rows]);
  const gasSummary = useMemo(() => computeSummary(rows, (r) => r.gas), [rows]);
  const peak = useMemo(
    () => rows.reduce((a, b) => (b.gas > a.gas ? b : a), rows[0]),
    [rows],
  );

  return (
    <>
      <Script src="/charts.js" strategy="afterInteractive" onReady={() => setChartsReady(true)} />

      <header className="topbar">
        <Image className="mark" src="/logo.jpeg" alt="AirMon logo" width={30} height={30} priority />
        <span className="name">AirMon</span>
        <span className="scope">Automatic Room monitor</span>
      </header>

      <main className="canvas">
        <div className="title-row">
          <div>
            <h1>Overview</h1>
            <p className="sub">
              {rows.length > 0
                ? `Gas peaked at ${formatGas(peak.gas)} at ${formatTime(peak.ts)} this week.`
                : "Live readings from the sensor node, refreshed every 10 seconds."}
            </p>
          </div>
          <div className="title-side">
            <ConnectionStamp state={state} lastUpdated={lastUpdated} />
          </div>
        </div>

        {demo && (
          <div className="notice">
            Demo data. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in
            .env.local to go live.
          </div>
        )}
        {state === "error" && (
          <p className="error-line">
            Couldn&apos;t load readings. Last updated{" "}
            {lastUpdated ? formatClockSafe(lastUpdated) : "never"}. {errorMsg}
            <button type="button" onClick={retry}>
              Retry
            </button>
          </p>
        )}

        <MetricsRow latest={latest} />

        <div className="grid">
          <section className="panel span-8" aria-label="Gas over time">
            <header>
              <h2>Gas over time</h2>
              <span className="meta">MQ-135 · ADC</span>
            </header>
            <AirChart
              points={gasSeries}
              format={formatGas}
              reference={GAS_REFERENCE}
              height={200}
              ariaLabel="Gas level across the past week"
              chartsReady={chartsReady}
            />
          </section>

          <section className="panel span-4 fill" aria-label="Air verdict">
            <header>
              <h2>Air verdict</h2>
              {latest && <StatusPill status={latest.status} />}
            </header>
            {latest ? (
              <>
                <div className={`verdict-word ${VERDICT_CLS[latest.status]}`}>{latest.status}</div>
                <p className="verdict-sub">
                  {latest.status === "BURUK" ? burukLine(latest) : VERDICT_LINE[latest.status]}
                </p>
                <div className="kv">
                  <div className="kv-row">
                    <span className="k">Fan</span>
                    <span className="v">{fanLabel(latest.fan)}</span>
                  </div>
                  <div className="kv-row">
                    <span className="k">Gas avg this week</span>
                    <span className="v">
                      {formatGas(Math.round(gasSummary.avg))}
                      <small>ADC</small>
                    </span>
                  </div>
                  <div className="kv-row">
                    <span className="k">Gas range</span>
                    <span className="v">
                      {formatGas(gasSummary.min)}–{formatGas(gasSummary.max)}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="empty">Waiting for the first reading.</div>
            )}
          </section>

          <section className="panel span-6" aria-label="Temperature over time">
            <header>
              <h2>Temperature</h2>
              <span className="meta">DHT11 · °C</span>
            </header>
            <AirChart
              points={tempSeries}
              format={formatTemp}
              height={190}
              ariaLabel="Temperature across the past week"
              chartsReady={chartsReady}
            />
          </section>

          <section className="panel span-6" aria-label="Humidity over time">
            <header>
              <h2>Humidity</h2>
              <span className="meta">DHT11 · %RH</span>
            </header>
            <AirChart
              points={humSeries}
              format={formatHum}
              height={190}
              ariaLabel="Humidity across the past week"
              chartsReady={chartsReady}
            />
          </section>

          <section className="panel span-12" aria-label="Recent readings">
            <header>
              <h2>Recent readings</h2>
              <span className="meta">newest {Math.min(rows.length, 10)} of {rows.length}</span>
            </header>
            <HistoryTable rows={rows} />
          </section>
        </div>
      </main>
    </>
  );
}

/** formatClock guard for Date | null — the error line's "last good" time. */
function formatClockSafe(d: Date): string {
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}
