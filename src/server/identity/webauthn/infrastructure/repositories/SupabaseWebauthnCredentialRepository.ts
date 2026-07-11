import "server-only";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import type { WebauthnCredential } from "../../domain/WebauthnCredential";
import type { WebauthnCredentialRepository } from "../../ports/WebauthnCredentialRepository";

type Row = {
  id: string;
  profile_id: string;
  credential_id: string;
  public_key: string;
  counter: number;
  device_label: string | null;
  transports: string[] | null;
  created_at: string;
  last_used_at: string | null;
};

const toDomain = (row: Row): WebauthnCredential => ({
  id: row.id,
  profileId: row.profile_id,
  credentialId: row.credential_id,
  publicKey: row.public_key,
  counter: row.counter,
  deviceLabel: row.device_label,
  transports: row.transports,
  createdAt: row.created_at,
  lastUsedAt: row.last_used_at,
});

// Un insert/update que falla en silencio es peor que uno que revienta: sin
// esto, VerifyRegistration devolvía {ok:true} aunque la fila nunca se hubiera
// guardado (ej. tabla fuera de sync, RLS, red) — el usuario "registraba" una
// passkey que después nunca podía usar para entrar, sin ningún rastro del error.
export const supabaseWebauthnCredentialRepository: WebauthnCredentialRepository = {
  insert: async (input) => {
    const db = supabaseAdmin();
    const { error } = await db.from("webauthn_credentials").insert({
      profile_id: input.profileId,
      credential_id: input.credentialId,
      public_key: input.publicKey,
      counter: input.counter,
      transports: input.transports,
    });
    if (error) throw new Error(`webauthn_credentials insert failed: ${error.message}`);
  },

  findByCredentialId: async (credentialId) => {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("webauthn_credentials")
      .select("*")
      .eq("credential_id", credentialId)
      .maybeSingle<Row>();
    if (error) throw new Error(`webauthn_credentials lookup failed: ${error.message}`);
    return data ? toDomain(data) : null;
  },

  listByProfileId: async (profileId) => {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("webauthn_credentials")
      .select("*")
      .eq("profile_id", profileId)
      .returns<Row[]>();
    if (error) throw new Error(`webauthn_credentials list failed: ${error.message}`);
    return (data ?? []).map(toDomain);
  },

  updateCounter: async (credentialId, counter) => {
    const db = supabaseAdmin();
    const { error } = await db
      .from("webauthn_credentials")
      .update({ counter, last_used_at: new Date().toISOString() })
      .eq("credential_id", credentialId);
    if (error) throw new Error(`webauthn_credentials counter update failed: ${error.message}`);
  },
};
