/**
 * Shekk Console — Programmes.
 *
 * Internal operators run programme onboarding from here: create and edit
 * programmes and cohorts, verify them, manage owners/staff and claim invites,
 * and inspect what a cohort actually holds. Every action goes through the
 * existing `admin*` server functions, which prove the caller holds the Shekk
 * `admin` role server-side before the service role is ever loaded — the code
 * gate and this UI are convenience only.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Archive,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  FlaskConical,
  Copy,
  KeyRound,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { PageTitle, Panel, Pill, Stat } from "@/components/admin/AdminUI";
import { ActionButton, Field, Sheet, inputClass } from "@/components/programme/Bits";
import {
  useAdminCohortDetail,
  useAdminProgrammeActions,
  useAdminProgrammeEditing,
  useAdminProgrammes,
  useAdminTestProgramme,
} from "@/lib/useProgrammeHub";
import { cleanError } from "@/lib/useProgrammeHub";

export const Route = createFileRoute("/admin/programmes")({
  component: Programmes,
});

type Row = NonNullable<ReturnType<typeof useAdminProgrammes>["data"]>[number];
type Cohort = Row["cohorts"][number];

const PROGRAMME_TYPES = ["gap_year", "yeshiva", "seminary", "masa", "university", "internship", "other"] as const;

const typeLabel = (t: string) => t.replace(/_/g, " ");

function Empty({ children }: { children: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

function Programmes() {
  const list = useAdminProgrammes();
  const actions = useAdminProgrammeActions();
  const editing = useAdminProgrammeEditing();

  const [query, setQuery] = useState("");
  const [openProgramme, setOpenProgramme] = useState<string | null>(null);
  const [newProgramme, setNewProgramme] = useState(false);
  const [openCohort, setOpenCohort] = useState<{ programme: Row; cohort: Cohort } | null>(null);

  const rows = list.data ?? [];
  const selected = openProgramme ? (rows.find((r) => r.id === openProgramme) ?? null) : null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.name, r.organisation, r.city, r.slug, ...r.cohorts.map((c) => `${c.name} ${c.joinCode}`)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [rows, query]);

  const totals = useMemo(() => {
    const cohorts = rows.flatMap((r) => r.cohorts);
    return {
      programmes: rows.length,
      verified: rows.filter((r) => r.verified).length,
      cohorts: cohorts.length,
      participants: cohorts.reduce((n, c) => n + c.participants, 0),
      staff: rows.reduce((n, r) => n + r.staff.length, 0),
      pendingInvites: rows.reduce((n, r) => n + r.invites.filter((i) => !i.accepted).length, 0),
    };
  }, [rows]);

  return (
    <div>
      <PageTitle
        title="Programmes"
        subtitle="Internal Shekk onboarding and oversight. Programme staff manage their own day-to-day content in the programme staff hub — these controls are Shekk-operator only."
      />

      {list.isLoading ? (
        <Panel>
          <p className="py-10 text-center text-sm text-muted-foreground">Loading programmes…</p>
        </Panel>
      ) : list.error ? (
        <Panel>
          <p className="py-6 text-center text-sm text-destructive">
            {cleanError(list.error, "We couldn't load programmes.")}
          </p>
          <div className="flex justify-center">
            <ActionButton tone="ghost" onClick={() => void list.refetch()}>
              Try again
            </ActionButton>
          </div>
        </Panel>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-6">
            <Stat label="Programmes" value={String(totals.programmes)} />
            <Stat label="Verified" value={String(totals.verified)} tone="positive" />
            <Stat label="Cohorts" value={String(totals.cohorts)} />
            <Stat label="Participants" value={String(totals.participants)} />
            <Stat label="Staff" value={String(totals.staff)} />
            <Stat label="Open invites" value={String(totals.pendingInvites)} />
          </div>

          <div className="mb-6">
            <TestbedPanel />
          </div>



          <Panel
            title="All programmes"
            action={
              <button
                type="button"
                onClick={() => setNewProgramme(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
              >
                <Plus className="size-4" /> New programme
              </button>
            }
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, organisation, city or join code"
              aria-label="Search programmes"
              className={`${inputClass} mb-4`}
            />

            {filtered.length === 0 ? (
              <Empty>
                {rows.length === 0
                  ? "No programmes yet. Create the first one to start onboarding a partner."
                  : "No programmes match that search."}
              </Empty>
            ) : (
              <ul className="space-y-3">
                {filtered.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setOpenProgramme(r.id)}
                      className="tap-flat flex w-full items-start gap-3 rounded-2xl border border-border bg-card p-4 text-left"
                    >
                      <span className="mt-0.5 rounded-xl bg-muted p-2">
                        <Building2 className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-display text-[15px] font-bold">{r.name}</span>
                          {r.verified ? <Pill tone="success">Verified</Pill> : <Pill>Unverified</Pill>}
                          {r.status !== "active" ? <Pill tone="warning">{r.status}</Pill> : null}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {[r.organisation, r.city, typeLabel(r.programmeType)].filter(Boolean).join(" · ")}
                        </span>
                        <span className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold text-muted-foreground">
                          <span>{r.cohorts.length} cohorts</span>
                          <span>{r.cohorts.reduce((n, c) => n + c.participants, 0)} participants</span>
                          <span>{r.staff.length} staff</span>
                        </span>
                      </span>
                      <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}

      <NewProgrammeSheet
        open={newProgramme}
        onClose={() => setNewProgramme(false)}
        actions={actions}
      />

      {selected ? (
        <ProgrammeSheet
          programme={selected}
          onClose={() => setOpenProgramme(null)}
          onOpenCohort={(cohort) => setOpenCohort({ programme: selected, cohort })}
          actions={actions}
          editing={editing}
        />
      ) : null}

      {openCohort ? (
        <CohortSheet
          programme={openCohort.programme}
          cohort={openCohort.cohort}
          onClose={() => setOpenCohort(null)}
          editing={editing}
        />
      ) : null}
    </div>
  );
}

/* ─────────────────────────────── Create programme ─────────────────────────── */

