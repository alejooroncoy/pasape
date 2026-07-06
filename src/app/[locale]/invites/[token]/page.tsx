"use client";

import { use, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useRouter } from "@/i18n/navigation";
import { api } from "@/lib/_shared/api-client";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import { useGoogleSignIn } from "@/lib/identity/hooks/useFirebaseAuth";
import { useAcceptInvite } from "@/lib/identity/organizations/hooks/useAcceptInvite";
import type { OrgInvitePreview } from "@/server/identity/organizations/domain/Invite";

type Props = {
  params: Promise<{ token: string; locale: string }>;
};

const ROLE_LABEL: Record<string, string> = {
  owner: "Propietario",
  admin: "Administrador",
  editor: "Editor",
  reporter: "Solo lectura",
  door: "Puerta",
};

const INVITE_ACCEPT_ERRORS: Record<string, string> = {
  invite_wrong_account:
    "Esta invitación es para otra cuenta. Entrá con Google usando el correo al que te invitaron.",
  invite_sign_in_with_email:
    "Entrá con Google usando el correo al que te invitaron.",
  invite_email_required:
    "Esta invitación ya no es válida. Pedile a quien te invitó que te mande una nueva por correo.",
  invite_role_deprecated:
    "Las invitaciones de portero ya no usan este link. Pedile el link de Portero del evento.",
};

const ROLE_PERKS: Record<string, string[]> = {
  admin: [
    "Crear y editar eventos de la marca",
    "Ver ventas, reportes y pagos",
    "Invitar a más personas al equipo",
  ],
  editor: [
    "Crear y editar eventos",
    "Gestionar promotores e incentivos",
    "Sin acceso a pagos ni al equipo",
  ],
  reporter: [
    "Ver reportes y métricas",
    "Descargar listas de ventas",
    "Sin permisos de edición",
  ],
  door: [
    "Escanea tickets en puerta",
    "Ver invitados del evento",
    "Sin acceso a configuración",
  ],
  owner: [
    "Acceso total a la marca",
    "Gestionar pagos y facturación",
    "Eliminar o transferir la marca",
  ],
};

const STATUS_COPY: Record<string, { title: string; body: string }> = {
  accepted: {
    title: "Esta invitación ya fue aceptada",
    body: "Si ya te uniste, abre el panel de organizador. Si crees que es un error, pide un nuevo link.",
  },
  expired: {
    title: "Esta invitación expiró",
    body: "Los links de invitación duran 14 días. Pide a quien te invitó que genere uno nuevo.",
  },
  revoked: {
    title: "Esta invitación fue revocada",
    body: "Quien te invitó canceló el link. Coordínalo directamente con esa persona.",
  },
};

