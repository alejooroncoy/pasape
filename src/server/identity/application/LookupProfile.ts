import { supabaseAdmin } from "@/server/_shared/supabase/admin";

/**
 * Public lookup by phone — devuelve info MÍNIMA del perfil para confirmar al
 * comprador a quién le está mandando una entrada. Estilo Yape: "Le mandas su
 * entrada a Juan P.".
 *
 * Privacy:
 * - Nunca expone DNI, email, id, ni teléfono completo.
 * - Solo primer nombre + inicial del apellido.
 * - Si no hay match → { found: false }.
 */
export type LookupResult =
  | { found: true; displayName: string }
  | { found: false };

const normalizePhone = (raw: string): string => raw.replace(/\D/g, "");

const shortenName = (full: string | null | undefined): string => {
  if (!full) return "Tu pata";
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Tu pata";
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const surname = parts[parts.length - 1];
  // "Carla Rodríguez" → "Carla R."
  return `${first} ${surname.charAt(0).toUpperCase()}.`;
};

export async function lookupProfileByPhone(rawPhone: string): Promise<LookupResult> {
  const phone = normalizePhone(rawPhone);
  if (phone.length < 9) return { found: false };

  const db = supabaseAdmin();
  const { data } = await db
    .from("profiles")
    .select("full_name")
    .eq("phone", phone)
    .maybeSingle<{ full_name: string | null }>();

  if (!data) return { found: false };
  return { found: true, displayName: shortenName(data.full_name) };
}
