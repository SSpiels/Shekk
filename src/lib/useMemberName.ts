/**
 * The signed-in member's name, for greetings and profile headers.
 *
 * Signed-in members get the name their ACCOUNT holds (see member-name.ts). Only a
 * signed-out visitor, who has no account, falls back to the name kept on the
 * device for the local demo.
 */

import { useCallback, useState } from "react";
import { useApp } from "@/lib/store";
import { useMyHandle } from "@/lib/useSocial";
import { useTravel } from "@/lib/useProgramme";
import { useProfile } from "@/lib/useProfile";
import { resolveMemberName, usableName } from "@/lib/member-name";

export function useMemberName() {
  const { signedIn, state } = useApp();
  const { me, loading: handleLoading, save: saveHandle } = useMyHandle();
  const { travel, fetched: travelFetched, save: saveTravel } = useTravel();
  const { profile } = useProfile();
  const [error, setError] = useState<string | null>(null);

  const server = resolveMemberName({
    handleName: me?.displayName,
    travelName: travel.displayName,
    legalFirst: profile?.legalFirstName,
    legalLast: profile?.legalLastName,
  });

  const full = signedIn ? server.full : usableName(state.name);
  const first = full.split(" ")[0] ?? "";

  /** True once we have asked the server, so "no name" can be told from "not loaded yet". */
  const settled = !signedIn || (!handleLoading && travelFetched);

  const setName = useCallback(
    async (next: string) => {
      const name = usableName(next).slice(0, 60);
      if (name.length < 1) {
        setError("Enter a name to continue.");
        return false;
      }
      setError(null);
      try {
        await saveHandle.mutateAsync({ displayName: name });
        // Keep the onboarding copy in step so the two never disagree.
        await saveTravel.mutateAsync({ displayName: name });
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save your name.");
        return false;
      }
    },
    [saveHandle, saveTravel],
  );

  return {
    full,
    first,
    has: Boolean(full),
    settled,
    saving: saveHandle.isPending || saveTravel.isPending,
    error,
    setName,
  };
}