export default function AcceptInvitePage({ params }: Props) {
  const { token } = use(params);
  const router = useRouter();
  const me = useCurrentUser();
  const accept = useAcceptInvite(token);
  const { signIn, pending: signingIn } = useGoogleSignIn();

  const preview = useQuery({
    queryKey: ["invite-preview", token],
    queryFn: () => api.get<OrgInvitePreview>(`/api/invites/${token}`),
    retry: false,
  });

  const [acceptError, setAcceptError] = useState<string | null>(null);

  // Auto-accept once the user is signed in, the preview is loaded, and
  // it's still pending. This makes the post-sign-in flow feel seamless.
  const isAuthed = !!me.data?.user;
  const isPending = preview.data?.status === "pending";
  useEffect(() => {
    if (!isAuthed || !isPending || accept.isPending || accept.isSuccess) return;
    accept
      .mutateAsync()
      .then((res) => {
        router.replace(`/org?org=${res.org.slug}`);
      })
      .catch((e) => {
        setAcceptError(e instanceof Error ? e.message : "accept_failed");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed, isPending]);

  return (
    <div className="min-h-svh bg-cart-bg text-white">
      <div className="mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center px-5 py-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="w-full rounded-3xl border border-cart-line bg-cart-bg-elev p-6 shadow-xl"
        >
          {preview.isLoading ? (
            <div className="py-10 text-center text-[14px] text-cart-ink-3">
              Cargando invitación…
            </div>
          ) : preview.isError || !preview.data ? (
            <NotFoundState />
          ) : (
            <>
              <div className="flex flex-col items-center text-center">
                <div className="mb-4 grid size-16 place-items-center overflow-hidden rounded-2xl border border-cart-line bg-cart-bg-elev-2">
                  <span className="text-[24px] font-semibold text-cart-ink-2">
                    {preview.data.scopeLabel.slice(0, 1).toUpperCase()}
                  </span>
                </div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cart-ink-3">
                  Te invitaron a
                </div>
                <h1 className="mt-1 font-sans text-[28px] font-bold tracking-[-0.025em] text-white">
                  {preview.data.scopeLabel}
                </h1>
                <p className="mt-2 max-w-xs text-[14px] leading-snug text-cart-ink-2">
                  {preview.data.invitedBy.fullName ?? "Tu invitador"} quiere que te sumes como{" "}
                  <span className="font-medium text-white">
                    {ROLE_LABEL[preview.data.role] ?? preview.data.role}
                  </span>
                  .
                </p>
              </div>

                {preview.data.inviteEmail ? (
                  <p className="mt-4 text-center text-[12.5px] leading-snug text-cart-ink-3">
                    Entrá con Google como{" "}
                    <span className="font-medium text-white">{preview.data.inviteEmail}</span>
                  </p>
                ) : null}

              {preview.data.status === "pending" ? (
                <>
                  <ul className="mt-6 space-y-2.5 rounded-2xl border border-cart-line bg-cart-bg-elev-2 p-4">
                    {(ROLE_PERKS[preview.data.role] ?? []).map((perk) => (
                      <li
                        key={perk}
                        className="flex items-start gap-2.5 text-[13px] text-cart-ink-2"
                      >
                        <span
                          aria-hidden
                          className="mt-1.5 size-1.5 shrink-0 rounded-full bg-cart-accent"
                        />
                        <span>{perk}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-6 flex flex-col gap-2">
                    {!isAuthed ? (
                      <button
                        type="button"
                        onClick={signIn}
                        disabled={signingIn}
                        className="w-full rounded-full bg-cart-accent px-4 py-3 text-[14px] font-semibold text-black transition hover:brightness-110 disabled:opacity-60"
                      >
                        {signingIn ? "Iniciando…" : "Aceptar con Google"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setAcceptError(null);
                          accept
                            .mutateAsync()
                            .then((res) => router.replace(`/org?org=${res.org.slug}`))
                            .catch((e) =>
                              setAcceptError(e instanceof Error ? e.message : "accept_failed"),
                            );
                        }}
                        disabled={accept.isPending}
                        className="w-full rounded-full bg-cart-accent px-4 py-3 text-[14px] font-semibold text-black transition hover:brightness-110 disabled:opacity-60"
                      >
                        {accept.isPending ? "Uniéndote…" : "Aceptar invitación"}
                      </button>
                    )}
                    <p className="text-center text-[11.5px] leading-snug text-cart-ink-3">
                      Caduca el{" "}
                      {new Date(preview.data.expiresAt).toLocaleDateString("es-PE", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                      .
                    </p>
                    {acceptError ? (
                      <div className="mt-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-center text-[12.5px] text-rose-200">
                        {INVITE_ACCEPT_ERRORS[acceptError] ??
                          "No pudimos aceptar la invitación. Intenta nuevamente."}
                      </div>
                    ) : null}
                  </div>
                </>
              ) : (
                <ExpiredState status={preview.data.status} />
              )}
            </>
          )}
        </motion.div>

        <p className="mt-6 text-center text-[11.5px] text-cart-ink-3">
          Pasape — Lima
        </p>
      </div>
    </div>
  );
}

function NotFoundState() {
  return (
    <div className="py-6 text-center">
      <h2 className="text-[17px] font-semibold text-white">Invitación no encontrada</h2>
      <p className="mt-2 text-[13.5px] text-cart-ink-3">
        El link no es válido o fue eliminado. Pide a quien te invitó que genere uno nuevo.
      </p>
    </div>
  );
}

function ExpiredState({ status }: { status: string }) {
  const copy = STATUS_COPY[status] ?? {
    title: "No puedes usar esta invitación",
    body: "Pide un nuevo link a quien te invitó.",
  };
  return (
    <div className="mt-6 rounded-2xl border border-cart-line bg-cart-bg-elev-2 p-4 text-center">
      <h2 className="text-[15px] font-semibold text-white">{copy.title}</h2>
      <p className="mt-1.5 text-[13px] leading-snug text-cart-ink-3">{copy.body}</p>
    </div>
  );
}
