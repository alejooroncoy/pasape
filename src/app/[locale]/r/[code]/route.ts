import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";

/**
 * Referral entry — link que el promotor comparte por WhatsApp.
 * Route Handler (no page) porque necesitamos Set-Cookie + 302 antes de
 * cualquier render. Resuelve code → evento, atribuye y redirige al checkout.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string; locale: string }> },
) {
  const { code, locale } = await params;

  const db = supabaseAdmin();
  const { data: link } = await db
    .from("promoter_links")
    .select("id, code, event:events!inner(slug)")
    .eq("code", code)
    .maybeSingle<{
      id: string;
      code: string;
      event: { slug: string } | null;
    }>();

  if (!link?.event) {
    return new NextResponse("Link de promotor no encontrado", { status: 404 });
  }

  const target = new URL(
    `/${locale}/events/${link.event.slug}?promo=${encodeURIComponent(code)}`,
    req.url,
  );
  const res = NextResponse.redirect(target, 302);
  res.cookies.set("pasape_promo", code, {
    maxAge: 60 * 60 * 24 * 90,
    path: "/",
    sameSite: "lax",
  });
  return res;
}
