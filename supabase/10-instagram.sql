-- Central 2º Turno · Instagram: story a cada notícia aprovada + carrossel manhã, tarde e noite
-- Rode no SQL Editor. Não precisa trocar nada (o segredo é copiado da função pedir_foto). Pode rodar mais de uma vez.

alter table noticias add column if not exists ig_em timestamptz;   -- quando virou story no Instagram
-- as que já estão no ar não viram story (só as aprovadas daqui pra frente)
update noticias set ig_em = now() where status = 'aprovado' and ig_em is null;

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Carrosséis (horário de Brasília -> UTC): manhã 12h = 15h UTC, tarde 18h = 21h UTC, noite 22h = 1h UTC
do $do$
declare segredo text; t record;
begin
  select substring(prosrc from $r$'x-segredo',\s*'([^']+)'$r$) into segredo from pg_proc where proname = 'pedir_foto' limit 1;
  if segredo is null or segredo = 'TROQUE_PELO_SEGREDO' then
    raise exception 'Não achei o segredo na função pedir_foto. Rode o 04-fotos antes.';
  end if;
  for t in select * from (values ('manha', '0 15 * * *'), ('tarde', '0 21 * * *'), ('noite', '0 1 * * *')) as v(turno, quando) loop
    perform cron.schedule('ig-' || t.turno, t.quando, format(
      $c$select net.http_post(url := 'https://central-2turno.vercel.app/api/ig-post', body := jsonb_build_object('turno', %L), headers := jsonb_build_object('Content-Type', 'application/json', 'x-segredo', %L), timeout_milliseconds := 120000)$c$,
      t.turno, segredo));
  end loop;
end $do$;

notify pgrst, 'reload schema';
