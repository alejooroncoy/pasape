/** Llave firmada de orden (HMAC) — solo sessionStorage, nunca email en URL. */

const key = (orderId: string) => `pasape:order:k:${orderId}`;

export const persistOrderToken = (orderId: string, token: string): void => {
  try {
    sessionStorage.setItem(key(orderId), token);
  } catch {
    // sessionStorage no disponible
  }
};

export const readOrderToken = (orderId: string): string | null => {
  try {
    return sessionStorage.getItem(key(orderId));
  } catch {
    return null;
  }
};

export const clearOrderToken = (orderId: string): void => {
  try {
    sessionStorage.removeItem(key(orderId));
  } catch {}
};

export const processingQuery = (
  orderId: string,
  orderToken: string | null,
  extra?: { total?: number; method?: string; n?: number },
): string => {
  const p = new URLSearchParams({ order: orderId });
  if (orderToken) p.set("k", orderToken);
  if (extra?.total === 0) p.set("total", "0");
  if (extra?.method) p.set("method", extra.method);
  if (extra?.n != null) p.set("n", String(extra.n));
  return p.toString();
};
