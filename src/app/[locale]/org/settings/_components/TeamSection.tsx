"use client";

import { useState } from "react";
import { SettingsCard } from "./SettingsCard";
import { InviteSheet } from "./InviteSheet";
import { useOrgInvites } from "@/lib/identity/organizations/hooks/useOrgInvites";
import { useRevokeInvite } from "@/lib/identity/organizations/hooks/useRevokeInvite";
import type { OrgRole } from "@/server/identity/organizations/domain/Organization";
import type { OrgInviteStatus } from "@/server/identity/organizations/domain/Invite";

const ROLE_LABEL: Record<OrgRole, string> = {
  owner: "Propietario",
  admin: "Administrador",
  editor: "Editor",
  reporter: "Solo lectura",
  door: "Puerta",
};

const STATUS_LABEL: Record<OrgInviteStatus, string> = {
  pending: "Pendiente",
  accepted: "Aceptado",
  expired: "Expirado",
  revoked: "Revocado",
};

const initialOf = (s: string | null | undefined) =>
  (s ?? "?").trim().slice(0, 1).toUpperCase();

type Props = {
  currentProfileId: string | undefined;
};

export function TeamSection({ currentProfileId }: Props) {
  const [open, setOpen] = useState(false);
  const invitesQuery = useOrgInvites();
  const revoke = useRevokeInvite();

  const members = invitesQuery.data?.members ?? [];
  const allInvites = invitesQuery.data?.invites ?? [];
  // Only show pending invites — accepted ones already appear as members.
  const pendingInvites = allInvites.filter((i) => i.status === "pending");

  return (
    <>
      <SettingsCard
        id="equipo"
        title="Equipo"
        description="Invita a personas de confianza a co-gestionar tu marca."
        action={
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-full bg-cart-accent px-3.5 py-1.5 text-[12.5px] font-semibold text-black transition hover:brightness-110"
          >
            + Invitar a alguien
          </button>
        }
      >
        <div className="overflow-hidden rounded-xl border border-cart-line">
          <div className="hidden items-center gap-3 border-b border-cart-line bg-cart-bg-elev-2 px-4 py-3 text-[11.5px] font-semibold uppercase tracking-wide text-cart-ink-3 sm:flex">
            <span className="flex-1">Miembro</span>
            <span className="w-32">Rol</span>
            <span className="w-24 text-right">Estado</span>
          </div>

          <ul className="divide-y divide-cart-line">
            {invitesQuery.isLoading && members.length === 0 ? (
              <li className="px-4 py-4 text-[13px] text-cart-ink-3">Cargando equipo…</li>
            ) : null}

            {members.map((m) => {
              const isMe = m.profileId === currentProfileId;
              const display = m.fullName ?? m.email ?? "Miembro";
              return (
                <li
                  key={m.profileId}
                  className="flex items-center gap-3 px-4 py-3.5"
                >
                  <div className="grid size-10 flex-shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#7C3AED] to-[#b87cff] text-[13px] font-semibold text-white">
                    {m.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.avatarUrl}
                        alt=""
                        className="size-full rounded-full object-cover"
                      />
                    ) : (
                      initialOf(display)
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[13.5px] font-medium text-white">
                        {display}
                      </span>
                      {isMe ? (
                        <span className="rounded-full bg-cart-accent/15 px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-cart-accent">
                          Tú
                        </span>
                      ) : null}
                    </div>
                    <div className="truncate text-[12px] text-cart-ink-3">
                      {m.email ?? "—"}
                    </div>
                  </div>
                  <span className="hidden w-32 text-[13px] text-cart-ink-2 sm:inline">
                    {ROLE_LABEL[m.role]}
                  </span>
                  <span className="text-[12px] font-medium text-emerald-400 sm:w-24 sm:text-right">
                    <span className="inline-flex items-center gap-1.5">
                      <span aria-hidden className="size-1.5 rounded-full bg-emerald-400" />
                      Activo
                    </span>
                  </span>
                </li>
              );
            })}

            {pendingInvites.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center gap-3 px-4 py-3.5"
              >
                <div className="grid size-10 flex-shrink-0 place-items-center rounded-full border border-dashed border-cart-line text-cart-ink-3">
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                    <path
                      d="M3 6l7 5 7-5M3 6v8h14V6M3 6l7-3 7 3"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-medium text-white">
                    {inv.email ?? "Invitación por link"}
                  </div>
                  <div className="truncate text-[12px] text-cart-ink-3">
                    Caduca el {new Date(inv.expiresAt).toLocaleDateString("es-PE")}
                  </div>
                </div>
                <span className="hidden w-32 text-[13px] text-cart-ink-2 sm:inline">
                  {ROLE_LABEL[inv.role]}
                </span>
                <div className="flex items-center gap-2 sm:w-24 sm:justify-end">
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                    {STATUS_LABEL[inv.status]}
                  </span>
                  <button
                    type="button"
                    onClick={() => revoke.mutate(inv.id)}
                    disabled={revoke.isPending}
                    className="text-[12px] font-medium text-rose-300 transition hover:text-rose-200 disabled:opacity-50"
                  >
                    Revocar
                  </button>
                </div>
              </li>
            ))}

            {!invitesQuery.isLoading &&
            members.length === 0 &&
            pendingInvites.length === 0 ? (
              <li className="px-4 py-5 text-center text-[13px] text-cart-ink-3">
                Aún no hay miembros. Invita a una persona de confianza para empezar.
              </li>
            ) : null}
          </ul>
        </div>

        <p className="text-[12px] text-cart-ink-3">
          Cada persona acepta el link iniciando sesión con Google. Puedes revocar invitaciones pendientes cuando quieras.
        </p>
      </SettingsCard>

      <InviteSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
