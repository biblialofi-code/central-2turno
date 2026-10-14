// Carrossel do Instagram: manhã (12h), tarde (18h) e noite (22h), horário de Brasília.
// Quem chama: o pg_cron do Supabase (10-instagram.sql), com { turno } e o header x-segredo = FOTO_SEGREDO.
// Pega as notícias aprovadas na janela do turno, alterna 13 / 22 / Geral e posta capa + até 9 notícias.
const IG = require('../lib/instagram.js');
const SB = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_KEY;
const SITE = 'https://central-2turno.vercel.app';
const NOME = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' };
const INICIO = { manha: -2, tarde: 12, noite: 18 };   // hora de Brasília em que a janela começa (-2 = 22h do dia anterior)
const MAX = 9;

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
const FAIXA = { manha: 'desde ontem à noite', tarde: 'entre 12h e 18h', noite: 'entre 18h e 22h' };
const QUANDO = { manha: 'hoje de manhã', tarde: 'hoje à tarde', noite: 'hoje à noite' };
function legenda(turno, dia, ns) {
  // 1ª linha é o que aparece antes do "mais": número + curiosidade
  let t = ns.length + ' notícias que mexeram no 2º turno ' + QUANDO[turno] + ' 👇\n\n';
  for (const n of ns) {
    const linha = (MARCA[n.lado] || '⚪ Geral') + ' · ' + n.manchete + (n.veiculo ? ' (' + n.veiculo + ')' : '') + '\n';
    if (t.length + linha.length > 1500) break;
    t += linha;
  }
  return t + '\nArrasta pro lado: tem o resumo de cada uma.\n\n' +
    '📌 Salva pra ler com calma.\n📲 Manda pra quem ainda não decidiu o voto.\n💬 Qual dessas pesa mais pra você?\n\n' +
    'Notícia dos dois lados, sem torcida. Receba no WhatsApp: link na bio.\n' + NOME[turno] + ' · ' + dia.replace('-', '/') + '\n\n' +
    '#segundoturno #eleicoes2026 #lula #flaviobolsonaro #politica';
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!process.env.FOTO_SEGREDO || req.headers['x-segredo'] !== process.env.FOTO_SEGREDO) return res.status(401).json({ erro: 'segredo errado' });
  if (!IG.ligado()) return res.status(200).json({ pulou: 'IG_TOKEN não configurado' });
  let corpo = req.body || {};
  if (typeof corpo === 'string') { try { corpo = JSON.parse(corpo); } catch (e) { corpo = {}; } }
  const turno = String(corpo.turno || req.query.turno || '');
  if (!NOME[turno]) return res.status(400).json({ erro: 'turno: manha, tarde ou noite' });
  try {
    const j = janela(turno, Date.now());
    const r = await fetch(SB + '/rest/v1/noticias?select=id,lado,veiculo,manchete&status=eq.aprovado&tipo=eq.noticia' +
      '&aprovado_em=gte.' + encodeURIComponent(j.de) + '&aprovado_em=lt.' + encodeURIComponent(j.ate) + '&order=aprovado_em.desc&limit=60',
      { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } });
    if (!r.ok) throw new Error('Supabase ' + r.status);
    const vez = (Number(j.dia.slice(0, 2)) + ['manha', 'tarde', 'noite'].indexOf(turno)) % 2 ? '22' : '13';   // quem abre o carrossel reveza
    const ns = alterna(await r.json(), vez);
    if (ns.length < 2) return res.status(200).json({ pulou: 'só ' + ns.length + ' notícia(s) no turno' });
    const imagens = [SITE + '/ig/capa/' + turno + '-' + j.dia + '-' + ns.length + '.jpg'].concat(ns.map((n) => SITE + '/ig/feed/' + n.id + '.jpg'));
    const post = await IG.carrossel(imagens, legenda(turno, j.dia, ns));
    return res.status(200).json({ postado: post, noticias: ns.map((n) => n.id) });
  } catch (e) {
    return res.status(500).json({ erro: String(e.message || e) });
  }
};
