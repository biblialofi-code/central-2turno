-- Central 2º Turno · tudo do Reels de uma vez: lugar dos vídeos, trava de 1 post por horário e o Reels de serviço diário (15h).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reels', 'reels', true, 52428800, array['video/mp4']) on conflict (id) do update set public = true;
create table if not exists ig_posts (dia text not null, turno text not null, criado_em timestamptz not null default now(), primary key (dia, turno));
alter table ig_posts enable row level security;
revoke all on ig_posts from anon, authenticated;
do $do$ declare s text; begin
  select substring(prosrc from $r$'x-segredo',\s*'([^']+)'$r$) into s from pg_proc where proname = 'pedir_foto' limit 1;
  perform cron.schedule('ig-servico', '0 18 * * *', format(
    $c$select net.http_post(url := 'https://central-2turno.vercel.app/api/ig-post', body := '{"turno":"servico"}'::jsonb, headers := jsonb_build_object('Content-Type', 'application/json', 'x-segredo', %L), timeout_milliseconds := 300000)$c$, s));
  -- e já posta o de hoje
  perform net.http_post(url := 'https://central-2turno.vercel.app/api/ig-post', body := '{"turno":"servico"}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-segredo', s), timeout_milliseconds := 300000);
end $do$;
notify pgrst, 'reload schema';
