// Manda pro seu Telegram: a imagem e, embaixo, o texto do post (toque copia).
function escHtml(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
async function mandarPost(png, legenda, texto, nomeArquivo) {
  const tok = process.env.TELEGRAM_TOKEN, chat = process.env.TELEGRAM_CHAT;
  if (!tok || !chat) return 'telegram não configurado';
  const fd = new FormData();
  fd.append('chat_id', chat);
  fd.append('caption', legenda);
  fd.append('photo', new Blob([png], { type: 'image/png' }), nomeArquivo || 'central.png');
  const r1 = await fetch('https://api.telegram.org/bot' + tok + '/sendPhoto', { method: 'POST', body: fd, signal: AbortSignal.timeout(20000) });
  if (!r1.ok) throw new Error('Telegram foto ' + r1.status + ': ' + (await r1.text()).slice(0, 150));
  const r2 = await fetch('https://api.telegram.org/bot' + tok + '/sendMessage', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10000),
    body: JSON.stringify({ chat_id: chat, text: '<pre>' + escHtml(texto) + '</pre>', parse_mode: 'HTML', disable_web_page_preview: true })
  });
  if (!r2.ok) throw new Error('Telegram texto ' + r2.status);
  return 'enviada';
}
module.exports = { mandarPost };
