"use client";

import { useEffect } from "react";
import { motion } from "motion/react";
import { GoogleBtn } from "@/components/design";
import { Sheet } from "@/components/ui/Sheet";
import { useGoogleSignIn } from "@/lib/identity/hooks/useFirebaseAuth";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import { clientEvents } from "@/lib/analytics/clientEvents";

type Props = {
  open: boolean;
  onClose: () => void;
  redirectTo?: string;
};

// Copy oficial único de login (no se varía por superficie — un solo componente).
const TITLE = "Entra a Pasape";
const SUBTITLE = "Guarda eventos, compra entradas y sigue a tus productoras favoritas.";

export function SignInDrawer({ open, onClose, redirectTo }: Props) {
  const { signIn, pending, error } = useGoogleSignIn({ redirectTo });
  const me = useCurrentUser();

  // Al iniciar sesión con éxito, cierra la hoja.
  useEffect(() => {
    if (me.data?.user && open) onClose();
  }, [me.data, open, onClose]);

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={TITLE}
      description={SUBTITLE}
    >
      {/* Sin animación de entrada en título/subtítulo/footer: si el documento se
          monta oculto (backgrounding típico al abrir el link desde otra app en
          celular), framer-motion pausa su RAF y el texto queda congelado en
          opacity:0 para siempre — mismo bug que el CTA de abajo. */}
      <motion.div
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.25 }}
        className="mb-1.5 font-sans text-[24px] font-bold leading-tight tracking-[-0.03em] text-cart-ink"
      >
        {TITLE}
      </motion.div>
      <motion.div
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.14, duration: 0.25 }}
        className="mb-5 text-[13px] leading-[1.5] text-cart-ink-3"
      >
        {SUBTITLE}
      </motion.div>
      <GoogleBtn
        onClick={() => {
          clientEvents.signInStarted({ provider: "google" });
          void signIn();
        }}
        disabled={pending}
      />
      {error && (
        <div className="mt-3 text-center text-xs text-cart-ink-3" role="status">
          {error}
        </div>
      )}
      <motion.div
        initial={false}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.28, duration: 0.25 }}
        className="mt-3.5 pb-6 text-center text-[11px] text-cart-ink-4"
      >
        Sin contraseña · sin apps
      </motion.div>
    </Sheet>
  );
}
