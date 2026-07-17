import { NextResponse } from "next/server";
import { metadataCorsOptionsRequestHandler } from "mcp-handler";

// RFC 8414: metadata del authorization server que Pasape implementa para
// "Pasape MCP" — Claude.ai/Claude Desktop/Cursor la leen para saber a dónde
// mandar al usuario a loguearse/consentir y dónde canjear el code por tokens.
// PKCE S256 obligatorio, sin client_secret (clientes públicos, DCR).
const resolveIssuer = (): string => {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  return (envUrl || "https://pasape.lat").replace(/\/+$/, "");
};

// El GET también necesita el header (no solo el preflight OPTIONS): es un
// simple request así que el browser no hace preflight, pero igual bloquea la
// lectura de la respuesta sin Access-Control-Allow-Origin — visto en vivo
// como un 503 fantasma en el tab (server respondía 200, el browser lo
// tiraba). Cliente MCP basado en browser (Claude.ai web, Inspector) lee esto
// desde SU origen, cross-origin con pasape.lat.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

export const GET = () => {
  const issuer = resolveIssuer();
  return NextResponse.json(
    {
      issuer,
      authorization_endpoint: `${issuer}/oauth/authorize`,
      token_endpoint: `${issuer}/api/oauth/token`,
      registration_endpoint: `${issuer}/api/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: ["events:write"],
    },
    { headers: CORS_HEADERS },
  );
};

export const OPTIONS = metadataCorsOptionsRequestHandler();
