/**
 * Row lists for Content's four simple kinds — same card language as
 * StaffAnnouncementList/StaffCalendarAgenda. Every row is clickable to open
 * it in StaffContentEditor; there's no separate read-only detail view here
 * the way Calendar has StaffEventDetail, because these rows are already
 * short enough to show everything staff need inline.
 */
import { AlertTriangle, ExternalLink, Mail, MessageCircle, Phone, RotateCcw } from "lucide-react";
import {
  audienceLabel,
  type ChecklistItem,
  type ProgrammeContactRow,
  type ProgrammeDoc,
  type ProgrammePlace,
} from "@/lib/programme/logic";

function fmtDateOnly(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const rowClass =
  "cursor-pointer space-y-1.5 rounded-2xl border border-border bg-card p-4 shadow-card transition-colors hover:border-primary/40";

export function StaffChecklistList({
  items,
  groups,
  onOpen,
}: {
  items: ChecklistItem[];
  groups: { id: string; name: string }[];
  onOpen: (item: ChecklistItem) => void;
}) {
  return (
    <div className="space-y-2.5">
      {items.map((item) => (
        <div
          key={item.id}
          role="button"
          tabIndex={0}
          onClick={() => onOpen(item)}
          className={rowClass}
        >
          <div className="flex items-start justify-between gap-3">
            <p className="font-semibold">
              {item.title}
              {item.required ? (
                <span className="ml-1.5 text-[11px] font-bold text-primary">required</span>
              ) : null}
            </p>
            {item.doneCount != null ? (
              <span className="shrink-0 text-[11.5px] font-semibold text-muted-foreground">
                {item.doneCount} done
              </span>
            ) : null}
          </div>
          {item.details ? (
            <p className="line-clamp-2 text-[13px] text-muted-foreground">{item.details}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
            <span>{audienceLabel(item.audience, groups)}</span>
            {item.dueOn ? (
              <>
                <span>·</span>
                <span>Due {fmtDateOnly(item.dueOn)}</span>
              </>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Retired items — kept (with their completion history) rather than deleted
 * once a student has made progress on them; see deleteContent's
 * archive-instead-of-delete path. Read-only except for Restore, since an
 * archived item isn't part of the active checklist for staff to edit fields
 * on until it's back.
 */
export function StaffRetiredChecklistList({
  items,
  onRestore,
  restoringId,
}: {
  items: ChecklistItem[];
  onRestore: (item: ChecklistItem) => void;
  restoringId: string | null;
}) {
  return (
    <div className="space-y-2.5">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-start justify-between gap-3 rounded-2xl border border-dashed border-border bg-muted/30 p-4"
        >
          <div className="min-w-0">
            <p className="font-semibold text-muted-foreground">{item.title}</p>
            <p className="text-[11.5px] text-muted-foreground">
              {item.doneCount ?? 0} student{item.doneCount === 1 ? "" : "s"} completed this before
              it was retired.
            </p>
          </div>
          <button
            type="button"
            disabled={restoringId === item.id}
            onClick={() => onRestore(item)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-[12px] font-semibold hover:bg-muted disabled:opacity-60"
          >
            <RotateCcw className="size-3.5" />
            {restoringId === item.id ? "Restoring…" : "Restore"}
          </button>
        </div>
      ))}
    </div>
  );
}

export function StaffDocumentList({
  documents,
  groups,
  onOpen,
}: {
  documents: ProgrammeDoc[];
  groups: { id: string; name: string }[];
  onOpen: (doc: ProgrammeDoc) => void;
}) {
  return (
    <div className="space-y-2.5">
      {documents.map((d) => (
        <div key={d.id} role="button" tabIndex={0} onClick={() => onOpen(d)} className={rowClass}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{d.label}</p>
              {d.description ? (
                <p className="line-clamp-2 text-[13px] text-muted-foreground">{d.description}</p>
              ) : null}
            </div>
            {!d.linkUrl ? (
              <span
                title="No link set yet — students will see 'Ask your programme office for this one.'"
                className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-amber-600"
              >
                <AlertTriangle className="size-3.5" /> No link
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
            <span className="capitalize">{d.category.replace(/_/g, " ")}</span>
            <span>·</span>
            <span>{audienceLabel(d.audience, groups)}</span>
            {d.linkUrl ? (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <ExternalLink className="size-3" /> {d.linkUrl}
                </span>
              </>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export function StaffContactList({
  contacts,
  groups,
  onOpen,
}: {
  contacts: ProgrammeContactRow[];
  groups: { id: string; name: string }[];
  onOpen: (contact: ProgrammeContactRow) => void;
}) {
  return (
    <div className="space-y-2.5">
      {contacts.map((c) => (
        <div
          key={c.id}
          role="button"
          tabIndex={0}
          onClick={() => onOpen(c)}
          className={`${rowClass} ${c.isEmergency ? "border-destructive/40" : ""}`}
        >
          <div className="flex items-start justify-between gap-3">
            <p className="font-semibold">{c.name}</p>
            {c.isEmergency ? (
              <span className="shrink-0 text-[11px] font-bold text-destructive">Emergency</span>
            ) : null}
          </div>
          <p className="text-[12px] text-muted-foreground">
            {[c.role, c.category.replace(/_/g, " ")].filter(Boolean).join(" · ")}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
            <span>{audienceLabel(c.audience, groups)}</span>
            {c.phone ? (
              <span className="inline-flex items-center gap-1">
                <Phone className="size-3" /> {c.phone}
              </span>
            ) : null}
            {c.whatsapp ? (
              <span className="inline-flex items-center gap-1">
                <MessageCircle className="size-3" /> WhatsApp
              </span>
            ) : null}
            {c.email ? (
              <span className="inline-flex items-center gap-1">
                <Mail className="size-3" /> {c.email}
              </span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export function StaffPlaceList({
  places,
  groups,
  onOpen,
}: {
  places: ProgrammePlace[];
  groups: { id: string; name: string }[];
  onOpen: (place: ProgrammePlace) => void;
}) {
  return (
    <div className="space-y-2.5">
      {places.map((p) => (
        <div key={p.id} role="button" tabIndex={0} onClick={() => onOpen(p)} className={rowClass}>
          <p className="font-semibold">{p.label}</p>
          <p className="text-[12px] capitalize text-muted-foreground">
            {p.category.replace(/_/g, " ")}
          </p>
          {p.address ? <p className="text-[12.5px] text-muted-foreground">{p.address}</p> : null}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
            <span>{audienceLabel(p.audience, groups)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
