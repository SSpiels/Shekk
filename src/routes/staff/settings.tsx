/**
 * Programme OS Settings: the smallest useful set of controls for a
 * pilot — the cohort's join code (view for any staff, rotate/open-close for
 * an owner, same bar as Team) and a read-only look at the identity fields
 * Shekk still manages centrally. Reuses cohortInviteDetails, which already
 * existed and worked but had no UI anywhere in Programme OS — the actual
 * gap wasn't the backend, it was that an owner had no way to find their own
 * join code without asking Shekk to look it up in the internal console.
 */
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Copy, KeyRound, Lock, RefreshCw, Settings as SettingsIcon } from "lucide-react";
import { EmptyState, ErrorState, LoadingBlocks, MicroLabel } from "@/components/Kit";
import { useStaffOS } from "@/components/staff/StaffSessionContext";
import {
  useStaffCohortSettings,
  useStaffRegenerateJoinCode,
  useStaffSetCohortJoinable,
} from "@/lib/useStaffSettings";

export const Route = createFileRoute("/staff/settings")({
  component: StaffSettings,
});

function StaffSettings() {
  const { activeWorkspace } = useStaffOS();
  const cohortId = activeWorkspace?.cohort?.id ?? null;
  const { data, isLoading, error, refetch } = useStaffCohortSettings(cohortId);
  const regenerate = useStaffRegenerateJoinCode(cohortId);
  const setJoinable = useStaffSetCohortJoinable(cohortId);
  const [copied, setCopied] = useState(false);
  const [confirmingRegenerate, setConfirmingRegenerate] = useState(false);

  if (!cohortId) {
    return (
      <EmptyState
        icon={SettingsIcon}
        title="No cohort yet"
        body="This programme doesn't have a cohort set up."
      />
    );
  }

  if (isLoading) return <LoadingBlocks rows={3} />;
  if (error) {
    return (
      <ErrorState
        body="We couldn't load Settings. Check your connection and try again."
        onRetry={() => void refetch()}
      />
    );
  }
  if (!data) return null;

  const link = `${typeof window !== "undefined" ? window.location.origin : ""}${data.path}`;
  const isOpen = data.status === "open";
  const isArchived = data.status === "archived";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <SettingsIcon className="size-4.5 text-primary" />
        <h2 className="text-[15px] font-bold">Settings</h2>
      </div>

      <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <KeyRound className="size-4.5 text-primary" />
            <p className="text-sm font-semibold">Join code</p>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
              isArchived
                ? "bg-muted text-muted-foreground"
                : isOpen
                  ? "bg-success-soft text-success"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {isArchived ? "Archived" : isOpen ? "Open" : "Closed"}
          </span>
        </div>
        <p className="text-[12.5px] text-muted-foreground">
          Students enter this at{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-[11.5px]">/join</code> to join this
          cohort — share it however works for your programme (WhatsApp, email, a printed sheet). No
          import or per-student invite is needed for students.
        </p>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
          <code className="min-w-0 flex-1 truncate text-[13px] font-bold">{link}</code>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(link);
              setCopied(true);
            }}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11.5px] font-semibold hover:bg-muted"
          >
            <Copy className="size-3.5" /> {copied ? "Copied" : "Copy link"}
          </button>
        </div>

        {data.canManage ? (
          <div className="space-y-2 border-t border-border pt-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={isArchived || setJoinable.isPending}
                onClick={() => setJoinable.mutate(!isOpen)}
                className="rounded-xl border border-border px-3.5 py-2 text-[12.5px] font-semibold hover:bg-muted disabled:opacity-60"
              >
                {setJoinable.isPending ? "Saving…" : isOpen ? "Close joining" : "Reopen joining"}
              </button>
              {!confirmingRegenerate ? (
                <button
                  type="button"
                  disabled={isArchived}
                  onClick={() => setConfirmingRegenerate(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2 text-[12.5px] font-semibold hover:bg-muted disabled:opacity-60"
                >
                  <RefreshCw className="size-3.5" /> New code
                </button>
              ) : null}
            </div>
            {confirmingRegenerate ? (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5">
                <span className="text-[12.5px] font-medium text-destructive">
                  Generate a new code? The current one stops working immediately — anyone who hasn't
                  joined yet will need the new one.
                </span>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmingRegenerate(false)}
                    className="rounded-lg px-2.5 py-1 text-[12px] font-semibold"
                  >
                    No
                  </button>
                  <button
                    type="button"
                    disabled={regenerate.isPending}
                    onClick={() =>
                      regenerate.mutate(undefined, {
                        onSuccess: () => setConfirmingRegenerate(false),
                      })
                    }
                    className="rounded-lg bg-destructive px-2.5 py-1 text-[12px] font-semibold text-destructive-foreground disabled:opacity-60"
                  >
                    {regenerate.isPending ? "Generating…" : "Yes, generate"}
                  </button>
                </div>
              </div>
            ) : null}
            <p className="text-[11px] text-muted-foreground">
              Closing joining only stops new students using this code — nobody already in the cohort
              is affected.
            </p>
          </div>
        ) : (
          <p className="border-t border-border pt-3 text-[11.5px] text-muted-foreground">
            Only an owner can close joining or generate a new code.
          </p>
        )}
      </div>

      <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="flex items-center gap-2">
          <Lock className="size-4.5 text-muted-foreground" />
          <p className="text-sm font-semibold">Programme details</p>
        </div>
        <dl className="grid grid-cols-1 gap-x-4 gap-y-2.5 sm:grid-cols-2">
          <div>
            <MicroLabel className="text-muted-foreground">Programme</MicroLabel>
            <dd className="text-[13.5px] font-semibold">{activeWorkspace?.programmeName}</dd>
          </div>
          <div>
            <MicroLabel className="text-muted-foreground">Organisation</MicroLabel>
            <dd className="text-[13.5px] font-semibold">{activeWorkspace?.organisation ?? "—"}</dd>
          </div>
          <div>
            <MicroLabel className="text-muted-foreground">Cohort</MicroLabel>
            <dd className="text-[13.5px] font-semibold">{activeWorkspace?.cohort?.name}</dd>
          </div>
          <div>
            <MicroLabel className="text-muted-foreground">Year</MicroLabel>
            <dd className="text-[13.5px] font-semibold">{activeWorkspace?.cohort?.year ?? "—"}</dd>
          </div>
        </dl>
        <p className="text-[11.5px] text-muted-foreground">
          These are set up by Shekk when your programme is provisioned. Contact Shekk to change your
          programme's name, organisation or a cohort's dates.
        </p>
      </div>
    </div>
  );
}
