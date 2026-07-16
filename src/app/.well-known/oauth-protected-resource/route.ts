import { protectedResourceHandler, metadataCorsOptionsRequestHandler } from "mcp-handler";

// RFC 9728: le dice al cliente MCP (Claude.ai, Cursor...) qué authorization
// server usar para pedir acceso a este resource server (/api/mcp). El
// authorization server es Pasape mismo (mismo origin) — ver /oauth/authorize.
const handler = protectedResourceHandler({ authServerUrls: [resolveIssuer()] });

function resolveIssuer(): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  return (envUrl || "https://pasape.lat").replace(/\/+$/, "");
}

export { handler as GET };
export const OPTIONS = metadataCorsOptionsRequestHandler();
