-- Public storage bucket for event assets (covers, venue layouts).
-- Reads are public; uploads require authenticated session (RLS on storage.objects below).
insert into storage.buckets (id, name, public)
values ('event-assets', 'event-assets', true)
on conflict (id) do nothing;

-- Allow anyone (public) to read objects
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'event_assets_public_read'
  ) then
    create policy event_assets_public_read on storage.objects
      for select
      using (bucket_id = 'event-assets');
  end if;
end$$;

-- Allow authenticated users to upload to event-assets
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'event_assets_auth_insert'
  ) then
    create policy event_assets_auth_insert on storage.objects
      for insert to authenticated
      with check (bucket_id = 'event-assets');
  end if;
end$$;

-- Allow authenticated users to update/delete their own uploads in event-assets
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'event_assets_auth_update'
  ) then
    create policy event_assets_auth_update on storage.objects
      for update to authenticated
      using (bucket_id = 'event-assets' and owner = auth.uid())
      with check (bucket_id = 'event-assets' and owner = auth.uid());
  end if;
end$$;
