import "server-only";
import { createHmac } from "crypto";
import type { NextRequest } from "next/server";
import { ipOf } from "@/server/_shared/rateLimit";
import { serverEvents } from "@/lib/analytics/serverEvents";
import { verifyCheckoutToken } from "../domain/CheckoutToken";
import { botScore, type PurchasePhase } from "../domain/botScore";
import {
  decideEnforcement,
  enforcementMode,
  type SignalAction,
} from "../domain/botEnforcement";
import { purchaseSignalsRepo } from "../infrastructure/PurchaseSignalsRepo";
import { consumeCheckoutToken } from "../infrastructure/checkoutNonce";

// Orquestador anti-bot del checkout (capa de aplicación). Lo llaman los route
// handlers en cada fase (quote/buy/card/webhook). Hace, en orden:
//   1. Extrae señales del request (ip, ua, device_hash, checkout-token).
//   2. Agrega volumen/correlación desde purchase_signals.
//   3. Puntúa con el scorer de dominio (puro).
//   4. Decide la acción según BOT_ENFORCEMENT + circuit breaker.
//   5. Registra la fila de señal + emite bot_signal a PostHog.
//
// NUNCA lanza: si algo falla, permite la compra (fail-open). Anti-bots no debe
// poder tumbar ventas.

// El email/teléfono se guarda como HMAC (no PII cruda) — solo sirve para
// correlacionar "mismo contacto/patrón". Reusa el secret con prefijo propio.
const hmacHash = (domain: string, value: string | null | undefined): string | null => {
  const v = value?.trim().toLowerCase();
  if (!v) return null;
  const secret = process.env.TICKET_LINK_SECRET;
  if (!secret) return null;
  return createHmac("sha256", secret).update(`${domain}:${v}`).digest("hex").slice(0, 32);
};

const deviceHashOf = (req: NextRequest): string | null => {
  const h = req.headers.get("x-device-hash")?.trim();
  return h && h.length >= 6 && h.length <= 64 ? h : null;
};

// Banderas de automatización que el cliente reporta (x-cx-signals). Se acotan a
// una allowlist para que el header no pueda inyectar razones arbitrarias.
const KNOWN_AUTOMATION_HINTS = new Set([
  "webdriver",
  "headless_ua",
  "software_renderer",
  "no_chrome_object",
  "no_plugins",
  "no_languages",
]);

const automationHintsOf = (req: NextRequest): string[] => {
  const raw = req.headers.get("x-cx-signals");
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => KNOWN_AUTOMATION_HINTS.has(s))
    .slice(0, 8);
};

// Señales de coherencia derivadas de headers que el JS del cliente NO controla
// (a diferencia de x-device-hash / x-cx-signals, que un bot puede falsear). Un
// cliente HTTP directo (curl/requests/axios) que finge un UA de Chrome delata
// aquí lo que el navegador manda automáticamente y él olvidó.
const serverHintsOf = (req: NextRequest): string[] => {
  const hints: string[] = [];
  const ua = req.headers.get("user-agent") ?? "";
  const isChromium = /chrome|chromium|crios|edg\//i.test(ua);
  // Todo Chromium moderno manda sec-ch-ua por HTTPS. UA Chromium sin él = el
  // "navegador" no es Chromium (cliente HTTP falseando el UA).
  if (isChromium && !req.headers.get("sec-ch-ua")) hints.push("chromium_no_client_hints");
  if (!req.headers.get("accept-language")) hints.push("no_accept_language");
  return hints;
};

export type CheckoutGuardInput = {
  req: NextRequest;
  phase: PurchasePhase;
  eventId: string | null;
  ticketTypeIds?: string[] | null;
  qty?: number | null;
  stockRemaining?: number | null;
  contact?: string | null; // email o teléfono crudo (se hashea aquí)
  dni?: string | null; // DNI crudo (se hashea aquí; anti-multicuentas)
  buyerId?: string | null;
  orderId?: string | null;
  // false = solo registrar la señal cruda (device/ip/token/velocidad) SIN correr
  // agregados ni scoring. Se usa en quote (read-only, no se bloquea): registrar
  // es barato y esas filas igual alimentan los agregados de buy; puntuar en cada
  // quote sería trabajo desperdiciado. Default true (buy/card puntúan y deciden).
  assess?: boolean;
};

export type CheckoutGuardResult = {
  allowed: boolean;
  action: SignalAction;
  score: number;
  reasons: string[];
  /** ms de tarpit a aplicar antes de proceder (0 si no corresponde). */
  delayMs: number;
  /** id de la fila de señal, para adjuntarle el order_id tras crear la orden. */
  signalId: string | null;
};

