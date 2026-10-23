/**
 * Structural guards for Shekk's responsive shell: Shekk screens adapt to the device, mini-apps keep
 * the phone column, and the main tabs are laid out for a desktop rather than stretched.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), "utf8").replace(/\r\n/g, "\n");
const code = (rel: string) =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const SHELL = code("src/components/AppShell.tsx");

describe("the shell's three layouts", () => {
  it("knows phone, column and grid", () => {
    expect(SHELL).toMatch(/export type ShellLayout = "phone" \| "column" \| "grid"/);
  });

  it("Shekk screens default to the adaptive column; everything else keeps the phone column", () => {
    expect(SHELL).toMatch(/layout \?\? \(isTabRoot \? "column" : "phone"\)/);
  });

  it("the adaptive layouts drop the phone bezel and are fluid on a tablet", () => {
    expect(SHELL).toContain("sm:max-w-[720px]");
    // fluid bottom bar and menu on tablet, the phone-width ones only in phone mode
    expect(SHELL).toMatch(/fixed inset-x-0 bottom-0 z-30/);
    expect(SHELL).toMatch(/fluid/);
  });

  it("a grid screen gets the wide desktop canvas, a column screen a centred column", () => {
    expect(SHELL).toContain("lg:max-w-[1240px]");
    expect(SHELL).toContain("lg:max-w-[760px]");
  });
});

describe("the main tabs are laid out for a desktop", () => {
  const TABS: [string, string][] = [
    ["src/routes/index.tsx", "Today"],
    ["src/routes/whats-on.index.tsx", "What's on"],
    ["src/routes/israel.tsx", "Explore"],
    ["src/routes/me.tsx", "You"],
    ["src/routes/programme.tsx", "Programme"],
  ];

  it.each(TABS)("%s (%s) opts into the grid layout", (file) => {
    expect(code(file)).toContain('<AppShell layout="grid">');
  });

  it("What's on keeps its filters in a panel beside the list on a desktop", () => {
    const wo = code("src/routes/whats-on.index.tsx");
    expect(wo).toMatch(/lg:grid-cols-\[19rem_minmax\(0,1fr\)\]/);
    expect(wo).toMatch(/hidden lg:block/); // the filters panel is always open at lg
  });

  it("Programme Today keeps the phone order but splits into two columns on a desktop", () => {
    const today = code("src/routes/programme.index.tsx");
    expect(today).toMatch(/contents lg:col-span-7 lg:block/);
    expect(today).toMatch(/contents lg:col-span-5 lg:block/);
    expect(today).toContain("order-2"); // "You need to" stays near the top on a phone
  });
});

describe("phone details", () => {
  it("search fields are 16px on a phone so iOS doesn't zoom the page", () => {
    expect(code("src/routes/whats-on.index.tsx")).toMatch(/text-base[^"]*sm:text-sm/);
    expect(code("src/routes/israel.tsx")).toMatch(/text-base[^"]*sm:text-sm/);
  });

  it("the hover lift on tappable cards is gentle enough for a full-width desktop card", () => {
    expect(read("src/styles.css")).toMatch(/scale\(1\.012\)/);
  });
});
