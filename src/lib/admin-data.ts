/**
 * Console data hooks — every screen reads the live backend through these.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  adminMemberDetail,
  adminMembers,
  adminOverview,
  adminSession,
  adminSetAccountStatus,
  adminSetHandle,
  adminSetKycStatus,
} from "./admin.functions";

export const fromAgorot = (n: number) => n / 100;

export const ils = (agorot: number) =>
  `₪${Math.round(agorot / 100).toLocaleString("en-US")}`;

export const minor = (code: string, amount: number) =>
  `${code} ${(amount / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const when = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export function useAdminSession(enabled = true) {
  const fn = useServerFn(adminSession);
  return useQuery({
    queryKey: ["admin", "session"],
    queryFn: () => fn(),
    enabled,
    retry: false,
    staleTime: 60_000,
  });
}

export function useAdminOverview(enabled: boolean) {
  const fn = useServerFn(adminOverview);
  return useQuery({ queryKey: ["admin", "overview"], queryFn: () => fn(), enabled, retry: false });
}

export function useAdminMembers(enabled: boolean) {
  const fn = useServerFn(adminMembers);
  return useQuery({ queryKey: ["admin", "members"], queryFn: () => fn(), enabled, retry: false });
}

export function useAdminMemberDetail(userId: string | null) {
  const fn = useServerFn(adminMemberDetail);
  return useQuery({
    queryKey: ["admin", "member", userId],
    queryFn: () => fn({ data: { userId: userId as string } }),
    enabled: Boolean(userId),
    retry: false,
  });
}

export function useAdminActions() {
  const kycFn = useServerFn(adminSetKycStatus);
  const acctFn = useServerFn(adminSetAccountStatus);
  const handleFn = useServerFn(adminSetHandle);
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin"] });

  const setKyc = useMutation({
    mutationFn: (v: { userId: string; status: "not_started" | "submitted" | "in_review" | "approved" | "rejected"; reason?: string | null }) =>
      kycFn({ data: v }),
    onSuccess: refresh,
  });

  const setAccount = useMutation({
    mutationFn: (v: { userId: string; status: "active" | "frozen" | "closed" }) => acctFn({ data: v }),
    onSuccess: refresh,
  });

  const setHandle = useMutation({
    mutationFn: (v: { userId: string; handle: string }) => handleFn({ data: v }),
    onSuccess: refresh,
  });

  return { setKyc, setAccount, setHandle };
}
