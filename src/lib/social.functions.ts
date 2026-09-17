/**
 * Social server functions.
 *
 * Thin wrappers only — every helper lives in `social.server.ts`. Each function
 * is authenticated and the member is taken from the verified token, never from
 * anything the client sends.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();
const shekels = z.number().finite().positive().max(20_000);
const text = (max: number) => z.string().trim().max(max);

/* ---------------------------------------------------------------- handles --- */

export const getMyHandle = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { ensureHandle } = await import("./social.server");
    return ensureHandle(context.userId);
  });

export const saveMyHandle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        handle: text(24).optional(),
        displayName: text(60).optional(),
        discoverable: z.boolean().optional(),
        avatarUrl: text(80).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { updateHandle } = await import("./social.server");
    return updateHandle(context.userId, data);
  });

export const checkHandle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ handle: text(24) }).parse(data))
  .handler(async ({ data, context }) => {
    const { isHandleFree } = await import("./social.server");
    return { free: await isHandleFree(context.userId, data.handle) };
  });

/* ---------------------------------------------------------------- friends --- */

export const findMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ query: text(80) }).parse(data))
  .handler(async ({ data, context }) => {
    const { searchMembers } = await import("./social.server");
    return searchMembers(context.userId, data.query);
  });

export const resolvePayCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ code: text(120) }).parse(data))
  .handler(async ({ data, context }) => {
    const { resolveHandle } = await import("./social.server");
    return resolveHandle(context.userId, data.code);
  });

export const getFriends = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listFriends } = await import("./social.server");
    return listFriends(context.userId);
  });

export const addFriendFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ targetId: uuid }).parse(data))
  .handler(async ({ data, context }) => {
    const { requestFriend } = await import("./social.server");
    return requestFriend(context.userId, data.targetId);
  });

export const answerFriendRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ friendshipId: uuid, action: z.enum(["accept", "decline"]) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { respondFriend } = await import("./social.server");
    return respondFriend(context.userId, data.friendshipId, data.action);
  });

export const removeFriendFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ otherId: uuid }).parse(data))
  .handler(async ({ data, context }) => {
    const { removeFriend } = await import("./social.server");
    return removeFriend(context.userId, data.otherId);
  });

export const blockMemberFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ otherId: uuid, blocked: z.boolean() }).parse(data))
  .handler(async ({ data, context }) => {
    const { setBlocked } = await import("./social.server");
    return setBlocked(context.userId, data.otherId, data.blocked);
  });

export const reportMemberFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        targetUserId: uuid.nullish(),
        messageId: uuid.nullish(),
        reason: text(120).min(2),
        detail: text(1000).nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { reportMember } = await import("./social.server");
    return reportMember(context.userId, data);
  });

/* ------------------------------------------------------------------ money --- */

export const sendToFriend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        toUserId: uuid,
        amount: shekels,
        note: text(120).nullish(),
        conversationId: uuid.nullish(),
        idempotencyKey: text(120).nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { sendToMember } = await import("./social.server");
    return sendToMember(context.userId, data);
  });

/* ------------------------------------------------------------------- chat --- */

export const getConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listConversations } = await import("./social.server");
    return listConversations(context.userId);
  });

export const getConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ conversationId: uuid }).parse(data))
  .handler(async ({ data, context }) => {
    const { readConversation } = await import("./social.server");
    return readConversation(context.userId, data.conversationId);
  });

export const openDm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ otherId: uuid }).parse(data))
  .handler(async ({ data, context }) => {
    const { ensureDm } = await import("./social.server");
    return { conversationId: await ensureDm(context.userId, data.otherId) };
  });

export const createGroupChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ title: text(60), memberIds: z.array(uuid).max(50) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { createGroup } = await import("./social.server");
    return { conversationId: await createGroup(context.userId, data.title, data.memberIds) };
  });

export const inviteToGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ conversationId: uuid, memberIds: z.array(uuid).max(50) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { addToGroup } = await import("./social.server");
    return addToGroup(context.userId, data.conversationId, data.memberIds);
  });

export const leaveChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ conversationId: uuid }).parse(data))
  .handler(async ({ data, context }) => {
    const { leaveConversation } = await import("./social.server");
    return leaveConversation(context.userId, data.conversationId);
  });

export const postMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ conversationId: uuid, body: text(2000).min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    const { sendMessage } = await import("./social.server");
    return sendMessage(context.userId, data.conversationId, data.body);
  });

export const markConversationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ conversationId: uuid }).parse(data))
  .handler(async ({ data, context }) => {
    const { markRead } = await import("./social.server");
    return markRead(context.userId, data.conversationId);
  });

/* ----------------------------------------------------------------- splits --- */

export const getSplits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listSplits } = await import("./social.server");
    return listSplits(context.userId);
  });

export const startSplit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        note: text(120),
        total: shekels,
        mode: z.enum(["even", "custom"]).default("even"),
        shares: z.array(z.object({ userId: uuid, amount: shekels })).min(1).max(30),
        conversationId: uuid.nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { createSplit } = await import("./social.server");
    return createSplit(context.userId, data);
  });

export const paySplit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ shareId: uuid }).parse(data))
  .handler(async ({ data, context }) => {
    const { paySplitShare } = await import("./social.server");
    return paySplitShare(context.userId, data.shareId);
  });

export const declineSplit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ shareId: uuid }).parse(data))
  .handler(async ({ data, context }) => {
    const { declineSplitShare } = await import("./social.server");
    return declineSplitShare(context.userId, data.shareId);
  });

export const cancelSplitFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ billId: uuid }).parse(data))
  .handler(async ({ data, context }) => {
    const { cancelSplit } = await import("./social.server");
    return cancelSplit(context.userId, data.billId);
  });

/* --------------------------------------------------------------- programs --- */

export const getPrograms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ search: text(80).nullish() }).parse(data))
  .handler(async ({ data, context }) => {
    const { listPrograms } = await import("./social.server");
    return listPrograms(context.userId, data.search ?? undefined);
  });

export const getMyProgram = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { myProgram } = await import("./social.server");
    return myProgram(context.userId);
  });

export const joinProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ code: text(24).nullish(), cohortId: uuid.nullish() }).parse(data))
  .handler(async ({ data, context }) => {
    const { joinCohort } = await import("./social.server");
    return joinCohort(context.userId, data);
  });

export const leaveProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ cohortId: uuid }).parse(data))
  .handler(async ({ data, context }) => {
    const { leaveCohort } = await import("./social.server");
    return leaveCohort(context.userId, data.cohortId);
  });
