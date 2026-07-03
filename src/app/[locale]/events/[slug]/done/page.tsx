"use client";

import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { useRouter, usePathname } from "@/i18n/navigation";
import { GoogleBtn } from "@/components/design";
import { setOauthReturn } from "@/components/auth/PostLoginRedirect";
import { useGoogleSignIn } from "@/lib/identity/hooks/useFirebaseAuth";
import { useSessionReady } from "@/lib/identity/hooks/useSessionReady";
import { UserHeader } from "@/app/[locale]/_home/UserHeader";
import { HolderEditSheet } from "@/components/tickets/HolderEditSheet";
import { TransferTicketSheet } from "@/components/tickets/TransferTicketSheet";
import { useMyTickets, useClaimOrder } from "@/lib/tickets/hooks/useTickets";
import { maskPhone } from "@/lib/tickets/phoneFormat";
import { useOnline } from "@/lib/_shared/useOnline";
import { api } from "@/lib/_shared/api-client";
import type { WalletTicket } from "@/server/tickets/domain/Ticket";

const WALLET_POLL_MS = 2000;
const WALLET_POLL_MAX = 8;

const orderTokenFromUrl = (orderUrl: string | null | undefined): string | null => {
  const m = orderUrl?.match(/\/order\/[^/]+\/([a-f0-9]{16})$/i);
  return m?.[1] ?? null;
};

export default function PurchaseDonePage() {
  return (
    <Suspense fallback={<DoneSkeleton expectedN={1} centered />}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const orderId = search.get("order");
  const expectedN = Math.max(0, parseInt(search.get("n") ?? "0", 10));
  const returnTo = search.toString() ? `${pathname}?${search.toString()}` : pathname;
  const google = useGoogleSignIn({});
  const { sessionReady, loggedIn } = useSessionReady();
  const { data: ticketData, isLoading, refetch } = useMyTickets();
  const claim = useClaimOrder();
  const [mounted, setMounted] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const triedClaim = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const mine = useMemo(
    () => (ticketData ?? []).filter((t) => t.orderId === orderId),
    [ticketData, orderId],
  );

  const hasOrderTickets = mine.length > 0;

  // Tras Google: si la compra fue de invitado, hay que reclamar la orden (como
  // /order). Solo si ya es tuya o no aplica guest-claim, poll del wallet.
  useEffect(() => {
    if (!mounted || !orderId || !sessionReady || !loggedIn) {
      setSyncing(false);
      return;
    }
    if (hasOrderTickets) {
      setSyncing(false);
      return;
    }
    if (triedClaim.current) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const run = async () => {
      setSyncing(true);
      setClaimError(null);

      let token = search.get("k");
      if (!token) {
        try {
          const status = await api.get<{ orderUrl: string | null }>(
            `/api/tickets/order/${orderId}/status`,
          );
          if (cancelled) return;
          token = orderTokenFromUrl(status.orderUrl);
        } catch {
          if (!cancelled) setSyncing(false);
          return;
        }
      }

      if (!token) {
        if (!cancelled) setSyncing(false);
        return;
      }

      try {
        await claim.mutateAsync({ orderId, token });
        if (cancelled) return;
        await refetch();
        setSyncing(false);
      } catch (e) {
        if (cancelled) return;
        const msg = (e as Error).message;
        if (msg === "order_not_paid") {
          timer = setTimeout(() => void run(), WALLET_POLL_MS);
          return;
        }
        setClaimError(doneClaimErrorCopy(msg));
        setSyncing(false);
      }
    };

    triedClaim.current = true;
    void run();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [mounted, orderId, sessionReady, loggedIn, hasOrderTickets, claim, refetch, search]);

  // Compra logueada: el wallet puede tardar un instante tras el pago.
  useEffect(() => {
    if (!mounted || !orderId || !sessionReady || !loggedIn || hasOrderTickets) return;
    if (claimError || syncing) return;

    let attempts = 0;
    const id = setInterval(() => {
      attempts += 1;
      void refetch();
      if (attempts >= WALLET_POLL_MAX) clearInterval(id);
    }, WALLET_POLL_MS);

    return () => clearInterval(id);
  }, [mounted, orderId, sessionReady, loggedIn, hasOrderTickets, claimError, syncing, refetch]);

  // React Query puede restaurar cache persistido antes de hidratar → esperamos
  // al mount y a que la sesión esté resuelta. No usamos isFetching: parpadea.
  const waitingWallet =
    !mounted || !sessionReady || (loggedIn && isLoading && !hasOrderTickets);

  if (waitingWallet || (loggedIn && syncing && !hasOrderTickets)) {
    return (
      <DoneSkeleton
        expectedN={expectedN > 0 ? expectedN : 1}
        centered={expectedN <= 1}
      />
    );
  }

  const n = mine.length;
  const [first, ...rest] = mine;

  return (
    <DoneContent
      n={n}
      loggedIn={loggedIn}
      first={first}
      rest={rest}
      googlePending={google.pending}
      googleError={google.error}
      claimError={claimError}
      onGoogleSignIn={() => {
        setOauthReturn(returnTo);
        google.signIn();
      }}
      onGoWallet={() => router.push("/tickets" as never)}
      onViewQr={(id) => router.push(`/tickets/${id}` as never)}
    />
  );
}

function doneClaimErrorCopy(raw: string): string {
  switch (raw) {
    case "order_already_claimed":
      return "Estas entradas ya se guardaron en otra cuenta. Entra con la cuenta del comprador.";
    case "order_claim_expired":
      return "El plazo para guardar esta compra venció.";
    case "order_not_claimable":
      return "Esta compra no se puede guardar desde aquí.";
    case "invalid_token":
      return "El enlace de la compra no es válido. Abre el link completo que te llegó al pagar.";
    default:
      return "No pudimos guardar tus entradas. Inténtalo de nuevo.";
  }
}

function SuccessIcon({ large = false }: { large?: boolean }) {
  if (large) {
    return (
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 16 }}
        className="grid size-[100px] place-items-center rounded-full bg-gradient-to-b from-emerald-400 to-emerald-600 shadow-[0_0_48px_-14px_rgba(34,209,127,0.5)]"
      >
        <svg width="52" height="52" viewBox="0 0 24 24" fill="none" className="text-white">
          <path d="M5 12.5l4 4 10-10" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 16 }}
      className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-400/15"
    >
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-emerald-300">
        <path d="M5 12.5l4 4 10-10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </motion.div>
  );
}

function DonePageShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-cart-bg text-white">
      <UserHeader />
      <main className="flex flex-1 flex-col items-center justify-center px-5 py-6">
        <div className="w-full max-w-[400px]">{children}</div>
      </main>
    </div>
  );
}

function DoneShell({
  centered,
  children,
  footer,
}: {
  centered: boolean;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <DonePageShell>
      <div className={`flex w-full flex-col ${centered ? "items-center text-center" : ""}`}>
        {children}
        {footer ? <div className={centered ? "mt-8 w-full" : "mt-6 w-full"}>{footer}</div> : null}
      </div>
    </DonePageShell>
  );
}

function DoneSkeleton({ expectedN, centered }: { expectedN: number; centered: boolean }) {
  const multi = expectedN > 1;

  if (centered) {
    return (
      <DonePageShell>
        <div className="flex w-full flex-col items-center text-center">
          <div className="size-[100px] animate-pulse rounded-full bg-emerald-400/10" />
          <div className="mt-5 h-7 w-52 animate-pulse rounded-lg bg-cart-bg-elev" />
          <div className="mt-3 h-9 w-full max-w-[280px] animate-pulse rounded-lg bg-cart-bg-elev" />
          <div className="mt-8 h-12 w-full animate-pulse rounded-full bg-cart-bg-elev" />
        </div>
      </DonePageShell>
    );
  }

  return (
    <DonePageShell>
      <div className="size-14 animate-pulse rounded-full bg-emerald-400/10 mx-auto" />
      <div className="mt-4 h-7 w-48 animate-pulse rounded-lg bg-cart-bg-elev mx-auto" />
      <div className="mt-2 h-8 w-full animate-pulse rounded-lg bg-cart-bg-elev" />
      <div className="mt-6 flex flex-col gap-2">
        <div className="h-14 animate-pulse rounded-2xl bg-cart-bg-elev" />
        {multi &&
          Array.from({ length: expectedN - 1 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-2xl bg-cart-bg-elev" />
          ))}
      </div>
    </DonePageShell>
  );
}

