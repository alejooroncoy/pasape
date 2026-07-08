// Scorer anti-bot por comportamiento. PURO: sin I/O, 100% testeable. Recibe
// señales ya agregadas (el repo hace las consultas) y devuelve un score 0-100
// con las razones que lo justifican.
//
// Prioridad de diseño (según la política antifraude de Pasape):
//   1º SCALPING / reventa automatizada  → señales de VOLUMEN y CORRELACIÓN pesan
//      más: muchas "identidades" (contactos/DNIs) desde un mismo device = granja.
//   2º CARDING → ratio de pagos fallidos por device/ip.
//
// PROTECCIÓN DE HUMANOS (por qué no frena usuarios reales):
//   - Las señales por IP pesan POCO: WiFi de oficina/universidad, NAT de carrier
//     y datos móviles hacen que muchos humanos reales compartan IP. Bloquear por
//     IP es la vía más rápida a falsos positivos, así que solo suma "ruido".
//   - Ninguna señal individual llega al umbral de bloqueo duro por sí sola. Un
//     humano con red inestable al que le falló el fetch del token NO se bloquea:
//     token ausente suma, pero sin corroboración de velocidad/volumen no cruza
//     HARD. El bloqueo exige que VARIAS señales apunten a lo mismo.
//   - La correlación device+contacto (la señal fuerte) requiere varias
//     identidades distintas: un humano comprando para su grupo usa 1 contacto.

export type PurchasePhase = "quote" | "buy" | "card" | "webhook_paid" | "webhook_failed";

export type BotSignalInput = {
  phase: PurchasePhase;

  // ── Coherencia de sesión ──
  // ¿el cliente traía un checkout-token firmado válido? false = pegó directo al
  // endpoint sin pasar por la página (automatización) o su emisión falló.
  checkoutTokenOk: boolean;
  // ms entre montar la página y esta acción, medido por el server vía el token.
  // null cuando no hubo token válido (no se puede medir).
  msSinceMount: number | null;
  // El token ya se usó en una compra anterior (nonce quemado en Redis). Un bot
  // que renderiza la página una vez y reusa el token para N órdenes cae aquí; el
  // cliente legítimo renueva el token tras cada compra, así que un humano no.
  tokenReplay: boolean;

  // Flujo saltado: es una compra (buy) SIN ningún quote previo desde el mismo
  // device en la ventana. Un humano cotiza en cada paso del checkout antes de
  // pagar; un script que pega directo a /buy se salta ese paso.
  buyWithoutQuote: boolean;

  // Incoherencias de cliente detectadas server-side (no las controla el JS del
  // cliente): p.ej. "chromium_no_client_hints" (UA dice Chrome pero faltan los
  // Client Hints que todo Chromium manda por HTTPS), "no_accept_language".
  serverHints: string[];

  // ── Automatización de navegador ──
  // Banderas que delatan un navegador manejado por Playwright/Puppeteer/Selenium
  // o un agente vía CDP (el cliente las reporta; el server suma coherencia). Un
  // humano real no dispara ninguna. Ej.: "webdriver", "headless_ua",
  // "software_renderer", "no_chrome_object", "no_plugins", "no_languages".
  automationHints: string[];

  // ── Contexto de la compra ──
  qty: number;
  // unidades restantes del ticket_type; null si se desconoce o es box.
  stockRemaining: number | null;

  // ── Agregados en ventana (los provee el repo desde purchase_signals) ──
  deviceAttemptsShort: number;    // intentos desde el mismo device en ~60 s
  deviceContactsDay: number;      // contactos DISTINTOS desde el mismo device en ~24 h
  deviceDnisDay: number;          // DNIs DISTINTOS desde el mismo device en ~24 h (multicuenta)
  dniDevicesDay: number;          // devices DISTINTOS que usaron el mismo DNI en ~24 h
  ipAttemptsShort: number;        // intentos desde la misma IP en ~60 s
  contactAttemptsShort: number;   // intentos desde el mismo contacto en ~60 s
  ipFailedPaymentsHour: number;   // pagos rechazados desde la IP en ~1 h (carding)
  deviceFailedPaymentsHour: number;
};

export type BotAssessment = { score: number; reasons: string[] };

// Umbrales de decisión. El enforcement los usa según BOT_ENFORCEMENT:
//   score >= SOFT → fricción suave (throttle / paso extra)
//   score >= HARD → bloqueo (solo en modo 'hard' y fuera del circuit breaker)
// Calibrados para que el tráfico humano quede muy por debajo de SOFT; ajústalos
// con la data de shadow-mode (métrica: % de pagos exitosos con score >= umbral).
export const SOFT_THRESHOLD = 45;
export const HARD_THRESHOLD = 70;

const clamp = (n: number): number => Math.max(0, Math.min(100, n));

/**
 * Puntúa un intento de compra. Aditivo y explicable: cada señal suma puntos y
 * agrega una razón. El score se satura en 100.
 */
