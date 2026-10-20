/**
 * Structural guards for the Google cost controls. These read the source so a
 * future change cannot quietly route around the controls: a new paid call, a
 * server function with no sign-in, or a second file that talks to Google.
 */

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const lf = (s: string) => s.replace(/\r\n/g, "\n");
const read = (rel: string) => lf(readFileSync(resolve(process.cwd(), rel), "utf8"));
/** Source with comments removed, so prose that mentions a setting can't trip a check on the code. */
const code = (rel: string) =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const sourceFiles = () =>
  walk(resolve(process.cwd(), "src")).filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.(ts|tsx)$/.test(f));

describe("Google Places cost controls", () => {
  const functions = read("src/lib/places/places.functions.ts");
  const blocks = functions.split(/\nexport const /).slice(1);

  it("every server function except the status flag requires a signed-in member", () => {
    expect(blocks.length).toBeGreaterThan(5);
    for (const b of blocks) {
      const name = b.split(" ")[0];
      if (name === "placesStatus") continue;
      expect(b, `${name} must use requireSupabaseAuth`).toContain(".middleware([requireSupabaseAuth])");
    }
  });

  it("the status flag never calls Google", () => {
    const status = blocks.find((b) => b.startsWith("placesStatus"))!;
    expect(status).not.toMatch(/nearbyPlaces|searchPlaces|placeDetails|placePhoto|travelTo|takeBudget/);
  });

  it("every paid call in api.server.ts is made once, and only after its budget is taken", () => {
    const api = read("src/lib/places/api.server.ts");
    const pairs: [string, string][] = [
      ["nearbyRows(", 'takeBudget("nearby"'],
      ["searchRows(", 'takeBudget("text"'],
      ["detailRow(", 'takeBudget("details"'],
      ["photoUrl(", 'takeBudget("photos"'],
      ["travelLeg(", 'takeBudget("routes"'],
    ];
    for (const [call, budget] of pairs) {
      expect(api.split(call).length - 1, `${call} should be called exactly once`).toBe(1);
      expect(api.split(budget).length - 1, `${budget} should appear exactly once`).toBe(1);
      expect(api.indexOf(budget), `${budget} must come before ${call}`).toBeLessThan(api.indexOf(call));
    }
  });

  it("the browser map permit takes the maploads budget, and a map is only built after it", () => {
    expect(functions).toContain('takeBudget("maploads"');
    const canvas = read("src/components/GoogleMapCanvas.tsx");
    const permit = canvas.indexOf("await placesMapPermit()");
    expect(permit).toBeGreaterThan(-1);
    expect(permit).toBeLessThan(canvas.indexOf("new window.google!.maps.Map("));
  });

  it("only api.server.ts imports the Google gateway", () => {
    const offenders = sourceFiles()
      .filter((f) => !f.replace(/\\/g, "/").endsWith("src/lib/places/api.server.ts"))
      .filter((f) => /from ["'](\.\/|@\/lib\/places\/)google\.server["']/.test(lf(readFileSync(f, "utf8"))));
    expect(offenders).toEqual([]);
  });

  it("no other file builds a request to a Google Maps Platform host", () => {
    const offenders = sourceFiles()
      .filter((f) => !/(google\.server\.ts|GoogleMapCanvas\.tsx)$/.test(f))
      .filter((f) => /(places|routes|maps|geocode)\.googleapis\.com/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("the master switch is never turned on by anything committed to the repo", () => {
    for (const f of [".env", ".env.development", "vercel.json"]) {
      let text: string;
      try {
        text = read(f);
      } catch {
        continue;
      }
      expect(text, f).not.toMatch(/GOOGLE_PLACES_ENABLED\s*[=:]\s*"?true/);
    }
  });

  it("list cards do not load photos unless a screen explicitly asks", () => {
    expect(read("src/components/places/PlaceCard.tsx")).toMatch(/loadPhoto\s*=\s*false/);
    for (const f of ["src/routes/explore/fitness.discover.tsx", "src/routes/explore/maps.tsx"]) {
      expect(read(f), f).not.toMatch(/loadPhoto/);
    }
  });

  it("Google queries never refetch on their own and never retry", () => {
    const hooks = code("src/lib/places/usePlaces.ts");
    expect(hooks).toMatch(/refetchOnWindowFocus:\s*false/);
    expect(hooks).toMatch(/refetchOnReconnect:\s*false/);
    expect(hooks).toMatch(/retry:\s*false/);
    expect(hooks).not.toMatch(/refetchOnMount:\s*"always"/);
    expect(hooks).not.toMatch(/staleTime:\s*0/);
  });
});
