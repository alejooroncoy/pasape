import { notFound } from "next/navigation";
import { optimizeImageUrl } from "@/lib/images/optimizeUrl";
import { Link } from "@/i18n/navigation";
import { getLegalEntityPublicHub } from "@/server/identity/organizations/application/GetLegalEntityPublicHub";
import { BrandFilterBar, type BrandFilterItem, type FilterableEvent } from "./BrandFilterBar";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export default async function LegalEntityHubPage({ params }: Props) {
  const { slug } = await params;
  const hub = await getLegalEntityPublicHub(slug);
  if (!hub) notFound();

  const { entity, brands, events } = hub;
  const displayName = entity.displayName || entity.name;
  const handle = entity.slug ? `@${entity.slug}` : null;
  const eventsCount = events.length;
  const cityHint = inferCity(events);

  const filterItems: BrandFilterItem[] = [
    { id: "all", label: `Todos · ${eventsCount}`, value: null },
    ...brands.map((b) => ({
      id: b.id,
      label: `${b.name} · ${b.upcomingCount}`,
      value: b.id,
    })),
  ];

  const filterableEvents: FilterableEvent[] = events;

  return (
    <div className="relative min-h-[100dvh] bg-cart-bg text-white">
      <Cover coverUrl={entity.coverUrl} brands={brands} />

      {/* Mobile */}
      <div className="relative mx-auto w-full max-w-[480px] px-5 pb-24 lg:hidden">
        <BackButton />

        <div className="-mt-14 flex items-end gap-4">
          <HubLogo name={displayName} logoUrl={entity.logoUrl} size={88} />
          <FollowButton />
        </div>

        <h1 className="mt-4 text-[28px] font-semibold leading-[1.05] tracking-[-0.02em]">
          {displayName}
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[13px] text-cart-ink-3">
          {handle && <span className="font-mono">{handle}</span>}
          {handle && cityHint && <span>·</span>}
          {cityHint && <span>{cityHint}</span>}
          <span>·</span>
          <span>
            {brands.length} {brands.length === 1 ? "marca" : "marcas"}
          </span>
        </div>
        {entity.bio && (
          <p className="mt-3 max-w-[520px] text-[14px] leading-relaxed text-cart-ink-2">
            {entity.bio}
          </p>
        )}

        <BrandGrid brands={brands} variant="mobile" />

        <SectionTitle count={eventsCount} />
        <BrandFilterBar items={filterItems} events={filterableEvents} variant="mobile" />
      </div>

      {/* Desktop */}
      <div className="relative mx-auto hidden w-full max-w-[1180px] px-10 pb-24 lg:block">
        <BackButton />

        <div className="-mt-20 flex items-end justify-between gap-8">
          <div className="flex items-end gap-6">
            <HubLogo name={displayName} logoUrl={entity.logoUrl} size={144} />
            <div className="pb-3">
              <h1 className="text-[44px] font-semibold leading-[1] tracking-[-0.03em]">
                {displayName}
              </h1>
              <div className="mt-2 flex items-center gap-2 text-[14px] text-cart-ink-3">
                {handle && <span className="font-mono">{handle}</span>}
                {handle && cityHint && <span>·</span>}
                {cityHint && <span>{cityHint}</span>}
                <span>·</span>
                <span>
                  {brands.length} {brands.length === 1 ? "marca" : "marcas"}
                </span>
                <span>·</span>
                <span>{eventsCount} próximos</span>
              </div>
              {entity.bio && (
                <p className="mt-3 max-w-[540px] text-[14.5px] leading-relaxed text-cart-ink-2">
                  {entity.bio}
                </p>
              )}
            </div>
          </div>
          <FollowButton size="lg" />
        </div>

        <BrandGrid brands={brands} variant="desktop" />

        <SectionTitle count={eventsCount} variant="desktop" />
        <BrandFilterBar items={filterItems} events={filterableEvents} variant="desktop" />
      </div>
    </div>
  );
}

// ============================================================
// Pieces
// ============================================================
function Cover({
  coverUrl,
  brands,
}: {
  coverUrl: string | null;
  brands: Array<{ brandColor: string | null }>;
}) {
  const seedColor = brands.find((b) => b.brandColor)?.brandColor ?? "#B87CFF";
  return (
    <div className="relative h-[220px] w-full overflow-hidden lg:h-[320px]">
      {coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={optimizeImageUrl(coverUrl, "event-hero") ?? coverUrl} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${seedColor} 0%, #6D2BE0 50%, #1A0A2E 100%)`,
          }}
        />
      )}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 60% at 30% 30%, rgba(255,255,255,0.16), transparent 60%), radial-gradient(40% 50% at 80% 80%, rgba(0,0,0,0.45), transparent 60%)",
        }}
      />
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-cart-bg" />
    </div>
  );
}

