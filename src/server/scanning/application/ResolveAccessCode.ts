import { err, ok, type Result } from "@/server/_shared/result";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";

export type ResolvedCode = {
  eventSlug: string;
  eventTitle: string;
};

/**
 * Resuelve un código de puerta a su evento, SIN crear sesión ni token. Lo usa el
 * onboarding del portero para validar el código por detrás (paso 1) antes de
 * pedir su identidad (paso 2) y mostrarle a qué evento va a entrar. Read-only.
 */
export async function resolveAccessCode(
  rawCode: string,
): Promise<Result<ResolvedCode>> {
  const code = rawCode.trim();
  if (!code) return err("invalid_input");

  const db = supabaseAdmin();
  const { data: codeRow } = await db
    .from("event_access_codes")
    .select("event_id")
    .eq("code", code)
    .maybeSingle<{ event_id: string }>();
  if (!codeRow) return err("invalid_code");

  const { data: ev } = await db
    .from("events")
    .select("slug, title")
    .eq("id", codeRow.event_id)
    .maybeSingle<{ slug: string; title: string }>();
  if (!ev) return err("event_not_found");

  return ok({ eventSlug: ev.slug, eventTitle: ev.title });
}
