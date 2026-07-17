import { protectedResourceHandler, metadataCorsOptionsRequestHandler } from "mcp-handler";

// RFC 9728: le dice al cliente MCP (Claude.ai, Cursor...) qué authorization
// server usar para pedir acceso a este resource server (/api/mcp). El
// authorization server es Pasape mismo (mismo origin) — ver /oauth/authorize.
//
// resourceUrl explícito: sin esto, mcp-handler lo deriva del pathname de ESTE
// endpoint (/.well-known/oauth-protected-resource), y como no cuelga bajo
// /api/mcp, la librería colapsa el "resource" al origin pelado
// ("https://pasape.lat" en vez de ".../api/mcp"). El cliente MCP valida que
// el resource coincida con la URL real del servidor al que se conecta, así
// que ese mismatch rompía la conexión después de una autorización exitosa.
const handler = protectedResourceHandler({
  authServerUrls: [resolveIssuer()],
  resourceUrl: `${resolveIssuer()}/api/mcp`,
});

function resolveIssuer(): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  return (envUrl || "https://pasape.lat").replace(/\/+$/, "");
}

export { handler as GET };
export const OPTIONS = metadataCorsOptionsRequestHandler();
