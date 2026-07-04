import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";

// Origin visto por el navegador (ngrok/proxy reescriben Host): sin esto el
// redirect mandaría al comprador a localhost en vez del dominio público.
const resolveOrigin = async (req: NextRequest) => {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? req.nextUrl.host;
  const proto = h.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  return `${proto}://${host}`;
};

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
    .select("id, code, event:events!inner(slug, status)")
    .eq("code", code)
    .maybeSingle<{
      id: string;
      code: string;
      event: { slug: string; status: string } | null;
    }>();

  if (!link?.event) {
    return new NextResponse("Link de promotor no encontrado", { status: 404 });
  }

  const eventActive = link.event.status === "published";

  // Si el evento está cerrado/cancelado, redirigir igual pero sin promo code
  // (el comprador puede ver el evento pero no se atribuye a nadie).
  const target = new URL(
    `/${locale}/events/${link.event.slug}${eventActive ? `?promo=${encodeURIComponent(code)}` : ""}`,
    await resolveOrigin(req),
  );
  const res = NextResponse.redirect(target, 302);
  if (eventActive) {
    res.cookies.set("pasape_promo", code, {
      maxAge: 60 * 60 * 24 * 90,
      path: "/",
      sameSite: "lax",
    });
  }
  return res;
}