function NewProgrammeSheet({
  open,
  onClose,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  actions: ReturnType<typeof useAdminProgrammeActions>;
}) {
  const [name, setName] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [city, setCity] = useState("");
  const [programmeType, setProgrammeType] = useState<string>("gap_year");
  const create = actions.createProgramme;

  return (
    <Sheet open={open} onClose={onClose} title="New programme">
      <div className="space-y-3">
        <Field label="Programme name">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Organisation">
          <input value={organisation} onChange={(e) => setOrganisation(e.target.value)} className={inputClass} />
        </Field>
        <Field label="City">
          <input value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Type">
          <select value={programmeType} onChange={(e) => setProgrammeType(e.target.value)} className={inputClass}>
            {PROGRAMME_TYPES.map((t) => (
              <option key={t} value={t}>
                {typeLabel(t)}
              </option>
            ))}
          </select>
        </Field>
        {create.error ? (
          <p className="text-xs text-destructive">{cleanError(create.error, "We couldn't create that programme.")}</p>
        ) : null}
        <ActionButton
          className="w-full"
          disabled={name.trim().length < 2 || create.isPending}
          onClick={() =>
            create.mutate(
              {
                name: name.trim(),
                organisation: organisation.trim() || null,
                city: city.trim() || null,
                programmeType,
              },
              {
                onSuccess: () => {
                  setName("");
                  setOrganisation("");
                  setCity("");
                  onClose();
                },
              },
            )
          }
        >
          {create.isPending ? "Creating…" : "Create programme"}
        </ActionButton>
      </div>
    </Sheet>
  );
}

/* ───────────────────────────── Programme detail ───────────────────────────── */

