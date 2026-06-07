import { openDB, type IDBPDatabase } from "idb";

// Almacén de claves de ticket en el device del comprador.
//
// La privada ECDSA P-256 se genera NO-EXTRAÍBLE (extractable=false): vive como
// CryptoKey en IndexedDB y nunca puede exportarse. Así, compartir el ticket solo
// puede hacerse por screenshots caducables (≤30s), no entregando la clave.
// La pública (siempre exportable) se registra en el server, que devuelve un cert
// firmado por el evento. El cert se cachea aquí para generar QRs 100% offline.

const DB_NAME = "pasape-tickets";
const STORE = "keys";
const VERSION = 1;

type KeyRecord = {
  ticketId: string;
  priv: CryptoKey; // no-extraíble; structured-clone lo persiste en IDB
  pubJwk: JsonWebKey;
  cert: string | null;
  certFetchedAt: number | null;
};

async function db(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(STORE)) {
        database.createObjectStore(STORE, { keyPath: "ticketId" });
      }
    },
  });
}

/**
 * Devuelve la clave del ticket en este device, generándola la 1ª vez. La privada
 * es no-extraíble; solo se expone para firmar (crypto.subtle.sign).
 */
export async function getOrCreateTicketKey(
  ticketId: string,
): Promise<{ priv: CryptoKey; pubJwk: JsonWebKey }> {
  const conn = await db();
  const existing = (await conn.get(STORE, ticketId)) as KeyRecord | undefined;
  if (existing) {
    return { priv: existing.priv, pubJwk: existing.pubJwk };
  }
  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    false, // privada NO-extraíble
    ["sign", "verify"],
  );
  const pubJwk = (await crypto.subtle.exportKey(
    "jwk",
    pair.publicKey,
  )) as JsonWebKey;
  const record: KeyRecord = {
    ticketId,
    priv: pair.privateKey,
    pubJwk,
    cert: null,
    certFetchedAt: null,
  };
  await conn.put(STORE, record);
  return { priv: pair.privateKey, pubJwk };
}

export async function saveCert(ticketId: string, cert: string): Promise<void> {
  const conn = await db();
  const rec = (await conn.get(STORE, ticketId)) as KeyRecord | undefined;
  if (!rec) return;
  rec.cert = cert;
  rec.certFetchedAt = Date.now();
  await conn.put(STORE, rec);
}

export async function getCachedCert(
  ticketId: string,
): Promise<{ cert: string; fetchedAt: number } | null> {
  const conn = await db();
  const rec = (await conn.get(STORE, ticketId)) as KeyRecord | undefined;
  if (!rec || !rec.cert) return null;
  return { cert: rec.cert, fetchedAt: rec.certFetchedAt ?? 0 };
}
