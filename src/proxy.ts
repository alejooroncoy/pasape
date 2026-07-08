import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { updateSupabaseSession } from "@/server/_shared/supabase/middleware";
import { ipOf } from "@/server/_shared/rateLimit";
import { pendingTarpitMs } from "@/server/tickets/infrastructure/tarpitStore";

const intlMiddleware = createIntlMiddleware(routing);

// Path exacto de la fase de compra donde vive el tarpit anti-bot.
const BUY_PATH = "/api/tickets/buy";

// Tarpit anti-bot en la CAPA DE PROXY (barata), no dentro de la función de
// compra (cara). El CheckoutGuard armó un peaje de latencia por device/IP en
// Redis (ver tarpitStore.ts); aquí lo leemos y aplicamos el sleep ANTES de
// enrutar a /api/tickets/buy, de modo que la función serverless nunca queda
// esperando (no consume su concurrencia bajo un flood). Fail-open: sin peaje
// (o sin Redis) seguimos de largo sin latencia.
async function applyBuyTarpit(req: NextRequest): Promise<NextResponse> {
  const deviceHash = req.headers.get("x-device-hash")?.trim() || null;
  const ip = ipOf(req);
  const delay = await pendingTarpitMs(deviceHash, ip === "unknown" ? null : ip);
  if (delay > 0) await new Promise((r) => setTimeout(r, delay));
  return NextResponse.next();
}

// Compone: primero refresca la sesión de Supabase (cookies), después aplica intl.
// Si Supabase setea cookies en el response, las preservamos en el response final.
export default async function proxy(req: NextRequest) {
  // Rutas API de compra: solo aplicamos el tarpit diferido y seguimos (sin intl
  // ni sesión de Supabase, que no aplican a este endpoint).
  if (req.nextUrl.pathname === BUY_PATH) return applyBuyTarpit(req);

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
  // Excluimos `monitoring` (tunnelRoute de Sentry) y `ingest` (proxy de
  // PostHog) para que no los locale-routee: sus rewrites en next.config.ts
  // solo cubren el path sin prefijo, y varias de sus rutas (/ingest/s,
  // /ingest/e, /ingest/flags) no tienen extensión de archivo, así que sin
  // esta exclusión el middleware las redirige a /es/ingest/... y esa ruta
  // no matchea ningún rewrite → 404 silencioso (nunca llegaba nada a PostHog).
  // Excluimos las rutas de metadatos de imagen (opengraph-image/twitter-image),
  // que viven en la raíz y no deben recibir prefijo de locale.
  matcher: [
    "/((?!api|_next|_vercel|monitoring|ingest|auth/callback|opengraph-image|twitter-image|.*\\..*).*)",
    // Excepción al `?!api` de arriba: el proxy SÍ corre en la fase de compra para
    // aplicar el tarpit anti-bot diferido antes de tocar la función serverless.
    // Debe ser un literal estático (el matcher se analiza en build).
    "/api/tickets/buy",
  ],
};
