/**
 * Desktop create/edit dialog for the four simple content kinds Content
 * manages — checklist items, documents, contacts, places. Same fields, same
 * server function (staffUpsertContent, backed by programme-ops.server.ts's
 * upsertContent) as the mobile ContentEditor in components/programme/Staff
 * .tsx — a new presentation over identical underlying behaviour. Mobile only
 * ever creates (it never passes an id); this editor also supports editing an
 * existing row in place, which upsertContent already handled — it just had
 * no caller that exercised that path yet.
 */
import { useState, type ReactNode } from "react";
import { FileText, Phone, MapPin, CheckSquare, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  CONTACT_CATEGORIES,
  PLACE_CATEGORIES,
  everyone,
  type Audience,
  type ChecklistItem,
  type ProgrammeContactRow,
  type ProgrammeDoc,
  type ProgrammePlace,
} from "@/lib/programme/logic";
import { useStaffDeleteContent, useStaffUpsertContent } from "@/lib/useStaffContent";
import { StaffAudiencePicker } from "@/components/staff/communications/StaffAudiencePicker";
import { cleanError } from "@/lib/useProgrammeHub";

const inputClass =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

export type ContentKind = "checklist_item" | "document" | "contact" | "place";

const KIND_ICON: Record<ContentKind, typeof FileText> = {
  checklist_item: CheckSquare,
  document: FileText,
  contact: Phone,
  place: MapPin,
};

const KIND_TITLE: Record<ContentKind, string> = {
  checklist_item: "checklist item",
  document: "document",
  contact: "contact",
  place: "place",
};

type ItemFor<K extends ContentKind> = K extends "checklist_item"
  ? ChecklistItem
  : K extends "document"
    ? ProgrammeDoc
    : K extends "contact"
      ? ProgrammeContactRow
      : ProgrammePlace;

