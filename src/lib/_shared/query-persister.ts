"use client";

import { openDB, type IDBPDatabase } from "idb";
import type { Persister, PersistedClient } from "@tanstack/react-query-persist-client";

// Persister de React Query sobre IndexedDB. Guarda el snapshot del cache para
// que la wallet (usuario + entradas) esté disponible offline y sin parpadeo en
// recargas. Solo persistimos las queries privadas (ver shouldDehydrateQuery en
// el provider). IndexedDB > localStorage: más capacidad y no bloquea el hilo.

const DB_NAME = "pasape-rq";
const STORE = "cache";
const KEY = "client";

let dbPromise: Promise<IDBPDatabase> | null = null;
const getDb = () => {
  if (typeof indexedDB === "undefined") return null;
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      },
    });
  }
  return dbPromise;
};

// Standalone (no depende de la instancia de persister del provider): usado en
// logout para borrar el snapshot guardado y que un siguiente login en el mismo
// device/navegador no arranque mostrando datos de la cuenta anterior.
export const clearPersistedQueryCache = async () => {
  const db = await getDb();
  if (!db) return;
  await db.delete(STORE, KEY);
};

export const createIdbPersister = (): Persister => ({
  async persistClient(client: PersistedClient) {
    const db = await getDb();
    if (!db) return;
    await db.put(STORE, client, KEY);
  },
  async restoreClient() {
    const db = await getDb();
    if (!db) return undefined;
    return (await db.get(STORE, KEY)) as PersistedClient | undefined;
  },
  async removeClient() {
    const db = await getDb();
    if (!db) return;
    await db.delete(STORE, KEY);
  },
});
