import { NextResponse } from "next/server";
import { getAuthContext } from "@/server/_shared/AuthContext";
import { supabaseOrganizationRepository } from "@/server/identity/organizations/infrastructure/repositories/SupabaseOrganizationRepository";
import { getOAuthClient } from "@/server/identity/oauth/application/GetOAuthClient";
import { createAuthorizationCode } from "@/server/identity/oauth/application/CreateAuthorizationCode";

// Acción del form de /oauth/authorize (task 12): el organizador ya vio "Claude
// quiere crear eventos en tu organización X" y tocó Aprobar/Cancelar. Esto
// nunca lo llama el cliente MCP directo — solo el navegador del organizador,
// con su cookie de sesión ya puesta.
export const POST = async (req: Request) => {
  const auth = await getAuthContext();
  if (!auth.ok) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const form = await req.formData();
  const decision = String(form.get("decision") ?? "");
  const clientId = String(form.get("client_id") ?? "");
  const redirectUri = String(form.get("redirect_uri") ?? "");
  const codeChallenge = String(form.get("code_challenge") ?? "");
  const state = form.get("state") ? String(form.get("state")) : null;
  const organizationId = String(form.get("organization_id") ?? "");

  const client = await getOAuthClient(clientId);
  if (!client || !client.redirectUris.includes(redirectUri)) {
    return NextResponse.json({ error: "invalid_client" }, { status: 400 });
  }

  const redirectWith = (params: Record<string, string>) => {
    const url = new URL(redirectUri);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    if (state) url.searchParams.set("state", state);
    return NextResponse.redirect(url);
  };

  if (decision !== "approve") {
    return redirectWith({ error: "access_denied" });
  }

  // El organizador solo puede consentir en nombre de una org de la que es
  // miembro — nunca confiar en el organization_id que viene del form sin
  // validar contra su membresía real.
  const orgs = await supabaseOrganizationRepository.listByMember(auth.value.profileId);
  if (!orgs.some((o) => o.id === organizationId)) {
    return NextResponse.json({ error: "invalid_organization" }, { status: 403 });
  }

  const result = await createAuthorizationCode({
    clientId,
    redirectUri,
    codeChallenge,
    organizationId,
    profileId: auth.value.profileId,
  });
  if (!result.ok) return NextResponse.json({ error: "server_error" }, { status: 500 });

  return redirectWith({ code: result.value.code });
};
