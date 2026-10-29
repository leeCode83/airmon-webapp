/** Recent readings as a rules-and-alignment table, newest first, capped at 10. */
import { fanLabel, formatClock, formatGas, formatHum, formatTemp, isNight, type AirLog } from "@/lib/air";
import StatusPill from "./status-pill";

const CAP = 10;

/**
 * Render the newest rows; times carry seconds because rows land 5 s apart.
 * @param props.rows - Log rows ascending; the newest `CAP` are shown.
 */
export default function HistoryTable({ rows }: { rows: AirLog[] }) {
  const recent = rows.slice(-CAP).reverse();
  if (recent.length === 0) {
    return <div className="empty">No readings yet. Waiting for the sensor node.</div>;
  }
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th className="n">Gas (ADC)</th>
            <th className="n">Temp (°C)</th>
            <th className="n">Humidity (%RH)</th>
            <th>Light</th>
            <th>Fan</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {recent.map((r) => (
            <tr key={r.ts}>
              <td className="mono">{formatClock(r.ts)}</td>
              <td className="n">{formatGas(r.gas)}</td>
              <td className="n">{formatTemp(r.temp)}</td>
              <td className="n">{formatHum(r.hum)}</td>
              <td>{isNight(r.ldr) ? "Night" : "Day"}</td>
              <td className="mono">{fanLabel(r.fan)}</td>
              <td>
                <StatusPill status={r.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
