// Carrossel do Instagram: manhã (12h), tarde (18h) e noite (22h), horário de Brasília.
// Quem chama: o pg_cron do Supabase (10-instagram.sql), com { turno } e o header x-segredo = FOTO_SEGREDO.
// Pega as notícias aprovadas na janela do turno, alterna 13 / 22 / Geral e posta capa + até 9 notícias.
const IG = require('../lib/instagram.js');
const { desenhaStory, desenhaCapa, desenhaFim, vertical, baixaFoto } = require('../lib/card.js');
const { montaVideo } = require('../lib/reel.js');
const SERV = require('../lib/servico.js');
const REEL_TURNOS = ['manha', 'noite'];   // turnos que saem como Reels (os outros, carrossel)
const REEL_MAX = 8;               // notícias no vídeo (até ~45 s)
const SB = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_KEY;
const SITE = 'https://central-2turno.vercel.app';
const NOME = { cedo: 'Manhã', manha: 'Meio-dia', tarde: 'Tarde', noite: 'Noite' };
const INICIO = { cedo: -2, manha: 8, tarde: 12, noite: 18 };   // hora de Brasília em que a janela começa (-2 = 22h do dia anterior)
const MAX = 8;   // capa + 8 notícias + slide final = 10, o máximo do Instagram

function janela(turno, agora) {
  const brt = new Date(agora - 3 * 3600e3).toISOString().slice(0, 10);   // data de hoje em Brasília (sem horário de verão)
  const zero = Date.parse(brt + 'T00:00:00-03:00');
  return { de: new Date(zero + INICIO[turno] * 3600e3).toISOString(), ate: new Date(agora).toISOString(), dia: brt.slice(8, 10) + '-' + brt.slice(5, 7) };
}
// alterna 13, 22, Geral, mais novas primeiro em cada lado
function alterna(lista, primeiro) {
  const g = { '13': [], '22': [], ambos: [] };
  lista.forEach((n) => (g[n.lado] || g.ambos).push(n));
  const out = [];
  while (out.length < MAX && (g['13'].length || g['22'].length || g.ambos.length)) {
    for (const k of (primeiro === '22' ? ['22', '13', 'ambos'] : ['13', '22', 'ambos'])) if (g[k].length && out.length < MAX) out.push(g[k].shift());
  }
  return out;
}
const MARCA = { '13': '🔴 13', '22': '🔵 22' };
const FAIXA = { cedo: 'desde ontem à noite', manha: 'entre 8h e 12h', tarde: 'entre 12h e 18h', noite: 'entre 18h e 22h' };
const QUANDO = { cedo: 'desde ontem à noite', manha: 'hoje de manhã', tarde: 'hoje à tarde', noite: 'hoje à noite' };
function legenda(turno, dia, ns, video) {
  // 1ª linha é o que aparece antes do "mais": número + curiosidade
  let t = ns.length + ' notícias que mexeram no 2º turno ' + QUANDO[turno] + ' 👇\n\n';
  for (const n of ns) {
    const linha = (MARCA[n.lado] || '⚪ Geral') + ' · ' + n.manchete + (n.veiculo ? ' (' + n.veiculo + ')' : '') + '\n';
    if (t.length + linha.length > 1500) break;
    t += linha;
  }
  return t + (video ? '\nO resumo de cada uma tá no vídeo e no link da bio.\n\n' : '\nArrasta pro lado: tem o resumo de cada uma.\n\n') +
    '📌 Salva pra ler com calma.\n📲 Manda pra quem ainda não decidiu o voto.\n💬 Qual dessas pesa mais pra você?\n\n' +
    'Notícia dos dois lados, sem torcida. Receba no WhatsApp: link na bio.\n' + NOME[turno] + ' · ' + dia.replace('-', '/') + '\n\n' +
    '#segundoturno #eleicoes2026 #lula #flaviobolsonaro #politica';
}

