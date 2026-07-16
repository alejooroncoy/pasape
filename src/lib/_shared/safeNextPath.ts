// Sanea un parámetro `?next=` / destino de retorno post-login para evitar open
// redirects. Solo se aceptan paths RELATIVOS del mismo origen: deben empezar con
// un único "/" y no con "//" ni "/\" (ambos resuelven a un host externo en el
// navegador). Cualquier URL absoluta (https://evil.com), protocol-relative
// (//evil.com) o esquema raro (javascript:) se descarta.
//
// El callback server-side (/auth/callback) ya aplica esta misma regla; este
// helper la comparte con el cliente (LoginClient/PostLoginRedirect), donde el
// valor de sessionStorage también termina en un router.replace().
export function safeNextPath(p: string | null | undefined): string | null {
  if (!p) return null;
  if (!p.startsWith("/")) return null;
  if (p.startsWith("//") || p.startsWith("/\\")) return null;
  return p;
}
