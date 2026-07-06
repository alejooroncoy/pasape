import { supabaseAdmin } from "@/server/_shared/supabase/admin";

/**
 * Lookup por WhatsApp — respuesta uniforme (L9). No devuelve `found: boolean`
 * para evitar enumeración de números registrados.
 */
export type LookupResult = { displayHint: string };

const normalizePhone = (raw: string): string => raw.replace(/\D/g, "");

const formatPhoneHint = (digits: string): string => {
  if (digits.length === 9) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  return digits;
};

const shortenName = (full: string | null | undefined): string => {
  if (!full) return "Tu contacto";
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Tu contacto";
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const surname = parts[parts.length - 1];
  return `${first} ${surname.charAt(0).toUpperCase()}.`;
};

export async function lookupProfileByPhone(rawPhone: string): Promise<LookupResult> {
  const phone = normalizePhone(rawPhone);
  if (phone.length < 9) {
    return { displayHint: "WhatsApp verificado" };
  }

  const db = supabaseAdmin();
  const { data } = await db
    .from("profiles")
    .select("full_name")
    .eq("phone", phone)
    .maybeSingle<{ full_name: string | null }>();

  // Misma forma de respuesta registrado o no: hint corto sin filtrar existencia.
  if (data?.full_name) {
    return { displayHint: shortenName(data.full_name) };
  }
  return { displayHint: `+51 ${formatPhoneHint(phone.slice(-9))}` };
}
