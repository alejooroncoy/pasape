import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "../env";

// Bypass RLS — usar SOLO desde server actions / route handlers para operaciones
// que ya validaron permisos vía AuthContext.
export const supabaseAdmin = () =>
  createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
