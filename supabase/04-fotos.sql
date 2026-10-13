-- Central 2º Turno · foto das notícias
-- Quando uma notícia é aprovada, o Supabase chama a função da Vercel (/api/foto),
-- que troca o link do Google News pelo link real e pega a foto principal da matéria.
-- Antes de rodar: troque TROQUE_PELO_SEGREDO (lá embaixo) pelo mesmo valor
-- que você pôs em FOTO_SEGREDO na Vercel. Pode rodar mais de uma vez.

alter table noticias add column if not exists imagem text;   -- null = ainda não tentou; '' = tentou e não tinha foto

create extension if not exists pg_net;

create or replace function pedir_foto()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.status = 'aprovado' and new.imagem is null
     and (tg_op = 'INSERT' or old.status is distinct from 'aprovado') then
    perform net.http_post(
      url := 'https://central-2turno.vercel.app/api/foto',
      body := jsonb_build_object('id', new.id),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-segredo', 'TROQUE_PELO_SEGREDO'),
      timeout_milliseconds := 30000
    );
  end if;
  return new;
end;
$$;

drop trigger if exists noticia_aprovada_foto on noticias;
create trigger noticia_aprovada_foto
  after insert or update of status on noticias
  for each row execute function pedir_foto();

notify pgrst, 'reload schema';
