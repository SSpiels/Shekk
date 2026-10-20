/**
 * Structural guards for the open (no sign-in) endpoints. They read the source so
 * a later change cannot quietly remove a limit or bring back a leak.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), "utf8").replace(/\r\n/g, "\n");
const code = (rel: string) =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

/** The source of one exported server function. */
function fnBlock(rel: string, name: string): string {
  const source = code(rel);
  const start = source.indexOf(`export const ${name} =`);
  expect(start, `${name} not found in ${rel}`).toBeGreaterThan(-1);
  const next = source.indexOf("\nexport const ", start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

describe("live lookups", () => {
  it("go through the cached, budgeted wrappers and never reach upstream directly", () => {
    const live = code("src/lib/live.functions.ts");
    expect(live).toMatch(/guardedWeather/);
    expect(live).toMatch(/guardedJewish/);
    expect(live).toMatch(/guardedPlaceName/);
    expect(live).not.toMatch(/fetchWeather|fetchJewish|fetchPlaceName/);
  });

  it("rounds coordinates and caches, so nearby callers share one upstream call", () => {
    const g = code("src/lib/live-guarded.server.ts");
    expect(g.match(/roundTo\(/g)!.length).toBeGreaterThanOrEqual(6);
    expect(g).toMatch(/new TtlCache/);
    expect(g).toMatch(/bucket:\s*"geocode"/);
    expect(g).toMatch(/bucket:\s*"weather"/);
    expect(g).toMatch(/bucket:\s*"jewish"/);
  });

  it("a refused place-name lookup returns no name (the app keeps the nearest city) instead of an error", () => {
    expect(code("src/lib/live-guarded.server.ts")).toMatch(/onRefused:\s*\(\)\s*=>\s*null/);
  });
});

describe("anything that tries a code is counted, and fails closed", () => {
  const cases: [string, string][] = [
    ["src/lib/programme-ops.functions.ts", "programmeCodePreview"],
    ["src/lib/programme-ops.functions.ts", "programmeJoin"],
    ["src/lib/programme-ops.functions.ts", "programmeAcceptInvite"],
    ["src/lib/programme.functions.ts", "previewProgrammeCode"],
    ["src/lib/programme.functions.ts", "joinProgrammeWithCode"],
  ];
  for (const [file, name] of cases) {
    it(`${name} takes the attempt budget before touching any code`, () => {
      const block = fnBlock(file, name);
      expect(block).toContain('assertOpenBudget("codepreview")');
      // the budget must come BEFORE the lookup it protects
      const budget = block.indexOf("assertOpenBudget");
      const lookup = block.search(/previewJoinCode|previewInvite|previewCode|joinWithCode|acceptInvite/);
      expect(budget).toBeLessThan(lookup);
    });
  }

  it("the join-code preview no longer returns the cohort's internal id", () => {
    const server = code("src/lib/programme-ops.server.ts");
    const type = server.slice(server.indexOf("export type JoinPreview"), server.indexOf("};", server.indexOf("export type JoinPreview")));
    expect(type).not.toMatch(/cohortId/);
    const fn = server.slice(server.indexOf("export async function previewJoinCode"));
    expect(fn.slice(0, fn.indexOf("\n}\n"))).not.toMatch(/cohortId/);
  });

  it("the member preview calls the database with the server client, not the member's own", () => {
    const server = code("src/lib/programme.server.ts");
    const fn = server.slice(server.indexOf("export async function previewCode"));
    const body = fn.slice(0, fn.indexOf("\n}\n"));
    expect(body).toContain("supabaseAdmin");
    expect(body).not.toMatch(/previewCode\(db/);
  });
});

describe("eSIM writes that work signed out", () => {
  it("are capped per caller", () => {
    expect(fnBlock("src/lib/sim.functions.ts", "submitSimAnswers")).toContain('assertOpenBudget("simanswers")');
    expect(fnBlock("src/lib/sim.functions.ts", "startSimHandoff")).toContain('assertOpenBudget("simhandoff")');
  });
});

describe("the guard itself", () => {
  it("never stores or logs a raw network address", () => {
    const g = code("src/lib/open-endpoints.server.ts");
    expect(g).toMatch(/createHash\("sha256"\)/);
    expect(g).not.toMatch(/console\.(log|error)\([^)]*\bip\b/);
  });
});
