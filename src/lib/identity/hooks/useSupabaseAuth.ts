"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/server/_shared/supabase/client";
import { api } from "@/lib/_shared/api-client";
import { clearPersistedQueryCache } from "@/lib/_shared/query-persister";
import { resetPrefetchWallet } from "@/lib/tickets/prefetchWallet";
import { currentUserKey } from "./useCurrentUser";

export const useGoogleSignIn = (opts: { redirectTo?: string } = {}) => {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      // Preserva el query string (ej. ?k=… de los links de ticket): sin él la
      // página vuelve del login sin su llave secreta y da 404.
      const next =
        opts.redirectTo ?? window.location.pathname + window.location.search;
      const callbackUrl = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callbackUrl },
      });
      if (oauthError) throw oauthError;
      // Browser navega a Google; el callback nos trae de vuelta.
    } catch (e) {
      setError(e instanceof Error ? e.message : "sign_in_failed");
      setPending(false);
    }
  }, [opts.redirectTo]);

  return { signIn, pending, error };
};

export const useSignOut = () => {
  const qc = useQueryClient();
  return useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    // Limpia cookie de org activa server-side.
    await api.del<{ ok: true }>("/api/auth/session");
    // Vacía la cache en memoria, el snapshot persistido en IndexedDB y la copia
    // del service worker: sin esto, la wallet (entradas + DNI) de esta cuenta
    // seguiría visible offline si otra persona entra en el mismo device.
    qc.clear();
    await clearPersistedQueryCache();
    resetPrefetchWallet();
    navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_WALLET_CACHE" });
    void qc.invalidateQueries({ queryKey: currentUserKey });
  }, [qc]);
};
