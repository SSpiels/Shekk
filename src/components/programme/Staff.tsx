/**
 * Staff editors — the sheets a madrich or programme office uses from a phone.
 *
 * Each editor collects a payload and hands it to the staff mutations. Nothing
 * here decides whether the user may do it: the server (and RLS) enforce that,
 * and `staffCan` only hides controls that would certainly fail.
 */

import { useState } from "react";
import { Clock, MapPin, Megaphone, Trash2, XCircle } from "lucide-react";
import { Card } from "@/components/AppShell";
import { track } from "@/lib/analytics";
import {
  ActionButton,
  AudiencePicker,
  ErrorText,
  Field,
  Sheet,
  Toggle,
  // Vote closing times use Bits' generic (viewer-local) fromLocalInput —
  // votes aren't tied to Israel wall-clock time the way events are.
  fromLocalInput,
  inputClass,
} from "@/components/programme/Bits";
import { cleanError, useStaffActions } from "@/lib/useProgrammeHub";
import {
  CONTACT_CATEGORIES,
  ACTIVITY_KIND_LABEL,
  EVENT_TYPES,
  PLACE_CATEGORIES,
  activityKindFields,
  activityKindOf,
  delayBy,
  everyone,
  // Event start/end times are Israel wall-clock time, entered and shown the
  // same way regardless of the staff member's own browser timezone — a
  // madrich booking a bus for "18:00" while still at home in the US means
  // 18:00 in Israel, not 18:00 where they're standing.
  fmtIsraelTime,
  isoToIsraelLocalInput,
  israelLocalInputToIso,
  type ActivityKind,
  type Audience,
  type ProgrammeEvent,
  type ProgrammeGroup,
  type ProgrammeHub,
} from "@/lib/programme/logic";

type People = { userId: string; name: string }[];

/* ─────────────────────────── Event create / edit ──────────────────────────── */

