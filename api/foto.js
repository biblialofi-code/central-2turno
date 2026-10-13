// Descobre o link real da matéria (o n8n salva o link do Google News)
// e pega a foto principal dela (og:image). Grava em noticias.link e noticias.imagem.
//
// Quem chama:
//  1) O Supabase, sozinho, quando uma notícia é aprovada (gatilho no 04-fotos.sql).
//     Manda { id } com o header x-segredo = FOTO_SEGREDO.
//  2) A área de admin, botão "Buscar fotos que faltam". Manda o token de quem está logado;
//     a função confere no Supabase se essa pessoa é admin.
//
// Depois da foto, quando vem do gatilho (notícia acabou de ser aprovada), posta no canal
// do WhatsApp pelo WAHA, uma vez só por notícia (coluna postado_em).
//
// Variáveis na Vercel (Settings > Environments > Production):
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, FOTO_SEGREDO
//   WAHA_URL (ex.: https://waha.seudominio.com), WAHA_KEY, WAHA_CANAL (xxxx@newsletter), WAHA_SESSION (opcional, padrão "default")
//   SITE_URL (opcional, padrão https://central-2turno.vercel.app)

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
const SB = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;

function comTempo(ms) { return AbortSignal.timeout(ms); }

async function sb(caminho, opcoes = {}) {
  const r = await fetch(SB + '/rest/v1/' + caminho, {
    ...opcoes,
    headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', ...(opcoes.headers || {}) }
  });
  if (!r.ok) throw new Error('Supabase ' + r.status + ': ' + (await r.text()).slice(0, 200));
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

// ---------- 1) link do Google News -> link real ----------
async function linkReal(link) {
  const m = String(link).match(/news\.google\.com\/(?:rss\/)?articles\/([^?/#]+)/);
  if (!m) return link;                        // já é link do jornal
  const id = m[1];
  let sg, ts;
  for (const base of ['https://news.google.com/articles/', 'https://news.google.com/rss/articles/']) {
    try {
      const r = await fetch(base + id, { headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR,pt;q=0.9' }, signal: comTempo(8000) });
      const html = await r.text();
      sg = (html.match(/data-n-a-sg="([^"]+)"/) || [])[1];
      ts = (html.match(/data-n-a-ts="([^"]+)"/) || [])[1];
      if (sg && ts) break;
    } catch (e) { /* tenta o outro */ }
  }
  if (!sg || !ts) throw new Error('não achei a assinatura do Google News');
  const pedido = [[[
    'Fbv4je',
    '["garturlreq",[["X","X",["X","X"],null,null,1,1,"US:en",null,1,null,null,null,null,null,0,1],"X","X",1,[1,1,1],1,1,null,0,0,null,0],"' + id + '",' + ts + ',"' + sg + '"]'
  ]]];
  const r = await fetch('https://news.google.com/_/DotsSplashUi/data/batchexecute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', 'User-Agent': UA },
    body: 'f.req=' + encodeURIComponent(JSON.stringify(pedido)),
    signal: comTempo(8000)
  });
  const texto = await r.text();
  const bloco = JSON.parse(texto.split('\n\n')[1]);
  const url = JSON.parse(bloco[0][2])[1];
  if (!/^https?:\/\//.test(url)) throw new Error('Google News não devolveu link');
  return url;
}

// ---------- 2) foto principal da matéria ----------
function atributo(tag, nome) {
  const m = tag.match(new RegExp(nome + '\\s*=\\s*("([^"]*)"|\'([^\']*)\')', 'i'));
  return m ? (m[2] !== undefined ? m[2] : m[3]) : null;
}
function desescapa(s) { return s.replace(/&amp;/g, '&').replace(/&#x2F;/gi, '/').replace(/&#47;/g, '/').replace(/&quot;/g, '"'); }

async function fotoDa(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR,pt;q=0.9', Accept: 'text/html' }, redirect: 'follow', signal: comTempo(9000) });
  // só o começo da página: a foto fica no <head>
  const leitor = r.body.getReader(); let html = ''; const dec = new TextDecoder();
  while (html.length < 400000) {
    const { done, value } = await leitor.read();
    if (done) break;
    html += dec.decode(value, { stream: true });
    if (/<\/head>/i.test(html)) break;
  }
  try { leitor.cancel(); } catch (e) {}
  const metas = html.match(/<meta\b[^>]*>/gi) || [];
  const achar = (chaves) => {
    for (const t of metas) {
      const k = (atributo(t, 'property') || atributo(t, 'name') || '').toLowerCase();
      if (chaves.includes(k)) { const c = atributo(t, 'content'); if (c) return c; }
    }
    return null;
  };
  let img = achar(['og:image:secure_url', 'og:image', 'og:image:url']) || achar(['twitter:image', 'twitter:image:src']);
  if (!img) return { final: r.url || url, imagem: null };
  img = new URL(desescapa(img.trim()), r.url || url).href;
  if (!/^https:\/\//.test(img)) img = img.replace(/^http:\/\//, 'https://');
  return { final: r.url || url, imagem: img };
}

async function processar(n) {
  const dados = {};
  try {
    const real = await linkReal(n.link);
    if (real !== n.link) dados.link = real;
    const f = await fotoDa(real);
    dados.imagem = f.imagem || '';            // '' = já tentou e não tinha foto
  } catch (e) {
    dados.imagem = '';
    dados._erro = String(e.message || e);
  }
  const erro = dados._erro; delete dados._erro;
  await sb('noticias?id=eq.' + n.id, { method: 'PATCH', body: JSON.stringify(dados) });
  return { id: n.id, link: dados.link ? 'trocado' : 'igual', imagem: dados.imagem ? 'ok' : 'sem foto', erro };
}

// ---------- 3) post no canal do WhatsApp ----------
const ROTULO = { '13': '13 · Lula (PT)', '22': '22 · Flávio Bolsonaro (PL)' };
function textoDoPost(n, site) {
  return '*' + n.manchete + '*\n' +
    (n.resumo ? n.resumo + '\n' : '') + '\n' +
    (ROTULO[n.lado] || 'Geral') + ' · ' + n.veiculo + '\n' +
    site + '/n/' + n.id;
}
async function postarNoCanal(id) {
  const { WAHA_URL, WAHA_KEY, WAHA_CANAL } = process.env;
  if (!WAHA_URL || !WAHA_CANAL) return 'canal não configurado';
  const linhas = await sb('noticias?select=id,lado,veiculo,manchete,resumo,status,postado_em&id=eq.' + id);
  const n = linhas[0];
  if (!n || n.status !== 'aprovado') return 'não está aprovada';
  if (n.postado_em) return 'já postada';
  // marca antes de enviar: se dois gatilhos chegarem juntos, só um posta
  const marcou = await sb('noticias?id=eq.' + id + '&postado_em=is.null', {
    method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ postado_em: new Date().toISOString() })
  });
  if (!marcou || !marcou.length) return 'já postada';
  const site = (process.env.SITE_URL || 'https://central-2turno.vercel.app').replace(/\/$/, '');
  try {
    const r = await fetch(WAHA_URL.replace(/\/$/, '') + '/api/sendText', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(WAHA_KEY ? { 'X-Api-Key': WAHA_KEY } : {}) },
      body: JSON.stringify({ session: process.env.WAHA_SESSION || 'default', chatId: WAHA_CANAL, text: textoDoPost(n, site), linkPreview: true }),
      signal: comTempo(20000)
    });
    if (!r.ok) throw new Error('WAHA ' + r.status + ': ' + (await r.text()).slice(0, 200));
    return 'postada';
  } catch (e) {
    // deu errado: desmarca pra dar pra tentar de novo
    await sb('noticias?id=eq.' + id, { method: 'PATCH', body: JSON.stringify({ postado_em: null }) }).catch(() => {});
    return 'erro: ' + String(e.message || e);
  }
}

async function souAdmin(token) {
  if (!token) return false;
  const r = await fetch(SB + '/rest/v1/rpc/sou_admin', {
    method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: '{}'
  });
  return r.ok && (await r.json()) === true;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!SB || !KEY) return res.status(500).json({ erro: 'Falta SUPABASE_URL ou SUPABASE_SERVICE_KEY na Vercel' });
  try {
    let corpo = req.body || {};
    if (typeof corpo === 'string') { try { corpo = JSON.parse(corpo); } catch (e) { corpo = {}; } }

    // 1) gatilho do Supabase
    if (req.headers['x-segredo']) {
      if (!process.env.FOTO_SEGREDO || req.headers['x-segredo'] !== process.env.FOTO_SEGREDO) return res.status(401).json({ erro: 'segredo errado' });
      const id = parseInt(corpo.id, 10);
      if (!id) return res.status(400).json({ erro: 'falta id' });
      const linhas = await sb('noticias?select=id,link,imagem&id=eq.' + id);
      if (!linhas.length) return res.status(404).json({ erro: 'não achei' });
      const feito = await processar(linhas[0]);
      let canal;
      try { canal = await postarNoCanal(id); } catch (e) { canal = 'erro: ' + String(e.message || e); }
      return res.status(200).json({ ...feito, canal });
    }

    // 2) botão do admin: até 8 por vez, das mais novas pras mais velhas
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!(await souAdmin(token))) return res.status(401).json({ erro: 'só admin' });
    const fila = await sb('noticias?select=id,link&status=eq.aprovado&imagem=is.null&order=id.desc&limit=8');
    const feitos = [];
    for (const n of fila) feitos.push(await processar(n));
    const restam = await sb('noticias?select=id&status=eq.aprovado&imagem=is.null&limit=200');
    return res.status(200).json({ feitos, restam: restam.length });
  } catch (e) {
    return res.status(500).json({ erro: String(e.message || e) });
  }
};
