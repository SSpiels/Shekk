/**
 * Announcement history for Communications: title/body preview, audience,
 * published date, priority/pinned state, and — for anything requiring
 * acknowledgement — real acknowledgement progress against the announcement's
 * actual eligible audience. No delivery/open statistics: the engine only
 * tracks acknowledgement, so that's all that's shown.
 */
import { Link2, Pin } from "lucide-react";
import { ProgressBar, StatusPill } from "@/components/Kit";
import { audienceLabel, type StaffAnnouncementSummary } from "@/lib/programme/logic";

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return (
    d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) +
    " · " +
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  );
}

export function StaffAnnouncementList({
  announcements,
  groups,
  onOpen,
}: {
  announcements: StaffAnnouncementSummary[];
  groups: { id: string; name: string }[];
  onOpen: (announcement: StaffAnnouncementSummary) => void;
}) {
  return (
    <div className="space-y-2.5">
      {announcements.map((a) => (
        <div
          key={a.id}
          role={a.requiresAck ? "button" : undefined}
          tabIndex={a.requiresAck ? 0 : undefined}
          onClick={a.requiresAck ? () => onOpen(a) : undefined}
          onKeyDown={
            a.requiresAck
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpen(a);
                  }
                }
              : undefined
          }
          className={`space-y-2.5 rounded-2xl border border-border bg-card p-4 shadow-card transition-colors ${
            a.requiresAck ? "cursor-pointer hover:border-primary/40" : ""
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex items-center gap-1.5">
                {a.pinned ? <Pin className="size-3.5 shrink-0 text-primary" /> : null}
                <p className="truncate font-semibold">{a.title}</p>
              </div>
              <p className="line-clamp-2 text-[13px] text-muted-foreground">{a.bodyPreview}</p>
            </div>
            {a.priority !== "normal" ? (
              <StatusPill tone="attention" className="shrink-0">
                {a.priority}
              </StatusPill>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
            <span>{audienceLabel(a.audience, groups)}</span>
            <span>·</span>
            <span>{fmtDate(a.publishedAt)}</span>
            {a.linkUrl ? (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <Link2 className="size-3" /> Link attached
                </span>
              </>
            ) : null}
          </div>

          {a.requiresAck ? (
            <div className="space-y-1 border-t border-border pt-2.5">
              <div className="flex items-center justify-between text-[12px]">
                <span className="font-semibold">
                  {a.ackCount}/{a.eligibleCount} acknowledged
                </span>
                <span className="font-semibold text-primary">
                  {a.outstandingCount > 0 ? `${a.outstandingCount} outstanding →` : "All done"}
                </span>
              </div>
              <ProgressBar
                value={a.eligibleCount ? a.ackCount / a.eligibleCount : 0}
                tone={a.outstandingCount === 0 ? "success" : "primary"}
              />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
