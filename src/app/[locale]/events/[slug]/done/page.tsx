"use client";

import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { useRouter } from "@/i18n/navigation";
import { clientEvents } from "@/lib/analytics/clientEvents";
import { useSessionReady } from "@/lib/identity/hooks/useSessionReady";
import { UserHeader } from "@/app/[locale]/_home/UserHeader";
import { HolderEditSheet } from "@/components/tickets/HolderEditSheet";
import { TransferTicketSheet } from "@/components/tickets/TransferTicketSheet";
import { useMyTickets } from "@/lib/tickets/hooks/useTickets";
import { maskPhone } from "@/lib/tickets/phoneFormat";
import { useOnline } from "@/lib/_shared/useOnline";
import { RecoverTicketsLink } from "@/components/tickets/RecoverTicketsLink";
import type { WalletTicket } from "@/server/tickets/domain/Ticket";

const WALLET_POLL_MS = 2000;
const WALLET_POLL_MAX = 8;

export default function PurchaseDonePage() {
  return (
    <Suspense fallback={<DoneSkeleton expectedN={1} centered />}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const router = useRouter();
  const search = useSearchParams();
  const params = useParams<{ slug: string }>();
  const orderId = search.get("order");
  const expectedN = Math.max(0, parseInt(search.get("n") ?? "0", 10));
  const checkoutTracked = useRef(false);
  const { sessionReady, loggedIn } = useSessionReady();
  const { data: ticketData, isLoading, refetch } = useMyTickets();
  const [mounted, setMounted] = useState(false);
  const [pollExhausted, setPollExhausted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const mine = useMemo(
    () => (ticketData ?? []).filter((t) => t.orderId === orderId),
    [ticketData, orderId],
  );

  const hasOrderTickets = mine.length > 0;

  useEffect(() => {
    if (!hasOrderTickets || checkoutTracked.current || !params.slug) return;
    checkoutTracked.current = true;
    clientEvents.checkoutCompleted({
      event_slug: params.slug,
      order_id: orderId ?? undefined,
    });
  }, [hasOrderTickets, params.slug, orderId]);

  // Solo se llega acá desde /order, que ya reclamó la compra (o confirmó que
  // ya era tuya) antes de mandarte para acá — ver goToWallet() en
  // order/[orderId]/[token]/page.tsx. Sin sesión no hay nada que reclamar sin
  // el token del link original, así que si por algún motivo raro (p. ej. la
  // sesión venció justo entre medio) no hay login, mandamos a la wallet en
  // vez de duplicar la pantalla de login que ya vive en /order.
  useEffect(() => {
    if (!mounted || !sessionReady || loggedIn) return;
    router.replace("/tickets" as never);
  }, [mounted, sessionReady, loggedIn, router]);

  // El wallet puede tardar un instante en sincronizar el reclamo recién hecho.
  useEffect(() => {
    if (!mounted || !orderId || !sessionReady || !loggedIn || hasOrderTickets) return;

    let attempts = 0;
    const id = setInterval(() => {
      attempts += 1;
      void refetch();
      if (attempts >= WALLET_POLL_MAX) {
        clearInterval(id);
        setPollExhausted(true);
      }
    }, WALLET_POLL_MS);

    return () => clearInterval(id);
  }, [mounted, orderId, sessionReady, loggedIn, hasOrderTickets, refetch]);

  // React Query puede restaurar cache persistido antes de hidratar → esperamos
  // al mount y a que la sesión esté resuelta. No usamos isFetching: parpadea.
  const waitingWallet =
    !mounted || !sessionReady || !loggedIn || (isLoading && !hasOrderTickets);

  if (waitingWallet) {
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
      first={first}
      rest={rest}
      pollExhausted={pollExhausted}
      onRetrySync={() => void refetch()}
      onGoWallet={() => router.push("/tickets" as never)}
      onViewQr={(id) => router.push(`/tickets/${id}` as never)}
    />
  );
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
    <div className="home-light flex min-h-dvh flex-col bg-cart-bg text-cart-ink">
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
  first,
  rest,
  pollExhausted,
  onRetrySync,
  onGoWallet,
  onViewQr,
}: {
  n: number;
  first: WalletTicket | undefined;
  rest: WalletTicket[];
  pollExhausted: boolean;
  onRetrySync: () => void;
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
  const compact = n === 0;
  const subtitle =
    n > 1
      ? "La 1ª es tuya. A las demás envíaselas por WhatsApp cuando quieras."
      : n === 1
        ? "Tu entrada ya está en tu wallet, lista para mostrar en la puerta."
        : pollExhausted
          ? "Tu pago puede estar confirmado pero las entradas tardan en aparecer. Buscá de nuevo o recuperalas con tu celular."
          : "Estamos sincronizando tus entradas…";

  const footer = (
    <div className={compact ? "flex w-full flex-col gap-2.5" : "text-center"}>
      {compact && pollExhausted && (
        <button
          type="button"
          onClick={onRetrySync}
          className="w-full rounded-full bg-cart-accent py-3 text-[14px] font-semibold text-cart-bg transition hover:brightness-110"
        >
          Buscar de nuevo
        </button>
      )}
      <button
        type="button"
        onClick={onGoWallet}
        className="w-full py-2.5 text-[14px] font-semibold text-cart-ink transition hover:text-cart-ink/85 active:scale-[0.99]"
      >
        Ir a mis entradas
      </button>
      {compact && pollExhausted && (
        <p className="text-center">
          <RecoverTicketsLink />
        </p>
      )}
    </div>
  );

  return (
    <DoneShell centered={compact} footer={footer}>
      <SuccessIcon large={compact} />

      <h1
        className={
          compact
            ? "mt-5 text-[24px] font-bold tracking-[-0.02em]"
            : "mt-4 text-center text-[22px] font-bold tracking-[-0.02em]"
        }
      >
        {n > 0 ? `¡Listo! Tienes ${n} ${n === 1 ? "entrada" : "entradas"}` : pollExhausted ? "Pago recibido" : "Confirmando…"}
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
          variant="gift"
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
        (ready ? "bg-cart-accent text-cart-bg" : "bg-cart-bg-elev-2 text-cart-ink-2")
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
            className="min-w-0 flex-1 rounded-full bg-cart-bg-elev-2 px-2.5 py-2 text-[12px] font-semibold text-cart-ink transition hover:bg-cart-line-strong active:scale-95"
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
