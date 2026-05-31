import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { FollowButton } from "./_components/FollowButton";
import { supabaseOrganizationRepository } from "@/server/identity/organizations/infrastructure/repositories/SupabaseOrganizationRepository";
import { supabaseEventRepository } from "@/server/events/infrastructure/repositories/SupabaseEventRepository";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import type { Event } from "@/server/events/domain/Event";
import type { Organization } from "@/server/identity/organizations/domain/Organization";

// Slugs reservados que NO deben tratarse como marca — chequeo extra
// para evitar colisiones con segmentos estáticos accidentalmente removidos.
const RESERVED = new Set([
  "org", "events", "auth", "login", "apply", "invites", "profile",
  "promo", "scan", "box", "tickets", "e", "t", "_home", "_next", "api", "r",
]);

type Props = {
  params: Promise<{ locale: string; orgSlug: string }>;
};

export default async function BrandPublicPage({ params }: Props) {
  const { orgSlug } = await params;
  if (RESERVED.has(orgSlug)) notFound();

  const org = await supabaseOrganizationRepository.findBySlug(orgSlug);
  if (!org) notFound();

  const { upcoming, minPrices } = await loadUpcomingEvents(orgSlug);

  return <BrandPageView org={org} events={upcoming} minPrices={minPrices} />;
}

// Helper fuera del render del Server Component: aquí Date.now() es válido
// (la regla de pureza de React solo aplica al cuerpo del componente).
async function loadUpcomingEvents(orgSlug: string) {
  const events = await supabaseEventRepository.listByOrgSlug(orgSlug);
  const cutoff = Date.now() - 6 * 3600 * 1000;
  const upcoming = events
    .filter((e) => e.status === "published")
    .filter((e) => new Date(e.startsAt).getTime() >= cutoff);
  const minPrices = await fetchMinPricesByEvent(upcoming.map((e) => e.id));
  return { upcoming, minPrices };
}

async function fetchMinPricesByEvent(eventIds: string[]): Promise<Record<string, number>> {
  if (eventIds.length === 0) return {};
  const db = supabaseAdmin();
  const { data } = await db
    .from("ticket_types")
    .select("event_id, price_cents")
    .in("event_id", eventIds);
  const acc: Record<string, number> = {};
  for (const row of (data ?? []) as Array<{ event_id: string; price_cents: number }>) {
    if (acc[row.event_id] == null || row.price_cents < acc[row.event_id]) {
      acc[row.event_id] = row.price_cents;
    }
  }
  return acc;
}

// ------------------------------------------------------------
// UI
// ------------------------------------------------------------
function BrandPageView({
  org,
  events,
  minPrices,
}: {
  org: Organization;
  events: Event[];
  minPrices: Record<string, number>;
}) {
  const brand = org.brandColor ?? "#B87CFF";
  const handle = `@${org.slug}`;

  return (
    <div className="relative min-h-[100dvh] bg-cart-bg text-white">
      {/* Hero cover */}
      <Cover brand={brand} />

      {/* Mobile: iOS-style stacked */}
      <div className="relative mx-auto w-full max-w-[480px] px-5 pb-20 lg:hidden">
        <BackButton />

        <div className="-mt-12 flex items-end gap-4">
          <BrandLogo name={org.name} color={brand} logoUrl={org.logoUrl} size={88} />
          <FollowButton orgId={org.id} orgSlug={org.slug} />
        </div>

        <h1 className="mt-4 text-[28px] font-semibold leading-[1.05] tracking-[-0.02em]">
          {org.name}
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-cart-ink-3">
          <span className="font-mono">{handle}</span>
          {org.instagram && (
            <>
              <span>·</span>
              <InstagramLink handle={org.instagram} />
            </>
          )}
          <span>·</span>
          <span>{events.length} próximos</span>
        </div>

        {org.description && (
          <p className="mt-3 text-[14px] leading-relaxed text-cart-ink-2">
            {org.description}
          </p>
        )}

        <SectionTitle count={events.length} />

        <EventsList events={events} brand={brand} minPrices={minPrices} />
      </div>

      {/* Desktop: wider hero + grid */}
      <div className="relative mx-auto hidden w-full max-w-[1120px] px-10 pb-24 lg:block">
        <BackButton />

        <div className="-mt-16 flex items-end justify-between gap-6">
          <div className="flex items-end gap-6">
            <BrandLogo name={org.name} color={brand} logoUrl={org.logoUrl} size={132} />
            <div className="pb-2">
              <h1 className="text-[44px] font-semibold leading-[1] tracking-[-0.03em]">
                {org.name}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-cart-ink-3">
                <span className="font-mono">{handle}</span>
                {org.instagram && (
                  <>
                    <span>·</span>
                    <InstagramLink handle={org.instagram} />
                  </>
                )}
                <span>·</span>
                <span>{events.length} próximos</span>
              </div>
              {org.description && (
                <p className="mt-3 max-w-[520px] text-[14.5px] leading-relaxed text-cart-ink-2">
                  {org.description}
                </p>
              )}
            </div>
          </div>
          <FollowButton orgId={org.id} orgSlug={org.slug} size="lg" />
        </div>

        <SectionTitle count={events.length} variant="desktop" />

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {events.map((ev, i) => (
            <EventCardWeb
              key={ev.id}
              ev={ev}
              brand={brand}
              featured={i === 0}
              minCents={minPrices[ev.id]}
            />
          ))}
        </div>

        {events.length === 0 && <EmptyState />}
      </div>
    </div>
  );
}

