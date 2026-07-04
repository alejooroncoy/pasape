import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";

/**
 * Public display name for a promoter link (`/r/[code]`).
 *
 * Liviano a propósito: el checkout y la página del evento solo necesitan el
 * nombre para el chip "Promotor: …" — nada de ventas ni comisiones (eso vive
 * en `/api/r/[code]/state` para la landing del promotor).
 */
export const GET = async (
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) => {
  const { code } = await params;
  const db = supabaseAdmin();

  const { data: linkRow } = await db
    .from("promoter_links")
    .select("code, profile:profiles(full_name), org_promoter:org_promoters(name)")
    .eq("code", code)
    .maybeSingle();

  type Row = {
    code: string;
    profile: { full_name: string | null } | null;
    org_promoter: { name: string | null } | null;
  };
  const link = linkRow as Row | null;

  if (!link) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const name = link.profile?.full_name ?? link.org_promoter?.name ?? link.code;

  return NextResponse.json(
    { data: { name } },
    // El nombre del promotor casi nunca cambia: cachear en el edge 5 min.
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } },
  );
};
