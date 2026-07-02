import createIntlMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { updateSupabaseSession } from "@/server/_shared/supabase/middleware";

const intlMiddleware = createIntlMiddleware(routing);

// Compone: primero refresca la sesión de Supabase (cookies), después aplica intl.
// Si Supabase setea cookies en el response, las preservamos en el response final.
export default async function proxy(req: NextRequest) {
  const supabaseResponse = await updateSupabaseSession(req);
  const intlResponse = intlMiddleware(req);

  supabaseResponse.cookies.getAll().forEach((c) => {
    intlResponse.cookies.set(c.name, c.value);
  });

  // Exponemos el pathname para que server components (ej: layouts de auth)
  // puedan armar redirects de `?next=` apuntando a la ruta exacta.
  intlResponse.headers.set("x-pathname", req.nextUrl.pathname);

  return intlResponse;
}

export const config = {
  // `organizadores` (landing B2B) ya vive bajo [locale] — pasa por el intl
  // middleware como cualquier otra ruta, preparado para más idiomas.
  // Excluimos `auth/callback` para que reciba el `code` sin redirects de i18n.
  // Excluimos `monitoring` (tunnelRoute de Sentry) para que no lo locale-routee.
  // Excluimos las rutas de metadatos de imagen (opengraph-image/twitter-image),
  // que viven en la raíz y no deben recibir prefijo de locale.
  matcher: [
    "/((?!api|_next|_vercel|monitoring|auth/callback|opengraph-image|twitter-image|.*\\..*).*)",
  ],
};
