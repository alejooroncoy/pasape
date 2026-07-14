"use client";

// Ruta interceptora: en soft-nav a /events/[slug]/buy?order=… (el hand-off de la
// hoja de datos tras crear la orden), Next la intercepta y pinta el PAGO como
// overlay que CRECE sobre el evento — sin salto de página. La hoja de datos
// sigue montada debajo (en `children`), así "atrás" (router.back) cierra el
// overlay y la revela (Corregir → datos). En hard-nav/refresh cae la ruta real.
//
// Solo el caso `?order=` es overlay (el pago). Un /buy pelado no trae order →
// devolvemos null y el slot deja pasar a la ruta completa.

import { use } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { PayDrawer } from "../../_checkout/PayDrawer";
import { CheckoutPaySurface } from "../../_checkout/CheckoutPaySurface";

type Props = { params: Promise<{ slug: string }> };

export default function InterceptedBuyPay({ params }: Props) {
  const { slug } = use(params);
  const search = useSearchParams();
  const router = useRouter();
  const order = search.get("order");
  if (!order) return null;
  // `inline=1`: la CheckoutSheet ya está mostrando el pago dentro de la MISMA
  // hoja que creció (no queremos un segundo overlay encima). El intercept se
  // hace a un lado; en hard-nav/refresh cae la ruta real /buy (full page).
  if (search.get("inline") === "1") return null;

  return (
    <PayDrawer title="Pago" onClosed={() => router.back()}>
      {({ arrived }) =>
        arrived ? (
          <CheckoutPaySurface
            slug={slug}
            orderId={order}
            orderToken={search.get("k")}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <div className="size-11 rounded-full border-[3px] border-cart-line-strong border-t-cart-accent animate-[spin_0.8s_linear_infinite]" />
            <p className="mt-4 text-[13.5px] text-cart-ink-2">Preparando el pago…</p>
          </div>
        )
      }
    </PayDrawer>
  );
}
