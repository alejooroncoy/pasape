import { notFound } from "next/navigation";
import { Money } from "@/lib/_shared/money";
import { Link } from "@/i18n/navigation";
import { FollowButton } from "./_components/FollowButton";
import { ScrollToTop } from "./_components/ScrollToTop";
import { supabaseOrganizationRepository } from "@/server/identity/organizations/infrastructure/repositories/SupabaseOrganizationRepository";
import { supabaseEventRepository } from "@/server/events/infrastructure/repositories/SupabaseEventRepository";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { optimizeImageUrl } from "@/lib/images/optimizeUrl";
import { Footer } from "@/app/[locale]/_home/Footer";
import type { Event } from "@/server/events/domain/Event";
import type { Organization } from "@/server/identity/organizations/domain/Organization";

// Slugs reservados que NO deben tratarse como marca — chequeo extra
// para evitar colisiones con segmentos estáticos accidentalmente removidos.
const RESERVED = new Set([
  "org", "events", "auth", "login", "apply", "invites", "profile",
  "promo", "scan", "box", "tickets", "e", "t", "_home", "_next", "api", "r",
]);

// Página pública sin personalización server-side (FollowButton resuelve la
// sesión en el cliente), así que es segura de cachear: evita pegarle a
// Supabase (org + eventos + precios mínimos) en cada visita a la vitrina.
export const revalidate = 60;

type Props = {
  params: Promise<{ locale: string; orgSlug: string }>;
};

export default async function BrandPublicPage({ params }: Props) {
  const { orgSlug } = await params;
  if (RESERVED.has(orgSlug)) notFound();

  const org = await supabaseOrganizationRepository.findBySlug(orgSlug);
  if (!org) notFound();

  const { upcoming, minPrices } = await loadUpcomingEvents(orgSlug);
  const followerCount = await fetchFollowerCount(org.id);

  return (
    <BrandPageView org={org} events={upcoming} minPrices={minPrices} followerCount={followerCount} />
  );
}

// Helper fuera del render del Server Component: aquí Date.now() es válido
// (la regla de pureza de React solo aplica al cuerpo del componente).
async function loadUpcomingEvents(orgSlug: string) {
  const upcoming = await supabaseEventRepository.listPublishedByOrgSlug(orgSlug);
  const minPrices = await fetchMinPricesByEvent(upcoming.map((e) => e.id));
  return { upcoming, minPrices };
}

async function fetchFollowerCount(orgId: string): Promise<number> {
  const db = supabaseAdmin();
  const { count } = await db
    .from("follows")
    .select("follower_id", { count: "exact", head: true })
    .eq("organization_id", orgId);
  return count ?? 0;
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
  followerCount,
}: {
  org: Organization;
  events: Event[];
  minPrices: Record<string, number>;
  followerCount: number;
}) {
  const brand = org.brandColor ?? "#B87CFF";
  const handle = `@${org.slug}`;

  return (
    <>
      <ScrollToTop />

      {/* Panel de marca + eventos: en desktop el CONTENIDO (agenda de eventos)
          va a la izquierda y el panel de MARCA/ACCIÓN (identidad + Seguir) va
          fijo a la derecha — mismo orden que la página de evento (flyer a la
          izquierda, panel de compra sticky a la derecha): lo que la gente
          vino a ver pesa más que la ficha de quién lo organiza. En mobile se
          apila con la marca primero (orientación tipo perfil), eventos abajo. */}
      <div className="relative mx-auto w-full max-w-[1120px] px-5 pb-24 pt-6 lg:flex lg:items-start lg:gap-10 lg:px-10 lg:pt-10">
        <InfoPanel
          org={org}
          brand={brand}
          handle={handle}
          count={events.length}
          followerCount={followerCount}
          className="lg:order-2"
        />

        <div className="mt-6 min-w-0 flex-1 lg:order-1 lg:mt-0">
          <SectionTitle count={events.length} />
          <EventsList events={events} brand={brand} minPrices={minPrices} />
        </div>
      </div>

      <Footer />
    </>
  );
}

