"use client";

import { useState } from "react";
import { useAddGuest } from "@/lib/promoters/hooks/usePromoter";

// Formulario de alta de invitado, compartido entre la sección de Inicio y la
// pantalla completa de Lista de invitados. Emite una cortesía atribuida al link
// del promotor del evento `slug`; el QR sale solo por WhatsApp/correo.
export function AddGuestForm({ slug, onAdded }: { slug: string; onAdded?: () => void }) {
  const add = useAddGuest(slug);
  const [name, setName] = useState("");
  const [dni, setDni] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    name.trim().length >= 2 && dni.trim().length === 8 && (phone.trim().length >= 6 || email.includes("@"));

  const submit = async () => {
    setError(null);
    try {
      await add.mutateAsync({
        name: name.trim(),
        dni: dni.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
      });
      setName("");
      setDni("");
      setPhone("");
      setEmail("");
      onAdded?.();
    } catch (e) {
      setError(messageFor((e as Error).message));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <FieldText label="Nombre" value={name} onChange={setName} placeholder="Nombre y apellido" />
      <FieldText
        label="DNI"
        value={dni}
        onChange={(v) => setDni(v.replace(/\D/g, "").slice(0, 8))}
        placeholder="8 dígitos"
        mono
        inputMode="numeric"
      />
      <div>
        <Label>WhatsApp</Label>
        <div className="flex h-12 items-center gap-2 rounded-2xl border border-cart-line bg-cart-bg-elev px-3 focus-within:border-cart-accent">
          <span className="flex items-center gap-1.5 border-r border-cart-line pr-2.5 text-[13.5px] text-cart-ink-2">
            🇵🇪 +51
          </span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            placeholder="987 654 321"
            className="w-full bg-transparent font-mono text-[14px] tracking-[0.04em] text-white outline-none placeholder:text-cart-ink-4"
          />
        </div>
      </div>
      <FieldText label="Correo (opcional)" value={email} onChange={setEmail} placeholder="correo@ejemplo.com" type="email" />

      {error && <div className="text-[12.5px] text-red-400">{error}</div>}

      <button
        type="button"
        disabled={!canSubmit || add.isPending}
        onClick={submit}
        className="relative flex h-12 items-center justify-center rounded-full bg-cart-accent text-[14px] font-semibold text-[#1a0a2e] shadow-[0_14px_30px_-12px_var(--color-cart-accent-glow)] transition enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {add.isPending ? "Enviando…" : "Enviar entrada"}
      </button>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-cart-ink-3">{children}</div>;
}

function FieldText({
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
  inputMode?: "numeric" | "text" | "email";
}) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        value={value}
        type={type}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={
          "h-12 w-full rounded-2xl border border-cart-line bg-cart-bg-elev px-4 text-[14px] text-white outline-none transition placeholder:text-cart-ink-4 focus:border-cart-accent " +
          (mono ? "font-mono tracking-[0.04em]" : "")
        }
      />
    </div>
  );
}

export function messageFor(code: string): string {
  switch (code) {
    case "guest_contact_required":
      return "Pon un WhatsApp o un correo para enviar la entrada.";
    case "name_required":
      return "Falta el nombre del invitado.";
    case "not_a_promoter":
      return "No eres promotor de este evento.";
    case "event_sales_closed":
    case "event_not_published":
      return "El evento ya no admite invitados.";
    case "guest_list_not_enabled":
      return "El organizador aún no activó la lista de invitados para este evento.";
    case "guest_list_full":
      return "Se llenó el cupo de invitados de este evento.";
    case "guest_list_promoter_full":
      return "Llegaste a tu cupo de invitados para este evento.";
    default:
      return "No se pudo enviar la entrada. Intenta de nuevo.";
  }
}
