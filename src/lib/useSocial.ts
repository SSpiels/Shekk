/**
 * Social data for the UI.
 *
 * Every read and write goes through an authenticated server function; nothing
 * social is kept in localStorage any more. Realtime keeps chats, splits and
 * friend requests fresh without polling.
 */

import { useEffect, useId } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/store";
import {
  addFriendFn,
  answerFriendRequest,
  blockMemberFn,
  cancelSplitFn,
  checkHandle,
  createGroupChat,
  declineSplit,
  findMembers,
  getConversation,
  getConversations,
  getFriends,
  getMyHandle,
  getMyProgram,
  getPrograms,
  getSplits,
  inviteToGroup,
  joinProgram,
  leaveChat,
  leaveProgram,
  markConversationRead,
  openDm,
  paySplit,
  postMessage,
  removeFriendFn,
  reportMemberFn,
  resolvePayCode,
  saveMyHandle,
  sendToFriend,
  startSplit,
} from "@/lib/social.functions";

import type { ChatMessage, ConversationView } from "@/lib/social.server";

/** A message that may still be in flight to the server. */
export type ChatMessageUI = ChatMessage & { pending?: boolean };
export type ConversationUI = Omit<ConversationView, "messages"> & { messages: ChatMessageUI[] };

export const socialKeys = {
  handle: ["social", "handle"] as const,
  friends: ["social", "friends"] as const,
  chats: ["social", "chats"] as const,
  chat: (id: string) => ["social", "chat", id] as const,
  splits: ["social", "splits"] as const,
  program: ["social", "program"] as const,
  programs: (q: string) => ["social", "programs", q] as const,
};

/** One subscription for the whole social surface. */
function useSocialRealtime(enabled: boolean) {
  const qc = useQueryClient();
  const id = useId();
  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel(`shekk-social:${id}`)

      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, (payload) => {
        const row = payload.new as { conversation_id?: string } | null;
        if (row?.conversation_id) qc.invalidateQueries({ queryKey: socialKeys.chat(row.conversation_id) });
        qc.invalidateQueries({ queryKey: socialKeys.chats });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, () => {
        qc.invalidateQueries({ queryKey: socialKeys.friends });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "split_shares" }, () => {
        qc.invalidateQueries({ queryKey: socialKeys.splits });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, id, qc]);
}

export function useMyHandle() {
  const { signedIn } = useApp();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: socialKeys.handle,
    queryFn: () => getMyHandle(),
    enabled: signedIn,
    staleTime: 60_000,
  });

  const save = useMutation({
    mutationFn: (input: { handle?: string; displayName?: string; discoverable?: boolean; avatarUrl?: string | null }) =>
      saveMyHandle({ data: input }),
    onSuccess: (card) => {
      qc.setQueryData(socialKeys.handle, card);
      qc.invalidateQueries({ queryKey: socialKeys.friends });
    },
  });

  return { me: query.data ?? null, loading: query.isLoading, save, check: (handle: string) => checkHandle({ data: { handle } }) };
}

export function useFriends() {
  const { signedIn } = useApp();
  const qc = useQueryClient();
  useSocialRealtime(signedIn);

  const query = useQuery({
    queryKey: socialKeys.friends,
    queryFn: () => getFriends(),
    enabled: signedIn,
    staleTime: 20_000,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: socialKeys.friends });
    qc.invalidateQueries({ queryKey: socialKeys.chats });
  };

  return {
    data: query.data ?? null,
    loading: query.isLoading,
    search: (query_: string) => findMembers({ data: { query: query_ } }),
    resolveCode: (code: string) => resolvePayCode({ data: { code } }),
    add: useMutation({ mutationFn: (targetId: string) => addFriendFn({ data: { targetId } }), onSuccess: refresh }),
    respond: useMutation({
      mutationFn: (v: { friendshipId: string; action: "accept" | "decline" }) => answerFriendRequest({ data: v }),
      onSuccess: refresh,
    }),
    remove: useMutation({ mutationFn: (otherId: string) => removeFriendFn({ data: { otherId } }), onSuccess: refresh }),
    block: useMutation({
      mutationFn: (v: { otherId: string; blocked: boolean }) => blockMemberFn({ data: v }),
      onSuccess: refresh,
    }),
    report: useMutation({
      mutationFn: (v: { targetUserId?: string | null; messageId?: string | null; reason: string; detail?: string | null }) =>
        reportMemberFn({ data: v }),
    }),
  };
}

export function useConversations() {
  const { signedIn } = useApp();
  useSocialRealtime(signedIn);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: socialKeys.chats,
    queryFn: () => getConversations(),
    enabled: signedIn,
    staleTime: 10_000,
  });

  return {
    chats: query.data ?? [],
    loading: query.isLoading,
    openDm: useMutation({
      mutationFn: (otherId: string) => openDm({ data: { otherId } }),
      onSuccess: () => qc.invalidateQueries({ queryKey: socialKeys.chats }),
    }),
    createGroup: useMutation({
      mutationFn: (v: { title: string; memberIds: string[] }) => createGroupChat({ data: v }),
      onSuccess: () => qc.invalidateQueries({ queryKey: socialKeys.chats }),
    }),
  };
}

