import { openDB, type IDBPDatabase } from "idb";
import { resolveUrl } from "@/lib/_shared/api-client";
import { deviceHeaders } from "@/lib/scanning/deviceId";

const DB_NAME = "pasape-scan";
const STORE = "tickets";
const META = "meta";
const PENDING = "pending_scans";
const VERSION = 4;

export type CachedTicket = {
  ticketId: string;
  ticketTypeId: string;
  qrCode: string;
  holderName: string | null;
  holderDniLast4: string | null;
  ticketTypeName: string;
  boxLabel: string | null;
  boxHostTicketId: string | null;
  status: "active" | "used" | "void" | "refunded";
  /** Clave pública ECDSA del ticket (para verificar QR compacto offline). */
  signingPub: JsonWebKey | null;
  /** Aforo del box (asientos). Solo para tickets de box; null si no es box. */
  boxCapacity: number | null;
};

type ScanCacheResponse = {
  eventId: string;
  fetchedAt: string;
  /** true = snapshot completo (reemplaza el cache); false = delta (merge). */
  full: boolean;
  zonePolicy: ZoneScanPolicy;
  tickets: CachedTicket[];
};

/** Reglas de puerta cacheadas junto al snapshot offline. */
export type ZoneScanPolicy = {
  enforce: boolean;
  allowedTicketTypeIds: string[];
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
      if (oldVersion < 4 && db.objectStoreNames.contains(STORE)) {
        // ticketTypeId + zonePolicy — forzar re-sync completo en el próximo refresh.
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

let syncing = false;

export async function refreshScanCache(
  slug: string,
  opts: { full?: boolean } = {},
): Promise<number> {
  // Anti-stacking: en red lenta, no encimar syncs (un fetch colgado + ticks cada
  // 5s apilarían llamadas). Si ya hay uno en curso, este tick se salta.
  if (syncing) return 0;
  syncing = true;
  try {
  const d = await db();
  // Delta por defecto: solo lo cambiado desde el último sync (transferencias,
  // datos, uso, anulación, altas). full=true (o sin lastSync) trae el snapshot.
  const lastSync = opts.full ? null : ((await d.get(META, "lastSync")) as string | null);
  // Overlap de 3s: reconsultar el borde evita perder filas con updated_at justo
  // en el límite del cursor. Reprocesar unas pocas es inocuo (el merge es idempotente).
  const since = lastSync ? new Date(Date.parse(lastSync) - 3000).toISOString() : null;
  const url = since
    ? `/api/events/${slug}/scan-cache?since=${encodeURIComponent(since)}`
    : `/api/events/${slug}/scan-cache`;
  const res = await fetch(resolveUrl(url), { headers: deviceHeaders() });
  if (!res.ok) throw new Error("scan_cache_fetch_failed");
  const body = (await res.json()) as { data?: ScanCacheResponse };
  if (!body.data) throw new Error("scan_cache_fetch_failed");
  const json = body.data;
  const tx = d.transaction([STORE, META], "readwrite");
  const store = tx.objectStore(STORE);
  if (json.full) await store.clear(); // snapshot: reemplaza todo
  for (const t of json.tickets) {
    // active/used → upsert; void/refunded → fuera del cache (delta los trae).
    if (t.status === "active" || t.status === "used") await store.put(t);
    else await store.delete(t.ticketId);
  }
  await tx.objectStore(META).put(json.fetchedAt, "lastSync");
  await tx.objectStore(META).put(json.eventId, "eventId");
  await tx.objectStore(META).put(
    json.zonePolicy ?? { enforce: false, allowedTicketTypeIds: [] },
    "zonePolicy",
  );
  await tx.done;
  // Refrescamos la pública del evento junto con el cache (best-effort).
  try {
    await cacheEventSigningKey(slug);
  } catch {
    // sin red o evento sin clave aún: best-effort, no bloquea el cache
  }
  return json.tickets.length;
  } finally {
    syncing = false;
  }
}

export async function getZonePolicy(): Promise<ZoneScanPolicy | null> {
  const d = await db();
  return (await d.get(META, "zonePolicy")) ?? null;
}

/** Valida tipo de entrada contra la puerta activa cacheada (offline). */
export function isTicketAllowedInZone(
  ticketTypeId: string | undefined,
  policy: ZoneScanPolicy | null,
): boolean {
  if (!policy?.enforce) return true;
  if (!ticketTypeId) return false;
  return policy.allowedTicketTypeIds.includes(ticketTypeId);
}

export async function lookupTicketById(
  ticketId: string,
): Promise<CachedTicket | null> {
  const d = await db();
  return (await d.get(STORE, ticketId)) ?? null;
}

export async function markUsedLocalById(ticketId: string): Promise<void> {
  const d = await db();
  const t = await d.get(STORE, ticketId);
  if (t) await d.put(STORE, { ...t, status: "used" });
}

/**
 * Aforo del box al que pertenece `ticketId`, calculado offline desde el cache.
 * `filled` = cuántos del box ya entraron (status used); `capacity` = asientos.
 * null si el ticket no es de box o falta capacidad. Llamar DESPUÉS de marcar
 * usado el ticket actual para que el conteo lo incluya.
 */
export async function getBoxFill(
  ticketId: string,
): Promise<{ filled: number; capacity: number } | null> {
  const d = await db();
  const self = await d.get(STORE, ticketId) as CachedTicket | undefined;
  if (!self?.boxLabel) return null;
  const hostId = self.boxHostTicketId ?? ticketId;
  const all: CachedTicket[] = await d.getAll(STORE);
  const group = all.filter(
    (t) => t.ticketId === hostId || t.boxHostTicketId === hostId,
  );
  const filled = group.filter((t) => t.status === "used").length;
  const capacity =
    self.boxCapacity ??
    group.find((t) => t.ticketId === hostId)?.boxCapacity ??
    null;
  return capacity != null ? { filled, capacity } : null;
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
