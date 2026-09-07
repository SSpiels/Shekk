/**
 * Programme Integration V1 — server functions.
 *
 * Thin wrappers only. Three rules:
 *  1. The acting member always comes from the verified token, never from input.
 *  2. Staff permission is proved inside `programme-ops.server.ts` against the
 *     database (`cohort_staff_can` / `is_programme_owner`), so nothing here is
 *     the security boundary — the UI just agrees with it.
 *  3. Internal Shekk admin functions prove the `admin` role server-side before
 *     any service-role work, the same pattern the rest of the console uses.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ────────────────────────────────── Schemas ───────────────────────────────── */

const uuid = z.string().uuid();
const text = (max: number) => z.string().trim().max(max).nullish();

const code = z
  .string()
  .trim()
  .min(3, "Programme codes are at least 3 characters")
  .max(40)
  .regex(/^[A-Za-z0-9-]+$/, "Codes use letters, numbers and dashes only");

const audience = z.object({
  kind: z.enum(["everyone", "groups", "individuals"]),
  groupIds: z.array(uuid).max(50),
  userIds: z.array(uuid).max(500),
});

const status = z.enum([
  "scheduled",
  "confirmed",
  "tentative",
  "delayed",
  "moved",
  "cancelled",
  "completed",
]);

const notifyLevel = z.enum(["silent", "notify", "urgent"]);
const iso = z.string().trim().min(4).max(40);

const eventFields = z.object({
  title: z.string().trim().min(1).max(160),
  description: text(4000),
  startsAt: iso,
  endsAt: iso.nullish(),
  locationLabel: text(200),
  meetingPoint: text(300),
  googlePlaceId: text(400),
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
  onlineUrl: text(600),
  eventType: z.string().trim().max(30).optional(),
  mandatory: z.boolean().optional(),
  status: status.optional(),
  statusNote: text(300),
  rsvpEnabled: z.boolean().optional(),
  capacity: z.number().int().min(1).max(10_000).nullish(),
  requiresAck: z.boolean().optional(),
  urgent: z.boolean().optional(),
  audience: audience.optional(),
});

const checklistValues = z.object({
  item_key: z.string().trim().min(1).max(60),
  title: z.string().trim().min(1).max(160),
  details: text(2000),
  due_on: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullish(),
  required: z.boolean().optional(),
  action_url: text(300),
  feature_key: text(40),
  sort_order: z.number().int().min(0).max(999).optional(),
});

const documentValues = z.object({
  label: z.string().trim().min(1).max(160),
  description: text(1000),
  link_url: text(800),
  category: z.string().trim().max(40).optional(),
  sort_order: z.number().int().min(0).max(999).optional(),
});

const contactValues = z.object({
  name: z.string().trim().min(1).max(120),
  role: text(80),
  category: z.string().trim().max(40).optional(),
  phone: text(40),
  whatsapp: text(40),
  email: text(160),
  notes: text(1000),
  availability: text(160),
  is_emergency: z.boolean().optional(),
  sort_order: z.number().int().min(0).max(999).optional(),
});

const placeValues = z.object({
  label: z.string().trim().min(1).max(160),
  category: z.string().trim().max(40).optional(),
  notes: text(1000),
  meeting_instructions: text(600),
  google_place_id: text(400),
  address: text(300),
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
  sort_order: z.number().int().min(0).max(999).optional(),
});

const contentInput = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("checklist_item"), cohortId: uuid, id: uuid.optional(), audience: audience.optional(), values: checklistValues }),
  z.object({ kind: z.literal("document"), cohortId: uuid, id: uuid.optional(), audience: audience.optional(), values: documentValues }),
  z.object({ kind: z.literal("contact"), cohortId: uuid, id: uuid.optional(), audience: audience.optional(), values: contactValues }),
  z.object({ kind: z.literal("place"), cohortId: uuid, id: uuid.optional(), audience: audience.optional(), values: placeValues }),
]);