export function EventEditor({
  hub,
  event,
  people,
  onClose,
}: {
  hub: ProgrammeHub;
  event: ProgrammeEvent | null;
  people: People;
  onClose: () => void;
}) {
  const { createEvent, updateEvent, deleteEvent } = useStaffActions();
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
  const [advanced, setAdvanced] = useState(false);
  const [requiresAck, setAck] = useState(event?.requiresAck ?? false);
  const [audience, setAudience] = useState<Audience>(event?.audience ?? everyone);
  const [note, setNote] = useState("");
  const [notifyLevel, setNotifyLevel] = useState<"silent" | "notify" | "urgent">("notify");
  const [error, setError] = useState<string | null>(null);

  const busy = createEvent.isPending || updateEvent.isPending;

  const fields = {
    title: title.trim(),
    description: description.trim() || null,
    startsAt: startsAt ? israelLocalInputToIso(startsAt) : new Date().toISOString(),
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

  function save() {
    setError(null);
    if (!title.trim()) {
      setError("Give it a title participants will recognise.");
      return;
    }
    const onError = (e: unknown) => setError(cleanError(e, "We couldn't save that."));
    if (event) {
      updateEvent.mutate(
        { eventId: event.id, patch: { ...fields, notifyLevel, note: note.trim() || null } },
        {
          onSuccess: () => {
            track("programme_staff_event_updated");
            onClose();
          },
          onError,
        },
      );
    } else {
      if (!hub.cohortId) return;
      createEvent.mutate(
        { cohortId: hub.cohortId, input: fields },
        {
          onSuccess: () => {
            track("programme_staff_event_created");
            onClose();
          },
          onError,
        },
      );
    }
  }

  return (
    <Sheet open onClose={onClose} title={event ? "Edit activity" : "New activity"}>
      <div className="space-y-3">
        <Field label="Title">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder="Shabbaton departure" />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Starts" hint="Israel time, wherever you are">
            <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Ends (optional)">
            <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={inputClass} />
          </Field>
        </div>

        <Field label="Where">
          <input value={locationLabel} onChange={(e) => setLocationLabel(e.target.value)} className={inputClass} placeholder="Tachana Merkazit, Jerusalem" />
        </Field>
        <Field label="Meeting point" hint="Where exactly to stand — this is what people ask on the day.">
          <input value={meetingPoint} onChange={(e) => setMeetingPoint(e.target.value)} className={inputClass} placeholder="Bay 6, next to the kiosk" />
        </Field>

        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Who has to come
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(["mandatory", "optional", "limited"] as ActivityKind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`tap-flat rounded-xl border px-2 py-2.5 text-[12px] font-bold ${
                  kind === k ? "border-primary bg-primary-soft text-primary" : "border-border bg-card"
                }`}
              >
                {k === "mandatory" ? "Everyone" : k === "optional" ? "Optional" : "Limited"}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">{ACTIVITY_KIND_LABEL[kind]}</p>
        </div>

        {kind === "limited" ? (
          <Field label="Spaces" hint="Once full, 'going' is blocked by the database, not just the screen.">
            <input value={capacity} onChange={(e) => setCapacity(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={inputClass} />
          </Field>
        ) : null}

        <button
          type="button"
          onClick={() => setAdvanced((v) => !v)}
          className="tap-flat text-[12px] font-bold text-primary"
        >
          {advanced ? "Hide options" : "More options"}
        </button>

        {advanced ? (
          <div className="space-y-3">
            <Field label="Details">
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputClass} />
            </Field>
            <Field label="Type">
              <select value={eventType} onChange={(e) => setEventType(e.target.value)} className={inputClass}>
                {EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Online link (optional)">
              <input value={onlineUrl} onChange={(e) => setOnlineUrl(e.target.value)} className={inputClass} placeholder="https://" />
            </Field>
            <Toggle label="Require 'Got it'" checked={requiresAck} onChange={setAck} hint="You'll see who has confirmed." />
          </div>
        ) : null}

        <Field label="Who sees this">
          <AudiencePicker value={audience} onChange={setAudience} groups={hub.myGroups} people={people} />
        </Field>

        {event ? (
          <>
            <Field label="Note about this change" hint="Participants see this next to the event.">
              <input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} placeholder="Bus is running late" />
            </Field>
            <Field label="How loudly to tell people">
              <select
                value={notifyLevel}
                onChange={(e) => setNotifyLevel(e.target.value as typeof notifyLevel)}
                className={inputClass}
              >
                <option value="silent">Quietly — no alert</option>
                <option value="notify">Notify everyone affected</option>
                <option value="urgent">Urgent alert</option>
              </select>
            </Field>
          </>
        ) : null}

        <ErrorText>{error}</ErrorText>

        <ActionButton className="w-full" onClick={save} disabled={busy}>
          {busy ? "Saving…" : event ? "Save changes" : "Publish to the cohort"}
        </ActionButton>

        {event ? (
          <ActionButton
            tone="danger"
            className="w-full"
            disabled={deleteEvent.isPending}
            onClick={() => {
              if (!window.confirm("Delete this event for everyone?")) return;
              deleteEvent.mutate({ eventId: event.id }, { onSuccess: onClose });
            }}
          >
            <span className="inline-flex items-center gap-2">
              <Trash2 className="size-4" /> Delete event
            </span>
          </ActionButton>
        ) : null}
      </div>
    </Sheet>
  );
}

/* ────────────────────────── Live ops on one event ─────────────────────────── */

export function EventOpsSheet({ event, onClose }: { event: ProgrammeEvent; onClose: () => void }) {
  const { updateEvent } = useStaffActions();
  const [note, setNote] = useState(event.statusNote ?? "");
  const [location, setLocation] = useState(event.locationLabel ?? "");
  const [error, setError] = useState<string | null>(null);

  const push = (patch: Record<string, unknown>, level: "notify" | "urgent" = "notify") => {
    setError(null);
    updateEvent.mutate(
      { eventId: event.id, patch: { ...patch, notifyLevel: level, note: note.trim() || null } },
      {
        onSuccess: () => {
          track("programme_staff_event_updated");
          onClose();
        },
        onError: (e) => setError(cleanError(e, "We couldn't push that update.")),
      },
    );
  };

  return (
    <Sheet open onClose={onClose} title={event.title}>
      <div className="space-y-3">
        <p className="text-[13px] text-muted-foreground">
          Starts {fmtIsraelTime(event.startsAt)}
          {event.locationLabel ? ` · ${event.locationLabel}` : ""}
        </p>

        <Field label="Tell people why" hint="Attached to every update below.">
          <input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} placeholder="Traffic on Route 1" />
        </Field>

        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Running late</p>
        <div className="grid grid-cols-3 gap-2">
          {[15, 30, 60].map((m) => (
            <ActionButton
              key={m}
              tone="ghost"
              disabled={updateEvent.isPending}
              onClick={() => push({ startsAt: delayBy(event.startsAt, m), status: "delayed" })}
            >
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-3.5" /> +{m}m
              </span>
            </ActionButton>
          ))}
        </div>

        <Field label="Move it">
          <input value={location} onChange={(e) => setLocation(e.target.value)} className={inputClass} placeholder="New location" />
        </Field>
        <ActionButton
          tone="ghost"
          className="w-full"
          disabled={updateEvent.isPending || !location.trim()}
          onClick={() => push({ locationLabel: location.trim(), status: "moved" })}
        >
          <span className="inline-flex items-center gap-2">
            <MapPin className="size-4" /> Publish new location
          </span>
        </ActionButton>

        <div className="grid grid-cols-2 gap-2">
          <ActionButton tone="ghost" disabled={updateEvent.isPending} onClick={() => push({ status: "scheduled" })}>
            Back on time
          </ActionButton>
          <ActionButton tone="danger" disabled={updateEvent.isPending} onClick={() => push({ status: "cancelled" }, "urgent")}>
            <span className="inline-flex items-center gap-1.5">
              <XCircle className="size-4" /> Cancel
            </span>
          </ActionButton>
        </div>

        {event.rsvpEnabled ? (
          <p className="text-[12px] text-muted-foreground">
            {event.goingCount ?? 0} going{event.capacity ? ` of ${event.capacity}` : ""}
          </p>
        ) : null}
        {event.requiresAck ? (
          <p className="text-[12px] text-muted-foreground">{event.ackCount ?? 0} have confirmed they've seen it</p>
        ) : null}

        <ErrorText>{error}</ErrorText>
      </div>
    </Sheet>
  );
}

/* ────────────────────────────── Announcements ─────────────────────────────── */

export function AnnouncementComposer({
  hub,
  people,
  onClose,
}: {
  hub: ProgrammeHub;
  people: People;
  onClose: () => void;
}) {
  const { createAnnouncement } = useStaffActions();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<"normal" | "important" | "urgent">("normal");
  const [pinned, setPinned] = useState(false);
  const [requiresAck, setAck] = useState(false);
  const [linkUrl, setLink] = useState("");
  const [audience, setAudience] = useState<Audience>(everyone);
  const [error, setError] = useState<string | null>(null);

  return (
    <Sheet open onClose={onClose} title="New announcement">
      <div className="space-y-3">
        <Field label="Title">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Message">
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} className={inputClass} />
        </Field>
        <Field label="Priority">
          <select value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)} className={inputClass}>
            <option value="normal">Normal — appears in the inbox</option>
            <option value="important">Important — highlighted</option>
            <option value="urgent">Urgent — alerts everyone</option>
          </select>
        </Field>
        <Field label="Link (optional)">
          <input value={linkUrl} onChange={(e) => setLink(e.target.value)} className={inputClass} placeholder="https://" />
        </Field>
        <Toggle label="Pin to the top" checked={pinned} onChange={setPinned} />
        <Toggle label="Require 'Got it'" checked={requiresAck} onChange={setAck} hint="Track who has read it." />
        <Field label="Who sees this">
          <AudiencePicker value={audience} onChange={setAudience} groups={hub.myGroups} people={people} />
        </Field>

        <ErrorText>{error}</ErrorText>
        <ActionButton
          className="w-full"
          disabled={createAnnouncement.isPending}
          onClick={() => {
            setError(null);
            if (!title.trim() || !body.trim()) {
              setError("A title and a message, please.");
              return;
            }
            if (!hub.cohortId) return;
            createAnnouncement.mutate(
              {
                cohortId: hub.cohortId,
                input: {
                  title: title.trim(),
                  body: body.trim(),
                  priority,
                  pinned,
                  requiresAck,
                  linkUrl: linkUrl.trim() || null,
                  notify: priority !== "normal",
                  audience,
                },
              },
              {
                onSuccess: () => {
                  track("programme_staff_announcement_sent");
                  onClose();
                },
                onError: (e) => setError(cleanError(e, "We couldn't post that.")),
              },
            );
          }}
        >
          <span className="inline-flex items-center gap-2">
            <Megaphone className="size-4" /> {createAnnouncement.isPending ? "Posting…" : "Post announcement"}
          </span>
        </ActionButton>
      </div>
    </Sheet>
  );
}

