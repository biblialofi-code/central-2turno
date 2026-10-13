// Home (/) e /videos montadas no servidor: as notícias já vêm no HTML
// (o Google lê sem precisar rodar JavaScript) e o navegador pinta na hora.
const P = require('../lib/pagina.js');

module.exports = async (req, res) => {
  const origem = 'https://' + (req.headers['x-forwarded-host'] || req.headers.host);
  const videos = req.query.pagina === 'videos';
  let html = P.template(), rows = null;
  try {
    rows = await P.supabase('noticias?select=*&status=eq.aprovado&order=publicado_em.desc.nullslast,aprovado_em.desc&limit=60');
  } catch (e) { rows = null; }

  if (rows) {
    const lista = rows.filter((r) => r.tipo !== 'pesquisa').slice(0, 30);
    if (lista.length) html = html.replace('<div class="feed" id="feed"><div class="empty">Carregando…</div></div>',
      '<div class="feed" id="feed">' + lista.map(P.card).join('') + '</div>');
    html = P.dadosJs(html, 'window.NOTICIAS_INICIAIS = ' + JSON.stringify(rows).replace(/</g, '\\u003c') + ';');
  }

  if (videos) {
    const t = 'Vídeos do 2º turno: debates, entrevistas e análises · Central 2º Turno';
    const d = 'Debates, entrevistas e análises do 2º turno entre Lula e Flávio Bolsonaro, num lugar só.';
    html = P.trocaTitulo(html, t);
    html = P.trocaMeta(html, 'description', d);
    html = P.trocaMeta(html, 'og:title', 'Vídeos do 2º turno · Central 2º Turno');
    html = P.trocaMeta(html, 'og:description', d);
    html = P.trocaCanonical(html, origem + '/videos');
  } else {
    html = P.trocaCanonical(html, origem + '/');
    html = P.poeNoHead(html, P.jsonLd({
      '@context': 'https://schema.org', '@type': 'WebSite', name: 'Central 2º Turno', url: origem + '/',
      description: 'Notícias do 2º turno de Lula e Flávio Bolsonaro num lugar só, com link pro jornal que publicou.',
      publisher: { '@type': 'Organization', name: 'Central 2º Turno', logo: { '@type': 'ImageObject', url: origem + '/logo.png' } }
    }));
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=600');
  res.status(200).send(html);
};
