-- Central 2º Turno · promessas: campo "como conferir" + nova leitura das matérias inteiras
-- Rode no SQL Editor. Pode rodar mais de uma vez.
alter table promessas add column if not exists como_conferir text;
-- a busca agora lê a matéria inteira: libera as notícias já vistas pra serem lidas de novo
-- (promessa repetida não entra de novo: o sistema confere texto e fonte)
delete from promessas_vistas;
update politicos set ultima_busca = null;
notify pgrst, 'reload schema';