export function useConversation(conversationId: string) {
  const { signedIn, refreshLedger } = useApp();
  const qc = useQueryClient();
  useSocialRealtime(signedIn);

  const query = useQuery({
    queryKey: socialKeys.chat(conversationId),
    queryFn: () => getConversation({ data: { conversationId } }),
    enabled: signedIn && Boolean(conversationId),
  });

  // readConversation already stamps last_read_at, so we only refresh the list.
  useEffect(() => {
    if (query.data) qc.invalidateQueries({ queryKey: socialKeys.chats });
  }, [query.data, qc]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: socialKeys.chat(conversationId) });
    qc.invalidateQueries({ queryKey: socialKeys.chats });
  };

  return {
    conversation: (query.data ?? null) as ConversationUI | null,
    loading: query.isLoading,
    error: query.error as Error | null,
    send: useMutation({
      mutationFn: (body: string) => postMessage({ data: { conversationId, body } }),
      onMutate: async (body: string) => {
        await qc.cancelQueries({ queryKey: socialKeys.chat(conversationId) });
        const previous = qc.getQueryData<ConversationUI>(socialKeys.chat(conversationId));
        if (previous) {
          const optimistic: ChatMessageUI = {
            id: `pending-${Date.now()}`,
            conversationId,
            senderId: null,
            senderName: "You",
            kind: "text",
            body,
            meta: {},
            createdAt: new Date().toISOString(),
            mine: true,
            pending: true,
          };
          qc.setQueryData<ConversationUI>(socialKeys.chat(conversationId), {
            ...previous,
            messages: [...previous.messages, optimistic],
          });
        }
        return { previous };
      },
      onError: (_e, _body, ctx) => {
        if (ctx?.previous) qc.setQueryData(socialKeys.chat(conversationId), ctx.previous);
      },
      onSettled: invalidate,
    }),
    sendMoney: useMutation({
      mutationFn: (v: { toUserId: string; amount: number; note?: string | null }) =>
        sendToFriend({ data: { ...v, conversationId } }),
      onSuccess: () => {
        invalidate();
        void refreshLedger();
      },
    }),
    invite: useMutation({
      mutationFn: (memberIds: string[]) => inviteToGroup({ data: { conversationId, memberIds } }),
      onSuccess: invalidate,
    }),
    leave: useMutation({
      mutationFn: () => leaveChat({ data: { conversationId } }),
      onSuccess: () => qc.invalidateQueries({ queryKey: socialKeys.chats }),
    }),
  };
}


export function useSendMoney() {
  const { refreshLedger } = useApp();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { toUserId: string; amount: number; note?: string | null }) => sendToFriend({ data: v }),
    onSuccess: () => {
      void refreshLedger();
      qc.invalidateQueries({ queryKey: socialKeys.chats });
    },
  });
}

export function useSplits() {
  const { signedIn, refreshLedger } = useApp();
  const qc = useQueryClient();
  useSocialRealtime(signedIn);

  const query = useQuery({
    queryKey: socialKeys.splits,
    queryFn: () => getSplits(),
    enabled: signedIn,
    staleTime: 15_000,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: socialKeys.splits });

  return {
    bills: query.data ?? [],
    loading: query.isLoading,
    create: useMutation({
      mutationFn: (v: {
        note: string;
        total: number;
        mode: "even" | "custom";
        shares: Array<{ userId: string; amount: number }>;
      }) => startSplit({ data: v }),
      onSuccess: refresh,
    }),
    pay: useMutation({
      mutationFn: (shareId: string) => paySplit({ data: { shareId } }),
      onSuccess: () => {
        refresh();
        void refreshLedger();
      },
    }),
    decline: useMutation({ mutationFn: (shareId: string) => declineSplit({ data: { shareId } }), onSuccess: refresh }),
    cancel: useMutation({ mutationFn: (billId: string) => cancelSplitFn({ data: { billId } }), onSuccess: refresh }),
  };
}

export function useProgramLink(search = "") {
  const { signedIn } = useApp();
  const qc = useQueryClient();

  const mine = useQuery({
    queryKey: socialKeys.program,
    queryFn: () => getMyProgram(),
    enabled: signedIn,
    staleTime: 60_000,
  });

  const directory = useQuery({
    queryKey: socialKeys.programs(search),
    queryFn: () => getPrograms({ data: { search } }),
    enabled: signedIn,
    staleTime: 60_000,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: socialKeys.program });
    qc.invalidateQueries({ queryKey: socialKeys.chats });
    qc.invalidateQueries({ queryKey: socialKeys.friends });
    qc.invalidateQueries({ queryKey: ["social", "programs"] });
  };

  return {
    mine: mine.data ?? null,
    loading: mine.isLoading,
    programs: directory.data ?? [],
    programsLoading: directory.isLoading,
    join: useMutation({
      mutationFn: (v: { code?: string | null; cohortId?: string | null }) => joinProgram({ data: v }),
      onSuccess: refresh,
    }),
    leave: useMutation({ mutationFn: (cohortId: string) => leaveProgram({ data: { cohortId } }), onSuccess: refresh }),
  };
}

/** Total unread chat messages — powers the Social tab badge. */
export function useUnreadChats() {
  const { signedIn } = useApp();
  const query = useQuery({
    queryKey: socialKeys.chats,
    queryFn: () => getConversations(),
    enabled: signedIn,
    staleTime: 10_000,
  });
  return (query.data ?? []).reduce((n, c) => n + (c.unread ?? 0), 0);
}
