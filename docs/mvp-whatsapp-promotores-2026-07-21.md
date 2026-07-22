# MVP: Bot de ventas por WhatsApp para promotores — 21 jul 2026

## Contexto
Se pausó la campaña de 50 entrevistas (ver `discovery-entrevistas-estado-2026-07-20.md`,
solo sigue en pie la llamada ya agendada con Carlos Andrés Pinto Padgett). El fundador
decidió retomar código para probar tracción con una idea recogida de dos fuentes externas
(un fundador de ticketera previa + una sesión con Gemini): vender entradas por WhatsApp,
sin interfaz, con Instagram como canal de distribución.

La conversación de diseño (21 jul 2026) recorrió varias vueltas antes de aterrizar en el
scope final — documentado aquí para no repetir el mismo razonamiento después.

## Decisión de fondo: promotores, no organizadores, como punto de entrada
Los promotores ya tienen alcance en Instagram/WhatsApp y ya venden así hoy, de forma
informal (lista de papel o WhatsApp). El organizador NO entra en este MVP — se aborda
después, con data real de tracción como palanca (mismo patrón que "reenganchar a Paula
con demo en vivo").

## Por qué NO hay QR de acceso en este MVP (decisión clave)
Primer diseño consideraba generar un QR real (reusando `ticket_types` + `signedQr`
existentes). Se descartó: el organizador de cualquier evento donde el promotor venda
ya tiene su propio control de puerta — un QR de Pasape ahí es decorativo, nadie lo
escanea. Construir sobre el dominio de tickets/QR firmado sería resolver un problema
que no existe todavía en este MVP.

**En su lugar:** un comprobante de venta simple (código corto, sin firma criptográfica,
sin vínculo a `ticket_types`). La puerta física sigue funcionando exactamente como hoy
(el promotor vocea/anota a quién metió). El QR de acceso real es una fase 2, cuando el
organizador se integre.

## Por qué SÍ reusar approveRegistration (decisión de arquitectura)
`SupabaseTicketRepository.approveRegistration`/`rejectRegistration` (líneas ~1626-1680)
ya implementan una transición atómica CAS `pending_approval → paid` con activación de
ticket y disparo de entrega — construido originalmente para RSVP gratuito con aprobación
del organizador (`ticket_types.requires_approval`). Se decidió NO reusarlo para este MVP
porque ya no hay `ticket_types` de por medio (ver arriba) — este mecanismo queda como
referencia de patrón (transición atómica, evitar el bug de orphan resuelto el 17 jul),
no como código a importar directamente.

## Autorización de la aprobación por WhatsApp
El mensaje "pagado" llega por Kapso desde un número de teléfono, sin sesión web. Se
decidió: mapear teléfono→promotor (tabla/columna nueva) y validar que la orden que se
intenta aprobar pertenece a ese promotor, antes de marcarla como pagada. Sin esa
validación, cualquiera que tenga el número de WhatsApp de Pasape podría aprobar órdenes
ajenas.

## Sobre el riesgo de que el promotor mienta sobre su propio pago
Aceptado como riesgo ya conocido — es el mismo riesgo de confianza que ya existe hoy con
las listas de invitados gratuitas (el promotor auto-gestiona, el organizador confía y
liquida después con data real). Se audita solo: cada aprobación queda registrada con
promotor + timestamp; si algo no cuadra al liquidar comisiones, se ve ahí. No se requiere
gatekeeping del organizador para cada venta — eso mataría el punto de usar WhatsApp sin
fricción.

## Conexión a WhatsApp — aclaración importante
NO se conecta al número personal de cada promotor (WhatsApp Business Platform requiere
migrar el número, y cada uno necesitaría su propia verificación de Meta — inviable). Se
usa el número único de Pasape ya integrado vía Kapso. Cada promotor comparte un link
`wa.me/<número Pasape>?text=PROMO-<código>` que abre el chat con el bot ya identificado
con su código. Pasape paga la facturación de Meta sobre su propio número — no hay
escenario de "pagar por el número de otro".

## Alcance final del MVP
1. Comprador escribe al número de Pasape vía link con código de promotor.
2. Bot (Kapso) cotiza, da datos de Yape/transferencia, crea registro de venta
   `pending_payment` (promotor, comprador, monto, ticket/producto, fecha).
3. Promotor responde "pagado <código>" en el mismo canal → backend valida
   teléfono→promotor→dueño de la orden → marca `paid` → genera código de comprobante
   simple → lo envía al comprador por WhatsApp.
4. Promotor responde "no llegó" → marca `rejected`, notifica al comprador.
5. El promotor puede pedir/ver un export a Excel de todas sus ventas en cualquier
   momento, sin acción manual de su parte (dolor ya validado en discovery: "export
   Excel").

## Lo que NO está en este MVP (explícitamente diferido)
- QR de acceso real / integración con la puerta del organizador — fase 2, con data de
  tracción como palanca de venta al organizador.
- OCR con IA de comprobantes de pago — el promotor ya sabe si le llegó el Yape (es su
  propia cuenta), no hace falta que una IA se lo confirme. Se reconsidera si el volumen
  crece tanto que el promotor ya no puede llevar la cuenta a mano.
- Panel web de aprobación — todo ocurre dentro del chat de WhatsApp.
- Mercado Pago — solo Yape/transferencia por ahora; MP queda como upgrade futuro sin
  reconstruir el flujo.
- Mercado Pago marketplace split — ya identificado como pitfall existente
  (`mp-single-account-no-marketplace-split`, no aplica aquí porque no se usa MP).

## Qué ya existe y se reusa
- Integración de WhatsApp vía Kapso — ya en el stack.
- Ninguna pieza del dominio de tickets (`ticket_types`, `signedQr`, `Order`) se reusa en
  este MVP — es deliberado, ver sección de QR arriba. Si esto sorprende en una revisión
  futura, no es un olvido: fue una decisión explícita del 21 jul 2026.

## Modelo de datos mínimo (nuevo, aislado del dominio de tickets)
Una tabla nueva, sin relación con `ticket_types`/`orders`/`tickets` existentes:
- venta: id, promoter_id, promoter_phone, buyer_phone, buyer_name?, producto/descripción,
  monto, estado (`pending_payment` | `paid` | `rejected`), confirmation_code, created_at,
  paid_at.
- promotor↔teléfono: columna o tabla de mapeo para autorizar quién puede aprobar qué.

## Próximos pasos
- Definir estructura exacta de la tabla + endpoint de webhook de Kapso.
- Definir copy del bot (cotización, instrucciones de pago, confirmación).
- Definir formato del export a Excel (columnas, on-demand vs programado).
- Crear cuenta de Instagram de marca + primer contenido en video (GTM, en paralelo).
