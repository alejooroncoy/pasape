import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { routing } from "@/i18n/routing";
import { QueryProvider } from "@/lib/_shared/query-client";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import { PostLoginRedirect } from "@/components/auth/PostLoginRedirect";
import { PostHogIdentify } from "@/components/analytics/PostHogIdentify";

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
      </QueryProvider>
      <ServiceWorkerRegister />
    </NextIntlClientProvider>
  );
}
