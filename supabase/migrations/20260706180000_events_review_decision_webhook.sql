-- Motivo que Pasape escribe al rechazar un evento (status vuelve a 'draft').
-- El organizador lo ve en su panel y puede corregir + reenviar a revisión
-- (UpdateEvent.ts limpia este campo apenas vuelve a pending_review).
alter table events add column if not exists rejected_reason text;

create extension if not exists pg_net;

-- Sin panel de staff todavía: Pasape aprueba/rechaza a mano en el Table
-- Editor (status: pending_review -> published = aprobado; -> draft con
-- rejected_reason = rechazado). Este trigger avisa al organizador por correo
-- en cualquiera de los dos casos. El secreto compartido vive en Supabase
-- Vault (vault.create_secret, fuera de esta migración) — nunca en git.
create or replace function public.notify_event_review_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
begin
  if not (
    (new.status = 'published' and old.status = 'pending_review')
    or (new.status = 'draft' and old.status = 'pending_review' and new.rejected_reason is not null)
  ) then
    return new;
  end if;

  select decrypted_secret into v_secret
    from vault.decrypted_secrets
    where name = 'events_review_webhook_secret';
  if v_secret is null then
    return new;
  end if;

  perform net.http_post(
    url := 'https://pasape.lat/api/events/webhooks/review-status',
    headers := jsonb_build_object('content-type', 'application/json', 'x-webhook-secret', v_secret),
    body := jsonb_build_object(
      'eventId', new.id,
      'decision', case when new.status = 'published' then 'approved' else 'rejected' end,
      'reason', new.rejected_reason
    ),
    timeout_milliseconds := 10000
  );
  return new;
end;
$$;

revoke all on function public.notify_event_review_decision() from public, anon, authenticated;

drop trigger if exists events_review_decision_notify on events;
create trigger events_review_decision_notify
  after update of status on events
  for each row
  execute function public.notify_event_review_decision();
