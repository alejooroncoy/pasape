-- DNI del holder de la entrada, protegido.
--   holder_dni_enc:   DNI completo CIFRADO (AES-256-GCM, clave en env DNI_ENC_KEY).
--                     Se descifra server-side para la lista del organizador y el
--                     export Excel. Un dump de la BD NO lo expone.
--   holder_dni_last4: últimos 4 dígitos (NO identificables) → es lo único que se
--                     cachea offline en el celular del portero para la búsqueda
--                     en puerta ("no tengo QR pero compré") + display "··2442".
-- Se capturan cuando el holder se define (checkout, claim, setHolder), con el DNI
-- del que de verdad va a entrar (no el del comprador).
-- holder_dni_last2 queda deprecada; se elimina en una migración posterior una vez
-- migrado todo el código a last4 (expand-contract).
alter table tickets add column if not exists holder_dni_enc   text;
alter table tickets add column if not exists holder_dni_last4 text;
