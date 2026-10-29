import { describe, expect, it } from "vitest";
import {
  BUCKET_MS,
  computeSummary,
  formatWeekLabel,
  weeklySeries,
  type AirLog,
} from "@/lib/air";

/** Row factory: seconds from a fixed epoch, one varying field. */
function row(sec: number, gas: number): AirLog {
  return {
    ts: new Date(Date.UTC(2026, 0, 1, 0, 0, sec)).toISOString(),
    gas,
    temp: 30,
    hum: 60,
    ldr: 100,
    fan: 0,
    status: "BAIK",
  };
}

/** Row factory at an explicit local moment. */
function rowAt(d: Date, gas: number): AirLog {
  return { ...row(0, gas), ts: d.toISOString() };
}

describe("weeklySeries", () => {
  it("returns nothing for empty rows", () => {
    expect(weeklySeries([], (r) => r.gas)).toEqual([]);
  });

  it("returns 28 points spaced 6 h, anchored on a local 6-hour boundary", () => {
    // Newest row 14:37 local: the last bucket starts at 12:00 local.
    const pts = weeklySeries([rowAt(new Date(2026, 9, 29, 14, 37), 100)], (r) => r.gas);
    expect(pts.length).toBe(28);
    expect(pts[27].t).toBe(+new Date(2026, 9, 29, 12, 0));
    expect(pts[27].t - pts[26].t).toBe(BUCKET_MS);
    expect(pts[0].t).toBe(pts[27].t - 27 * BUCKET_MS);
    expect(pts[27].v).toBe(100);
  });

  it("averages rows sharing a bucket, whatever the input order", () => {
    const pts = weeklySeries(
      [
        rowAt(new Date(2026, 9, 29, 12, 5), 100),
        rowAt(new Date(2026, 9, 29, 12, 40), 300),
        rowAt(new Date(2026, 9, 29, 6, 10), 900),
      ],
      (r) => r.gas,
    );
    expect(pts[27].v).toBe(200);
    expect(pts[26].v).toBe(900);
  });

  it("leaves empty buckets as null gaps", () => {
    const pts = weeklySeries(
      [rowAt(new Date(2026, 9, 29, 12, 5), 100), rowAt(new Date(2026, 9, 27, 0, 30), 200)],
      (r) => r.gas,
    );
    const filled = pts.filter((p) => p.v !== null);
    expect(filled.map((p) => p.v)).toEqual([200, 100]);
  });
});

describe("formatWeekLabel", () => {
  it("shows day, short month and hour", () => {
    expect(formatWeekLabel(new Date(2026, 9, 29, 12, 0))).toBe("Oct 29 12:00");
  });
});

describe("computeSummary", () => {
  it("reduces min, max and mean", () => {
    const rows = [row(0, 100), row(5, 900), row(10, 200)];
    const s = computeSummary(rows, (r) => r.gas);
    expect(s.min).toBe(100);
    expect(s.max).toBe(900);
    expect(s.avg).toBe(400);
  });

  it("returns zeros for no rows", () => {
    expect(computeSummary([], (r) => r.gas)).toEqual({ min: 0, max: 0, avg: 0 });
  });
});