/* ───────────────────────────────── Votes ──────────────────────────────────── */

export function VoteComposer({ hub, people, onClose }: { hub: ProgrammeHub; people: People; onClose: () => void }) {
  const { createVote } = useStaffActions();
  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [options, setOptions] = useState([
    { label: "", capacity: "" },
    { label: "", capacity: "" },
  ]);
  const [anonymous, setAnonymous] = useState(false);
  const [allowChange, setAllowChange] = useState(true);
  const [resultsVisible, setResults] = useState(true);
  const [closesAt, setCloses] = useState("");
  const [audience, setAudience] = useState<Audience>(everyone);
  const [error, setError] = useState<string | null>(null);

  const setOpt = (i: number, patch: Partial<{ label: string; capacity: string }>) =>
    setOptions((prev) => prev.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));

  return (
    <Sheet open onClose={onClose} title="New vote">
      <div className="space-y-3">
        <Field label="Question">
          <input value={question} onChange={(e) => setQuestion(e.target.value)} className={inputClass} placeholder="Which tiyul this Thursday?" />
        </Field>
        <Field label="Context (optional)">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={inputClass} />
        </Field>

        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Options</p>
        {options.map((o, i) => (
          <div key={i} className="grid grid-cols-[1fr_5rem] gap-2">
            <input
              value={o.label}
              onChange={(e) => setOpt(i, { label: e.target.value })}
              className={inputClass}
              placeholder={`Option ${i + 1}`}
            />
            <input
              value={o.capacity}
              onChange={(e) => setOpt(i, { capacity: e.target.value.replace(/\D/g, "") })}
              className={inputClass}
              inputMode="numeric"
              placeholder="Cap"
            />
          </div>
        ))}
        {options.length < 12 ? (
          <button
            type="button"
            onClick={() => setOptions((p) => [...p, { label: "", capacity: "" }])}
            className="tap-flat text-[12px] font-bold text-primary"
          >
            Add option
          </button>
        ) : null}

        <Field label="Closes (optional)">
          <input type="datetime-local" value={closesAt} onChange={(e) => setCloses(e.target.value)} className={inputClass} />
        </Field>
        <Toggle label="Anonymous" checked={anonymous} onChange={setAnonymous} hint="You'll see totals, not names." />
        <Toggle label="People can change their pick" checked={allowChange} onChange={setAllowChange} />
        <Toggle label="Show running results" checked={resultsVisible} onChange={setResults} />
        <Field label="Who votes">
          <AudiencePicker value={audience} onChange={setAudience} groups={hub.myGroups} people={people} />
        </Field>

        <ErrorText>{error}</ErrorText>
        <ActionButton
          className="w-full"
          disabled={createVote.isPending}
          onClick={() => {
            setError(null);
            const clean = options.map((o) => o.label.trim()).filter(Boolean);
            if (!question.trim() || clean.length < 2) {
              setError("A question and at least two options.");
              return;
            }
            if (!hub.cohortId) return;
            createVote.mutate(
              {
                cohortId: hub.cohortId,
                input: {
                  question: question.trim(),
                  description: description.trim() || null,
                  options: options
                    .filter((o) => o.label.trim())
                    .map((o) => ({ label: o.label.trim(), detail: null, capacity: o.capacity ? Number(o.capacity) : null })),
                  anonymous,
                  allowChange,
                  resultsVisible,
                  closesAt: closesAt ? fromLocalInput(closesAt) : null,
                  notify: true,
                  audience,
                },
              },
              { onSuccess: onClose, onError: (e) => setError(cleanError(e, "We couldn't open that vote.")) },
            );
          }}
        >
          {createVote.isPending ? "Opening…" : "Open vote"}
        </ActionButton>
      </div>
    </Sheet>
  );
}

