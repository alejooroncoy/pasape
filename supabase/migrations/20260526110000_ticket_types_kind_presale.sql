-- Add 'presale' (preventa) to ticket_types.kind allowed values.
alter table ticket_types drop constraint if exists ticket_types_kind_check;
alter table ticket_types
  add constraint ticket_types_kind_check
  check (kind in ('general','presale','vip','box'));
