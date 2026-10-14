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
async function story(imagem) {
  const c = await chama('POST', '/' + (await contaId()) + '/media', { image_url: imagem, media_type: 'STORIES' });
  return publica(c.id);
}
async function carrossel(imagens, legenda) {
  const id = await contaId();
  const filhos = [];
  for (const img of imagens) filhos.push((await chama('POST', '/' + id + '/media', { image_url: img, is_carousel_item: 'true' })).id);
  for (const f of filhos) await pronto(f);
  const c = await chama('POST', '/' + id + '/media', { media_type: 'CAROUSEL', children: filhos.join(','), caption: legenda });
  return publica(c.id);
}
module.exports = { story, carrossel, ligado: () => !!process.env.IG_TOKEN };
