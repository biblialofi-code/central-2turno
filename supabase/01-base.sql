-- Mounólogo · Eleições 26
-- Rode no SQL Editor do Supabase.

create table if not exists noticias (
  id            bigint generated always as identity primary key,
  id_externo    text unique not null,           -- guid do Google News (evita repetir)
  lado          text not null check (lado in ('13', '22', 'ambos')),
  tipo          text not null check (tipo in ('noticia', 'pesquisa', 'agenda')),
  veiculo       text not null,
  manchete      text not null,
  resumo        text not null,
  link          text not null,
  publicado_em  timestamptz,
  instituto     text,
  registro_tse  text,
  status        text not null default 'pendente'
                check (status in ('pendente', 'aprovado', 'descartado')),
  criado_em     timestamptz not null default now(),
  aprovado_em   timestamptz
);

create index if not exists noticias_lp on noticias (status, lado, aprovado_em desc);

-- A LP lê com a chave pública (anon). Ela só enxerga o que você aprovou.
alter table noticias enable row level security;

drop policy if exists "LP le aprovadas" on noticias;
create policy "LP le aprovadas" on noticias
  for select to anon
  using (status = 'aprovado');

-- Exemplos de leitura pela LP (GET com header apikey = anon key):
-- Coluna do 13:  /rest/v1/noticias?status=eq.aprovado&lado=in.(13,ambos)&tipo=eq.noticia&order=aprovado_em.desc&limit=3
-- Coluna do 22:  /rest/v1/noticias?status=eq.aprovado&lado=in.(22,ambos)&tipo=eq.noticia&order=aprovado_em.desc&limit=3
-- Pesquisas:     /rest/v1/noticias?status=eq.aprovado&tipo=eq.pesquisa&order=aprovado_em.desc&limit=2


-- ===== Termômetro da eleição (zera sozinho: uma linha por dia) =====

create table if not exists termometro (
  dia     date primary key,
  cliques integer not null default 0
);

alter table termometro enable row level security;

drop policy if exists "LP le termometro" on termometro;
create policy "LP le termometro" on termometro
  for select to anon
  using (true);

-- Soma 1 no dia de hoje (horário de Brasília) e devolve o total.
create or replace function esquentar()
returns integer
language sql
security definer
set search_path = public
as $$
  insert into termometro (dia, cliques)
  values ((now() at time zone 'America/Sao_Paulo')::date, 1)
  on conflict (dia) do update set cliques = termometro.cliques + 1
  returning cliques;
$$;

grant execute on function esquentar() to anon;

-- LP:
-- Clique:     POST /rest/v1/rpc/esquentar           (header apikey = anon key)
-- Ler o dia:  GET  /rest/v1/termometro?dia=eq.AAAA-MM-DD
-- No front, trave 1 clique a cada 10s por navegador pra não virar spam.


-- ===== Interesse nas notícias (cliques em "Ler no original") =====

alter table noticias add column if not exists cliques integer not null default 0;

create table if not exists interesse_dia (
  dia     date not null,
  lado    text not null check (lado in ('13', '22')),
  cliques integer not null default 0,
  primary key (dia, lado)
);

alter table interesse_dia enable row level security;

drop policy if exists "LP le interesse" on interesse_dia;
create policy "LP le interesse" on interesse_dia
  for select to anon
  using (true);

-- Conta 1 leitura numa notícia aprovada e devolve o link pra redirecionar.
-- Notícia "ambos" conta pros dois lados.
create or replace function ler(noticia_id bigint)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  n  noticias%rowtype;
  d  date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  select * into n from noticias where id = noticia_id and status = 'aprovado';
  if not found then
    return null;
  end if;

  update noticias set cliques = cliques + 1 where id = noticia_id;

  if n.lado in ('13', 'ambos') then
    insert into interesse_dia (dia, lado, cliques) values (d, '13', 1)
    on conflict (dia, lado) do update set cliques = interesse_dia.cliques + 1;
  end if;
  if n.lado in ('22', 'ambos') then
    insert into interesse_dia (dia, lado, cliques) values (d, '22', 1)
    on conflict (dia, lado) do update set cliques = interesse_dia.cliques + 1;
  end if;

  return n.link;
end;
$$;

grant execute on function ler(bigint) to anon;

-- LP:
-- Clique em "Ler no original":  POST /rest/v1/rpc/ler  body {"noticia_id": 123}
--   -> devolve o link do jornal; a LP abre ele em nova aba.
--   No front, guarde em localStorage os ids lidos no dia e só chame ler()
--   na primeira vez de cada notícia ("cada pessoa conta uma vez por notícia").
-- Barra do dia:  GET /rest/v1/interesse_dia?dia=eq.AAAA-MM-DD
-- Só mostre a % quando a soma do dia passar do mínimo (200 na LP).
-- Mais lida do 13 hoje:
--   GET /rest/v1/noticias?status=eq.aprovado&lado=in.(13,ambos)&aprovado_em=gte.AAAA-MM-DDT03:00:00Z&order=cliques.desc&limit=1
-- Mais lida do 22 hoje: troque (13,ambos) por (22,ambos).


-- ===== Pra ajudar a decidir (vídeos que você escolhe) =====

create table if not exists videos (
  id         bigint generated always as identity primary key,
  link       text not null,
  lado       text not null check (lado in ('13', '22', 'ambos')),
  categoria  text not null default 'entrevista'
             check (categoria in ('debate', 'entrevista', 'proposta', 'checagem', 'analise')),
  titulo     text not null,
  fonte      text,
  ativo      boolean not null default true,
  analise    text,              -- "Por que ver": sua nota de até 280 caracteres
  momento    text,              -- ponto-chave, ex.: 12:40
  criado_em  timestamptz not null default now()
);

-- Se a tabela já existia antes da nota:
alter table videos add column if not exists analise text;
alter table videos add column if not exists momento text;

alter table videos enable row level security;

drop policy if exists "LP le videos ativos" on videos;
create policy "LP le videos ativos" on videos
  for select to anon
  using (ativo);

-- LP:
-- Lista:   GET /rest/v1/videos?ativo=eq.true&order=criado_em.desc
-- Filtro:  ...&categoria=eq.debate
-- No site, toque o vídeo com o embed do YouTube (youtube-nocookie.com/embed/ID).
-- Embed é o jeito certo: não baixe nem suba de novo vídeo dos outros.


-- ===== Pra ir além (livros) =====
-- Muda pouco: edite direto no Table Editor do Supabase.

create table if not exists livros (
  id         bigint generated always as identity primary key,
  titulo     text not null,
  autor      text not null,
  por_que    text not null,          -- 1 linha: por que ler agora
  capa_url   text,
  link       text not null,          -- seu link de afiliado
  afiliado   boolean not null default true,
  ordem      integer not null default 0,
  ativo      boolean not null default true
);

alter table livros enable row level security;

drop policy if exists "LP le livros ativos" on livros;
create policy "LP le livros ativos" on livros
  for select to anon
  using (ativo);

-- LP:  GET /rest/v1/livros?ativo=eq.true&order=ordem.asc
