/** The sensor KPI strip: one divided card, label over value, gas leads. */
import { formatGas, formatHum, formatTemp, isNight, type AirLog } from "@/lib/air";

/**
 * Render the four latest sensor readings; gas is the lead figure.
 * @param props.latest - Newest row, or null while the first fetch is in flight.
 */
export default function MetricsRow({ latest }: { latest: AirLog | null }) {
  return (
    <div className="kpis" aria-label="Latest readings">
      <div className="kpi lead">
        <div className="kpi-label">Gas (MQ-135)</div>
        <div className="kpi-value">
          {latest ? formatGas(latest.gas) : <span className="skeleton" style={{ width: 72, height: 28 }} />}
          <small>ADC</small>
        </div>
      </div>
      <div className="kpi">
        <div className="kpi-label">Temperature</div>
        <div className="kpi-value">
          {latest ? formatTemp(latest.temp) : <span className="skeleton" style={{ width: 56, height: 20 }} />}
          <small>°C</small>
        </div>
      </div>
      <div className="kpi">
        <div className="kpi-label">Humidity</div>
        <div className="kpi-value">
          {latest ? formatHum(latest.hum) : <span className="skeleton" style={{ width: 56, height: 20 }} />}
          <small>%RH</small>
        </div>
      </div>
      <div className="kpi">
        <div className="kpi-label">Light</div>
        <div className="kpi-value">
          {latest ? (isNight(latest.ldr) ? "Night" : "Day") : <span className="skeleton" style={{ width: 48, height: 20 }} />}
        </div>
      </div>
    </div>
  );
}
