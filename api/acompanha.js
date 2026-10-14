// Acompanha: /acompanha (lista dos 21) e /p/slug (perfil com as promessas aprovadas). Montado no servidor.
const P = require('../lib/pagina.js');
const SITE = 'https://central-2turno.vercel.app';
const CANAL = 'https://whatsapp.com/channel/0029VbE4MzWGE56inhQOZq0u';
const CAMPO = { '13': 'Campo do 13', '22': 'Campo do 22', neutro: 'Neutro' };
const COR = { '13': 'var(--red)', '22': 'var(--blue)', neutro: 'var(--neutral)' };
const e = P.attr;
const fmt = (n) => n == null ? '' : Number(n).toLocaleString('pt-BR');
const iniciais = (n) => n.replace(/^(Professora|Delegado|Sargento|Dra?\.)\s+/i, '').split(/\s+/).map((x) => x[0]).slice(0, 2).join('').toUpperCase();
const dataBr = (d) => d ? d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) : '';

const CSS = "\n:root{--bg:#0C0C10;--card:#16161D;--card2:#1E1E27;--line:#22222A;--line2:#33333D;--ink:#F2F2F5;--soft:#B5B5C2;--mute:#8A8A99;--red:#E5243B;--blue:#2B6CEB;--green:#1FA855;--neutral:#4A4A57}\n*{box-sizing:border-box}\nhtml{-webkit-text-size-adjust:100%}\nbody{margin:0;background:var(--bg);color:var(--ink);font-family:'Figtree',system-ui,sans-serif;line-height:1.5}\na{color:inherit}\n.wrap{max-width:760px;margin:0 auto;padding:0 16px 120px}\n.display{font-family:'Bricolage Grotesque','Figtree',sans-serif;font-weight:800;letter-spacing:-.02em}\nheader{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid var(--line);margin-bottom:18px}\nheader img{height:34px;width:auto;display:block}\n.zap{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 18px;border-radius:12px;background:var(--green);color:#06140b;font-weight:800;text-decoration:none}\nh1{font-size:36px;line-height:1.05;margin:10px 0 10px}\n.lead{font-size:18px;color:var(--soft);margin:0 0 20px}\n.resumo{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:26px}\n.resumo div{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px}\n.resumo b{display:block;font-size:13px;color:var(--mute);font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px}\n.resumo span{font-size:18px;font-weight:800}\n.faq{display:flex;flex-direction:column;gap:12px}\n.faq section{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:18px}\n.faq h2{font-size:21px;margin:0 0 8px;line-height:1.2}\n.faq p,.faq li{color:var(--soft);font-size:16px;margin:0 0 8px}\n.faq ul{margin:0;padding-left:20px}\n.faq strong{color:var(--ink)}\n.cta{margin:26px 0;background:linear-gradient(90deg,rgba(229,36,59,.18),rgba(43,108,235,.18));border:1px solid var(--line2);border-radius:20px;padding:20px;display:flex;flex-direction:column;gap:12px}\n.cta h2{margin:0;font-size:22px}\n.cta p{margin:0;color:var(--soft)}\n.links{display:flex;flex-wrap:wrap;gap:8px}\n.links a{display:inline-flex;align-items:center;min-height:44px;padding:0 16px;border-radius:12px;border:1px solid var(--line2);font-weight:700;text-decoration:none;background:var(--card2)}\n.fontes{font-size:13px;color:var(--mute);margin-top:30px}\n.fontes a{color:var(--soft)}\n.dock{position:fixed;left:0;right:0;bottom:0;padding:12px 16px calc(12px + env(safe-area-inset-bottom));background:linear-gradient(transparent,var(--bg) 35%);display:flex;justify-content:center}\n.dock .zap{width:100%;max-width:728px;min-height:52px;font-size:17px}\n@media (min-width:760px){h1{font-size:52px}.resumo{grid-template-columns:repeat(4,1fr)}}\n" + `
.grade{display:grid;grid-template-columns:minmax(0,1fr);gap:10px}
.pol{display:flex;gap:14px;align-items:center;background:var(--card);border:1px solid var(--line);border-left:4px solid var(--c);border-radius:16px;padding:14px;text-decoration:none}
.av{flex:none;width:52px;height:52px;border-radius:26px;background:var(--c);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px;color:#fff}
.pol b{display:block;font-size:17px}.pol small{color:var(--mute);font-size:14px}
.pol .n{margin-left:auto;text-align:right;color:var(--soft);font-size:13px;white-space:nowrap}
h2.sec{font-size:22px;margin:26px 0 10px;display:flex;align-items:center;gap:10px}
h2.sec i{width:12px;height:12px;border-radius:6px;background:var(--c);display:inline-block}
.regra{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 14px;color:var(--soft);font-size:15px;margin-bottom:8px}
.topo{display:flex;gap:16px;align-items:center;margin:8px 0 16px}.topo .av{width:72px;height:72px;border-radius:36px;font-size:26px}
.ficha{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:22px}
.ficha div{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px}
.ficha b{display:block;font-size:12px;color:var(--mute);text-transform:uppercase;letter-spacing:.04em}.ficha span{font-weight:800;font-size:17px}
.prom{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px;margin-bottom:10px}
.prom p{margin:0 0 8px;font-size:17px;font-weight:700}.prom blockquote{margin:0 0 8px;padding-left:12px;border-left:3px solid var(--line2);color:var(--soft);font-size:15px}
.prom small{color:var(--mute);font-size:13px}.prom small a{color:var(--soft)}
.vazio{color:var(--soft);background:var(--card);border:1px dashed var(--line2);border-radius:16px;padding:18px}
@media (min-width:760px){.grade{grid-template-columns:1fr 1fr}.ficha{grid-template-columns:repeat(4,1fr)}}`;

