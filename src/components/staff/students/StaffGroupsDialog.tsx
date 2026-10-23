/**
 * Group management: create a group (a bus, a dorm, a track), choose who is in it, delete it.
 * Group membership decides who sees targeted events, announcements, polls and documents, so
 * this is where staff set that up. Same engine as the original mobile group sheet.
 */
import { useState } from "react";
import { ArrowLeft, Check, ChevronRight, Plus, Search, Trash2, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStaffGroupActions, useStaffGroups } from "@/lib/useStaffEngagement";

const inputClass =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

export function StaffGroupsDialog({
  open,
  onClose,
  cohortId,
  students,
  canManage,
}: {
  open: boolean;
  onClose: () => void;
  cohortId: string;
  students: { userId: string; displayName: string; handle: string | null }[];
  canManage: boolean;
}) {
  const groups = useStaffGroups(cohortId, open);
  const actions = useStaffGroupActions(cohortId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const list = groups.data?.groups ?? [];
  const selected = list.find((g) => g.id === selectedId) ?? null;

  const close = () => {
    setSelectedId(null);
    setQuery("");
    setName("");
    setConfirmDelete(false);
    setError(null);
    onClose();
  };

  const create = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    actions.create.mutate(trimmed, {
      onSuccess: () => setName(""),
      onError: () => setError("We couldn't create that group."),
    });
  };

  const visible = query.trim()
    ? students.filter((s) => `${s.displayName} ${s.handle ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()))
    : students;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {selected ? (
              <button
                type="button"
                aria-label="Back to all groups"
                onClick={() => {
                  setSelectedId(null);
                  setConfirmDelete(false);
                }}
                className="-ml-1 flex size-8 items-center justify-center rounded-lg hover:bg-muted"
              >
                <ArrowLeft className="size-4" />
              </button>
            ) : (
              <Users className="size-4.5 text-primary" />
            )}
            {selected ? selected.name : "Groups"}
          </DialogTitle>
        </DialogHeader>

        {selected ? (
          <div className="space-y-3">
            <p className="text-[12.5px] text-muted-foreground">
              Tap a name to add or remove them. {selected.memberIds.length} in this group.
            </p>
            <label className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search students…"
                className="w-full min-w-0 bg-transparent outline-none placeholder:text-muted-foreground"
              />
            </label>
            <div className="max-h-[45vh] space-y-1 overflow-y-auto rounded-2xl border border-border p-1.5">
              {visible.length === 0 ? (
                <p className="px-2 py-4 text-center text-[12.5px] text-muted-foreground">No students match.</p>
              ) : (
                visible.map((s) => {
                  const on = selected.memberIds.includes(s.userId);
                  return (
                    <button
                      key={s.userId}
                      type="button"
                      disabled={!canManage}
                      onClick={() =>
                        actions.setMember.mutate({ groupId: selected.id, memberId: s.userId, member: !on })
                      }
                      className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-[13.5px] font-semibold transition-colors disabled:opacity-60 ${
                        on ? "bg-primary-soft text-primary" : "hover:bg-muted"
                      }`}
                    >
                      <span className="min-w-0 truncate">
                        {s.displayName}
                        {s.handle ? (
                          <span className="ml-1.5 text-[11.5px] font-normal text-muted-foreground">@{s.handle}</span>
                        ) : null}
                      </span>
                      {on ? <Check className="size-4 shrink-0" /> : <Plus className="size-4 shrink-0 text-muted-foreground" />}
                    </button>
                  );
                })
              )}
            </div>

            {canManage ? (
              confirmDelete ? (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5">
                  <span className="text-[12.5px] font-medium text-destructive">
                    Delete &ldquo;{selected.name}&rdquo;? Anything aimed only at this group stops reaching people.
                  </span>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="rounded-lg px-2.5 py-1 text-[12px] font-semibold"
                    >
                      No
                    </button>
                    <button
                      type="button"
                      disabled={actions.remove.isPending}
                      onClick={() =>
                        actions.remove.mutate(selected.id, {
                          onSuccess: () => {
                            setSelectedId(null);
                            setConfirmDelete(false);
                          },
                        })
                      }
                      className="rounded-lg bg-destructive px-2.5 py-1 text-[12px] font-semibold text-destructive-foreground disabled:opacity-60"
                    >
                      Yes, delete
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-destructive"
                >
                  <Trash2 className="size-3.5" /> Delete this group
                </button>
              )
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[12.5px] text-muted-foreground">
              Groups — a bus, a dorm, a track — decide who sees targeted events, announcements and polls.
            </p>

            {groups.isLoading ? (
              <div className="h-16 animate-pulse rounded-2xl bg-muted" />
            ) : groups.error ? (
              <p className="text-[12.5px] font-medium text-destructive">We couldn&apos;t load the groups.</p>
            ) : list.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-[12.5px] text-muted-foreground">
                No groups yet.
              </p>
            ) : (
              <div className="max-h-[40vh] space-y-1.5 overflow-y-auto">
                {list.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setSelectedId(g.id)}
                    className="tap flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{g.name}</span>
                      <span className="block text-[11.5px] text-muted-foreground">
                        {g.memberIds.length} {g.memberIds.length === 1 ? "member" : "members"}
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}

            {canManage ? (
              <div className="flex gap-2 pt-1">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") create();
                  }}
                  className={inputClass}
                  placeholder="New group — Bus 2, Girls' dorm, Ulpan A…"
                  maxLength={80}
                />
                <button
                  type="button"
                  onClick={create}
                  disabled={actions.create.isPending || !name.trim()}
                  className="shrink-0 rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground disabled:opacity-60"
                >
                  {actions.create.isPending ? "Adding…" : "Add"}
                </button>
              </div>
            ) : (
              <p className="text-[11.5px] text-muted-foreground">You don&apos;t have permission to change groups.</p>
            )}
            {error ? <p className="text-[12.5px] font-medium text-destructive">{error}</p> : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