const announcementFields = z.object({
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(4000),
  priority: z.enum(["normal", "important", "urgent"]).optional(),
  pinned: z.boolean().optional(),
  requiresAck: z.boolean().optional(),
  eventId: uuid.nullish(),
  linkUrl: text(600),
  notify: z.boolean().optional(),
  audience: audience.optional(),
});

const voteFields = z.object({
  question: z.string().trim().min(1).max(200),
  voteKind: z.enum(["poll", "question", "yes_no"]).optional(),
  description: text(1000),
  options: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(120),
        detail: text(300),
        capacity: z.number().int().min(1).max(10_000).nullish(),
      }),
    )
    .min(2)
    .max(12),
  eventId: uuid.nullish(),
  anonymous: z.boolean().optional(),
  allowChange: z.boolean().optional(),
  resultsVisible: z.boolean().optional(),
  closesAt: iso.nullish(),
  notify: z.boolean().optional(),
  audience: audience.optional(),
});

const programmeFields = z.object({
  name: z.string().trim().min(2).max(160),
  organisation: text(160),
  city: text(80),
  country: text(80),
  website: text(300),
  description: text(2000),
  programmeType: z.string().trim().max(40).optional(),
  slug: text(80),
});

const cohortFields = z.object({
  programmeId: uuid,
  name: z.string().trim().min(1).max(120),
  year: text(12),
  startsOn: text(12),
  endsOn: text(12),
  welcomeMessage: text(2000),
  joinCode: text(24),
});

/* ─────────────────────────── Input types for the UI ───────────────────────── */

export type AudienceInput = z.infer<typeof audience>;
export type EventFieldsInput = z.infer<typeof eventFields>;
export type EventPatchInput = Partial<EventFieldsInput> & {
  notifyLevel?: "silent" | "notify" | "urgent";
  note?: string | null;
};
export type AnnouncementFieldsInput = z.infer<typeof announcementFields>;
export type VoteFieldsInput = z.infer<typeof voteFields>;
export type ContentUpsertInput = z.infer<typeof contentInput>;
export type ProgrammeFieldsInput = z.infer<typeof programmeFields>;
export type CohortFieldsInput = z.infer<typeof cohortFields>;

/* ────────────────────────────── Participant reads ─────────────────────────── */

export const programmeHub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { readHub } = await import("@/lib/programme-ops.server");
    return readHub(context.supabase, context.userId);
  });

/* ─────────────────────────────── Staff session ─────────────────────────────── */

/** Which programme(s) the signed-in user has staff access to. Gates /staff. */
export const staffSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { resolveStaffSession } = await import("@/lib/programme-ops.server");
    return resolveStaffSession(context.supabase, context.userId);
  });

/* ──────────────────────────── Participant mutations ───────────────────────── */

export const programmeSetRsvp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ eventId: uuid, response: z.enum(["going", "maybe", "not_going"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { setRsvp } = await import("@/lib/programme-ops.server");
    return setRsvp(context.supabase, context.userId, data.eventId, data.response);
  });

export const programmeAcknowledge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ subjectType: z.enum(["event", "announcement"]), subjectId: uuid }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { acknowledge } = await import("@/lib/programme-ops.server");
    return acknowledge(context.supabase, context.userId, data.subjectType, data.subjectId);
  });

export const programmeCastVote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ voteId: uuid, optionId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { castVote } = await import("@/lib/programme-ops.server");
    return castVote(context.supabase, context.userId, data.voteId, data.optionId);
  });

export const programmeSetChecklistDone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ itemId: uuid, done: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { setChecklistItemDone } = await import("@/lib/programme-ops.server");
    return setChecklistItemDone(context.supabase, context.userId, data.itemId, data.done);
  });

export const programmeMarkNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ids: z.array(uuid).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const { markNotificationsRead } = await import("@/lib/programme-ops.server");
    return markNotificationsRead(context.supabase, context.userId, data.ids);
  });

export const programmeLeave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { leaveProgramme } = await import("@/lib/programme-ops.server");
    return leaveProgramme(context.supabase, context.userId);
  });

/* ─────────────────────────────── Join / claim ─────────────────────────────── */