function pagina({ titulo, desc, canon, corpo, indexa, ld }) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${e(titulo)}</title><meta name="description" content="${e(desc)}">${indexa ? '' : '<meta name="robots" content="noindex">'}${ld ? P.jsonLd(ld) : ''}
<link rel="canonical" href="${e(canon)}"><meta name="theme-color" content="#0C0C10">
<link rel="icon" type="image/png" href="/favicon.png"><meta property="og:title" content="${e(titulo)}"><meta property="og:description" content="${e(desc)}">
<meta property="og:image" content="${SITE}/og.png"><meta name="twitter:card" content="summary_large_image">
<script defer src="/_vercel/insights/script.js"></script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,800&family=Figtree:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>${CSS}</style></head><body><div class="wrap">
<header><a href="/" aria-label="Central 2º Turno, página inicial"><img src="/logo.png" alt="Central 2º Turno" width="720" height="264"></a>
<a href="/acompanha" style="font-size:14px;font-weight:700;color:var(--soft);text-decoration:none">Os 21 ›</a></header>
${corpo}
<p class="fontes">Central 2º Turno, por Mounólogo. Sem vínculo com partido ou candidato. Viu algo errado? Avisa a gente pelo canal.</p></div>
<div class="dock"><a class="zap" href="${CANAL}" target="_blank" rel="noopener">Seguir no WhatsApp</a></div></body></html>`;
}
function item(p) {
  return `<a class="pol" style="--c:${COR[p.campo]}" href="/deputado/${e(p.slug)}"><span class="av">${e(iniciais(p.nome))}</span>
<span><b>${e(p.nome)}</b><small>${e(p.partido)}-${e(p.uf)}</small></span><span class="n">${fmt(p.votos)} votos<br>${p.n || 0} promessa${p.n === 1 ? '' : 's'}</span></a>`;
}

module.exports = async (req, res) => {
  const slug = String(req.query.slug || '').replace(/[^a-z0-9-]/g, '');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  try {
    if (!slug) {
      const [pols, proms] = await Promise.all([P.supabase('politicos?select=id,slug,nome,partido,uf,campo,votos,ordem&order=ordem.asc'), P.supabase('promessas?select=politico_id')]);
      const n = {}; proms.forEach((x) => { n[x.politico_id] = (n[x.politico_id] || 0) + 1; });
      pols.forEach((p) => { p.n = n[p.id] || 0; });
      const bloco = (c) => `<h2 class="sec display" style="--c:${COR[c]}"><i></i>${CAMPO[c]}</h2><div class="grade">${pols.filter((p) => p.campo === c).map(item).join('')}</div>`;
      const corpo = `<h1 class="display">Acompanha: os 21 mais votados</h1>
