import "server-only";
import { cache } from "react";
import { getAuthContext } from "@/server/_shared/AuthContext";
import { getCurrentUser } from "./GetCurrentUser";
import { supabaseUserRepository } from "../infrastructure/repositories/SupabaseUserRepository";
import type { User } from "../domain/User";

/**
 * Resolver único de sesión para todo el proyecto.
 *
 * Llamable desde cualquier server component / route handler sin repetir el
 * cableado de `getAuthContext()` + repo. Devuelve el `User` ya hidratado, o
 * `null` si no hay sesión — nunca lanza, así el frontend solo bifurca por
 * presencia de usuario.
 *
 * `cache()` deduplica por-request: layout + page + N controllers comparten una
 * sola resolución de red (encima del propio cache de `getAuthContext`).
 *
 * Como corre en el server, el usuario llega resuelto en el primer render: sin
 * flash de "Ingresar", sin `useEffect`, sin fetch de sesión en cliente. Baja
 * por props a los client components.
 */
export const getSessionUser = cache(async (): Promise<User | null> => {
  const auth = await getAuthContext();
  if (!auth.ok) return null;
  return getCurrentUser({ repo: supabaseUserRepository }, auth.value.profileId);
});
