import { openDB, type IDBPDatabase } from "idb";
import { resolveUrl } from "@/lib/_shared/api-client";
import { deviceHeaders } from "@/lib/scanning/deviceId";

const DB_NAME = "pasape-scan";
const STORE = "tickets";
const META = "meta";
const PENDING = "pending_scans";
const VERSION = 3;

export type CachedTicket = {
  ticketId: string;
  qrCode: string;
  holderName: string | null;
  holderDniLast4: string | null;
  ticketTypeName: string;
  boxLabel: string | null;
  boxHostTicketId: string | null;
  status: "active" | "used" | "void" | "refunded";
  /** Clave pública ECDSA del ticket (para verificar QR compacto offline). */
  signingPub: JsonWebKey | null;
};

type ScanCacheResponse = {
  eventId: string;
  fetchedAt: string;
  tickets: CachedTicket[];
};

async function db(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, VERSION, {
    upgrade(db, oldVersion) {
      if (!db.objectStoreNames.contains(STORE)) {
        const s = db.createObjectStore(STORE, { keyPath: "ticketId" });
        s.createIndex("qrCode", "qrCode", { unique: false });
      } else if (oldVersion < 3) {
        // Migrar keyPath de qrCode → ticketId
        db.deleteObjectStore(STORE);
        const s = db.createObjectStore(STORE, { keyPath: "ticketId" });
        s.createIndex("qrCode", "qrCode", { unique: false });
      }
      if (!db.objectStoreNames.contains(META)) {
        db.createObjectStore(META);
      }
      if (!db.objectStoreNames.contains(PENDING)) {
        const s = db.createObjectStore(PENDING, { keyPath: "id", autoIncrement: true });
        s.createIndex("synced", "synced");
        s.createIndex("scannedAt", "scannedAt");
      }
    },
  });
}

export async function refreshScanCache(slug: string): Promise<number> {
  const res = await fetch(resolveUrl(`/api/events/${slug}/scan-cache`), {
    headers: deviceHeaders(),
  });
  if (!res.ok) throw new Error("scan_cache_fetch_failed");
  const json: ScanCacheResponse = await res.json();
  const d = await db();
  const tx = d.transaction([STORE, META], "readwrite");
  await tx.objectStore(STORE).clear();
  for (const t of json.tickets) {
    await tx.objectStore(STORE).put(t);
  }
  await tx.objectStore(META).put(json.fetchedAt, "lastSync");
  await tx.objectStore(META).put(json.eventId, "eventId");
  await tx.done;
  // Refrescamos la pública del evento junto con el cache (best-effort).
  try {
    await cacheEventSigningKey(slug);
  } catch {
    // sin red o evento sin clave aún: best-effort, no bloquea el cache
  }
  return json.tickets.length;
}

export async function lookupTicketById(
  ticketId: string,
): Promise<CachedTicket | null> {
  const d = await db();
  return (await d.get(STORE, ticketId)) ?? null;
}

export async function markUsedLocalById(ticketId: string): Promise<void> {
  const d = await db();
  const t = await d.getFromIndex(STORE, "ticketId", ticketId);
  if (t) await d.put(STORE, { ...t, status: "used" });
}

/**
 * Cachea la pública ECDSA del evento (para verificar QR firmados offline).
 * Best-effort: si falla, el portero igual valida por lookup estático.
 */
export async function cacheEventSigningKey(slug: string): Promise<void> {
  const res = await fetch(resolveUrl(`/api/events/${slug}/signing-key`), {
    headers: deviceHeaders(),
  });
  if (!res.ok) return;
  const json = (await res.json()) as { data?: { publicKey: JsonWebKey } };
  if (!json.data?.publicKey) return;
  const d = await db();
  await d.put(META, json.data.publicKey, "signingKey");
}

export async function getCachedSigningKey(): Promise<JsonWebKey | null> {
  const d = await db();
  return (await d.get(META, "signingKey")) ?? null;
}

/** Normaliza para búsqueda: sin acentos, minúsculas. */
const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Búsqueda instantánea sobre la lista cacheada localmente — sin red.
 * Numérico → match por últimos 4 dígitos del DNI. Texto → match por nombre.
 * Prioriza: prefijo de nombre > contiene > DNI. Devuelve hasta `limit`.
 */
export async function searchCachedTickets(query: string, limit = 30): Promise<CachedTicket[]> {
  const q = query.trim();
  if (!q) return [];
  const d = await db();
  const all: CachedTicket[] = await d.getAll(STORE);
  const isNumeric = /^\d+$/.test(q);

  if (isNumeric) {
    const last4 = q.slice(-4);
    return all
      .filter((t) => t.status !== "void" && t.holderDniLast4 === last4)
      .slice(0, limit);
  }

  const nq = normalize(q);
  const scored = all
    .filter((t) => t.status !== "void" && t.holderName)
    .map((t) => {
      const name = normalize(t.holderName!);
      // 0 = empieza con la query (mejor), 1 = la contiene, -1 = no match
      const rank = name.startsWith(nq) ? 0 : name.includes(nq) ? 1 : -1;
      return { t, rank };
    })
    .filter((x) => x.rank >= 0)
    .sort((a, b) => a.rank - b.rank || a.t.holderName!.localeCompare(b.t.holderName!));

  return scored.slice(0, limit).map((x) => x.t);
}


export async function lastSyncAt(): Promise<string | null> {
  const d = await db();
  return (await d.get(META, "lastSync")) ?? null;
}

export async function getEventIdFromCache(): Promise<string | null> {
  const d = await db();
  return (await d.get(META, "eventId")) ?? null;
}

export async function clearCache(): Promise<void> {
  const d = await db();
  const tx = d.transaction([STORE, META], "readwrite");
  await tx.objectStore(STORE).clear();
  await tx.objectStore(META).clear();
  await tx.done;
}
