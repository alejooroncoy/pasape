import { openDB, type IDBPDatabase } from "idb";

// Recuerda, en este device, qué órdenes ya reclamó el usuario vía /unlock.
//
// UnlockPage dispara `claimOrder` (mutación POST) al detectar sesión activa.
// Las mutaciones no las cubre el Service Worker (solo intercepta GET), así que
// sin red esa llamada cuelga o falla — aunque la orden ya esté reclamada y el
// ticket ya sea 100% visible offline (ver /tickets/[id] + useLocalRotatingQr).
// Este store deja saltar esa mutación en visitas repetidas: la app solo
// necesita red la PRIMERA vez que alguien reclama cada orden.

const DB_NAME = "pasape-claimed-orders";
const STORE = "claims";
const VERSION = 1;

type ClaimedOrderRecord = {
  orderId: string;
  ticketsClaimed: number;
  firstTicketId: string | null;
  eventSlug: string;
  claimedAt: number;
};

async function db(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(STORE)) {
        database.createObjectStore(STORE, { keyPath: "orderId" });
      }
    },
  });
}

export async function getCachedClaim(
  orderId: string,
): Promise<Omit<ClaimedOrderRecord, "orderId" | "claimedAt"> | null> {
  const conn = await db();
  const rec = (await conn.get(STORE, orderId)) as ClaimedOrderRecord | undefined;
  if (!rec) return null;
  return { ticketsClaimed: rec.ticketsClaimed, firstTicketId: rec.firstTicketId, eventSlug: rec.eventSlug };
}

export async function saveClaim(
  orderId: string,
  result: { ticketsClaimed: number; firstTicketId: string | null; eventSlug: string },
): Promise<void> {
  const conn = await db();
  await conn.put(STORE, { orderId, ...result, claimedAt: Date.now() } satisfies ClaimedOrderRecord);
}
