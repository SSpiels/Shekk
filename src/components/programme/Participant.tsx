/**
 * Participant-facing programme pieces.
 *
 * Everything here reads from the hub the server returned and writes through the
 * participant mutations, which RLS restricts to the member's own rows.
 */

import { useState } from "react";
import {
  BellRing,
  CalendarClock,
  CheckCircle2,
  Circle,
  ExternalLink,
  Mail,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Users,
  Video,
} from "lucide-react";
import { Card } from "@/components/AppShell";
import { StatusPill } from "@/components/Kit";
import { track } from "@/lib/analytics";
import {
  ActionButton,
  AudienceChip,
  ErrorText,
  Freshness,
  Sheet,
  StatusChip,
  fmtDay,
  fmtTime,
} from "@/components/programme/Bits";
import { cleanError, useParticipantActions } from "@/lib/useProgrammeHub";
import {
  eventFullForGoing,
  // Event times are always Israel-scheduled programme time, shown the same
  // way regardless of the viewer's own browser timezone — see Bits.tsx's
  // fmtDay/fmtTime (still used below for announcements/votes/checklist/
  // notification timestamps, which aren't tied to Israel wall-clock time).
  fmtIsraelDay,
  fmtIsraelTime,
  placeDirectionsUrl,
  voteBlockedReason,
  type ChecklistItem,
  type ProgrammeAnnouncementRow,
  type ProgrammeContactRow,
  type ProgrammeDoc,
  type ProgrammeEvent,
  type ProgrammeHub,
  type ProgrammePlace,
  type ProgrammeVote,
} from "@/lib/programme/logic";

const telHref = (v: string) => `tel:${v.replace(/[^\d+]/g, "")}`;
const waHref = (v: string) => `https://wa.me/${v.replace(/[^\d]/g, "")}`;

/* ───────────────────────────────── Event card ─────────────────────────────── */

