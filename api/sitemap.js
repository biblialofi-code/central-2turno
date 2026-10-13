// /sitemap.xml: home, vídeos e todas as notícias aprovadas
const P = require('../lib/pagina.js');
module.exports = async (req, res) => {
  const origem = 'https://' + (req.headers['x-forwarded-host'] || req.headers.host);
  let rows = [];
  try { rows = await P.supabase('noticias?select=id,aprovado_em&status=eq.aprovado&order=aprovado_em.desc&limit=5000'); } catch (e) { rows = []; }
  const agora = new Date().toISOString();
  const url = (loc, mod, freq, pri) => '<url><loc>' + loc + '</loc>' + (mod ? '<lastmod>' + mod + '</lastmod>' : '') +
    '<changefreq>' + freq + '</changefreq><priority>' + pri + '</priority></url>';
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    url(origem + '/', agora, 'hourly', '1.0') + url(origem + '/dia-25', agora, 'daily', '0.9') + url(origem + '/videos', agora, 'daily', '0.6') +
    rows.map((n) => url(origem + '/n/' + n.id, n.aprovado_em ? new Date(n.aprovado_em).toISOString() : '', 'weekly', '0.7')).join('') +
    '</urlset>';
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=600');
  res.status(200).send(xml);
};
