import { NextResponse } from "next/server";
import {
  exchangeAuthorizationCode,
  refreshAccessToken,
} from "@/server/identity/oauth/application/ExchangeAuthorizationCode";

// RFC 6749 §4.1.3 / §6 — cuerpo application/x-www-form-urlencoded, shape de
// respuesta fijo por el spec (access_token/token_type/expires_in/...). No usar
// el helper `json()` interno de Pasape (envuelve en {data}/{error}): esto es
// un contrato de protocolo, no la convención REST del resto de la app.
export const POST = async (req: Request) => {
  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const grantType = form.get("grant_type");
  const clientId = String(form.get("client_id") ?? "");

  if (grantType === "authorization_code") {
    const code = String(form.get("code") ?? "");
    const redirectUri = String(form.get("redirect_uri") ?? "");
    const codeVerifier = String(form.get("code_verifier") ?? "");
    if (!code || !redirectUri || !codeVerifier || !clientId) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }
    const result = await exchangeAuthorizationCode({ code, clientId, redirectUri, codeVerifier });
    if (!result.ok) {
      return NextResponse.json({ error: "invalid_grant" }, { status: 400 });
    }
    return NextResponse.json({
      access_token: result.value.accessToken,
      token_type: "Bearer",
      expires_in: result.value.expiresInSeconds,
      refresh_token: result.value.refreshToken,
    });
  }

  if (grantType === "refresh_token") {
    const refreshToken = String(form.get("refresh_token") ?? "");
    if (!refreshToken || !clientId) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }
    const result = await refreshAccessToken({ refreshToken, clientId });
    if (!result.ok) {
      return NextResponse.json({ error: "invalid_grant" }, { status: 400 });
    }
    return NextResponse.json({
      access_token: result.value.accessToken,
      token_type: "Bearer",
      expires_in: result.value.expiresInSeconds,
      refresh_token: result.value.refreshToken,
    });
  }

  return NextResponse.json({ error: "unsupported_grant_type" }, { status: 400 });
};
