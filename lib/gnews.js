// Google News: link real da matéria e o texto dela (pra IA ler a matéria inteira, não só a manchete).
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
function comTempo(ms) { return AbortSignal.timeout(ms); }
// ---------- 1) link do Google News -> link real ----------
async function linkReal(link) {
  const m = String(link).match(/news\.google\.com\/(?:rss\/)?articles\/([^?/#]+)/);
  if (!m) return link;                        // já é link do jornal
  const id = m[1];
  let sg, ts;
  for (const base of ['https://news.google.com/articles/', 'https://news.google.com/rss/articles/']) {
    try {
      const r = await fetch(base + id, { headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR,pt;q=0.9' }, signal: comTempo(8000) });
      const html = await r.text();
      sg = (html.match(/data-n-a-sg="([^"]+)"/) || [])[1];
      ts = (html.match(/data-n-a-ts="([^"]+)"/) || [])[1];
      if (sg && ts) break;
    } catch (e) { /* tenta o outro */ }
  }
  if (!sg || !ts) throw new Error('não achei a assinatura do Google News');
  const pedido = [[[
    'Fbv4je',
    '["garturlreq",[["X","X",["X","X"],null,null,1,1,"US:en",null,1,null,null,null,null,null,0,1],"X","X",1,[1,1,1],1,1,null,0,0,null,0],"' + id + '",' + ts + ',"' + sg + '"]'
  ]]];
  const r = await fetch('https://news.google.com/_/DotsSplashUi/data/batchexecute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', 'User-Agent': UA },
    body: 'f.req=' + encodeURIComponent(JSON.stringify(pedido)),
    signal: comTempo(8000)
  });
  const texto = await r.text();
  const bloco = JSON.parse(texto.split('\n\n')[1]);
  const url = JSON.parse(bloco[0][2])[1];
  if (!/^https?:\/\//.test(url)) throw new Error('Google News não devolveu link');
  return url;
}


const ENT = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', atilde: 'ã', otilde: 'õ', ccedil: 'ç', acirc: 'â', ecirc: 'ê', ocirc: 'ô', agrave: 'à', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', ndash: '–', mdash: '—', hellip: '…' };
function limpa(s) {
  return s.replace(/<[^>]+>/g, ' ').replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] || m).replace(/\s+/g, ' ').trim();
}
// Texto da matéria: parágrafos que citam o político e os vizinhos, até ~max caracteres
async function textoMateria(url, nome, max = 3000) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR,pt;q=0.9', Accept: 'text/html' }, redirect: 'follow', signal: comTempo(9000) });
  if (!r.ok) return '';
  let html = (await r.text()).slice(0, 800000);
  html = html.replace(/<(script|style|noscript|svg|nav|footer|header|aside)\b[\s\S]*?<\/\1>/gi, ' ');
  const ps = (html.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) || []).map(limpa).filter((t) => t.length > 40);
  if (!ps.length) return '';
  const sobrenome = nome.split(/\s+/).pop().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const tem = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(sobrenome);
  const pega = new Set();
  ps.forEach((t, i) => { if (tem(t)) { pega.add(i - 1); pega.add(i); pega.add(i + 1); } });
  const idx = pega.size ? [...pega].filter((i) => i >= 0 && i < ps.length).sort((x, y) => x - y) : ps.map((t, i) => i).slice(0, 6);
  let out = '';
  for (const i of idx) { if (out.length + ps[i].length > max) break; out += ps[i] + '\n'; }
  return out.trim();
}
module.exports = { linkReal, textoMateria };
