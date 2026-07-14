import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAuthContext } from "@/server/_shared/AuthContext";
import { NOINDEX_METADATA } from "@/lib/seo/metadata";
import { OrgShell } from "./_shell/OrgShell";

export const metadata: Metadata = NOINDEX_METADATA;

// Gate server-side de toda la zona /org/*. Sin sesión Supabase → /login.
// Las decisiones más finas (sin marcas → /org/new) viven en cada page.tsx.
//
// OrgShell (sidebar + topbar) vive ACÁ, no en cada page.tsx — así Next.js lo
// trata como parte del layout persistente y nunca lo desmonta al navegar entre
// rutas de /org. Antes cada página montaba su propio OrgShell, así que el
// loading.tsx de turno reemplazaba TODA la pantalla (sidebar incluido) por un
// skeleton falso, y al terminar la navegación el sidebar real volvía a montar
// desde cero — un doble parpadeo. Con el shell acá, solo el <main> de adentro
// suspende; el sidebar se queda quieto.
export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const h = await headers();
  const pathname = h.get("x-pathname") ?? `/${locale}/org`;

  // La propia página de login de organizador vive bajo /org pero NO debe pasar
  // por el gate (si no, sin sesión entraría en bucle de redirect) NI por el
  // shell (es su propia pantalla completa, sin sidebar).
  if (pathname.endsWith("/org/login")) return <>{children}</>;

  const auth = await getAuthContext();
  if (!auth.ok) {
    // ?next con el path actual para volver acá tras el login (de organizador).
    redirect(`/${locale}/org/login?next=${encodeURIComponent(pathname)}`);
  }
  return <OrgShell>{children}</OrgShell>;
}
