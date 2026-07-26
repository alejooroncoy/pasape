"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import { useUpdateProfile } from "@/lib/identity/hooks/useUpdateProfile";
import { PageShell, BackLink, PageTitle } from "../_components/PageShell";
import { PhoneField } from "@/components/design/PhoneField";

const initialsOf = (name: string | null | undefined) => {
  if (!name) return "·";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
};

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  mono = false,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  mono?: boolean;
  inputMode?: "text" | "email" | "numeric" | "tel";
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-medium text-cart-ink-3">{label}</span>
      <input
        type={type}
        value={value}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={
          "w-full rounded-2xl border border-cart-line bg-cart-bg-elev px-4 py-3 text-[15px] text-cart-ink outline-none transition placeholder:text-cart-ink-4 focus:border-cart-accent/60 " +
          (mono ? "font-mono tracking-[0.02em]" : "")
        }
      />
    </label>
  );
}

export default function BuyerProfileEditPage() {
  const { data, isLoading } = useCurrentUser();
  const router = useRouter();
  const mutation = useUpdateProfile();

  const [fullNameDraft, setFullNameDraft] = useState<string | null>(null);
  const [emailDraft, setEmailDraft] = useState<string | null>(null);
  const [phoneDraft, setPhoneDraft] = useState<string | null>(null);
  const [dni, setDni] = useState("");
  const fullName = fullNameDraft ?? data?.user?.fullName ?? "";
  const email = emailDraft ?? data?.user?.email ?? "";
  const phone = phoneDraft ?? data?.user?.phone ?? "";
  const avatarUrl = data?.user?.avatarUrl ?? null;

  const onSave = async () => {
    try {
      await mutation.mutateAsync({
        fullName: fullName.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        dni: dni.trim() || null,
      });
      router.back();
    } catch {
      // mutation.error rendered below
    }
  };

  return (
    <PageShell>
      <BackLink />
      <PageTitle title="Editar perfil" />

      {/* Avatar */}
      <div className="flex justify-center py-5">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={fullName || "Tu perfil"}
            referrerPolicy="no-referrer"
            className="size-24 rounded-[28px] object-cover"
            style={{ boxShadow: "0 0 0 3px var(--color-cart-line-strong), 0 20px 50px -10px rgba(124,58,237,0.5)" }}
          />
        ) : (
          /* Mismo avatar que en /profile: morado plano, sin degradado ni glow. */
          <div className="grid size-24 place-items-center rounded-[28px] bg-cart-accent text-[36px] font-extrabold tracking-[-0.02em] text-white">
            {initialsOf(fullName || data?.user?.fullName)}
          </div>
        )}
      </div>

      {isLoading ? (
        <p className="py-6 text-center text-[13.5px] text-cart-ink-3">Cargando…</p>
      ) : (
        <div className="flex flex-col gap-3.5">
          <Field label="Nombre completo" value={fullName} onChange={setFullNameDraft} placeholder="Juan Pérez García" />
          <Field label="Email" value={email} onChange={setEmailDraft} placeholder="juan@gmail.com" type="email" inputMode="email" />
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium text-cart-ink-3">WhatsApp</span>
            <PhoneField value={phone} onChange={setPhoneDraft} />
          </label>
          <Field label="DNI" value={dni} onChange={setDni} placeholder="71234567" mono inputMode="numeric" />

          {mutation.error && (
            <p className="text-[12.5px] text-red-600">{(mutation.error as Error).message}</p>
          )}

          <button
            type="button"
            onClick={onSave}
            disabled={mutation.isPending}
            className="mt-2 w-full rounded-full bg-cart-accent py-3.5 text-[15px] font-semibold text-white shadow-[0_10px_30px_-10px_var(--color-cart-accent-glow-strong)] transition active:scale-[0.98] disabled:opacity-60"
          >
            {mutation.isPending ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      )}
    </PageShell>
  );
}