function BackButton() {
  return (
    <div className="absolute left-5 top-5 z-10 lg:left-10 lg:top-8">
      <Link
        href="/"
        aria-label="Volver"
        className="grid size-10 place-items-center rounded-full border border-white/15 bg-black/40 text-white backdrop-blur transition hover:bg-black/60"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M10 3L5 8l5 5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Link>
    </div>
  );
}

function HubLogo({
  name,
  logoUrl,
  size,
}: {
  name: string;
  logoUrl: string | null;
  size: number;
}) {
  const initial = (name || "?")[0].toUpperCase();
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-3xl border-4 border-cart-bg bg-cart-bg-elev"
      style={{ width: size, height: size }}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={optimizeImageUrl(logoUrl, "card") ?? logoUrl} alt={name} className="size-full object-cover" />
      ) : (
        <div
          className="grid size-full place-items-center font-sans font-semibold text-white"
          style={{
            background: "linear-gradient(135deg, #B87CFF, #1A0A2E)",
            fontSize: size * 0.42,
          }}
        >
          {initial}
        </div>
      )}
    </div>
  );
}

function FollowButton({ size = "md" }: { size?: "md" | "lg" }) {
  const cls = size === "lg" ? "h-12 px-6 text-[14px]" : "h-9 px-4 text-[12.5px]";
  return (
    <button
      type="button"
      className={
        "inline-flex items-center gap-1.5 rounded-full bg-cart-accent font-semibold text-white shadow-[0_8px_24px_-8px_var(--color-cart-accent-glow-strong)] transition hover:-translate-y-[1px] " +
        cls
      }
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      Seguir
    </button>
  );
}

function BrandGrid({
  brands,
  variant,
}: {
  brands: Array<{
    id: string;
    slug: string;
    name: string;
    logoUrl: string | null;
    brandColor: string | null;
    upcomingCount: number;
  }>;
  variant: "mobile" | "desktop";
}) {
  if (brands.length === 0) return null;
  return (
    <section className={variant === "desktop" ? "mt-12" : "mt-8"}>
      <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-cart-ink-3">
        {brands.length === 1 ? "Marca" : "Nuestras marcas"}
      </div>
      <div
        className={
          variant === "desktop"
            ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            : "grid grid-cols-2 gap-2.5"
        }
      >
        {brands.map((b) => (
          <Link
            key={b.id}
            href={`/${b.slug}` as never}
            className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-cart-line bg-cart-bg-elev p-3 transition hover:border-cart-line-strong"
          >
            <div
              className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl text-[16px] font-semibold text-white"
              style={{
                background: `linear-gradient(135deg, ${b.brandColor ?? "#B87CFF"}, #1A0A2E)`,
              }}
            >
              {b.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={b.logoUrl}
                  alt={b.name}
                  className="absolute inset-0 size-full object-cover"
                />
              ) : (
                (b.name[0] ?? "?").toUpperCase()
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-semibold tracking-[-0.01em]">{b.name}</div>
              <div className="text-[11.5px] text-cart-ink-3">
                {b.upcomingCount} {b.upcomingCount === 1 ? "evento" : "eventos"}
              </div>
            </div>
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              className="text-cart-ink-3 transition-transform group-hover:translate-x-0.5"
            >
              <path
                d="M5 2l5 5-5 5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        ))}
      </div>
    </section>
  );
}

function SectionTitle({ count, variant }: { count: number; variant?: "desktop" }) {
  return (
    <div
      className={"flex items-baseline justify-between " + (variant === "desktop" ? "mt-12" : "mt-8")}
    >
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cart-ink-3">
          {count === 0 ? "SIN EVENTOS POR AHORA" : `${count} PRÓXIMOS`}
        </div>
        {variant === "desktop" && count > 0 && (
          <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.02em]">Próximas noches</h2>
        )}
      </div>
      {count > 0 && <span className="text-[11.5px] text-cart-ink-4">orden · + cerca</span>}
    </div>
  );
}

function inferCity(events: FilterableEvent[]): string | null {
  const counts = new Map<string, number>();
  for (const e of events) {
    if (!e.venue) continue;
    const tokens = e.venue.split(/[,·]/).map((t: string) => t.trim());
    const last = tokens[tokens.length - 1];
    if (last && last.length > 1 && last.length < 30) {
      counts.set(last, (counts.get(last) ?? 0) + 1);
    }
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [k, v] of counts) {
    if (v > bestCount) {
      best = k;
      bestCount = v;
    }
  }
  return best;
}
