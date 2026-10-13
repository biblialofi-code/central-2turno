// Imagem da notícia com a cara da Central: /api/card?id=123 (1080x1350 PNG)
const fs = require('fs');
const path = require('path');
const { desenha, baixaFoto } = require('../lib/card.js');
let CFG = null;
function cfg() {
  if (!CFG) {
    const html = fs.readFileSync(path.join(process.cwd(), 'site', 'index.html'), 'utf8');
    const pega = (k) => (html.match(new RegExp(k + ":\\s*'([^']+)'")) || [])[1] || '';
    CFG = { url: pega('SUPABASE_URL'), key: pega('SUPABASE_KEY') };
  }
  return CFG;
}
module.exports = async (req, res) => {
  const id = parseInt(req.query.id, 10);
  if (!id) return res.status(400).end();
  try {
    const c = cfg();
    const r = await fetch(c.url + '/rest/v1/noticias?select=id,lado,veiculo,manchete,resumo,imagem&status=eq.aprovado&id=eq.' + id, { headers: { apikey: c.key }, signal: AbortSignal.timeout(5000) });
    const n = r.ok ? (await r.json())[0] : null;
    if (!n) return res.status(404).end();
    const png = await desenha(n, await baixaFoto(n.imagem), req.headers['x-forwarded-host'] || req.headers.host);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).send(png);
  } catch (e) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(500).send('Erro ao gerar a imagem: ' + String(e && (e.stack || e.message) || e).slice(0, 800));
  }
};
