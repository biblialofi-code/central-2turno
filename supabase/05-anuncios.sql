-- Central 2º Turno · anúncios da casa (editados no /admin)
-- Rode no SQL Editor depois do 03-admin.sql. Pode rodar mais de uma vez.

create table if not exists anuncios (
  id         bigint generated always as identity primary key,
  titulo     text not null,
  texto      text,
  botao      text,
  link       text not null,
  imagem     text,
  onde       text not null default 'todos' check (onde in ('todos', 'feed', 'lateral')),
  ativo      boolean not null default true,
  ordem      integer not null default 0,
  criado_em  timestamptz not null default now()
);

alter table anuncios enable row level security;

drop policy if exists "LP le anuncios ativos" on anuncios;
create policy "LP le anuncios ativos" on anuncios
  for select to anon, authenticated using (ativo);

drop policy if exists "admin le tudo" on anuncios;
create policy "admin le tudo" on anuncios for select to authenticated using (sou_admin());
drop policy if exists "admin cria" on anuncios;
create policy "admin cria" on anuncios for insert to authenticated with check (sou_admin());
drop policy if exists "admin altera" on anuncios;
create policy "admin altera" on anuncios for update to authenticated using (sou_admin()) with check (sou_admin());
drop policy if exists "admin apaga" on anuncios;
create policy "admin apaga" on anuncios for delete to authenticated using (sou_admin());

notify pgrst, 'reload schema';
