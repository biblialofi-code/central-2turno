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

// Desenho genérico. o = { cor, rotulo, titulo, corpo, fonte, play, ajuste: 'cover'|'contain' }
async function desenhaCard(o, foto, host) {
  try { return await desenhaCard0(o, foto, host); }
  catch (e) { if (foto) return desenhaCard0(o, null, host); throw e; }   // foto estranha: faz sem foto
}
async function desenhaCard0(o, foto, host) {
  const W = 1080, H = 1350, cor = o.cor || NEUTRAL;
  const titulo = corta(o.titulo, foto ? 120 : 150);
  const tamT = foto ? (titulo.length > 85 ? 58 : 66) : (titulo.length > 110 ? 72 : 84);
  const corpo = corta(o.corpo, foto ? 150 : 230);
  const img = foto ? { type: 'img', props: { src: 'data:' + foto.tipo + ';base64,' + foto.data.toString('base64'), width: W, height: 590,
    style: { width: W, height: 590, objectFit: o.ajuste || 'cover' } } } : null;
  const play = h('div', { display: 'flex', position: 'absolute', top: 225, left: 470, width: 140, height: 140, borderRadius: 70, background: 'rgba(12,12,16,.78)', alignItems: 'center', justifyContent: 'center' },
    h('div', { display: 'flex', width: 0, height: 0, marginLeft: 14, borderTop: '34px solid transparent', borderBottom: '34px solid transparent', borderLeft: '56px solid #FFFFFF' }));

  const topo = foto
    ? h('div', { display: 'flex', flexDirection: 'column' },
        h('div', { display: 'flex', width: W, height: 14, background: cor }),
        h('div', { display: 'flex', position: 'relative', width: W, height: 590, background: '#16161D' }, img, o.play ? play : null))
    : h('div', { display: 'flex', width: W, height: 14, background: cor });

  const miolo = h('div', { display: 'flex', flexDirection: 'column', padding: foto ? '44px 64px 0' : '0 72px', flexGrow: 1, justifyContent: foto ? 'flex-start' : 'center' },
    h('div', { display: 'flex' },
      h('div', { display: 'flex', background: cor, color: '#fff', fontFamily: 'Figtree', fontWeight: 800, fontSize: 34, padding: '10px 28px', borderRadius: 40 }, o.rotulo || 'Geral')),
    h('div', { display: 'flex', marginTop: 28, color: '#FFFFFF', fontFamily: 'Bricolage', fontWeight: 800, fontSize: tamT, lineHeight: 1.08, letterSpacing: -1 }, titulo),
    corpo ? h('div', { display: 'flex', marginTop: 24, color: '#B5B5C2', fontFamily: 'Figtree', fontWeight: 500, fontSize: foto ? 34 : 40, lineHeight: 1.35 }, corpo) : null,
    o.fonte ? h('div', { display: 'flex', marginTop: 20, color: '#8A8A99', fontFamily: 'Figtree', fontWeight: 700, fontSize: 28 }, o.fonte) : null);

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

// notícia: n = { lado, manchete, resumo, veiculo }
function desenha(n, foto, host) {
  return desenhaCard({ cor: COR[n.lado], rotulo: ROT[n.lado] || 'Geral', titulo: n.manchete, corpo: n.resumo, fonte: 'Fonte: ' + (n.veiculo || '') }, foto, host);
}

const CAT = { debate: 'Debate', entrevista: 'Entrevista', proposta: 'Proposta', checagem: 'Checagem', analise: 'Análise' };
// vídeo: v = { lado, categoria, titulo, fonte, analise, momento }
function desenhaVideo(v, foto, host) {
  const lado = v.lado === '13' ? '13 · Lula' : v.lado === '22' ? '22 · Flávio' : null;
  return desenhaCard({ cor: COR[v.lado], rotulo: 'Vídeo · ' + (CAT[v.categoria] || 'Vídeo') + (lado ? ' · ' + lado : ''), titulo: v.titulo,
    corpo: v.analise || '', fonte: [v.fonte, v.momento ? 'ponto-chave em ' + v.momento : ''].filter(Boolean).join(' · '), play: true }, foto, host);
}
// livro: l = { titulo, autor, por_que }
function desenhaLivro(l, foto, host) {
  return desenhaCard({ cor: NEUTRAL, rotulo: 'Pra ler', titulo: l.titulo, corpo: l.por_que, fonte: l.autor, ajuste: 'contain' }, foto, host);
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
async function baixaFoto(url) {
  if (!/^https:\/\//.test(url || '')) return null;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'image/jpeg,image/png,image/*' }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const data = Buffer.from(await r.arrayBuffer());
    // descobre o tipo pelo começo do arquivo (tem site que informa errado); webp/avif o desenho não entende
    const tipo = data[0] === 0xFF && data[1] === 0xD8 ? 'image/jpeg' : data.slice(0, 4).toString('hex') === '89504e47' ? 'image/png' : null;
    return tipo && data.length < 8 * 1024 * 1024 ? { data, tipo } : null;
  } catch (e) { return null; }
}

// ---------- Instagram ----------
const jpegJs = require('jpeg-js');
// PNG -> JPG (o Instagram só aceita JPG). Passa o PNG pela resvg pra ter os pixels e codifica.
function paraJpg(png, W, H) {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' + W + '" height="' + H + '">' +
    '<rect width="' + W + '" height="' + H + '" fill="#0C0C10"/><image width="' + W + '" height="' + H + '" xlink:href="data:image/png;base64,' + png.toString('base64') + '"/></svg>';
  const r = new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render();
  return jpegJs.encode({ data: r.pixels, width: r.width, height: r.height }, 90).data;
}
async function svgParaPng(arvore, W, H) {
  const svg = await (await pegaSatori())(arvore, { width: W, height: H, fonts: fontes() });
  return new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng();
}
// Story 1080x1920: o card da notícia no meio, com chamada em cima e embaixo
async function desenhaStory(n, foto, host, topo) {
  const card = await desenha(n, foto, host);
  const W = 1080, H = 1920, cor = COR[n.lado] || NEUTRAL;
  const arvore = h('div', { display: 'flex', flexDirection: 'column', width: W, height: H, background: '#0C0C10', alignItems: 'center' },
    h('div', { display: 'flex', width: W, height: 12, background: cor }),
    h('div', { display: 'flex', marginTop: 110, height: 90, alignItems: 'center', fontFamily: 'Figtree', fontWeight: 800, fontSize: 40, color: '#F2F2F5', letterSpacing: 1 }, topo || 'NOVA NO 2º TURNO'),
    h('div', { display: 'flex', width: 984, height: 1230, borderRadius: 36, overflow: 'hidden', marginTop: 20 },
      { type: 'img', props: { src: 'data:image/png;base64,' + card.toString('base64'), width: 984, height: 1230, style: { width: 984, height: 1230 } } }),
    h('div', { display: 'flex', marginTop: 70, fontFamily: 'Figtree', fontWeight: 800, fontSize: 44, color: '#F2F2F5' }, 'Resumo completo no link da bio'),
    h('div', { display: 'flex', marginTop: 14, fontFamily: 'Figtree', fontWeight: 700, fontSize: 32, color: '#8A8A99' }, 'Notícias dos dois lados, sem torcida'));
  return paraJpg(await svgParaPng(arvore, W, H), W, H);
}
async function desenhaFeed(n, foto, host) { return paraJpg(await desenha(n, foto, host), 1080, 1350); }
// Capa do carrossel. turno = 'Manhã' | 'Tarde' | 'Noite', dia = '13/10'
// destaques = [{ lado, manchete }]: com eles, a capa já mostra uma manchete de cada lado (é o gancho)
async function desenhaCapa(turno, dia, total, faixa, video, destaques) {
  const W = 1080, H = 1350;
  const hora = { 'Manhã': '8h', 'Meio-dia': '12h', 'Tarde': '18h', 'Noite': '22h' }[turno] || turno;
  const faixaCor = h('div', { display: 'flex', width: W, height: 16 },
    h('div', { display: 'flex', width: W / 2, height: 16, background: RED }),
    h('div', { display: 'flex', width: W / 2, height: 16, background: BLUE }));
  const ds = (destaques || []).filter((d) => d && d.manchete).slice(0, 2);
  let meio;
  if (ds.length) {
    const bloco = (d, i) => h('div', { display: 'flex', flexDirection: 'column', marginTop: i ? 54 : 0, width: W - 168 },
      h('div', { display: 'flex' }, h('div', { display: 'flex', background: COR[d.lado] || NEUTRAL, color: '#fff', fontFamily: 'Figtree', fontWeight: 800, fontSize: 34, padding: '10px 28px', borderRadius: 40 }, ROT[d.lado] || 'Geral')),
      h('div', { display: 'flex', marginTop: 20, fontFamily: 'Bricolage', fontWeight: 800, fontSize: ds.length > 1 ? 68 : 84, lineHeight: 1.06, color: '#FFFFFF', letterSpacing: -1.5, width: W - 168 }, corta(d.manchete, ds.length > 1 ? 78 : 110)));
    const resto = total - ds.length;
    meio = h('div', { display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'center', width: W - 168 },
      h('div', { display: 'flex', fontFamily: 'Figtree', fontWeight: 800, fontSize: 32, color: '#8A8A99', letterSpacing: 2 }, '2º TURNO · ' + dia + ' · ' + hora),
      h('div', { display: 'flex', flexDirection: 'column', marginTop: 40 }, ...ds.map(bloco)),
      resto > 0 ? h('div', { display: 'flex', marginTop: 56, fontFamily: 'Figtree', fontWeight: 700, fontSize: 42, color: '#B5B5C2' }, '+ ' + resto + (resto > 1 ? ' notícias' : ' notícia') + ' dos dois lados' + (video ? '' : '  ›››')) : null);
  } else {
    meio = h('div', { display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'center', width: W - 168 },
      h('div', { display: 'flex', fontFamily: 'Figtree', fontWeight: 800, fontSize: 36, color: '#8A8A99', letterSpacing: 2 }, '2º TURNO'),
      h('div', { display: 'flex', marginTop: 16, fontFamily: 'Bricolage', fontWeight: 800, fontSize: 120, lineHeight: 1, color: '#FFFFFF', letterSpacing: -3 }, 'Resumo de notícias'),
      h('div', { display: 'flex', marginTop: 26, fontFamily: 'Bricolage', fontWeight: 800, fontSize: 64, color: '#FFFFFF' }, 'Dia ' + dia + ' · ' + hora),
      h('div', { display: 'flex', marginTop: 34, fontFamily: 'Figtree', fontWeight: 500, fontSize: 44, lineHeight: 1.3, color: '#B5B5C2' }, total + ' notícias, dos dois lados.'));
  }
  const arvore = h('div', { display: 'flex', flexDirection: 'column', width: W, height: H, background: '#0C0C10' },
    h('div', { display: 'flex', flexDirection: 'column', width: W, flexGrow: 1, padding: '80px 84px 60px' },
      { type: 'img', props: { src: logo(), width: 300, height: 110, style: { width: 300, height: 110 } } },
      meio),
    faixaCor);
  return paraJpg(await svgParaPng(arvore, W, H), W, H);
}

// Último slide do carrossel: um pedido só, mandar pra alguém
async function desenhaFim() {
  const W = 1080, H = 1350;
  const arvore = h('div', { display: 'flex', flexDirection: 'column', width: W, height: H, background: '#0C0C10' },
    h('div', { display: 'flex', width: W, height: 16 },
      h('div', { display: 'flex', width: W / 2, height: 16, background: RED }),
      h('div', { display: 'flex', width: W / 2, height: 16, background: BLUE })),
    h('div', { display: 'flex', flexDirection: 'column', width: W, flexGrow: 1, padding: '110px 84px 70px' },
      h('div', { display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'center', width: W - 168 },
        h('div', { display: 'flex', fontFamily: 'Bricolage', fontWeight: 800, fontSize: 104, lineHeight: 1.02, color: '#FFFFFF', letterSpacing: -3 }, 'Conhece alguém que só vê um lado?'),
        h('div', { display: 'flex', marginTop: 34, fontFamily: 'Figtree', fontWeight: 500, fontSize: 48, lineHeight: 1.3, color: '#B5B5C2' }, 'Manda esse post pra essa pessoa. Ela lê os dois lados e decide sozinha.'),
        h('div', { display: 'flex', marginTop: 56 },
          h('div', { display: 'flex', background: '#FFFFFF', color: '#0C0C10', fontFamily: 'Figtree', fontWeight: 800, fontSize: 42, padding: '22px 44px', borderRadius: 60 }, 'Manda pra essa pessoa  ›'))),
      h('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', width: W - 168 },
        { type: 'img', props: { src: logo(), width: 300, height: 110, style: { width: 300, height: 110 } } },
        h('div', { display: 'flex', fontFamily: 'Figtree', fontWeight: 700, fontSize: 34, color: '#8A8A99' }, '@central2turno'))));
  return paraJpg(await svgParaPng(arvore, W, H), W, H);
}

// Põe uma arte 1080x1350 (capa, slide final) no formato do Reels (1080x1920), com faixa em cima e embaixo
async function vertical(jpg, topo, baixo) {
  const W = 1080, H = 1920;
  const arvore = h('div', { display: 'flex', flexDirection: 'column', width: W, height: H, background: '#0C0C10', alignItems: 'center' },
    h('div', { display: 'flex', width: W, height: 12 }, h('div', { display: 'flex', width: W / 2, height: 12, background: RED }), h('div', { display: 'flex', width: W / 2, height: 12, background: BLUE })),
    h('div', { display: 'flex', height: 273, alignItems: 'center', fontFamily: 'Figtree', fontWeight: 800, fontSize: 44, color: '#F2F2F5', letterSpacing: 1 }, topo || ''),
    { type: 'img', props: { src: 'data:image/jpeg;base64,' + Buffer.from(jpg).toString('base64'), width: W, height: 1350, style: { width: W, height: 1350 } } },
    h('div', { display: 'flex', height: 273, alignItems: 'center', fontFamily: 'Figtree', fontWeight: 800, fontSize: 40, color: '#B5B5C2' }, baixo || ''));
  return paraJpg(await svgParaPng(arvore, W, H), W, H);
}

module.exports = { h, svgParaPngPub: (a, W, H) => svgParaPng(a, W, H), paraJpgPub: (p, W, H) => paraJpg(p, W, H), logoPub: () => logo(), vertical, desenhaFim, desenhaStory, desenhaFeed, desenhaCapa, desenha, desenhaVideo, desenhaLivro, baixaFoto, ROT, CAT };
