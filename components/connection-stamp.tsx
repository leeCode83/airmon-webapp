/** Freshness stamp: a live dot plus the time of the last successful fetch. */
import { formatClock } from "@/lib/air";
import type { ConnState } from "@/hooks/use-air-data";

/**
 * Render the connection stamp for the title row.
 * @param props.state - "loading" | "live" | "error".
 * @param props.lastUpdated - Time of the last successful fetch.
 */
export default function ConnectionStamp({
  state,
  lastUpdated,
}: {
  state: ConnState;
  lastUpdated: Date | null;
}) {
  const text =
    state === "live" && lastUpdated
      ? `Updated ${formatClock(lastUpdated)}`
      : state === "loading"
        ? "Connecting…"
        : "Connection lost";
  return (
    <span className="stamp">
      <span className={`live-dot${state === "live" ? "" : " stale"}`} aria-hidden="true" />
      {text}
    </span>
  );
}
