import "server-only";

// Mismo origin que usa el resto de notificaciones (ResendRecoveryOtpSender,
// DispatchTicketDelivery) para construir URLs absolutas.
const APP_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL || "https://pasape.lat").replace(/\/$/, "");

export const rpName = "Pasape";

export const rpOrigin = (): string => APP_ORIGIN;

// WebAuthn ata cada credencial a un rpID (dominio) fijo — no funciona en
// preview deployments con subdominios aleatorios, solo en el dominio canónico.
export const rpID = (): string => {
  try {
    return new URL(APP_ORIGIN).hostname;
  } catch {
    return "localhost";
  }
};
