// Busca promessas de campanha dos 21 do Acompanha. Chamado pelo pg_cron (11-acompanha.sql) 3x por dia.
// Cada rodada pega os 7 que estão há mais tempo sem busca, lê as notícias recentes do Google News
// e pede pra IA separar só promessas que dá pra conferir. Tudo entra como "pendente": você aprova no admin.
// Variáveis: SUPABASE_URL, SUPABASE_SERVICE_KEY, FOTO_SEGREDO, ANTHROPIC_API_KEY, ANTHROPIC_MODEL (opcional), TELEGRAM_*
const { linkReal, textoMateria } = require('../lib/gnews.js');
const SB = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_KEY;
const POR_RODADA = 7;

async function sb(caminho, opcoes = {}) {
  const r = await fetch(SB + '/rest/v1/' + caminho, { ...opcoes,
    headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', ...(opcoes.headers || {}) } });
  if (!r.ok) throw new Error('Supabase ' + r.status + ': ' + (await r.text()).slice(0, 200));
  const t = await r.text(); return t ? JSON.parse(t) : null;
}
const des = (s) => String(s || '').replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
async function noticias(nome, primeira) {
  // primeira busca de cada um olha a campanha inteira (60 dias); depois, só a última semana
  const q = encodeURIComponent('"' + nome + '" ' + (primeira ? 'after:2026-08-15' : 'when:7d'));
  const r = await fetch('https://news.google.com/rss/search?q=' + q + '&hl=pt-BR&gl=BR&ceid=BR:pt-419', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36', Accept: 'application/rss+xml,text/xml,*/*' },
    signal: AbortSignal.timeout(10000) });
  const xml = await r.text();
  if (!r.ok || !/<rss|<feed/.test(xml)) throw new Error('Google News ' + r.status + ': ' + xml.slice(0, 120).replace(/\s+/g, ' '));
  return (xml.match(/<item>[\s\S]*?<\/item>/g) || []).slice(0, 15).map((it) => {
    const tag = (t) => des((it.match(new RegExp('<' + t + '[^>]*>([\\s\\S]*?)</' + t + '>')) || [])[1]);
    return { titulo: tag('title'), link: tag('link'), data: tag('pubDate'), fonte: tag('source'), texto: tag('description') };
  }).filter((n) => n.link);
}
const PROMPT = (p, itens) => `Você ajuda um site de notícias NEUTRO a registrar promessas de políticos.
Político: ${p.nome} (${p.partido}-${p.uf}), deputado federal eleito em 2026.

Abaixo estão notícias (manchete e, quando deu, trechos da matéria). Extraia SÓ promessas ou compromissos explícitos que o próprio ${p.nome} fez, e que dê pra conferir no futuro pelo que ele fizer no mandato.
Vale: "vou votar contra X", "vou apresentar projeto de Y", "não vou usar Z", "prometo defender W na Câmara".
NÃO vale: opinião, crítica a adversário, frase de efeito, promessa de outra pessoa, coisa vaga ("vou lutar pelo povo"), fato já acontecido.
Na dúvida, deixe de fora. Não invente nada que não esteja no texto.

Escreva a promessa como uma AÇÃO que dê pra checar no mandato de deputado federal. Em vez de "lutar por X", use o que ele pode fazer de fato: votar, apresentar projeto, assinar pedido, não usar algo.
Lembre: deputado vota na Câmara; impeachment de ministro do STF é julgado pelo Senado.

Responda só com JSON: {"promessas":[{"item":<número>,"promessa":"<frase curta e neutra, começando com verbo no infinitivo, ex.: Votar contra o aumento do fundo eleitoral>","citacao":"<trecho do texto que sustenta, copiado igual>","como_conferir":"<onde dá pra ver se cumpriu, curto. Ex.: Voto dele na PEC do fim da escala 6x1>"}]}
Se não tiver nenhuma, responda {"promessas":[]}.

${itens.map((n, i) => '[' + i + '] ' + n.titulo + (n.materia ? '\n' + n.materia : (n.texto && n.texto !== n.titulo ? ' — ' + n.texto : ''))).join('\n\n')}`;

async function ia(texto) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', signal: AbortSignal.timeout(40000),
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5', max_tokens: 2000, messages: [{ role: 'user', content: texto }] })
  });
  const j = await r.json();
  if (!r.ok) throw new Error('IA ' + r.status + ': ' + JSON.stringify(j).slice(0, 200));
  const s = (j.content || []).map((c) => c.text || '').join('');
  const m = s.match(/\{[\s\S]*\}/);
  return m ? (JSON.parse(m[0]).promessas || []) : [];
}

// foto oficial da Câmara (só existe pra quem já é deputado federal; depois da posse, vale pra todos)
async function fotoCamara(p) {
  // tenta o nome completo, depois sem "Professora/Delegado/Sargento" e por fim só o sobrenome (sempre no mesmo estado)
  const sem = p.nome.replace(/^(Professora?|Delegad[oa]|Sargento|Dra?\.?|Pastor[a]?)\s+/i, '');
  const tentativas = [...new Set([p.nome, sem, sem.split(/\s+/).pop()])];
  for (const nome of tentativas) {
    const r = await fetch('https://dadosabertos.camara.leg.br/api/v2/deputados?nome=' + encodeURIComponent(nome) + '&siglaUf=' + p.uf, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) continue;
    const d = ((await r.json()).dados || []);
    if (d.length === 1 && d[0].urlFoto) return d[0].urlFoto;
  }
  return null;
}

async function processa(p) {
  if (!p.foto_url) {
    try { const f = await fotoCamara(p); if (f) await sb('politicos?id=eq.' + p.id, { method: 'PATCH', body: JSON.stringify({ foto_url: f }) }); } catch (e) { /* sem foto, segue */ }
  }
  const todas = await noticias(p.nome, !p.ultima_busca);
  let novas = todas;
  if (todas.length) {
    const vistas = await sb('promessas_vistas?select=url&url=in.(' + todas.map((n) => encodeURIComponent('"' + n.link.replace(/"/g, '') + '"')).join(',') + ')');
    const ja = new Set(vistas.map((v) => v.url));
    novas = todas.filter((n) => !ja.has(n.link));
  }
  let achou = 0;
  // guarda as manchetes no perfil (as já salvas são ignoradas)
  if (todas.length) {
    const tira = (t, f) => f && t.endsWith(' - ' + f) ? t.slice(0, -(f.length + 3)) : t;
    await sb('politico_noticias?on_conflict=politico_id,link', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates' },
      body: JSON.stringify(todas.map((n) => { const d = new Date(n.data); return { politico_id: p.id, titulo: tira(n.titulo, n.fonte).slice(0, 300), link: n.link, fonte: n.fonte || null, data: isNaN(d) ? null : d.toISOString() }; })) }).catch(() => {});
  }
  // lê a matéria de verdade (5 por vez); se não der, fica só com a manchete
  for (let i = 0; i < novas.length; i += 5) {
    await Promise.all(novas.slice(i, i + 5).map(async (n) => {
      try { n.real = await linkReal(n.link); n.materia = await textoMateria(n.real, p.nome); } catch (e) { /* segue com a manchete */ }
    }));
  }
  if (novas.length) {
    const lista = await ia(PROMPT(p, novas));
    const linhas = lista.filter((x) => novas[x.item] && x.promessa).map((x) => {
      const n = novas[x.item];
      const d = new Date(n.data);
      return { politico_id: p.id, texto: String(x.promessa).slice(0, 300), citacao: String(x.citacao || n.titulo).slice(0, 600),
        como_conferir: x.como_conferir ? String(x.como_conferir).slice(0, 200) : null,
        _gnews: n.link, fonte_url: n.real || n.link, fonte_nome: n.fonte || null, data: isNaN(d) ? null : d.toISOString().slice(0, 10) };
    });
    // não repete promessa que já existe pra esse político (mesmo texto ou mesma fonte)
    const ja = await sb('promessas?select=texto,fonte_url&politico_id=eq.' + p.id);
    const txt = new Set(ja.map((x) => x.texto.trim().toLowerCase())), fontes = new Set(ja.map((x) => x.fonte_url));
    const novasL = linhas.filter((l) => !txt.has(l.texto.trim().toLowerCase()) && !fontes.has(l.fonte_url) && !fontes.has(l._gnews));
    novasL.forEach((l) => { delete l._gnews; });
    if (novasL.length) { await sb('promessas', { method: 'POST', body: JSON.stringify(novasL) }); achou = novasL.length; }
    await sb('promessas_vistas', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates' }, body: JSON.stringify(novas.map((n) => ({ url: n.link }))) });
  }
  await sb('politicos?id=eq.' + p.id, { method: 'PATCH', body: JSON.stringify({ ultima_busca: new Date().toISOString() }) });
  return { nome: p.nome, noticias: novas.length, promessas: achou };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!process.env.FOTO_SEGREDO || req.headers['x-segredo'] !== process.env.FOTO_SEGREDO) return res.status(401).json({ erro: 'segredo errado' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(200).json({ pulou: 'falta ANTHROPIC_API_KEY na Vercel' });
  try {
    const fila = await sb('politicos?select=id,nome,partido,uf,ultima_busca,foto_url&ativo=eq.true&order=ultima_busca.asc.nullsfirst&limit=' + POR_RODADA);
    const feitos = [];
    for (const p of fila) { try { feitos.push(await processa(p)); } catch (e) { feitos.push({ nome: p.nome, erro: String(e.message || e) }); } }
    const total = feitos.reduce((s, f) => s + (f.promessas || 0), 0);
    const tok = process.env.TELEGRAM_TOKEN, chat = process.env.TELEGRAM_CHAT;
    if (total && tok && chat) {
      await fetch('https://api.telegram.org/bot' + tok + '/sendMessage', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chat, text: '📝 ' + total + ' promessa(s) nova(s) pra revisar:\n' + feitos.filter((f) => f.promessas).map((f) => '• ' + f.nome + ': ' + f.promessas).join('\n') + '\n\nhttps://central-2turno.vercel.app/admin → Promessas' }) }).catch(() => {});
    }
    return res.status(200).json({ feitos, total });
  } catch (e) { return res.status(500).json({ erro: String(e.message || e) }); }
};
