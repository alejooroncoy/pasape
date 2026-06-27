import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import type { Event } from "../domain/Event";

export type DoorLink = {
  url: string;
  code: string;
  expiresAt: string;
};

// Alfabeto sin caracteres ambiguos (sin I, L, O, 0, 1) para que el código se
// pueda dictar por teléfono y teclear sin errores.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;
const MAX_INSERT_ATTEMPTS = 6;
// Horizonte informativo de la sesión que crea el portero al canjear (24h). El
// código en sí persiste hasta que el organizador lo rota; no caduca solo.
const SESSION_HORIZON_MS = 1000 * 60 * 60 * 24;

const randomCode = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
};

/**
 * Código corto de acceso para porteros, persistido en `event_access_codes`.
 *
 * Es idempotente por evento: si el evento ya tiene un código (zona null), lo
 * reusa — así el organizador ve siempre el mismo código y el link no cambia
 * solo. Rotarlo será una acción explícita (aún no implementada). El código es
 * único global, por eso el `?door=CODE` resuelve el evento sin saberlo de
 * antemano (lo hace `joinByCode`).
 */
export const generateDoorLink = async (
  event: Pick<Event, "id" | "slug">,
  origin: string,
): Promise<DoorLink> => {
  const db = supabaseAdmin();

  const { data: existing } = await db
    .from("event_access_codes")
    .select("code")
    .eq("event_id", event.id)
    .is("zone_id", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ code: string }>();

  let code = existing?.code;
  for (let attempt = 0; !code && attempt < MAX_INSERT_ATTEMPTS; attempt++) {
    const candidate = randomCode();
    const { error } = await db
      .from("event_access_codes")
      .insert({ event_id: event.id, code: candidate, zone_id: null });
    if (!error) {
      code = candidate;
    } else if (error.code !== "23505") {
      // 23505 = unique_violation (colisión de código) → reintenta. Otro = error real.
      throw new Error(`door code insert failed: ${error.message}`);
    }
  }
  if (!code) throw new Error("could not generate a unique door code");

  const url = `${origin.replace(/\/$/, "")}/scan?door=${code}`;
  const expiresAt = new Date(Date.now() + SESSION_HORIZON_MS).toISOString();
  return { url, code, expiresAt };
};
