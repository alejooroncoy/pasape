import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/brand/Logo";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, type BreadcrumbItem } from "@/lib/seo/jsonld";
import { Footer } from "@/app/[locale]/_home/Footer";

type Props = {
  locale: string;
  breadcrumbs: BreadcrumbItem[];
  h1: string;
  description: string;
  children: ReactNode;
};

export function EventosPageShell({ locale, breadcrumbs, h1, description, children }: Props) {
  return (
    <div className="cart-grain relative min-h-screen bg-cart-bg text-white font-sans">
      <header className="border-b border-cart-line px-[clamp(20px,4vw,56px)] py-5">
        <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-4">
          <Link href="/" className="inline-flex items-center gap-2.5 text-[19px] font-semibold tracking-[-0.01em] text-white">
            <span className="grid size-[34px] place-items-center">
              <Logo className="size-full" />
            </span>
            Pasape
          </Link>
          <Link
            href="/organizadores"
            className="rounded-full border border-cart-line-2 px-4 py-2 text-[13px] text-cart-ink-2 transition-colors hover:border-white/30 hover:text-white"
          >
            Organizadores
          </Link>
        </div>
      </header>

      <main className="px-[clamp(20px,4vw,56px)] py-10">
        <div className="mx-auto max-w-[1320px]">
          <JsonLd data={breadcrumbJsonLd(breadcrumbs, locale)} />
          <Breadcrumbs items={breadcrumbs} />
          <h1 className="mt-4 text-[clamp(28px,4vw,40px)] font-bold tracking-[-0.03em] text-white">
            {h1}
          </h1>
          <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-cart-ink-3">
            {description}
          </p>
          {children}
        </div>
      </main>

      <Footer />
    </div>
  );
}
