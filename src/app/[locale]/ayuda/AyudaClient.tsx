"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { Nav, type NavUser } from "../_home/Nav";
import { Footer } from "../_home/Footer";
import { WaFloat } from "../_home/WaFloat";
import { AmbientGlow } from "../_home/AmbientGlow";
import { UserTabbar } from "@/components/layout/UserTabbar";
import { SideDrawer } from "../_home/SideDrawer";
import { SignInDrawer } from "../_home/SignInDrawer";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import type { BreadcrumbItem } from "@/lib/seo/jsonld";

type Faq = { q: string; a: string };

type Props = {
  user: NavUser | null;
  breadcrumbs: BreadcrumbItem[];
  h1: string;
  description: string;
  faqs: readonly Faq[];
};

export function AyudaClient({ user, breadcrumbs, h1, description, faqs }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);

  return (
    <div className="cart-grain relative min-h-screen overflow-hidden bg-cart-bg text-white font-sans">
      <AmbientGlow />
      <div className="relative z-[1]">
        <Nav
          user={user}
          onOpenDrawer={() => setDrawerOpen(true)}
          onOpenSignIn={() => setSignInOpen(true)}
          onSearch={() => {}}
          onSelectCategory={() => {}}
          selectedCategory={null}
        />
        <main className="px-[clamp(20px,4vw,56px)] py-8 pb-[88px] lg:pb-12">
          <div className="mx-auto max-w-[900px]">
            <Breadcrumbs items={breadcrumbs} />
            <h1 className="mt-4 font-sans text-[clamp(26px,4vw,36px)] font-bold tracking-[-0.03em] text-white">
              {h1}
            </h1>
            <p className="mt-2 max-w-[62ch] text-[15px] leading-relaxed text-cart-ink-3">
              {description}
            </p>

            <section aria-labelledby="faq-heading" className="mt-10">
              <h2 id="faq-heading" className="text-[20px] font-semibold text-white">
                Preguntas frecuentes
              </h2>
              <dl className="mt-5 space-y-4">
                {faqs.map(({ q, a }) => (
                  <div
                    key={q}
                    className="rounded-2xl border border-cart-line bg-cart-bg-elev/40 p-5"
                  >
                    <dt className="text-[15px] font-medium text-white">{q}</dt>
                    <dd className="mt-2 text-[14px] leading-relaxed text-cart-ink-3">{a}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section aria-labelledby="links-heading" className="mt-10">
              <h2 id="links-heading" className="text-[20px] font-semibold text-white">
                Más recursos
              </h2>
              <ul className="mt-4 flex list-none flex-col gap-2 p-0 text-[14px] text-cart-ink-2">
                <li>
                  <Link href="/" className="hover:text-white">
                    Ver eventos
                  </Link>
                </li>
                <li>
                  <Link href="/organizadores" className="hover:text-white">
                    Soy organizador
                  </Link>
                </li>
                <li>
                  <Link href="/complaints" className="hover:text-white">
                    Libro de reclamaciones
                  </Link>
                </li>
              </ul>
            </section>
          </div>
        </main>
        <Footer />
        <WaFloat />
        <UserTabbar />
        <SideDrawer
          user={user}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          onSignIn={() => setSignInOpen(true)}
        />
        <SignInDrawer open={signInOpen} onClose={() => setSignInOpen(false)} />
      </div>
    </div>
  );
}
