import "server-only";
import type { NextRequest } from "next/server";
import { ipOf } from "@/server/_shared/rateLimit";
import { serverEvents } from "@/lib/analytics/serverEvents";
import { signalHash } from "../domain/signalHash";
import { verifyCheckoutToken } from "../domain/CheckoutToken";
import { botScore, type PurchasePhase } from "../domain/botScore";
import {
  decideEnforcement,
  enforcementMode,
  type SignalAction,
} from "../domain/botEnforcement";
import { purchaseSignalsRepo } from "../infrastructure/PurchaseSignalsRepo";
import {
  consumeCheckoutToken,
  peekCheckoutToken,
  consumeChallenge,
} from "../infrastructure/checkoutNonce";
import { armTarpit } from "../infrastructure/tarpitStore";
import {
  makeChallenge,
  verifyChallengeSolution,
  stepUpDifficulty,
  type Challenge,
  type SolutionInput,
} from "../domain/CheckoutChallenge";

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
  // "crios" (Chrome-iOS) queda EXCLUIDO a propósito: por mandato de Apple corre
  // sobre WebKit, no sobre Blink/Chromium, y por eso NUNCA manda Client Hints —
  // penalizarlo sería un falso positivo sistemático contra todo usuario real de
  // Chrome en iPhone.
  const isChromium = /chrome|chromium|edg\//i.test(ua) && !/crios/i.test(ua);
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
  /**
   * true = el intento debe resolver un step-up challenge para proceder y aún no
   * adjuntó una solución válida. El route responde 428 con `challenge`. Nunca en
   * modo shadow (ahí solo se registra `would_challenge`).
   */
  challengeRequired: boolean;
  /** Challenge firmado a devolver en el 428 (solo cuando challengeRequired). */
  challenge: Challenge | null;
};

const ALLOW_ON_ERROR: CheckoutGuardResult = {
  allowed: true,
  action: "logged",
  score: 0,
  reasons: [],
  delayMs: 0,
  signalId: null,
  challengeRequired: false,
  challenge: null,
};

// Parsea la solución del step-up challenge que el cliente adjunta al reintentar
// tras un 428 (header x-cx-stepup = JSON del challenge + number). Acotado y
// defensivo: cualquier cosa rara → null (se trata como "sin solución").
const parseStepUp = (req: NextRequest): SolutionInput | null => {
  const raw = req.headers.get("x-cx-stepup");
  if (!raw || raw.length > 2048) return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (
      typeof o.eventId === "string" &&
      typeof o.deviceHash === "string" &&
      typeof o.salt === "string" &&
      typeof o.target === "string" &&
      typeof o.maxnumber === "number" &&
      typeof o.issuedAt === "number" &&
      typeof o.signature === "string" &&
      typeof o.number === "number"
    ) {
      return o as unknown as SolutionInput;
    }
  } catch {
    /* JSON inválido → sin solución */
  }
  return null;
};

export const assessCheckout = async (
  input: CheckoutGuardInput,
): Promise<CheckoutGuardResult> => {
  try {
    const { req, phase, eventId } = input;
    const ip = ipOf(req);
    const userAgent = req.headers.get("user-agent");
    const deviceHash = deviceHashOf(req);
    const contactHash = signalHash("contact", input.contact);
    const dniHash = signalHash("dni", input.dni);

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
      return {
        allowed: true,
        action: "logged",
        score: 0,
        reasons: [],
        delayMs: 0,
        signalId,
        challengeRequired: false,
        challenge: null,
      };
    }

    // ── Step-up challenge: ¿el cliente adjuntó una solución válida? ───────────
    // Si el intento anterior fue "challenge_required" (428), el cliente resuelve
    // el PoW y reintenta con la solución en x-cx-stepup. Verificamos firma +
    // frescura + que reproduce el target, que va atada a ESTE evento/device, y
    // consumimos su nonce single-use (un challenge resuelto no se canjea 2 veces).
    const stepUp = phase === "buy" ? parseStepUp(req) : null;
    let stepUpSatisfied = false;
    if (
      stepUp &&
      eventId &&
      stepUp.eventId === eventId &&
      stepUp.deviceHash === (deviceHash ?? "") &&
      verifyChallengeSolution(stepUp)
    ) {
      // "replay" ⇒ ya se canjeó ese challenge; "unknown" (sin Redis) ⇒ fail-open.
      stepUpSatisfied = (await consumeChallenge(stepUp.salt)) !== "replay";
    }

    // Single-use (P0 anti-automatización): un render de página = una orden. NO se
    // quema aquí — solo se INSPECCIONA (peek, no destructivo) para el score. El
    // token se quema únicamente al confirmar la compra (más abajo), de modo que
    // el reintento del step-up con el mismo token no cuente como replay (el 428
    // previo no lo quemó). Quote nunca consume.
    //
    // El peek (Redis) y los agregados (Supabase) son independientes entre sí —
    // van en paralelo para no sumar sus latencias.
    const rawToken = req.headers.get("x-checkout-token");
    const [tokenReplay, agg] = await Promise.all([
      phase === "buy" && checkoutTokenOk && !!rawToken
        ? peekCheckoutToken(rawToken).then((r) => r === "replay")
        : Promise.resolve(false),
      purchaseSignalsRepo.aggregates({ deviceHash, ip, contactHash, dniHash }),
    ]);

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

    const decision = decideEnforcement(score);

    // Si el enforcement pide un step-up pero el cliente ya resolvió un challenge
    // válido para este intento, dejamos pasar (no re-desafiamos). El challenge ya
    // consumido es el peaje pagado. `action` refleja que hubo challenge resuelto.
    const challengeRequired = decision.challengeRequired && !stepUpSatisfied;
    const proceeding = decision.allowed && !challengeRequired;
    const action: SignalAction =
      decision.challengeRequired && stepUpSatisfied ? "challenge" : decision.action;

    // Confirmación single-use: SOLO cuando la compra realmente procede se quema el
    // checkout-token (una compra = un token). Al responder challenge_required NO se
    // quema, así el reintento con solución no se cuenta como replay.
    if (proceeding && phase === "buy" && checkoutTokenOk && rawToken) {
      void consumeCheckoutToken(rawToken);
    }

    // Mint del challenge a devolver en el 428 (dificultad escalada por el score).
    const challenge =
      challengeRequired && eventId
        ? makeChallenge(eventId, deviceHash ?? "", stepUpDifficulty(score))
        : null;

    // Tarpit DIFERIDO (capa de respaldo, hoy inerte): decideEnforcement ya no
    // emite delayMs>0 en el camino normal — la zona sospechosa la cubre el
    // step-up challenge (PoW), que es estrictamente mejor aquí: no mantiene la
    // función serverless viva, cuesta CPU real al cliente, y escala con el score.
    // Se conserva este armado (Redis + proxy, ver tarpitStore.ts / src/proxy.ts)
    // por si una futura política de enforcement reintroduce un delay puro.
    if (decision.delayMs > 0) {
      void armTarpit(deviceHash, ip === "unknown" ? null : ip, decision.delayMs);
    }

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
        actionTaken: action,
      }),
      Promise.resolve(
        serverEvents.botSignal(input.buyerId ?? deviceHash ?? ip ?? "anonymous", {
          phase,
          bot_score: score,
          reasons,
          action,
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
      action,
      delayMs: decision.delayMs,
      score,
      reasons,
      signalId,
      challengeRequired,
      challenge,
    };
  } catch (e) {
    console.warn("[antibot] assessCheckout falló (fail-open, se permite la compra):", e);
    return ALLOW_ON_ERROR;
  }
};
