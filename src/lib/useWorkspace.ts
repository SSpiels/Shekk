/**
 * Switching between the personal Shekk app and a programme workspace, without
 * signing out. The server remembers the choice (after checking the member really
 * has access), so the app opens in whichever experience they used last.
 *
 * Access itself never comes from here: a workspace is only listed if the server
 * found a programme_staff row for this member.
 */

import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { saveWorkspace } from "@/lib/programme-ops.functions";
import { useStaffSession } from "@/lib/useProgrammeHub";
import { pickActiveProgrammeId, type StaffSession } from "@/lib/programme/logic";
import type { SwitchInput, WorkspacePrefs } from "@/lib/workspace";

export const STAFF_SESSION_KEY = ["staff", "session"] as const;

export function useWorkspace() {
  const { session, isStaff, loading } = useStaffSession();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const saveFn = useServerFn(saveWorkspace);

  const save = useMutation({
    mutationFn: (input: SwitchInput) => saveFn({ data: input }) as Promise<WorkspacePrefs>,
    onSuccess: (prefs) => {
      // Adopt the server's answer straight away so the sidebar and pages follow the switch.
      qc.setQueryData<StaffSession>(STAFF_SESSION_KEY, (old) => {
        if (!old) return old;
        const activeProgrammeId = pickActiveProgrammeId(old.workspaces, prefs.lastProgrammeId);
        return {
          ...old,
          prefs,
          activeProgrammeId,
          activeCohort: old.workspaces.find((w) => w.programmeId === activeProgrammeId)?.cohort ?? null,
        };
      });
    },
  });

  /** Go to a programme workspace (and remember it). */
  const openWorkspace = useCallback(
    async (programmeId: string) => {
      await save.mutateAsync({ experience: "staff", programmeId });
      void navigate({ to: "/staff" });
    },
    [save, navigate],
  );

  /** Back to the personal app (and remember it). Navigates even if remembering fails. */
  const openPersonal = useCallback(async () => {
    try {
      await save.mutateAsync({ experience: "personal" });
    } catch {
      /* the move itself must never be blocked by a failed save */
    }
    void navigate({ to: "/" });
  }, [save, navigate]);

  /** Remember where they are, without moving them. */
  const remember = useCallback((input: SwitchInput) => save.mutate(input), [save]);

  return {
    workspaces: session.workspaces,
    activeProgrammeId: session.activeProgrammeId,
    prefs: session.prefs,
    isStaff,
    loading,
    switching: save.isPending,
    openWorkspace,
    openPersonal,
    remember,
  };
}