function ProgrammeSheet({
  programme,
  onClose,
  onOpenCohort,
  actions,
  editing,
}: {
  programme: Row;
  onClose: () => void;
  onOpenCohort: (c: Cohort) => void;
  actions: ReturnType<typeof useAdminProgrammeActions>;
  editing: ReturnType<typeof useAdminProgrammeEditing>;
}) {
  const [tab, setTab] = useState<"config" | "cohorts" | "people">("config");

  return (
    <Sheet open onClose={onClose} title={programme.name}>
      <div className="mb-4 flex gap-1 rounded-2xl bg-muted p-1">
        {(["config", "cohorts", "people"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold capitalize ${
              tab === t ? "bg-card shadow-card" : "text-muted-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "config" ? <ProgrammeConfig programme={programme} editing={editing} actions={actions} /> : null}
      {tab === "cohorts" ? (
        <ProgrammeCohorts programme={programme} actions={actions} onOpenCohort={onOpenCohort} />
      ) : null}
      {tab === "people" ? <ProgrammePeople programme={programme} actions={actions} editing={editing} /> : null}
    </Sheet>
  );
}

function ProgrammeConfig({
  programme,
  editing,
  actions,
}: {
  programme: Row;
  editing: ReturnType<typeof useAdminProgrammeEditing>;
  actions: ReturnType<typeof useAdminProgrammeActions>;
}) {
  const [name, setName] = useState(programme.name);
  const [organisation, setOrganisation] = useState(programme.organisation ?? "");
  const [city, setCity] = useState(programme.city ?? "");
  const [slug, setSlug] = useState(programme.slug ?? "");
  const [programmeType, setProgrammeType] = useState(programme.programmeType);
  const save = editing.updateProgramme;
  const flags = actions.setFlags;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
        <ShieldCheck className="size-4 text-primary" />
        <p className="min-w-0 flex-1 text-[11px] font-semibold text-muted-foreground">
          Shekk operator controls. Programme staff cannot verify, archive or reassign owners.
        </p>
      </div>

      <Field label="Programme name">
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </Field>
      <Field label="Organisation">
        <input value={organisation} onChange={(e) => setOrganisation(e.target.value)} className={inputClass} />
      </Field>
      <Field label="City">
        <input value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
      </Field>
      <Field label="Slug" hint="Used in shareable programme links.">
        <input value={slug} onChange={(e) => setSlug(e.target.value)} className={inputClass} />
      </Field>
      <Field label="Type">
        <select value={programmeType} onChange={(e) => setProgrammeType(e.target.value)} className={inputClass}>
          {PROGRAMME_TYPES.map((t) => (
            <option key={t} value={t}>
              {typeLabel(t)}
            </option>
          ))}
        </select>
      </Field>

      {save.error ? (
        <p className="text-xs text-destructive">{cleanError(save.error, "We couldn't save those changes.")}</p>
      ) : null}
      <ActionButton
        className="w-full"
        disabled={save.isPending || name.trim().length < 2}
        onClick={() =>
          save.mutate({
            programmeId: programme.id,
            name: name.trim(),
            organisation: organisation.trim() || null,
            city: city.trim() || null,
            slug: slug.trim() || null,
            programmeType,
          })
        }
      >
        {save.isPending ? "Saving…" : save.isSuccess ? "Saved" : "Save changes"}
      </ActionButton>

      <div className="mt-2 space-y-2 rounded-2xl border border-border bg-card p-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Status</p>
        <div className="flex flex-wrap gap-2">
          <ActionButton
            tone={programme.verified ? "ghost" : "primary"}
            disabled={flags.isPending}
            onClick={() => flags.mutate({ programmeId: programme.id, verified: !programme.verified })}
          >
            {programme.verified ? (
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-4" /> Remove verification
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="size-4" /> Mark verified
              </span>
            )}
          </ActionButton>
          <ActionButton
            tone={programme.status === "active" ? "danger" : "ghost"}
            disabled={flags.isPending}
            onClick={() => flags.mutate({ programmeId: programme.id, active: programme.status !== "active" })}
          >
            {programme.status === "active" ? "Deactivate" : "Reactivate"}
          </ActionButton>
          <ActionButton
            tone="danger"
            disabled={save.isPending || programme.status === "archived"}
            onClick={() => save.mutate({ programmeId: programme.id, status: "archived" })}
          >
            <span className="inline-flex items-center gap-1.5">
              <Archive className="size-4" /> Archive
            </span>
          </ActionButton>
        </div>
        {flags.error ? (
          <p className="text-xs text-destructive">{cleanError(flags.error, "We couldn't update that programme.")}</p>
        ) : null}
      </div>
    </div>
  );
}

function ProgrammeCohorts({
  programme,
  actions,
  onOpenCohort,
}: {
  programme: Row;
  actions: ReturnType<typeof useAdminProgrammeActions>;
  onOpenCohort: (c: Cohort) => void;
}) {
  const [name, setName] = useState("");
  const [year, setYear] = useState("");
  const create = actions.createCohort;

  return (
    <div className="space-y-4">
      {programme.cohorts.length === 0 ? (
        <Empty>No cohorts yet. Add the first intake below.</Empty>
      ) : (
        <ul className="space-y-2">
          {programme.cohorts.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onOpenCohort(c)}
                className="tap-flat flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-bold">{c.name}</span>
                    {c.year ? <Pill>{c.year}</Pill> : null}
                    {c.status !== "open" ? <Pill tone="warning">{c.status}</Pill> : null}
                  </span>
                  <span className="mt-0.5 block text-[11px] font-semibold text-muted-foreground">
                    {c.participants} participants · {c.events} events · code {c.joinCode}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2 rounded-2xl border border-border bg-card p-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">New cohort</p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Cohort name (e.g. Autumn intake)"
          className={inputClass}
        />
        <input value={year} onChange={(e) => setYear(e.target.value)} placeholder="Year (5786)" className={inputClass} />
        {create.error ? (
          <p className="text-xs text-destructive">{cleanError(create.error, "We couldn't create that cohort.")}</p>
        ) : null}
        <ActionButton
          className="w-full"
          disabled={!name.trim() || create.isPending}
          onClick={() =>
            create.mutate(
              { programmeId: programme.id, name: name.trim(), year: year.trim() || null },
              {
                onSuccess: () => {
                  setName("");
                  setYear("");
                },
              },
            )
          }
        >
          {create.isPending ? "Creating…" : "Create cohort"}
        </ActionButton>
      </div>
    </div>
  );
}

function ProgrammePeople({
  programme,
  actions,
  editing,
}: {
  programme: Row;
  actions: ReturnType<typeof useAdminProgrammeActions>;
  editing: ReturnType<typeof useAdminProgrammeEditing>;
}) {
  const [email, setEmail] = useState("");
  const assign = actions.assignOwner;
  const invite = actions.createInvite;
  const { setStaffRole, removeStaff, revokeInvite } = editing;
  const pending = programme.invites.filter((i) => !i.accepted);

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Programme staff</p>
        {programme.staff.length === 0 ? (
          <Empty>No staff yet. Assign an owner or send a claim invite.</Empty>
        ) : (
          <ul className="space-y-2">
            {programme.staff.map((s) => (
              <li key={s.userId} className="rounded-2xl border border-border bg-card p-3">
                <div className="flex items-center gap-2">
                  <Users className="size-4 shrink-0 text-muted-foreground" />
                  <p className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{s.email ?? s.userId}</p>
                  <Pill tone={s.role === "owner" ? "primary" : "muted"}>{s.role}</Pill>
                </div>
                <div className="mt-2 flex gap-2">
                  <ActionButton
                    tone="ghost"
                    disabled={setStaffRole.isPending}
                    onClick={() =>
                      setStaffRole.mutate({
                        programmeId: programme.id,
                        userId: s.userId,
                        role: s.role === "owner" ? "staff" : "owner",
                      })
                    }
                  >
                    Make {s.role === "owner" ? "staff" : "owner"}
                  </ActionButton>
                  <ActionButton
                    tone="danger"
                    disabled={removeStaff.isPending}
                    onClick={() => removeStaff.mutate({ programmeId: programme.id, userId: s.userId })}
                  >
                    <Trash2 className="size-4" />
                  </ActionButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2 rounded-2xl border border-border bg-card p-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Add an owner</p>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="owner@programme.org"
          inputMode="email"
          className={inputClass}
        />
        {assign.error ? (
          <p className="text-xs text-destructive">{cleanError(assign.error, "We couldn't assign that owner.")}</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <ActionButton
            disabled={!email.includes("@") || assign.isPending}
            onClick={() =>
              assign.mutate(
                { programmeId: programme.id, email: email.trim() },
                { onSuccess: () => setEmail("") },
              )
            }
          >
            {assign.isPending ? "Assigning…" : "Assign existing account"}
          </ActionButton>
          <ActionButton
            tone="ghost"
            disabled={invite.isPending}
            onClick={() => invite.mutate({ programmeId: programme.id, email: email.trim() || null })}
          >
            <span className="inline-flex items-center gap-1.5">
              <KeyRound className="size-4" /> Create claim code
            </span>
          </ActionButton>
        </div>
        {invite.data ? <CodeRow label="Claim code" code={invite.data.code} /> : null}
        {invite.error ? (
          <p className="text-xs text-destructive">{cleanError(invite.error, "We couldn't create that invite.")}</p>
        ) : null}
      </div>

      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Open claim codes</p>
        {pending.length === 0 ? (
          <Empty>No open invites.</Empty>
        ) : (
          <ul className="space-y-2">
            {pending.map((i) => (
              <li key={i.id} className="flex items-center gap-2 rounded-2xl border border-border bg-card p-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-[13px] font-bold">{i.code}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {i.role} · {i.kind}
                  </span>
                </span>
                <ActionButton
                  tone="danger"
                  disabled={revokeInvite.isPending}
                  onClick={() => revokeInvite.mutate({ inviteId: i.id })}
                >
                  Revoke
                </ActionButton>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function CodeRow({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-muted p-3">
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className="block truncate font-mono text-[15px] font-bold">{code}</span>
      </span>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(code);
          setCopied(true);
        }}
        className="tap-flat flex items-center gap-1.5 rounded-xl bg-card px-3 py-2 text-xs font-bold"
      >
        <Copy className="size-3.5" /> {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

/* ─────────────────────────────── Cohort detail ────────────────────────────── */

function CohortSheet({
  programme,
  cohort,
  onClose,
  editing,
}: {
  programme: Row;
  cohort: Cohort;
  onClose: () => void;
  editing: ReturnType<typeof useAdminProgrammeEditing>;
}) {
  const detail = useAdminCohortDetail(cohort.id);
  const save = editing.updateCohort;
  const [tab, setTab] = useState<"config" | "people" | "content">("config");

  const [name, setName] = useState(cohort.name);
  const [year, setYear] = useState(cohort.year ?? "");
  const [code, setCode] = useState(cohort.joinCode);

  return (
    <Sheet open onClose={onClose} title={`${programme.name} · ${cohort.name}`}>
      <div className="mb-4 flex gap-1 rounded-2xl bg-muted p-1">
        {(["config", "people", "content"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold capitalize ${
              tab === t ? "bg-card shadow-card" : "text-muted-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "config" ? (
        <div className="space-y-3">
          <Field label="Cohort name">
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Year">
            <input value={year} onChange={(e) => setYear(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Join code" hint="Participants enter this at /join or on the programme tab.">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className={`${inputClass} font-mono`}
            />
          </Field>
          <CodeRow label="Join link" code={`/join/${cohort.joinCode}`} />
          {save.error ? (
            <p className="text-xs text-destructive">{cleanError(save.error, "We couldn't save that cohort.")}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <ActionButton
              disabled={save.isPending || !name.trim()}
              onClick={() =>
                save.mutate({
                  cohortId: cohort.id,
                  name: name.trim(),
                  year: year.trim() || null,
                  joinCode: code.trim() || null,
                })
              }
            >
              {save.isPending ? "Saving…" : "Save cohort"}
            </ActionButton>
            <ActionButton
              tone="ghost"
              disabled={save.isPending}
              onClick={() =>
                save.mutate(
                  { cohortId: cohort.id, regenerateJoinCode: true },
                  { onSuccess: (r) => setCode(r.joinCode ?? code) },
                )
              }
            >
              <span className="inline-flex items-center gap-1.5">
                <RefreshCw className="size-4" /> New code
              </span>
            </ActionButton>
            <ActionButton
              tone={cohort.status === "open" ? "danger" : "ghost"}
              disabled={save.isPending}
              onClick={() =>
                save.mutate({ cohortId: cohort.id, status: cohort.status === "open" ? "closed" : "open" })
              }
            >
              {cohort.status === "open" ? "Close joining" : "Reopen joining"}
            </ActionButton>
            <ActionButton
              tone="danger"
              disabled={save.isPending || cohort.status === "archived"}
              onClick={() => save.mutate({ cohortId: cohort.id, status: "archived" })}
            >
              <span className="inline-flex items-center gap-1.5">
                <Archive className="size-4" /> Archive
              </span>
            </ActionButton>
          </div>
        </div>
      ) : null}

      {tab !== "config" ? (
        detail.isLoading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading cohort…</p>
        ) : detail.error || !detail.data ? (
          <div className="py-6 text-center">
            <p className="text-sm text-destructive">{cleanError(detail.error, "We couldn't load this cohort.")}</p>
            <ActionButton tone="ghost" className="mt-3" onClick={() => void detail.refetch()}>
              Try again
            </ActionButton>
          </div>
        ) : tab === "people" ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Participants" value={String(detail.data.participants.length)} />
              <Stat label="Groups" value={String(detail.data.groups.length)} />
            </div>
            {detail.data.participants.length === 0 ? (
              <Empty>Nobody has joined with this code yet.</Empty>
            ) : (
              <ul className="space-y-2">
                {detail.data.participants.map((p) => (
                  <li
                    key={p.userId}
                    className="flex items-center gap-2 rounded-2xl border border-border bg-card p-3"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold">{p.name}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {p.handle ? `@${p.handle} · ` : ""}
                        {p.checklistDone} checklist done
                      </span>
                    </span>
                    {p.groupIds.length ? <Pill>{p.groupIds.length} groups</Pill> : null}
                  </li>
                ))}
              </ul>
            )}
            {detail.data.groups.length ? (
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Groups</p>
                <ul className="space-y-2">
                  {detail.data.groups.map((g) => (
                    <li
                      key={g.id}
                      className="flex items-center justify-between rounded-2xl border border-border bg-card p-3 text-[13.5px] font-semibold"
                    >
                      <span className="truncate">{g.name}</span>
                      <Pill>{g.members} members</Pill>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <ContentTab data={detail.data.content} />
        )
      ) : null}
    </Sheet>
  );
}

function ContentTab({
  data,
}: {
  data: NonNullable<ReturnType<typeof useAdminCohortDetail>["data"]>["content"];
}) {
  const sections: { label: string; items: { id: string; primary: string; secondary?: string }[] }[] = [
    {
      label: "Events",
      items: data.events.map((e) => ({
        id: e.id,
        primary: e.title,
        secondary: `${new Date(e.startsAt).toLocaleString("en-GB", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })} · ${e.status} · ${e.audienceKind}`,
      })),
    },
    {
      label: "Announcements",
      items: data.announcements.map((a) => ({ id: a.id, primary: a.title, secondary: a.priority })),
    },
    {
      label: "Votes",
      items: data.votes.map((v) => ({
        id: v.id,
        primary: v.question,
        secondary: `${v.status} · ${v.responses} responses`,
      })),
    },
    {
      label: "Checklist",
      items: data.checklist.map((c) => ({ id: c.id, primary: c.title, secondary: c.category ?? undefined })),
    },
    {
      label: "Documents",
      items: data.documents.map((d) => ({ id: d.id, primary: d.title, secondary: d.category ?? undefined })),
    },
    {
      label: "Contacts",
      items: data.contacts.map((c) => ({ id: c.id, primary: c.name, secondary: c.role ?? undefined })),
    },
    {
      label: "Places",
      items: data.places.map((p) => ({ id: p.id, primary: p.name, secondary: p.category ?? undefined })),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-3">
        <p className="text-[11px] font-semibold text-muted-foreground">
          Read-only oversight. Day-to-day editing stays with programme staff in the staff hub, so their permissions and
          change history remain intact.
        </p>
        <Link
          to="/staff/overview"
          className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-muted px-3 py-2 text-xs font-bold"
        >
          Open Programme OS <ChevronRight className="size-3.5" />
        </Link>
      </div>
      {sections.map((s) => (
        <div key={s.label}>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{s.label}</p>
            <Pill>{s.items.length}</Pill>
          </div>
          {s.items.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-3 text-xs text-muted-foreground">
              Nothing yet.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {s.items.slice(0, 12).map((i) => (
                <li key={i.id} className="rounded-xl border border-border bg-card px-3 py-2">
                  <p className="truncate text-[13px] font-semibold">{i.primary}</p>
                  {i.secondary ? (
                    <p className="truncate text-[11px] capitalize text-muted-foreground">{i.secondary}</p>
                  ) : null}
                </li>
              ))}
              {s.items.length > 12 ? (
                <li className="px-3 py-1 text-[11px] text-muted-foreground">
                  +{s.items.length - 12} more
                </li>
              ) : null}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

/* ──────────────────────────── Testing sandbox ─────────────────────────────── */

/**
 * Operator sandbox. One designated test programme (slug `shekk-test-programme`)
 * that the signed-in operator owns *and* participates in, so both sides of
 * Programme V1 can be exercised from one account. The reset only ever touches
 * that cohort's own rows.
 */
function TestbedPanel() {
  const { status, reset } = useAdminTestProgramme();
  const info = reset.data ?? null;
  const joinCode = info?.joinCode ?? status.data?.joinCode ?? null;
  const exists = Boolean(info) || Boolean(status.data?.exists);

  return (
    <Panel
      title="Testing sandbox"
      action={<Pill tone="warning">Shekk operators only</Pill>}
    >
      <p className="text-sm text-muted-foreground">
        Creates or resets <span className="font-semibold text-foreground">Shekk Test Programme</span> →{" "}
        <span className="font-semibold text-foreground">Summer Test Cohort</span> and makes your own account both
        programme owner and participant, so you can test <span className="font-semibold text-foreground">/programme</span>{" "}
        and <span className="font-semibold text-foreground">/staff</span> (Programme OS) from one login. Real partner
        programmes are never touched.
      </p>

      {status.isLoading ? (
        <p className="mt-3 text-xs text-muted-foreground">Checking the sandbox…</p>
      ) : status.error ? (
        <p className="mt-3 text-xs text-destructive">{cleanError(status.error, "We couldn't read the sandbox state.")}</p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <ActionButton
          tone={exists ? "ghost" : "primary"}
          disabled={reset.isPending}
          onClick={() => reset.mutate(undefined, { onSuccess: () => void status.refetch() })}
        >
          <FlaskConical className="mr-1.5 inline size-4" />
          {reset.isPending ? "Rebuilding…" : exists ? "Reset test data" : "Create test programme"}
        </ActionButton>

        {exists ? (
          <>
            <Link
              to="/programme"
              className="tap-flat rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold"
            >
              Open student view
            </Link>
            <Link
              to="/staff/overview"
              className="tap-flat rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold"
            >
              Open staff view
            </Link>
            {joinCode ? (
              <Link
                to="/join/$code"
                params={{ code: joinCode }}
                className="tap-flat rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold"
              >
                Open join page
              </Link>
            ) : null}
          </>
        ) : null}
      </div>

      {joinCode ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Join code <span className="font-mono font-bold text-foreground">{joinCode}</span>
        </p>
      ) : null}

      {reset.error ? (
        <p className="mt-3 text-xs text-destructive">{cleanError(reset.error, "We couldn't rebuild the sandbox.")}</p>
      ) : null}

      {info ? (
        <p className="mt-3 text-xs font-semibold text-success">
          Sandbox rebuilt · {info.seeded.events} events · {info.seeded.groups} groups ·{" "}
          {info.seeded.announcements} announcements · {info.seeded.votes} vote · {info.seeded.checklist} checklist items
          · {info.seeded.contacts} contacts · {info.seeded.documents} documents · {info.seeded.places} places
        </p>
      ) : null}
    </Panel>
  );
}
