import { NextResponse, type NextRequest } from "next/server";
import { IdentityController } from "@/server/identity/controllers/rest/IdentityController";
import { json } from "@/server/_shared/http";

// POST /api/profiles/lookup — lookup público de perfil por WhatsApp para
// confirmar destinatario al asignar/transferir entradas. Solo devuelve un
// displayName corto (privacy-preserving).
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ data: { found: false } }, { status: 200 });
  }
  return json(await IdentityController.lookupByPhone(body));
}
