/**
 * A member's name and cached data belong to their ACCOUNT. These read the source
 * so a later change cannot quietly put a device-local copy back in front of a
 * signed-in member, or drop the clean-up when accounts change.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), "utf8").replace(/\r\n/g, "\n");
const code = (rel: string) =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

describe("whose name is shown", () => {
  it("screens that greet the member use the account's name, not the device copy", () => {
    for (const f of [
      "src/routes/index.tsx",
      "src/routes/me.tsx",
      "src/routes/card.tsx",
      "src/routes/wallet.tsx",
      "src/routes/reverify.tsx",
    ]) {
      const source = code(f);
      expect(source, f).toContain("useMemberName");
      expect(source, `${f} must not read the device-local name`).not.toMatch(/state\.name/);
    }
  });

  it("the name hook only falls back to the device copy for a signed-out visitor", () => {
    const hook = code("src/lib/useMemberName.ts");
    expect(hook).toMatch(/signedIn\s*\?\s*server\.full\s*:\s*usableName\(state\.name\)/);
  });
});

describe("account switching", () => {
  const store = code("src/lib/store.tsx");

  it("drops cached server data and device state when a different account signs in or the member signs out", () => {
    expect(store).toMatch(/queryClient\.clear\(\)/);
    expect(store).toMatch(/isDifferentAccount\(readLastUser\(\), userId\)\s*\|\|\s*\(wasIn && !isIn\)/);
  });

  it("keeps device preferences (theme, language) when it does", () => {
    expect(store).toMatch(/\{\s*\.\.\.initialState,\s*settings:\s*s\.settings\s*\}/);
  });
});

describe("default tags", () => {
  it("are seeded from the sign-in email rather than a generic word", () => {
    const social = code("src/lib/social.server.ts");
    expect(social).toMatch(/auth\.admin\.getUserById\(userId\)/);
  });
});
