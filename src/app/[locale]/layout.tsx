import type { ReactNode } from "react";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Toaster } from "sonner";
import { routing } from "@/i18n/routing";
import { QueryProvider } from "@/lib/_shared/query-client";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import { InstallPromptListener } from "@/components/pwa/InstallPromptListener";
import { PostLoginRedirect } from "@/components/auth/PostLoginRedirect";
import { PostHogIdentify } from "@/components/analytics/PostHogIdentify";
import { PageViewTracker } from "@/components/analytics/PageViewTracker";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <NextIntlClientProvider locale={locale}>
      <QueryProvider>
        {children}
        <PostLoginRedirect />
        <PostHogIdentify />
        <Suspense fallback={null}>
          <PageViewTracker />
        </Suspense>
      </QueryProvider>
      <ServiceWorkerRegister />
      <InstallPromptListener />
      {/* Estilo alineado al sistema cart-*: tarjeta elevada sobria, sin los
          colores saturados del default de sonner. */}
      <Toaster
        theme="dark"
        position="top-center"
        toastOptions={{
          unstyled: true,
          classNames: {
            toast:
              "w-full flex items-start gap-3 rounded-2xl border border-cart-line-strong bg-cart-bg-elev-2 px-4 py-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-md",
            title: "text-sm font-medium text-white",
            description: "mt-0.5 text-[13px] leading-snug text-cart-ink-3",
            icon: "mt-0.5 shrink-0 text-cart-accent",
          },
        }}
      />
    </NextIntlClientProvider>
  );
}
