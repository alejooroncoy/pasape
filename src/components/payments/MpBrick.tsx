"use client";

import { useEffect, useRef } from "react";
import { Payment, initMercadoPago } from "@mercadopago/sdk-react";

type Props = {
  preferenceId: string;
  amount: number; // in major currency units (e.g. PEN)
  onPaid: () => void;
  onError?: (message: string) => void;
};

let mpInitialized = false;

/**
 * Embeds the Mercado Pago Payment Brick (Bricks SDK). Requires
 * `NEXT_PUBLIC_MP_PUBLIC_KEY` to be set at build time.
 *
 * On `onSubmit`, we trust the Brick to have submitted the payment to MP. The
 * authoritative status comes via the webhook, so here we just route to the
 * processing screen which polls `/api/tickets/order/[id]/status`.
 */
export function MpBrick({ preferenceId, amount, onPaid, onError }: Props) {
  const initOnce = useRef(false);

  useEffect(() => {
    if (initOnce.current) return;
    initOnce.current = true;
    const key = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;
    if (!key) {
      onError?.("missing_mp_public_key");
      return;
    }
    if (!mpInitialized) {
      initMercadoPago(key, { locale: "es-PE" });
      mpInitialized = true;
    }
  }, [onError]);

  if (!process.env.NEXT_PUBLIC_MP_PUBLIC_KEY) {
    return (
      <div style={{ color: "#ff6b6b", fontSize: 13 }}>
        Falta configurar <code>NEXT_PUBLIC_MP_PUBLIC_KEY</code>.
      </div>
    );
  }

  return (
    <Payment
      initialization={{ amount, preferenceId }}
      customization={{
        paymentMethods: {
          creditCard: "all",
          debitCard: "all",
          ticket: "all",
          bankTransfer: "all",
          mercadoPago: "all",
        },
      }}
      onSubmit={async () => {
        // The Brick handles submitting card/PSE/etc. data to MP itself when a
        // preferenceId is provided. We just need to resolve to let the brick
        // know we accepted, and then redirect to processing.
        try {
          onPaid();
        } catch (e) {
          onError?.((e as Error).message);
        }
      }}
      onError={(err) => {
        onError?.(typeof err === "string" ? err : (err as { message?: string })?.message ?? "brick_error");
      }}
    />
  );
}
