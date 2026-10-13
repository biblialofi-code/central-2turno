// Vídeo ou livro novo: manda pro seu Telegram a imagem da Central + o texto do post pro canal.
// Quem chama é o Supabase (gatilho no 08-avisos.sql), com { tipo: 'video'|'livro', id } e o header x-segredo.
const { desenhaVideo, desenhaLivro, baixaFoto, CAT } = require('../lib/card.js');
const { mandarPost } = require('../lib/telegram.js');

const SB = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_KEY;
async function linha(tabela, id) {
  const r = await fetch(SB + '/rest/v1/' + tabela + '?select=*&id=eq.' + id, { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error('Supabase ' + r.status);
  return (await r.json())[0] || null;
}
function ytId(link) { const m = String(link || '').match(/(?:youtu\.be\/|[?&]v=|embed\/|shorts\/|live\/)([\w-]{11})/); return m ? m[1] : ''; }
function segundos(t) { return String(t || '').split(':').map(Number).reduce((a, b) => a * 60 + b, 0); }
async function capaYoutube(id) {
  for (const q of ['maxresdefault', 'sddefault', 'hqdefault']) {
    const f = await baixaFoto('https://i.ytimg.com/vi/' + id + '/' + q + '.jpg');
    if (f && f.data.length > 2000) return f;   // o YouTube devolve uma imagem cinza pequena quando não existe
  }
  return null;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (!SB || !KEY) return res.status(500).json({ erro: 'falta SUPABASE_URL ou SUPABASE_SERVICE_KEY' });
    if (!process.env.FOTO_SEGREDO || req.headers['x-segredo'] !== process.env.FOTO_SEGREDO) return res.status(401).json({ erro: 'segredo errado' });
    let corpo = req.body || {};
    if (typeof corpo === 'string') { try { corpo = JSON.parse(corpo); } catch (e) { corpo = {}; } }
    const id = parseInt(corpo.id, 10), tipo = corpo.tipo;
    if (!id || !['video', 'livro'].includes(tipo)) return res.status(400).json({ erro: 'tipo/id' });
    const host = (process.env.SITE_URL || 'https://central-2turno.vercel.app').replace(/^https?:\/\//, '').replace(/\/$/, '');

    if (tipo === 'video') {
      const v = await linha('videos', id);
      if (!v || !v.ativo) return res.status(200).json({ ok: 'escondido, não avisei' });
      const yid = ytId(v.link);
      const png = await desenhaVideo(v, yid ? await capaYoutube(yid) : null, host);
      const link = yid ? 'https://youtu.be/' + yid + (v.momento ? '?t=' + segundos(v.momento) : '') : v.link;
      const texto = '*' + v.titulo + '*\n' + (v.analise ? v.analise + '\n' : '') + '\n' +
        [CAT[v.categoria] || 'Vídeo', v.fonte, v.momento ? 'ponto-chave em ' + v.momento : ''].filter(Boolean).join(' · ') + '\n' + link;
      return res.status(200).json({ telegram: await mandarPost(png, 'Vídeo #' + id + ' pro canal. O texto vem embaixo: toca nele pra copiar.', texto, 'video-' + id + '.png') });
    }

    const l = await linha('livros', id);
    if (!l || !l.ativo) return res.status(200).json({ ok: 'escondido, não avisei' });
    const png = await desenhaLivro(l, await baixaFoto(l.capa_url), host);
    const texto = '*' + l.titulo + '*, de ' + l.autor + '\n' + (l.por_que || '') + '\n\n' +
      'Ver o livro: ' + l.link + (l.afiliado ? '\n(link de afiliado)' : '');
    return res.status(200).json({ telegram: await mandarPost(png, 'Livro #' + id + ' pro canal. O texto vem embaixo: toca nele pra copiar.', texto, 'livro-' + id + '.png') });
  } catch (e) {
    return res.status(500).json({ erro: String(e.message || e) });
  }
};
