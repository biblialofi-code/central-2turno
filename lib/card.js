// Desenha a imagem de uma notícia com a cara da Central (1080x1350, bom pro WhatsApp).
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');
let satori = null;
async function pegaSatori() {   // a satori só existe como módulo ES: carrega com import()
  if (!satori) { const m = await import('satori'); satori = m.default || m; }
  return satori;
}

const RED = '#E5243B', BLUE = '#2B6CEB', NEUTRAL = '#4A4A57';
const COR = { '13': RED, '22': BLUE };
const ROT = { '13': '13 · Lula', '22': '22 · Flávio' };

let LOGO = null;
function logo() {
  if (!LOGO) LOGO = 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, 'logo.png')).toString('base64');
  return LOGO;
}
let FONTES = null;
function fontes() {
  if (FONTES) return FONTES;
  const f = (arq) => fs.readFileSync(path.join(__dirname, 'fonts', arq));   // fontes ficam em lib/fonts (licença OFL)
  FONTES = [
    { name: 'Bricolage', data: f('bricolage-grotesque-latin-800-normal.woff'), weight: 800, style: 'normal' },
    { name: 'Bricolage', data: f('bricolage-grotesque-latin-600-normal.woff'), weight: 600, style: 'normal' },
    { name: 'Figtree', data: f('figtree-latin-500-normal.woff'), weight: 500, style: 'normal' },
    { name: 'Figtree', data: f('figtree-latin-700-normal.woff'), weight: 700, style: 'normal' },
    { name: 'Figtree', data: f('figtree-latin-800-normal.woff'), weight: 800, style: 'normal' }
  ];
  return FONTES;
}

function h(type, style, ...children) {
  const kids = children.flat().filter((c) => c !== null && c !== undefined && c !== false);
  return { type, props: { style, children: kids.length === 1 ? kids[0] : kids } };
}
function corta(txt, max) {
  txt = String(txt || '').trim();
  if (txt.length <= max) return txt;
  const c = txt.slice(0, max);
  return c.slice(0, Math.max(c.lastIndexOf(' '), max - 15)).replace(/[\s,.;:–-]+$/, '') + '…';
}

// n = { lado, manchete, resumo, veiculo }, foto = { data: Buffer, tipo: 'image/jpeg' } ou null
async function desenha(n, foto, host) {
  const W = 1080, H = 1350, cor = COR[n.lado] || NEUTRAL;
  const titulo = corta(n.manchete, foto ? 120 : 150);
  const tamT = foto ? (titulo.length > 85 ? 58 : 66) : (titulo.length > 110 ? 72 : 84);
  const resumo = corta(n.resumo, foto ? 150 : 230);

  const topo = foto
    ? h('div', { display: 'flex', flexDirection: 'column' },
        h('div', { display: 'flex', width: W, height: 14, background: cor }),
        { type: 'img', props: { src: 'data:' + foto.tipo + ';base64,' + foto.data.toString('base64'), width: W, height: 590, style: { width: W, height: 590, objectFit: 'cover' } } })
    : h('div', { display: 'flex', width: W, height: 14, background: cor });

  const miolo = h('div', { display: 'flex', flexDirection: 'column', padding: foto ? '44px 64px 0' : '0 72px', flexGrow: 1, justifyContent: foto ? 'flex-start' : 'center' },
    h('div', { display: 'flex' },
      h('div', { display: 'flex', background: cor, color: '#fff', fontFamily: 'Figtree', fontWeight: 800, fontSize: 34, padding: '10px 28px', borderRadius: 40 }, ROT[n.lado] || 'Geral')),
    h('div', { display: 'flex', marginTop: 28, color: '#FFFFFF', fontFamily: 'Bricolage', fontWeight: 800, fontSize: tamT, lineHeight: 1.08, letterSpacing: -1 }, titulo),
    resumo ? h('div', { display: 'flex', marginTop: 24, color: '#B5B5C2', fontFamily: 'Figtree', fontWeight: 500, fontSize: foto ? 34 : 40, lineHeight: 1.35 }, resumo) : null,
    h('div', { display: 'flex', marginTop: 20, color: '#8A8A99', fontFamily: 'Figtree', fontWeight: 700, fontSize: 28 }, 'Fonte: ' + (n.veiculo || '')));

  const rodape = h('div', { display: 'flex', flexDirection: 'column' },
    h('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '0 64px 36px' },
      { type: 'img', props: { src: logo(), width: 262, height: 96, style: { width: 262, height: 96 } } },
      h('div', { display: 'flex', fontFamily: 'Figtree', fontWeight: 700, fontSize: 28, color: '#8A8A99' }, host || 'central-2turno.vercel.app')),
    h('div', { display: 'flex', width: W, height: 16 },
      h('div', { display: 'flex', width: W / 2, height: 16, background: RED }),
      h('div', { display: 'flex', width: W / 2, height: 16, background: BLUE })));

  const arvore = h('div', { display: 'flex', flexDirection: 'column', width: W, height: H, background: '#0C0C10' }, topo, miolo, rodape);
  const svg = await (await pegaSatori())(arvore, { width: W, height: H, fonts: fontes() });
  return new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng();
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
async function baixaFoto(url) {
  if (!/^https:\/\//.test(url || '')) return null;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'image/jpeg,image/png,image/*' }, signal: AbortSignal.timeout(8000) });
    const tipo = (r.headers.get('content-type') || '').split(';')[0];
    if (!r.ok || !/^image\/(jpeg|png|jpg)$/.test(tipo)) return null;   // webp/avif o desenho não entende
    const data = Buffer.from(await r.arrayBuffer());
    return data.length < 8 * 1024 * 1024 ? { data, tipo } : null;
  } catch (e) { return null; }
}

module.exports = { desenha, baixaFoto, ROT };
