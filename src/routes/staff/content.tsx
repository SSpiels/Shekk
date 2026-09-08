/**
 * Programme OS Content: where staff configure the checklist, documents,
 * contacts and places that already flow into the student app's Programme
 * Info tab (routes/programme.info.tsx), plus the cohort welcome message —
 * built entirely on the existing content/audience engine (see
 * lib/programme-ops.server.ts's staffContentOverview/upsertContent/
 * deleteContent). There is no second content system here, and no separate
 * publishing/scheduling/approval state: a row exists or it doesn't, and its
 * audience decides who sees it, exactly as it already worked for the mobile
 * staff ContentEditor.
 *
 * The dedicated /staff/onboarding page stays the operational completion
 * dashboard — this page is where the checklist itself gets configured.
 */
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckSquare, FileText, Info, MapPin, Phone, Plus, Sparkles } from "lucide-react";
import { EmptyState, ErrorState, LoadingBlocks } from "@/components/Kit";
import { useStaffOS } from "@/components/staff/StaffSessionContext";
import {
  StaffContentEditor,
  type ContentKind,
} from "@/components/staff/content/StaffContentEditor";
import {
  StaffChecklistList,
  StaffContactList,
  StaffDocumentList,
  StaffPlaceList,
  StaffRetiredChecklistList,
} from "@/components/staff/content/StaffContentLists";
import { StaffProgrammeInfoCard } from "@/components/staff/content/StaffProgrammeInfoCard";
import {
  useStaffContentOverview,
  useStaffRestoreChecklistItem,
  useStaffSeedChecklist,
} from "@/lib/useStaffContent";
import { useStaffStudentRoster } from "@/lib/useStaffStudents";
import {
  staffCan,
  type ChecklistItem,
  type ProgrammeContactRow,
  type ProgrammeDoc,
  type ProgrammePlace,
} from "@/lib/programme/logic";

export const Route = createFileRoute("/staff/content")({
  component: ContentScreen,
});

type Tab = "info" | "documents" | "contacts" | "places" | "checklist";
const TABS: { id: Tab; label: string; icon: typeof Info }[] = [
  { id: "info", label: "Programme information", icon: Info },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "contacts", label: "Contacts", icon: Phone },
  { id: "places", label: "Places", icon: MapPin },
  { id: "checklist", label: "Checklist", icon: CheckSquare },
];

const TAB_PERM: Record<Exclude<Tab, "info">, "documents" | "contacts" | "places" | "checklists"> = {
  documents: "documents",
  contacts: "contacts",
  places: "places",
  checklist: "checklists",
};

type EditorState =
  | { kind: "checklist_item"; item: ChecklistItem | null }
  | { kind: "document"; item: ProgrammeDoc | null }
  | { kind: "contact"; item: ProgrammeContactRow | null }
  | { kind: "place"; item: ProgrammePlace | null };

