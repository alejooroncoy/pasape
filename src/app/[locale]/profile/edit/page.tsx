"use client";

import { useState } from "react";
import { BackBtn, Btn, C, FONT_DISPLAY, Field, Phone } from "@/components/design";
import { useRouter } from "@/i18n/navigation";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import { useUpdateProfile } from "@/lib/identity/hooks/useUpdateProfile";

const initialsOf = (name: string | null | undefined) => {
  if (!name) return "·";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
};

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

  const initials = initialsOf(fullName || data?.user?.fullName);

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
    <Phone>
      <div
        style={{
          padding: "6px 22px 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <BackBtn />
        <div style={{ fontSize: 12, color: C.dim, letterSpacing: "0.06em" }}>EDITAR PERFIL</div>
        <div style={{ width: 38 }} />
      </div>

      <div style={{ padding: "14px 22px 140px" }}>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 6, marginBottom: 26 }}>
          <div style={{ position: "relative" }}>
            <div
              style={{
                width: 100,
                height: 100,
                borderRadius: 28,
                background: "linear-gradient(135deg, #FF4D5E, #7C3AED 60%, #4B1F9A)",
                boxShadow:
                  "0 0 0 3px rgba(255,255,255,0.08), 0 20px 50px -10px rgba(124,58,237,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: FONT_DISPLAY,
                fontWeight: 800,
                fontSize: 40,
                color: "#fff",
                letterSpacing: "-0.02em",
              }}
            >
              {initials || "·"}
            </div>
            <button
              type="button"
              style={{
                position: "absolute",
                bottom: -4,
                right: -4,
                width: 36,
                height: 36,
                borderRadius: 999,
                border: 0,
                background: C.purple,
                color: "#fff",
                boxShadow: `0 0 0 3px ${C.bg}, 0 8px 20px rgba(124,58,237,0.5)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16">
                <path d="M3 11l6-6 2 2-6 6H3v-2Z" fill="#fff" />
                <path d="M10 4l1-1 2 2-1 1" stroke="#fff" strokeWidth="1.4" />
              </svg>
            </button>
          </div>
        </div>

        {isLoading ? (
          <div style={{ color: C.dim, textAlign: "center" }}>Cargando…</div>
        ) : (
          <>
            <Field
              label="Nombre completo"
              value={fullName}
              onChange={(e) => setFullNameDraft(e.target.value)}
              placeholder="Juan Pérez García"
            />
            <Field
              label="Email"
              value={email}
              onChange={(e) => setEmailDraft(e.target.value)}
              placeholder="juan@gmail.com"
              type="email"
            />
            <Field
              label="WhatsApp"
              value={phone}
              onChange={(e) => setPhoneDraft(e.target.value)}
              placeholder="987 654 321"
              mono
            />
            <Field
              label="DNI"
              value={dni}
              onChange={(e) => setDni(e.target.value)}
              placeholder="71234567"
              mono
            />

            {mutation.error && (
              <div style={{ color: C.red, fontSize: 12, marginTop: 8 }}>
                {(mutation.error as Error).message}
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ position: "fixed", bottom: 24, left: 0, right: 0, padding: "0 22px", maxWidth: 390, margin: "0 auto" }}>
        <Btn onClick={onSave} disabled={mutation.isPending}>
          {mutation.isPending ? "Guardando…" : "Guardar cambios"}
        </Btn>
      </div>
    </Phone>
  );
}
