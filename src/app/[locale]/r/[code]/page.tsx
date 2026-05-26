import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { ShareButtons } from "./ShareButtons";
import type {
  CommissionConfig,
  CommissionType,
} from "@/server/promoters/domain/OrgPromoter";

type StateResponse = {
  ok: true;
  promoterName: string;
  eventTitle: string;
  eventStartsAt: string;
  eventVenue: string | null;
  eventSlug: string;
  ticketsSold: number;
  ticketsValidated: number;
  grossCents: number;
  commissionType: CommissionType;
  commissionConfig: CommissionConfig;
  commissionPct: number;
  payoutCents: number;
  unlockedRewards: Array<{ label: string; icon: string }>;
  publicSaleUrl: string;
};

/**
 * Promoter's personal landing — the page a promoter lands on when they open
 * their own link. Anyone who has the link can see this; no auth is required.
 */
export default async function PromoterLandingPage({
  params,
}: {
  params: Promise<{ code: string; locale: string }>;
}) {
  const { code } = await params;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origin = `${proto}://${host}`;

  const res = await fetch(`${origin}/api/r/${encodeURIComponent(code)}/state`, {
    // The endpoint is public but inherently per-user; don't cache.
    cache: "no-store",
  });
  if (res.status === 404) notFound();
  if (!res.ok) notFound();
  const data = (await res.json()) as StateResponse;

  return (
    <main className="mx-auto flex min-h-dvh max-w-[520px] flex-col px-5 pt-10 pb-12 text-white">
      <div className="mb-6">
        <h1 className="text-[28px] font-bold tracking-[-0.02em]">
          Hola {data.promoterName} <span aria-hidden>👋</span>
        </h1>
        <p className="mt-2 text-[13px] uppercase tracking-[0.14em] text-white/50">
          Vendiendo para
        </p>
        <p className="text-[18px] font-semibold leading-tight">{data.eventTitle}</p>
        <p className="mt-1 text-[13px] text-white/60">
          {formatDate(data.eventStartsAt)}
          {data.eventVenue ? ` · ${data.eventVenue}` : ""}
        </p>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Vendidas" value={String(data.ticketsSold)} />
        <Stat label="Validadas" value={String(data.ticketsValidated)} />
        <Stat
          label={data.commissionType === "inkind" ? "Generado" : "Ganas"}
          value={
            data.commissionType === "inkind"
              ? formatMoney(data.grossCents)
              : formatMoney(data.payoutCents)
          }
        />
      </div>

      <h2 className="mt-8 text-[13px] uppercase tracking-[0.14em] text-white/50">
        Tu meta
      </h2>
      <div className="mt-3">
        {data.commissionType === "percentage" && (
          <PercentageBlock
            pct={data.commissionPct}
            payoutCents={data.payoutCents}
          />
        )}
        {data.commissionType === "tiered" && (
          <TierStack
            config={data.commissionConfig}
            ticketsSold={data.ticketsSold}
          />
        )}
        {data.commissionType === "inkind" && (
          <RewardStack
            config={data.commissionConfig}
            ticketsSold={data.ticketsSold}
          />
        )}
      </div>

      <ShareButtons url={data.publicSaleUrl} eventTitle={data.eventTitle} />
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/5 px-3 py-4 text-center">
      <div className="text-[20px] font-bold leading-none">{value}</div>
      <div className="mt-1.5 text-[10.5px] uppercase tracking-[0.1em] text-white/50">
        {label}
      </div>
    </div>
  );
}

function PercentageBlock({
  pct,
  payoutCents,
}: {
  pct: number;
  payoutCents: number;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-[14px]">
        Ganas <strong>{pct}%</strong> por venta · llevas{" "}
        <strong>{formatMoney(payoutCents)}</strong>
      </p>
    </div>
  );
}

function TierStack({
  config,
  ticketsSold,
}: {
  config: CommissionConfig;
  ticketsSold: number;
}) {
  if (!config || !("tiers" in config) || config.tiers.length === 0) {
    return <EmptyConfigCard message="Sin escalones configurados todavía." />;
  }
  const tiers = [...config.tiers].sort((a, b) => a.salesCount - b.salesCount);
  return (
    <div className="flex flex-col gap-2">
      {tiers.map((t, i) => {
        const done = ticketsSold >= t.salesCount;
        const prev = i === 0 ? 0 : tiers[i - 1]!.salesCount;
        const inProgress = !done && ticketsSold >= prev;
        const progress = inProgress
          ? Math.max(
              0,
              Math.min(
                1,
                (ticketsSold - prev) / Math.max(1, t.salesCount - prev),
              ),
            )
          : done
            ? 1
            : 0;
        return (
          <TierCard
            key={i}
            title={`${t.salesCount} ventas`}
            payout={formatMoney(t.payoutCents)}
            state={done ? "done" : inProgress ? "active" : "locked"}
            progress={progress}
            ticketsSold={ticketsSold}
            target={t.salesCount}
          />
        );
      })}
    </div>
  );
}

