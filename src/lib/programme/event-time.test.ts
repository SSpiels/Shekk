import { changeLine } from "./logic";
import { afterEach, describe, expect, it } from "vitest";
import {
  fmtDateOnly,
  israelLocalInputToIso,
  israelResolutionForInstant,
  israelTimeCandidates,
  isoToIsraelLocalInput,
  parseDateOnly,
} from "./logic";
import {
  instantMs,
  resolveEventTime,
  sameEventValue,
  validateEventInterval,
  validateEventTime,
} from "./event-time";

const originalTz = process.env.TZ;
afterEach(() => {
  process.env.TZ = originalTz;
});

describe.each(["Europe/London", "America/New_York", "Asia/Jerusalem"])(
  "strict scheduling from %s",
  (tz) => {
    it("rejects the reproduced spring gap without normalising to 03:30", () => {
      process.env.TZ = tz;
      expect(israelTimeCandidates("2026-03-27T02:30")).toEqual([]);
      expect(() => israelLocalInputToIso("2026-03-27T02:30")).toThrow("does not exist");
      expect(() => israelLocalInputToIso("2026-03-27T02:30", "later")).toThrow();
      expect(isoToIsraelLocalInput(israelLocalInputToIso("2026-03-27T03:00"))).toBe(
        "2026-03-27T03:00",
      );
    });
    it("requires an explicit autumn occurrence and shows both offsets", () => {
      process.env.TZ = tz;
      expect(israelTimeCandidates("2026-10-25T01:30")).toEqual([
        { iso: "2026-10-24T22:30:00.000Z", offset: "UTC+03:00" },
        { iso: "2026-10-24T23:30:00.000Z", offset: "UTC+02:00" },
      ]);
      expect(() => israelLocalInputToIso("2026-10-25T01:30")).toThrow("twice");
      for (const resolution of ["earlier", "later"] as const) {
        const iso = israelLocalInputToIso("2026-10-25T01:30", resolution);
        expect(isoToIsraelLocalInput(iso)).toBe("2026-10-25T01:30");
        expect(israelResolutionForInstant(iso)).toBe(resolution);
        expect(validateEventTime(iso, { value: "2026-10-25T01:30", resolution })).toBe(iso);
      }
    });
    it("keeps date-only values on their calendar date, including leap days", () => {
      process.env.TZ = tz;
      expect(fmtDateOnly("2026-09-10")).toBe("Thu 10 Sept");
      expect(fmtDateOnly("2026-01-01")).toBe("Thu 1 Jan");
      expect(fmtDateOnly("2028-02-29")).toBe("Tue 29 Feb");
    });
    it("round-trips create/edit in summer and winter without losing untouched precision", () => {
      process.env.TZ = tz;
      for (const iso of [
        "2026-09-10T15:00:42.123Z",
        "2026-01-10T16:00:42.123+00:00",
        "2026-10-24T22:30:42.123456+00:00",
        "2026-10-24T23:30:42.123Z",
      ]) {
        const local = {
          value: isoToIsraelLocalInput(iso),
          resolution: israelResolutionForInstant(iso),
        };
        expect(resolveEventTime(local, iso)).toBe(iso);
        expect(validateEventTime(iso, local, iso)).toBe(iso);
        const created = resolveEventTime(local);
        expect(isoToIsraelLocalInput(created)).toBe(local.value);
      }
    });
  },
);

it.each([
  "2026-02-30",
  "2026-02-29",
  "2026-13-01",
  "2026-00-10",
  "2026-09-00",
  "2026-9-10",
  "nonsense",
])("rejects invalid calendar date %s", (value) => {
  expect(() => parseDateOnly(value)).toThrow();
  expect(() => israelLocalInputToIso(value + "T12:00")).toThrow();
});
it.each(["2026-09-10T24:00", "2026-09-10T12:60", "2026-09-10", ""])(
  "rejects malformed local time %s",
  (value) => {
    expect(() => israelLocalInputToIso(value)).toThrow();
  },
);
it("validates server submissions against local time and choice", () => {
  expect(() => validateEventTime("2026-03-27T00:30:00Z", { value: "2026-03-27T02:30" })).toThrow();
  expect(() => validateEventTime("2026-10-24T23:30:00Z", { value: "2026-10-25T01:30" })).toThrow();
  expect(() =>
    validateEventTime("2026-10-24T23:30:00Z", {
      value: "2026-10-25T01:30",
      resolution: "earlier",
    }),
  ).toThrow("does not match");
  expect(
    resolveEventTime(
      { value: "2026-10-25T01:30", resolution: "later" },
      "2026-10-24T22:30:42.123Z",
    ),
  ).toBe("2026-10-24T23:30:00.000Z");
});
it("compares instants and nulls semantically", () => {
  expect(sameEventValue("starts_at", "2026-09-10T15:00:00Z", "2026-09-10T15:00:00.000+00:00")).toBe(
    true,
  );
  expect(sameEventValue("starts_at", "2026-09-10T15:00:00Z", "2026-09-10T18:00:00+03:00")).toBe(
    true,
  );
  expect(sameEventValue("ends_at", null, null)).toBe(true);
  expect(sameEventValue("ends_at", null, "2026-09-10T15:00:00Z")).toBe(false);
  expect(sameEventValue("starts_at", "2026-09-10T15:00:00Z", "2026-09-10T15:00:00.001Z")).toBe(
    false,
  );
});
it("rejects invalid instants and reversed/equal intervals", () => {
  for (const iso of ["2026-02-30T12:00:00Z", "2026-09-10T24:00:00Z", "2026-09-10T12:00:00", "bad"])
    expect(() => instantMs(iso)).toThrow();
  expect(() => validateEventInterval("2026-09-10T15:00:00Z", "2026-09-10T15:00:00Z")).toThrow();
  expect(() => validateEventInterval("2026-09-10T15:00:00Z", "2026-09-10T14:00:00Z")).toThrow();
  expect(() => validateEventInterval("2026-09-10T15:00:00Z", null)).not.toThrow();
});

it("does not collapse a real microsecond change into a no-op", () => {
  expect(
    sameEventValue("starts_at", "2026-09-10T15:00:42.123456Z", "2026-09-10T15:00:42.123457+00:00"),
  ).toBe(false);
  expect(
    sameEventValue("starts_at", "2026-09-10T15:00:42.123456Z", "2026-09-10T18:00:42.123456+03:00"),
  ).toBe(true);
});

it("labels a real repeated-hour time change with both offsets", () => {
  expect(
    changeLine({
      field: "starts_at",
      before: "2026-10-24T22:30:00Z",
      after: "2026-10-24T23:30:00Z",
    }),
  ).toBe("Delayed 1 hour · 01:30 (UTC+03:00) → 01:30 (UTC+02:00)");
});
