import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/server/_shared/supabase/server";
import { resolveDefaultLanding } from "@/server/_shared/landingRoute";
import { serverEvents } from "@/lib/analytics/serverEvents";

// Origin visto por el navegador (ngrok/proxy reescriben Host) — sin esto el
// redirect post-login mandaría a localhost en vez del dominio público.
const resolveOrigin = async (req: NextRequest) => {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? req.nextUrl.host;
  const proto = h.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  return `${proto}://${host}`;
};

// Solo aceptamos paths relativos en ?next= (nunca URLs absolutas → open redirect).
const safePath = (p: string | null) => (p && p.startsWith("/") && !p.startsWith("//") ? p : null);

// OAuth callback — Supabase nos manda acá con ?code=... después de Google.
// Intercambiamos el code por sesión (cookies se setean en createSupabaseServerClient)
// y después decidimos el destino:
//   · Si vino con ?next= lo respetamos (por ej., desde /c/[token] post-claim).
//   · Si no, resolveDefaultLanding consulta el rol y manda a /org, /promo o
//     /auth/onboarding según corresponda.
export const GET = async (req: NextRequest) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const nextParam = safePath(url.searchParams.get("next"));
  const origin = await resolveOrigin(req);

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        new URL(`/es?auth_error=${encodeURIComponent(error.message)}`, origin),
      );
    }

    const { data: userData } = await supabase.auth.getUser();
    if (userData?.user?.id) {
      serverEvents.identify(userData.user.id, {
        email: userData.user.email,
        name: userData.user.user_metadata?.full_name,
      });
      serverEvents.userSignedIn(userData.user.id, { provider: "google" });
    }

    if (!nextParam) {
      if (userData?.user?.id) {
        const dest = await resolveDefaultLanding(userData.user.id, "es");
        return NextResponse.redirect(new URL(dest, origin));
      }
    }
  }

  return NextResponse.redirect(new URL(nextParam ?? "/es/org", origin));
};
