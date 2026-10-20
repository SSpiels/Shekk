/**
 * Shekk Console — venue metadata. Server only.
 *
 * `venue_meta` is the ONLY place Shekk's own commercial facts about a venue
 * live: prices we phoned up and checked, contract length, facilities, partner
 * status. Google content — ratings, hours, photos, phone, address, review
 * counts — must never be copied in here, because Google's terms forbid keeping
 * a durable copy of Places content. The place id is the one storable Google
 * field, and it is the join key.
 *
 * Every function here runs with the service role, so each entry point in
 * `places-admin.functions.ts` must prove the caller holds the `admin` role.
 */

type AnyClient = { from: (t: string) => any; rpc: (fn: string, args?: Record<string, unknown>) => any };

async function db(): Promise<AnyClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as AnyClient;
}

/** Prove the signed-in caller is an operator before any service-role work. */
export async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error("Could not verify operator access");
  if (!data) throw new Error("Forbidden");
}

/** A venue_meta row as the console edits it — internal notes included. */
export type VenueMetaAdminRow = {
  id: string;
  placeId: string;
  label: string | null;
  nameSnapshot: string | null;
  chain: string | null;
  city: string | null;
  dayPassIls: number | null;
  monthlyIls: number | null;
  minContractMonths: number | null;
  facilities: string[];
  englishFriendly: boolean;
  shortStay: boolean;
  partner: boolean;
  partnerOffer: string | null;
  /** Shown to members. */
  notes: string | null;
  /** Console only. Never returned by member-facing place responses. */
  internalNotes: string | null;
  verifiedAt: string | null;
  active: boolean;
  updatedAt: string;
};

const toRow = (r: any): VenueMetaAdminRow => ({
  id: r.id,
  placeId: r.google_place_id,
  label: r.label ?? null,
  nameSnapshot: r.name_snapshot ?? null,
  chain: r.chain ?? null,
  city: r.city ?? null,
  dayPassIls: r.day_pass_ils ?? null,
  monthlyIls: r.monthly_ils ?? null,
  minContractMonths: r.min_contract_months ?? null,
  facilities: r.facilities ?? [],
  englishFriendly: Boolean(r.english_friendly),
  shortStay: Boolean(r.short_stay),
  partner: Boolean(r.partner),
  partnerOffer: r.partner_offer ?? null,
  notes: r.notes ?? null,
  internalNotes: r.internal_notes ?? null,
  verifiedAt: r.verified_at ?? null,
  active: Boolean(r.active),
  updatedAt: r.updated_at,
});

export async function listVenueMeta(search?: string): Promise<VenueMetaAdminRow[]> {
  const client = await db();
  let q = client.from("venue_meta").select("*").order("updated_at", { ascending: false }).limit(300);
  const term = (search ?? "").trim();
  if (term) {
    const like = `%${term.replace(/[%,]/g, "")}%`;
    q = q.or(
      `label.ilike.${like},name_snapshot.ilike.${like},chain.ilike.${like},city.ilike.${like},google_place_id.ilike.${like}`,
    );
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[]).map(toRow);
}

export type VenueMetaInput = {
  placeId: string;
  label?: string | null;
  nameSnapshot?: string | null;
  chain?: string | null;
  city?: string | null;
  dayPassIls?: number | null;
  monthlyIls?: number | null;
  minContractMonths?: number | null;
  facilities?: string[];
  englishFriendly?: boolean;
  shortStay?: boolean;
  partner?: boolean;
  partnerOffer?: string | null;
  notes?: string | null;
  internalNotes?: string | null;
  active?: boolean;
  /** Stamp `verified_at` with now, i.e. "I just checked these numbers". */
  markVerified?: boolean;
  /** Explicitly clear the verification stamp. */
  clearVerified?: boolean;
};

/**
 * Create or update the Shekk facts for one place id.
 *
 * A partner offer can only exist on a venue flagged as a partner: no signed
 * relationship, no published offer.
 */
export async function saveVenueMeta(input: VenueMetaInput): Promise<VenueMetaAdminRow> {
  const client = await db();

  const partner = input.partner ?? false;
  const offer = partner ? (input.partnerOffer?.trim() || null) : null;

  const patch: Record<string, unknown> = {
    google_place_id: input.placeId,
    label: input.label?.trim() || null,
    name_snapshot: input.nameSnapshot?.trim() || null,
    chain: input.chain?.trim() || null,
    city: input.city?.trim() || null,
    day_pass_ils: input.dayPassIls ?? null,
    monthly_ils: input.monthlyIls ?? null,
    min_contract_months: input.minContractMonths ?? null,
    facilities: input.facilities ?? [],
    english_friendly: input.englishFriendly ?? false,
    short_stay: input.shortStay ?? false,
    partner,
    partner_offer: offer,
    notes: input.notes?.trim() || null,
    internal_notes: input.internalNotes?.trim() || null,
    active: input.active ?? true,
  };
  if (input.markVerified) patch["verified_at"] = new Date().toISOString();
  if (input.clearVerified) patch["verified_at"] = null;

  const { data, error } = await client
    .from("venue_meta")
    .upsert(patch, { onConflict: "google_place_id" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return toRow(data);
}

export async function setVenueMetaActive(placeId: string, active: boolean): Promise<VenueMetaAdminRow> {
  const client = await db();
  const { data, error } = await client
    .from("venue_meta")
    .update({ active })
    .eq("google_place_id", placeId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return toRow(data);
}

export async function markVenueVerified(placeId: string): Promise<VenueMetaAdminRow> {
  const client = await db();
  const { data, error } = await client
    .from("venue_meta")
    .update({ verified_at: new Date().toISOString() })
    .eq("google_place_id", placeId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return toRow(data);
}

/**
 * Text-search Google so an operator can pick the right place id. Only the
 * fields needed to identify a venue are returned, and nothing is stored.
 */
export async function findPlacesForAdmin(
  query: string,
  userId: string,
): Promise<{ id: string; name: string; address: string; city: string | null }[]> {
  const { searchPlaces } = await import("./api.server");
  // Same metered budget as every member search — an operator is not exempt.
  const rows = await searchPlaces({ query }, userId);
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    address: p.address,
    city: p.meta.city ?? null,
  }));
}
