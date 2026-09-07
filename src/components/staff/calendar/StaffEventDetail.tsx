/**
 * Event detail + live operations: the desktop equivalent of the mobile
 * EventOpsSheet in components/programme/Staff.tsx, reusing the exact same
 * updateEvent mutation and status vocabulary — delay/move/cancel here
 * produce the identical programme_event_changes rows and in-app
 * notifications the mobile ops sheet does. Also shows the change history
 * (event.changes, already computed server-side) so staff can see what's
 * already been communicated, and links to the full RSVP drill-down.
 */
import { useState } from "react";
import { AlertTriangle, Clock, MapPin, Pencil, Users, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusPill } from "@/components/Kit";
import {
  audienceLabel,
  delayBy,
  fmtIsraelDayLong,
  fmtIsraelTime,
  STATUS_LABEL,
  statusTone,
  type StaffCalendarEvent,
} from "@/lib/programme/logic";
import { useStaffUpdateEvent } from "@/lib/useStaffCalendar";

const inputClass =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

const TONE_TO_PILL = {
  live: "live",
  pending: "pending",
  attention: "attention",
  quiet: "quiet",
} as const;

export function StaffEventDetail({
  open,
  onClose,
  cohortId,
  event,
  groups,
  onEdit,
  onOpenResponses,
}: {
  open: boolean;
  onClose: () => void;
  cohortId: string;
  event: StaffCalendarEvent | null;
  groups: { id: string; name: string }[];
  onEdit: () => void;
  onOpenResponses: () => void;
}) {
  const updateEvent = useStaffUpdateEvent(cohortId);
  const [note, setNote] = useState("");
  const [location, setLocation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  if (!event) return null;

  const push = (patch: Record<string, unknown>, level: "notify" | "urgent" = "notify") => {
    setError(null);
    updateEvent.mutate(
      { eventId: event.id, patch: { ...patch, notifyLevel: level, note: note.trim() || null } },
      { onSuccess: onClose, onError: () => setError("We couldn't push that update.") },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <span className={event.status === "cancelled" ? "line-through" : ""}>
              {event.title}
            </span>
            <StatusPill tone={TONE_TO_PILL[statusTone(event.status)]}>
              {STATUS_LABEL[event.status]}
            </StatusPill>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1 text-[13px]">
            <p className="font-semibold">
              {fmtIsraelDayLong(event.startsAt)} · {fmtIsraelTime(event.startsAt)}
              {event.endsAt ? ` – ${fmtIsraelTime(event.endsAt)}` : ""}
            </p>
            {event.originalStartsAt && event.originalStartsAt !== event.startsAt ? (
              <p className="text-[12px] text-muted-foreground line-through">
                Was {fmtIsraelTime(event.originalStartsAt)}
              </p>
            ) : null}
            {event.locationLabel ? (
              <p className="flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="size-3.5 shrink-0" /> {event.locationLabel}
              </p>
            ) : null}
            <p className="flex items-center gap-1.5 text-muted-foreground">
              <Users className="size-3.5 shrink-0" /> {audienceLabel(event.audience, groups)}
            </p>
          </div>

          {event.statusNote ? (
            <p className="flex items-start gap-1.5 rounded-xl border border-warning/30 bg-warning-soft px-3 py-2 text-[12.5px] font-medium text-warning-foreground">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {event.statusNote}
            </p>
          ) : null}

          {event.description ? (
            <p className="text-[13px] text-muted-foreground">{event.description}</p>
          ) : null}

          {event.rsvpEnabled || event.requiresAck ? (
            <button
              type="button"
              onClick={onOpenResponses}
              className="flex w-full items-center justify-between rounded-xl border border-border bg-background px-3 py-2.5 text-[13px] font-semibold hover:bg-muted/40"
            >
              <span>
                {event.rsvpEnabled
                  ? `${event.goingCount} going${event.capacity ? ` / ${event.capacity}` : ""} · ${event.noResponseCount} no response`
                  : `${event.ackCount} acknowledged`}
              </span>
              <span className="text-primary">View responses →</span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={onEdit}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border px-3.5 py-2 text-[13px] font-semibold"
          >
            <Pencil className="size-3.5" /> Edit details
          </button>

          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-[12.5px] font-semibold text-muted-foreground">Live update</p>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={inputClass}
              placeholder="Tell people why (e.g. traffic on Route 1) — attached to every action below"
            />

            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              Running late
            </p>
            <div className="grid grid-cols-3 gap-2">
              {[15, 30, 60].map((m) => (
                <button
                  key={m}
                  type="button"
                  disabled={updateEvent.isPending}
                  onClick={() => push({ startsAt: delayBy(event.startsAt, m), status: "delayed" })}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border px-2 py-2 text-[12.5px] font-semibold hover:bg-muted/40 disabled:opacity-60"
                >
                  <Clock className="size-3.5" /> +{m}m
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className={inputClass}
                placeholder="New location"
              />
              <button
                type="button"
                disabled={updateEvent.isPending || !location.trim()}
                onClick={() => push({ locationLabel: location.trim(), status: "moved" })}
                className="shrink-0 rounded-xl border border-border px-3.5 py-2 text-[12.5px] font-semibold hover:bg-muted/40 disabled:opacity-60"
              >
                Move
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={updateEvent.isPending}
                onClick={() => push({ status: "scheduled" })}
                className="rounded-xl border border-border px-3.5 py-2 text-[12.5px] font-semibold hover:bg-muted/40 disabled:opacity-60"
              >
                Back on time
              </button>
              <button
                type="button"
                disabled={updateEvent.isPending}
                onClick={() => setConfirmingCancel(true)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-destructive/30 px-3.5 py-2 text-[12.5px] font-semibold text-destructive hover:bg-destructive/5 disabled:opacity-60"
              >
                <XCircle className="size-3.5" /> Cancel
              </button>
            </div>

            {confirmingCancel ? (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5">
                <span className="text-[12.5px] font-medium text-destructive">
                  Cancel this event? Eligible students will be notified.
                </span>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmingCancel(false)}
                    className="rounded-lg px-2.5 py-1 text-[12px] font-semibold"
                  >
                    No
                  </button>
                  <button
                    type="button"
                    disabled={updateEvent.isPending}
                    onClick={() => push({ status: "cancelled" }, "urgent")}
                    className="rounded-lg bg-destructive px-2.5 py-1 text-[12px] font-semibold text-destructive-foreground disabled:opacity-60"
                  >
                    Yes, cancel
                  </button>
                </div>
              </div>
            ) : null}

            {error ? <p className="text-[12.5px] font-medium text-destructive">{error}</p> : null}
          </div>

          {event.changes.length > 0 ? (
            <div className="space-y-1.5 border-t border-border pt-3">
              <p className="text-[12.5px] font-semibold text-muted-foreground">History</p>
              <div className="max-h-40 space-y-1.5 overflow-y-auto">
                {event.changes.map((c) => (
                  <div key={c.id} className="text-[11.5px] text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      {c.field === "status" ? "Status" : c.field.replace(/_/g, " ")}
                    </span>
                    {c.note ? ` — ${c.note}` : ""}
                    <span className="opacity-70"> · {fmtIsraelTime(c.changedAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
