# Central 2º Turno · Mounólogo

Hub neutro do 2º turno (13 × 22). Site estático + Supabase + n8n.

- `site/` — o que vai pro ar (index.html, og.png). A Vercel publica essa pasta a cada push na main.

No ar: https://central-2turno.vercel.app
- `supabase/` — SQL, rodar em ordem no SQL Editor (01, 02, 03).
- `api/foto.js` — função da Vercel: troca o link do Google News pelo real e pega a foto (og:image). Precisa das variáveis SUPABASE_URL, SUPABASE_SERVICE_KEY e FOTO_SEGREDO na Vercel.
- `site/admin.html` — área de admin em /admin: notícias (lado, status, resumo, apagar), vídeos e livros. Login por link no e-mail; só quem está na tabela `admins` altera.
- `n8n/` — workflows (captação e aprovação via Telegram). Chaves ficam só no n8n.

**Nunca commitar:** service_role key, token do Telegram, chave da Anthropic.
A chave `sb_publishable_…` no index.html é pública por design (RLS protege).
