import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export const updateSupabaseSession = async (request: NextRequest) => {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // CLAVE: getUser() refresca el access token y, vía setAll, rota las cookies de
  // sesión en el response. Sin esto la cookie caduca y el usuario aparece
  // deslogueado en el server (aunque el cliente crea tener sesión). Puede lanzar
  // si el refresh token ya venció — lo tratamos como "sin sesión" sin romper.
  try {
    await supabase.auth.getUser();
  } catch {
    // refresh token vencido/ausente: el usuario tendrá que reloguear
  }
  return response;
};
