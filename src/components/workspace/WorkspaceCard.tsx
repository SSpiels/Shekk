/**
 * The "switch experience" entry on the You screen.
 *
 * Staff see a card per programme workspace they have been added to, each one tap
 * from opening. Someone who said at sign-up that they work for a programme, but
 * hasn't been invited yet, sees where to enter their invite code. Everyone else
 * sees nothing — the personal app stays exactly as it was.
 */

import { Link } from "@tanstack/react-router";
import { Building2, ChevronRight, KeyRound, Loader2 } from "lucide-react";
import { Card } from "@/components/AppShell";
import { useWorkspace } from "@/lib/useWorkspace";

export function WorkspaceCard() {
  const { workspaces, isStaff, prefs, loading, openWorkspace, switching } = useWorkspace();
  if (loading) return null;

  if (isStaff) {
    return (
      <section aria-label="Your programme workspaces" className="space-y-2">
        <p className="px-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          Programme workspaces
        </p>
        <Card className="p-0">
          {workspaces.map((w, i) => (
            <button
              key={w.programmeId}
              type="button"
              disabled={switching}
              onClick={() => void openWorkspace(w.programmeId)}
              className={`tap flex w-full items-center gap-3 px-4 py-3.5 text-left disabled:opacity-60 ${
                i > 0 ? "border-t border-border" : ""
              }`}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <Building2 className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{w.programmeName}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  <span className="capitalize">{w.role}</span>
                  {w.cohort ? ` · ${w.cohort.name}` : ""}
                </span>
              </span>
              {switching ? (
                <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
              ) : (
                <span className="flex shrink-0 items-center gap-0.5 text-xs font-semibold text-primary">
                  Open <ChevronRight className="size-4" />
                </span>
              )}
            </button>
          ))}
        </Card>
        <p className="px-1 text-[11px] text-muted-foreground">
          You&rsquo;re in your personal Shekk. Open a workspace to run your programme — you can come back here any time,
          without signing out.
        </p>
      </section>
    );
  }

  if (prefs.staffIntent) {
    return (
      <Card className="space-y-2.5">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <KeyRound className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Programme staff?</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Staff access comes from an invitation sent by your programme&rsquo;s owner. Once you have your invite
              code, enter it and your workspace will appear here.
            </p>
          </div>
        </div>
        <Link
          to="/staff-login"
          search={{ next: "/", code: undefined }}
          className="tap flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Enter an invite code <ChevronRight className="size-4" />
        </Link>
      </Card>
    );
  }

  return null;
}
