import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/server/_shared/supabase/server";

// Signout — Supabase Auth maneja la sesión vía cookies del SDK.
// NO borramos la cookie de org activa (pasape-active-org) a propósito: así, al
// volver a entrar, se restaura la última marca que tenía seleccionada antes de
// desloguearse. Si en el mismo navegador entra otro usuario, su slug no estará
// entre sus marcas y el front cae a su primera marca (find ?? orgs[0]).
export const DELETE = async () => {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
};