function Cover({ brand }: { brand: string }) {
  return (
    <div className="relative h-[200px] w-full overflow-hidden lg:h-[280px]">
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, ${brand} 0%, #6D2BE0 50%, #1A0A2E 100%)`,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 60% at 30% 30%, rgba(255,255,255,0.18), transparent 60%), radial-gradient(40% 50% at 80% 80%, rgba(0,0,0,0.4), transparent 60%)",
        }}
      />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-cart-bg" />
    </div>
  );
}

function BackButton() {
  return (
    <div className="absolute left-5 top-5 z-10 lg:left-10 lg:top-8">
      <Link
        href="/"
        className="grid size-10 place-items-center rounded-full border border-white/15 bg-black/40 text-white backdrop-blur transition hover:bg-black/60"
        aria-label="Volver"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
    </div>
  );
}

function InstagramLink({ handle }: { handle: string }) {
  return (
    <a
      href={`https://instagram.com/${handle}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-cart-ink-2 transition hover:text-white"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" />
      </svg>
      @{handle}
    </a>
  );
}

function BrandLogo({
  name,
  color,
  logoUrl,
  size,
}: {
  name: string;
  color: string;
  logoUrl: string | null;
  size: number;
}) {
  const initial = (name || "?")[0].toUpperCase();
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-2xl border-4 border-cart-bg bg-cart-bg-elev"
      style={{ width: size, height: size }}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt={name} className="size-full object-cover" />
      ) : (
        <div
          className="grid size-full place-items-center font-sans font-semibold text-white"
          style={{
            background: `linear-gradient(135deg, ${color}, #1A0A2E)`,
            fontSize: size * 0.42,
          }}
        >
          {initial}
        </div>
      )}
    </div>
  );
}


function SectionTitle({ count, variant }: { count: number; variant?: "desktop" }) {
  return (
    <div className={"flex items-baseline justify-between " + (variant === "desktop" ? "mt-12" : "mt-8")}>
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cart-ink-3">
          {count === 0 ? "SIN EVENTOS POR AHORA" : `${count} EVENTOS PRÓXIMOS`}
        </div>
        {variant === "desktop" && count > 0 && (
          <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.02em]">
            Próximas noches
          </h2>
        )}
      </div>
      {count > 0 && (
        <span className="text-[11.5px] text-cart-ink-4">orden · + cerca</span>
      )}
    </div>
  );
}

function EventsList({
  events,
  brand,
  minPrices,
}: {
  events: Event[];
  brand: string;
  minPrices: Record<string, number>;
}) {
  if (events.length === 0) return <EmptyState />;
  return (
    <div className="mt-4 flex flex-col gap-3">
      {events.map((ev, i) => (
        <EventCardMobile
          key={ev.id}
          ev={ev}
          brand={brand}
          featured={i === 0}
          minCents={minPrices[ev.id]}
        />
      ))}
    </div>
  );
}

