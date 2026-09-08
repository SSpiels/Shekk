/**
 * Team roster + pending invites, same card language as StaffAnnouncementList
 * / StaffContentLists. Member rows are clickable to manage (when canManage);
 * pending invites get a copy-link and revoke action.
 */
import { Clock, Copy, Mail, ShieldCheck } from "lucide-react";
import { useState } from "react";
import type { StaffTeamInvite, StaffTeamMember } from "@/lib/programme/logic";

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const rowClass =
  "space-y-1.5 rounded-2xl border border-border bg-card p-4 shadow-card transition-colors";

export function StaffTeamMemberList({
  members,
  canManage,
  onOpen,
}: {
  members: StaffTeamMember[];
  canManage: boolean;
  onOpen: (member: StaffTeamMember) => void;
}) {
  return (
    <div className="space-y-2.5">
      {members.map((m) => (
        <div
          key={m.userId}
          role={canManage ? "button" : undefined}
          tabIndex={canManage ? 0 : undefined}
          onClick={canManage ? () => onOpen(m) : undefined}
          className={`${rowClass} ${canManage ? "cursor-pointer hover:border-primary/40" : ""}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold">
                {m.displayName}
                {m.isSelf ? (
                  <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                    (you)
                  </span>
                ) : null}
              </p>
              {m.email ? (
                <p className="truncate text-[12px] text-muted-foreground">{m.email}</p>
              ) : null}
            </div>
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${
                m.role === "owner"
                  ? "bg-primary-soft text-primary"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <ShieldCheck className="size-3" /> {m.role}
            </span>
          </div>
          <p className="text-[11.5px] text-muted-foreground">
            {m.permissions.length === 0
              ? "All modules (default)"
              : `${m.permissions.length} module${m.permissions.length === 1 ? "" : "s"}: ${m.permissions.map((p) => p.replace(/_/g, " ")).join(", ")}`}
            {" · "}Joined {fmtDate(m.createdAt)}
          </p>
        </div>
      ))}
    </div>
  );
}

export function StaffTeamInviteList({
  invites,
  canManage,
  onRevoke,
}: {
  invites: StaffTeamInvite[];
  canManage: boolean;
  onRevoke: (invite: StaffTeamInvite) => void;
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  return (
    <div className="space-y-2.5">
      {invites.map((i) => {
        const link = `${typeof window !== "undefined" ? window.location.origin : ""}/join/${i.code}`;
        return (
          <div key={i.id} className={rowClass}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 truncate font-semibold">
                  <Mail className="size-3.5 shrink-0 text-muted-foreground" />
                  {i.email ?? "No email on file"}
                </p>
                {i.note ? <p className="text-[12px] text-muted-foreground">{i.note}</p> : null}
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold capitalize text-muted-foreground">
                {i.role}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3" />
                {i.expired ? "Expired" : `Sent ${fmtDate(i.createdAt)}`}
              </span>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(link);
                  setCopiedId(i.id);
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11.5px] font-semibold hover:bg-muted"
              >
                <Copy className="size-3.5" /> {copiedId === i.id ? "Copied" : "Copy link"}
              </button>
              {canManage ? (
                <button
                  type="button"
                  onClick={() => onRevoke(i)}
                  className="rounded-lg border border-destructive/30 px-2.5 py-1.5 text-[11.5px] font-semibold text-destructive hover:bg-destructive/5"
                >
                  Revoke
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
