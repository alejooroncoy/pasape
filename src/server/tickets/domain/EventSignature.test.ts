import { describe, expect, it } from "vitest";
import { exportJWK, type JWK } from "jose";
import { WINDOW_SECONDS } from "./RotatingQr";
import {
  buildSignedQrPayload,
  generateEventKeypair,
  signTicketCert,
  signWindow,
  verifyCert,
  verifySignedQr,
  type TicketCertClaims,
} from "./EventSignature";

const windowAt = (now: number) => Math.floor(now / 1000 / WINDOW_SECONDS);

/** Genera un par de ticket (privada CryptoKey + pública JWK), como en el device. */
async function makeTicketKey(): Promise<{ priv: CryptoKey; pub: JWK }> {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const pub = await exportJWK(pair.publicKey);
  return { priv: pair.privateKey, pub };
}

async function setup() {
  const event = await generateEventKeypair();
  const ticket = await makeTicketKey();
  const claims: TicketCertClaims = {
    ticketId: "11111111-1111-1111-1111-111111111111",
    holderName: "Paula Reyes",
    dniLast2: "42",
    zoneId: "zone-principal",
    ticketPub: ticket.pub,
  };
  // exp se compara contra la hora real (jose) → emitir el cert con Date.now().
  const cert = await signTicketCert(event.privateJwk, claims);
  return { event, ticket, claims, cert };
}

/** Construye un QR válido para el window de `now`. */
async function freshQr(
  ticketPriv: CryptoKey,
  ticketId: string,
  cert: string,
  now: number,
): Promise<string> {
  const w = windowAt(now);
  const sig = await signWindow(ticketPriv, ticketId, w);
  return buildSignedQrPayload(cert, w, sig);
}

describe("verifyCert", () => {
  it("acepta un cert válido y devuelve los datos del titular", async () => {
    const { event, claims, cert } = await setup();
    const out = await verifyCert(event.publicJwk, cert);
    expect(out).not.toBeNull();
    expect(out?.ticketId).toBe(claims.ticketId);
    expect(out?.holderName).toBe("Paula Reyes");
    expect(out?.dniLast2).toBe("42");
    expect(out?.ticketPub).toBeTruthy();
  });

  it("rechaza un cert firmado por OTRO evento", async () => {
    const { cert } = await setup();
    const otherEvent = await generateEventKeypair();
    const out = await verifyCert(otherEvent.publicJwk, cert);
    expect(out).toBeNull();
  });

  it("rechaza un cert expirado", async () => {
    const event = await generateEventKeypair();
    const ticket = await makeTicketKey();
    const cert = await signTicketCert(
      event.privateJwk,
      {
        ticketId: "t",
        holderName: null,
        dniLast2: null,
        zoneId: null,
        ticketPub: ticket.pub,
      },
      { ttlSeconds: -10 },
    );
    // jwtVerify compara exp contra la hora real (ya pasó) → null.
    const out = await verifyCert(event.publicJwk, cert);
    expect(out).toBeNull();
  });
});

describe("verifySignedQr", () => {
  it("acepta un QR fresco firmado por el ticket", async () => {
    const { event, ticket, claims, cert } = await setup();
    const now = Date.now();
    const qr = await freshQr(ticket.priv, claims.ticketId, cert, now);
    const out = await verifySignedQr(event.publicJwk, qr, now);
    expect(out.valid).toBe(true);
    if (out.valid) expect(out.claims.ticketId).toBe(claims.ticketId);
  });

  it("rechaza un screenshot viejo (window fuera de tolerancia)", async () => {
    const { event, ticket, claims, cert } = await setup();
    const now = Date.now();
    // Firma un window de hace ~5 ventanas (50s) y se presenta ahora.
    const oldNow = now - 5 * WINDOW_SECONDS * 1000;
    const qr = await freshQr(ticket.priv, claims.ticketId, cert, oldNow);
    const out = await verifySignedQr(event.publicJwk, qr, now);
    expect(out.valid).toBe(false);
    if (!out.valid) expect(out.reason).toBe("bad_window");
  });

  it("rechaza una firma de window adulterada", async () => {
    const { event, ticket, claims, cert } = await setup();
    const now = Date.now();
    const w = windowAt(now);
    const sig = await signWindow(ticket.priv, claims.ticketId, w);
    // Adultera un caracter de la firma.
    const tampered = sig.slice(0, -2) + (sig.endsWith("A") ? "BB" : "AA");
    const qr = buildSignedQrPayload(cert, w, tampered);
    const out = await verifySignedQr(event.publicJwk, qr, now);
    expect(out.valid).toBe(false);
    if (!out.valid) expect(out.reason).toBe("bad_window");
  });

  it("rechaza una firma de window de OTRO ticket", async () => {
    const { event, claims, cert } = await setup();
    const intruso = await makeTicketKey();
    const now = Date.now();
    const w = windowAt(now);
    // Firma con la privada de un ticket distinto al del cert.
    const sig = await signWindow(intruso.priv, claims.ticketId, w);
    const qr = buildSignedQrPayload(cert, w, sig);
    const out = await verifySignedQr(event.publicJwk, qr, now);
    expect(out.valid).toBe(false);
    if (!out.valid) expect(out.reason).toBe("bad_window");
  });

  it("rechaza un QR malformado", async () => {
    const { event } = await setup();
    const out = await verifySignedQr(event.publicJwk, "no-es-un-qr", Date.now());
    expect(out.valid).toBe(false);
    if (!out.valid) expect(out.reason).toBe("malformed");
  });
});
