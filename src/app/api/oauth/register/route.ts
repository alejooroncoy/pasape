import { NextResponse } from "next/server";
import { z } from "zod";
import { registerOAuthClient } from "@/server/identity/oauth/application/RegisterOAuthClient";

// RFC 7591 Dynamic Client Registration: Claude.ai/Cursor llaman esto solos la
// primera vez que el usuario pega la URL del MCP — no hay pantalla donde el
// fundador da de alta apps a mano.
const schema = z.object({
  client_name: z.string().trim().min(1).max(120).optional(),
  redirect_uris: z.array(z.string().url()).min(1),
});

// CORS abierto (igual que /api/oauth/token): clientes MCP basados en browser
// registran el client desde SU origen, no desde pasape.lat.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Max-Age": "86400",
};

const json = (body: unknown, status: number) =>
  NextResponse.json(body, { status, headers: CORS_HEADERS });

export const OPTIONS = () => new NextResponse(null, { status: 204, headers: CORS_HEADERS });

export const POST = async (req: Request) => {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return json(
      { error: "invalid_client_metadata", error_description: parsed.error.issues[0]?.message },
      400,
    );
  }

  const result = await registerOAuthClient({
    clientName: parsed.data.client_name ?? "MCP client",
    redirectUris: parsed.data.redirect_uris,
  });
  if (!result.ok) {
    return json({ error: "invalid_client_metadata" }, 400);
  }

  return json(
    {
      client_id: result.value.clientId,
      client_name: parsed.data.client_name ?? "MCP client",
      redirect_uris: parsed.data.redirect_uris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    },
    201,
  );
};
