import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/server/_shared/supabase/server";

// OAuth callback — Supabase nos manda acá con ?code=... después de Google.
// Intercambiamos el code por sesión (cookies se setean en createSupabaseServerClient).
export const GET = async (req: NextRequest) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/es/org";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL(`/es?auth_error=${encodeURIComponent(error.message)}`, url.origin));
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
};
