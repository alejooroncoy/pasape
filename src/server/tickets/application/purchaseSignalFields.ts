// Extrae del body crudo de quote/buy los campos que el CheckoutGuard necesita,
// de forma defensiva (el body aún no pasó por el schema Zod cuando se evalúa el
// anti-bot, y nunca debe lanzar). Devuelve nulls si el shape no calza.

type RawItem = { ticketTypeId?: unknown; qty?: unknown };
type RawIdentity = { email?: unknown; phone?: unknown; dni?: unknown };
type RawBody = {
  eventId?: unknown;
  items?: unknown;
  guest?: unknown;
  buyer?: unknown;
};

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

const contactOf = (c: unknown): string | null => {
  if (!c || typeof c !== "object") return null;
  const { email, phone } = c as RawIdentity;
  return str(email) ?? str(phone);
};

const dniOf = (c: unknown): string | null => {
  if (!c || typeof c !== "object") return null;
  return str((c as RawIdentity).dni);
};

export const purchaseSignalFields = (
  body: unknown,
): {
  eventId: string | null;
  ticketTypeIds: string[] | null;
  qty: number | null;
  contact: string | null;
  dni: string | null;
} => {
  const b = (body ?? {}) as RawBody;
  const items = Array.isArray(b.items) ? (b.items as RawItem[]) : [];
  const ticketTypeIds = items.map((i) => str(i?.ticketTypeId)).filter((v): v is string => !!v);
  const qty = items.reduce((n, i) => n + (typeof i?.qty === "number" ? i.qty : 0), 0);
  return {
    eventId: str(b.eventId),
    ticketTypeIds: ticketTypeIds.length ? ticketTypeIds : null,
    qty: qty || null,
    // guest (no logueado) o buyer (logueado) — cualquiera trae el contacto/DNI.
    contact: contactOf(b.guest) ?? contactOf(b.buyer),
    dni: dniOf(b.guest) ?? dniOf(b.buyer),
  };
};
