import { redirect } from "next/navigation";
import { getAuthContext } from "@/server/_shared/AuthContext";
import { LoginClient } from "./LoginClient";

// Server-side: si ya hay sesión, redirige al `next` (o /org). Si no, renderiza
// el formulario de login. Sin destello.
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
    redirect(next ?? `/${locale}/org`);
  }
  return <LoginClient />;
}
