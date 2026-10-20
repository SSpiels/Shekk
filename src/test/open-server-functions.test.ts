/**
 * Which server functions can be called by anyone on the internet.
 *
 * Every server function is a public HTTP endpoint. Unless it uses the sign-in
 * middleware, a stranger can call it directly, bypassing the app. This test pins
 * the exact set that is deliberately open, so a NEW unauthenticated function
 * cannot slip in unnoticed: adding one means adding it here, on purpose, with a
 * reason.
 */

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

function openFunctions(): string[] {
  const out: string[] = [];
  const files = walk(resolve(process.cwd(), "src")).filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.(ts|tsx)$/.test(f));
  for (const f of files) {
    const source = readFileSync(f, "utf8").replace(/\r\n/g, "\n");
    for (const block of source.split(/\nexport const /).slice(1)) {
      if (!block.includes("createServerFn")) continue;
      const name = block.split(/[ =]/)[0]!;
      const handler = block.indexOf(".handler");
      const before = handler > 0 ? block.slice(0, handler) : block.slice(0, 700);
      if (!/requireSupabaseAuth/.test(before)) out.push(name);
    }
  }
  return out.sort();
}

/** Deliberately open, each with the reason it is safe (or the follow-up it needs). */
const ALLOWED_OPEN = [
  "airwallexStatus", // a yes/no flag
  "getIsraelNews", // public news headlines
  "getJewishToday", // public Hebcal calendar data
  "getPlaceName", // reverse geocoding for the location bar — follow-up: throttle + cache
  "getSimPlan", // public eSIM plan details
  "getWeather", // public weather — follow-up: throttle + cache
  "gettStatusFn", // a yes/no flag
  "listSimPlans", // public eSIM catalogue
  "liveFxRate", // public reference rate, returns nothing when unconfigured
  "placesStatus", // a yes/no flag; never calls Google
  "programmeCodePreview", // join-code lookup before sign-up — follow-up: stop leaking the cohort id, throttle
  "startSimHandoff", // affiliate hand-off — follow-up: throttle
  "submitSimAnswers", // eSIM questionnaire — follow-up: throttle
].sort();

describe("server functions open to anyone", () => {
  it("are exactly the ones deliberately left open", () => {
    expect(openFunctions()).toEqual(ALLOWED_OPEN);
  });

  it("never include anything that books, pays, or spends", () => {
    const open = openFunctions();
    for (const name of open) expect(name, name).not.toMatch(/book|cancel|pay|checkout|topup|transfer|send|issue|hold|spend|settle/i);
  });

  it("require sign-in for the Gett ride functions", () => {
    const open = openFunctions();
    for (const name of ["estimateRide", "bookRide", "rideStatus", "cancelRide", "searchPlaces"]) {
      expect(open, name).not.toContain(name);
    }
  });
});