export function StaffContentEditor<K extends ContentKind>({
  open,
  onClose,
  cohortId,
  kind,
  item,
  groups,
  students,
}: {
  open: boolean;
  onClose: () => void;
  cohortId: string;
  kind: K;
  /** null = creating a new row. */
  item: ItemFor<K> | null;
  groups: { id: string; name: string }[];
  students: { userId: string; displayName: string; handle: string | null }[];
}) {
  const upsert = useStaffUpsertContent(cohortId);
  const del = useStaffDeleteContent(cohortId);
  const Icon = KIND_ICON[kind] as typeof FileText;

  const checklistItem = kind === "checklist_item" ? (item as ChecklistItem | null) : null;
  const doc = kind === "document" ? (item as ProgrammeDoc | null) : null;
  const contact = kind === "contact" ? (item as ProgrammeContactRow | null) : null;
  const place = kind === "place" ? (item as ProgrammePlace | null) : null;

  const [title, setTitle] = useState(checklistItem?.title ?? "");
  const [details, setDetails] = useState(checklistItem?.details ?? "");
  const [dueOn, setDueOn] = useState(checklistItem?.dueOn ?? "");
  const [actionUrl, setActionUrl] = useState(checklistItem?.actionUrl ?? "");
  const [required, setRequired] = useState(checklistItem?.required ?? true);

  const [label, setLabel] = useState(doc?.label ?? place?.label ?? "");
  const [description, setDescription] = useState(doc?.description ?? "");
  const [linkUrl, setLinkUrl] = useState(doc?.linkUrl ?? "");
  const [docCategory, setDocCategory] = useState(doc?.category ?? "other");

  const [name, setName] = useState(contact?.name ?? "");
  const [role, setRole] = useState(contact?.role ?? "");
  const [contactCategory, setContactCategory] = useState(contact?.category ?? "staff");
  const [phone, setPhone] = useState(contact?.phone ?? "");
  const [whatsapp, setWhatsapp] = useState(contact?.whatsapp ?? "");
  const [email, setEmail] = useState(contact?.email ?? "");
  const [availability, setAvailability] = useState(contact?.availability ?? "");
  const [notes, setNotes] = useState(contact?.notes ?? "");
  const [isEmergency, setIsEmergency] = useState(contact?.isEmergency ?? false);

  const [placeCategory, setPlaceCategory] = useState(place?.category ?? "other");
  const [address, setAddress] = useState(place?.address ?? "");
  const [meetingInstructions, setMeetingInstructions] = useState(place?.meetingInstructions ?? "");
  const [placeNotes, setPlaceNotes] = useState(place?.notes ?? "");

  const [audience, setAudience] = useState<Audience>(item?.audience ?? everyone);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const busy = upsert.isPending;
  const doneCount = checklistItem?.doneCount ?? 0;

  function save() {
    setError(null);
    const onDone = {
      onSuccess: onClose,
      onError: (e: unknown) => setError(cleanError(e, "We couldn't save that.")),
    };

    if (kind === "checklist_item") {
      if (!title.trim()) return setError("Give the item a title.");
      upsert.mutate(
        {
          kind: "checklist_item",
          cohortId,
          ...(item ? { id: item.id } : {}),
          audience,
          values: {
            item_key:
              checklistItem?.itemKey ??
              title
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "_")
                .slice(0, 60),
            title: title.trim(),
            details: details.trim() || null,
            due_on: dueOn || null,
            required,
            action_url: actionUrl.trim() || null,
            feature_key: checklistItem?.featureKey ?? null,
          },
        },
        onDone,
      );
      return;
    }
    if (kind === "document") {
      if (!label.trim()) return setError("Give the document a name.");
      upsert.mutate(
        {
          kind: "document",
          cohortId,
          ...(item ? { id: item.id } : {}),
          audience,
          values: {
            label: label.trim(),
            description: description.trim() || null,
            link_url: linkUrl.trim() || null,
            category: docCategory,
          },
        },
        onDone,
      );
      return;
    }
    if (kind === "contact") {
      if (!name.trim()) return setError("Who is it?");
      upsert.mutate(
        {
          kind: "contact",
          cohortId,
          ...(item ? { id: item.id } : {}),
          audience,
          values: {
            name: name.trim(),
            role: role.trim() || null,
            category: contactCategory,
            phone: phone.trim() || null,
            whatsapp: whatsapp.trim() || null,
            email: email.trim() || null,
            notes: notes.trim() || null,
            availability: availability.trim() || null,
            is_emergency: isEmergency,
          },
        },
        onDone,
      );
      return;
    }
    if (!label.trim()) return setError("Give the place a name.");
    upsert.mutate(
      {
        kind: "place",
        cohortId,
        ...(item ? { id: item.id } : {}),
        audience,
        values: {
          label: label.trim(),
          category: placeCategory,
          notes: placeNotes.trim() || null,
          meeting_instructions: meetingInstructions.trim() || null,
          google_place_id: place?.googlePlaceId ?? null,
          address: address.trim() || null,
          latitude: place?.latitude ?? null,
          longitude: place?.longitude ?? null,
        },
      },
      onDone,
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="size-4.5 text-primary" />
            {item ? `Edit ${KIND_TITLE[kind]}` : `New ${KIND_TITLE[kind]}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {kind === "checklist_item" ? (
            <>
              <Labelled label="Title">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={inputClass}
                />
              </Labelled>
              <Labelled label="Details / instructions">
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  rows={3}
                  className={inputClass}
                />
              </Labelled>
              <div className="grid grid-cols-2 gap-3">
                <Labelled label="Due date">
                  <input
                    type="date"
                    value={dueOn}
                    onChange={(e) => setDueOn(e.target.value)}
                    className={inputClass}
                  />
                </Labelled>
                <Labelled label="Link inside Shekk (optional)">
                  <input
                    value={actionUrl}
                    onChange={(e) => setActionUrl(e.target.value)}
                    className={inputClass}
                    placeholder="/services/esim"
                  />
                </Labelled>
              </div>
              <label className="flex items-center gap-2 text-[13px] font-medium">
                <input
                  type="checkbox"
                  checked={required}
                  onChange={(e) => setRequired(e.target.checked)}
                  className="size-3.5"
                />
                Required
              </label>
              {doneCount > 0 ? (
                <p className="text-[11.5px] text-muted-foreground">
                  {doneCount} student{doneCount === 1 ? " has" : "s have"} already marked this done.
                </p>
              ) : null}
            </>
          ) : null}

          {kind === "document" ? (
            <>
              <Labelled label="Name">
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className={inputClass}
                />
              </Labelled>
              <Labelled label="Description">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className={inputClass}
                />
              </Labelled>
              <Labelled label="Category">
                <select
                  value={docCategory}
                  onChange={(e) => setDocCategory(e.target.value)}
                  className={inputClass}
                >
                  {["handbook", "packing_list", "rules", "form", "letter", "other"].map((c) => (
                    <option key={c} value={c}>
                      {c.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </Labelled>
              <Labelled
                label="Link"
                hint="Native file upload isn't part of V1 yet — share a link (Drive, Dropbox, a PDF URL) instead."
              >
                <input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  className={inputClass}
                  placeholder="https://"
                />
              </Labelled>
            </>
          ) : null}

          {kind === "contact" ? (
            <>
              <Labelled label="Name">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                />
              </Labelled>
              <div className="grid grid-cols-2 gap-3">
                <Labelled label="Role">
                  <input
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className={inputClass}
                    placeholder="Madrich"
                  />
                </Labelled>
                <Labelled label="Category">
                  <select
                    value={contactCategory}
                    onChange={(e) => setContactCategory(e.target.value)}
                    className={inputClass}
                  >
                    {CONTACT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </Labelled>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Labelled label="Phone">
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={inputClass}
                    inputMode="tel"
                  />
                </Labelled>
                <Labelled label="WhatsApp">
                  <input
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    className={inputClass}
                    inputMode="tel"
                  />
                </Labelled>
              </div>
              <Labelled label="Email">
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  inputMode="email"
                />
              </Labelled>
              <Labelled label="When to call">
                <input
                  value={availability}
                  onChange={(e) => setAvailability(e.target.value)}
                  className={inputClass}
                  placeholder="24/7"
                />
              </Labelled>
              <Labelled label="Notes">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className={inputClass}
                />
              </Labelled>
              <label className="flex items-center gap-2 text-[13px] font-medium">
                <input
                  type="checkbox"
                  checked={isEmergency}
                  onChange={(e) => setIsEmergency(e.target.checked)}
                  className="size-3.5"
                />
                Emergency contact
              </label>
            </>
          ) : null}

          {kind === "place" ? (
            <>
              <Labelled label="Name">
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className={inputClass}
                />
              </Labelled>
              <Labelled label="Category">
                <select
                  value={placeCategory}
                  onChange={(e) => setPlaceCategory(e.target.value)}
                  className={inputClass}
                >
                  {PLACE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </Labelled>
              <Labelled label="Address">
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className={inputClass}
                />
              </Labelled>
              <Labelled label="How to find it">
                <textarea
                  value={meetingInstructions}
                  onChange={(e) => setMeetingInstructions(e.target.value)}
                  rows={2}
                  className={inputClass}
                />
              </Labelled>
              <Labelled label="Notes">
                <textarea
                  value={placeNotes}
                  onChange={(e) => setPlaceNotes(e.target.value)}
                  rows={2}
                  className={inputClass}
                />
              </Labelled>
            </>
          ) : null}

          <Labelled label="Who sees this">
            <StaffAudiencePicker
              value={audience}
              onChange={setAudience}
              groups={groups}
              students={students}
            />
          </Labelled>

          {confirmingDelete ? (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5">
              <span className="text-[12.5px] font-medium text-destructive">
                {kind === "checklist_item" && doneCount > 0
                  ? `${doneCount} student${doneCount === 1 ? " has" : "s have"} completed this — it'll be retired instead of deleted, so their completion record${doneCount === 1 ? "" : "s"} stay${doneCount === 1 ? "s" : ""} intact. Students stop seeing it; you can restore it later.`
                  : "Delete this for everyone? This can't be undone."}
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
                  disabled={del.isPending}
                  onClick={() => del.mutate({ kind, id: item!.id }, { onSuccess: onClose })}
                  className="rounded-lg bg-destructive px-2.5 py-1 text-[12px] font-semibold text-destructive-foreground disabled:opacity-60"
                >
                  {kind === "checklist_item" && doneCount > 0
                    ? del.isPending
                      ? "Retiring…"
                      : "Yes, retire it"
                    : "Yes, delete"}
                </button>
              </div>
            </div>
          ) : null}

          {error ? <p className="text-[12.5px] font-medium text-destructive">{error}</p> : null}

          <div className="flex items-center justify-between gap-2 pt-1">
            {item ? (
              <button
                type="button"
                disabled={del.isPending}
                onClick={() => setConfirmingDelete(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/30 px-3.5 py-2 text-[13px] font-semibold text-destructive"
              >
                <Trash2 className="size-4" />
                {kind === "checklist_item" && doneCount > 0 ? "Retire" : "Delete"}
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
                onClick={save}
                disabled={busy}
                className="rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground disabled:opacity-60"
              >
                {busy ? "Saving…" : item ? "Save changes" : "Add"}
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Labelled({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[12.5px] font-semibold text-muted-foreground">{label}</label>
      {children}
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
