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
function alterna(lista) {
  const g = { '13': [], '22': [], ambos: [] };
  lista.forEach((n) => (g[n.lado] || g.ambos).push(n));
  const out = [];
  while (out.length < MAX && (g['13'].length || g['22'].length || g.ambos.length)) {
    for (const k of ['13', '22', 'ambos']) if (g[k].length && out.length < MAX) out.push(g[k].shift());
  }
  return out;
}
const MARCA = { '13': '🔴 13', '22': '🔵 22' };
function legenda(turno, dia, ns) {
  let t = NOME[turno] + ' do 2º turno · ' + dia.replace('-', '/') + '\n\n';
  for (const n of ns) {
    const linha = (MARCA[n.lado] || '⚪ Geral') + ' · ' + n.manchete + (n.veiculo ? ' (' + n.veiculo + ')' : '') + '\n';
    if (t.length + linha.length > 1700) break;
    t += linha;
  }
  return t + '\nResumo de cada uma no link da bio. Notícias dos dois lados, sem torcida.\n\n#segundoturno #eleicoes2026 #lula #flaviobolsonaro';
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
    const ns = alterna(await r.json());
    if (ns.length < 2) return res.status(200).json({ pulou: 'só ' + ns.length + ' notícia(s) no turno' });
    const imagens = [SITE + '/ig/capa/' + turno + '-' + j.dia + '-' + ns.length + '.jpg'].concat(ns.map((n) => SITE + '/ig/feed/' + n.id + '.jpg'));
    const post = await IG.carrossel(imagens, legenda(turno, j.dia, ns));
    return res.status(200).json({ postado: post, noticias: ns.map((n) => n.id) });
  } catch (e) {
    return res.status(500).json({ erro: String(e.message || e) });
  }
};