export function EventRow({
  event,
  onOpen,
  showDay = false,
}: {
  event: ProgrammeEvent;
  onOpen: () => void;
  showDay?: boolean;
}) {
  return (
    <button type="button" onClick={onOpen} className="tap block w-full text-left">
      <Card className="flex items-start gap-3">
        <span className="mt-0.5 flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-primary-soft text-[11px] font-bold leading-tight text-primary">
          <span>{fmtIsraelTime(event.startsAt)}</span>
          {showDay ? (
            <span className="text-[9px] opacity-70">{fmtIsraelDay(event.startsAt)}</span>
          ) : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="min-w-0 text-sm font-semibold">{event.title}</span>
            {event.status !== "scheduled" ? <StatusChip status={event.status} /> : null}
            {event.mandatory ? <StatusPill tone="attention">Mandatory</StatusPill> : null}
          </span>
          {event.locationLabel ? (
            <span className="mt-0.5 block text-xs text-muted-foreground">{event.locationLabel}</span>
          ) : null}
          {event.statusNote ? (
            <span className="mt-1 block text-[12px] font-medium text-warning-foreground">{event.statusNote}</span>
          ) : null}
          <span className="mt-1 flex flex-wrap items-center gap-2">
            <Freshness event={event} />
            {event.requiresAck && !event.acknowledged ? (
              <span className="text-[11px] font-bold text-destructive">Needs your OK</span>
            ) : null}
            {event.rsvpEnabled && event.myRsvp ? (
              <span className="text-[11px] font-semibold text-success">
                {event.myRsvp === "going" ? "You're going" : event.myRsvp === "maybe" ? "Maybe" : "Not going"}
              </span>
            ) : null}
          </span>
        </span>
      </Card>
    </button>
  );
}

export function EventSheet({
  event,
  hub,
  onClose,
}: {
  event: ProgrammeEvent | null;
  hub: ProgrammeHub;
  onClose: () => void;
}) {
  const { rsvp, acknowledge } = useParticipantActions();
  const [error, setError] = useState<string | null>(null);
  if (!event) return null;

  const directions = placeDirectionsUrl({
    googlePlaceId: event.googlePlaceId,
    latitude: event.latitude,
    longitude: event.longitude,
    address: event.locationLabel,
    label: event.title,
  });
  const full = eventFullForGoing(event);

  const setRsvp = (response: "going" | "maybe" | "not_going") => {
    setError(null);
    rsvp.mutate(
      { eventId: event.id, response },
      { onError: (e) => setError(cleanError(e, "We couldn't save your RSVP")) },
    );
  };

  return (
    <Sheet open onClose={onClose} title={event.title}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip status={event.status} />
          {event.mandatory ? <StatusPill tone="attention">Mandatory</StatusPill> : null}
          <AudienceChip audience={event.audience} groups={hub.myGroups} />
        </div>

        <p className="text-sm font-semibold">
          {fmtIsraelDay(event.startsAt)} · {fmtIsraelTime(event.startsAt)}
          {event.endsAt ? ` – ${fmtIsraelTime(event.endsAt)}` : ""}
        </p>
        {event.originalStartsAt && event.originalStartsAt !== event.startsAt ? (
          <p className="text-[12px] text-muted-foreground line-through">
            Was {fmtIsraelTime(event.originalStartsAt)}
          </p>
        ) : null}
        <Freshness event={event} />

        {event.statusNote ? (
          <p className="rounded-2xl border border-notice-border bg-notice-soft px-4 py-3 text-[12.5px] leading-relaxed text-notice-foreground">
            {event.statusNote}
          </p>
        ) : null}

        {event.description ? (
          <p className="text-[13px] leading-relaxed text-muted-foreground">{event.description}</p>
        ) : null}

        {event.locationLabel ? (
          <p className="flex items-start gap-2 text-[13px]">
            <MapPin className="mt-0.5 size-4 shrink-0 text-primary" /> {event.locationLabel}
          </p>
        ) : null}
        {event.meetingPoint ? (
          <p className="flex items-start gap-2 text-[13px]">
            <Users className="mt-0.5 size-4 shrink-0 text-primary" /> Meet at {event.meetingPoint}
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          {directions ? (
            <a
              href={directions}
              target="_blank"
              rel="noreferrer"
              onClick={() => track("programme_directions_opened", { subject: "event" })}
              className="tap flex items-center justify-center gap-2 rounded-2xl bg-ink px-4 py-3 text-[13px] font-bold text-ink-foreground"
            >
              <Navigation className="size-4" /> Directions
            </a>
          ) : null}
          {event.onlineUrl ? (
            <a
              href={event.onlineUrl}
              target="_blank"
              rel="noreferrer"
              className="tap flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-[13px] font-bold"
            >
              <Video className="size-4" /> Join online
            </a>
          ) : null}
        </div>

        {event.rsvpEnabled ? (
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              Are you coming?
              {event.capacity ? (
                <span className="ml-1 normal-case text-muted-foreground">
                  {event.goingCount ?? 0}/{event.capacity} going
                </span>
              ) : null}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(["going", "maybe", "not_going"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  disabled={rsvp.isPending || (r === "going" && full)}
                  onClick={() => setRsvp(r)}
                  className={`tap rounded-2xl px-3 py-3 text-[12.5px] font-bold disabled:opacity-50 ${
                    event.myRsvp === r ? "bg-primary text-primary-foreground" : "border border-border bg-card"
                  }`}
                >
                  {r === "going" ? "Going" : r === "maybe" ? "Maybe" : "Can't"}
                </button>
              ))}
            </div>
            {full ? <p className="mt-1.5 text-[11px] font-semibold text-warning-foreground">This event is full.</p> : null}
          </div>
        ) : null}

        {event.requiresAck ? (
          event.acknowledged ? (
            <p className="flex items-center gap-2 text-[12.5px] font-semibold text-success">
              <CheckCircle2 className="size-4" /> You've confirmed you've seen this
            </p>
          ) : (
            <ActionButton
              className="w-full"
              disabled={acknowledge.isPending}
              onClick={() => {
                setError(null);
                acknowledge.mutate(
                  { subjectType: "event", subjectId: event.id },
                  {
                    onSuccess: () => track("programme_acknowledged", { subject: "event" }),
                    onError: (e) => setError(cleanError(e, "We couldn't record that")),
                  },
                );
              }}
            >
              {acknowledge.isPending ? "Saving…" : "Got it"}
            </ActionButton>
          )
        ) : null}

        {event.changes.length > 0 ? (
          <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              What changed
            </p>
            <ul className="space-y-1.5">
              {event.changes.slice(0, 8).map((c) => (
                <li key={c.id} className="rounded-xl bg-muted px-3 py-2 text-[12px]">
                  <span className="font-semibold">{c.field}</span>
                  {c.before || c.after ? (
                    <span className="text-muted-foreground">
                      {" "}
                      {c.before ?? "—"} → {c.after ?? "—"}
                    </span>
                  ) : null}
                  {c.note ? <span className="mt-0.5 block text-muted-foreground">{c.note}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <ErrorText>{error}</ErrorText>
      </div>
    </Sheet>
  );
}

/* ─────────────────────────────── Announcements ────────────────────────────── */

export function AnnouncementCard({ announcement }: { announcement: ProgrammeAnnouncementRow }) {
  const { acknowledge } = useParticipantActions();
  const [error, setError] = useState<string | null>(null);
  const urgent = announcement.priority === "urgent";

  return (
    <Card className={urgent ? "border-destructive/40 bg-destructive/5" : ""}>
      <div className="flex items-center gap-2">
        <BellRing className={`size-4 shrink-0 ${urgent ? "text-destructive" : "text-primary"}`} />
        <p className="min-w-0 flex-1 text-sm font-semibold">{announcement.title}</p>
        {announcement.priority !== "normal" ? (
          <StatusPill tone={urgent ? "attention" : "pending"}>{announcement.priority}</StatusPill>
        ) : null}
      </div>
      <p className="mt-1.5 whitespace-pre-line text-[12.5px] leading-relaxed text-muted-foreground">
        {announcement.body}
      </p>
      {announcement.linkUrl ? (
        <a
          href={announcement.linkUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-bold text-primary"
        >
          Open link <ExternalLink className="size-3.5" />
        </a>
      ) : null}
      <p className="mt-2 text-[11px] text-muted-foreground">{fmtDay(announcement.publishedAt)}</p>
      {announcement.requiresAck ? (
        announcement.acknowledged ? (
          <p className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-success">
            <CheckCircle2 className="size-4" /> You said you've seen this
          </p>
        ) : (
          <ActionButton
            className="mt-2 w-full"
            disabled={acknowledge.isPending}
            onClick={() => {
              setError(null);
              acknowledge.mutate(
                { subjectType: "announcement", subjectId: announcement.id },
                {
                  onSuccess: () => track("programme_acknowledged", { subject: "announcement" }),
                  onError: (e) => setError(cleanError(e, "We couldn't record that")),
                },
              );
            }}
          >
            {acknowledge.isPending ? "Saving…" : "Got it"}
          </ActionButton>
        )
      ) : null}
      <ErrorText>{error}</ErrorText>
    </Card>
  );
}

/* ────────────────────────────────── Votes ─────────────────────────────────── */

export function VoteCard({ vote }: { vote: ProgrammeVote }) {
  const { vote: cast } = useParticipantActions();
  const [error, setError] = useState<string | null>(null);
  const blocked = voteBlockedReason(vote);

  return (
    <Card>
      <p className="text-sm font-semibold">{vote.question}</p>
      {vote.description ? (
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{vote.description}</p>
      ) : null}
      <p className="mt-1 text-[11px] text-muted-foreground">
        {vote.status === "closed" ? "Closed" : vote.closesAt ? `Closes ${fmtDay(vote.closesAt)}` : "Open"}
        {vote.anonymous ? " · anonymous" : " · named"}
        {vote.allowChange ? " · you can change your mind" : " · one vote each"}
      </p>

      <div className="mt-3 space-y-2">
        {vote.options.map((o) => {
          const mine = vote.myOptionId === o.id;
          const won = vote.winningOptionId === o.id;
          const reason = voteBlockedReason(vote, o.id);
          return (
            <button
              key={o.id}
              type="button"
              disabled={Boolean(reason) || cast.isPending}
              onClick={() => {
                setError(null);
                cast.mutate(
                  { voteId: vote.id, optionId: o.id },
                  {
                    onSuccess: () => track("programme_vote_submitted"),
                    onError: (e) => setError(cleanError(e, "We couldn't record your vote")),
                  },
                );
              }}
              className={`tap flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left disabled:opacity-60 ${
                mine || won ? "border-primary bg-primary-soft" : "border-border bg-card"
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold">
                  {o.label}
                  {won ? " · winner" : ""}
                </span>
                {o.detail ? <span className="block text-[11.5px] text-muted-foreground">{o.detail}</span> : null}
                {o.capacity ? (
                  <span className="block text-[11px] text-muted-foreground">
                    {o.count ?? 0}/{o.capacity} spots
                  </span>
                ) : vote.resultsVisible && o.count !== null ? (
                  <span className="block text-[11px] text-muted-foreground">{o.count} votes</span>
                ) : null}
              </span>
              {mine ? <span className="text-[11px] font-bold text-primary">Your pick</span> : null}
            </button>
          );
        })}
      </div>
      {blocked ? <p className="mt-2 text-[11.5px] font-semibold text-muted-foreground">{blocked}</p> : null}
      <ErrorText>{error}</ErrorText>
    </Card>
  );
}

/* ─────────────────────────────── Checklist ────────────────────────────────── */

export function ChecklistRow({ item }: { item: ChecklistItem }) {
  const { tick } = useParticipantActions();
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
      <button
        type="button"
        aria-label={item.done ? `Mark ${item.title} not done` : `Mark ${item.title} done`}
        onClick={() =>
          tick.mutate(
            { itemId: item.id, done: !item.done },
            {
              onSuccess: () => {
                if (!item.done) track("programme_checklist_completed", { key: item.itemKey });
              },
            },
          )
        }
        className="tap-flat mt-0.5 shrink-0"
      >
        {item.done ? (
          <CheckCircle2 className="size-5 text-success" />
        ) : (
          <Circle className="size-5 text-muted-foreground" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold ${item.done ? "text-muted-foreground line-through" : ""}`}>
          {item.title}
          {item.required ? <span className="ml-1 text-[11px] font-bold text-primary">required</span> : null}
        </p>
        {item.details ? <p className="mt-0.5 text-xs text-muted-foreground">{item.details}</p> : null}
        {item.dueOn ? (
          <p className="mt-1 text-[11px] font-semibold text-primary">Due {fmtDay(item.dueOn)}</p>
        ) : null}
        {item.actionUrl ? (
          <a href={item.actionUrl} className="mt-1.5 inline-block text-[12px] font-bold text-primary">
            Open in Shekk →
          </a>
        ) : null}
      </div>
    </div>
  );
}

/* ──────────────────────────── Contacts / docs / places ────────────────────── */

export function ContactRow({ contact }: { contact: ProgrammeContactRow }) {
  return (
    <Card className={contact.isEmergency ? "border-destructive/40" : ""}>
      <p className="text-sm font-semibold">{contact.name}</p>
      <p className="text-[11.5px] text-muted-foreground">
        {[contact.role, contact.category].filter(Boolean).join(" · ")}
        {contact.isEmergency ? " · emergency" : ""}
      </p>
      {contact.availability ? (
        <p className="mt-0.5 text-[11px] text-muted-foreground">{contact.availability}</p>
      ) : null}
      {contact.notes ? <p className="mt-1 text-[12px] text-muted-foreground">{contact.notes}</p> : null}
      <div className="mt-2 flex flex-wrap gap-2">
        {contact.phone ? (
          <a
            href={telHref(contact.phone)}
            className="tap flex items-center gap-1.5 rounded-xl bg-ink px-3 py-2 text-[12px] font-bold text-ink-foreground"
          >
            <Phone className="size-3.5" /> Call
          </a>
        ) : null}
        {contact.whatsapp ? (
          <a
            href={waHref(contact.whatsapp)}
            target="_blank"
            rel="noreferrer"
            className="tap flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-[12px] font-bold"
          >
            <MessageCircle className="size-3.5" /> WhatsApp
          </a>
        ) : null}
        {contact.email ? (
          <a
            href={`mailto:${contact.email}`}
            className="tap flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-[12px] font-bold"
          >
            <Mail className="size-3.5" /> Email
          </a>
        ) : null}
      </div>
    </Card>
  );
}

export function DocRow({ doc }: { doc: ProgrammeDoc }) {
  return (
    <Card>
      <p className="text-sm font-semibold">{doc.label}</p>
      {doc.description ? <p className="mt-0.5 text-[12px] text-muted-foreground">{doc.description}</p> : null}
      {doc.linkUrl ? (
        <a
          href={doc.linkUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-bold text-primary"
        >
          Open document <ExternalLink className="size-3.5" />
        </a>
      ) : (
        <p className="mt-1 text-[11px] text-muted-foreground">Ask your programme office for this one.</p>
      )}
    </Card>
  );
}

export function PlaceRow({ place }: { place: ProgrammePlace }) {
  const url = placeDirectionsUrl(place);
  return (
    <Card>
      <p className="text-sm font-semibold">{place.label}</p>
      <p className="text-[11.5px] text-muted-foreground">{place.category.replace(/_/g, " ")}</p>
      {place.address ? <p className="mt-0.5 text-[12px] text-muted-foreground">{place.address}</p> : null}
      {place.meetingInstructions ? (
        <p className="mt-1 text-[12px]">{place.meetingInstructions}</p>
      ) : null}
      {place.notes ? <p className="mt-1 text-[12px] text-muted-foreground">{place.notes}</p> : null}
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          onClick={() => track("programme_directions_opened", { subject: "place" })}
          className="tap mt-2 inline-flex items-center gap-1.5 rounded-xl bg-ink px-3 py-2 text-[12px] font-bold text-ink-foreground"
        >
          <Navigation className="size-3.5" /> Directions
        </a>
      ) : null}
    </Card>
  );
}

/* ──────────────────────────────── Notifications ───────────────────────────── */

export function NotificationList({ hub }: { hub: ProgrammeHub }) {
  const { markRead } = useParticipantActions();
  const unread = hub.notifications.filter((n) => !n.readAt);
  if (hub.notifications.length === 0) return null;

  return (
    <div className="space-y-2">
      {unread.length > 0 ? (
        <button
          type="button"
          onClick={() => markRead.mutate({ ids: unread.map((n) => n.id) })}
          className="tap-flat text-[12px] font-bold text-primary"
        >
          Mark all read
        </button>
      ) : null}
      {hub.notifications.slice(0, 12).map((n) => (
        <Card key={n.id} className={n.readAt ? "opacity-70" : "border-primary/40"}>
          <div className="flex items-center gap-2">
            <CalendarClock className={`size-4 shrink-0 ${n.level === "urgent" ? "text-destructive" : "text-primary"}`} />
            <p className="min-w-0 flex-1 text-[13px] font-semibold">{n.title}</p>
            {!n.readAt ? <span className="size-2 shrink-0 rounded-full bg-primary" /> : null}
          </div>
          {n.body ? <p className="mt-1 text-[12px] text-muted-foreground">{n.body}</p> : null}
          <p className="mt-1 text-[11px] text-muted-foreground">{fmtDay(n.createdAt)} · {fmtTime(n.createdAt)}</p>
        </Card>
      ))}
    </div>
  );
}
