// Apuração do 2º turno (presidente) a partir dos arquivos oficiais do TSE.
// /api/apuracao            -> 2º turno (eleição 6258)
// /api/apuracao?ele=6257   -> 1º turno, pra testar com dados reais
// Formato: https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados
const BASE = 'https://resultados.tse.jus.br/oficial/ele2026';
const num = (s) => { if (s == null || s === '') return 0; const v = Number(String(s).replace(',', '.')); return isFinite(v) ? v : 0; };

module.exports = async (req, res) => {
  const ele = /^\d{4,6}$/.test(String(req.query.ele || '')) ? String(req.query.ele) : '6258';
  const url = BASE + '/' + ele + '/dados/br/br-c0001-e' + ele.padStart(6, '0') + '-u.json';
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
    if (r.status === 404 || r.status === 403) {
      res.setHeader('Cache-Control', 'public, s-maxage=60');
      return res.status(200).json({ ele, aguardando: true });
    }
    if (!r.ok) throw new Error('TSE ' + r.status);
    const d = await r.json();
    const carg = (d.carg || []).find((c) => String(c.cd) === '1') || (d.carg || [])[0] || {};
    const cands = [];
    (carg.agr || []).forEach((a) => (a.par || []).forEach((p) => (p.cand || []).forEach((c) => {
      cands.push({ n: String(c.n), nome: c.nmu || c.nm, vap: num(c.vap), pvap: num(c.pvap), st: c.st || null });
    })));
    const s = d.s || {}, v = d.v || {}, e = d.e || {};
    const out = {
      ele, dt: d.dt || null, ht: d.ht || null,
      pst: s.pst != null ? num(s.pst) : (num(s.ts) ? num(s.st) / num(s.ts) * 100 : 0),
      st: num(s.st), ts: num(s.ts),
      vv: num(v.vv), vb: num(v.vb), tvn: num(v.tvn), a: num(e.a), est: num(e.est),
      cands: cands.filter((c) => c.n === '13' || c.n === '22')
    };
    // se o TSE não mandar o % de votos válidos, calcula
    out.cands.forEach((c) => { if (!c.pvap && out.vv) c.pvap = c.vap / out.vv * 100; });
    res.setHeader('Cache-Control', 'public, s-maxage=20, stale-while-revalidate=40');
    return res.status(200).json(out);
  } catch (err) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ ele, erro: String(err.message || err) });
  }
};