/**
 * Public on purpose: a signed-out visitor with a link must be able to see which
 * programme it belongs to before creating an account. Only the programme name,
 * cohort name, city and dates are returned — never a roster or any content.
 */
export const programmeCodePreview = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ code }).parse(d))
  .handler(async ({ data }) => {
    const { previewJoinCode, previewInvite } = await import("@/lib/programme-ops.server");
    const join = await previewJoinCode(data.code);
    if (join) return { kind: "cohort" as const, cohort: join, invite: null };
    const invite = await previewInvite(data.code);
    if (invite) return { kind: "invite" as const, cohort: null, invite };
    return { kind: "unknown" as const, cohort: null, invite: null };
  });

export const programmeJoin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ code }).parse(d))
  .handler(async ({ data, context }) => {
    const { joinWithCode } = await import("@/lib/programme-ops.server");
    return joinWithCode(context.supabase, context.userId, data.code);
  });

export const programmeAcceptInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ code }).parse(d))
  .handler(async ({ data, context }) => {
    const { acceptInvite } = await import("@/lib/programme-ops.server");
    return acceptInvite(context.supabase, context.userId, data.code);
  });

/* ───────────────────────────────── Staff: events ──────────────────────────── */

export const staffCreateEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cohortId: uuid, input: eventFields }).parse(d))
  .handler(async ({ data, context }) => {
    const { createEvent } = await import("@/lib/programme-ops.server");
    return createEvent(context.supabase, context.userId, data.cohortId, data.input);
  });

export const staffUpdateEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        eventId: uuid,
        patch: eventFields.partial().extend({ notifyLevel: notifyLevel.optional(), note: text(300) }),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { updateEvent } = await import("@/lib/programme-ops.server");
    return updateEvent(context.supabase, context.userId, data.eventId, data.patch);
  });

export const staffDeleteEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ eventId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { deleteEvent } = await import("@/lib/programme-ops.server");
    return deleteEvent(context.supabase, context.userId, data.eventId);
  });

/* ────────────────────────────── Staff: announcements ──────────────────────── */

export const staffCreateAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cohortId: uuid, input: announcementFields }).parse(d))
  .handler(async ({ data, context }) => {
    const { createAnnouncement } = await import("@/lib/programme-ops.server");
    return createAnnouncement(context.supabase, context.userId, data.cohortId, data.input);
  });

export const staffDeleteAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { deleteAnnouncement } = await import("@/lib/programme-ops.server");
    return deleteAnnouncement(context.supabase, context.userId, data.id);
  });

/* ─────────────────────── Programme OS: Communications ──────────────────────── */

export const staffCommunicationsOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cohortId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { staffCommunicationsOverview: overview } = await import("@/lib/programme-ops.server");
    return overview(context.supabase, context.userId, data.cohortId);
  });

export const staffAnnouncementAcknowledgements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cohortId: uuid, announcementId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { staffAnnouncementAcknowledgements: detail } =
      await import("@/lib/programme-ops.server");
    return detail(context.supabase, context.userId, data.cohortId, data.announcementId);
  });

/* ─────────────────────────── Programme OS: Calendar ────────────────────────── */

export const staffCalendarOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cohortId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { staffCalendarOverview: overview } = await import("@/lib/programme-ops.server");
    return overview(context.supabase, context.userId, data.cohortId);
  });

export const staffEventResponses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cohortId: uuid, eventId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { staffEventResponses: responses } = await import("@/lib/programme-ops.server");
    return responses(context.supabase, context.userId, data.cohortId, data.eventId);
  });

/* ─────────────────────────────────── Staff: votes ─────────────────────────── */

export const staffCreateVote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cohortId: uuid, input: voteFields }).parse(d))
  .handler(async ({ data, context }) => {
    const { createVote } = await import("@/lib/programme-ops.server");
    return createVote(context.supabase, context.userId, data.cohortId, data.input);
  });

export const staffCloseVote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ voteId: uuid, winningOptionId: uuid.nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    const { closeVote } = await import("@/lib/programme-ops.server");
    return closeVote(context.supabase, context.userId, data.voteId, data.winningOptionId);
  });

