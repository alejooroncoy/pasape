-- Why: recordar la última marca activa por USUARIO (no por navegador), para
-- restaurarla tras re-login y en cualquier dispositivo (ej. el celular). Antes
-- vivía solo en una cookie que se borraba al desloguearse. on delete set null:
-- si la marca se elimina, el perfil simplemente cae al default (primera marca).
alter table profiles
  add column if not exists last_active_org_id uuid references organizations(id) on delete set null,
  add column if not exists last_active_org_at timestamptz;

create index if not exists profiles_last_active_org_idx
  on profiles (last_active_org_id);
