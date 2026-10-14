-- Central 2º Turno · Acompanha: visitante sugere outro nome pra acompanhar. Rode no SQL Editor. Pode rodar mais de uma vez.
create table if not exists sugestoes_nomes (
  id        bigint generated always as identity primary key,
  nome      text not null check (char_length(btrim(nome)) between 3 and 80),
  motivo    text check (motivo is null or char_length(motivo) <= 300),
  criado_em timestamptz not null default now()
);
alter table sugestoes_nomes enable row level security;
revoke all on sugestoes_nomes from anon, authenticated;
drop policy if exists "admin le sugestoes" on sugestoes_nomes;
create policy "admin le sugestoes" on sugestoes_nomes for select to authenticated using (sou_admin());
drop policy if exists "admin apaga sugestoes" on sugestoes_nomes;
create policy "admin apaga sugestoes" on sugestoes_nomes for delete to authenticated using (sou_admin());
grant select, delete on sugestoes_nomes to authenticated;

-- quem visita só manda pela função (com limite pra não virar spam)
create or replace function sugerir_nome(nome text, motivo text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if char_length(btrim(coalesce(nome, ''))) < 3 then raise exception 'Escreve o nome'; end if;
  if (select count(*) from sugestoes_nomes where criado_em > now() - interval '1 day') >= 500 then raise exception 'Muitas sugestões hoje, tenta amanhã'; end if;
  insert into sugestoes_nomes (nome, motivo) values (left(btrim(nome), 80), nullif(left(btrim(coalesce(motivo, '')), 300), ''));
end $$;
revoke all on function sugerir_nome(text, text) from public;
grant execute on function sugerir_nome(text, text) to anon, authenticated;
notify pgrst, 'reload schema';
