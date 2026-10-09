/**
 * Shekk Console server functions.
 *
 * Thin wrappers only. Every one of these proves the signed-in caller holds the
 * `admin` role before the service-role client is ever loaded.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error("Could not verify operator access");
  if (!data) throw new Error("Forbidden");
}

/** Who am I, as far as the console is concerned? */
export const adminSession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return { userId: context.userId, isAdmin: Boolean(data) };
  });

export const adminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { overview } = await import("./admin.server");
    return overview();
  });

export const adminMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { listMembers } = await import("./admin.server");
    return listMembers();
  });

export const adminMemberDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { memberDetail } = await import("./admin.server");
    return memberDetail(data.userId);
  });

export const adminSetKycStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        userId: z.string().uuid(),
        status: z.enum(["not_started", "submitted", "in_review", "approved", "rejected"]),
        reason: z.string().trim().max(300).nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { setKycStatus } = await import("./admin.server");
    return setKycStatus(data.userId, data.status, data.reason ?? null);
  });

export const adminSetAccountStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ userId: z.string().uuid(), status: z.enum(["active", "frozen", "closed"]) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { setAccountStatus } = await import("./admin.server");
    return setAccountStatus(data.userId, data.status);
  });

export const adminSetHandle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ userId: z.string().uuid(), handle: z.string().trim().max(24) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { setMemberHandle } = await import("./admin.server");
    return setMemberHandle(data.userId, data.handle);
  });