export function StaffVoteCard({ vote }: { vote: ProgrammeHub["votes"][number] }) {
  const { closeVote, applyWinner } = useStaffActions();
  return (
    <Card>
      <p className="text-sm font-semibold">{vote.question}</p>
      <p className="text-[11px] text-muted-foreground">
        {vote.status === "closed" ? "Closed" : "Open"} · {vote.responseCount ?? 0} responses
        {vote.anonymous ? " · anonymous" : ""}
      </p>
      <div className="mt-2 space-y-1.5">
        {vote.options.map((o) => (
          <div key={o.id} className="flex items-center justify-between rounded-xl bg-muted px-3 py-2 text-[12.5px]">
            <span className="font-semibold">
              {o.label}
              {vote.winningOptionId === o.id ? " · winner" : ""}
            </span>
            <span className="text-muted-foreground">
              {o.count ?? 0}
              {o.capacity ? `/${o.capacity}` : ""}
            </span>
          </div>
        ))}
      </div>
      {vote.status === "open" ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {vote.options.map((o) => (
            <ActionButton
              key={o.id}
              tone="ghost"
              disabled={applyWinner.isPending}
              onClick={() => applyWinner.mutate({ voteId: vote.id, optionId: o.id })}
            >
              Pick {o.label}
            </ActionButton>
          ))}
          <ActionButton
            tone="danger"
            disabled={closeVote.isPending}
            onClick={() => closeVote.mutate({ voteId: vote.id, winningOptionId: null })}
          >
            Close without a winner
          </ActionButton>
        </div>
      ) : null}
    </Card>
  );
}

