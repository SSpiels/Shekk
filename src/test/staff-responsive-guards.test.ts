/**
 * Structural guards for Programme OS as the one staff surface on every device: the old
 * phone-only staff tools hand off to it, the new reads are permission-checked on the server,
 * and each screen has a layout for a phone rather than a squeezed desktop one.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), "utf8").replace(/\r\n/g, "\n");
const code = (rel: string) =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
const fnBody = (source: string, header: string) => {
  const start = source.indexOf(header);
  expect(start, `${header} not found`).toBeGreaterThan(-1);
  const next = source.indexOf("\nexport ", start + header.length);
  return source.slice(start, next === -1 ? undefined : next);
};

describe("one staff surface, so switching works for everyone", () => {
  it("the old phone-only staff route hands off to Programme OS", () => {
    const route = code("src/routes/programme.staff.tsx");
    expect(route).toContain("redirect(");
    expect(route).toContain("/staff/overview");
    // It must not read the member's student hub any more.
    expect(route).not.toContain("useProgrammeHub");
  });

  it("the Programme tab offers Programme OS from the account's own staff workspaces", () => {
    const tab = code("src/routes/programme.tsx");
    expect(tab).toContain("useWorkspace()");
    expect(tab).toContain("/staff/overview");
    expect(tab).not.toMatch(/to="\/programme\/staff"/);
    // never the student hub's idea of "staff"
    expect(tab).toContain("isStaffAnywhere");
    expect(tab).not.toMatch(/hub\.staff/);
    expect(tab).not.toMatch(/\{[^}]*\bisStaff\b[^}]*\}\s*=\s*useProgrammeHub/);
  });

  it("no link still points at the retired route", () => {
    for (const f of ["src/routes/admin/programmes.tsx", "src/routes/programme.tsx"]) {
      expect(code(f), f).not.toMatch(/to="\/programme\/staff"/);
    }
  });
});

describe("the new Programme OS reads", () => {
  const server = code("src/lib/programme-ops.server.ts");

  it("polls are only readable by staff who may run votes, on the cohort they proved they staff", () => {
    const fn = fnBody(server, "export async function staffPollsOverview");
    expect(fn).toMatch(/requireStaff\(db, userId, cohortId, "votes"\)/);
    expect(fn.indexOf("requireStaff")).toBeLessThan(fn.indexOf('from("programme_votes")'));
    expect(fn).toMatch(/\.eq\("cohort_id", cohortId\)/);
  });

  it("groups are only readable by staff who may manage groups", () => {
    const fn = fnBody(server, "export async function staffGroupsOverview");
    expect(fn).toMatch(/requireStaff\(db, userId, cohortId, "groups"\)/);
    expect(fn.indexOf("requireStaff")).toBeLessThan(fn.indexOf('from("programme_groups")'));
  });

  it("both are server functions behind sign-in with a validated cohort id", () => {
    const fns = code("src/lib/programme-ops.functions.ts");
    for (const name of ["staffPollsOverview", "staffGroupsOverview"]) {
      const block = fnBody(fns, `export const ${name}`);
      expect(block, name).toContain("requireSupabaseAuth");
      expect(block, name).toMatch(/cohortId: uuid/);
    }
  });
});

describe("a layout for each device", () => {
  it("the shell has the phone chrome, the tablet rail and the desktop sidebar", () => {
    const shell = code("src/components/staff/ProgrammeOSShell.tsx");
    expect(shell).toContain("<StaffBottomNav />");
    expect(shell).toContain("<StaffTopBar />");
    expect(shell).toContain("<StaffSidebar />");
    const chrome = code("src/components/staff/StaffMobileChrome.tsx");
    expect(chrome).toMatch(/md:hidden/);
    const sidebar = code("src/components/staff/StaffSidebar.tsx");
    expect(sidebar).toMatch(/hidden[^"]*md:flex/);
    expect(sidebar).toMatch(/lg:w-64/);
  });

  it("everyday creation is reachable from every page", () => {
    const shell = code("src/components/staff/ProgrammeOSShell.tsx");
    expect(shell).toContain('<StaffQuickCreate variant="button" />');
    expect(shell).toContain('<StaffQuickCreate variant="fab" />');
  });

  it("rosters are cards on a phone and tables from tablet up", () => {
    for (const f of [
      "src/components/staff/students/StaffStudentTable.tsx",
      "src/components/staff/onboarding/StaffOnboardingTable.tsx",
    ]) {
      const source = code(f);
      expect(source, f).toMatch(/md:hidden/);
      expect(source, f).toMatch(/hidden[^"]*md:block/);
    }
  });

  it("dialogs become bottom sheets on a phone", () => {
    expect(code("src/components/ui/dialog.tsx")).toMatch(/max-sm:bottom-0/);
  });

  it("form fields are 16px on a phone so iOS doesn't zoom the page", () => {
    expect(read("src/styles.css")).toMatch(/\.os-root input[\s\S]*font-size: 16px/);
  });

  it("times on the Overview are Israel time, not the viewer's", () => {
    const overview = code("src/routes/staff/overview.tsx");
    expect(overview).toContain("fmtIsraelTime");
    expect(overview).not.toMatch(/toLocaleTimeString/);
  });
});
