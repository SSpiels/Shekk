import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Pill, PageTitle, Panel, Stat } from "@/components/admin/AdminUI";
import { ils, when } from "@/lib/admin-data";
import { providerLabel } from "@/lib/activities";
import {
  EVENT_KIND_LABEL,
  useAdminEventTickets,
  useAdminEvents,
  useSaveEvent,
  useSetEventStatus,
  useSyncPartner,
  type EventDraft,
  type EventSourceId,
} from "@/lib/useEvents";

export const Route = createFileRoute("/admin/events")({
  component: EventsAdmin,
});

const KINDS: EventDraft["kind"][] = ["shabbaton", "tiyul", "club", "shiur", "chesed", "other"];

const SOURCES: { id: EventSourceId; label: string }[] = [
  { id: "secret_tel_aviv", label: "Secret Tel Aviv (scraped, lands as draft)" },
  { id: "nbn", label: "Nefesh B'Nefesh (scraped, lands as draft)" },
  { id: "eventer", label: "Eventer (partner API)" },
  { id: "tickchak", label: "Tickchak (partner API)" },
];

function localInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const BLANK: EventDraft = {
  title: "",
  kind: "shabbaton",
  description: "",
  includes: "",
  host: "",
  venue: "",
  city: "",
  startsAt: localInput(new Date(Date.now() + 7 * 86_400_000).toISOString()),
  endsAt: "",
  price: 0,
  capacity: 40,
  perPersonLimit: 2,
  coverUrl: "",
  emoji: "🕯️",
  status: "draft",
};

