// Página de cada notícia: /n/123
// Devolve o próprio index.html com título, descrição e foto da notícia no <head>
// (é isso que o WhatsApp e o Facebook leem pra montar a prévia do link)
// e a notícia já embutida, pra abrir na hora.
const fs = require('fs');
const path = require('path');

let BASE = null;
function base() {
  if (!BASE) BASE = fs.readFileSync(path.join(process.cwd(), 'site', 'index.html'), 'utf8');
  return BASE;
}
function cfg(html, chave) {
  const m = html.match(new RegExp(chave + ":\\s*'([^']+)'"));
  return m ? m[1] : '';
}
function attr(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function trocaMeta(html, prop, valor) {
  const re = new RegExp('<meta (property|name)="' + prop.replace(':', '\\:') + '" content="[^"]*">');
  const tag = '<meta ' + (prop.startsWith('og:') ? 'property' : 'name') + '="' + prop + '" content="' + attr(valor) + '">';
  return re.test(html) ? html.replace(re, tag) : html.replace('</head>', tag + '\n</head>');
}

module.exports = async (req, res) => {
  let html = base();
  const id = parseInt(req.query.id, 10);
  const origem = 'https://' + (req.headers['x-forwarded-host'] || req.headers.host);
  let n = null;
  if (id) {
    try {
      const url = cfg(html, 'SUPABASE_URL'), key = cfg(html, 'SUPABASE_KEY');
      const r = await fetch(url + '/rest/v1/noticias?select=*&status=eq.aprovado&id=eq.' + id, {
        headers: { apikey: key }, signal: AbortSignal.timeout(5000)
      });
      if (r.ok) n = (await r.json())[0] || null;
    } catch (e) { n = null; }
  }

  if (n) {
    const titulo = n.manchete;
    const desc = n.resumo || '';
    const img = /^https:\/\//.test(n.imagem || '') ? n.imagem : origem + '/og.png';
    html = html.replace(/<title>[^<]*<\/title>/, '<title>' + attr(titulo) + ' · Central 2º Turno</title>');
    html = trocaMeta(html, 'description', desc);
    html = trocaMeta(html, 'og:title', titulo);
    html = trocaMeta(html, 'og:description', desc + ' (' + n.veiculo + ')');
    html = trocaMeta(html, 'og:image', img);
    html = trocaMeta(html, 'og:url', origem + '/n/' + n.id);
    html = trocaMeta(html, 'og:type', 'article');
    html = html.replace('<head>', '<head>\n<link rel="canonical" href="' + attr(origem + '/n/' + n.id) + '">');
  }
  // a notícia vai junto, pra página abrir sem esperar
  const dados = JSON.stringify(n ? { id: n.id, lado: n.lado, tipo: n.tipo, veiculo: n.veiculo, manchete: n.manchete, resumo: n.resumo, link: n.link, imagem: n.imagem, publicado_em: n.publicado_em, aprovado_em: n.aprovado_em } : null)
    .replace(/</g, '\\u003c');
  html = html.replace('<script>', '<script>window.NOTICIA = ' + dados + '; window.NOTICIA_ID = ' + (id || 'null') + ';</script>\n<script>');

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', n ? 'public, s-maxage=300, stale-while-revalidate=86400' : 'no-store');
  res.status(n ? 200 : 404).send(html);
};
