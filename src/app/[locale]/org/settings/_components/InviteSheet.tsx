"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useCreateInvite, type CreateInviteOutput } from "@/lib/identity/organizations/hooks/useCreateInvite";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import { useMyOrgs } from "@/lib/identity/organizations/hooks/useMyOrgs";
import { useLegalEntities } from "@/lib/identity/organizations/hooks/useLegalEntities";
import type { InvitableOrgRole, InviteScopeType } from "@/server/identity/organizations/domain/Invite";
import { isTeamInviteWhatsAppEnabled } from "@/lib/identity/organizations/teamInviteChannels";
import { PhoneField } from "@/components/design/PhoneField";

type Props = { open: boolean; onClose: () => void };
type Channel = "email" | "whatsapp";

const whatsappInvitesEnabled = isTeamInviteWhatsAppEnabled();

type RoleOption = { value: InvitableOrgRole; label: string; description: string };
const ROLES: RoleOption[] = [
  { value: "admin", label: "Administrador", description: "Acceso completo: eventos, ventas, equipo, pagos." },
  { value: "editor", label: "Editor", description: "Crea y edita eventos. No ve pagos ni equipo." },
  { value: "reporter", label: "Solo lectura", description: "Ve reportes y ventas. No edita nada." },
];

export function InviteSheet({ open, onClose }: Props) {
  const me = useCurrentUser();
  const orgs = useMyOrgs();
  const entities = useLegalEntities();

  const activeOrg = orgs.data?.find((o) => o.slug === me.data?.activeOrgSlug) ?? orgs.data?.[0];
  const activeEntity = entities.data?.find((e) => e.id === activeOrg?.legalEntityId);
  const portfolioOwnerId = me.data?.user?.id ?? null;

  const [channel, setChannel] = useState<Channel>("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<InvitableOrgRole>("admin");
  const [scopeType, setScopeType] = useState<InviteScopeType>("organization");
  const [created, setCreated] = useState<CreateInviteOutput | null>(null);
  const mutation = useCreateInvite();

  useEffect(() => {
    if (open) {
      setChannel("email");
      setEmail("");
      setPhone("");
      setRole("admin");
      setScopeType("organization");
      setCreated(null);
      mutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const scopeOptions = useMemo(
    () => [
      {
        value: "organization" as const,
        label: "Esta marca",
        description: activeOrg ? `Acceso solo a ${activeOrg.name}.` : "Solo esta marca.",
        ready: Boolean(activeOrg),
      },
      {
        value: "legal_entity" as const,
        label: "Toda esta razón social",
        description: activeEntity
          ? `Todas las marcas bajo ${activeEntity.name}.`
          : "Todas las marcas de esta razón social.",
        ready: Boolean(activeEntity),
      },
      {
        value: "portfolio" as const,
        label: "Todo mi portafolio",
        description: "Todas tus razones sociales y marcas. Ideal para socias o mano derecha.",
        ready: Boolean(portfolioOwnerId),
      },
    ],
    [activeOrg, activeEntity, portfolioOwnerId],
  );

  const resolveScopeId = (): string | null => {
    if (scopeType === "organization") return activeOrg?.id ?? null;
    if (scopeType === "legal_entity") return activeOrg?.legalEntityId ?? null;
    return portfolioOwnerId;
  };

  const canSubmit =
    Boolean(resolveScopeId()) &&
    (channel === "email" ? Boolean(email.trim()) : /^\+?\d{8,15}$/.test(phone.trim()));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mutation.isPending || !canSubmit) return;
    const scopeId = resolveScopeId();
    if (!scopeId) return;
    const result =
      channel === "email"
        ? await mutation.mutateAsync({
            channel: "email",
            email: email.trim(),
            role,
            scopeType,
            scopeId,
          })
        : await mutation.mutateAsync({
            channel: "whatsapp",
            phone: phone.trim(),
            role,
            scopeType,
            scopeId,
          });
    setCreated(result);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 app-scrim"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="invite-sheet-title"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[92svh] w-full overflow-y-auto rounded-t-3xl border border-cart-line bg-cart-bg-elev p-5 shadow-2xl sm:inset-x-0 sm:bottom-auto sm:top-1/2 sm:max-w-md sm:-translate-y-1/2 sm:rounded-3xl sm:p-6"
          >
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-cart-line sm:hidden" />

            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h3
                  id="invite-sheet-title"
                  className="text-[17px] font-semibold tracking-[-0.01em] text-white"
                >
                  {created ? (created.sent ? "Invitación enviada" : "Invitación creada") : "Invitar a tu equipo"}
                </h3>
                <p className="mt-1 text-[13px] leading-snug text-cart-ink-3">
                  {created
                    ? created.sent
                      ? created.channel === "email"
                        ? `Le mandamos el correo a ${created.destination}. Debe aceptar con esa cuenta Google. Caduca en 14 días.`
                        : `Le enviamos un WhatsApp a ${created.destination}. Caduca en 14 días.`
                      : `No pudimos enviar por ${created.channel === "email" ? "correo" : "WhatsApp"}. Intenta de nuevo más tarde.`
                    : whatsappInvitesEnabled
                      ? "Define el alcance y el rol. Porteros en puerta: link de Portero en el evento."
                      : "Solo por correo por ahora. Debe aceptar con Google usando ese email. Porteros: link de Portero en el evento."}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="grid size-8 shrink-0 place-items-center rounded-full border border-cart-line bg-cart-bg-elev-2 text-cart-ink-2 transition hover:text-white"
                aria-label="Cerrar"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {!created ? (
              <form onSubmit={onSubmit} className="space-y-5">
                {whatsappInvitesEnabled ? (
                  <>
                    <div>
                      <div className="mb-1.5 text-[12px] font-medium text-cart-ink-2">Enviar por</div>
                      <div className="grid grid-cols-2 gap-2 rounded-xl border border-cart-line bg-cart-bg-elev-2 p-1">
                        {(["email", "whatsapp"] as const).map((c) => {
                          const selected = channel === c;
                          return (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setChannel(c)}
                              className={`rounded-lg px-3 py-2 text-[13px] font-medium transition ${
                                selected
                                  ? "bg-cart-accent text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset]"
                                  : "text-cart-ink-2 hover:text-white"
                              }`}
                            >
                              {c === "email" ? "Correo" : "WhatsApp"}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {channel === "email" ? (
                      <label className="block">
                        <div className="mb-1.5 text-[12px] font-medium text-cart-ink-2">Correo del invitado</div>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="persona@ejemplo.com"
                          required
                          autoComplete="email"
                          className="block w-full rounded-xl border border-cart-line bg-cart-bg-elev-2 px-3.5 py-2.5 text-[14px] text-white placeholder:text-cart-ink-3 focus:border-cart-accent focus:outline-none"
                        />
                        <p className="mt-1.5 text-[11.5px] leading-snug text-cart-ink-3">
                          Debe aceptar con Google usando ese correo.
                        </p>
                      </label>
                    ) : (
                      <label className="block">
                        <div className="mb-1.5 text-[12px] font-medium text-cart-ink-2">WhatsApp del invitado</div>
                        <PhoneField value={phone} onChange={setPhone} />
                      </label>
                    )}
                  </>
                ) : (
                  <label className="block">
                    <div className="mb-1.5 text-[12px] font-medium text-cart-ink-2">Correo del invitado</div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="persona@ejemplo.com"
                      required
                      autoComplete="email"
                      className="block w-full rounded-xl border border-cart-line bg-cart-bg-elev-2 px-3.5 py-2.5 text-[14px] text-white placeholder:text-cart-ink-3 focus:border-cart-accent focus:outline-none"
                    />
                    <p className="mt-1.5 text-[11.5px] leading-snug text-cart-ink-3">
                      Solo podrá aceptar entrando con Google usando ese correo.
                    </p>
                  </label>
                )}

                <div>
                  <div className="mb-1.5 text-[12px] font-medium text-cart-ink-2">Acceso a</div>
                  <div className="space-y-2">
                    {scopeOptions.map((s) => {
                      const selected = scopeType === s.value;
                      return (
                        <button
                          type="button"
                          key={s.value}
                          onClick={() => setScopeType(s.value)}
                          disabled={!s.ready}
                          className={`flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition disabled:opacity-50 ${
                            selected
                              ? "border-cart-accent bg-cart-accent/10"
                              : "border-cart-line bg-cart-bg-elev-2 hover:border-cart-line-strong"
                          }`}
                        >
                          <span
                            aria-hidden
                            className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border ${
                              selected ? "border-cart-accent bg-cart-accent" : "border-cart-line"
                            }`}
                          >
                            {selected ? <span className="size-1.5 rounded-full bg-black" /> : null}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13.5px] font-medium text-white">
                              {s.label}
                            </span>
                            <span className="mt-0.5 block text-[12px] leading-snug text-cart-ink-3">
                              {s.description}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 text-[12px] font-medium text-cart-ink-2">Rol</div>
                  <div className="space-y-2">
                    {ROLES.map((r) => {
                      const selected = role === r.value;
                      return (
                        <button
                          type="button"
                          key={r.value}
                          onClick={() => setRole(r.value)}
                          className={`flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition ${
                            selected
                              ? "border-cart-accent bg-cart-accent/10"
                              : "border-cart-line bg-cart-bg-elev-2 hover:border-cart-line-strong"
                          }`}
                        >
                          <span
                            aria-hidden
                            className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border ${
                              selected ? "border-cart-accent bg-cart-accent" : "border-cart-line"
                            }`}
                          >
                            {selected ? <span className="size-1.5 rounded-full bg-black" /> : null}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13.5px] font-medium text-white">
                              {r.label}
                            </span>
                            <span className="mt-0.5 block text-[12px] leading-snug text-cart-ink-3">
                              {r.description}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {mutation.error && (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-[12.5px] text-rose-200">
                    No se pudo crear la invitación. Intenta de nuevo.
                  </div>
                )}

                <button
                  type="submit"
                  disabled={mutation.isPending || !canSubmit}
                  className="w-full rounded-full bg-cart-accent px-4 py-3 text-[14px] font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
                >
                  {mutation.isPending
                    ? "Enviando…"
                    : whatsappInvitesEnabled
                      ? channel === "email"
                        ? "Enviar por correo"
                        : "Enviar por WhatsApp"
                      : "Enviar invitación por correo"}
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                <div
                  className={`grid size-14 place-items-center rounded-full mx-auto ${
                    created.sent ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"
                  }`}
                  aria-hidden
                >
                  {created.sent ? (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <path d="M12 8v5M12 16.5v.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  )}
                </div>
                <div className="text-center">
                  <div className="text-[15px] font-semibold text-white">
                    {created.sent ? "Ya está en camino" : "Inténtalo de nuevo"}
                  </div>
                  <div className="mt-1 text-[12.5px] text-cart-ink-3">
                    {created.destination}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full rounded-full bg-cart-accent px-4 py-3 text-[14px] font-semibold text-white transition hover:brightness-110"
                >
                  Listo
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
