// Página de cada notícia: /n/123
// O site com título, descrição, foto e dados estruturados da notícia no <head>
// (WhatsApp, Facebook e Google leem daqui) e a notícia já embutida, pra abrir na hora.
const P = require('../lib/pagina.js');

module.exports = async (req, res) => {
  let html = P.template();
  const id = parseInt(req.query.id, 10);
  const origem = 'https://' + (req.headers['x-forwarded-host'] || req.headers.host);
  let n = null;
  if (id) {
    try { n = (await P.supabase('noticias?select=*&status=eq.aprovado&id=eq.' + id))[0] || null; } catch (e) { n = null; }
  }

  if (n) {
    const url = origem + '/n/' + n.id;
    const desc = n.resumo || '';
    const img = /^https:\/\//.test(n.imagem || '') ? n.imagem : origem + '/og.png';
    const quem = { '13': 'Lula', '22': 'Flávio Bolsonaro' }[n.lado];
    html = P.trocaTitulo(html, n.manchete + ' · Central 2º Turno');
    html = P.trocaMeta(html, 'description', desc);
    html = P.trocaMeta(html, 'og:title', n.manchete);
    html = P.trocaMeta(html, 'og:description', desc + ' (' + n.veiculo + ')');
    html = P.trocaMeta(html, 'og:image', img);
    html = P.trocaMeta(html, 'og:url', url);
    html = P.trocaMeta(html, 'og:type', 'article');
    html = P.trocaCanonical(html, url);
    html = P.poeNoHead(html, P.jsonLd({
      '@context': 'https://schema.org', '@type': 'NewsArticle',
      headline: String(n.manchete).slice(0, 110), description: desc, image: [img],
      datePublished: n.publicado_em || n.aprovado_em, dateModified: n.aprovado_em || n.publicado_em,
      mainEntityOfPage: url, isBasedOn: n.link, inLanguage: 'pt-BR',
      about: quem ? [{ '@type': 'Person', name: quem }] : undefined,
      author: { '@type': 'Organization', name: 'Central 2º Turno', url: origem + '/' },
      publisher: { '@type': 'Organization', name: 'Central 2º Turno', logo: { '@type': 'ImageObject', url: origem + '/logo.png' } }
    }));
    html = html.replace('<body>', '<body class="modo-noticia">');
    // o texto já no HTML, pro Google (o navegador troca pela versão completa)
    html = html.replace('<section id="secArtigo" aria-live="polite"></section>',
      '<section id="secArtigo" aria-live="polite"><article class="artigo"><div class="corpo"><h1 class="display">' + P.attr(n.manchete) + '</h1>' +
      '<p class="resumo">' + P.attr(desc) + '</p><p><a href="' + P.attr(n.link) + '" rel="noopener">Ler no ' + P.attr(n.veiculo) + '</a></p></div></article></section>');
  } else {
    html = P.trocaMeta(html, 'robots', 'noindex');
  }
  const dados = JSON.stringify(n ? { id: n.id, lado: n.lado, tipo: n.tipo, veiculo: n.veiculo, manchete: n.manchete, resumo: n.resumo, link: n.link, imagem: n.imagem, publicado_em: n.publicado_em, aprovado_em: n.aprovado_em } : null)
    .replace(/</g, '\\u003c');
  html = P.dadosJs(html, 'window.NOTICIA = ' + dados + '; window.NOTICIA_ID = ' + (id || 'null') + ';');

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', n ? 'public, s-maxage=300, stale-while-revalidate=86400' : 'no-store');
  res.status(n ? 200 : 404).send(html);
};