export const staffApplyVoteWinner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ voteId: uuid, optionId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { applyVoteWinnerToEvent } = await import("@/lib/programme-ops.server");
    return applyVoteWinnerToEvent(context.supabase, context.userId, data.voteId, data.optionId);
  });

/* ─────────────────────── Staff: groups, roster, content ───────────────────── */

export const staffCreateGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ cohortId: uuid, name: z.string().trim().min(1).max(80), description: text(300) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { createGroup } = await import("@/lib/programme-ops.server");
    return createGroup(context.supabase, context.userId, data.cohortId, data.name, data.description ?? null);
  });

export const staffDeleteGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ groupId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { deleteGroup } = await import("@/lib/programme-ops.server");
    return deleteGroup(context.supabase, context.userId, data.groupId);
  });

export const staffSetGroupMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ groupId: uuid, memberId: uuid, member: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { setGroupMembership } = await import("@/lib/programme-ops.server");
    return setGroupMembership(context.supabase, context.userId, data.groupId, data.memberId, data.member);
  });

export const staffListParticipants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cohortId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { listParticipants } = await import("@/lib/programme-ops.server");
    return listParticipants(context.supabase, context.userId, data.cohortId);
  });

/* ─────────────────────────────── Programme OS: Students ────────────────────────── */

export const staffStudentRoster = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cohortId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { staffStudentRoster: roster } = await import("@/lib/programme-ops.server");
    return roster(context.supabase, context.userId, data.cohortId);
  });

export const staffStudentProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cohortId: uuid, studentId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { staffStudentProfile: profile } = await import("@/lib/programme-ops.server");
    return profile(context.supabase, context.userId, data.cohortId, data.studentId);
  });

/* ─────────────────────────────── Programme OS: Overview ────────────────────────── */

export const staffOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cohortId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { staffOverview: overview } = await import("@/lib/programme-ops.server");
    return overview(context.supabase, context.userId, data.cohortId);
  });

/* ─────────────────────────────── Programme OS: Onboarding ────────────────────────── */

export const staffOnboardingOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cohortId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { staffOnboardingOverview: overview } = await import("@/lib/programme-ops.server");
    return overview(context.supabase, context.userId, data.cohortId);
  });

export const staffNotifyOnboardingReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ cohortId: uuid, studentIds: z.array(uuid).min(1).max(200) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { notifyOnboardingReminder } = await import("@/lib/programme-ops.server");
    return notifyOnboardingReminder(context.supabase, context.userId, data.cohortId, data.studentIds);
  });

export const staffUpsertContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => contentInput.parse(d))
  .handler(async ({ data, context }) => {
    const { upsertContent } = await import("@/lib/programme-ops.server");
    return upsertContent(context.supabase, context.userId, {
      kind: data.kind,
      cohortId: data.cohortId,
      ...(data.id ? { id: data.id } : {}),
      ...(data.audience ? { audience: data.audience } : {}),
      values: data.values as Record<string, unknown>,
    });
  });

export const staffDeleteContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        kind: z.enum(["checklist_item", "document", "contact", "place"]),
        cohortId: uuid,
        id: uuid,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { deleteContent } = await import("@/lib/programme-ops.server");
    return deleteContent(context.supabase, context.userId, data.kind, data.cohortId, data.id);
  });

export const staffSeedChecklist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cohortId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { seedDefaultChecklist } = await import("@/lib/programme-ops.server");
    return seedDefaultChecklist(context.supabase, context.userId, data.cohortId);
  });

export const staffCohortInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cohortId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { cohortInviteDetails } = await import("@/lib/programme-ops.server");
    return cohortInviteDetails(context.supabase, context.userId, data.cohortId);
  });

/* ───────────────────────────── Internal Shekk admin ───────────────────────── */

export const adminProgrammeList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("@/lib/places/admin.server");
    await assertAdmin(context);
    const { adminListProgrammes } = await import("@/lib/programme-ops.server");
    return adminListProgrammes();
  });

