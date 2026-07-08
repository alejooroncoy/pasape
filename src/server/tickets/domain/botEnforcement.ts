// Política de enforcement anti-bot: decide qué HACER con un score, y protege las
// ventas con un circuit breaker fail-open.
//
// Modos (env BOT_ENFORCEMENT, default 'shadow'):
//   shadow → NUNCA bloquea ni ralentiza. Solo registra qué habría hecho
//            ('would_block' / 'would_throttle'). Es el modo de calibración.
//   soft   → NUNCA bloquea; TARPIT progresivo desde SOFT_THRESHOLD (latencia
//            creciente al sospechoso). Cero ventas perdidas, cero falso positivo
//            duro: al humano (score < SOFT) no lo toca; al bot lo vuelve lento.
//            Esta es la defensa clave para compra masiva guest (sin login previo).
//   hard   → BLOQUEA lo flagrante (score >= HARD_THRESHOLD) y aplica tarpit a la
//            zona sospechosa (SOFT..HARD). Agresivo.
//
// Por qué el tarpit es la mejor arma contra el bot sin-login: no hay identidad
// previa que verificar, así que en vez de un muro (que arriesga falsos positivos)
// se destruye la ECONOMÍA del ataque. Un bot que necesita 500 compras/min y ahora
// tarda 8 s por intento deja de ser rentable, sin que un humano note nada.
//
// CIRCUIT BREAKER (por qué un bug no puede tumbar tus ventas): si en la ventana
// reciente la fracción de intentos bloqueados supera CIRCUIT_MAX_BLOCK_RATE, el
// breaker se abre y el sistema deja de bloquear (fail-open) hasta que la ventana
// se limpie. Un umbral mal calibrado o un pico legítimo de tráfico degradan a
// "solo observar" en vez de rechazar compras masivamente. Mismo espíritu
// fail-open que rateLimit.ts.
//
// Nota serverless: el estado del breaker es por-instancia (in-memory). Es una
// red de seguridad, no un contador exacto — suficiente para cortar un incidente.

import { SOFT_THRESHOLD, HARD_THRESHOLD } from "./botScore";

export type EnforcementMode = "shadow" | "soft" | "hard";

export const enforcementMode = (): EnforcementMode => {
  const m = process.env.BOT_ENFORCEMENT?.toLowerCase();
  return m === "soft" || m === "hard" ? m : "shadow";
};

export type SignalAction = "logged" | "would_block" | "would_throttle" | "throttled" | "blocked";

// ── Tarpit (latencia progresiva al sospechoso) ──────────────────────────────
const TARPIT_MIN_MS = 600;
const TARPIT_MAX_MS = 8_000; // techo: no agotar la función serverless ni permitir auto-DoS
const clampMs = (n: number): number => Math.max(TARPIT_MIN_MS, Math.min(TARPIT_MAX_MS, Math.round(n)));

/**
 * Latencia a inyectar para un intento en zona de throttle. Crece con (a) qué
 * tan arriba de SOFT está el score y (b) la reincidencia del device en la
 * ventana corta. PURA y determinista (testeable). Solo se llama cuando ya se
 * decidió throttlear; el techo evita convertir el tarpit en un vector de DoS.
 */
export const tarpitDelayMs = (score: number, deviceAttemptsShort: number): number => {
  const span = 100 - SOFT_THRESHOLD;
  const bySeverity = ((Math.max(SOFT_THRESHOLD, score) - SOFT_THRESHOLD) / span) * (TARPIT_MAX_MS - TARPIT_MIN_MS);
  const byRepeat = Math.min(deviceAttemptsShort, 12) * 350;
  return clampMs(TARPIT_MIN_MS + bySeverity + byRepeat);
};

// ── Circuit breaker (ventana deslizante simple in-memory) ───────────────────
const CIRCUIT_WINDOW_MS = 60_000;
const CIRCUIT_MIN_SAMPLES = 20; // no abrir por 1-2 casos: exige volumen
const CIRCUIT_MAX_BLOCK_RATE = 0.15; // si >15% del tráfico se bloquea, algo huele mal