function InfoPanel({
  org,
  brand,
  handle,
  count,
  followerCount,
  className,
}: {
  org: Organization;
  brand: string;
  handle: string;
  count: number;
  followerCount: number;
  className?: string;
}) {
  return (
    <aside
      className={
        "shrink-0 overflow-hidden rounded-3xl border border-cart-line bg-gradient-to-br from-cart-bg-purple to-cart-bg lg:sticky lg:top-6 lg:w-[300px] " +
        (className ?? "")
      }
    >
      <div className="p-6">
        <BrandBadge name={org.name} color={brand} logoUrl={org.logoUrl} size={54} />
        <h1 className="mt-4 text-[23px] font-semibold leading-[1.1] tracking-[-0.02em] text-cart-ink text-balance">
          {org.name}
        </h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] text-cart-ink-3">
          <span className="font-mono">{handle}</span>
          {org.instagram && (
            <>
              <span>·</span>
              <InstagramLink handle={org.instagram} />
            </>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] text-cart-ink-3">
          {followerCount === 0 ? (
            <span>Sé el primer seguidor</span>
          ) : (
            <span>
              <b className="font-semibold text-cart-ink">{followerCount}</b>{" "}
              {followerCount === 1 ? "seguidor" : "seguidores"}
            </span>
          )}
          <span>·</span>
          <span>
            {count} {count === 1 ? "próximo" : "próximos"}
          </span>
        </div>

        {org.description && (
          <p className="mt-3 text-[13px] leading-relaxed text-cart-ink-3">
            {org.description}
          </p>
        )}

        <div className="mt-5">
          <FollowButton orgId={org.id} orgSlug={org.slug} />
        </div>
      </div>
    </aside>
  );
}

function InstagramLink({ handle }: { handle: string }) {
  return (
    <a
      href={`https://instagram.com/${handle}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-cart-ink-2 transition hover:text-cart-ink"
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

function BrandBadge({
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
      className="relative shrink-0 overflow-hidden rounded-xl shadow-[0_4px_16px_-6px_rgba(20,16,38,0.3)]"
      style={{ width: size, height: size }}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={optimizeImageUrl(logoUrl, "card") ?? logoUrl} alt={name} className="size-full object-cover" />
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


function SectionTitle({ count }: { count: number }) {
  return (
    <div className="flex items-baseline justify-between">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cart-ink-3">
          {count === 0 ? "SIN EVENTOS POR AHORA" : `${count} EVENTOS PRÓXIMOS`}
        </div>
        {count > 0 && (
          <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.02em] text-cart-ink">
            Próximos eventos
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
        <EventCard
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

function EventCard({
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
        style={!ev.coverUrl ? { background: `linear-gradient(135deg, ${brand}, #FF4D5E)` } : undefined}
      >
        {ev.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={optimizeImageUrl(ev.coverUrl, "card") ?? ev.coverUrl} alt="" className="size-full object-cover" />
        )}
      </div>
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

function EmptyState() {
  return (
    <div className="mt-6 flex flex-col items-center gap-3 rounded-3xl border border-dashed border-cart-line bg-cart-bg-elev/40 px-6 py-12 text-center">
      <div className="grid size-14 place-items-center rounded-full bg-cart-accent-soft text-cart-accent">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 3a5 5 0 0 0-5 5v2.6c0 .53-.2 1.04-.56 1.43L5 13.5c-.9.98-.2 2.5 1.13 2.5h11.74c1.33 0 2.03-1.52 1.13-2.5l-1.44-1.47a2.06 2.06 0 0 1-.56-1.43V8a5 5 0 0 0-5-5Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M9.5 18.5a2.5 2.5 0 0 0 5 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </div>
      <div className="text-[15px] font-semibold text-cart-ink">Aún no hay eventos anunciados</div>
      <div className="max-w-[280px] text-[13px] leading-relaxed text-cart-ink-3">
        Sigue esta marca y te avisamos apenas anuncien el próximo — directo a tu cuenta, sin tener que volver a buscar.
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
  if (cents === 0) return "Gratis";
  const soles = Money.toSoles(cents);
  const rounded = Number.isInteger(soles) ? soles.toFixed(0) : soles.toFixed(2);
  return `S/ ${rounded}`;
}
