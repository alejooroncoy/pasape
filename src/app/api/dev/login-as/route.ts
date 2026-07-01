import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { createSupabaseServerClient } from "@/server/_shared/supabase/server";
import { fail, ok } from "@/server/_shared/http";

// Dev-only: crea (si no existe) un usuario de prueba fijo y le inicia sesión
// con cookies reales de Supabase, para poder reproducir bugs de auth/race
// conditions en local sin pasar por el flujo de Google OAuth cada vez.
const DEV_EMAIL = "dev-test@pasape.local";
const DEV_PASSWORD = "pasape-dev-test-only";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return fail("not_available", 403);
  }

  const admin = supabaseAdmin();

  // Busca el usuario de prueba; si no existe, lo crea con el password fijo.
  const { data: existing } = await admin.auth.admin.listUsers();
  const already = existing?.users?.find((u) => u.email === DEV_EMAIL);

  if (!already) {
    const { error: createError } = await admin.auth.admin.createUser({
      email: DEV_EMAIL,
      password: DEV_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: "Dev Test" },
    });
    if (createError) return fail(createError.message, 500);
  }

  // Login real: setAll de este cliente escribe las cookies de sesión en el
  // response, exactamente como el flujo normal de login.
  const supabase = await createSupabaseServerClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: DEV_EMAIL,
    password: DEV_PASSWORD,
  });
  if (signInError) return fail(signInError.message, 500);

  return ok({ ok: true });
}
