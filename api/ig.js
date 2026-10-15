// Imagens em JPG pro Instagram buscar:
//   /ig/story/123.jpg  -> story 1080x1920 da notícia 123
//   /ig/feed/123.jpg   -> slide 1080x1350 da notícia 123
//   /ig/capa/tarde-14-10-5-123_456.jpg -> capa do carrossel (turno, dia, quantas notícias, ids das manchetes da capa)
const fs = require('fs'), path = require('path');
const { desenhaStory, desenhaFeed, desenhaCapa, desenhaFim, baixaFoto } = require('../lib/card.js');
let CFG = null;
function cfg() {
  if (!CFG) {
    const html = fs.readFileSync(path.join(process.cwd(), 'site', 'app.html'), 'utf8');
    const pega = (k) => (html.match(new RegExp(k + ":\\s*'([^']+)'")) || [])[1] || '';
    CFG = { url: pega('SUPABASE_URL'), key: pega('SUPABASE_KEY') };
  }
  return CFG;
}
const TURNO = { cedo: 'Manhã', manha: 'Meio-dia', tarde: 'Tarde', noite: 'Noite' };
const FAIXA = { cedo: 'Tudo que saiu desde ontem à noite.', manha: 'Tudo que saiu entre 8h e 12h.', tarde: 'Tudo que saiu entre 8h e 18h.', noite: 'Tudo que saiu entre 18h e 22h.' };
module.exports = async (req, res) => {
  const tipo = String(req.query.tipo || '');
  try {
    let jpg;
    if (tipo === 'capa') {
      const m = String(req.query.chave || '').match(/^(cedo|manha|tarde|noite)-(\d\d)-(\d\d)-(\d+)(?:-(\d+(?:_\d+)?))?$/);
      if (!m) return res.status(400).end();
      let destaques = [];
      if (m[5]) {   // manchetes da capa, na ordem dos ids
        const ids = m[5].split('_'), c = cfg();
        const r = await fetch(c.url + '/rest/v1/noticias?select=id,lado,manchete&status=eq.aprovado&id=in.(' + ids.join(',') + ')', { headers: { apikey: c.key }, signal: AbortSignal.timeout(5000) });
        const linhas = r.ok ? await r.json() : [];
        destaques = ids.map((id) => linhas.find((n) => String(n.id) === id)).filter(Boolean);
      }
      jpg = await desenhaCapa(TURNO[m[1]], m[2] + '/' + m[3], Number(m[4]), FAIXA[m[1]], false, destaques);
    } else if (tipo === 'fim') {
      jpg = await desenhaFim();
    } else {
      const id = parseInt(req.query.id, 10);
      if (!id || (tipo !== 'story' && tipo !== 'feed')) return res.status(400).end();
      const c = cfg();
      const r = await fetch(c.url + '/rest/v1/noticias?select=id,lado,veiculo,manchete,resumo,imagem&status=eq.aprovado&id=eq.' + id, { headers: { apikey: c.key }, signal: AbortSignal.timeout(5000) });
      const n = r.ok ? (await r.json())[0] : null;
      if (!n) return res.status(404).end();
      const host = 'central-2turno.vercel.app';
      jpg = await (tipo === 'story' ? desenhaStory : desenhaFeed)(n, await baixaFoto(n.imagem), host);
    }
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, s-maxage=86400');
    return res.status(200).send(Buffer.from(jpg));
  } catch (e) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(500).send('Erro: ' + String(e && (e.stack || e.message) || e).slice(0, 800));
  }
};
