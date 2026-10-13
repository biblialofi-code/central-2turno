-- Central 2º Turno · vídeo ou livro novo -> imagem + texto pro canal no seu Telegram
-- Rode no SQL Editor. Troque TROQUE_PELO_SEGREDO pelo mesmo FOTO_SEGREDO da Vercel. Pode rodar mais de uma vez.

create extension if not exists pg_net;

create or replace function avisar_novo()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.ativo then
    perform net.http_post(
      url := 'https://central-2turno.vercel.app/api/aviso',
      body := jsonb_build_object('tipo', tg_argv[0], 'id', new.id),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-segredo', 'TROQUE_PELO_SEGREDO'),
      timeout_milliseconds := 30000
    );
  end if;
  return new;
end $$;

drop trigger if exists video_novo_aviso on videos;
create trigger video_novo_aviso after insert on videos for each row execute function avisar_novo('video');

drop trigger if exists livro_novo_aviso on livros;
create trigger livro_novo_aviso after insert on livros for each row execute function avisar_novo('livro');
