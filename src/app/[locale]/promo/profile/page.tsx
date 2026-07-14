"use client";

import { useMemo, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import { useSignOut } from "@/lib/identity/hooks/useFirebaseAuth";
import { useMyPromoterLinks } from "@/lib/promoters/hooks/usePromoter";
import { PromoterShell } from "../_shell/PromoterShell";

export default function PromoProfilePage() {
  const me = useCurrentUser();
  const links = useMyPromoterLinks();
  const router = useRouter();
  const signOut = useSignOut();
  const [signingOut, setSigningOut] = useState(false);

  const user = me.data?.user ?? null;
  const firstName = user?.fullName?.split(" ")[0] ?? "Promotor";
  const initial = (user?.fullName?.[0] ?? "P").toUpperCase();

  // Agrupa los links por evento. (Una org puede aparecer múltiples veces si tiene
  // varios eventos asignados al promotor — los listamos por evento, no por org.)
  const eventsList = useMemo(() => {
    return (links.data ?? []).map((l) => ({
      id: l.id,
      title: l.eventTitle,
      startsAt: l.eventStartsAt,
      venue: l.eventVenue,
      commissionPct: l.commissionPct,
      code: l.code,
    }));
  }, [links.data]);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
      router.push("/org/login" as never);
    } catch {
      setSigningOut(false);
    }
  };

  return (
    <PromoterShell active="profile">
      <header className="mb-6 lg:mb-8">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">
          Perfil
        </div>
        <h1 className="mt-1 font-sans text-[28px] font-semibold leading-tight tracking-[-0.025em] lg:text-[36px]">
          {firstName}
        </h1>
      </header>

      {/* Datos personales */}
      <section
        className="mb-5 overflow-hidden rounded-2xl border border-cart-line bg-cart-bg-elev"
        aria-label="Datos personales"
      >
        <div className="flex items-center gap-4 p-4 lg:p-5">
          {user?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt=""
              className="size-14 shrink-0 rounded-full object-cover lg:size-16"
            />
          ) : (
            <span
              className="grid size-14 shrink-0 place-items-center rounded-full text-[20px] font-semibold lg:size-16 lg:text-[24px]"
              style={{
                background: "linear-gradient(135deg, #4B1F9A 0%, #7C3AED 100%)",
              }}
            >
              {initial}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[16px] font-semibold tracking-[-0.01em] lg:text-[18px]">
              {user?.fullName ?? "—"}
            </div>
            <div className="mt-0.5 truncate text-[12.5px] text-cart-ink-3">
              {user?.email ?? "—"}
            </div>
          </div>
        </div>
        <div className="divide-y divide-cart-line border-t border-cart-line">
          <ProfileRow label="WhatsApp" value={user?.phone ?? "—"} mono />
          <ProfileRow
            label="Rol"
            value="Promotor"
            extra={
              <span className="rounded-full bg-cart-accent-soft px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-cart-accent">
                Activo
              </span>
            }
          />
        </div>
      </section>

      {/* Eventos en los que vende */}
      <section className="mb-5">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">
            Vendiendo para
          </h2>
          {eventsList.length > 0 && (
            <span className="font-mono text-[11px] text-cart-ink-4">
              {eventsList.length} {eventsList.length === 1 ? "evento" : "eventos"}
            </span>
          )}
        </div>

        {links.isLoading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-2xl border border-cart-line bg-cart-bg-elev/50"
              />
            ))}
          </div>
        ) : eventsList.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-cart-line bg-cart-bg-elev px-4 py-6 text-center text-[12.5px] text-cart-ink-3">
            Aún no tienes eventos asignados.
          </div>
        ) : (
          <ul className="space-y-2">
            {eventsList.map((e) => (
              <li
                key={e.id}
                className="flex items-center gap-3 rounded-2xl border border-cart-line bg-cart-bg-elev px-4 py-3"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cart-accent-soft font-sans text-[14px] font-semibold text-cart-accent">
                  {(e.title[0] ?? "?").toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold tracking-[-0.01em]">
                    {e.title}
                  </div>
                  <div className="truncate text-[11.5px] text-cart-ink-3">
                    /r/{e.code}
                    {e.venue && (
                      <>
                        {" "}
                        <span className="text-cart-ink-4">·</span> {e.venue}
                      </>
                    )}
                  </div>
                </div>
                <span className="rounded-full bg-cart-bg-elev-2 px-2 py-0.5 font-mono text-[11px] font-semibold text-cart-ink-2">
                  {e.commissionPct}%
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Sesión */}
      <section className="rounded-2xl border border-cart-line bg-cart-bg-elev">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between lg:p-5">
          <div className="min-w-0">
            <div className="text-[14px] font-semibold">Cerrar sesión</div>
            <p className="mt-0.5 text-[12px] text-cart-ink-3">
              Tu link sigue funcionando para los compradores incluso si cerrás sesión.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="self-start rounded-full border border-red-500/40 bg-red-500/10 px-4 py-2 text-[12.5px] font-semibold text-red-600 transition hover:bg-red-500/20 disabled:opacity-60 sm:self-auto"
          >
            {signingOut ? "Cerrando…" : "Cerrar sesión"}
          </button>
        </div>
      </section>
    </PromoterShell>
  );
}

function ProfileRow({
  label,
  value,
  mono,
  extra,
}: {
  label: string;
  value: string;
  mono?: boolean;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-5">
      <span className="text-[12.5px] text-cart-ink-3">{label}</span>
      <span className="flex items-center gap-2">
        <span
          className={
            "text-right text-[13.5px] font-medium text-cart-ink " + (mono ? "font-mono" : "")
          }
        >
          {value}
        </span>
        {extra}
      </span>
    </div>
  );
}
