/**
 * Polls and questions with live results. Picking a winner closes the vote and — when the
 * vote was attached to an activity — confirms that activity with the winning option, exactly
 * as the original mobile card did (staffApplyVoteWinner / staffCloseVote).
 */
import { useState } from "react";
import { Trophy } from "lucide-react";
import { ProgressBar, StatusPill } from "@/components/Kit";
import { audienceLabel, type ProgrammeVote } from "@/lib/programme/logic";
import { useStaffPollActions } from "@/lib/useStaffEngagement";

const KIND_LABEL: Record<ProgrammeVote["voteKind"], string> = {
  poll: "Vote",
  question: "Question",
  yes_no: "Yes / no",
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function PollCard({
  poll,
  cohortId,
  groups,
  canManage,
}: {
  poll: ProgrammeVote;
  cohortId: string;
  groups: { id: string; name: string }[];
  canManage: boolean;
}) {
  const { close, pickWinner } = useStaffPollActions(cohortId);
  const [confirmClose, setConfirmClose] = useState(false);
  const total = poll.responseCount ?? 0;
  const busy = close.isPending || pickWinner.isPending;
  const open = poll.status === "open";

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="font-semibold leading-snug">{poll.question}</p>
          {poll.description ? (
            <p className="line-clamp-2 text-[13px] text-muted-foreground">{poll.description}</p>
          ) : null}
        </div>
        <StatusPill tone={open ? "live" : "quiet"} className="shrink-0">
          {open ? "Open" : "Closed"}
        </StatusPill>
      </div>

      <div className="space-y-2">
        {poll.options.map((o) => {
          const share = total > 0 ? (o.count ?? 0) / total : 0;
          const winner = poll.winningOptionId === o.id;
          return (
            <div key={o.id} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-[13px]">
                <span className="flex min-w-0 items-center gap-1.5 font-semibold">
                  {winner ? <Trophy className="size-3.5 shrink-0 text-warning" /> : null}
                  <span className="truncate">{o.label}</span>
                </span>
                <span className="shrink-0 text-[12px] text-muted-foreground">
                  {o.count ?? 0}
                  {o.capacity ? ` / ${o.capacity}` : ""}
                </span>
              </div>
              <ProgressBar value={share} tone={winner ? "success" : "primary"} />
              {open && canManage ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => pickWinner.mutate({ voteId: poll.id, optionId: o.id })}
                  className="text-[11.5px] font-semibold text-primary disabled:opacity-60"
                >
                  Pick &ldquo;{o.label}&rdquo; as the winner
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-2.5 text-[11.5px] text-muted-foreground">
        <span>{KIND_LABEL[poll.voteKind]}</span>
        <span>·</span>
        <span>
          {total} {total === 1 ? "response" : "responses"}
        </span>
        <span>·</span>
        <span>{audienceLabel(poll.audience, groups)}</span>
        {poll.anonymous ? (
          <>
            <span>·</span>
            <span>Anonymous</span>
          </>
        ) : null}
        <span>·</span>
        <span>{fmtDate(poll.createdAt)}</span>
      </div>

      {open && canManage ? (
        confirmClose ? (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5">
            <span className="text-[12.5px] font-medium text-destructive">Close without picking a winner?</span>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => setConfirmClose(false)}
                className="rounded-lg px-2.5 py-1 text-[12px] font-semibold"
              >
                No
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => close.mutate({ voteId: poll.id, winningOptionId: null })}
                className="rounded-lg bg-destructive px-2.5 py-1 text-[12px] font-semibold text-destructive-foreground disabled:opacity-60"
              >
                Yes, close
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmClose(true)}
            className="text-[12px] font-semibold text-muted-foreground hover:text-foreground"
          >
            Close without a winner
          </button>
        )
      ) : null}
    </div>
  );
}

export function StaffPollList({
  polls,
  cohortId,
  groups,
  canManage,
}: {
  polls: ProgrammeVote[];
  cohortId: string;
  groups: { id: string; name: string }[];
  canManage: boolean;
}) {
  return (
    <div className="grid gap-2.5 xl:grid-cols-2">
      {polls.map((p) => (
        <PollCard key={p.id} poll={p} cohortId={cohortId} groups={groups} canManage={canManage} />
      ))}
    </div>
  );
}
