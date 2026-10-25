import { describe, expect, it } from "vitest";
import {
  fanLabel,
  formatClock,
  formatGas,
  formatHum,
  formatTemp,
  formatTime,
  isNight,
  statusForGas,
} from "@/lib/air";

describe("statusForGas", () => {
  it("classifies at the firmware calibration boundaries", () => {
    expect(statusForGas(0)).toBe("BAIK");
    expect(statusForGas(499)).toBe("BAIK");
    expect(statusForGas(500)).toBe("SEDANG");
    expect(statusForGas(1999)).toBe("SEDANG");
    expect(statusForGas(2000)).toBe("BURUK");
    expect(statusForGas(4095)).toBe("BURUK");
  });
});

describe("isNight", () => {
  it("reads high LDR values as night (module reads high in the dark)", () => {
    expect(isNight(3500)).toBe(false);
    expect(isNight(3501)).toBe(true);
    expect(isNight(4095)).toBe(true);
  });
});

describe("fanLabel", () => {
  it("maps the 0/1 actuator field to words", () => {
    expect(fanLabel(1)).toBe("ON");
    expect(fanLabel(0)).toBe("OFF");
  });
});

describe("formatters", () => {
  it("formats gas as a grouped integer", () => {
    expect(formatGas(2778)).toBe("2,778");
    expect(formatGas(98)).toBe("98");
  });

  it("keeps one decimal for temperature and humidity", () => {
    expect(formatTemp(31.44)).toBe("31.4");
    expect(formatTemp(31.46)).toBe("31.5");
    expect(formatHum(63)).toBe("63.0");
  });

  it("formats time-of-day from a local date", () => {
    expect(formatTime(new Date(2026, 9, 25, 14, 32))).toBe("14:32");
    expect(formatClock(new Date(2026, 9, 25, 14, 32, 5))).toBe("14:32:05");
  });
});
