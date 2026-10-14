-- Central 2º Turno · foto dos deputados no Acompanha. Rode no SQL Editor. Pode rodar mais de uma vez.
alter table politicos add column if not exists foto_url text;
notify pgrst, 'reload schema';
