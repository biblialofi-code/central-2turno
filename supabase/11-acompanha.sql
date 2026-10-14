-- Central 2º Turno · Acompanha: 21 deputados federais eleitos em 2026 e as promessas de cada um
-- Regra: os 10 mais votados de cada campo (partido que apoiou formalmente o 13 ou o 22 no 2º turno)
-- + o mais votado dos partidos neutros. Rode no SQL Editor. Não precisa trocar nada. Pode rodar mais de uma vez.

create table if not exists politicos (
  id           serial primary key,
  slug         text unique not null,
  nome         text not null,
  partido      text not null,
  uf           text not null,
  cargo        text not null default 'Deputado federal',
  campo        text not null check (campo in ('13', '22', 'neutro')),
  votos        integer,
  votos_fonte  text default 'Resultado do 1º turno (CNN Brasil), a conferir no TSE',
  ordem        integer not null default 0,
  ativo        boolean not null default true,
  ultima_busca timestamptz
);

create table if not exists promessas (
  id          bigint generated always as identity primary key,
  politico_id integer not null references politicos(id) on delete cascade,
  texto       text not null,
  citacao     text,
  fonte_url   text,
  fonte_nome  text,
  data        date,
  status      text not null default 'pendente' check (status in ('pendente', 'aprovado', 'descartado')),
  criado_em   timestamptz not null default now()
);
create index if not exists promessas_pol on promessas (politico_id, status);

-- links de notícia que a busca já leu (pra não mandar a mesma coisa pra IA duas vezes)
create table if not exists promessas_vistas (url text primary key, visto_em timestamptz not null default now());

alter table politicos enable row level security;
alter table promessas enable row level security;
alter table promessas_vistas enable row level security;
revoke all on promessas_vistas from anon, authenticated;

drop policy if exists "todos leem politicos" on politicos;
create policy "todos leem politicos" on politicos for select to anon, authenticated using (ativo);
drop policy if exists "admin politicos" on politicos;
create policy "admin politicos" on politicos for all to authenticated using (sou_admin()) with check (sou_admin());

drop policy if exists "todos leem promessas aprovadas" on promessas;
create policy "todos leem promessas aprovadas" on promessas for select to anon, authenticated using (status = 'aprovado');
drop policy if exists "admin promessas" on promessas;
create policy "admin promessas" on promessas for all to authenticated using (sou_admin()) with check (sou_admin());

insert into politicos (slug, nome, partido, uf, campo, votos, ordem) values
  ('erika-hilton', 'Erika Hilton', 'PSOL', 'SP', '13', 1596472, 1),
  ('samia-bomfim', 'Sâmia Bomfim', 'PSOL', 'SP', '13', 583107, 2),
  ('ana-elisa', 'Ana Elisa', 'PT', 'MG', '13', 524219, 3),
  ('tabata-amaral', 'Tabata Amaral', 'PSB', 'SP', '13', 476383, 4),
  ('fernanda-melchionna', 'Fernanda Melchionna', 'PSOL', 'RS', '13', 280262, 5),
  ('guilherme-cortez', 'Guilherme Cortez', 'PSOL', 'SP', '13', 275450, 6),
  ('tainah-marinho', 'Tainah Marinho', 'PSB', 'CE', '13', 265585, 7),
  ('pedro-campos', 'Pedro Campos', 'PSB', 'PE', '13', 261555, 8),
  ('luciene-cavalcante', 'Professora Luciene Cavalcante', 'PSOL', 'SP', '13', 253778, 9),
  ('jones-manoel', 'Jones Manoel', 'PSOL', 'PE', '13', 249077, 10),
  ('nikolas-ferreira', 'Nikolas Ferreira', 'PL', 'MG', '22', 3119318, 1),
  ('lucas-pavanato', 'Lucas Pavanato', 'PL', 'SP', '22', 3038438, 2),
  ('andre-fernandes', 'André Fernandes', 'PL', 'CE', '22', 684372, 3),
  ('julia-zanatta', 'Julia Zanatta', 'PL', 'SC', '22', 560223, 4),
  ('jeffrey-chiquini', 'Jeffrey Chiquini', 'Novo', 'PR', '22', 425399, 5),
  ('lucas-polese', 'Lucas Polese', 'PL', 'ES', '22', 419735, 6),
  ('delegado-caveira', 'Delegado Caveira', 'PL', 'PA', '22', 414927, 7),
  ('mauricio-marcon', 'Maurício Marcon', 'PL', 'RS', '22', 379834, 8),
  ('renato-bolsonaro', 'Renato Bolsonaro', 'PL', 'SP', '22', 379312, 9),
  ('sargento-nantes', 'Sargento Nantes', 'PP', 'SP', '22', 333401, 10),
  ('kim-kataguiri', 'Kim Kataguiri', 'Missão', 'SP', 'neutro', 520071, 1)
on conflict (slug) do update set nome = excluded.nome, partido = excluded.partido, uf = excluded.uf, campo = excluded.campo, ordem = excluded.ordem;

-- Busca de promessas 3x por dia (7h, 13h e 19h de Brasília), 7 políticos por vez
create extension if not exists pg_cron;
create extension if not exists pg_net;
do $do$
declare segredo text; t record;
begin
  select substring(prosrc from $r$'x-segredo',\s*'([^']+)'$r$) into segredo from pg_proc where proname = 'pedir_foto' limit 1;
  if segredo is null or segredo = 'TROQUE_PELO_SEGREDO' then raise exception 'Não achei o segredo na função pedir_foto. Rode o 04-fotos antes.'; end if;
  for t in select * from (values ('promessas-1', '0 10 * * *'), ('promessas-2', '0 16 * * *'), ('promessas-3', '0 22 * * *')) as v(nome, quando) loop
    perform cron.schedule(t.nome, t.quando, format(
      $c$select net.http_post(url := 'https://central-2turno.vercel.app/api/promessas-busca', body := '{}'::jsonb, headers := jsonb_build_object('Content-Type', 'application/json', 'x-segredo', %L), timeout_milliseconds := 120000)$c$, segredo));
  end loop;
end $do$;

notify pgrst, 'reload schema';
