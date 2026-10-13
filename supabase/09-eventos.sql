-- Central 2º Turno · contagem de eventos (visitas, seguiu o canal, compartilhou...)
-- Só números por dia. Nada de quem é a pessoa. Rode no SQL Editor depois do 03-admin.

create table if not exists eventos_dia (
  dia     date not null,
  evento  text not null,
  n       integer not null default 0,
  primary key (dia, evento)
);
alter table eventos_dia enable row level security;
revoke all on eventos_dia from anon, authenticated;

drop policy if exists "admin le eventos" on eventos_dia;
create policy "admin le eventos" on eventos_dia for select to authenticated using (sou_admin());
grant select on eventos_dia to authenticated;

create or replace function registrar(ev text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if ev !~ '^[a-z0-9_:-]{2,40}$' then return; end if;
  insert into eventos_dia (dia, evento, n) values ((now() at time zone 'America/Sao_Paulo')::date, ev, 1)
  on conflict (dia, evento) do update set n = eventos_dia.n + 1;
end $$;
revoke all on function registrar(text) from public;
grant execute on function registrar(text) to anon, authenticated;

notify pgrst, 'reload schema';
