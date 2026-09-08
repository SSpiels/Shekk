/**
 * Desktop dialog for Team: invite a new member, or edit/remove an existing
 * one. Two modes in one component (mirrors StaffContentEditor's single
 * editor covering four content kinds) rather than two near-duplicate
 * dialogs — the fields barely overlap, but the save/cancel/dialog shell do.
 */
import { useState, type ReactNode } from "react";
import { Copy, Shield, Trash2, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cleanError } from "@/lib/useProgrammeHub";
import {
  useStaffInviteTeamMember,
  useStaffRemoveTeamMember,
  useStaffUpdateTeamMember,
} from "@/lib/useStaffTeam";
import {
  STAFF_PERMISSIONS,
  type StaffPermission,
  type StaffRole,
  type StaffTeamMember,
} from "@/lib/programme/logic";

const inputClass =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

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

export function StaffTeamInviteDialog({
  open,
  onClose,
  programmeId,
}: {
  open: boolean;
  onClose: () => void;
  programmeId: string;
}) {
  const invite = useStaffInviteTeamMember(programmeId);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("staff");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ code: string; path: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const link = result ? `${window.location.origin}${result.path}` : "";

  function send() {
    setError(null);
    if (!email.trim()) return setError("Enter an email address.");
    invite.mutate(
      { email: email.trim(), role, note: note.trim() || null },
      {
        onSuccess: (data) => setResult(data),
        onError: (e: unknown) => setError(cleanError(e, "We couldn't send that invite.")),
      },
    );
  }

  function reset() {
    setEmail("");
    setRole("staff");
    setNote("");
    setError(null);
    setResult(null);
    setCopied(false);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && reset()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-4.5 text-primary" /> Invite to your team
          </DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="space-y-3">
            <p className="text-[13px] text-muted-foreground">
              Share this link with them — it works whether or not they already have a Shekk account.
            </p>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
              <code className="min-w-0 flex-1 truncate text-[12.5px]">{link}</code>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(link);
                  setCopied(true);
                }}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11.5px] font-semibold hover:bg-muted"
              >
                <Copy className="size-3.5" /> {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={reset}
                className="rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Labelled label="Email">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                type="email"
                placeholder="madrich@programme.org"
              />
            </Labelled>
            <Labelled label="Role">
              <div className="grid grid-cols-2 gap-2">
                {(["staff", "owner"] as StaffRole[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`rounded-xl border px-3 py-2 text-[12.5px] font-semibold capitalize ${
                      role === r
                        ? "border-primary bg-primary-soft text-primary"
                        : "border-border bg-background"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {role === "owner"
                  ? "Full access, including managing the team itself."
                  : "Everyday programme access — you can fine-tune exactly what they can do once they've joined."}
              </p>
            </Labelled>
            <Labelled label="Note (optional)" hint="Only your team sees this — not the invitee.">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className={inputClass}
              />
            </Labelled>

            {error ? <p className="text-[12.5px] font-medium text-destructive">{error}</p> : null}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={reset}
                className="rounded-xl border border-border px-4 py-2 text-[13px] font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={send}
                disabled={invite.isPending}
                className="rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground disabled:opacity-60"
              >
                {invite.isPending ? "Sending…" : "Create invite"}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function StaffTeamMemberEditor({
  open,
  onClose,
  programmeId,
  member,
  ownerCount,
}: {
  open: boolean;
  onClose: () => void;
  programmeId: string;
  member: StaffTeamMember;
  ownerCount: number;
}) {
  const update = useStaffUpdateTeamMember(programmeId);
  const remove = useStaffRemoveTeamMember(programmeId);
  const [role, setRole] = useState<StaffRole>(member.role);
  const [permissions, setPermissions] = useState<StaffPermission[]>(member.permissions);
  const [error, setError] = useState<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const isLastOwner = member.role === "owner" && ownerCount <= 1;
  const dirty =
    role !== member.role ||
    JSON.stringify([...permissions].sort()) !== JSON.stringify([...member.permissions].sort());

  function togglePermission(p: StaffPermission) {
    setPermissions((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  function save() {
    setError(null);
    if (role !== "owner" && isLastOwner) {
      return setError("A programme needs at least one owner — make someone else an owner first.");
    }
    update.mutate(
      { userId: member.userId, role, permissions },
      {
        onSuccess: onClose,
        onError: (e: unknown) => setError(cleanError(e, "We couldn't save that.")),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="size-4.5 text-primary" />
            {member.displayName}
            {member.isSelf ? (
              <span className="text-[12px] font-normal text-muted-foreground">(you)</span>
            ) : null}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {member.email ? (
            <p className="text-[12.5px] text-muted-foreground">{member.email}</p>
          ) : null}

          <Labelled label="Role">
            <div className="grid grid-cols-2 gap-2">
              {(["staff", "owner"] as StaffRole[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`rounded-xl border px-3 py-2 text-[12.5px] font-semibold capitalize ${
                    role === r
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-border bg-background"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            {isLastOwner ? (
              <p className="text-[11px] text-muted-foreground">
                The only owner — make someone else an owner before changing this.
              </p>
            ) : null}
          </Labelled>

          <Labelled
            label="Permissions"
            hint="Leave all unchecked to use Shekk's sensible default (everything) — check specific ones to limit access to just those."
          >
            <div className="grid grid-cols-2 gap-1.5">
              {STAFF_PERMISSIONS.map((p) => (
                <label
                  key={p}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12.5px] hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    checked={permissions.includes(p)}
                    onChange={() => togglePermission(p)}
                    className="size-3.5"
                  />
                  <span className="capitalize">{p.replace(/_/g, " ")}</span>
                </label>
              ))}
            </div>
          </Labelled>

          {confirmingRemove ? (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5">
              <span className="text-[12.5px] font-medium text-destructive">
                {isLastOwner
                  ? "Can't remove the only owner — make someone else an owner first."
                  : `Remove ${member.displayName} from the team? Anything they've posted or changed stays exactly as it is — this only revokes their access.`}
              </span>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmingRemove(false)}
                  className="rounded-lg px-2.5 py-1 text-[12px] font-semibold"
                >
                  No
                </button>
                <button
                  type="button"
                  disabled={remove.isPending || isLastOwner}
                  onClick={() =>
                    remove.mutate(member.userId, {
                      onSuccess: onClose,
                      onError: (e: unknown) =>
                        setError(cleanError(e, "We couldn't remove that person.")),
                    })
                  }
                  className="rounded-lg bg-destructive px-2.5 py-1 text-[12px] font-semibold text-destructive-foreground disabled:opacity-60"
                >
                  {remove.isPending ? "Removing…" : "Yes, remove"}
                </button>
              </div>
            </div>
          ) : null}

          {error ? <p className="text-[12.5px] font-medium text-destructive">{error}</p> : null}

          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              disabled={remove.isPending}
              onClick={() => setConfirmingRemove(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/30 px-3.5 py-2 text-[13px] font-semibold text-destructive"
            >
              <Trash2 className="size-4" /> Remove
            </button>
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
                disabled={update.isPending || !dirty}
                className="rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground disabled:opacity-60"
              >
                {update.isPending ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
