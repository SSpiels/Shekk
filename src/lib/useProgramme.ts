/**
 * Programme + travel context for the UI.
 *
 * The server owns all of it; this hook mirrors it and exposes the handful of
 * mutations a participant is allowed to make.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApp } from "@/lib/store";
import {
  getMyProgramme,
  getMyTravel,
  joinProgrammeWithCode,
  leaveMyProgramme,
  previewProgrammeCode,
  saveMyTravel,
  setProgrammeChecklistItem,
} from "@/lib/programme.functions";
import type { MemberTravel, ProgrammeState, TravelPatch } from "@/lib/programme.server";

const PROGRAMME_KEY = ["programme", "state"];
const TRAVEL_KEY = ["programme", "travel"];

const emptyProgramme: ProgrammeState = {
  joined: false,
  isDemo: false,
  programmeName: null,
  organisation: null,
  cohortName: null,
  city: null,
  welcomeMessage: null,
  startsOn: null,
  endsOn: null,
  joinedAt: null,
  announcements: [],
  contacts: [],
  documents: [],
  schedule: [],
  checklist: [],
};

const emptyTravel: MemberTravel = {
  travelStyle: "unknown",
  arrivalDate: null,
  departureDate: null,
  fundingCurrency: null,
  israelCity: null,
  accommodationArea: null,
  homeCountry: null,
  displayName: null,
  onboardingStep: null,
  onboardingCompletedAt: null,
  interests: [],
};

/** Freshly minted tokens can briefly read as "issued in the future". Retry. */
function isClockSkew(error: unknown) {
  return /issued at future|iat|Unauthorized/i.test(
    error instanceof Error ? error.message : String(error),
  );
}

export function useProgramme() {
  const { signedIn } = useApp();
  const qc = useQueryClient();

  const query = useQuery<ProgrammeState>({
    queryKey: PROGRAMME_KEY,
    queryFn: () => getMyProgramme(),
    enabled: signedIn,
    staleTime: 30_000,
    throwOnError: false,
    retry: (count, error) => count < 3 && isClockSkew(error),
    retryDelay: (count) => Math.min(1200 * (count + 1), 4000),
  });

  const adopt = (next: ProgrammeState) => qc.setQueryData(PROGRAMME_KEY, next);

  const join = useMutation({
    mutationFn: (code: string) => joinProgrammeWithCode({ data: { code } }),
    onSuccess: adopt,
  });

  const preview = useMutation({
    mutationFn: (code: string) => previewProgrammeCode({ data: { code } }),
  });

  const leave = useMutation({
    mutationFn: () => leaveMyProgramme(),
    onSuccess: adopt,
  });

  const tick = useMutation({
    mutationFn: (input: { itemId: string; done: boolean }) => setProgrammeChecklistItem({ data: input }),
    onSuccess: adopt,
  });

  const programme = query.data ?? emptyProgramme;
  const now = Date.now();
  const nextItem =
    programme.schedule.find((i) => new Date(i.startsAt).getTime() >= now) ?? null;
  const checklistDone = programme.checklist.filter((c) => c.done).length;

  return {
    programme,
    joined: programme.joined,
    nextItem,
    latestAnnouncement: programme.announcements[0] ?? null,
    checklistDone,
    checklistTotal: programme.checklist.length,
    loading: query.isLoading,
    join,
    preview,
    leave,
    tick,
    refetch: query.refetch,
  };
}

export function useTravel() {
  const { signedIn } = useApp();
  const qc = useQueryClient();

  const query = useQuery<MemberTravel>({
    queryKey: TRAVEL_KEY,
    queryFn: () => getMyTravel(),
    enabled: signedIn,
    staleTime: 30_000,
    throwOnError: false,
    retry: (count, error) => count < 3 && isClockSkew(error),
    retryDelay: (count) => Math.min(1200 * (count + 1), 4000),
  });

  const save = useMutation({
    mutationFn: (patch: TravelPatch) => saveMyTravel({ data: patch }),
    onSuccess: (next) => qc.setQueryData(TRAVEL_KEY, next),
  });

  const travel = query.data ?? emptyTravel;

  const daysToArrival = (() => {
    if (!travel.arrivalDate) return null;
    const then = new Date(`${travel.arrivalDate}T00:00:00`).getTime();
    if (Number.isNaN(then)) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((then - today.getTime()) / 86_400_000);
  })();

  return {
    travel,
    daysToArrival,
    /** Setup is only "done" once the member reached the finish screen. */
    setupComplete: Boolean(travel.onboardingCompletedAt),
    loading: query.isLoading,
    fetched: query.isSuccess,
    /** True once retries are exhausted and the load has permanently failed. */
    failed: query.isError,
    save,
    refetch: query.refetch,
  };
}
