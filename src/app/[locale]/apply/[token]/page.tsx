"use client";

import { use, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { PhoneField } from "@/components/design/PhoneField";
import { useApplyByLink, useResolveInvite } from "@/lib/promoters/hooks/usePromoter";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import type { CommissionConfig } from "@/server/promoters/domain/OrgPromoter";

// Pitch de comisión según el esquema REAL del evento (heredado). Dos ejes: % por
// venta + metas, pueden coexistir. Si no hay nada definido, avisamos.
function commissionPitch(pct: number, config: CommissionConfig): string {
  const hasMetas = !!config && config.milestones.length > 0;
  if (pct > 0 && hasMetas) return `Gana ${pct}% por venta y premios al llegar a tus metas.`;
  if (pct > 0) return `Gana ${pct}% por cada entrada que vendas.`;
  if (hasMetas) return "Gana premios al llegar a tus metas de venta.";
  return "El organizador definirá la comisión muy pronto.";
}

type Props = { params: Promise<{ token: string }> };

export default function PromoApplyByLinkPage({ params }: Props) {
  const { token } = use(params);
  const resolved = useResolveInvite(token);
  const apply = useApplyByLink();
  const me = useCurrentUser();
  const router = useRouter();
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [phoneDraft, setPhoneDraft] = useState<string | null>(null);
  const name = nameDraft ?? me.data?.user?.fullName ?? "";
  // PhoneField trabaja en E.164; el teléfono de la cuenta ya viene en ese formato.
  const phone = phoneDraft ?? me.data?.user?.phone ?? "";

  const onApply = async () => {
    if (!resolved.data) return;
    await apply.mutateAsync({
      token,
      message: phone ? `WhatsApp: ${phone}` : null,
      fullName: name.trim() || null,
    });
    router.push(`/apply/${token}/waiting` as never);
  };

  if (resolved.isLoading) {
    return (
      <Shell>
        <p className="px-1 py-8 text-[14px] text-cart-ink-3">Cargando invitación…</p>
      </Shell>
    );
  }

  if (resolved.error || !resolved.data) {
    return (
      <Shell>
        <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
          <div className="grid size-14 place-items-center rounded-full bg-rose-500/15 text-rose-300">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M12 8v5M12 16.5v.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </div>
          <h1 className="mt-4 text-[20px] font-bold tracking-[-0.02em]">Invitación no válida</h1>
          <p className="mt-2 max-w-[280px] text-[13.5px] leading-relaxed text-cart-ink-3">
            Este link ya no está activo o es incorrecto. Pídele al organizador que te comparta uno nuevo.
          </p>
        </div>
      </Shell>
    );
  }

  const invite = resolved.data;

  return (
    <div className="min-h-dvh bg-cart-bg text-white lg:grid lg:place-items-center lg:p-8">
      <div className="flex min-h-dvh w-full flex-col lg:min-h-0 lg:max-w-[960px] lg:flex-row lg:overflow-hidden lg:rounded-3xl lg:border lg:border-cart-line lg:shadow-[0_40px_120px_-30px_rgba(0,0,0,0.85)]">
        {/* ── Pitch: cover arriba en mobile, panel izquierdo en desktop ── */}
        <section className="relative shrink-0 overflow-hidden lg:flex lg:w-[45%] lg:flex-col lg:justify-center lg:p-12">
          {/* Desktop: el gradiente cubre todo el panel */}
          <div aria-hidden className="absolute inset-0 hidden lg:block">
            <div className="absolute inset-0 bg-gradient-to-br from-cart-bg-purple via-cart-accent-2/40 to-cart-bg-purple" />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(60% 55% at 28% 30%, rgba(184,124,255,0.4), transparent 60%), radial-gradient(55% 55% at 82% 88%, rgba(0,0,0,0.45), transparent 60%)",
              }}
            />
          </div>

          {/* Mobile: banda superior con altura real (para el -mt-16 del contenido) */}
          <div className="relative h-[190px] overflow-hidden sm:h-[210px] lg:hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-cart-bg-purple via-cart-accent-2/50 to-cart-bg" />
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(60% 55% at 28% 30%, rgba(184,124,255,0.4), transparent 60%), radial-gradient(55% 50% at 82% 85%, rgba(0,0,0,0.5), transparent 60%)",
              }}
            />
            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-b from-transparent to-cart-bg" />
          </div>

          <div className="relative z-[1] -mt-16 px-5 lg:mt-0 lg:px-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-cart-accent">
              ★ Te invitan a ser promotor
            </p>
            <h1 className="mt-2.5 text-[26px] font-bold leading-[1.05] tracking-[-0.03em] sm:text-[28px] lg:text-[34px]">
              Vende para <span className="text-cart-accent">{invite.orgName}</span>
            </h1>
            <p className="mt-2 text-[14.5px] leading-snug text-cart-ink-2 lg:text-[15px]">
              {commissionPitch(invite.commissionPct, invite.commissionConfig)}
            </p>
            <p className="mt-1.5 text-[13px] text-cart-ink-3">{invite.eventTitle}</p>

            <div className="mt-5 flex items-center gap-3 rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 lg:bg-black/25">
              <span className="size-2.5 shrink-0 rounded-full bg-amber-400 shadow-[0_0_10px_var(--color-warning)]" />
              <p className="text-[12.5px] leading-snug text-white/85">
                El organizador revisa tu solicitud y te avisa por WhatsApp.
              </p>
            </div>
          </div>
        </section>

        {/* ── Formulario: abajo en mobile, panel derecho en desktop ── */}
        <section className="flex flex-1 flex-col lg:w-[55%] lg:justify-center lg:bg-cart-bg-elev/30">
          <div className="px-5 pb-32 pt-6 lg:px-12 lg:py-12">
            <h2 className="hidden text-[16px] font-semibold lg:block">Completa tus datos</h2>
            <p className="mb-5 hidden text-[13px] text-cart-ink-3 lg:block">Toma 30 segundos.</p>

            <div className="space-y-4">
              <Field label="Tu nombre" value={name} onChange={setNameDraft} placeholder="Juan Pérez" />
              <label className="block">
                <span className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-cart-ink-3">
                  WhatsApp
                </span>
                <div className="mt-1.5">
                  <PhoneField value={phone} onChange={setPhoneDraft} />
                </div>
                <span className="mt-1.5 block text-[11.5px] text-cart-ink-4">
                  Por aquí te avisan si te aprueban.
                </span>
              </label>
            </div>

            {apply.error && (
              <p className="mt-3 text-[12.5px] text-rose-300">{(apply.error as Error).message}</p>
            )}

            {/* CTA desktop (inline dentro del panel) */}
            <button
              type="button"
              onClick={onApply}
              disabled={apply.isPending || !name.trim()}
              className="mt-7 hidden w-full rounded-full bg-cart-accent py-3.5 text-[14.5px] font-semibold text-cart-bg shadow-[0_8px_24px_-6px_var(--color-cart-accent-glow)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-cart-bg-elev-2 disabled:text-cart-ink-3 disabled:shadow-none lg:block"
            >
              {apply.isPending ? "Enviando…" : "Quiero ser promotor"}
            </button>
          </div>

          {/* CTA mobile (fijo abajo) */}
          <div className="sticky bottom-0 z-[2] border-t border-cart-line bg-cart-bg/85 backdrop-blur-md lg:hidden">
            <div className="mx-auto w-full max-w-[440px] px-5 py-4">
              <button
                type="button"
                onClick={onApply}
                disabled={apply.isPending || !name.trim()}
                className="w-full rounded-full bg-cart-accent py-3.5 text-[14.5px] font-semibold text-cart-bg shadow-[0_8px_24px_-6px_var(--color-cart-accent-glow)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-cart-bg-elev-2 disabled:text-cart-ink-3 disabled:shadow-none"
              >
                {apply.isPending ? "Enviando…" : "Quiero ser promotor"}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-cart-bg text-white">
      <main className="mx-auto flex w-full max-w-[440px] flex-1 flex-col px-5">{children}</main>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-cart-ink-3">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1.5 block w-full rounded-2xl border border-cart-line bg-cart-bg-elev px-4 py-3.5 text-[15px] text-white outline-none transition focus:border-cart-accent focus:shadow-[0_0_0_3px_var(--color-cart-accent-soft)]"
      />
    </label>
  );
}
