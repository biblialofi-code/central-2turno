// Busca no TSE, pros 21 do Radar: foto oficial de candidato (todo mundo tem, mesmo padrão) e votos oficiais.
// Chamado por /api/promessas-busca com { acao: 'tse' } (a Vercel grátis só aceita 12 funções). Responde um relatório.
const SB = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_KEY;
const DIVULGA = 'https://divulgacandcontas.tse.jus.br/divulga/rest';
const RESULT = 'https://resultados.tse.jus.br/oficial/ele2026';
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36', Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'pt-BR,pt;q=0.9', Referer: 'https://divulgacandcontas.tse.jus.br/divulga/', Origin: 'https://divulgacandcontas.tse.jus.br' };
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
const sem = (s) => s.replace(/^(PROFESSORA?|DELEGAD[OA]|SARGENTO|DRA?|PASTOR[A]?) /, '');
const num = (s) => { const v = Number(String(s || '').replace(/\./g, '').replace(',', '.')); return isFinite(v) ? v : 0; };

async function sb(caminho, opcoes = {}) {
  const r = await fetch(SB + '/rest/v1/' + caminho, { ...opcoes, headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', ...(opcoes.headers || {}) } });
  if (!r.ok) throw new Error('Supabase ' + r.status + ': ' + (await r.text()).slice(0, 200));
  const t = await r.text(); return t ? JSON.parse(t) : null;
}
async function json(url) {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(r.status + ' ' + url);
  return r.json();
}
function acha(lista, nome, campo) {
  const alvo = norm(nome), alvo2 = sem(alvo);
  let c = lista.filter((x) => norm(x[campo]) === alvo || sem(norm(x[campo])) === alvo2);
  if (c.length !== 1) c = lista.filter((x) => norm(x[campo]).includes(alvo2));
  return c.length === 1 ? c[0] : null;
}

module.exports = async (req, res) => {
  const rel = { eleicoes: [], fotos: {}, votos: {}, erros: [] };
  try {
    const pols = await sb('politicos?select=id,nome,uf,votos&ativo=eq.true');
    const ufs = [...new Set(pols.map((p) => p.uf))];

    // 1) fotos: eleições de 2026 no DivulgaCandContas -> candidatos a deputado federal (cargo 6) por estado
    let eleicoes = [];
    try { eleicoes = (await json(DIVULGA + '/v1/eleicao/ordinarias')).filter((e) => String(e.ano) === '2026'); } catch (e) { rel.erros.push('lista de eleições: ' + e.message); }
    rel.eleicoes = eleicoes.map((e) => e.id + ' ' + (e.nomeEleicao || e.descricaoEleicao || ''));
    for (const uf of ufs) {
      let cands = [], idEle = null;
      for (const e of eleicoes) {
        try { const j = await json(DIVULGA + '/v1/candidatura/listar/2026/' + uf + '/' + e.id + '/6/candidatos'); if ((j.candidatos || []).length) { cands = j.candidatos; idEle = e.id; break; } } catch (err) { /* tenta a próxima */ }
      }
      for (const p of pols.filter((x) => x.uf === uf)) {
        const c = cands.length ? acha(cands, p.nome, 'nomeUrna') : null;
        if (!c) { rel.fotos[p.nome] = cands.length ? 'não achei o nome' : 'sem lista do TSE'; continue; }
        const foto = DIVULGA + '/arquivo/img/' + idEle + '/' + c.id + '/' + uf;
        await sb('politicos?id=eq.' + p.id, { method: 'PATCH', body: JSON.stringify({ foto_url: foto }) });
        rel.fotos[p.nome] = 'ok';
      }
    }

    // 2) votos oficiais do 1º turno (arquivo de resultado de deputado federal, cargo 0006, por estado)
    for (const uf of ufs) {
      let d = null;
      for (const ele of ['6259', '6257', '6260']) {
        try { d = await json(RESULT + '/' + ele + '/dados/' + uf.toLowerCase() + '/' + uf.toLowerCase() + '-c0006-e' + ele.padStart(6, '0') + '-u.json'); break; } catch (e) { d = null; }
      }
      const cands = [];
      ((d && d.carg) || []).forEach((cg) => (cg.agr || []).forEach((a) => (a.par || []).forEach((pa) => (pa.cand || []).forEach((c) => cands.push(c)))));
      for (const p of pols.filter((x) => x.uf === uf)) {
        const c = cands.length ? acha(cands, p.nome, 'nmu') : null;
        if (!c) { rel.votos[p.nome] = cands.length ? 'não achei o nome' : 'sem resultado do TSE'; continue; }
        const v = num(c.vap);
        await sb('politicos?id=eq.' + p.id, { method: 'PATCH', body: JSON.stringify({ votos: v, votos_fonte: 'TSE, resultado oficial do 1º turno' }) });
        rel.votos[p.nome] = v + (p.votos && p.votos !== v ? ' (antes: ' + p.votos + ')' : '');
      }
    }
    return res.status(200).json(rel);
  } catch (e) { rel.erros.push(String(e.message || e)); return res.status(500).json(rel); }
};
