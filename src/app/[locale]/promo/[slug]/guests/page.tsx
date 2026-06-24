"use client";

import { use } from "react";
import { PromoterShell } from "../../_shell/PromoterShell";
import { AddGuestForm } from "../../_components/AddGuestForm";
import { GuestList } from "../../_components/GuestList";
import { usePromoterGuests, usePromoterHome } from "@/lib/promoters/hooks/usePromoter";

type Props = { params: Promise<{ slug: string }> };

export default function PromoGuestsPage({ params }: Props) {
  const { slug } = use(params);
  const guests = usePromoterGuests(slug);
  const home = usePromoterHome(slug);

  const list = guests.data ?? [];
  const entered = list.filter((g) => g.status === "used").length;

  const quota = home.data?.guestListQuota ?? null;
  const used = home.data?.guestListUsed ?? 0;
  const remaining = home.data?.guestListRemaining ?? null;
  const noTope = quota == null;
  const full = remaining != null && remaining <= 0;

  return (
    <PromoterShell active="home">
      <header className="mb-6 lg:mb-8">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">
          Lista de invitados
        </div>
        <h1 className="mt-1 font-sans text-[28px] font-semibold leading-tight tracking-[-0.025em] lg:text-[36px]">
          Invita a tu gente
        </h1>
        <p className="mt-1.5 text-[13px] text-cart-ink-3 lg:text-[14px]">
          {list.length > 0 ? (
            <>
              <b className="text-white">{list.length}</b> invitados ·{" "}
              <b className="text-white">{entered}</b> entraron
            </>
          ) : (
            "Agrega a alguien y le llega su entrada por WhatsApp o correo."
          )}
        </p>
      </header>

      {/* Cupo asignado por el organizador. */}
      {home.data?.guestListEnabled && (
        <div className="mb-5 flex items-center justify-between rounded-2xl border border-cart-line bg-cart-bg-elev px-4 py-3">
          <span className="text-[13px] text-cart-ink-2">
            {noTope ? "Invitaciones sin tope" : `Te quedan ${remaining} de ${quota}`}
          </span>
          {!noTope && (
            <span
              className={
                "rounded-full px-2.5 py-0.5 text-[12px] font-semibold " +
                (full ? "bg-rose-500/12 text-rose-300" : "bg-cart-accent-soft text-cart-accent")
              }
            >
              {used}/{quota}
            </span>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:items-start">
        <section className="rounded-3xl border border-cart-line-strong bg-cart-bg-elev/60 p-5">
          {full ? (
            <p className="text-center text-[13px] font-medium text-cart-ink-3">
              Llegaste a tu cupo de invitados ({used}/{quota}).
            </p>
          ) : (
            <AddGuestForm slug={slug} />
          )}
        </section>

        <GuestList guests={list} loading={guests.isLoading} withControls />
      </div>
    </PromoterShell>
  );
}
