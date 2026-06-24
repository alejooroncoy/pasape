/**
 * Benchmark: QR compacto (112 chars) vs QR legado (cert~window~sig ~600 chars)
 * node scripts/benchmark-qr.mjs
 */

import { webcrypto } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const jsQR    = require("jsqr");
const QRCode  = require("qrcode");
const { SignJWT, jwtVerify, importJWK } = await import("jose");

const subtle = webcrypto.subtle;
const RUNS = 60;

// ── Helpers ──────────────────────────────────────────────────────────────────

const b64u = (b) => Buffer.from(b).toString("base64url");
const unb64u = (s) => Buffer.from(s, "base64url");

function uuidToBytes(uuid) {
  const hex = uuid.replace(/-/g, "");
  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function bench(label, fn) {
  for (let i = 0; i < 5; i++) await fn();       // warm-up
  const times = [];
  for (let i = 0; i < RUNS; i++) {
    const t0 = performance.now();
    await fn();
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const p50 = times[Math.floor(RUNS * 0.50)];
  const p95 = times[Math.floor(RUNS * 0.95)];
  const min = times[0];
  const tag = avg < 1 ? "🟢" : avg < 5 ? "🟡" : "🔴";
  console.log(`  ${tag} ${label.padEnd(42)} avg=${avg.toFixed(2).padStart(6)}ms  p50=${p50.toFixed(2).padStart(6)}ms  p95=${p95.toFixed(2).padStart(6)}ms`);
  return { avg, p50, p95, min };
}

// ── Setup ─────────────────────────────────────────────────────────────────────

console.log("Generando claves ECDSA P-256…\n");

const { privateKey: eventPriv, publicKey: eventPub } = await subtle.generateKey(
  { name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]
);
const { privateKey: ticketPriv, publicKey: ticketPub } = await subtle.generateKey(
  { name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]
);
const ticketPubJwk = await subtle.exportKey("jwk", ticketPub);
const eventPrivJwk = await subtle.exportKey("jwk", eventPriv);
const eventPubJwk  = await subtle.exportKey("jwk", eventPub);

const ticketId  = "49f2b03c-5e26-48c8-98e2-e5f550c10709";
const windowIdx = Math.floor(Date.now() / 1000 / 10);
const enc       = new TextEncoder();
const winMsg    = enc.encode(`${ticketId}|${windowIdx}`);

// Cert JWT (legado)
const eventKey = await importJWK(eventPrivJwk, "ES256");
const cert = await new SignJWT({ holderName: "Alejandro Oroncoy", dniLast2: "09", zoneId: null, ticketPub: ticketPubJwk })
  .setProtectedHeader({ alg: "ES256" })
  .setSubject(ticketId)
  .setIssuedAt()
  .setExpirationTime("36h")
  .sign(eventKey);

// Firma de ventana
const sigBytes = await subtle.sign({ name: "ECDSA", hash: "SHA-256" }, ticketPriv, winMsg);
const sig = b64u(new Uint8Array(sigBytes));

// Payloads
const legacyPayload  = `${cert}~${windowIdx}~${sig}`;
const compactBuf     = new Uint8Array(84);
compactBuf.set(uuidToBytes(ticketId), 0);
new DataView(compactBuf.buffer).setUint32(16, windowIdx, false);
compactBuf.set(unb64u(sig), 20);
const compactPayload = b64u(compactBuf);

console.log(`Payload legado:   ${legacyPayload.length} chars`);
console.log(`Payload compacto: ${compactPayload.length} chars`);
console.log(`Reducción:        ${((1 - compactPayload.length / legacyPayload.length) * 100).toFixed(0)}%\n`);

// ── 1. Generación del QR bitmap ───────────────────────────────────────────────

console.log("━━ 1. Generación bitmap QR ━━");

const r1a = await bench("Legado  (~600 chars) generación QR", () =>
  QRCode.toString(legacyPayload, { type: "utf8", errorCorrectionLevel: "H" })
);
const r1b = await bench("Compacto (~112 chars) generación QR", () =>
  QRCode.toString(compactPayload, { type: "utf8", errorCorrectionLevel: "H" })
);

// ── 2. Decodificación jsQR (simula la cámara) ─────────────────────────────────

console.log("\n━━ 2. Decodificación jsQR (simula cámara) ━━");

async function toImageData(payload, ecLevel = "H") {
  const matrix = QRCode.create(payload, { errorCorrectionLevel: ecLevel });
  const size  = matrix.modules.size;
  const scale = Math.max(1, Math.ceil(300 / size));
  const px    = size * scale;
  const data  = new Uint8ClampedArray(px * px * 4);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const dark = matrix.modules.get(r, c);
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const i = ((r * scale + dy) * px + (c * scale + dx)) * 4;
          const v = dark ? 0 : 255;
          data[i] = v; data[i+1] = v; data[i+2] = v; data[i+3] = 255;
        }
      }
    }
  }
  return { data, width: px, height: px, moduleCount: size };
}

const legacyImg  = await toImageData(legacyPayload);
const compactImg = await toImageData(compactPayload);

console.log(`  QR legado:   ${legacyImg.moduleCount} módulos × ${legacyImg.width}px`);
console.log(`  QR compacto: ${compactImg.moduleCount} módulos × ${compactImg.width}px\n`);

const r2a = await bench("Legado  decode jsQR", () =>
  jsQR(legacyImg.data, legacyImg.width, legacyImg.height)
);
const r2b = await bench("Compacto decode jsQR", () =>
  jsQR(compactImg.data, compactImg.width, compactImg.height)
);

// ── 3. Verificación criptográfica ─────────────────────────────────────────────

console.log("\n━━ 3. Verificación criptográfica offline ━━");

const eventPubKey = await importJWK(eventPubJwk, "ES256");

const r3a = await bench("Legado  verify (JWT + ECDSA window)", async () => {
  const { payload } = await jwtVerify(cert, eventPubKey, { algorithms: ["ES256"] });
  const key = await subtle.importKey("jwk", payload.ticketPub, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  await subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, unb64u(sig), winMsg);
});

// Con importKey (primera vez por ticket, sin CryptoKey cacheada)
const r3b = await bench("Compacto verify (importKey + ECDSA)", async () => {
  const key = await subtle.importKey("jwk", ticketPubJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  await subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, unb64u(sig), winMsg);
});

// Con CryptoKey ya cacheada en Map (caso real: portero carga sesión)
const keyCache = new Map();
keyCache.set(ticketId, await subtle.importKey("jwk", ticketPubJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]));

const r3c = await bench("Compacto verify (CryptoKey cacheada)", async () => {
  const key = keyCache.get(ticketId);
  await subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, unb64u(sig), winMsg);
});

// ── 4. Resumen ────────────────────────────────────────────────────────────────

console.log("\n━━ 4. Tiempo total estimado (decode p50 + verify p50) ━━\n");

const totalLegado   = r2a.p50 + r3a.p50;
const totalCompacto = r2b.p50 + r3c.p50; // caso real: claves cacheadas al abrir sesión portero
const speedup = ((1 - totalCompacto / totalLegado) * 100).toFixed(0);

console.log(`  Legado   (decode + JWT verify + ECDSA): ${totalLegado.toFixed(2)}ms`);
console.log(`  Compacto (decode + ECDSA cacheado):     ${totalCompacto.toFixed(2)}ms`);
console.log(`  Mejora:  ${speedup}% más rápido\n`);
console.log("  Nota: en dispositivo real (cámara física) el decode domina (~50-200ms extra).");
console.log("  El QR compacto reduce módulos → cámara enfoca más rápido → ganancia adicional.");
