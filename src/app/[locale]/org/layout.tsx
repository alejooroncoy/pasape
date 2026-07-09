import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAuthContext } from "@/server/_shared/AuthContext";
import { NOINDEX_METADATA } from "@/lib/seo/metadata";

export const metadata: Metadata = NOINDEX_METADATA;

// Gate server-side de toda la zona /org/*. Sin sesión Supabase → /login.
// Las decisiones más finas (sin marcas → /org/new) viven en cada page.tsx.
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
  // por el gate (si no, sin sesión entraría en bucle de redirect).
  if (pathname.endsWith("/org/login")) return <>{children}</>;

  const auth = await getAuthContext();
  if (!auth.ok) {
    // ?next con el path actual para volver acá tras el login (de organizador).
    redirect(`/${locale}/org/login?next=${encodeURIComponent(pathname)}`);
  }
  return <>{children}</>;
}
