"use client";

// Señales anti-bot que el cliente emite al backend en el checkout, como headers
// (no toca los bodies ni los schemas). Dos señales:
//
//   x-device-hash    Fingerprint PROPIO (sin librerías de terceros): hash de
//                    características estables del navegador. Sirve para
//                    correlacionar "muchas identidades desde el mismo device" =
//                    granja de scalper. No es identificatorio ni PII.
//   x-checkout-token Token firmado por el server, pedido AL MONTAR la página. El
//                    server mide con él ms_since_mount (velocidad del checkout).
//
// IMPORTANTE: el token se PIDE al montar (primeCheckoutToken) y se REUSA en
// quote/buy (getCheckoutToken). Si se pidiera al comprar, su issuedAt sería
// "ahora" y la velocidad daría ~0 ms para TODOS — marcaría humanos como bots.

import { api } from "@/lib/_shared/api-client";

// ── Device hash (determinista, sin terceros) ────────────────────────────────
let cachedDeviceHash: string | null = null;

// FNV-1a 32-bit → hex. No es hash criptográfico: solo una clave de bucketing
// estable para correlacionar. No necesita SubtleCrypto (evita async en el path).
const fnv1a = (s: string): string => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
};

export const getDeviceHash = (): string | null => {
  if (typeof window === "undefined") return null;
  if (cachedDeviceHash) return cachedDeviceHash;
  const n = window.navigator;
  const parts = [
    n.userAgent,
    n.language,
    (n.languages ?? []).join(","),
    String(n.hardwareConcurrency ?? ""),
    // @ts-expect-error deviceMemory no está en todos los lib.dom
    String(n.deviceMemory ?? ""),
    n.platform ?? "",
    `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`,
    String(new Date().getTimezoneOffset()),
    Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
  ];
  cachedDeviceHash = fnv1a(parts.join("|"));
  return cachedDeviceHash;
};

// ── Checkout token con proof-of-work (pedido al montar, reusado en quote/buy) ─
// Flujo: GET challenge → resolver PoW (invisible, en background al montar) → POST
// canjear → token atado al device. Cache por eventId de la promesa: se hace UNA
// vez y quote/buy esperan el mismo token. Si algo falla, el header se omite (el
// server lo trata como "sin token" y lo puntúa — un humano con red mala suma poco
// y no se bloquea, por diseño del scorer).
const tokenByEvent = new Map<string, Promise<string | null>>();

export type Challenge = {
  eventId: string;
  deviceHash: string;
  salt: string;
  target: string;
  maxnumber: number;
  issuedAt: number;
  signature: string;
};

const sha256hex = async (s: string): Promise<string> => {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

// Resuelve el PoW estilo ALTCHA: busca el número i en [0, maxnumber] tal que
// SHA256(salt+i) === target. Coste acotado (~maxnumber/2 hashes). Invisible para
// una compra; se multiplica por N si un bot quiere N tokens.
export const solvePow = async (c: Challenge): Promise<number | null> => {
  for (let i = 0; i <= c.maxnumber; i++) {
    if ((await sha256hex(c.salt + i)) === c.target) return i;
  }
  return null;
};

const fetchToken = async (eventId: string): Promise<string | null> => {
  try {
    if (typeof crypto === "undefined" || !crypto.subtle) return null; // sin WebCrypto (contexto no seguro)
    const dh = getDeviceHash() ?? "";
    const headers = dh ? { "x-device-hash": dh } : undefined;
    const { challenge } = await api.get<{ challenge: Challenge }>(
      `/api/tickets/checkout-token?eventId=${encodeURIComponent(eventId)}`,
      headers ? { headers } : undefined,
    );
    const number = await solvePow(challenge);
    if (number == null) return null;
    const { token } = await api.post<{ token: string }>(
      "/api/tickets/checkout-token",
      { ...challenge, number },
      headers ? { headers } : undefined,
    );
    return token ?? null;
  } catch {
    return null;
  }
};

/** Llamar AL MONTAR la página de compra (idempotente por eventId). */
export const primeCheckoutToken = (eventId: string): void => {
  if (!eventId || tokenByEvent.has(eventId)) return;
  tokenByEvent.set(eventId, fetchToken(eventId));
};

const getCheckoutToken = async (eventId: string): Promise<string | null> => {
  if (!eventId) return null;
  if (!tokenByEvent.has(eventId)) primeCheckoutToken(eventId);
  return (await tokenByEvent.get(eventId)) ?? null;
};

/**
 * Renovar el token tras cada intento de compra: el server lo QUEMA al usarlo
 * (single-use). Sin esto, el reintento legítimo de un humano (p.ej. tras un
 * pago fallido) reusaría un token consumido y se puntuaría como replay.
 */
export const refreshCheckoutToken = (eventId: string): void => {
  if (!eventId) return;
  tokenByEvent.delete(eventId);
  primeCheckoutToken(eventId);
};

// ── Detección de automatización de navegador ────────────────────────────────
// Banderas que delatan un navegador manejado por Playwright/Puppeteer/Selenium o
// un agente vía CDP. NINGUNA se dispara en un humano real con un Chrome normal.
// Un atacante puede parchear algunas (puppeteer-stealth), pero cada parche sube
// su costo y las inconsistencias (UA Chrome sin window.chrome, renderer por
// software) son difíciles de falsear de forma coherente. Es señal, no muro.
const detectAutomation = (): string[] => {
  if (typeof window === "undefined") return [];
  const hints: string[] = [];
  const n = window.navigator;
  try {
    if (n.webdriver === true) hints.push("webdriver");
    if (/headless/i.test(n.userAgent)) hints.push("headless_ua");
    // UA dice Chrome pero no existe el objeto window.chrome → headless/no-Chrome.
    const isChrome = /chrome|crios/i.test(n.userAgent) && !/edg|opr/i.test(n.userAgent);
    if (isChrome && !(window as { chrome?: unknown }).chrome) hints.push("no_chrome_object");
    // Desktop Chrome real trae plugins; headless suele traer 0.
    if (isChrome && !/mobile/i.test(n.userAgent) && n.plugins && n.plugins.length === 0) {
      hints.push("no_plugins");
    }
    if (!n.languages || n.languages.length === 0) hints.push("no_languages");
    // WebGL: un renderer por software (SwiftShader/llvmpipe/Mesa) sin GPU real es
    // típico de un navegador headless en un servidor.
    const gl = document.createElement("canvas").getContext("webgl") as WebGLRenderingContext | null;
    if (gl) {
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      const renderer = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? "") : "";
      if (/swiftshader|llvmpipe|software|mesa offscreen/i.test(renderer)) {
        hints.push("software_renderer");
      }
    }
  } catch {
    // Un navegador que tira excepción al sondear estas props es en sí anómalo,
    // pero no lo penalizamos: preferimos no arriesgar un falso positivo.
  }
  return hints;
};

/** Headers de señales para adjuntar a las llamadas de quote/buy. */
export const checkoutSignalHeaders = async (
  eventId: string,
): Promise<Record<string, string>> => {
  const headers: Record<string, string> = {};
  const dh = getDeviceHash();
  if (dh) headers["x-device-hash"] = dh;
  const token = await getCheckoutToken(eventId);
  if (token) headers["x-checkout-token"] = token;
  const auto = detectAutomation();
  if (auto.length) headers["x-cx-signals"] = auto.join(",");
  return headers;
};
