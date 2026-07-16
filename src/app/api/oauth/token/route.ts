import { NextResponse } from "next/server";
import {
  exchangeAuthorizationCode,
  refreshAccessToken,
} from "@/server/identity/oauth/application/ExchangeAuthorizationCode";

// RFC 6749 §4.1.3 / §6 — cuerpo application/x-www-form-urlencoded, shape de
// respuesta fijo por el spec (access_token/token_type/expires_in/...). No usar
// el helper `json()` interno de Pasape (envuelve en {data}/{error}): esto es
// un contrato de protocolo, no la convención REST del resto de la app.
//
// CORS abierto (igual que las rutas .well-known/mcp-handler): clientes MCP
// basados en browser (Claude.ai web, MCP Inspector) canjean el code por el
// token con un fetch desde SU origen, no desde pasape.lat — sin estos headers
// el navegador bloquea la respuesta antes de que el cliente la vea aunque el
// server haya respondido 200 (visto en vivo: "TypeError: Failed to fetch").
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Max-Age": "86400",
};

export const OPTIONS = () => new NextResponse(null, { status: 204, headers: CORS_HEADERS });

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: CORS_HEADERS });

export const POST = async (req: Request) => {
  const form = await req.formData().catch(() => null);
  if (!form) {
    return json({ error: "invalid_request" }, 400);
  }
  const grantType = form.get("grant_type");
  const clientId = String(form.get("client_id") ?? "");

  if (grantType === "authorization_code") {
    const code = String(form.get("code") ?? "");
    const redirectUri = String(form.get("redirect_uri") ?? "");
    const codeVerifier = String(form.get("code_verifier") ?? "");
    if (!code || !redirectUri || !codeVerifier || !clientId) {
      return json({ error: "invalid_request" }, 400);
    }
    const result = await exchangeAuthorizationCode({ code, clientId, redirectUri, codeVerifier });
    if (!result.ok) {
      return json({ error: "invalid_grant" }, 400);
    }
    return json({
      access_token: result.value.accessToken,
      token_type: "Bearer",
      expires_in: result.value.expiresInSeconds,
      refresh_token: result.value.refreshToken,
    });
  }

  if (grantType === "refresh_token") {
    const refreshToken = String(form.get("refresh_token") ?? "");
    if (!refreshToken || !clientId) {
      return json({ error: "invalid_request" }, 400);
    }
    const result = await refreshAccessToken({ refreshToken, clientId });
    if (!result.ok) {
      return json({ error: "invalid_grant" }, 400);
    }
    return json({
      access_token: result.value.accessToken,
      token_type: "Bearer",
      expires_in: result.value.expiresInSeconds,
      refresh_token: result.value.refreshToken,
    });
  }

  return json({ error: "unsupported_grant_type" }, 400);
};