const ALLOW_ON_ERROR: CheckoutGuardResult = {
  allowed: true,
  action: "logged",
  score: 0,
  reasons: [],
  delayMs: 0,
  signalId: null,
};

export const assessCheckout = async (
  input: CheckoutGuardInput,
): Promise<CheckoutGuardResult> => {
  try {
    const { req, phase, eventId } = input;
    const ip = ipOf(req);
    const userAgent = req.headers.get("user-agent");
    const deviceHash = deviceHashOf(req);
    const contactHash = hmacHash("contact", input.contact);
    const dniHash = hmacHash("dni", input.dni);

    // Coherencia de sesión + velocidad (medida por el server vía el token). El
    // token está atado al deviceHash: si el device actual no coincide con el que
    // lo minteó, no verifica (token robado/compartido entre identidades).
    const tokenCheck = eventId
      ? verifyCheckoutToken(eventId, deviceHash ?? "", req.headers.get("x-checkout-token"))
      : ({ ok: false } as const);
    const checkoutTokenOk = tokenCheck.ok;
    const msSinceMount = tokenCheck.ok ? tokenCheck.ageMs : null;

    const mode = enforcementMode();

    // Fast path (quote): registrar la señal cruda sin agregados ni scoring.
    if (input.assess === false) {
      const signalId = await purchaseSignalsRepo.record({
        phase,
        eventId,
        ticketTypeIds: input.ticketTypeIds ?? null,
        orderId: input.orderId ?? null,
        qty: input.qty ?? null,
        ip,
        userAgent,
        deviceHash,
        buyerId: input.buyerId ?? null,
        contactHash,
        dniHash,
        checkoutTokenOk,
        msSinceMount,
        botScore: 0,
        reasons: [],
        enforcementMode: mode,
        actionTaken: "logged",
      });
      return { allowed: true, action: "logged", score: 0, reasons: [], delayMs: 0, signalId };
    }

    // Single-use (P0 anti-automatización): en la fase de compra el token se
    // QUEMA — un render de página = una orden. Reusarlo delata scripting. Quote
    // no consume (se llama varias veces con el mismo token legítimamente).
    const rawToken = req.headers.get("x-checkout-token");
    const tokenReplay =
      phase === "buy" && checkoutTokenOk && !!rawToken
        ? (await consumeCheckoutToken(rawToken)) === "replay"
        : false;

    const agg = await purchaseSignalsRepo.aggregates({ deviceHash, ip, contactHash, dniHash });

    const { score, reasons } = botScore({
      phase,
      checkoutTokenOk,
      msSinceMount,
      tokenReplay,
      // Flujo saltado: buy sin ningún quote previo del device (y con device
      // conocido — sin device no podemos afirmar que se saltó el flujo).
      buyWithoutQuote: phase === "buy" && !!deviceHash && agg.deviceQuotesShort === 0,
      automationHints: automationHintsOf(req),
      serverHints: serverHintsOf(req),
      qty: input.qty ?? 1,
      stockRemaining: input.stockRemaining ?? null,
      ...agg,
    });

    const decision = decideEnforcement(score, agg.deviceAttemptsShort);

    // Registrar (no bloqueante) + telemetría, en paralelo.
    const [signalId] = await Promise.all([
      purchaseSignalsRepo.record({
        phase,
        eventId,
        ticketTypeIds: input.ticketTypeIds ?? null,
        orderId: input.orderId ?? null,
        qty: input.qty ?? null,
        ip,
        userAgent,
        deviceHash,
        buyerId: input.buyerId ?? null,
        contactHash,
        dniHash,
        checkoutTokenOk,
        msSinceMount,
        botScore: score,
        reasons,
        enforcementMode: mode,
        actionTaken: decision.action,
      }),
      Promise.resolve(
        serverEvents.botSignal(input.buyerId ?? deviceHash ?? ip ?? "anonymous", {
          phase,
          bot_score: score,
          reasons,
          action: decision.action,
          enforcement_mode: mode,
          event_id: eventId,
          order_id: input.orderId ?? null,
          checkout_token_ok: checkoutTokenOk,
          ms_since_mount: msSinceMount,
        }),
      ),
    ]);

    return {
      allowed: decision.allowed,
      action: decision.action,
      delayMs: decision.delayMs,
      score,
      reasons,
      signalId,
    };
  } catch (e) {
    console.warn("[antibot] assessCheckout falló (fail-open, se permite la compra):", e);
    return ALLOW_ON_ERROR;
  }
};
