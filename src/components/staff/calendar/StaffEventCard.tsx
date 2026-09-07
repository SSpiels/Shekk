/**
 * One event, rendered consistently across Agenda/Week/Month. All times are
 * shown in Israel local time (fmtIsraelTime), explicitly — never the
 * viewer's own browser timezone, since staff and students may be anywhere
 * before they fly. A cancelled event is visually struck through and muted
 * rather than looking like a normal upcoming one.
 */
import { AlertTriangle, MapPin, Users } from "lucide-react";
import { StatusPill } from "@/components/Kit";
import {
  audienceLabel,
  fmtIsraelTime,
  STATUS_LABEL,
  statusTone,
  type StaffCalendarEvent,
} from "@/lib/programme/logic";

const TONE_TO_PILL: Record<
  ReturnType<typeof statusTone>,
  "live" | "pending" | "preview" | "attention" | "quiet"
> = {
  live: "live",
  pending: "pending",
  attention: "attention",
  quiet: "quiet",
};

export function StaffEventCard({
  event,
  groups,
  onOpen,
}: {
  event: StaffCalendarEvent;
  groups: { id: string; name: string }[];
  onOpen: () => void;
}) {
  const cancelled = event.status === "cancelled";

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex w-full items-start gap-3 rounded-2xl border border-border bg-card p-3.5 text-left shadow-card transition-colors hover:border-primary/40 ${
        cancelled ? "opacity-60" : ""
      }`}
    >
      <span className="mt-0.5 flex w-14 shrink-0 flex-col items-center rounded-xl bg-primary-soft px-1 py-2 text-center text-[11px] font-bold leading-tight text-primary">
        {fmtIsraelTime(event.startsAt)}
        {event.originalStartsAt && event.originalStartsAt !== event.startsAt ? (
          <span className="mt-0.5 text-[9.5px] font-semibold text-muted-foreground line-through">
            {fmtIsraelTime(event.originalStartsAt)}
          </span>
        ) : null}
      </span>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`truncate font-semibold ${cancelled ? "line-through" : ""}`}>
            {event.title}
          </span>
          {event.status !== "scheduled" ? (
            <StatusPill tone={TONE_TO_PILL[statusTone(event.status)]}>
              {STATUS_LABEL[event.status]}
            </StatusPill>
          ) : null}
          {event.mandatory ? <StatusPill tone="attention">Mandatory</StatusPill> : null}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
          {event.locationLabel ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5 shrink-0" /> {event.locationLabel}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5 shrink-0" /> {audienceLabel(event.audience, groups)}
          </span>
        </div>

        {event.statusNote ? (
          <p className="flex items-start gap-1.5 text-[12px] font-medium text-warning-foreground">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {event.statusNote}
          </p>
        ) : null}

        {!cancelled && (event.rsvpEnabled || event.requiresAck) ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5 text-[11.5px] font-semibold">
            {event.rsvpEnabled ? (
              <span className="text-primary">
                {event.goingCount} going
                {event.capacity ? ` / ${event.capacity}` : ""}
                {event.noResponseCount > 0 ? ` · ${event.noResponseCount} no response` : ""}
              </span>
            ) : null}
            {event.requiresAck ? (
              <span className="text-muted-foreground">{event.ackCount} acknowledged</span>
            ) : null}
          </div>
        ) : null}
      </div>
    </button>
  );
}
