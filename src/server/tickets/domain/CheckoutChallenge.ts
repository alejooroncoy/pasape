import { createHmac, createHash, randomBytes, randomInt, timingSafeEqual } from "crypto";

// Proof-of-work invisible para MINTAR el checkout-token (P0/P1 del research
// anti-automatización). Convierte el minteo de "un GET gratis" en un protocolo
// challenge→resolver→canjear:
//
//   1. El server emite un challenge FIRMADO (HMAC) atado al eventId + deviceHash:
//      elige un número secreto n en [0, maxnumber], publica target = SHA256(salt+n)
//      y maxnumber, pero NO n.
//   2. El cliente prueba i = 0..maxnumber hasta que SHA256(salt+i) === target.
//      Es trabajo real (invisible para 1 compra; ×N para mintar N tokens).
//   3. El cliente canjea {salt, target, number, ...firma}; el server verifica la
//      firma, la frescura, y que SHA256(salt+number) === target. Solo entonces
//      emite el checkout-token, atado al deviceHash del challenge.
//
// Modelo estilo ALTCHA (buscar el número que reproduce un hash conocido): el
// costo es ACOTADO (~maxnumber/2 hashes) y predecible → sin varianza que a veces
// congele el checkout de un humano.
//
// Honestidad: un bot que reimplementa el solver en código nativo resuelve el PoW
// barato. El valor NO es el costo de CPU puro, sino forzar el round-trip firmado
// + single-use + binding a deviceHash: ya no se pueden pre-mintar tokens gratis
// en masa, y cada identidad rotada exige un challenge nuevo.

const secret = (): string => {
  const s = process.env.TICKET_LINK_SECRET;
  if (!s) throw new Error("Missing env var: TICKET_LINK_SECRET");
  return s;
};

// ~maxnumber/2 hashes esperados en el cliente. 20000 ≈ 10k hashes ≈ décimas de
// segundo en WebCrypto, invisible al montar la página mientras se llena el form.
export const DEFAULT_MAX_NUMBER = 20_000;
// Techo del escalado: 32× la base ≈ ~320k hashes ≈ pocos segundos. Un device muy
// sospechoso paga esto por cada token; un humano nunca llega ahí. Cap para que un
// bug jamás congele el checkout de nadie.
const MAX_ESCALATED = DEFAULT_MAX_NUMBER * 32;
const SIG_HEX_LENGTH = 32; // 128 bits: la firma protege la integridad del challenge
const CHALLENGE_TTL_MS = 10 * 60 * 1000; // 10 min para resolver y canjear

/**
 * Dificultad del PoW (maxnumber) según cuántos tokens minteó recientemente la
 * entidad. El "captcha invisible" que solo los bots sienten: la base es trivial
 * (humano no nota nada); a partir de ~4 minteos escala exponencialmente hasta el
 * techo. PURA y determinista (testeable).
 */
export const mintDifficulty = (recentMints: number): number => {
  if (recentMints <= 3) return DEFAULT_MAX_NUMBER;
  const steps = Math.min(5, Math.floor((recentMints - 1) / 3)); // 4-6→1, 7-9→2, … 16+→5
  return Math.min(MAX_ESCALATED, DEFAULT_MAX_NUMBER * 2 ** steps);
};

const sha256hex = (s: string): string => createHash("sha256").update(s).digest("hex");

export type Challenge = {
  eventId: string;
  deviceHash: string;
  salt: string;
  target: string;
  maxnumber: number;
  issuedAt: number;
  signature: string;
};

// La firma cubre todo el challenge menos ella misma: un cliente no puede alterar
// eventId/deviceHash/target/maxnumber sin invalidarla.
const signPayload = (c: Omit<Challenge, "signature">): string =>
  createHmac("sha256", secret())
    .update(`chal:${c.eventId}:${c.deviceHash}:${c.salt}:${c.target}:${c.maxnumber}:${c.issuedAt}`)
    .digest("hex")
    .slice(0, SIG_HEX_LENGTH);

/**
 * Crea un challenge firmado atado al evento y al device del solicitante.
 * `maxNumber` escala la dificultad (ver mintDifficulty); default = base trivial.
 */
export const makeChallenge = (
  eventId: string,
  deviceHash: string,
  maxNumber: number = DEFAULT_MAX_NUMBER,
): Challenge => {
  const maxnumber = Math.max(DEFAULT_MAX_NUMBER, Math.min(MAX_ESCALATED, Math.round(maxNumber)));
  const salt = randomBytes(12).toString("hex");
  const number = randomInt(0, maxnumber + 1); // solución secreta (existe seguro)
  const target = sha256hex(salt + number);
  const issuedAt = Date.now();
  const base = { eventId, deviceHash, salt, target, maxnumber, issuedAt };
  return { ...base, signature: signPayload(base) };
};

export type SolutionInput = {
  eventId: string;
  deviceHash: string;
  salt: string;
  target: string;
  maxnumber: number;
  issuedAt: number;
  signature: string;
  number: number;
};

/**
 * Verifica una solución canjeada. Comprueba firma (integridad), frescura, y que
 * el número reproduzca el target. NO consume el single-use (eso lo hace el route
 * con Redis) para mantener este módulo puro/testeable.
 */
export const verifyChallengeSolution = (s: SolutionInput): boolean => {
  if (!s || typeof s.number !== "number" || !Number.isInteger(s.number)) return false;
  if (s.number < 0 || s.number > s.maxnumber) return false;
  if (!Number.isFinite(s.issuedAt) || Date.now() - s.issuedAt > CHALLENGE_TTL_MS) return false;
  if (Date.now() - s.issuedAt < -60_000) return false; // reloj del futuro

  const expectedSig = signPayload({
    eventId: s.eventId,
    deviceHash: s.deviceHash,
    salt: s.salt,
    target: s.target,
    maxnumber: s.maxnumber,
    issuedAt: s.issuedAt,
  });
  if (s.signature.length !== SIG_HEX_LENGTH) return false;
  try {
    if (!timingSafeEqual(Buffer.from(expectedSig, "hex"), Buffer.from(s.signature, "hex"))) {
      return false;
    }
  } catch {
    return false;
  }
  return sha256hex(s.salt + s.number) === s.target;
};
