/**
 * Application-level regression tests for the two P0 security fixes.
 *
 * The database tests (src/test/db) prove what the database refuses. These cover
 * the application side: the server-side money switch, and structural checks
 * that stop a future change from quietly reintroducing a client-callable credit
 * or an ungated money-moving function, or from putting membership writes back
 * on the member's own database client.
 */

import { afterEach, describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { MONEY_DISABLED_MESSAGE, assertMoneyEnabled, moneyEnabledOnServer } from "@/lib/money-gate.server";

const SRC = join(process.cwd(), "src");

function sourceFiles(dir = SRC): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "test" ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

const lf = (s: string) => s.split("\r\n").join("\n");
const read = (rel: string) => lf(readFileSync(join(SRC, rel), "utf8"));

/** The text of one `export const name = createServerFn(...)...;` block. */
function serverFnBlocks(file: string): Array<{ name: string; text: string }> {
  const text = lf(readFileSync(file, "utf8"));
  const starts = [...text.matchAll(/^export const (\w+) = createServerFn/gm)];
  return starts.map((m, i) => ({
    name: m[1],
    text: text.slice(m.index, i + 1 < starts.length ? starts[i + 1].index : text.length),
  }));
}

const original = process.env.MONEY_ENABLED;
afterEach(() => {
  if (original === undefined) delete process.env.MONEY_ENABLED;
  else process.env.MONEY_ENABLED = original;
});

describe("server-side money switch", () => {
  it("is off unless MONEY_ENABLED is exactly 'true'", () => {
    delete process.env.MONEY_ENABLED;
    expect(moneyEnabledOnServer()).toBe(false);
    for (const value of ["", "false", "0", "1", "TRUE", "yes", " true"]) {
      process.env.MONEY_ENABLED = value;
      expect(moneyEnabledOnServer(), `value ${JSON.stringify(value)}`).toBe(false);
    }
    process.env.MONEY_ENABLED = "true";
    expect(moneyEnabledOnServer()).toBe(true);
  });

  it("refuses with a friendly message while off and allows while on", () => {
    delete process.env.MONEY_ENABLED;
    expect(() => assertMoneyEnabled()).toThrow(MONEY_DISABLED_MESSAGE);
    process.env.MONEY_ENABLED = "true";
    expect(() => assertMoneyEnabled()).not.toThrow();
  });

  it("is not exposed to the browser (no VITE_ variant is read)", () => {
    expect(read("lib/money-gate.server.ts")).not.toMatch(/import\.meta\.env|process\.env\.VITE_/);
  });
});

describe("no client-callable way to create money", () => {
  it("has no receiveMoney function or client 'receive' anywhere in the app", () => {
    const offenders = sourceFiles()
      .filter((f) => /receiveMoney/.test(readFileSync(f, "utf8")))
      .map((f) => relative(SRC, f));
    expect(offenders).toEqual([]);
    expect(read("lib/store.tsx")).not.toMatch(/^\s*receive:/m);
  });

  it("the application's ledger post() can only express a debit", () => {
    const ledger = read("lib/ledger.server.ts");
    const postInput = ledger.match(/export type PostInput = \{[\s\S]*?\n\};/)?.[0] ?? "";
    expect(postInput).toMatch(/direction:\s*"debit";/);
    expect(postInput).not.toMatch(/"credit"/);
  });

  it("only the two verified routines credit: no app code calls ledger_post with a credit", () => {
    const offenders = sourceFiles()
      .filter((f) => {
        const text = readFileSync(f, "utf8");
        return /rpc\(\s*"ledger_post"/.test(text) && /"credit"/.test(text.slice(text.indexOf('rpc("ledger_post"')));
      })
      .map((f) => relative(SRC, f));
    expect(offenders).toEqual([]);
  });
});

describe("every money-moving server function is gated", () => {
  const MOVES_MONEY = /\b(post|createHold|settleHold|sendToMember|paySplitShare|createPaymentIntent|createCard)\(|checkout\.sessions\./;
  const EXPECTED_GATED = [
    ["ledger.functions.ts", "spendMoney"],
    ["ledger.functions.ts", "holdMoney"],
    ["ledger.functions.ts", "settleHoldFn"],
    ["social.functions.ts", "sendToFriend"],
    ["social.functions.ts", "paySplit"],
    ["airwallex.functions.ts", "startTopUp"],
    ["airwallex.functions.ts", "issueCard"],
    ["payments.functions.ts", "createMembershipCheckout"],
  ] as const;

  it("gates each known money function", () => {
    for (const [file, name] of EXPECTED_GATED) {
      const block = serverFnBlocks(join(SRC, "lib", file)).find((b) => b.name === name);
      expect(block, `${file} ${name} should exist`).toBeDefined();
      expect(block!.text, `${file} ${name} must check the server-side switch`).toMatch(/money-gate\.server/);
    }
  });

  it("catches any NEW function that moves money without the gate", () => {
    const ungated: string[] = [];
    for (const file of sourceFiles().filter((f) => f.endsWith(".functions.ts"))) {
      for (const block of serverFnBlocks(file)) {
        if (MOVES_MONEY.test(block.text) && !/money-gate\.server/.test(block.text)) {
          ungated.push(`${relative(SRC, file).split(sep).join("/")} :: ${block.name}`);
        }
      }
    }
    expect(ungated).toEqual([]);
  });
});

describe("membership writes are server actions, not member-client writes", () => {
  for (const file of ["lib/programme.server.ts", "lib/programme-ops.server.ts"]) {
    it(`${file}: leaveProgramme uses the service role, never the caller's client`, () => {
      const text = read(file);
      const start = text.indexOf("export async function leaveProgramme");
      expect(start, "leaveProgramme should exist").toBeGreaterThan(-1);
      const body = text.slice(start, text.indexOf("\n}\n", start));
      expect(body).toMatch(/supabaseAdmin|adminDb\(\)/);
      expect(body).not.toMatch(/\bdb\s*\.from\("programme_memberships"\)/);
      expect(body).toMatch(/\.eq\("user_id", userId\)/);
      expect(body).toMatch(/\.eq\("status", "active"\)/);
    });
  }
});

describe("the migrations that enforce this exist", () => {
  const migrations = readdirSync(join(process.cwd(), "supabase", "migrations"));
  it("ships the ledger lockdown and the membership guards", () => {
    expect(migrations.some((f) => f.endsWith("_ledger_credit_lockdown.sql"))).toBe(true);
    expect(migrations.some((f) => f.endsWith("_programme_membership_guards.sql"))).toBe(true);
  });
});
