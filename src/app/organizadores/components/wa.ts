export const WA_NUMBER = "51946189585";

export const WA_DEFAULT_MSG = [
  "Hola, quiero probar Pasape para mi evento.",
  "",
  "Nombre del evento:",
  "Fecha aproximada:",
  "Cantidad estimada de asistentes:",
].join("\n");

export function buildWaLink(number: string, message: string): string {
  const clean = String(number || "").replace(/[^\d]/g, "");
  const msg = encodeURIComponent(message || "").replace(/%20/g, "+");
  return `https://wa.me/${clean}?text=${msg}`;
}

export const WA_HREF = buildWaLink(WA_NUMBER, WA_DEFAULT_MSG);
