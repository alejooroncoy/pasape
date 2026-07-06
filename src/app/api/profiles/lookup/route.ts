import { NextResponse, type NextRequest } from "next/server";
import { IdentityController } from "@/server/identity/controllers/rest/IdentityController";
import { json } from "@/server/_shared/http";
import { createRateLimiter } from "@/server/_shared/rateLimit";

// LOW-5: sin auth y sin rate limit, este endpoint permitía barrer números de
// teléfono para enumerar quién está registrado (y su nombre). Sigue sin exigir
// sesión (el flujo real de transferir sí requiere sesión antes de este paso),
// pero se acota el volumen por IP igual que /api/identity/dni-lookup.
const limiter = createRateLimiter("profiles:lookup", 10);

// POST /api/profiles/lookup — lookup público de perfil por WhatsApp para
// confirmar destinatario al asignar/transferir entradas. Solo devuelve un
// displayName corto (privacy-preserving).
export async function POST(req: NextRequest) {
  if (!(await limiter.check(req))) return limiter.response();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ data: { displayHint: "WhatsApp verificado" } }, { status: 200 });
  }
  return json(await IdentityController.lookupByPhone(body));
}
