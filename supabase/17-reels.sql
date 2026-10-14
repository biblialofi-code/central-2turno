-- Central 2º Turno · lugar pra guardar os vídeos do Reels (o Instagram baixa de lá). Pode rodar mais de uma vez.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reels', 'reels', true, 52428800, array['video/mp4'])
on conflict (id) do update set public = true;
