-- Una sola solicitud de reembolso PENDIENTE por pago. Una orden con N entradas
-- comparte un único pago, así que sin esto el fan podía pedir reembolso desde
-- cada entrada (o por doble-tap) e inundar al equipo con filas/correos
-- duplicados. El repo (SupabaseTicketRepository.requestRefund) ya pre-chequea el
-- caso secuencial; este índice cierra la carrera de dos requests simultáneos:
-- el segundo insert choca (23505) y el código lo trata como alreadyRequested.
--
-- Parcial sobre status='requested': una vez procesado/fallido el reembolso, esa
-- fila deja de contar y el fan podría solicitar de nuevo si hiciera falta.
-- Guard de idempotencia por el drift remoto↔local conocido.
create unique index if not exists refunds_one_pending_per_payment
  on public.refunds (payment_id)
  where status = 'requested';
