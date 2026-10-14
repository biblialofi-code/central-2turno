-- Central 2º Turno · perfis: notícias de cada deputado (vêm da mesma busca das promessas)
-- Rode no SQL Editor. Pode rodar mais de uma vez.
create table if not exists politico_noticias (
  id          bigint generated always as identity primary key,
  politico_id integer not null references politicos(id) on delete cascade,
  titulo      text not null,
  link        text not null,
  fonte       text,
  data        timestamptz,
  criado_em   timestamptz not null default now(),
  unique (politico_id, link)
);
create index if not exists politico_noticias_pol on politico_noticias (politico_id, data desc);
alter table politico_noticias enable row level security;
drop policy if exists "todos leem noticias de politico" on politico_noticias;
create policy "todos leem noticias de politico" on politico_noticias for select to anon, authenticated using (true);
drop policy if exists "admin noticias de politico" on politico_noticias;
create policy "admin noticias de politico" on politico_noticias for all to authenticated using (sou_admin()) with check (sou_admin());
-- busca de novo pra já encher as notícias de todo mundo
delete from promessas_vistas;
update politicos set ultima_busca = null;
notify pgrst, 'reload schema';
