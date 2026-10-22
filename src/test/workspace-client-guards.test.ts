/**
 * Structural guards for the dual-experience UI: where the switcher lives, that
 * landing is decided in one place, and that nothing the browser says can grant
 * access.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), "utf8").replace(/\r\n/g, "\n");
const code = (rel: string) =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

describe("the switcher is where the member expects it", () => {
  it("the You screen shows the workspace card", () => {
    expect(code("src/routes/me.tsx")).toContain("<WorkspaceCard />");
  });

  it("the staff sidebar and the small-screen nav both carry the switcher", () => {
    expect(code("src/components/staff/StaffSidebar.tsx")).toContain('<WorkspaceMenu variant="card" />');
    expect(code("src/components/staff/StaffMobileNav.tsx")).toContain('<WorkspaceMenu variant="pill" />');
  });

  it("'Back to Shekk' is a real switch that remembers the choice, not just a link", () => {
    const sidebar = code("src/components/staff/StaffSidebar.tsx");
    expect(sidebar).toContain("openPersonal");
    expect(sidebar).not.toMatch(/Back to Shekk/);
  });

  it("only workspaces the server returned are ever offered", () => {
    for (const f of ["src/components/workspace/WorkspaceMenu.tsx", "src/components/workspace/WorkspaceCard.tsx"]) {
      const source = code(f);
      expect(source, f).toContain("useWorkspace()");
      expect(source, f).not.toMatch(/programmeId:\s*["'`]/); // never a hard-coded programme
    }
  });
});

describe("opening in the last-used experience", () => {
  it("the home screen runs the landing decision, and holds back its own content while it decides", () => {
    const home = code("src/routes/index.tsx");
    expect(home).toContain("useWorkspaceLanding()");
    expect(home).toMatch(/!ready \|\| landing\.pending/);
  });

  it("the decision itself is the shared, tested rule — the default for anyone new is personal", () => {
    const hook = code("src/lib/useWorkspaceLanding.ts");
    expect(hook).toContain("decideLanding(prefs, workspaces)");
    expect(code("src/lib/workspace.ts")).toMatch(/if \(prefs\.lastExperience !== "staff"\) return \{ experience: "personal" \}/);
  });

  it("only a session that OPENS on the home screen is redirected", () => {
    const session = code("src/lib/landing-session.ts");
    expect(session).toMatch(/window\.location\.pathname !== "\/"\) markLanded\(\)/);
    expect(code("src/routes/__root.tsx")).toContain('import "@/lib/landing-session"');
  });

  it("entering the portal counts as landing, and remembers the workspace in use", () => {
    const gate = code("src/routes/staff/route.tsx");
    expect(gate).toContain("markLanded()");
    expect(gate).toMatch(/remember\(\{ experience: "staff", programmeId: session\.activeProgrammeId \}\)/);
  });

  it("removed access falls back to the personal app with a one-time notice", () => {
    const gate = code("src/routes/staff/route.tsx");
    expect(gate).toContain("setNotice(");
    expect(gate).toMatch(/navigate\(\{ to: "\/", replace: true \}\)/);
    expect(code("src/routes/index.tsx")).toContain("takeNotice()");
  });
});

describe("nothing the browser says can grant access", () => {
  it("the client only ever asks the server to REMEMBER a switch", () => {
    const hook = code("src/lib/useWorkspace.ts");
    expect(hook).toContain("saveWorkspace");
    expect(hook).not.toMatch(/programme_staff|from\("/);
  });

  it("ticking 'I work for a programme' saves a hint and routes to the invite entry — nothing else", () => {
    const auth = code("src/routes/auth.tsx");
    expect(auth).toContain("saveStaffIntent");
    expect(auth).toMatch(/to: "\/staff-login"/);
    // the hint helper can't touch roles
    const intent = code("src/lib/staff-intent.ts");
    expect(intent).not.toMatch(/staff_role|programme_staff|role/i);
  });

  it("accepting an invite refreshes the member's staff status and opens their workspace", () => {
    expect(code("src/lib/useProgrammeHub.ts")).toMatch(/invalidateQueries\(\{ queryKey: \["staff"\] \}\)/);
    expect(code("src/components/programme/Join.tsx")).toMatch(/navigate\(\{ to: "\/staff" \}\)/);
  });
});
