/**
 * Desktop event composer/editor. Same fields, same server functions
 * (staffCreateEvent/staffUpdateEvent) and the same mandatory/optional/
 * limited model (activityKindOf/activityKindFields) as the mobile
 * EventEditor in components/programme/Staff.tsx — a new presentation over
 * identical underlying behaviour. Date/time fields are explicitly Israel
 * time (isoToIsraelLocalInput / israelLocalInputToIso) so a staff member
 * browsing from abroad can't accidentally publish an event shifted by their
 * own timezone.
 */
import { useState } from "react";
import { CalendarPlus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ACTIVITY_KIND_LABEL,
  activityKindFields,
  activityKindOf,
  EVENT_TYPES,
  everyone,
  isoToIsraelLocalInput,
  israelLocalInputToIso,
  type ActivityKind,
  type Audience,
  type StaffCalendarEvent,
} from "@/lib/programme/logic";
import {
  useStaffCreateEvent,
  useStaffDeleteEvent,
  useStaffUpdateEvent,
} from "@/lib/useStaffCalendar";
import { StaffAudiencePicker } from "@/components/staff/communications/StaffAudiencePicker";

const inputClass =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

export function StaffEventEditor({
  open,
  onClose,
  cohortId,
  event,
  groups,
  students,
}: {
  open: boolean;
  onClose: () => void;
  cohortId: string;
  /** null = creating a new event. */
  event: StaffCalendarEvent | null;
  groups: { id: string; name: string }[];
  students: { userId: string; displayName: string; handle: string | null }[];
}) {
  const createEvent = useStaffCreateEvent(cohortId);
  const updateEvent = useStaffUpdateEvent(cohortId);
  const deleteEvent = useStaffDeleteEvent(cohortId);

  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [startsAt, setStartsAt] = useState(
    isoToIsraelLocalInput(event?.startsAt ?? new Date().toISOString()),
  );
  const [endsAt, setEndsAt] = useState(event?.endsAt ? isoToIsraelLocalInput(event.endsAt) : "");
  const [locationLabel, setLocationLabel] = useState(event?.locationLabel ?? "");
  const [meetingPoint, setMeetingPoint] = useState(event?.meetingPoint ?? "");
  const [onlineUrl, setOnlineUrl] = useState(event?.onlineUrl ?? "");
  const [eventType, setEventType] = useState(event?.eventType ?? "activity");
  const [kind, setKind] = useState<ActivityKind>(event ? activityKindOf(event) : "mandatory");
  const [capacity, setCapacity] = useState(event?.capacity ? String(event.capacity) : "");
  const [requiresAck, setRequiresAck] = useState(event?.requiresAck ?? false);
  const [audience, setAudience] = useState<Audience>(event?.audience ?? everyone);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const busy = createEvent.isPending || updateEvent.isPending;

  const publish = () => {
    setError(null);
    if (!title.trim()) {
      setError("Give it a title students will recognise.");
      return;
    }
    if (!startsAt) {
      setError("Set a start time.");
      return;
    }
    const fields = {
      title: title.trim(),
      description: description.trim() || null,
      startsAt: israelLocalInputToIso(startsAt),
      endsAt: endsAt ? israelLocalInputToIso(endsAt) : null,
      locationLabel: locationLabel.trim() || null,
      meetingPoint: meetingPoint.trim() || null,
      onlineUrl: onlineUrl.trim() || null,
      eventType,
      ...activityKindFields(kind),
      capacity: kind === "limited" && capacity ? Number(capacity) : null,
      requiresAck,
      audience,
    };

    if (event) {
      updateEvent.mutate(
        { eventId: event.id, patch: { ...fields, notifyLevel: "silent" } },
        { onSuccess: onClose, onError: () => setError("We couldn't save that.") },
      );
    } else {
      createEvent.mutate(fields, {
        onSuccess: onClose,
        onError: () => setError("We couldn't publish that."),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="size-4.5 text-primary" /> {event ? "Edit event" : "New event"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-[12.5px] font-semibold text-muted-foreground">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
              placeholder="Old City tiyul"
              maxLength={160}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[12.5px] font-semibold text-muted-foreground">
                Starts <span className="font-normal text-muted-foreground">(Israel time)</span>
              </label>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[12.5px] font-semibold text-muted-foreground">
                Ends <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[12.5px] font-semibold text-muted-foreground">Where</label>
              <input
                value={locationLabel}
                onChange={(e) => setLocationLabel(e.target.value)}
                className={inputClass}
                placeholder="Jaffa Gate"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[12.5px] font-semibold text-muted-foreground">
                Meeting point
              </label>
              <input
                value={meetingPoint}
                onChange={(e) => setMeetingPoint(e.target.value)}
                className={inputClass}
                placeholder="By the taxi rank"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[12.5px] font-semibold text-muted-foreground">
              Who has to come
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["mandatory", "optional", "limited"] as ActivityKind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`rounded-xl border px-2 py-2 text-[12.5px] font-semibold ${
                    kind === k
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-border bg-background"
                  }`}
                >
                  {k === "mandatory" ? "Everyone" : k === "optional" ? "Optional" : "Limited"}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">{ACTIVITY_KIND_LABEL[kind]}</p>
          </div>

          {kind === "limited" ? (
            <div className="space-y-1.5">
              <label className="text-[12.5px] font-semibold text-muted-foreground">
                Spaces <span className="font-normal">— "going" is blocked once full</span>
              </label>
              <input
                value={capacity}
                onChange={(e) => setCapacity(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                className={inputClass}
              />
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[12.5px] font-semibold text-muted-foreground">Type</label>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className={inputClass}
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[12.5px] font-semibold text-muted-foreground">
                Online link
              </label>
              <input
                value={onlineUrl}
                onChange={(e) => setOnlineUrl(e.target.value)}
                className={inputClass}
                placeholder="https://"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[12.5px] font-semibold text-muted-foreground">Details</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={inputClass}
              maxLength={4000}
            />
          </div>

          <label className="flex items-center gap-2 text-[13px] font-medium">
            <input
              type="checkbox"
              checked={requiresAck}
              onChange={(e) => setRequiresAck(e.target.checked)}
              className="size-3.5"
            />
            Require "Got it" acknowledgement
          </label>

          <div className="space-y-1.5">
            <label className="text-[12.5px] font-semibold text-muted-foreground">
              Who sees this
            </label>
            <StaffAudiencePicker
              value={audience}
              onChange={setAudience}
              groups={groups}
              students={students}
            />
          </div>

          {confirmingDelete ? (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5">
              <span className="text-[12.5px] font-medium text-destructive">
                Delete this event for everyone? This can't be undone.
              </span>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="rounded-lg px-2.5 py-1 text-[12px] font-semibold"
                >
                  No
                </button>
                <button
                  type="button"
                  disabled={deleteEvent.isPending}
                  onClick={() => deleteEvent.mutate({ eventId: event!.id }, { onSuccess: onClose })}
                  className="rounded-lg bg-destructive px-2.5 py-1 text-[12px] font-semibold text-destructive-foreground disabled:opacity-60"
                >
                  Yes, delete
                </button>
              </div>
            </div>
          ) : null}

          {error ? <p className="text-[12.5px] font-medium text-destructive">{error}</p> : null}

          <div className="flex items-center justify-between gap-2 pt-1">
            {event ? (
              <button
                type="button"
                disabled={deleteEvent.isPending}
                onClick={() => setConfirmingDelete(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/30 px-3.5 py-2 text-[13px] font-semibold text-destructive"
              >
                <Trash2 className="size-4" /> Delete
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-border px-4 py-2 text-[13px] font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={publish}
                disabled={busy}
                className="rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground disabled:opacity-60"
              >
                {busy ? "Saving…" : event ? "Save changes" : "Publish"}
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