/* ───────────────────── Checklist / documents / contacts / places ──────────── */

type ContentKind = "checklist_item" | "document" | "contact" | "place";

export function ContentEditor({
  hub,
  kind,
  people,
  onClose,
}: {
  hub: ProgrammeHub;
  kind: ContentKind;
  people: People;
  onClose: () => void;
}) {
  const { upsertContent } = useStaffActions();
  const [audience, setAudience] = useState<Audience>(everyone);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [flag, setFlag] = useState(false);
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const val = (k: string) => form[k] ?? "";
  const clean = (k: string) => (form[k]?.trim() ? form[k]!.trim() : null);

  const titles: Record<ContentKind, string> = {
    checklist_item: "New checklist item",
    document: "New document",
    contact: "New contact",
    place: "New place",
  };

  function save() {
    setError(null);
    if (!hub.cohortId) return;
    const onDone = { onSuccess: onClose, onError: (e: unknown) => setError(cleanError(e, "We couldn't save that.")) };

    if (kind === "checklist_item") {
      if (!val("title").trim()) return setError("Give the item a title.");
      upsertContent.mutate(
        {
          kind,
          cohortId: hub.cohortId,
          audience,
          values: {
            item_key: val("title").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 60),
            title: val("title").trim(),
            details: clean("details"),
            due_on: clean("due_on"),
            required: flag,
            action_url: clean("action_url"),
            feature_key: null,
          },
        },
        onDone,
      );
      return;
    }
    if (kind === "document") {
      if (!val("label").trim()) return setError("Give the document a name.");
      upsertContent.mutate(
        {
          kind,
          cohortId: hub.cohortId,
          audience,
          values: {
            label: val("label").trim(),
            description: clean("description"),
            link_url: clean("link_url"),
            category: val("category") || "other",
          },
        },
        onDone,
      );
      return;
    }
    if (kind === "contact") {
      if (!val("name").trim()) return setError("Who is it?");
      upsertContent.mutate(
        {
          kind,
          cohortId: hub.cohortId,
          audience,
          values: {
            name: val("name").trim(),
            role: clean("role"),
            category: val("category") || "staff",
            phone: clean("phone"),
            whatsapp: clean("whatsapp"),
            email: clean("email"),
            notes: clean("notes"),
            availability: clean("availability"),
            is_emergency: flag,
          },
        },
        onDone,
      );
      return;
    }
    if (!val("label").trim()) return setError("Give the place a name.");
    upsertContent.mutate(
      {
        kind: "place",
        cohortId: hub.cohortId,
        audience,
        values: {
          label: val("label").trim(),
          category: val("category") || "other",
          notes: clean("notes"),
          meeting_instructions: clean("meeting_instructions"),
          google_place_id: null,
          address: clean("address"),
          latitude: null,
          longitude: null,
        },
      },
      onDone,
    );
  }

  return (
    <Sheet open onClose={onClose} title={titles[kind]}>
      <div className="space-y-3">
        {kind === "checklist_item" ? (
          <>
            <Field label="Title">
              <input value={val("title")} onChange={(e) => set("title", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Details">
              <textarea value={val("details")} onChange={(e) => set("details", e.target.value)} rows={3} className={inputClass} />
            </Field>
            <Field label="Due date">
              <input type="date" value={val("due_on")} onChange={(e) => set("due_on", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Link inside Shekk (optional)" hint="e.g. /services/esim">
              <input value={val("action_url")} onChange={(e) => set("action_url", e.target.value)} className={inputClass} />
            </Field>
            <Toggle label="Required" checked={flag} onChange={setFlag} />
          </>
        ) : null}

        {kind === "document" ? (
          <>
            <Field label="Name">
              <input value={val("label")} onChange={(e) => set("label", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Description">
              <textarea value={val("description")} onChange={(e) => set("description", e.target.value)} rows={2} className={inputClass} />
            </Field>
            <Field label="Link">
              <input value={val("link_url")} onChange={(e) => set("link_url", e.target.value)} className={inputClass} placeholder="https://" />
            </Field>
          </>
        ) : null}

        {kind === "contact" ? (
          <>
            <Field label="Name">
              <input value={val("name")} onChange={(e) => set("name", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Role">
              <input value={val("role")} onChange={(e) => set("role", e.target.value)} className={inputClass} placeholder="Madrich" />
            </Field>
            <Field label="Category">
              <select value={val("category") || "staff"} onChange={(e) => set("category", e.target.value)} className={inputClass}>
                {CONTACT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Phone">
                <input value={val("phone")} onChange={(e) => set("phone", e.target.value)} className={inputClass} inputMode="tel" />
              </Field>
              <Field label="WhatsApp">
                <input value={val("whatsapp")} onChange={(e) => set("whatsapp", e.target.value)} className={inputClass} inputMode="tel" />
              </Field>
            </div>
            <Field label="Email">
              <input value={val("email")} onChange={(e) => set("email", e.target.value)} className={inputClass} inputMode="email" />
            </Field>
            <Field label="When to call">
              <input value={val("availability")} onChange={(e) => set("availability", e.target.value)} className={inputClass} placeholder="24/7" />
            </Field>
            <Toggle label="Emergency contact" checked={flag} onChange={setFlag} />
          </>
        ) : null}

        {kind === "place" ? (
          <>
            <Field label="Name">
              <input value={val("label")} onChange={(e) => set("label", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Category">
              <select value={val("category") || "other"} onChange={(e) => set("category", e.target.value)} className={inputClass}>
                {PLACE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Address">
              <input value={val("address")} onChange={(e) => set("address", e.target.value)} className={inputClass} />
            </Field>
            <Field label="How to find it">
              <textarea
                value={val("meeting_instructions")}
                onChange={(e) => set("meeting_instructions", e.target.value)}
                rows={2}
                className={inputClass}
              />
            </Field>
          </>
        ) : null}

        <Field label="Who sees this">
          <AudiencePicker value={audience} onChange={setAudience} groups={hub.myGroups} people={people} />
        </Field>

        <ErrorText>{error}</ErrorText>
        <ActionButton className="w-full" onClick={save} disabled={upsertContent.isPending}>
          {upsertContent.isPending ? "Saving…" : "Save"}
        </ActionButton>
      </div>
    </Sheet>
  );
}

/* ───────────────────────────────── Groups ─────────────────────────────────── */

export function GroupSheet({
  group,
  people,
  onClose,
}: {
  group: ProgrammeGroup;
  people: People;
  onClose: () => void;
}) {
  const { setGroupMember, deleteGroup } = useStaffActions();
  const [members, setMembers] = useState<Set<string>>(new Set());

  return (
    <Sheet open onClose={onClose} title={group.name}>
      <div className="space-y-3">
        <p className="text-[12px] text-muted-foreground">
          Tap a name to add them to this group. Group membership decides who sees targeted events, votes and
          documents.
        </p>
        <div className="max-h-72 space-y-1 overflow-y-auto rounded-2xl border border-border p-2">
          {people.length === 0 ? (
            <p className="px-2 py-4 text-center text-[12px] text-muted-foreground">Nobody has joined yet.</p>
          ) : (
            people.map((p) => {
              const on = members.has(p.userId);
              return (
                <button
                  key={p.userId}
                  type="button"
                  disabled={setGroupMember.isPending}
                  onClick={() => {
                    setMembers((prev) => {
                      const next = new Set(prev);
                      if (on) next.delete(p.userId);
                      else next.add(p.userId);
                      return next;
                    });
                    setGroupMember.mutate({ groupId: group.id, memberId: p.userId, member: !on });
                  }}
                  className={`tap-flat flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[13px] font-semibold ${
                    on ? "bg-primary-soft text-primary" : ""
                  }`}
                >
                  {p.name}
                  <span aria-hidden>{on ? "✓" : "+"}</span>
                </button>
              );
            })
          )}
        </div>
        <ActionButton
          tone="danger"
          className="w-full"
          disabled={deleteGroup.isPending}
          onClick={() => {
            if (!window.confirm(`Delete the group "${group.name}"?`)) return;
            deleteGroup.mutate({ groupId: group.id }, { onSuccess: onClose });
          }}
        >
          Delete group
        </ActionButton>
      </div>
    </Sheet>
  );
}