async function fazReel(turno, j, ns) {
  const linhas = await (await fetch(SB + '/rest/v1/noticias?select=id,lado,veiculo,manchete,resumo,imagem&id=in.(' + ns.map((n) => n.id).join(',') + ')',
    { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } })).json();
  const porId = {}; linhas.forEach((n) => { porId[n.id] = n; });
  const dia = j.dia.replace('-', '/');
  const quadros = [{ jpg: Buffer.from(await vertical(await desenhaCapa(NOME[turno], dia, ns.length, FAIXA_CAPA[turno], true), 'O 2º TURNO HOJE', 'Siga @central2turno')), dur: 3 }];
  for (const n of ns) { const x = porId[n.id]; if (!x) continue; quadros.push({ jpg: Buffer.from(await desenhaStory(x, await baixaFoto(x.imagem), 'central-2turno.vercel.app', NOME[turno].toUpperCase() + ' · ' + dia)), dur: 5 }); }
  quadros.push({ jpg: Buffer.from(await vertical(await desenhaFim(), '', 'Siga @central2turno')), dur: 4 });
  const mp4 = await montaVideo(quadros);
  const nome = j.dia + '-' + turno + '-' + Date.now() + '.mp4';
  const up = await fetch(SB + '/storage/v1/object/reels/' + nome, { method: 'POST', body: mp4,
    headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'video/mp4', 'x-upsert': 'true' } });
  if (!up.ok) throw new Error('upload do vídeo: ' + up.status + ' ' + (await up.text()).slice(0, 150));
  return IG.reel(SB + '/storage/v1/object/public/reels/' + nome, legenda(turno, j.dia, ns, true));
}
const FAIXA_CAPA = { cedo: 'Tudo que saiu desde ontem à noite.', manha: 'Tudo que saiu entre 8h e 12h.', tarde: 'Tudo que saiu entre 12h e 18h.', noite: 'Tudo que saiu entre 18h e 22h.' };

// Reels de serviço do dia 25: um por dia, tema pela agenda (ou { tema } pra forçar)
async function servico(corpo, res) {
  const j = janela('tarde', Date.now());
  const tema = SERV.TEMAS[corpo.tema] ? corpo.tema : SERV.AGENDA[j.dia];
  if (!tema) return res.status(200).json({ pulou: 'sem tema pra hoje' });
  const chave = 'servico' + (corpo.tema ? '-' + tema : '');
  const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
  const trava = await fetch(SB + '/rest/v1/ig_posts', { method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({ dia: j.dia, turno: chave }) });
  if (trava.status === 409) return res.status(200).json({ pulou: 'já postou o serviço de hoje' });
  try {
    const mp4 = await montaVideo(await SERV.quadros(tema));
    const nome = j.dia + '-servico-' + tema + '-' + Date.now() + '.mp4';
    const up = await fetch(SB + '/storage/v1/object/reels/' + nome, { method: 'POST', body: mp4, headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'video/mp4', 'x-upsert': 'true' } });
    if (!up.ok) throw new Error('upload do vídeo: ' + up.status + ' ' + (await up.text()).slice(0, 150));
    const id = await IG.reel(SB + '/storage/v1/object/public/reels/' + nome, SERV.legenda(tema));
    return res.status(200).json({ reel: id, tema });
  } catch (e) {
    await fetch(SB + '/rest/v1/ig_posts?dia=eq.' + j.dia + '&turno=eq.' + chave, { method: 'DELETE', headers: H }).catch(() => {});
    return res.status(500).json({ erro: String(e.message || e) });
  }
}

