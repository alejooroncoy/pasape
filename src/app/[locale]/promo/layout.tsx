import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { getAuthContext } from "@/server/_shared/AuthContext";

// Guard server-side de /promo/*. Sin sesión Supabase → /login con ?next= a la
// ruta actual para que después del Google sign-in vuelva exactamente acá.
// Aplica a todas las páginas anidadas: /promo, /promo/earnings, /promo/profile,
// /promo/[slug]/*, etc.
export default async function PromoLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const auth = await getAuthContext();
  if (!auth.ok) {
    // x-pathname lo setea el proxy intl middleware con el path real para que
    // armemos un ?next= que respete sub-rutas (no solo /promo).
    const pathname = (await headers()).get("x-pathname") ?? `/${locale}/promo`;
    const next = encodeURIComponent(pathname);
    redirect(`/${locale}/login?next=${next}`);
  }
  return <>{children}</>;
}