export const botScore = (s: BotSignalInput): BotAssessment => {
  let score = 0;
  const reasons: string[] = [];
  const add = (points: number, reason: string) => {
    score += points;
    reasons.push(reason);
  };

  // ── Automatización de navegador (delata al agente que maneja Chrome) ─────
  // Estas señales, casi imposibles en un humano real, son las más fuertes contra
  // "reservar 20 a lo loco desde una herramienta". webdriver / UA headless /
  // renderer por software (SwiftShader/llvmpipe = sin GPU real = servidor) valen
  // mucho: combinadas con velocidad o token ausente cruzan HARD solas. Se
  // acumulan con tope para no sobre-reaccionar a un navegador viejo raro.
  // Client-side (el JS del navegador reporta; falseables con stealth, por eso
  // pesan pero necesitan corroboración) + server-side (headers, NO los controla
  // el JS del cliente; más durables aunque más ruidosos → peso menor).
  const autoWeights: Record<string, number> = {
    // client-side
    webdriver: 45, // navigator.webdriver === true (el marcador más directo)
    headless_ua: 45, // User-Agent contiene "HeadlessChrome"
    software_renderer: 40, // WebGL sin GPU real → headless/servidor
    no_chrome_object: 18, // UA dice Chrome pero window.chrome no existe
    no_plugins: 10, // navigator.plugins vacío en desktop
    no_languages: 12, // navigator.languages vacío
    // server-side (coherencia de headers)
    chromium_no_client_hints: 20, // UA Chromium por HTTPS pero sin sec-ch-ua (real Chrome siempre manda)
    no_accept_language: 8, // sin Accept-Language (raro en navegador real)
  };
  const allHints = [...s.automationHints, ...s.serverHints];
  let automationPoints = 0;
  for (const hint of allHints) automationPoints += autoWeights[hint] ?? 0;
  if (automationPoints > 0) {
    // Tope 75: dos marcadores fuertes (p.ej. headless_ua + software_renderer, o
    // webdriver + otro) cruzan HARD solos — casi imposibles en un humano real.
    // Un único marcador débil (no_plugins) queda muy por debajo de SOFT.
    score += Math.min(75, automationPoints);
    reasons.push(...allHints.filter((h) => h in autoWeights));
  }

  // ── Coherencia de sesión ────────────────────────────────────────────────
  // Token ausente: señal fuerte de automatización directa, pero NO letal por sí
  // sola (una red mala puede tumbar el fetch del token de un humano). 35 < HARD:
  // sola no bloquea ni siquiera throttlea; necesita corroboración.
  if (!s.checkoutTokenOk) add(35, "no_checkout_token");

  // Token reusado en otra compra (replay): un render → una orden. El cliente
  // legítimo renueva el token tras cada compra; reusar es scripting. 45: con una
  // señal más (velocidad, ráfaga) cruza HARD.
  if (s.tokenReplay) add(45, "token_replay");

  // Compra sin cotizar antes (flujo saltado): el checkout humano cotiza en cada
  // paso; pegar directo a /buy salta ese rastro. Moderado (una red mala pudo
  // tumbar el quote), corrobora con las demás.
  if (s.buyWithoutQuote) add(22, "buy_without_quote");

  // ── Velocidad (solo si hubo token para medirla con el reloj del server) ──
  if (s.msSinceMount != null) {
    if (s.msSinceMount < 800) add(30, "superhuman_speed");
    else if (s.msSinceMount < 2000) add(12, "very_fast");
  }

  // ── SCALPING: correlación device ↔ múltiples identidades (señal fuerte) ──
  // Muchos contactos distintos desde un mismo device en el día = granja. Escala
  // con el exceso sobre un umbral tolerante (un grupo de amigos comparte device
  // ocasionalmente, pero no 6+ correos por día). A 6 identidades cruza SOFT solo.
  if (s.deviceContactsDay >= 4) {
    add(Math.min(50, 30 + (s.deviceContactsDay - 4) * 6), "device_many_identities");
  }

  // ── MULTICUENTA: un device que opera muchas identidades por DNI ──────────
  // El límite del evento es por DNI; el multicuenta lo evade con N DNIs reales
  // (correo/IP rotados no lo esconden — device_many_identities ya los cuenta).
  // Aquí atamos por el DNI, el ancla dura. Umbral tolerante (>= 4): una persona
  // compra con SU DNI; un padre/grupo desde un device rara vez pasa de 3-4.
  if (s.deviceDnisDay >= 4) {
    add(Math.min(45, 25 + (s.deviceDnisDay - 4) * 7), "device_many_dni");
  }
  // Un mismo DNI apareciendo desde muchos devices = DNI farmeado o reusado a
  // través de una granja de devices rotados (el caso "rota también el device").
  if (s.dniDevicesDay >= 4) {
    add(Math.min(40, 20 + (s.dniDevicesDay - 4) * 6), "dni_many_devices");
  }

  // Ráfaga de intentos desde el mismo device en segundos: scripting.
  if (s.deviceAttemptsShort > 5) {
    add(Math.min(35, 22 + (s.deviceAttemptsShort - 6) * 4), "device_burst");
  }

  // Mismo contacto martillando el checkout.
  if (s.contactAttemptsShort > 3) add(15, "contact_burst");

  // Comprar buena parte del stock de golpe (vaciar entradas).
  if (s.stockRemaining != null && s.stockRemaining > 0 && s.qty >= s.stockRemaining * 0.5 && s.qty >= 4) {
    add(20, "bulk_stock_grab");
  }

  // ── IP: señal DÉBIL a propósito (NAT/carrier comparten IP entre humanos) ──
  if (s.ipAttemptsShort > 12) add(12, "ip_burst");

  // ── CARDING: ráfaga de pagos rechazados ─────────────────────────────────
  // A 6 rechazos/hora cruza SOFT solo; con token ausente (carder típico) → HARD.
  if (s.deviceFailedPaymentsHour >= 3) {
    add(Math.min(45, 30 + (s.deviceFailedPaymentsHour - 3) * 6), "device_failed_payments");
  }
  if (s.ipFailedPaymentsHour >= 4) {
    add(Math.min(28, 15 + (s.ipFailedPaymentsHour - 4) * 4), "ip_failed_payments");
  }

  return { score: clamp(score), reasons };
};
