import { describe, expect, it } from "vitest";
import {
  BUCKET_MS,
  computeSummary,
  formatWeekTip,
  windowSeries,
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

/** The current 5-minute bucket start — the same anchor `windowSeries` uses. */
function anchor(): Date {
  const a = new Date();
  a.setMinutes(a.getMinutes() - (a.getMinutes() % 5), 0, 0);
  return a;
}

/** Minutes from the current bucket start; positive minutes sit in the last bucket. */
function fromAnchor(min: number): Date {
  return new Date(+anchor() + min * 60_000);
}

describe("windowSeries", () => {
  it("returns nothing for empty rows", () => {
    expect(windowSeries([], (r) => r.gas)).toEqual([]);
  });

  it("returns 36 points spaced 5 min, anchored on the current 5-minute mark", () => {
    const pts = windowSeries([rowAt(new Date(), 100)], (r) => r.gas);
    expect(pts.length).toBe(36);
    expect(pts[35].t).toBe(+anchor());
    expect(pts[35].t - pts[34].t).toBe(BUCKET_MS);
    expect(pts[0].t).toBe(pts[35].t - 35 * BUCKET_MS);
    expect(pts[35].v).toBe(100);
  });

  it("averages rows sharing a bucket, whatever the input order", () => {
    const pts = windowSeries(
      [
        rowAt(fromAnchor(1), 100),
        rowAt(fromAnchor(3), 300),
        rowAt(fromAnchor(-13), 900),
      ],
      (r) => r.gas,
    );
    expect(pts[35].v).toBe(200);
    expect(pts[32].v).toBe(900);
  });

  it("leaves empty buckets as null gaps", () => {
    const pts = windowSeries(
      [rowAt(fromAnchor(1), 100), rowAt(fromAnchor(-90), 200)],
      (r) => r.gas,
    );
    const filled = pts.filter((p) => p.v !== null);
    expect(filled.map((p) => p.v)).toEqual([200, 100]);
  });

  it("keeps the window on now: rows older than 3 hours clamp into bucket 0", () => {
    const pts = windowSeries([rowAt(new Date(Date.now() - 10 * 60 * 60_000), 100)], (r) => r.gas);
    expect(pts[0].v).toBe(100);
    expect(pts.slice(1).every((p) => p.v === null)).toBe(true);
    expect(pts[35].t).toBe(+anchor());
  });
});

describe("formatWeekTip", () => {
  it("adds the date for the hover tooltip", () => {
    expect(formatWeekTip(new Date(2026, 9, 29, 12, 0))).toBe("Oct 29, 12:00");
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
