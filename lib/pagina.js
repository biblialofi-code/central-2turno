// Peças comuns das páginas montadas no servidor (home, /videos, /n/ID).
const fs = require('fs');
const path = require('path');

let BASE = null;
function template() {
  if (!BASE) BASE = fs.readFileSync(path.join(process.cwd(), 'site', 'app.html'), 'utf8');
  return BASE;
}
function cfg(chave) {
  const m = template().match(new RegExp(chave + ":\\s*'([^']+)'"));
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
function trocaTitulo(html, t) { return html.replace(/<title>[^<]*<\/title>/, '<title>' + attr(t) + '</title>'); }
function trocaCanonical(html, url) {
  const tag = '<link rel="canonical" href="' + attr(url) + '">';
  return /<link rel="canonical"[^>]*>/.test(html) ? html.replace(/<link rel="canonical"[^>]*>/, tag) : html.replace('</head>', tag + '\n</head>');
}
function jsonLd(obj) {
  return '<script type="application/ld+json">' + JSON.stringify(obj).replace(/</g, '\\u003c') + '</script>';
}
function poeNoHead(html, trecho) { return html.replace('</head>', trecho + '\n</head>'); }
function dadosJs(html, js) { return html.replace('<script>', '<script>' + js + '</script>\n<script>'); }

async function supabase(caminho) {
  const r = await fetch(cfg('SUPABASE_URL') + '/rest/v1/' + caminho, { headers: { apikey: cfg('SUPABASE_KEY') }, signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error('Supabase ' + r.status);
  return r.json();
}

function ha(iso) {
  if (!iso) return '';
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return 'há ' + m + ' min';
  const h = Math.round(m / 60);
  if (h < 24) return 'há ' + h + ' h';
  return 'há ' + Math.round(h / 24) + ' d';
}
const ROT = { '13': '13 · Lula', '22': '22 · Flávio' }, CLS = { '13': 't13', '22': 't22' };
// mesmo desenho do card do navegador (o JavaScript troca por ele assim que carrega)
function card(n) {
  const foto = /^https:\/\//.test(n.imagem || '')
    ? '<div class="foto"><img src="' + attr(n.imagem) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"></div>' : '';
  return '<article class="card" data-abrir="' + n.id + '">' + foto +
    '<div class="meta"><span class="tag ' + (CLS[n.lado] || 'tamb') + '">' + (ROT[n.lado] || 'Geral') + '</span>' +
    '<span class="src">' + attr(n.veiculo) + ' · ' + ha(n.publicado_em || n.aprovado_em) + '</span></div>' +
    '<h3><a href="/n/' + n.id + '" data-abrir="' + n.id + '">' + attr(n.manchete) + '</a></h3>' +
    '<p>' + attr(n.resumo) + '</p>' +
    '<div class="actions"><a class="btn-read" href="/n/' + n.id + '" data-abrir="' + n.id + '">Ver notícia</a></div></article>';
}

module.exports = { template, cfg, attr, trocaMeta, trocaTitulo, trocaCanonical, jsonLd, poeNoHead, dadosJs, supabase, card };
