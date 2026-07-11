import "server-only";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { createSupabaseServerClient } from "@/server/_shared/supabase/server";
import { err, ok, type Result } from "@/server/_shared/result";

// Único mecanismo de minteo de sesión real de Supabase Auth, compartido entre
// el código de correo (primera vez) y el passkey (siguientes veces): ninguno
// de los dos tiene un método nativo de "crear sesión" en Supabase, así que
// ambos pasan por acá. `generateLink` con type "magiclink" crea el auth.user
// si no existe (dispara handle_new_user → profiles) y no envía ningún correo —
// solo genera el token, que consumimos nosotros mismos en el mismo request.
// Debe llamarse SOLO desde un Route Handler (necesita escribir cookies).
export const mintSessionForProfile = async (
  email: string,
): Promise<Result<{ profileId: string }>> => {
  const admin = supabaseAdmin();
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError || !linkData) return err(linkError?.message ?? "mint_session_failed");

  const hashedToken = linkData.properties?.hashed_token;
  // Supabase no siempre verifica con el mismo `type` que se pidió en generateLink
  // (para "magiclink" el GoTrue real espera type "email" en verifyOtp) — la propia
  // respuesta trae `verification_type`, que es la fuente de verdad a usar acá.
  const verificationType = linkData.properties?.verification_type ?? "magiclink";
  if (!hashedToken) return err("mint_session_failed");

  const supabase = await createSupabaseServerClient();
  const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: hashedToken,
    type: verificationType,
  });
  if (verifyError || !verifyData?.user) return err(verifyError?.message ?? "mint_session_failed");

  return ok({ profileId: verifyData.user.id });
};
