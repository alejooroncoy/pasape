import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { err, ok, type Result } from "@/server/_shared/result";

export type FollowedOrg = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  brandColor: string | null;
  followedAt: string;
};

type Row = {
  created_at: string;
  organizations: {
    id: string;
    slug: string;
    name: string;
    logo_url: string | null;
    brand_color: string | null;
  } | null;
};

export const listFollows = async (profileId: string): Promise<Result<FollowedOrg[]>> => {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("follows")
    .select("created_at, organizations:organization_id(id, slug, name, logo_url, brand_color)")
    .eq("follower_id", profileId)
    .order("created_at", { ascending: false });
  if (error) return err(error.message);
  const rows = (data ?? []) as unknown as Row[];
  return ok(
    rows
      .filter((r) => r.organizations !== null)
      .map((r) => ({
        id: r.organizations!.id,
        slug: r.organizations!.slug,
        name: r.organizations!.name,
        logoUrl: r.organizations!.logo_url,
        brandColor: r.organizations!.brand_color,
        followedAt: r.created_at,
      })),
  );
};
