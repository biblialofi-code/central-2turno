-- Central 2º Turno · trava pra não postar o mesmo carrossel/Reels duas vezes. Pode rodar mais de uma vez.
create table if not exists ig_posts (dia text not null, turno text not null, criado_em timestamptz not null default now(), primary key (dia, turno));
alter table ig_posts enable row level security;
revoke all on ig_posts from anon, authenticated;
notify pgrst, 'reload schema';
