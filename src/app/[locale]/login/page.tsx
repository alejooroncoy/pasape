import { redirect } from "next/navigation";
import { getAuthContext } from "@/server/_shared/AuthContext";
import { resolveDefaultLanding } from "@/server/_shared/landingRoute";
import { LoginClient } from "./LoginClient";

// Server-side: si ya hay sesión, redirige al `next` o al destino que
// corresponda según el rol del usuario (org / promo / onboarding).
// Sin destello.
export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const [{ locale }, { next }] = await Promise.all([params, searchParams]);
  const auth = await getAuthContext();
  if (auth.ok) {
    const dest = next ?? (await resolveDefaultLanding(auth.value.profileId, locale));
    redirect(dest);
  }
  return <LoginClient />;
}