function EventsAdmin() {
  const { data: events = [], isLoading, error } = useAdminEvents(true);
  const [editing, setEditing] = useState<{ id: string | null; draft: EventDraft } | null>(null);
  const [holders, setHolders] = useState<string | null>(null);
  const [source, setSource] = useState<EventSourceId>("secret_tel_aviv");

  const save = useSaveEvent();
  const setStatus = useSetEventStatus();
  const sync = useSyncPartner();

  const totals = useMemo(() => {
    const live = events.filter((e) => e.status === "published").length;
    const sold = events.reduce((n, e) => n + e.sold, 0);
    const revenue = events.reduce((n, e) => n + e.revenue, 0);
    return { live, sold, revenue };
  }, [events]);

  return (
    <div>
      <PageTitle
        title="Events & tickets"
        subtitle="The catalogue students see in Explore. Prices are charged against a member's Shekk balance."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="On sale" value={String(totals.live)} sub={`${events.length} in catalogue`} />
        <Stat label="Admissions sold" value={String(totals.sold)} />
        <Stat label="Ticket revenue" value={ils(totals.revenue)} tone="positive" />
      </div>

      <Panel
        title="Catalogue"
        action={
          <div className="flex items-center gap-2">
            <select
              value={source}
              onChange={(e) => {
                setSource(e.target.value as EventSourceId);
                sync.reset();
              }}
              className="rounded-xl border border-border bg-background px-2 py-2 text-xs font-semibold"
            >
              {SOURCES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => sync.mutate(source)}
              disabled={sync.isPending}
              className="rounded-xl border border-border px-3 py-2 text-xs font-semibold disabled:opacity-40"
            >
              {sync.isPending ? "Syncing…" : "Sync source"}
            </button>
            <button
              type="button"
              onClick={() => setEditing({ id: null, draft: { ...BLANK } })}
              className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
            >
              New event
            </button>
          </div>
        }
      >
        {sync.data && !sync.data.configured ? (
          <p className="mb-3 rounded-xl bg-muted p-3 text-xs text-muted-foreground">
            That source isn&apos;t connected yet. Once a partner agreement and API key are in place, their
            listings sync in here automatically alongside the ones you create.
          </p>
        ) : null}
        {sync.data?.configured ? (
          <p className="mb-3 text-xs text-muted-foreground">
            Synced {sync.data.synced} listing{sync.data.synced === 1 ? "" : "s"} from {source}
            {source === "secret_tel_aviv" ? " — new ones land as Draft below. Review and Publish each one." : ""}
          </p>
        ) : null}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : error ? (
          <p className="text-sm text-destructive">{(error as Error).message}</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing listed yet. Create the first Shabbaton, tiyul or club night — students see it the moment
            it&apos;s published.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3">Event</th>
                  <th className="py-2 pr-3">When</th>
                  <th className="py-2 pr-3">Price</th>
                  <th className="py-2 pr-3">Sold</th>
                  <th className="py-2 pr-3">Revenue</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-b border-border/60">
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{e.emoji}</span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{e.title}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {EVENT_KIND_LABEL[e.kind]} · {e.host}
                            {e.city ? ` · ${e.city}` : ""}
                            {e.provider !== "shekk" ? ` · via ${providerLabel(e.provider)}` : ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-3 whitespace-nowrap text-xs">{when(e.startsAt)}</td>
                    <td className="py-3 pr-3 whitespace-nowrap">
                      {e.price === null ? "Unknown" : e.price === 0 ? "Free" : ils(e.price)}
                    </td>
                    <td className="py-3 pr-3 whitespace-nowrap">
                      {e.sold}
                      {e.capacity > 0 ? ` / ${e.capacity}` : ""}
                    </td>
                    <td className="py-3 pr-3 whitespace-nowrap">{ils(e.revenue)}</td>
                    <td className="py-3 pr-3">
                      <Pill
                        tone={
                          e.status === "published" ? "success" : e.status === "cancelled" ? "danger" : "muted"
                        }
                      >
                        {e.status}
                      </Pill>
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setHolders(e.id)}
                          className="rounded-lg border border-border px-2 py-1 text-xs font-semibold"
                        >
                          Holders
                        </button>
                        {e.provider === "shekk" ? (
                          <button
                            type="button"
                            onClick={() =>
                              setEditing({
                                id: e.id,
                                draft: {
                                  title: e.title,
                                  kind: e.kind,
                                  description: e.description ?? "",
                                  includes: e.includes ?? "",
                                  host: e.host,
                                  venue: e.venue ?? "",
                                  city: e.city ?? "",
                                  startsAt: localInput(e.startsAt),
                                  endsAt: e.endsAt ? localInput(e.endsAt) : "",
                                  price: e.price ?? 0, // Shekk-created events always have a real price
                                  capacity: e.capacity,
                                  perPersonLimit: e.perPersonLimit,
                                  coverUrl: e.coverUrl ?? "",
                                  emoji: e.emoji,
                                  status: e.status,
                                },
                              })
                            }
                            className="rounded-lg border border-border px-2 py-1 text-xs font-semibold"
                          >
                            Edit
                          </button>
                        ) : null}
                        {e.status !== "published" ? (
                          <button
                            type="button"
                            onClick={() => setStatus.mutate({ eventId: e.id, status: "published" })}
                            className="rounded-lg bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground"
                          >
                            Publish
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setStatus.mutate({ eventId: e.id, status: "draft" })}
                            className="rounded-lg border border-border px-2 py-1 text-xs font-semibold"
                          >
                            Unpublish
                          </button>
                        )}
                        {e.status !== "cancelled" ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                window.confirm(
                                  "Cancel this event? Every ticket is voided. Tickets are non-refundable, so any goodwill is handled by hand.",
                                )
                              )
                                setStatus.mutate({ eventId: e.id, status: "cancelled" });
                            }}
                            className="rounded-lg border border-destructive/40 px-2 py-1 text-xs font-semibold text-destructive"
                          >
                            Cancel
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {editing ? (
        <EventForm
          state={editing}
          pending={save.isPending}
          error={save.error ? (save.error as Error).message : null}
          onChange={(draft) => setEditing({ ...editing, draft })}
          onClose={() => {
            save.reset();
            setEditing(null);
          }}
          onSave={() =>
            save.mutate(
              { eventId: editing.id, draft: normalise(editing.draft) },
              { onSuccess: () => setEditing(null) },
            )
          }
        />
      ) : null}

      {holders ? <Holders eventId={holders} onClose={() => setHolders(null)} /> : null}
    </div>
  );
}

function normalise(draft: EventDraft): EventDraft {
  const iso = (v: string) => new Date(v).toISOString();
  const blankToNull = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);
  return {
    ...draft,
    title: draft.title.trim(),
    host: draft.host.trim(),
    description: blankToNull(draft.description),
    includes: blankToNull(draft.includes),
    venue: blankToNull(draft.venue),
    city: blankToNull(draft.city),
    coverUrl: blankToNull(draft.coverUrl),
    startsAt: iso(draft.startsAt),
    endsAt: draft.endsAt && draft.endsAt.trim() ? iso(draft.endsAt) : null,
    price: Number(draft.price) || 0,
    capacity: Number(draft.capacity) || 0,
    perPersonLimit: Number(draft.perPersonLimit) || 1,
  };
}

