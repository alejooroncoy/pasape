import type { SupabaseClient } from "@supabase/supabase-js";
import type { JWK } from "jose";
import { generateEventKeypair } from "@/server/tickets/domain/EventSignature";

// Get-or-create del par ECDSA del evento. La privada nunca sale del server
// (tabla event_signing_keys es server-only por RLS). Se genera perezosamente la
// 1ª vez que un ticket del evento necesita un cert.

type Row = { public_key_jwk: JWK; private_key_jwk: JWK };

export async function getOrCreateEventSigningKeys(
  db: SupabaseClient,
  eventId: string,
): Promise<{ publicJwk: JWK; privateJwk: JWK }> {
  const existing = await db
    .from("event_signing_keys")
    .select("public_key_jwk, private_key_jwk")
    .eq("event_id", eventId)
    .maybeSingle<Row>();
  if (existing.data) {
    return {
      publicJwk: existing.data.public_key_jwk,
      privateJwk: existing.data.private_key_jwk,
    };
  }

  const pair = await generateEventKeypair();
  // ignoreDuplicates evita romper si otra request creó el par en paralelo.
  await db.from("event_signing_keys").upsert(
    {
      event_id: eventId,
      public_key_jwk: pair.publicJwk,
      private_key_jwk: pair.privateJwk,
    },
    { onConflict: "event_id", ignoreDuplicates: true },
  );

  const settled = await db
    .from("event_signing_keys")
    .select("public_key_jwk, private_key_jwk")
    .eq("event_id", eventId)
    .single<Row>();
  return {
    publicJwk: settled.data!.public_key_jwk,
    privateJwk: settled.data!.private_key_jwk,
  };
}
