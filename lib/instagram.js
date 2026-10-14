// Publica no Instagram (@central2turno) pela API oficial da Meta (Instagram API com login do Instagram).
// Variáveis na Vercel: IG_TOKEN (token de longa duração). IG_USER_ID é opcional (descobre sozinho).
const API = 'https://graph.instagram.com/v22.0';
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function chama(metodo, caminho, params) {
  const url = new URL(API + caminho);
  const corpo = new URLSearchParams({ ...params, access_token: process.env.IG_TOKEN });
  const r = metodo === 'GET'
    ? await fetch(url + '?' + corpo, { signal: AbortSignal.timeout(15000) })
    : await fetch(url, { method: 'POST', body: corpo, signal: AbortSignal.timeout(20000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error('Instagram ' + r.status + ': ' + ((j.error && j.error.message) || JSON.stringify(j)).slice(0, 200));
  return j;
}
let ID = null;
async function contaId() {
  if (process.env.IG_USER_ID) return process.env.IG_USER_ID;
  if (!ID) ID = (await chama('GET', '/me', { fields: 'user_id,username' })).user_id;
  return ID;
}
// espera o Instagram baixar a imagem (até ~40 s)
async function pronto(container) {
  for (let i = 0; i < 20; i++) {
    const s = await chama('GET', '/' + container, { fields: 'status_code' });
    if (s.status_code === 'FINISHED') return;
    if (s.status_code === 'ERROR' || s.status_code === 'EXPIRED') throw new Error('Instagram não aceitou a imagem (' + s.status_code + ')');
    await espera(2000);
  }
  throw new Error('Instagram demorou demais pra processar');
}
async function publica(container) {
  await pronto(container);
  return (await chama('POST', '/' + (await contaId()) + '/media_publish', { creation_id: container })).id;
}
// Antes de mandar pro Instagram, a gente mesmo baixa cada imagem: confere que é JPG de verdade
// e já deixa ela pronta no cache da Vercel (o Instagram pega rápido, sem esperar desenhar)
async function confere(url) {
  for (let i = 0; i < 2; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(40000) });
      const tipo = r.headers.get('content-type') || '';
      if (r.ok && tipo.startsWith('image/')) { await r.arrayBuffer(); return true; }
    } catch (e) { /* tenta de novo */ }
  }
  return false;
}

async function story(imagem) {
  if (!(await confere(imagem))) throw new Error('imagem do story não ficou pronta: ' + imagem);
  const c = await chama('POST', '/' + (await contaId()) + '/media', { image_url: imagem, media_type: 'STORIES' });
  return publica(c.id);
}
async function carrossel(imagens, legenda) {
  const ok = [];
  for (let i = 0; i < imagens.length; i += 3) {
    const lote = imagens.slice(i, i + 3);
    const res = await Promise.all(lote.map(confere));
    lote.forEach((u, j) => { if (res[j]) ok.push(u); });
  }
  if (ok[0] !== imagens[0]) throw new Error('a capa não ficou pronta');
  if (ok.length < 3) throw new Error('poucas imagens prontas (' + ok.length + ')');
  imagens = ok;
  const id = await contaId();
  const filhos = [];
  for (const img of imagens) filhos.push((await chama('POST', '/' + id + '/media', { image_url: img, is_carousel_item: 'true' })).id);
  for (const f of filhos) await pronto(f);
  const c = await chama('POST', '/' + id + '/media', { media_type: 'CAROUSEL', children: filhos.join(','), caption: legenda });
  return publica(c.id);
}
module.exports = { story, carrossel, ligado: () => !!process.env.IG_TOKEN };
