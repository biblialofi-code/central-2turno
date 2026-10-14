-- Central 2º Turno · Radar: site de campanha de cada deputado (a busca lê as propostas de lá). Pode rodar mais de uma vez.
alter table politicos add column if not exists site_url text;
alter table politicos add column if not exists site_lido_em timestamptz;
notify pgrst, 'reload schema';
