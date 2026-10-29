import { describe, expect, it } from "vitest";
import {
  BUCKET_MS,
  buildSeries,
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

describe("buildSeries", () => {
  it("returns nothing for empty rows", () => {
    expect(buildSeries([], (r) => r.gas)).toEqual([]);
  });

  it("sorts unsorted input ascending", () => {
    const pts = buildSeries([row(20, 300), row(0, 100), row(10, 200)], (r) => r.gas);
    const nonNull = pts.map((p) => p.v).filter((v) => v !== null);
    expect(nonNull).toEqual([100, 200, 300]);
  });

  it("caps the point count at maxPoints", () => {
    const rows = Array.from({ length: 600 }, (_, i) => row(i * 5, i));
    const pts = buildSeries(rows, (r) => r.gas, 150);
    expect(pts.length).toBeLessThanOrEqual(150);
  });

  it("averages rows that share a bucket", () => {
    // 25 s span, 3 buckets of 12.5 s: 0/5/10 s share bucket 0, 15/20 s bucket 1, 25 s (the
    // boundary) bucket 2.
    const rows = [row(0, 100), row(5, 200), row(10, 300), row(15, 400), row(20, 500), row(25, 600)];
    const pts = buildSeries(rows, (r) => r.gas, 3);
    expect(pts.length).toBe(3);
    expect(pts[0].v).toBe(200);
    expect(pts[1].v).toBe(450);
    expect(pts[2].v).toBe(600);
  });

  it("maps sparse data one row to one point — no invented gaps", () => {
    const rows = [row(0, 100), row(10, 200), row(20, 300), row(30, 400), row(40, 500)];
    const pts = buildSeries(rows, (r) => r.gas, 150);
    expect(pts.length).toBe(5);
    expect(pts.map((p) => p.v)).toEqual([100, 200, 300, 400, 500]);
  });

  it("leaves empty buckets as null gaps when dense data has a hole", () => {
    // 35 rows: 0–29 s continuous, a 30 s outage, then 60–64 s.
    const rows = [
      ...Array.from({ length: 30 }, (_, i) => row(i, 100 + i)),
      ...Array.from({ length: 5 }, (_, i) => row(60 + i, 400 + i)),
    ];
    const pts = buildSeries(rows, (r) => r.gas, 30);
    expect(pts.length).toBeLessThanOrEqual(30);
    expect(pts[0].v).not.toBeNull();
    expect(pts.at(-1)!.v).not.toBeNull();
    expect(pts.slice(1, -1).some((p) => p.v === null)).toBe(true);
  });
});

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
