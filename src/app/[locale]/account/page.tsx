"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { OrgShell } from "../org/_shell/OrgShell";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import { useSignOut } from "@/lib/identity/hooks/useFirebaseAuth";
import {
  SettingsCard,
  SettingsRow,
} from "../org/settings/_components/SettingsCard";
import { TextInput } from "../org/settings/_components/Field";
import { Switch } from "../org/settings/_components/Toggle";
import {
  SectionNav,
  type Section,
} from "../org/settings/_components/SectionNav";

// Cuenta de USUARIO (no de marca). Vive separado de /org/settings para que la
// gestión del perfil + notificaciones no se mezcle con los ajustes de la marca.
// Linkeado desde el UserPill ("Mi cuenta") al final del sidebar.
const SECTIONS: Section[] = [
  { id: "cuenta", label: "Tu cuenta" },
  { id: "notificaciones", label: "Notificaciones" },
  { id: "sesion", label: "Sesión" },
];

export default function AccountPage() {
  const me = useCurrentUser();
  const signOut = useSignOut();
  const user = me.data?.user;

  const [accountName, setAccountName] = useState(user?.fullName ?? "");
  const [accountPhone, setAccountPhone] = useState(user?.phone ?? "");

  const [notifEmail, setNotifEmail] = useState(true);
  const [notifWhatsapp, setNotifWhatsapp] = useState(false);
  const [notifWeekly, setNotifWeekly] = useState(true);

  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <OrgShell>
      <div className="mb-8 sm:mb-10">
        <h1 className="font-sans text-[clamp(34px,7.2vw,42px)] font-bold leading-[1.05] tracking-[-0.035em] text-white">
          Tu cuenta
        </h1>
        <p className="mt-2 max-w-prose text-[13.5px] leading-snug text-cart-ink-3 sm:text-[14px]">
          Tu perfil personal, preferencias de notificación y sesión.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row lg:gap-10">
        <SectionNav sections={SECTIONS} />

        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
          }}
          className="flex w-full flex-col gap-6 lg:flex-1"
        >
          {/* Tu cuenta */}
          <SettingsCard
            id="cuenta"
            title="Tu cuenta"
            description="Esta información identifica al propietario de la cuenta."
          >
            <SettingsRow label="Nombre" description="Tu nombre completo.">
              <TextInput
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="Tu nombre"
              />
            </SettingsRow>
            <SettingsRow label="Email" description="No editable. Vinculado a tu sesión.">
              <TextInput value={user?.email ?? ""} readonly />
            </SettingsRow>
            <SettingsRow label="Teléfono" description="Para alertas urgentes por WhatsApp.">
              <TextInput
                value={accountPhone}
                onChange={(e) => setAccountPhone(e.target.value)}
                placeholder="+51 999 999 999"
                inputMode="tel"
              />
            </SettingsRow>
          </SettingsCard>

          {/* Notificaciones */}
          <SettingsCard
            id="notificaciones"
            title="Notificaciones"
            description="Elige cómo y cuándo te avisamos."
          >
            <SettingsRow
              label="Email"
              description="Confirmaciones de venta, devoluciones y avisos críticos."
            >
              <div className="flex justify-end">
                <Switch checked={notifEmail} onChange={setNotifEmail} />
              </div>
            </SettingsRow>
            <SettingsRow
              label="WhatsApp"
              description="Alertas instantáneas al número registrado."
            >
              <div className="flex justify-end">
                <Switch checked={notifWhatsapp} onChange={setNotifWhatsapp} />
              </div>
            </SettingsRow>
            <SettingsRow
              label="Resumen semanal"
              description="Cada lunes, un resumen del rendimiento de tus eventos."
            >
              <div className="flex justify-end">
                <Switch checked={notifWeekly} onChange={setNotifWeekly} />
              </div>
            </SettingsRow>
          </SettingsCard>

          {/* Sesión */}
          <SettingsCard
            id="sesion"
            title="Sesión"
            description="Tu acceso en este dispositivo."
          >
            <SettingsRow
              label="Cerrar sesión"
              description="Sales de Pasape en este dispositivo."
            >
              <div className="flex sm:justify-end">
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="rounded-full border border-cart-line bg-cart-bg px-4 py-1.5 text-[12.5px] font-semibold text-white transition hover:border-cart-line-strong disabled:opacity-60"
                >
                  {signingOut ? "Cerrando…" : "Cerrar sesión"}
                </button>
              </div>
            </SettingsRow>
          </SettingsCard>
        </motion.div>
      </div>

      <div className="h-[env(safe-area-inset-bottom)]" />
    </OrgShell>
  );
}
