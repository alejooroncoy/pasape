// Política de enforcement anti-bot: decide qué HACER con un score, y protege las
// ventas con un circuit breaker fail-open.
//
// Modos (env BOT_ENFORCEMENT, default 'shadow'):
//   shadow → NUNCA bloquea ni ralentiza. Solo registra qué habría hecho
//            ('would_block' / 'would_throttle'). Es el modo de calibración.
//   soft   → NUNCA bloquea; exige un STEP-UP CHALLENGE (proof-of-work) desde
//            SOFT_THRESHOLD en adelante (incluido >= HARD). Cero ventas perdidas,
//            cero falso positivo duro: al humano (score < SOFT) no lo toca; el
//            bot masivo paga un PoW por cada intento sospechoso. Es la defensa
//            clave para compra masiva guest (sin login previo).
//   hard   → BLOQUEA lo flagrante (score >= HARD_THRESHOLD) y exige step-up
//            challenge en la zona sospechosa (SOFT..HARD). Agresivo.
//
// Por qué el step-up (PoW invisible) es la mejor arma contra el bot sin-login: no
// hay identidad previa que verificar, así que en vez de un muro (que arriesga
// falsos positivos) se destruye la ECONOMÍA del ataque. El humano resuelve el PoW
// en background sin notar nada; el bot masivo paga el peaje de CPU + el round-trip
// firmado single-use por CADA intento sospechoso, y deja de ser rentable.
//
// (El tarpit progresivo `tarpitDelayMs` se conserva como utilidad pura testeable,
// pero el enforcement ya no lo emite: el step-up challenge lo reemplaza.)
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

export type SignalAction =
  | "logged"
  | "would_block"
  | "would_throttle"
  | "would_challenge"
  | "throttled"
  | "challenge"
  | "blocked";

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

export type EnforcementDecision = {
  allowed: boolean;
  action: SignalAction;
  delayMs: number;
  /**
   * true = el intento cae en zona sospechosa y, para proceder, debe resolver un
   * step-up challenge (PoW). El route responde 428 con el challenge si el cliente
   * aún no adjuntó una solución válida. Nunca true en modo shadow.
   */
  challengeRequired: boolean;
};

/**
 * Decide la acción a partir del score y el modo vigente, respetando el circuit
 * breaker.
 *
 *   shadow → nunca actúa: solo registra qué HABRÍA hecho (would_block /
 *            would_challenge). challengeRequired siempre false.
 *   soft   → zona sospechosa [SOFT, ∞) → challenge. Nunca bloquea (nunca 429).
 *   hard   → [SOFT, HARD) → challenge; >= HARD → block (breaker cerrado). Si el
 *            breaker está abierto, el bloqueo degrada a challenge (fail-open).
 *
 * PURA respecto al score/modo; su único efecto es alimentar el circuit breaker.
 * (El tarpit ya no se emite; el step-up challenge lo reemplaza, por eso ya no
 * necesita `deviceAttemptsShort`.)
 */
export const decideEnforcement = (score: number): EnforcementDecision => {
  const mode = enforcementMode();
  const wouldBlock = score >= HARD_THRESHOLD;
  const wouldChallenge = score >= SOFT_THRESHOLD; // zona sospechosa (incluye HARD)

  if (mode === "shadow") {
    recordSample(false); // en shadow nunca actuamos, no contamina el breaker
    return {
      allowed: true,
      delayMs: 0,
      challengeRequired: false,
      action: wouldBlock ? "would_block" : wouldChallenge ? "would_challenge" : "logged",
    };
  }

  // Bloqueo duro: solo en modo 'hard', para lo flagrante, con el breaker cerrado.
  const shouldBlock = mode === "hard" && wouldBlock && !breakerOpen();
  recordSample(shouldBlock);
  if (shouldBlock) return { allowed: false, action: "blocked", delayMs: 0, challengeRequired: false };

  // Zona sospechosa no bloqueada (soft en todo [SOFT,∞); hard en [SOFT,HARD); o
  // hard >=HARD con el breaker abierto que degrada a challenge): step-up PoW.
  if (wouldChallenge) {
    return { allowed: true, action: "challenge", delayMs: 0, challengeRequired: true };
  }
  return { allowed: true, action: "logged", delayMs: 0, challengeRequired: false };
};
