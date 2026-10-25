/** Air verdict as a pale status pill — BAIK green, SEDANG amber, BURUK red. */
import type { AirStatus } from "@/lib/air";

const CLS: Record<AirStatus, string> = { BAIK: "pos", SEDANG: "warn", BURUK: "neg" };

/**
 * Render one verdict pill.
 * @param props.status - Verdict from the log row.
 */
export default function StatusPill({ status }: { status: AirStatus }) {
  return <span className={`pill ${CLS[status]}`}>{status}</span>;
}
