// Scrubber compartido por los tres configs de Sentry (client / server / edge).
// Módulo puro (sin deps de runtime) para poder importarse en browser y node.
//
// Objetivo: aunque un error arrastre datos sensibles (número de tarjeta, CVV,
// DNI, email, tokens, cookies de sesión), nunca deben salir hacia Sentry. Es
// defensa en profundidad: además apagamos sendDefaultPii e includeLocalVariables
// en los init, pero esto cubre lo que igual pudiera colarse por request bodies,
// extra data o breadcrumbs.

const REDACTED = "[redacted]";

// Nombres de campo que jamás deben viajar. Se compara en minúsculas y por
// inclusión de substring, así que "cardNumber", "card_number", "holderDni",
// "mp_access_token", etc. quedan cubiertos.
const SENSITIVE_KEYS = [
  "card_number",
  "cardnumber",
  "security_code",
  "securitycode",
  "cvv",
  "cvc",
  "card",
  "dni",
  "identification",
  "email",
  "phone",
  "password",
  "secret",
  "token",
  "authorization",
  "cookie",
  "access_token",
  "api_key",
  "apikey",
  "private_key",
  "signing_pub",
];

const isSensitiveKey = (key: string): boolean => {
  const k = key.toLowerCase();
  return SENSITIVE_KEYS.some((needle) => k.includes(needle));
};

// Redacta in-place, con guardas de profundidad y ciclos para no colgar Sentry.
const redactDeep = (value: unknown, seen: WeakSet<object>, depth: number): unknown => {
  if (depth > 8 || value === null || typeof value !== "object") return value;
  if (seen.has(value as object)) return value;
  seen.add(value as object);

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      value[i] = redactDeep(value[i], seen, depth + 1);
    }
    return value;
  }

  const obj = value as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (isSensitiveKey(key)) {
      obj[key] = REDACTED;
      continue;
    }
    obj[key] = redactDeep(obj[key], seen, depth + 1);
  }
  return obj;
};

type SentryEventLike = {
  request?: {
    cookies?: unknown;
    headers?: Record<string, unknown>;
    data?: unknown;
  };
  extra?: unknown;
  contexts?: unknown;
  exception?: {
    values?: Array<{
      stacktrace?: { frames?: Array<{ vars?: unknown }> };
    }>;
  };
};

// beforeSend / beforeSendLog: recorre las zonas del evento que suelen cargar
// datos de usuario y las redacta. Devuelve el mismo evento mutado.
export const scrubSentryEvent = <T extends SentryEventLike>(event: T): T => {
  const seen = new WeakSet<object>();

  if (event.request) {
    // Cookies llevan el token de sesión; fuera siempre.
    if (event.request.cookies) event.request.cookies = REDACTED;
    if (event.request.headers) {
      for (const key of Object.keys(event.request.headers)) {
        if (isSensitiveKey(key)) event.request.headers[key] = REDACTED;
      }
    }
    if (event.request.data) {
      event.request.data = redactDeep(event.request.data, seen, 0);
    }
  }

  if (event.extra) event.extra = redactDeep(event.extra, seen, 0);
  if (event.contexts) event.contexts = redactDeep(event.contexts, seen, 0);

  // Variables locales de cada stack frame (por si includeLocalVariables se
  // reactiva en el futuro): aquí es donde vivirían card_number/security_code.
  for (const val of event.exception?.values ?? []) {
    for (const frame of val.stacktrace?.frames ?? []) {
      if (frame.vars) frame.vars = redactDeep(frame.vars, seen, 0);
    }
  }

  return event;
};
