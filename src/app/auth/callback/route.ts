import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/server/_shared/supabase/server";
import { resolveDefaultLanding } from "@/server/_shared/landingRoute";

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

    if (!nextParam) {
      const { data } = await supabase.auth.getUser();
      if (data?.user?.id) {
        const dest = await resolveDefaultLanding(data.user.id, "es");
        return NextResponse.redirect(new URL(dest, origin));
      }
    }
  }

  return NextResponse.redirect(new URL(nextParam ?? "/es/org", origin));
};