<p class="lead">O que cada deputado prometeu na campanha. Depois da posse, em fevereiro, entra o que ele fez: votos, gastos e presença.</p>
<p class="regra"><b>Como escolhemos:</b> os 10 deputados federais mais votados de cada campo, contando como campo o partido que apoiou formalmente o 13 ou o 22 no 2º turno. E o mais votado dos partidos que ficaram neutros. Ninguém foi escolhido a dedo.</p>
${bloco('13')}${bloco('22')}${bloco('neutro')}`;
      res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
      return res.status(200).send(pagina({ titulo: 'Acompanha: o que os 21 deputados mais votados prometeram · Central 2º Turno', desc: 'As promessas de campanha dos deputados federais mais votados de 2026, dos dois lados, com fonte.', canon: SITE + '/acompanha', corpo }));
    }
    const p = (await P.supabase('politicos?select=id,slug,nome,partido,uf,cargo,campo,votos,votos_fonte&slug=eq.' + slug))[0];
    if (!p) { res.setHeader('Cache-Control', 'no-store'); return res.status(404).send(pagina({ titulo: 'Não achei · Central 2º Turno', desc: '', canon: SITE + '/acompanha', corpo: '<h1 class="display">Não achei esse nome.</h1><p class="lead"><a href="/acompanha">Ver os 21</a></p>' })); }
    const [proms, nots] = await Promise.all([
      P.supabase('promessas?select=texto,citacao,como_conferir,fonte_url,fonte_nome,data&politico_id=eq.' + p.id + '&order=data.desc.nullslast'),
      P.supabase('politico_noticias?select=titulo,link,fonte,data&politico_id=eq.' + p.id + '&order=data.desc.nullslast&limit=12').catch(() => [])]);
    const listaNots = nots.length ? nots.map((n) => `<a class="pol" style="--c:var(--line2);display:block" href="${e(n.link)}" target="_blank" rel="noopener nofollow"><b style="font-size:16px">${e(n.titulo)}</b><small>${e(n.fonte || '')}${n.data ? ' · ' + dataBr(n.data.slice(0, 10)) : ''}</small></a>`).join('')
      : '<p class="vazio">Sem notícias recentes ainda.</p>';
    const lista = proms.length ? proms.map((x) => `<div class="prom"><p>${e(x.texto)}</p>${x.citacao ? '<blockquote>' + e(x.citacao) + '</blockquote>' : ''}${x.como_conferir ? '<small style="display:block;margin-bottom:6px"><b>Como conferir:</b> ' + e(x.como_conferir) + '</small>' : ''}
<small>${x.data ? dataBr(x.data) + ' · ' : ''}${x.fonte_url ? '<a href="' + e(x.fonte_url) + '" target="_blank" rel="noopener">' + e(x.fonte_nome || 'Fonte') + '</a>' : e(x.fonte_nome || '')}</small></div>`).join('')
      : '<p class="vazio">Ainda não registramos nenhuma promessa. A gente busca todo dia e só publica o que tem fonte.</p>';
    const corpo = `<div class="topo" style="--c:${COR[p.campo]}"><span class="av">${e(iniciais(p.nome))}</span><div><h1 class="display" style="margin:0;font-size:34px">${e(p.nome)}</h1>
<p class="lead" style="margin:4px 0 0">${e(p.cargo)} eleito · ${e(p.partido)}-${e(p.uf)}</p></div></div>
<div class="ficha"><div><b>Votos</b><span>${fmt(p.votos)}</span></div><div><b>Partido</b><span>${e(p.partido)}</span></div><div><b>Estado</b><span>${e(p.uf)}</span></div><div><b>Campo</b><span>${CAMPO[p.campo]}</span></div></div>
<h2 class="display" style="font-size:24px;margin:0 0 12px">O que prometeu</h2>${lista}
<h2 class="display" style="font-size:24px;margin:26px 0 12px">Saiu na imprensa</h2><div class="grade">${listaNots}</div>
<div class="cta"><h2 class="display">E o mandato?</h2><p>A posse é em 1º de fevereiro de 2027. A partir daí entram aqui os votos, os gastos da cota e a presença, direto dos dados da Câmara.</p></div>
<p class="fontes">Votos: ${e(p.votos_fonte || '')}. Campo: partido que apoiou formalmente o 13 ou o 22 no 2º turno.</p>`;
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    const canon = SITE + '/deputado/' + p.slug;
    const ld = { '@context': 'https://schema.org', '@type': 'ProfilePage', url: canon, mainEntity: { '@type': 'Person', name: p.nome, jobTitle: 'Deputado federal eleito', affiliation: { '@type': 'Organization', name: p.partido }, address: { '@type': 'PostalAddress', addressRegion: p.uf, addressCountry: 'BR' } } };
    return res.status(200).send(pagina({ titulo: p.nome + ' (' + p.partido + '-' + p.uf + '): promessas, notícias e mandato · Central 2º Turno',
      desc: 'O que ' + p.nome + ', deputado federal eleito pelo ' + p.partido + '-' + p.uf + ', prometeu na campanha, o que saiu na imprensa e, a partir de 2027, como vota e quanto gasta.', canon, corpo, indexa: proms.length > 0, ld }));
  } catch (err) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).send('Erro: ' + e(String(err.message || err)));
  }
};
