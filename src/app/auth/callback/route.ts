import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/server/_shared/supabase/server";
import { resolveDefaultLanding } from "@/server/_shared/landingRoute";

// OAuth callback — Supabase nos manda acá con ?code=... después de Google.
// Intercambiamos el code por sesión (cookies se setean en createSupabaseServerClient)
// y después decidimos el destino:
//   · Si vino con ?next= lo respetamos (por ej., desde /c/[token] post-claim).
//   · Si no, resolveDefaultLanding consulta el rol y manda a /org, /promo o
//     /auth/onboarding según corresponda.
export const GET = async (req: NextRequest) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next");

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        new URL(`/es?auth_error=${encodeURIComponent(error.message)}`, url.origin),
      );
    }

    if (!nextParam) {
      const { data } = await supabase.auth.getUser();
      if (data?.user?.id) {
        const dest = await resolveDefaultLanding(data.user.id, "es");
        return NextResponse.redirect(new URL(dest, url.origin));
      }
    }
  }

  return NextResponse.redirect(new URL(nextParam ?? "/es/org", url.origin));
};
