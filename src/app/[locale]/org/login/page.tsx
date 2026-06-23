import { redirect } from "next/navigation";
import { getAuthContext } from "@/server/_shared/AuthContext";
import { resolveDefaultLanding } from "@/server/_shared/landingRoute";
import { OrgLoginClient } from "./OrgLoginClient";

// Login del panel de organizador/promotor. Si ya hay sesión, va al `next` o al
// destino que corresponda según el rol (org / promo / onboarding). Sin destello.
export default async function OrgLoginPage({
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
  return <OrgLoginClient />;
}
