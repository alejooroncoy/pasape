import { protectedResourceHandler, metadataCorsOptionsRequestHandler } from "mcp-handler";

// RFC 9728 §3.1: además del path "bare" (/.well-known/oauth-protected-resource),
// los clientes MCP prueban primero la variante con el path del resource
// server pegado al final (acá /api/mcp, ver ../route.ts). Sin este archivo
// esa variante 404ea — visto en vivo con MCP Inspector (fallback silencioso
// al bare path, pero un cliente más estricto podría no reintentar).
const handler = protectedResourceHandler({ authServerUrls: [resolveIssuer()] });

function resolveIssuer(): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  return (envUrl || "https://pasape.lat").replace(/\/+$/, "");
}

export { handler as GET };
export const OPTIONS = metadataCorsOptionsRequestHandler();
