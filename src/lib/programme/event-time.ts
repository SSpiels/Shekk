/** Shared scheduling boundary. No browser timezone, database or UI dependencies. */
import { israelLocalInputToIso, isoToIsraelLocalInput } from "./logic";
import type { IsraelTimeResolution } from "./logic";

export type LocalEventTime = {
  value: string;
  resolution?: IsraelTimeResolution;
};

/** Offset-bearing timestamps only; Date.parse alone normalises invalid dates. */
export function instantMs(value: string): number {
  const match =
    /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) throw new Error("Enter a valid timestamp with a UTC offset.");
  const [, date, hour, minute, second, , offset] = match;
  const day = new Date(`${date}T00:00:00Z`);
  if (
    !Number.isFinite(day.getTime()) ||
    day.toISOString().slice(0, 10) !== date ||
    Number(hour) > 23 ||
    Number(minute) > 59 ||
    Number(second) > 59 ||
    (offset !== "Z" && (Number(offset!.slice(1, 3)) > 23 || Number(offset!.slice(4)) > 59))
  ) {
    throw new Error("Enter a valid timestamp with a UTC offset.");
  }
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new Error("Enter a valid timestamp.");
  return ms;
}

/** Keep the stored instant (including precision) if this is the same displayed minute/occurrence. */
export function resolveEventTime(local: LocalEventTime, existing?: string | null): string {
  const resolved = israelLocalInputToIso(local.value, local.resolution);
  if (
    existing &&
    isoToIsraelLocalInput(existing) === local.value &&
    Math.floor(instantMs(existing) / 60_000) === instantMs(resolved) / 60_000
  )
    return existing;
  return resolved;
}

/** Postgres can retain microseconds. Do not collapse distinct stored instants to milliseconds. */
function instantMicros(value: string): bigint {
  const ms = instantMs(value);
  const fraction = /\.(\d+)(?:Z|[+-]\d{2}:\d{2})$/.exec(value)?.[1] ?? "";
  return BigInt(Math.floor(ms / 1000)) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
}

export function validateEventTime(
  instant: string,
  local?: LocalEventTime,
  existing?: string | null,
): string {
  instantMs(instant);
  if (local) {
    const resolved = resolveEventTime(local, existing);
    if (instantMicros(instant) !== instantMicros(resolved))
      throw new Error(
        "The submitted time does not match the selected Israel time. Refresh and try again.",
      );
    return resolved;
  }
  return instant;
}

export function validateEventInterval(startsAt: string, endsAt?: string | null): void {
  const start = instantMicros(startsAt);
  if (endsAt != null && instantMicros(endsAt) <= start)
    throw new Error("End time must be after start time.");
}

export function sameEventValue(column: string, before: unknown, after: unknown): boolean {
  if (before == null || after == null) return before == null && after == null;
  if (column === "starts_at" || column === "ends_at")
    return instantMicros(String(before)) === instantMicros(String(after));
  return before === after;
}