function RewardStack({
  config,
  ticketsSold,
}: {
  config: CommissionConfig;
  ticketsSold: number;
}) {
  if (!config || !("rewards" in config) || config.rewards.length === 0) {
    return <EmptyConfigCard message="Sin premios configurados todavía." />;
  }
  const rewards = [...config.rewards].sort((a, b) => a.salesCount - b.salesCount);
  return (
    <div className="flex flex-col gap-2">
      {rewards.map((r, i) => {
        const done = ticketsSold >= r.salesCount;
        const prev = i === 0 ? 0 : rewards[i - 1]!.salesCount;
        const inProgress = !done && ticketsSold >= prev;
        const progress = inProgress
          ? Math.max(
              0,
              Math.min(
                1,
                (ticketsSold - prev) / Math.max(1, r.salesCount - prev),
              ),
            )
          : done
            ? 1
            : 0;
        return (
          <RewardCard
            key={i}
            icon={r.icon}
            label={r.label}
            state={done ? "done" : inProgress ? "active" : "locked"}
            progress={progress}
            ticketsSold={ticketsSold}
            target={r.salesCount}
          />
        );
      })}
    </div>
  );
}

type CardState = "done" | "active" | "locked";

function TierCard({
  title,
  payout,
  state,
  progress,
  ticketsSold,
  target,
}: {
  title: string;
  payout: string;
  state: CardState;
  progress: number;
  ticketsSold: number;
  target: number;
}) {
  return (
    <div
      className={
        "rounded-2xl border p-4 transition " +
        (state === "done"
          ? "border-[#22D17F]/40 bg-[#22D17F]/10"
          : state === "active"
            ? "border-white/20 bg-white/5"
            : "border-white/10 bg-white/[0.03] opacity-70")
      }
    >
      <div className="flex items-center justify-between">
        <div className="text-[15px] font-semibold">{title}</div>
        <div
          className={
            "text-[15px] font-bold " +
            (state === "done" ? "text-[#22D17F]" : "text-white")
          }
        >
          {payout}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <ProgressBar progress={progress} state={state} />
        <span className="shrink-0 text-[11px] text-white/60">
          {state === "done" ? "✓" : state === "locked" ? "🔒" : `${ticketsSold}/${target}`}
        </span>
      </div>
    </div>
  );
}

function RewardCard({
  icon,
  label,
  state,
  progress,
  ticketsSold,
  target,
}: {
  icon: string;
  label: string;
  state: CardState;
  progress: number;
  ticketsSold: number;
  target: number;
}) {
  return (
    <div
      className={
        "flex items-center gap-3 rounded-2xl border p-4 transition " +
        (state === "done"
          ? "border-[#22D17F]/40 bg-[#22D17F]/10"
          : state === "active"
            ? "border-white/20 bg-white/5"
            : "border-white/10 bg-white/[0.03] opacity-70")
      }
    >
      <div
        className="grid size-12 shrink-0 place-items-center rounded-xl bg-white/10 text-[26px]"
        aria-hidden
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <div className="truncate text-[15px] font-semibold">{label}</div>
          <span
            className={
              "shrink-0 text-[11px] " +
              (state === "done" ? "text-[#22D17F]" : "text-white/60")
            }
          >
            {state === "done"
              ? "Desbloqueado ✓"
              : state === "locked"
                ? "🔒"
                : `${ticketsSold}/${target}`}
          </span>
        </div>
        <div className="mt-2">
          <ProgressBar progress={progress} state={state} />
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ progress, state }: { progress: number; state: CardState }) {
  return (
    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
      <div
        className={
          "h-full transition-all " +
          (state === "done" ? "bg-[#22D17F]" : "bg-white/70")
        }
        style={{ width: `${Math.round(progress * 100)}%` }}
      />
    </div>
  );
}

function EmptyConfigCard({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-[13px] text-white/60">
      {message}
    </div>
  );
}

function formatMoney(cents: number): string {
  return `S/ ${(cents / 100).toLocaleString("es-PE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-PE", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
