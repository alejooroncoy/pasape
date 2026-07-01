import "server-only";
import { MercadoPagoConfig } from "mercadopago";

// Why: `env.mpAccessToken` returns "" si no está seteado para no romper
// `pnpm build`. Aquí validamos en runtime y dejamos un error claro.

const TIMEOUT_MS = 5_000;

/**
 * Builds a MercadoPagoConfig.
 *
 * When the seller organization has an `mp_account_id` (marketplace mode),
 * we still authenticate with the platform access token. Real OAuth-based
 * split payments require the seller's own access token and the
 * `marketplace`/`marketplace_fee` fields in the preference body; until we
 * onboard sellers via OAuth (F11), we operate in single-seller mode.
 */
export const mpClient = (opts?: { sellerAccessToken?: string | null }): MercadoPagoConfig => {
  const token = opts?.sellerAccessToken || process.env.MP_ACCESS_TOKEN || "";
  if (!token) {
    throw new Error(
      "missing_mp_access_token: set MP_ACCESS_TOKEN (or onboard the org via MP OAuth)",
    );
  }
  return new MercadoPagoConfig({
    accessToken: token,
    options: { timeout: TIMEOUT_MS },
  });
};

export const mpWebhookSecret = (): string => {
  const s = process.env.MP_WEBHOOK_SECRET || "";
  if (!s) throw new Error("missing_mp_webhook_secret");
  return s;
};

export const appBaseUrl = (): string => {
  const explicit = process.env.APP_BASE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL;
  if (vercel) return vercel.startsWith("http") ? vercel.replace(/\/$/, "") : `https://${vercel}`;
  return "http://localhost:3000";
};

// MP rechaza `back_urls`/`notification_url` que no sean públicas (loopback,
// IPs de LAN, o http sin TLS) cuando `auto_return`/webhook están activos. Solo
// consideramos "pública" una URL https cuyo host no sea loopback ni una IP
// privada (192.168 / 10 / 172.16-31). En dev sin túnel → false → omitimos esos
// campos y el polling de status cubre la confirmación.
export const isPublicBaseUrl = (base: string = appBaseUrl()): boolean => {
  const isPrivateHost =
    /localhost|127\.0\.0\.1|0\.0\.0\.0|::1|\/\/(?:10|192\.168|172\.(?:1[6-9]|2\d|3[01]))\./.test(
      base,
    );
  return base.startsWith("https://") && !isPrivateHost;
};