function Drawer({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40">
      <button aria-label="Close" onClick={onClose} className="flex-1" />
      <div className="w-full max-w-lg overflow-y-auto bg-card p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="text-sm font-semibold text-muted-foreground">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const field = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm";

function EventForm({
  state,
  pending,
  error,
  onChange,
  onClose,
  onSave,
}: {
  state: { id: string | null; draft: EventDraft };
  pending: boolean;
  error: string | null;
  onChange: (draft: EventDraft) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const d = state.draft;
  const set = <K extends keyof EventDraft>(key: K, value: EventDraft[K]) =>
    onChange({ ...d, [key]: value });

  return (
    <Drawer title={state.id ? "Edit event" : "New event"} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-[4rem_1fr] gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Icon</span>
            <input className={field} value={d.emoji} onChange={(e) => set("emoji", e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Title</span>
            <input
              className={field}
              value={d.title}
              placeholder="Shabbaton in Tzfat"
              onChange={(e) => set("title", e.target.value)}
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Kind</span>
            <select className={field} value={d.kind} onChange={(e) => set("kind", e.target.value as EventDraft["kind"])}>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {EVENT_KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Host</span>
            <input
              className={field}
              value={d.host}
              placeholder="Machon Ora"
              onChange={(e) => set("host", e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Venue</span>
            <input className={field} value={d.venue ?? ""} onChange={(e) => set("venue", e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">City</span>
            <input
              className={field}
              value={d.city ?? ""}
              placeholder="Jerusalem"
              onChange={(e) => set("city", e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Starts</span>
            <input
              type="datetime-local"
              className={field}
              value={d.startsAt}
              onChange={(e) => set("startsAt", e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Ends (optional)</span>
            <input
              type="datetime-local"
              className={field}
              value={d.endsAt ?? ""}
              onChange={(e) => set("endsAt", e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Price (₪, 0 = free)</span>
            <input
              type="number"
              min={0}
              step="0.01"
              className={field}
              value={d.price}
              onChange={(e) => set("price", Number(e.target.value))}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">
              Capacity (0 = unlimited)
            </span>
            <input
              type="number"
              min={0}
              className={field}
              value={d.capacity}
              onChange={(e) => set("capacity", Number(e.target.value))}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Limit per person</span>
            <input
              type="number"
              min={1}
              className={field}
              value={d.perPersonLimit}
              onChange={(e) => set("perPersonLimit", Number(e.target.value))}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Status</span>
            <select
              className={field}
              value={d.status}
              onChange={(e) => set("status", e.target.value as EventDraft["status"])}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">Cover image URL</span>
          <input
            className={field}
            value={d.coverUrl ?? ""}
            placeholder="https://…"
            onChange={(e) => set("coverUrl", e.target.value)}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">Description</span>
          <textarea
            rows={4}
            className={field}
            value={d.description ?? ""}
            onChange={(e) => set("description", e.target.value)}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">What&apos;s included</span>
          <textarea
            rows={3}
            className={field}
            value={d.includes ?? ""}
            placeholder={"Coach both ways\nAll meals\nHotel, 2 nights"}
            onChange={(e) => set("includes", e.target.value)}
          />
        </label>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <button
          type="button"
          disabled={pending || d.title.trim().length < 2 || d.host.trim().length < 2}
          onClick={onSave}
          className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40"
        >
          {pending ? "Saving…" : state.id ? "Save changes" : "Create event"}
        </button>
      </div>
    </Drawer>
  );
}

function Holders({ eventId, onClose }: { eventId: string; onClose: () => void }) {
  const { data = [], isLoading, error } = useAdminEventTickets(eventId);
  return (
    <Drawer title="Ticket holders" onClose={onClose}>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : error ? (
        <p className="text-sm text-destructive">{(error as Error).message}</p>
      ) : data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tickets sold yet.</p>
      ) : (
        <div className="space-y-2">
          {data.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold">{t.name ?? t.handle ?? "Member"}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {t.handle ? `@${t.handle} · ` : ""}
                  {when(t.boughtAt)} · <span className="font-mono">{t.code}</span>
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-semibold">{ils(t.amount)}</p>
                <p className="text-xs text-muted-foreground">
                  {t.quantity} × · {t.status}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Drawer>
  );
}
