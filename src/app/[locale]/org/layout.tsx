import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAuthContext } from "@/server/_shared/AuthContext";

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
  const auth = await getAuthContext();
  if (!auth.ok) {
    // Construimos el ?next con el path actual para volver acá tras el login.
    const h = await headers();
    const pathname = h.get("x-pathname") ?? `/${locale}/org`;
    redirect(`/${locale}/login?next=${encodeURIComponent(pathname)}`);
  }
  return <>{children}</>;
}
