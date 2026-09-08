/**
 * Programme OS Team: who has access to this programme, their role and
 * permissions, and pending invites — built on the existing owner|staff +
 * permissions model (programme_staff, programme_invites) and the invite/
 * accept engine Join.tsx's JoinPanel already runs for programme-claim
 * invites. See lib/programme-ops.server.ts's staffTeamOverview/
 * staffInviteTeamMember/staffUpdateTeamMember/staffRemoveTeamMember/
 * staffRevokeTeamInvite — all owner-gated (view is open to any staff, same
 * as Content), all re-deriving truth from the server, never trusting a
 * client-supplied id/programmeId pairing.
 */
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { UserCog, UserPlus, Users } from "lucide-react";
import { EmptyState, ErrorState, LoadingBlocks } from "@/components/Kit";
import { useStaffOS } from "@/components/staff/StaffSessionContext";
import {
  StaffTeamInviteDialog,
  StaffTeamMemberEditor,
} from "@/components/staff/team/StaffTeamEditor";
import { StaffTeamInviteList, StaffTeamMemberList } from "@/components/staff/team/StaffTeamList";
import { useStaffRevokeTeamInvite, useStaffTeamOverview } from "@/lib/useStaffTeam";
import type { StaffTeamMember } from "@/lib/programme/logic";

export const Route = createFileRoute("/staff/team")({
  component: TeamScreen,
});

function TeamScreen() {
  const { activeWorkspace } = useStaffOS();
  const programmeId = activeWorkspace?.programmeId ?? null;

  const { data, isLoading, error, refetch } = useStaffTeamOverview(programmeId);
  const revokeInvite = useStaffRevokeTeamInvite(programmeId);

  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<StaffTeamMember | null>(null);

  if (!programmeId) return null;
  if (isLoading) return <LoadingBlocks rows={4} />;
  if (error) {
    return (
      <ErrorState
        body="We couldn't load your team. Check your connection and try again."
        onRetry={() => void refetch()}
      />
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <UserCog className="size-4.5 text-primary" />
          <h2 className="text-[15px] font-bold">Team</h2>
        </div>
        {data.canManage ? (
          <button
            type="button"
            onClick={() => setInviting(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-[13px] font-semibold text-primary-foreground"
          >
            <UserPlus className="size-4" /> Invite
          </button>
        ) : null}
      </div>

      {!data.canManage ? (
        <p className="text-[12.5px] text-muted-foreground">
          You can see who's on the team. Only an owner can invite, change roles or remove access.
        </p>
      ) : null}

      <StaffTeamMemberList
        members={data.members}
        canManage={data.canManage}
        onOpen={(m) => setEditing(m)}
      />

      {data.invites.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[12.5px] font-semibold text-muted-foreground">
            <Users className="size-3.5" /> Pending invites
          </div>
          <StaffTeamInviteList
            invites={data.invites}
            canManage={data.canManage}
            onRevoke={(invite) => {
              if (
                window.confirm(
                  `Revoke the invite to ${invite.email ?? "this person"}? They won't be able to use that link anymore.`,
                )
              ) {
                revokeInvite.mutate(invite.id);
              }
            }}
          />
        </div>
      ) : null}

      {data.members.length === 0 && data.invites.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No team yet"
          body="Invite the people who help run this programme — madrichim, coordinators, whoever needs access."
        />
      ) : null}

      {inviting ? (
        <StaffTeamInviteDialog open onClose={() => setInviting(false)} programmeId={programmeId} />
      ) : null}

      {editing ? (
        <StaffTeamMemberEditor
          key={editing.userId}
          open
          onClose={() => setEditing(null)}
          programmeId={programmeId}
          member={editing}
          ownerCount={data.ownerCount}
        />
      ) : null}
    </div>
  );
}
