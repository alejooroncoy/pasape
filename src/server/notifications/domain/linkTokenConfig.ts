// Longitud (en chars hex) a la que se truncan los HMAC de OrderLinkToken y
// TicketLinkToken: 16 chars hex = 64 bits, suficiente para mitigar
// enumeración dado que el id de origen ya es uuid v4. Constante compartida
// para que firma y verificación en ambos tokens no puedan divergir.
export const LINK_TOKEN_HEX_LENGTH = 16;
