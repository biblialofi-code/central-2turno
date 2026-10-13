// Entrega a foto de uma notícia pelo próprio site (/api/img?id=123).
// Precisa disso pra desenhar a foto na imagem de compartilhar: o navegador
// não deixa usar foto de outro site num canvas e depois salvar.
// Só serve fotos de notícias aprovadas (não é um proxy aberto).
const fs = require('fs');
const path = require('path');
let CFG = null;
function cfg() {
  if (!CFG) {
    const html = fs.readFileSync(path.join(process.cwd(), 'site', 'app.html'), 'utf8');
    const pega = (k) => (html.match(new RegExp(k + ":\\s*'([^']+)'")) || [])[1] || '';
    CFG = { url: pega('SUPABASE_URL'), key: pega('SUPABASE_KEY') };
  }
  return CFG;
}
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';

module.exports = async (req, res) => {
  const id = parseInt(req.query.id, 10);
  if (!id) return res.status(400).end();
  try {
    const c = cfg();
    const r = await fetch(c.url + '/rest/v1/noticias?select=imagem&status=eq.aprovado&id=eq.' + id, { headers: { apikey: c.key }, signal: AbortSignal.timeout(5000) });
    const linha = r.ok ? (await r.json())[0] : null;
    if (!linha || !/^https:\/\//.test(linha.imagem || '')) return res.status(404).end();
    const f = await fetch(linha.imagem, { headers: { 'User-Agent': UA, Accept: 'image/*' }, signal: AbortSignal.timeout(8000) });
    const tipo = f.headers.get('content-type') || '';
    if (!f.ok || !/^image\//.test(tipo)) return res.status(404).end();
    const buf = Buffer.from(await f.arrayBuffer());
    if (buf.length > 6 * 1024 * 1024) return res.status(413).end();
    res.setHeader('Content-Type', tipo);
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800');
    return res.status(200).send(buf);
  } catch (e) {
    return res.status(502).end();
  }
};
