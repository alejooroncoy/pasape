-- Evita el doble envío del QR: PayWithCard/PayWithYape (respuesta directa del
-- pago) y HandleWebhook (webhook real de MP) pueden ambos detectar "approved"
-- casi al mismo tiempo y disparar dispatchTicketDelivery — sin este guard,
-- el comprador recibe el email/WhatsApp duplicado. notified_at es un claim
-- atómico (UPDATE ... WHERE notified_at IS NULL): la primera invocación que
-- lo setea gana; la otra ve 0 filas afectadas y no despacha nada.
alter table orders add column if not exists notified_at timestamptz;