type Sample = { at: number; blocked: boolean };
let samples: Sample[] = [];
let breakerOpenLoggedAt = 0;

const prune = (now: number) => {
  const cutoff = now - CIRCUIT_WINDOW_MS;
  if (samples.length && samples[0]!.at < cutoff) {
    samples = samples.filter((s) => s.at >= cutoff);
  }
};

/** true si el breaker está abierto → NO se debe bloquear (fail-open). */
export const breakerOpen = (): boolean => {
  const now = Date.now();
  prune(now);
  if (samples.length < CIRCUIT_MIN_SAMPLES) return false;
  const blocked = samples.reduce((n, s) => n + (s.blocked ? 1 : 0), 0);
  const rate = blocked / samples.length;
  const open = rate > CIRCUIT_MAX_BLOCK_RATE;
  if (open && now - breakerOpenLoggedAt > CIRCUIT_WINDOW_MS) {
    breakerOpenLoggedAt = now;
    console.warn(
      `[antibot] circuit breaker ABIERTO: ${(rate * 100).toFixed(0)}% de ${samples.length} intentos bloqueados en 60s — fail-open activo (no se bloquea). Revisar calibración/tráfico.`,
    );
  }
  return open;
};

const recordSample = (blocked: boolean) => {
  const now = Date.now();
  samples.push({ at: now, blocked });
  prune(now);
};

export type EnforcementDecision = { allowed: boolean; action: SignalAction; delayMs: number };

/**
 * Decide la acción a partir del score y el modo vigente, respetando el circuit
 * breaker. `deviceAttemptsShort` escala el tarpit por reincidencia. Registra la
 * muestra del breaker. `allowed=false` (bloqueo) solo ocurre en modo 'hard',
 * sobre HARD_THRESHOLD y con el breaker cerrado; en 'soft' nunca se bloquea.
 */
export const decideEnforcement = (
  score: number,
  deviceAttemptsShort = 0,
): EnforcementDecision => {
  const mode = enforcementMode();
  const wouldBlock = score >= HARD_THRESHOLD;
  const wouldThrottle = score >= SOFT_THRESHOLD;

  if (mode === "shadow") {
    recordSample(false); // en shadow nunca bloqueamos, no contamina el breaker
    return {
      allowed: true,
      delayMs: 0,
      action: wouldBlock ? "would_block" : wouldThrottle ? "would_throttle" : "logged",
    };
  }

  // Bloqueo duro: solo en modo 'hard', para lo flagrante, con el breaker cerrado.
  const shouldBlock = mode === "hard" && wouldBlock && !breakerOpen();
  recordSample(shouldBlock);
  if (shouldBlock) return { allowed: false, action: "blocked", delayMs: 0 };

  // Zona sospechosa (>= SOFT y no bloqueada): tarpit. Permite, pero lento.
  if (wouldThrottle) {
    return { allowed: true, action: "throttled", delayMs: tarpitDelayMs(score, deviceAttemptsShort) };
  }
  return { allowed: true, action: "logged", delayMs: 0 };
};

