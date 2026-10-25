/** History window selector — the selected option carries the 1px accent line. */
import { RANGES, type RangeKey } from "@/hooks/use-air-data";

/**
 * Render the segmented range control.
 * @param props.value - Active window key.
 * @param props.onChange - Called with the newly selected key.
 */
export default function RangeSelect({
  value,
  onChange,
}: {
  value: RangeKey;
  onChange: (key: RangeKey) => void;
}) {
  return (
    <div className="segmented" role="group" aria-label="History window">
      {RANGES.map((r) => (
        <button
          key={r.key}
          type="button"
          aria-pressed={value === r.key}
          onClick={() => onChange(r.key)}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
