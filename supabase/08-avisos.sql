-- Central 2º Turno · vídeo ou livro novo -> imagem + texto pro canal no seu Telegram
-- Rode no SQL Editor depois do 04-fotos. Não precisa trocar nada: o segredo é copiado
-- da função pedir_foto (a das fotos), que já está funcionando. Pode rodar mais de uma vez.

create extension if not exists pg_net;

do $do$
declare segredo text;
begin
  select substring(prosrc from $r$'x-segredo',\s*'([^']+)'$r$) into segredo
  from pg_proc where proname = 'pedir_foto' limit 1;
  if segredo is null or segredo = 'TROQUE_PELO_SEGREDO' then
    raise exception 'Não achei o segredo na função pedir_foto. Rode o 04-fotos antes.';
  end if;
  execute format($f$
    create or replace function avisar_novo()
    returns trigger language plpgsql security definer set search_path = public, extensions as $b$
    begin
      if new.ativo then
        perform net.http_post(
          url := 'https://central-2turno.vercel.app/api/aviso',
          body := jsonb_build_object('tipo', tg_argv[0], 'id', new.id),
          headers := jsonb_build_object('Content-Type', 'application/json', 'x-segredo', %L),
          timeout_milliseconds := 30000
        );
      end if;
      return new;
    end $b$;
  $f$, segredo);
end $do$;

drop trigger if exists video_novo_aviso on videos;
create trigger video_novo_aviso after insert on videos for each row execute function avisar_novo('video');

drop trigger if exists livro_novo_aviso on livros;
create trigger livro_novo_aviso after insert on livros for each row execute function avisar_novo('livro');
