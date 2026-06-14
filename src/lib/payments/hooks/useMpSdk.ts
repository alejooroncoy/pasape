"use client";

import { useEffect, useState } from "react";

// Why: tanto YapeForm como CardForm necesitan la SDK v2 de MP cargada con la
// misma public key. Centralizamos aquí la carga y los tipos.

export type MpField = {
  mount: (el: HTMLElement | string) => void;
  unmount: () => void;
  on: (event: string, cb: (data: unknown) => void) => void;
};

export type MpFieldsFactory = {
  create: (
    kind: "cardNumber" | "securityCode" | "expirationDate",
    opts?: { placeholder?: string; style?: Record<string, unknown> },
  ) => MpField;
};

export type CardTokenInput = {
  cardNumber: string;
  cardholderName: string;
  cardExpirationMonth: string;
  cardExpirationYear: string;
  securityCode: string;
  identificationType: string;
  identificationNumber: string;
};

export type CardTokenResp = {
  id: string;
  first_six_digits?: string;
  last_four_digits?: string;
};

export type PaymentMethodResp = {
  results?: Array<{
    id: string;
    name: string;
    payment_type_id: string;
  }>;
};

export type MpInstance = {
  fields: MpFieldsFactory;
  createCardToken: (input: CardTokenInput) => Promise<CardTokenResp>;
  getPaymentMethods: (opts: { bin: string }) => Promise<PaymentMethodResp>;
  yape: (input: { otp: string; phoneNumber: string }) => { create: () => Promise<{ id: string }> };
};

export type MpCtor = new (publicKey: string, opts?: { locale?: string }) => MpInstance;

declare global {
  interface Window {
    MercadoPago?: MpCtor;
  }
}

const SDK_V2_URL = "https://sdk.mercadopago.com/js/v2";
const SDK_SCRIPT_ID = "mp-sdk-v2";

let cached: MpInstance | null = null;

const ensureSdkLoaded = (): Promise<void> =>
  new Promise((resolve, reject) => {
    if (typeof window === "undefined") return resolve();
    if (window.MercadoPago) return resolve();
    const existing = document.getElementById(SDK_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("mp_sdk_load_failed")), {
        once: true,
      });
      return;
    }
    const s = document.createElement("script");
    s.id = SDK_SCRIPT_ID;
    s.src = SDK_V2_URL;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("mp_sdk_load_failed"));
    document.head.appendChild(s);
  });

export function useMpSdk(onError?: (msg: string) => void): MpInstance | null {
  const [mp, setMp] = useState<MpInstance | null>(cached);

  useEffect(() => {
    if (cached) {
      setMp(cached);
      return;
    }
    const key = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;
    if (!key) {
      onError?.("missing_mp_public_key");
      return;
    }
    let cancelled = false;
    ensureSdkLoaded()
      .then(() => {
        if (cancelled || !window.MercadoPago) return;
        cached = new window.MercadoPago(key, { locale: "es-PE" });
        setMp(cached);
      })
      .catch((e) => onError?.((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [onError]);

  return mp;
}