// ── Anti-multicuenta por tarjeta (misma tarjeta, muchos DNIs) ────────────────
//
// El falso positivo a evitar es UNA FAMILIA. Un papá que paga las entradas de
// sus hijos usa 1 tarjeta con varios DNIs, desde 1 (a lo sumo 2) dispositivos,
// en una sola sesión. Un anillo de reventa, en cambio, rota device/IP/correo/DNI
// pero comparte pocas tarjetas reales: la MISMA tarjeta aparece desde MUCHOS
// dispositivos distintos. Ese contraste (pocos devices = familia, muchos = anillo)
// es lo que usamos para no castigar jamás a la familia.
//
// Por eso el bloqueo por tarjeta es escalonado y CORROBORADO:
//   - hard  → bloquea por conteo de DNIs solo, con un umbral ALTO (6). Aun así,
//             una familia de 6+ hijos con DNI propio pagados desde el mismo
//             celular es rarísima; `hard` es opt-in y agresivo por diseño.
//   - soft  → NUNCA bloquea por conteo solo. Exige un umbral AÚN más alto (8) Y
//             una segunda señal de anillo: la misma tarjeta vista desde >= 3
//             dispositivos distintos. Una familia (1 device) jamás cruza esa
//             segunda condición → imposible de bloquear en soft.
//   - shadow→ nunca bloquea; solo marca 'would_block' para calibrar.
//
// La decisión es PURA (mode + señales → decisión). El circuit breaker (fail-open)
// y el registro de la muestra los aplica el caller vía `enforceCardDecision`,
// igual que el flujo principal.

export const CARD_RING_DNI_THRESHOLD = 6; // hard: bloqueo por conteo de DNIs
export const CARD_RING_SOFT_DNI_THRESHOLD = 8; // soft: conteo mínimo (más alto)
export const CARD_RING_SOFT_DEVICE_MIN = 3; // soft: corroboración de multidispositivo

export type CardRiskSignals = {
  /** DNIs DISTINTOS que usaron esta tarjeta en ~24h (incluye el intento actual). */
  distinctDnis: number;
  /** Dispositivos DISTINTOS que usaron esta tarjeta en ~24h (incluye el actual). */
  distinctDevices: number;
};

export type CardEnforcementDecision = {
  /** true → rechazar el pago ANTES de cobrar. */
  block: boolean;
  action: SignalAction;
  reason: string | null;
};

/**
 * Decide si una tarjeta con muchos DNIs debe bloquearse. PURA: no lee env ni
 * estado — el `mode` y las señales entran como argumentos, así que es trivial de
 * testear (incluida la familia legítima que NUNCA se bloquea). El caller aplica
 * el circuit breaker (fail-open) con `enforceCardDecision`.
 */
export const decideCardEnforcement = (
  signals: CardRiskSignals,
  mode: EnforcementMode,
): CardEnforcementDecision => {
  const { distinctDnis, distinctDevices } = signals;
  const overHardCount = distinctDnis >= CARD_RING_DNI_THRESHOLD;
  const marked: CardEnforcementDecision = {
    block: false,
    action: overHardCount ? "would_block" : "logged",
    reason: overHardCount ? "card_many_dni" : null,
  };

  if (mode === "shadow") return marked;

  if (mode === "hard") {
    if (overHardCount) return { block: true, action: "blocked", reason: "card_many_dni" };
    return marked;
  }

  // soft: umbral más alto + corroboración de anillo (multidispositivo, no familia).
  const ringLikely =
    distinctDnis >= CARD_RING_SOFT_DNI_THRESHOLD && distinctDevices >= CARD_RING_SOFT_DEVICE_MIN;
  if (ringLikely) return { block: true, action: "blocked", reason: "card_ring_multidevice" };
  return marked;
};

/**
 * Aplica el circuit breaker (fail-open) a un bloqueo de tarjeta y registra la
 * muestra en la ventana del breaker. Si el breaker está abierto (demasiados
 * bloqueos recientes → posible mala calibración o pico legítimo), degrada el
 * bloqueo a "would_block" para no arriesgar ventas. La decisión de bloquear NO
 * contamina el breaker con la misma severidad que el flujo principal, pero sí
 * cuenta: un bug que dispare bloqueos de tarjeta en masa abre el breaker igual.
 */
export const enforceCardDecision = (decision: CardEnforcementDecision): CardEnforcementDecision => {
  if (!decision.block) {
    recordSample(false);
    return decision;
  }
  if (breakerOpen()) {
    recordSample(false);
    return { block: false, action: "would_block", reason: decision.reason };
  }
  recordSample(true);
  return decision;
};