async function roteiro() {
  const desde = new Date(Date.now() - 24 * 3600e3).toISOString();
  const r = await fetch(SB + '/rest/v1/noticias?select=id,lado,veiculo,manchete,resumo&status=eq.aprovado&tipo=eq.noticia&aprovado_em=gte.' + encodeURIComponent(desde) + '&order=aprovado_em.desc&limit=40',
    { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } });
  const ns = alterna(await r.json(), '13').slice(0, 6);
  if (ns.length < 2) throw new Error('poucas notícias nas últimas 24h');
  const LADO = { '13': 'sobre Lula (13)', '22': 'sobre Flávio (22)' };
  const prompt = `Escreve o que uma repórter vai falar num vídeo de uns 45 segundos sobre o dia no 2º turno (Lula, 13, contra Flávio Bolsonaro, 22).
Ela fala como gente: como alguém contando pra um amigo o que rolou hoje. Frase curta, ritmo solto, pode começar frase com "e" ou "mas".
Nada de cara de telejornal, nada de "olá pessoal", "fique por dentro", "confira", "é isso aí", "não perca". Nada de explicar o óbvio.
Não se apresenta, não diz que é IA, não explica o que é a Central (isso vai na legenda).
Usa só os fatos abaixo. Sem opinião, sem adjetivo que puxe pra um lado, sem prever quem ganha. Os dois lados com o mesmo peso, na ordem da lista.
Começa direto no assunto mais forte. Termina curto, tipo "o resto tá no link da bio".
Entre 100 e 125 palavras. Só o texto falado, sem título, sem marcação.

${ns.map((n, i) => (i + 1) + '. [' + (LADO[n.lado] || 'geral') + ', ' + n.veiculo + '] ' + n.manchete + (n.resumo ? ' — ' + n.resumo : '')).join('\n')}`;
  const ia = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', signal: AbortSignal.timeout(40000),
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5', max_tokens: 600, messages: [{ role: 'user', content: prompt }] }) });
  const j = await ia.json();
  if (!ia.ok) throw new Error('IA ' + ia.status + ': ' + JSON.stringify(j).slice(0, 150));
  const texto = (j.content || []).map((c) => c.text || '').join('').trim();
  const tok = process.env.TELEGRAM_TOKEN, chat = process.env.TELEGRAM_CHAT;
  if (tok && chat) await fetch('https://api.telegram.org/bot' + tok + '/sendMessage', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text: '🎙️ Roteiro da repórter virtual (' + texto.split(/\s+/).length + ' palavras):\n\n' + texto }) }).catch(() => {});
  return texto;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!process.env.FOTO_SEGREDO || req.headers['x-segredo'] !== process.env.FOTO_SEGREDO) return res.status(401).json({ erro: 'segredo errado' });
  if (!IG.ligado()) return res.status(200).json({ pulou: 'IG_TOKEN não configurado' });
  let corpo = req.body || {};
  if (typeof corpo === 'string') { try { corpo = JSON.parse(corpo); } catch (e) { corpo = {}; } }
  const turno = String(corpo.turno || req.query.turno || '');
  if (turno === 'servico') return servico(corpo, res);
  if (turno === 'roteiro') {   // roteiro da repórter virtual com as notícias aprovadas nas últimas 24h (vai pro Telegram)
    try { return res.status(200).json({ roteiro: await roteiro() }); } catch (e) { return res.status(500).json({ erro: String(e.message || e) }); }
  }
  if (turno === 'stories') {   // refaz o story de notícias que ficaram sem: { ids: [..] }
    const feitos = {};
    for (const id of (corpo.ids || []).slice(0, 15)) {
      try { feitos[id] = 'story ' + (await IG.story(SITE + '/ig/story/' + parseInt(id, 10) + '.jpg')); } catch (e) { feitos[id] = 'erro: ' + String(e.message || e); }
    }
    return res.status(200).json({ stories: feitos });
  }
  if (!NOME[turno]) return res.status(400).json({ erro: 'turno: cedo, manha, tarde, noite ou servico' });
  try {
    const j = janela(turno, Date.now());
    const querReel = corpo.reel === true || (REEL_TURNOS.includes(turno) && !corpo.carrossel);
    const chave = turno + (corpo.reel === true && !REEL_TURNOS.includes(turno) ? '-reel' : '');
    // trava: um post por turno por dia (se dispararem duas vezes, o segundo não posta)
    const trava = await fetch(SB + '/rest/v1/ig_posts', { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ dia: j.dia, turno: chave }) });
    if (trava.status === 409) return res.status(200).json({ pulou: 'já postou o ' + chave + ' de hoje' });
    const liberaTrava = () => fetch(SB + '/rest/v1/ig_posts?dia=eq.' + j.dia + '&turno=eq.' + chave, { method: 'DELETE', headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } }).catch(() => {});
    const r = await fetch(SB + '/rest/v1/noticias?select=id,lado,veiculo,manchete&status=eq.aprovado&tipo=eq.noticia' +
      '&aprovado_em=gte.' + encodeURIComponent(j.de) + '&aprovado_em=lt.' + encodeURIComponent(j.ate) + '&order=aprovado_em.desc&limit=60',
      { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } });
    if (!r.ok) throw new Error('Supabase ' + r.status);
    const vez = (Number(j.dia.slice(0, 2)) + ['cedo', 'manha', 'tarde', 'noite'].indexOf(turno)) % 2 ? '22' : '13';   // quem abre o carrossel reveza
    const ns = alterna(await r.json(), vez);
    if (ns.length < 2) { await liberaTrava(); return res.status(200).json({ pulou: 'só ' + ns.length + ' notícia(s) no turno' }); }
    if (querReel) {
      try { return res.status(200).json({ reel: await fazReel(turno, j, ns.slice(0, REEL_MAX)), noticias: ns.slice(0, REEL_MAX).map((n) => n.id) }); }
      catch (e) { console.error('reel falhou, vai carrossel', e); }   // se o vídeo falhar, sai o carrossel
    }
    const imagens = [SITE + '/ig/capa/' + turno + '-' + j.dia + '-' + ns.length + '.jpg'].concat(ns.map((n) => SITE + '/ig/feed/' + n.id + '.jpg'), [SITE + '/ig/fim.jpg']);
    const post = await IG.carrossel(imagens, legenda(turno, j.dia, ns));
    return res.status(200).json({ postado: post, noticias: ns.map((n) => n.id) });
  } catch (e) {
    try { const j = janela(turno, Date.now()); await fetch(SB + '/rest/v1/ig_posts?dia=eq.' + j.dia + '&turno=eq.' + turno, { method: 'DELETE', headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } }); } catch (e2) {}
    return res.status(500).json({ erro: String(e.message || e) });
  }
};
