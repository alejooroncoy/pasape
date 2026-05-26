import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/server/_shared/supabase/server";
import { ACTIVE_ORG_COOKIE } from "@/server/_shared/AuthContext";

// Signout — Supabase Auth maneja la sesión vía cookies del SDK,
// también limpiamos nuestra cookie de org activa.
export const DELETE = async () => {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(ACTIVE_ORG_COOKIE);
  return res;
};