function EventCardMobile({
  ev,
  brand,
  featured,
  minCents,
}: {
  ev: Event;
  brand: string;
  featured: boolean;
  minCents: number | undefined;
}) {
  const date = formatEventDate(ev.startsAt);
  return (
    <Link
      href={`/events/${ev.slug}` as never}
      className={
        "relative flex items-center gap-3 overflow-hidden rounded-2xl bg-cart-bg-elev p-3 transition hover:bg-cart-bg-elev-2 " +
        (featured
          ? "border border-cart-accent/60 shadow-[0_0_24px_-8px_var(--color-cart-accent-glow)]"
          : "border border-cart-line")
      }
    >
      <div
        className="size-16 shrink-0 overflow-hidden rounded-xl"
        style={{
          background: `linear-gradient(135deg, ${brand}, #FF4D5E)`,
        }}
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold tracking-[-0.01em]">
          {ev.title}
        </div>
        <div className="mt-0.5 text-[12.5px] text-cart-accent">{date}</div>
        {ev.venue && (
          <div className="truncate text-[11.5px] text-cart-ink-3">{ev.venue}</div>
        )}
      </div>
      <div className="text-right">
        <div className="text-[10px] uppercase tracking-[0.14em] text-cart-ink-4">DESDE</div>
        <div className="font-mono text-[13.5px] font-semibold">{formatCents(minCents)}</div>
      </div>
    </Link>
  );
}

function EventCardWeb({
  ev,
  brand,
  featured,
  minCents,
}: {
  ev: Event;
  brand: string;
  featured: boolean;
  minCents: number | undefined;
}) {
  const date = formatEventDate(ev.startsAt);
  return (
    <Link
      href={`/events/${ev.slug}` as never}
      className={
        "group relative flex flex-col overflow-hidden rounded-3xl bg-cart-bg-elev transition hover:-translate-y-[2px] " +
        (featured
          ? "border border-cart-accent/60 shadow-[0_24px_64px_-24px_var(--color-cart-accent-glow)]"
          : "border border-cart-line hover:border-cart-line-strong")
      }
    >
      <div
        className="relative aspect-[16/10] w-full overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${brand}, #FF4D5E)` }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        {featured && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-semibold tracking-[0.14em] text-white backdrop-blur">
            <span className="size-1.5 rounded-full bg-cart-accent shadow-[0_0_6px_var(--color-cart-accent-glow-strong)]" />
            DESTACADO
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1 p-4">
        <div className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-cart-accent">
          {date}
        </div>
        <div className="text-[18px] font-semibold tracking-[-0.015em]">{ev.title}</div>
        {ev.venue && (
          <div className="truncate text-[12.5px] text-cart-ink-3">{ev.venue}</div>
        )}
        <div className="mt-2 flex items-end justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-cart-ink-4">DESDE</div>
            <div className="font-mono text-[16px] font-semibold">{formatCents(minCents)}</div>
          </div>
          <span className="text-[12.5px] font-medium text-cart-ink-2 transition group-hover:text-white">
            Ver entradas →
          </span>
        </div>
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="mt-6 flex flex-col items-center gap-2 rounded-3xl border border-dashed border-cart-line bg-cart-bg-elev/40 px-6 py-12 text-center">
      <div className="text-[40px]">🌒</div>
      <div className="mt-1 text-[15px] font-semibold">Sin noches por ahora</div>
      <div className="max-w-[280px] text-[13px] text-cart-ink-3">
        Cuando publiquen un evento, aparecerá aquí. Pulsa Seguir para enterarte.
      </div>
    </div>
  );
}

function formatEventDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d
      .toLocaleString("es-PE", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
      .replace(".", "");
  } catch {
    return iso;
  }
}

function formatCents(cents: number | undefined): string {
  if (cents == null) return "—";
  const soles = cents / 100;
  const rounded = Number.isInteger(soles) ? soles.toFixed(0) : soles.toFixed(2);
  return `S/ ${rounded}`;
}
