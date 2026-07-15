"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { createSupabaseBrowserClient } from "@/server/_shared/supabase/client";
import { OrgShell } from "../org/_shell/OrgShell";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import { useUpdateProfile } from "@/lib/identity/hooks/useUpdateProfile";
import { useSignOut } from "@/lib/identity/hooks/useFirebaseAuth";
import { UserAvatar } from "@/components/layout/UserAvatar";
import {
  SettingsCard,
  SettingsRow,
} from "../org/settings/_components/SettingsCard";
import { TextInput } from "../org/settings/_components/Field";
import { PhoneField } from "@/components/design/PhoneField";
import { Switch } from "../org/settings/_components/Toggle";
import {
  SectionNav,
  type Section,
} from "../org/settings/_components/SectionNav";

const ASSETS_BUCKET = "event-assets";

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

  const updateProfile = useUpdateProfile();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl ?? null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  // Sincroniza el preview cuando carga/cambia el usuario (el estado inicial se
  // fija antes de que la query resuelva).
  useEffect(() => {
    setAvatarUrl(user?.avatarUrl ?? null);
  }, [user?.avatarUrl]);

  const onAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setAvatarUploading(true);
    setAvatarError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const ext = f.name.includes(".") ? f.name.split(".").pop() : "jpg";
      const path = `avatars/${user?.id ?? "user"}-${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from(ASSETS_BUCKET)
        .upload(path, f, { cacheControl: "3600", upsert: false, contentType: f.type || undefined });
      if (error) throw error;
      const { data } = supabase.storage.from(ASSETS_BUCKET).getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
      await updateProfile.mutateAsync({ avatarUrl: data.publicUrl });
    } catch {
      setAvatarError("No se pudo subir la foto. Reintenta.");
    } finally {
      setAvatarUploading(false);
    }
  };

  const onAvatarRemove = async () => {
    setAvatarUploading(true);
    setAvatarError(null);
    try {
      setAvatarUrl(null);
      await updateProfile.mutateAsync({ avatarUrl: null });
    } catch {
      setAvatarError("No se pudo quitar la foto. Reintenta.");
    } finally {
      setAvatarUploading(false);
    }
  };

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
        <h1 className="font-sans text-[clamp(34px,7.2vw,42px)] font-bold leading-[1.05] tracking-[-0.035em] text-cart-ink">
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
            <SettingsRow label="Foto" description="Tu imagen de perfil. Por defecto, la de Google.">
              <div className="flex items-center gap-3 sm:justify-end">
                <UserAvatar
                  name={accountName || user?.email}
                  avatarUrl={avatarUrl}
                  className="size-12 rounded-2xl text-[16px] shadow-[0_0_0_1px_rgba(255,255,255,0.1)_inset]"
                  fallbackClassName="bg-gradient-to-br from-[#7C3AED] to-[#b87cff]"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={avatarUploading}
                    className="rounded-full border border-cart-line bg-cart-bg px-3.5 py-1.5 text-[12.5px] font-semibold text-cart-ink transition hover:border-cart-line-strong disabled:opacity-60"
                  >
                    {avatarUploading ? "Subiendo…" : "Cambiar"}
                  </button>
                  {avatarUrl && !avatarUploading && (
                    <button
                      type="button"
                      onClick={onAvatarRemove}
                      className="rounded-full px-2.5 py-1.5 text-[12.5px] font-medium text-cart-ink-3 transition hover:text-cart-ink"
                    >
                      Quitar
                    </button>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onAvatarPick}
                />
              </div>
            </SettingsRow>
            {avatarError && (
              <p className="px-1 text-[11.5px] text-red-300">{avatarError}</p>
            )}
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
              <PhoneField value={accountPhone} onChange={setAccountPhone} />
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
                  className="rounded-full border border-cart-line bg-cart-bg px-4 py-1.5 text-[12.5px] font-semibold text-cart-ink transition hover:border-cart-line-strong disabled:opacity-60"
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
