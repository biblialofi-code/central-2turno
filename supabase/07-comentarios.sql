-- Central 2º Turno · comentários nas notícias (só quem tem conta comenta)
-- Rode no SQL Editor depois do 02-perfil e do 03-admin. Pode rodar mais de uma vez.

create table if not exists comentarios (
  id          bigint generated always as identity primary key,
  noticia_id  bigint not null references noticias(id) on delete cascade,
  usuario     uuid not null references auth.users(id) on delete cascade,
  nome        text not null default '',
  texto       text not null check (char_length(btrim(texto)) between 2 and 500),
  oculto      boolean not null default false,
  denuncias   integer not null default 0,
  criado_em   timestamptz not null default now()
);
create index if not exists comentarios_noticia on comentarios (noticia_id, criado_em);

-- Antes de gravar: põe o nome da pessoa (primeiro nome + inicial) e segura o flood (1 a cada 30 s)
create or replace function comentario_antes()
returns trigger language plpgsql security definer set search_path = public as $$
declare n text;
begin
  select nome into n from perfis where id = new.usuario;
  if n is null then raise exception 'Crie sua conta pra comentar'; end if;
  n := btrim(n);
  new.nome := split_part(n, ' ', 1) ||
    case when position(' ' in n) > 0 then ' ' || upper(left(btrim(substr(n, position(' ' in n))), 1)) || '.' else '' end;
  new.texto := btrim(new.texto);
  new.oculto := false; new.denuncias := 0; new.criado_em := now();
  if exists (select 1 from comentarios where usuario = new.usuario and criado_em > now() - interval '30 seconds') then
    raise exception 'Espera uns segundos pra comentar de novo';
  end if;
  return new;
end $$;
drop trigger if exists comentario_antes on comentarios;
create trigger comentario_antes before insert on comentarios for each row execute function comentario_antes();

alter table comentarios enable row level security;

drop policy if exists "todos leem comentarios" on comentarios;
create policy "todos leem comentarios" on comentarios
  for select to anon, authenticated using (not oculto);

drop policy if exists "cadastrado comenta" on comentarios;
create policy "cadastrado comenta" on comentarios
  for insert to authenticated with check (auth.uid() = usuario);

drop policy if exists "dono apaga o seu" on comentarios;
create policy "dono apaga o seu" on comentarios
  for delete to authenticated using (auth.uid() = usuario);

drop policy if exists "admin le tudo" on comentarios;
create policy "admin le tudo" on comentarios for select to authenticated using (sou_admin());
drop policy if exists "admin altera" on comentarios;
create policy "admin altera" on comentarios for update to authenticated using (sou_admin()) with check (sou_admin());
drop policy if exists "admin apaga" on comentarios;
create policy "admin apaga" on comentarios for delete to authenticated using (sou_admin());

-- Denúncia: 1 por pessoa por comentário; com 3, o comentário some até o admin olhar
create table if not exists denuncias (
  comentario_id bigint not null references comentarios(id) on delete cascade,
  usuario       uuid not null references auth.users(id) on delete cascade,
  criado_em     timestamptz not null default now(),
  primary key (comentario_id, usuario)
);
alter table denuncias enable row level security;
revoke all on denuncias from anon, authenticated;

create or replace function denunciar(comentario bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Entre pra denunciar'; end if;
  insert into denuncias (comentario_id, usuario) values (comentario, auth.uid()) on conflict do nothing;
  if found then
    update comentarios set denuncias = denuncias + 1,
      oculto = oculto or denuncias + 1 >= 3
    where id = comentario;
  end if;
end $$;
revoke all on function denunciar(bigint) from public, anon;
grant execute on function denunciar(bigint) to authenticated;

notify pgrst, 'reload schema';