function DoneContent({
  n,
  loggedIn,
  first,
  rest,
  googlePending,
  googleError,
  claimError,
  onGoogleSignIn,
  onGoWallet,
  onViewQr,
}: {
  n: number;
  loggedIn: boolean;
  first: WalletTicket | undefined;
  rest: WalletTicket[];
  googlePending: boolean;
  googleError: string | null;
  claimError: string | null;
  onGoogleSignIn: () => void;
  onGoWallet: () => void;
  onViewQr: (id: string) => void;
}) {
  const online = useOnline();
  const [sheet, setSheet] = useState<{
    ticketId: string;
    kind: "holder" | "transfer";
    anchorRef: RefObject<HTMLElement | null>;
  } | null>(null);
  const sheetTicket = sheet ? rest.find((t) => t.id === sheet.ticketId) : undefined;
  const compact = !loggedIn || n === 0;
  const subtitle = !loggedIn
    ? "Las guardamos en tu cuenta, con tu propio QR. Así las tienes siempre a la mano y puedes repartirlas."
    : n > 1
      ? "La 1ª es tuya. A las demás envíaselas por WhatsApp cuando quieras."
      : n === 1
        ? "Tu entrada ya está en tu wallet, lista para mostrar en la puerta."
        : "No encontramos las entradas de esta compra en tu wallet. Revisa Mis entradas.";

  const footer = (
    <div className={compact ? "flex w-full flex-col gap-2.5" : "text-center"}>
      {!loggedIn ? (
        <>
          <GoogleBtn
            onClick={onGoogleSignIn}
            disabled={googlePending}
            label={googlePending ? "Abriendo Google…" : "Continuar con Google"}
          />
          {googleError && (
            <p className="mt-1 text-[12px] text-rose-300">No se pudo abrir Google. Reintenta.</p>
          )}
        </>
      ) : (
        <button
          type="button"
          onClick={onGoWallet}
          className="w-full py-2.5 text-[14px] font-semibold text-white transition hover:text-white/85 active:scale-[0.99]"
        >
          Ir a mis entradas
        </button>
      )}
    </div>
  );

  return (
    <DoneShell centered={compact} footer={footer}>
      <SuccessIcon large={compact} />

      {!loggedIn && (
        <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-300">
          Pago confirmado
        </p>
      )}
      <h1
        className={
          compact
            ? `${loggedIn ? "mt-5" : "mt-1"} text-[24px] font-bold tracking-[-0.02em]`
            : "mt-4 text-center text-[22px] font-bold tracking-[-0.02em]"
        }
      >
        {!loggedIn
          ? "Entra para ver tus entradas"
          : n > 0
            ? `¡Listo! Tienes ${n} ${n === 1 ? "entrada" : "entradas"}`
            : "¡Listo! Pago confirmado"}
      </h1>
      <p
        className={
          compact
            ? "mt-2 max-w-[300px] text-[13.5px] leading-relaxed text-cart-ink-2"
            : "mx-auto mt-1.5 max-w-[300px] text-center text-[13px] text-cart-ink-2"
        }
      >
        {subtitle}
      </p>
      {claimError && loggedIn && (
        <p className="mt-2 text-[13px] leading-snug text-rose-300">{claimError}</p>
      )}

      {!compact && (
        <div className="mt-5 flex flex-col gap-2">
          {first && (
            <TicketRow
              label="Tu entrada"
              meta={`${first.ticketType.name} · en tu cel`}
              actionLabel="Ver QR"
              onAction={() => onViewQr(first.id)}
              variant="yours"
            />
          )}

          {rest.map((t, i) => (
            <GiftTicketRow
              key={t.id}
              ticket={t}
              index={i + 2}
              onPonerDatos={(anchorRef) => setSheet({ ticketId: t.id, kind: "holder", anchorRef })}
              onEnviar={(anchorRef) => setSheet({ ticketId: t.id, kind: "transfer", anchorRef })}
            />
          ))}
        </div>
      )}

      {sheetTicket && sheet?.kind === "holder" && (
        <HolderEditSheet
          open
          ticketId={sheetTicket.id}
          currentName={sheetTicket.holderName}
          currentDniLast2={sheetTicket.holderDniLast2}
          ticketTypeName={sheetTicket.ticketType.name}
          online={online}
          anchorRef={sheet.anchorRef}
          onClose={() => setSheet(null)}
        />
      )}
      {sheetTicket && sheet?.kind === "transfer" && (
        <TransferTicketSheet
          open
          ticketId={sheetTicket.id}
          online={online}
          anchorRef={sheet.anchorRef}
          onClose={() => setSheet(null)}
        />
      )}
    </DoneShell>
  );
}

