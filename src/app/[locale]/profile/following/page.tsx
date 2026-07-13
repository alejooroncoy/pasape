"use client";

import { Link } from "@/i18n/navigation";
import { useFollowing } from "@/lib/identity/hooks/useFollowing";
import type { FollowedOrg } from "@/server/identity/application/ListFollows";
import { PageShell, BackLink, PageTitle } from "../_components/PageShell";

const palette: Array<[string, string]> = [
  ["#4B1F9A", "#FF4D5E"],
  ["#22D17F", "#7C3AED"],
  ["#FFCE3B", "#FF4D5E"],
  ["#7C3AED", "#22D17F"],
  ["#FF4D5E", "#7C3AED"],
];

const colorsFor = (slug: string, fallback: string | null): [string, string] => {
  if (fallback) return [fallback, "#7C3AED"];
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
};

function FollowRow({ org }: { org: FollowedOrg }) {
  const [c1, c2] = colorsFor(org.slug, org.brandColor);
  return (
    <Link
      href={`/${org.slug}` as never}
      className="flex items-center gap-3 rounded-2xl border border-cart-line bg-cart-bg-elev px-3.5 py-3 transition hover:border-cart-line-strong"
    >
      {org.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={org.logoUrl}
          alt={org.name}
          referrerPolicy="no-referrer"
          className="size-12 shrink-0 rounded-xl object-cover"
        />
      ) : (
        <div
          className="grid size-12 shrink-0 place-items-center rounded-xl text-[18px] font-extrabold tracking-[-0.02em] text-white"
          style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
        >
          {org.name[0]?.toUpperCase() ?? "·"}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14.5px] font-semibold leading-tight text-cart-ink">{org.name}</p>
        <p className="mt-0.5 truncate text-[12px] text-cart-ink-3">@{org.slug}</p>
      </div>
      <span className="shrink-0 rounded-full bg-cart-bg-elev-2 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-cart-ink-3">
        Siguiendo
      </span>
    </Link>
  );
}

export default function BuyerFollowingPage() {
  const { data, isLoading, error } = useFollowing();
  const items = data ?? [];

  return (
    <PageShell>
      <BackLink />
      <PageTitle title="Tus crews favoritas" subtitle="Te avisamos cuando lancen algo nuevo." />

      {isLoading && (
        <div className="flex flex-col gap-2.5 pt-5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[68px] animate-pulse rounded-2xl bg-cart-bg-elev" />
          ))}
        </div>
      )}
      {error && <p className="pt-6 text-[13px] text-red-600">{(error as Error).message}</p>}

      {!isLoading && !error && items.length === 0 && (
        <div className="mt-6 rounded-2xl border border-cart-line bg-cart-bg-elev p-6 text-center text-[13.5px] text-cart-ink-3">
          Aún no sigues a ningún organizador.
        </div>
      )}

      {items.length > 0 && (
        <div className="flex flex-col gap-2.5 pt-5">
          {items.map((org) => (
            <FollowRow key={org.id} org={org} />
          ))}
        </div>
      )}
    </PageShell>
  );
}
