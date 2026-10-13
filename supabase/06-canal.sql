-- Central 2º Turno · post automático no canal do WhatsApp
-- Rode no SQL Editor. Pode rodar mais de uma vez.

alter table noticias add column if not exists postado_em timestamptz;   -- quando foi pro canal

-- As que já estão no ar contam como postadas (você já postou na mão), pra não repetir.
update noticias set postado_em = coalesce(aprovado_em, now())
where status = 'aprovado' and postado_em is null;

notify pgrst, 'reload schema';
