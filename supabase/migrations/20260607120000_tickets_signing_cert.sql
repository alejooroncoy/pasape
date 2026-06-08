-- Certificado de firma por ticket para validación offline asimétrica.
--
-- Modelo de clave NO-EXTRAÍBLE (la defensa anti-compartir central):
--   - El device del comprador genera un par ECDSA P-256 no-extraíble la 1ª vez
--     (Web Crypto generateKey(..., extractable=false)). La PRIVADA vive solo en
--     IndexedDB del comprador y nunca puede exportarse → el server jamás la tiene.
--   - El device registra su PÚBLICA (signing_pub). El server firma un certificado
--     con la privada del evento: cert = sign(priv_evento, {ticketId, holderName,
--     dniLast2, zoneId, ticket_pub, exp}). Eso liga la pública del ticket al evento.
--   - El QR rotativo (cada 10s) = cert . window . sign(priv_ticket, "ticketId|window").
--   - El portero verifica offline: verify(pub_evento, cert) + verify(ticket_pub, window).
--
-- Por eso NO se guarda signing_private en el server: la privada del ticket es
-- del device. signing_cert/signing_pub son null hasta que el device registra su
-- pública (online la 1ª carga). Tickets sin cert validan por HMAC legacy.

alter table tickets
  add column signing_cert text,
  add column signing_pub  jsonb;
