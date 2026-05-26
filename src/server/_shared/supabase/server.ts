import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "../env";

export const createSupabaseServerClient = async (idToken?: string) => {
  const cookieStore = await cookies();
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // setAll from Server Component — ignored when middleware refreshes sessions.
        }
      },
    },
    global: idToken
      ? { headers: { Authorization: `Bearer ${idToken}` } }
      : undefined,
  });
};
