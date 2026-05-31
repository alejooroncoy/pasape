import { supabaseAdmin } from "@/server/_shared/supabase/admin";

export type EventPartner = {
  id: string;
  name: string;
  logoUrl: string | null;
  websiteUrl: string | null;
  sortOrder: number;
};

type PartnerRow = {
  id: string;
  name: string;
  logo_url: string | null;
  website_url: string | null;
  sort_order: number;
};

const toPartner = (r: PartnerRow): EventPartner => ({
  id: r.id,
  name: r.name,
  logoUrl: r.logo_url,
  websiteUrl: r.website_url,
  sortOrder: r.sort_order,
});

export const listEventPartners = async (eventId: string): Promise<EventPartner[]> => {
  const db = supabaseAdmin();
  const { data } = await db
    .from("event_partners")
    .select("id, name, logo_url, website_url, sort_order")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  return ((data ?? []) as PartnerRow[]).map(toPartner);
};

export const addEventPartner = async (
  eventId: string,
  input: { name: string; logoUrl?: string | null; websiteUrl?: string | null },
): Promise<EventPartner> => {
  const db = supabaseAdmin();
  const { data: last } = await db
    .from("event_partners")
    .select("sort_order")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();
  const nextOrder = last ? (last as { sort_order: number }).sort_order + 1 : 0;
  const { data, error } = await db
    .from("event_partners")
    .insert({
      event_id: eventId,
      name: input.name,
      logo_url: input.logoUrl ?? null,
      website_url: input.websiteUrl ?? null,
      sort_order: nextOrder,
    })
    .select("id, name, logo_url, website_url, sort_order")
    .single();
  if (error || !data) throw new Error(error?.message ?? "insert_failed");
  return toPartner(data as PartnerRow);
};

export const removeEventPartner = async (id: string, eventId: string): Promise<void> => {
  const db = supabaseAdmin();
  await db.from("event_partners").delete().eq("id", id).eq("event_id", eventId);
};