export const adminProgrammeCreate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => programmeFields.parse(d))
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/places/admin.server");
    await assertAdmin(context);
    const { adminCreateProgramme } = await import("@/lib/programme-ops.server");
    return adminCreateProgramme(data);
  });

export const adminCohortCreate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => cohortFields.parse(d))
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/places/admin.server");
    await assertAdmin(context);
    const { adminCreateCohort } = await import("@/lib/programme-ops.server");
    return adminCreateCohort(data);
  });

export const adminProgrammeAssignOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        programmeId: uuid,
        email: z.string().trim().email().max(160),
        role: z.enum(["owner", "staff"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/places/admin.server");
    await assertAdmin(context);
    const { adminAssignOwnerByEmail } = await import("@/lib/programme-ops.server");
    return adminAssignOwnerByEmail(data.programmeId, data.email, data.role ?? "owner");
  });

export const adminProgrammeInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        programmeId: uuid,
        cohortId: uuid.nullish(),
        role: z.enum(["owner", "staff"]).optional(),
        email: text(160),
        note: text(300),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/places/admin.server");
    await assertAdmin(context);
    const { adminCreateInvite } = await import("@/lib/programme-ops.server");
    return adminCreateInvite({ ...data, createdBy: context.userId });
  });

export const adminProgrammeFlags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ programmeId: uuid, verified: z.boolean().optional(), active: z.boolean().optional() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/places/admin.server");
    await assertAdmin(context);
    const { adminSetProgrammeFlags } = await import("@/lib/programme-ops.server");
    return adminSetProgrammeFlags({ ...data, adminUserId: context.userId });
  });

export const adminProgrammeUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    programmeFields.partial().extend({ programmeId: uuid, status: z.enum(["active", "inactive", "archived"]).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/places/admin.server");
    await assertAdmin(context);
    const { adminUpdateProgramme } = await import("@/lib/programme-ops.server");
    return adminUpdateProgramme(data);
  });

export const adminCohortUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    cohortFields
      .omit({ programmeId: true })
      .partial()
      .extend({
        cohortId: uuid,
        status: z.enum(["open", "closed", "archived"]).optional(),
        regenerateJoinCode: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/places/admin.server");
    await assertAdmin(context);
    const { adminUpdateCohort } = await import("@/lib/programme-ops.server");
    return adminUpdateCohort(data);
  });

export const adminCohortDetailFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cohortId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/places/admin.server");
    await assertAdmin(context);
    const { adminCohortDetail } = await import("@/lib/programme-ops.server");
    return adminCohortDetail(data.cohortId);
  });

export const adminStaffSetRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ programmeId: uuid, userId: uuid, role: z.enum(["owner", "staff"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/places/admin.server");
    await assertAdmin(context);
    const { adminSetStaffRole } = await import("@/lib/programme-ops.server");
    return adminSetStaffRole(data.programmeId, data.userId, data.role);
  });

export const adminStaffRemove = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ programmeId: uuid, userId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/places/admin.server");
    await assertAdmin(context);
    const { adminRemoveStaff } = await import("@/lib/programme-ops.server");
    return adminRemoveStaff(data.programmeId, data.userId);
  });

export const adminInviteRevoke = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ inviteId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/places/admin.server");
    await assertAdmin(context);
    const { adminRevokeInvite } = await import("@/lib/programme-ops.server");
    return adminRevokeInvite(data.inviteId);
  });

/* ─────────────────────── Internal Shekk testing sandbox ───────────────────── */

/** Where the designated test programme stands. Shekk operators only. */
export const adminTestProgrammeStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("@/lib/places/admin.server");
    await assertAdmin(context);
    const { testProgrammeStatus } = await import("@/lib/programme-testbed.server");
    return testProgrammeStatus();
  });

/**
 * Create or reset the sandbox programme with the calling operator as both
 * owner-staff and participant. Only ever touches the designated test cohort.
 */
export const adminTestProgrammeReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("@/lib/places/admin.server");
    await assertAdmin(context);
    const { resetTestProgramme } = await import("@/lib/programme-testbed.server");
    return resetTestProgramme(context.userId);
  });
