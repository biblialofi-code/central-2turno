-- Central 2º Turno · perfil e histórico de leitura
-- Rode no SQL Editor do Supabase DEPOIS do eleicoes26-supabase.sql.
-- Pode rodar mais de uma vez sem problema.

-- ============================================================
-- 1) Quem está logado também precisa ler o conteúdo público
--    (as regras antigas valiam só pra visitante sem login)
-- ============================================================
drop policy if exists "LP le aprovadas" on noticias;
create policy "LP le aprovadas" on noticias
  for select to anon, authenticated using (status = 'aprovado');

drop policy if exists "LP le termometro" on termometro;
create policy "LP le termometro" on termometro
  for select to anon, authenticated using (true);

drop policy if exists "LP le interesse" on interesse_dia;
create policy "LP le interesse" on interesse_dia
  for select to anon, authenticated using (true);

drop policy if exists "LP le videos ativos" on videos;
create policy "LP le videos ativos" on videos
  for select to anon, authenticated using (ativo);

drop policy if exists "LP le livros ativos" on livros;
create policy "LP le livros ativos" on livros
  for select to anon, authenticated using (ativo);

grant execute on function ler(bigint) to authenticated;
grant execute on function esquentar() to authenticated;

-- ============================================================
-- 2) Perfil: nome e WhatsApp (o e-mail fica no login do Supabase)
-- ============================================================
create table if not exists perfis (
  id                 uuid primary key references auth.users(id) on delete cascade,
  nome               text not null check (char_length(nome) between 1 and 80),
  whatsapp           text check (whatsapp is null or whatsapp ~ '^[0-9]{10,13}$'),
  aceita_historico   boolean not null default false,  -- guardar o histórico de leitura
  aceita_mounologo   boolean not null default false,  -- receber conteúdo depois da eleição
  consentiu_em       timestamptz not null default now(),
  criado_em          timestamptz not null default now()
);

alter table perfis enable row level security;

drop policy if exists "perfil: dono le" on perfis;
create policy "perfil: dono le" on perfis
  for select to authenticated using (auth.uid() = id);

drop policy if exists "perfil: dono cria" on perfis;
create policy "perfil: dono cria" on perfis
  for insert to authenticated with check (auth.uid() = id);

drop policy if exists "perfil: dono altera" on perfis;
create policy "perfil: dono altera" on perfis
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- ============================================================
-- 3) Histórico: só grava se a pessoa aceitou guardar o histórico
-- ============================================================
create table if not exists leituras (
  usuario     uuid not null references auth.users(id) on delete cascade,
  noticia_id  bigint not null references noticias(id) on delete cascade,
  lido_em     timestamptz not null default now(),
  primary key (usuario, noticia_id)
);

create index if not exists leituras_usuario on leituras (usuario, lido_em desc);

alter table leituras enable row level security;

drop policy if exists "leitura: dono le" on leituras;
create policy "leitura: dono le" on leituras
  for select to authenticated using (auth.uid() = usuario);

drop policy if exists "leitura: dono grava com consentimento" on leituras;
create policy "leitura: dono grava com consentimento" on leituras
  for insert to authenticated with check (
    auth.uid() = usuario
    and exists (select 1 from perfis p where p.id = auth.uid() and p.aceita_historico)
  );

-- ============================================================
-- 4) "Apagar meus dados": apaga a conta, o perfil e o histórico
-- ============================================================
create or replace function apagar_minha_conta()
returns void
language sql
security definer
set search_path = public, auth
as $$
  delete from auth.users where id = auth.uid();
$$;

revoke all on function apagar_minha_conta() from public, anon;
grant execute on function apagar_minha_conta() to authenticated;

-- ============================================================
-- 5) Sua lista de contatos (só você vê, pelo SQL Editor)
--    Fica num schema que o site não enxerga.
-- ============================================================
create schema if not exists privado;
revoke all on schema privado from public, anon, authenticated;

create or replace view privado.lista_contatos as
  select p.nome, u.email, p.whatsapp, p.aceita_mounologo, p.criado_em
  from perfis p
  join auth.users u on u.id = p.id
  order by p.criado_em desc;

-- Pra ver a lista:            select * from privado.lista_contatos;
-- Só quem aceitou Mounólogo:  select * from privado.lista_contatos where aceita_mounologo;
