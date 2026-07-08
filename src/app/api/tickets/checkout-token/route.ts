import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail } from "@/server/_shared/http";
import { createRateLimiter, ipOf } from "@/server/_shared/rateLimit";
import { signCheckoutToken } from "@/server/tickets/domain/CheckoutToken";
import {
  makeChallenge,
  mintDifficulty,
  verifyChallengeSolution,
} from "@/server/tickets/domain/CheckoutChallenge";
import { bumpMintCount, consumeChallenge } from "@/server/tickets/infrastructure/checkoutNonce";

// Minteo del checkout-token con proof-of-work (anti-automatización P0/P1):
//   GET  → emite un CHALLENGE firmado, atado al eventId + device del solicitante.
//   POST → recibe la solución del PoW; si es válida y no fue canjeada antes,
//          emite el checkout-token (atado al device). Ver CheckoutChallenge.ts.
//
// El deviceHash llega en el header x-device-hash (lo calcula el cliente al
// montar). Atar el token a ese device obliga a minar un challenge nuevo por cada
// identidad rotada — encarece la compra masiva sin fricción para el humano.

const challengeLimiter = createRateLimiter("tickets:checkout-challenge", 60);
const mintLimiter = createRateLimiter("tickets:checkout-mint", 60);

const deviceHashOf = (req: NextRequest): string => {
  const h = req.headers.get("x-device-hash")?.trim();
  return h && h.length >= 6 && h.length <= 64 ? h : "";
};

const querySchema = z.object({ eventId: z.string().uuid() });

export const GET = async (req: NextRequest) => {
  if (!(await challengeLimiter.check(req))) return challengeLimiter.response();
  const parsed = querySchema.safeParse({
    eventId: req.nextUrl.searchParams.get("eventId"),
  });
  if (!parsed.success) return fail("invalid_input");
  const deviceHash = deviceHashOf(req);
  // PoW ESCALADO ("captcha invisible"): la dificultad crece con cuántos tokens
  // ya minteó este device/IP en la última hora. Humano (1-2) → trivial; bot que
  // necesita muchos → peaje creciente por cada uno.
  const recentMints = await bumpMintCount(deviceHash, ipOf(req));
  const difficulty = mintDifficulty(recentMints);
  return ok({ challenge: makeChallenge(parsed.data.eventId, deviceHash, difficulty) });
};

const solutionSchema = z.object({
  eventId: z.string().uuid(),
  deviceHash: z.string(),
  salt: z.string().min(1).max(64),
  target: z.string().min(1).max(128),
  maxnumber: z.number().int().positive(),
  issuedAt: z.number().int().positive(),
  signature: z.string().min(1).max(64),
  number: z.number().int().nonnegative(),
});

export const POST = async (req: NextRequest) => {
  if (!(await mintLimiter.check(req))) return mintLimiter.response();
  const body = await req.json().catch(() => ({}));
  const parsed = solutionSchema.safeParse(body);
  if (!parsed.success) return fail("invalid_input");

  // El device del challenge debe ser el mismo que solicita el token: así el
  // token queda atado a un device coherente extremo a extremo.
  if (parsed.data.deviceHash !== deviceHashOf(req)) return fail("device_mismatch", 400);

  if (!verifyChallengeSolution(parsed.data)) return fail("invalid_solution", 400);

  // Single-use: un challenge resuelto no se puede canjear dos veces para mintar
  // varios tokens. "replay" ⇒ ya se usó. ("unknown" en dev sin Redis ⇒ se deja
  // pasar, fail-open.)
  if ((await consumeChallenge(parsed.data.salt)) === "replay") {
    return fail("challenge_used", 409);
  }

  return ok({ token: signCheckoutToken(parsed.data.eventId, parsed.data.deviceHash) });
};
