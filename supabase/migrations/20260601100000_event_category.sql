alter table events
  add column category text
    check (category in ('musica','dj_sets','after_office','comedia','cultura','deportes'));

create index events_category_idx on events (category) where category is not null;
