-- Central 2º Turno · área de admin (/admin)
-- Rode no SQL Editor do Supabase DEPOIS do 01 e do 02.
-- Antes de rodar: troque SEU_EMAIL_AQUI (lá embaixo) pelo e-mail que você usa pra entrar no Supabase.
-- Pode rodar mais de uma vez.

-- Quem é admin. Ninguém de fora lê nem altera essa tabela.
create table if not exists admins (
  email text primary key
);
alter table admins enable row level security;
revoke all on admins from anon, authenticated;

-- "Quem está logado é admin?"
create or replace function sou_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from admins a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function sou_admin() from public, anon;
grant execute on function sou_admin() to authenticated;

-- Admin vê tudo (pendente, aprovado, descartado), altera e apaga.
drop policy if exists "admin le tudo" on noticias;
create policy "admin le tudo" on noticias
  for select to authenticated using (sou_admin());

drop policy if exists "admin altera" on noticias;
create policy "admin altera" on noticias
  for update to authenticated using (sou_admin()) with check (sou_admin());

drop policy if exists "admin apaga" on noticias;
create policy "admin apaga" on noticias
  for delete to authenticated using (sou_admin());

-- Vídeos e livros: admin vê tudo (inclusive os desligados), cria, altera e apaga.
do $$
declare t text;
begin
  foreach t in array array['videos', 'livros'] loop
    execute format('drop policy if exists "admin le tudo" on %I', t);
    execute format('create policy "admin le tudo" on %I for select to authenticated using (sou_admin())', t);
    execute format('drop policy if exists "admin cria" on %I', t);
    execute format('create policy "admin cria" on %I for insert to authenticated with check (sou_admin())', t);
    execute format('drop policy if exists "admin altera" on %I', t);
    execute format('create policy "admin altera" on %I for update to authenticated using (sou_admin()) with check (sou_admin())', t);
    execute format('drop policy if exists "admin apaga" on %I', t);
    execute format('create policy "admin apaga" on %I for delete to authenticated using (sou_admin())', t);
  end loop;
end $$;

-- >>> TROQUE AQUI <<<
insert into admins (email) values ('SEU_EMAIL_AQUI') on conflict do nothing;

-- Ver quem é admin:     select * from admins;
-- Tirar alguém:         delete from admins where email = 'fulano@x.com';