function ContentScreen() {
  const { activeWorkspace } = useStaffOS();
  const cohortId = activeWorkspace?.cohort?.id ?? null;

  const { data, isLoading, error, refetch } = useStaffContentOverview(cohortId);
  const roster = useStaffStudentRoster(cohortId);
  const seedChecklist = useStaffSeedChecklist(cohortId);
  const restoreItem = useStaffRestoreChecklistItem(cohortId);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const students = useMemo(
    () =>
      (roster.data ?? []).map((st) => ({
        userId: st.userId,
        displayName: st.displayName,
        handle: st.handle,
      })),
    [roster.data],
  );

  const [tab, setTab] = useState<Tab>("info");
  const [editor, setEditor] = useState<EditorState | null>(null);

  const canEdit = (perm: "documents" | "contacts" | "places" | "checklists") =>
    activeWorkspace
      ? staffCan(
          {
            programmeId: activeWorkspace.programmeId,
            cohortId: activeWorkspace.cohort?.id ?? null,
            role: activeWorkspace.role,
            permissions: activeWorkspace.permissions,
          },
          perm,
        )
      : false;

  if (!cohortId) {
    return (
      <EmptyState
        icon={FileText}
        title="No cohort yet"
        body="This programme doesn't have a cohort set up."
      />
    );
  }

  if (isLoading) return <LoadingBlocks rows={4} />;
  if (error) {
    return (
      <ErrorState
        body="We couldn't load Content. Check your connection and try again."
        onRetry={() => void refetch()}
      />
    );
  }
  if (!data) return null;

  const groups = data.groups.map((g) => ({ id: g.id, name: g.name }));
  const activeChecklist = data.checklist.filter((i) => !i.archivedAt);
  const retiredChecklist = data.checklist.filter((i) => i.archivedAt);
  const activeTabPerm = tab === "info" ? null : TAB_PERM[tab];
  const canEditActiveTab = activeTabPerm ? canEdit(activeTabPerm) : true;

  const openNew = (kind: ContentKind) => setEditor({ kind, item: null } as EditorState);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5 overflow-x-auto rounded-xl border border-border bg-card p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
                tab === t.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <t.icon className="size-3.5" /> {t.label}
            </button>
          ))}
        </div>

        {tab === "documents" && canEditActiveTab ? (
          <AddButton label="Add document" onClick={() => openNew("document")} />
        ) : null}
        {tab === "contacts" && canEditActiveTab ? (
          <AddButton label="Add contact" onClick={() => openNew("contact")} />
        ) : null}
        {tab === "places" && canEditActiveTab ? (
          <AddButton label="Add place" onClick={() => openNew("place")} />
        ) : null}
        {tab === "checklist" && canEditActiveTab ? (
          <AddButton label="Add checklist item" onClick={() => openNew("checklist_item")} />
        ) : null}
      </div>

      {tab === "info" ? (
        <StaffProgrammeInfoCard cohortId={cohortId} welcomeMessage={data.welcomeMessage} />
      ) : null}

      {tab === "documents" ? (
        data.documents.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No documents yet"
            body="Handbooks, packing lists, rules and useful PDFs — add a link and it appears in every eligible student's Programme Info tab."
          />
        ) : (
          <StaffDocumentList
            documents={data.documents}
            groups={groups}
            onOpen={(doc) => setEditor({ kind: "document", item: doc })}
          />
        )
      ) : null}

      {tab === "contacts" ? (
        data.contacts.length === 0 ? (
          <EmptyState
            icon={Phone}
            title="No contacts yet"
            body="Programme staff, emergency numbers and useful external contacts show up here, and students can call, WhatsApp or email straight from them."
          />
        ) : (
          <StaffContactList
            contacts={data.contacts}
            groups={groups}
            onOpen={(c) => setEditor({ kind: "contact", item: c })}
          />
        )
      ) : null}

      {tab === "places" ? (
        data.places.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title="No places yet"
            body="Accommodation, meeting points and campus locations show up here, with one-tap directions for students."
          />
        ) : (
          <StaffPlaceList
            places={data.places}
            groups={groups}
            onOpen={(p) => setEditor({ kind: "place", item: p })}
          />
        )
      ) : null}

      {tab === "checklist" ? (
        <div className="space-y-5">
          {activeChecklist.length === 0 ? (
            <div className="space-y-3">
              <EmptyState
                icon={CheckSquare}
                title="No checklist yet"
                body="What students need to sort before they fly and while they're here — each item can be required, have a due date, and target a specific audience."
              />
              {canEditActiveTab ? (
                <div className="flex justify-center">
                  <button
                    type="button"
                    disabled={seedChecklist.isPending}
                    onClick={() => seedChecklist.mutate()}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2 text-[13px] font-semibold hover:bg-muted disabled:opacity-60"
                  >
                    <Sparkles className="size-4" />
                    {seedChecklist.isPending ? "Adding…" : "Start from Shekk's standard checklist"}
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <StaffChecklistList
              items={activeChecklist}
              groups={groups}
              onOpen={(item) => setEditor({ kind: "checklist_item", item })}
            />
          )}

          {retiredChecklist.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[12.5px] font-semibold text-muted-foreground">
                Retired — hidden from students, completion history kept
              </p>
              <StaffRetiredChecklistList
                items={retiredChecklist}
                restoringId={restoringId}
                onRestore={(item) => {
                  setRestoringId(item.id);
                  restoreItem.mutate(item.id, { onSettled: () => setRestoringId(null) });
                }}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {editor ? (
        <StaffContentEditor
          key={editor.item?.id ?? `new-${editor.kind}`}
          open
          onClose={() => setEditor(null)}
          cohortId={cohortId}
          kind={editor.kind}
          item={editor.item as never}
          groups={groups}
          students={students}
        />
      ) : null}
    </div>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-[13px] font-semibold text-primary-foreground"
    >
      <Plus className="size-4" /> {label}
    </button>
  );
}