function TicketRowIcon({ ready }: { ready?: boolean }) {
  return (
    <motion.span
      layout
      className={
        "grid size-8 shrink-0 place-items-center rounded-full " +
        (ready ? "bg-cart-accent text-cart-bg" : "bg-white/8 text-cart-ink-2")
      }
    >
      {ready ? (
        <svg width="15" height="15" viewBox="0 0 18 18" fill="none">
          <path d="M4 9.5l3 3 7-7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 18 18" fill="none">
          <circle cx="9" cy="6" r="2.6" stroke="currentColor" strokeWidth="1.4" />
          <path d="M3.5 15c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      )}
    </motion.span>
  );
}

function TicketRow({
  label,
  meta,
  actionLabel,
  onAction,
  variant = "default",
}: {
  label: string;
  meta: string;
  actionLabel: string;
  onAction: () => void;
  variant?: "yours" | "default";
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-cart-line bg-cart-bg-elev px-3.5 py-3">
      <TicketRowIcon ready={variant === "yours"} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold leading-tight">{label}</p>
        <p className="mt-0.5 truncate text-[11.5px] text-cart-ink-3">{meta}</p>
      </div>
      <button
        type="button"
        onClick={onAction}
        className="shrink-0 rounded-full bg-cart-accent px-3 py-1.5 text-[11.5px] font-semibold text-cart-bg transition active:scale-95"
      >
        {actionLabel}
      </button>
    </div>
  );
}

function GiftTicketRow({
  ticket,
  index,
  onPonerDatos,
  onEnviar,
}: {
  ticket: WalletTicket;
  index: number;
  onPonerDatos: (anchorRef: RefObject<HTMLButtonElement | null>) => void;
  onEnviar: (anchorRef: RefObject<HTMLButtonElement | null>) => void;
}) {
  const datosRef = useRef<HTMLButtonElement>(null);
  const enviarRef = useRef<HTMLButtonElement>(null);
  const pending = ticket.pendingTransferTo;
  const named = !!ticket.holderName;
  const ready = named || !!pending;
  const meta = pending
    ? `Enviada al ${maskPhone(pending)} · esperando`
    : named
      ? ticket.holderName!
      : "¿Para quién es?";

  return (
    <div
      className={
        "rounded-2xl border bg-cart-bg-elev " +
        (pending ? "border-amber-400/35" : ready ? "border-cart-line" : "border-cart-accent/40")
      }
    >
      <div className="flex items-center gap-3 px-3.5 py-3">
        <TicketRowIcon ready={ready} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold leading-tight">{index}ª entrada</p>
          <p className="mt-0.5 truncate text-[11.5px] text-cart-ink-3">{meta}</p>
        </div>
      </div>

      {!pending && (
        <div className="flex gap-2 px-3.5 pb-3">
          <button
            ref={datosRef}
            type="button"
            onClick={() => onPonerDatos(datosRef)}
            className="min-w-0 flex-1 rounded-full bg-white/10 px-2.5 py-2 text-[12px] font-semibold text-white transition hover:bg-white/15 active:scale-95"
          >
            Poner datos
          </button>
          <button
            ref={enviarRef}
            type="button"
            onClick={() => onEnviar(enviarRef)}
            className="min-w-0 flex-1 rounded-full bg-cart-accent px-2.5 py-2 text-[12px] font-semibold text-cart-bg transition active:scale-95"
          >
            Enviar
          </button>
        </div>
      )}
    </div>
  );
}
