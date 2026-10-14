// Reels de serviço do dia 25 (um por dia, até a eleição). Conteúdo conferido com o TSE (mesmo da página /dia-25).
const { h, svgParaPngPub, paraJpgPub, logoPub } = require('./card.js');

const TEMAS = {
  'pra-que':   { gancho: 'Dia 25 você vota pra quê?', slides: [
    ['Presidente', 'Lula (13) ou Flávio (22). Em quase todo o país, é só isso.'],
    ['+ Governador em 7 lugares', 'AC, AM, DF, ES, RJ, RN e TO também escolhem governador.'],
    ['Leva a colinha', 'Anota os números antes. O TSE recomenda.']] },
  'nao-votou': { gancho: 'Não votou no 1º turno? Pode votar no 2º.', slides: [
    ['Cada turno é separado', 'Faltar no 1º não te impede de votar no dia 25.'],
    ['Mas a falta continua', 'O 1º turno ainda precisa de justificativa ou multa.'],
    ['Justifica no e-Título', 'Dá pra fazer pelo app, sem sair de casa.']] },
  'onde':      { gancho: 'Onde eu voto no dia 25?', slides: [
    ['No mesmo lugar do 1º turno', 'Seção e local não mudam entre os turnos.'],
    ['Esqueceu?', 'Abre o app e-Título ou o Autoatendimento Eleitoral do TSE.'],
    ['Vai com antecedência', 'A votação vai das 8h às 17h, horário de Brasília.']] },
  'fora':      { gancho: 'Vai estar fora no dia 25?', slides: [
    ['No dia', 'Justifica pelo e-Título ou numa mesa de justificativa, das 8h às 17h.'],
    ['Depois', 'Até 8 de janeiro de 2027, pelo e-Título, Autoatendimento ou cartório.'],
    ['Faltou nos dois turnos?', 'Justifica cada um separado.']] },
  'titulo':    { gancho: 'Esqueceu o título? Não precisa dele.', slides: [
    ['Leva documento com foto', 'RG, CNH, passaporte, carteira de trabalho, reservista ou identidade social.'],
    ['e-Título vale sozinho', 'Só se aparecer a sua foto nele.'],
    ['Título de papel', 'Não é obrigatório.']] },
  'preso':     { gancho: 'Eleitor pode ser preso perto da eleição?', slides: [
    ['De 20 a 27 de outubro', 'Cinco dias antes até 48 horas depois da votação.'],
    ['Só em 3 casos', 'Flagrante, sentença por crime inafiançável ou desrespeito a salvo-conduto.'],
    ['Regra do Código Eleitoral', 'Vale pra todo eleitor.']] },
  'horario':   { gancho: 'Que horas abre e fecha a votação?', slides: [
    ['8h às 17h de Brasília', 'Quem estiver na fila às 17h ainda vota.'],
    ['Acre e oeste do AM', '6h às 15h no horário local.'],
    ['AM, RR, RO, MT e MS', '7h às 16h no horário local. Noronha: 9h às 18h.']] },
  'celular':   { gancho: 'Celular na cabine dá problema.', slides: [
    ['Celular fica com a mesa', 'Câmera e qualquer aparelho que grave também.'],
    ['Colinha de papel pode', 'E o próprio TSE recomenda levar.'],
    ['Anota antes de sair', 'Presidente e, onde tiver, governador.']] },
  'resultado': { gancho: 'Que horas sai o resultado?', slides: [
    ['A apuração começa às 17h', 'Logo depois que a votação acaba.'],
    ['Os números saem ao longo da noite', 'Direto do TSE.'],
    ['Acompanha ao vivo', 'Na Central: link na bio, página Apuração.']] }
};
// qual tema sai em cada dia (horário de Brasília)
const AGENDA = { '14-10': 'pra-que', '15-10': 'nao-votou', '16-10': 'onde', '17-10': 'fora', '18-10': 'titulo', '19-10': 'pra-que',
  '20-10': 'preso', '21-10': 'horario', '22-10': 'celular', '23-10': 'titulo', '24-10': 'horario', '25-10': 'resultado' };

const W = 1080, H = 1920, RED = '#E5243B', BLUE = '#2B6CEB';
const faixa = () => h('div', { display: 'flex', width: W, height: 14 }, h('div', { display: 'flex', width: W / 2, height: 14, background: RED }), h('div', { display: 'flex', width: W / 2, height: 14, background: BLUE }));
const marca = () => ({ type: 'img', props: { src: logoPub(), width: 300, height: 110, style: { width: 300, height: 110 } } });
async function quadro(filhos) {
  const arvore = h('div', { display: 'flex', flexDirection: 'column', width: W, height: H, background: '#0C0C10' }, faixa(),
    h('div', { display: 'flex', flexDirection: 'column', flexGrow: 1, width: W, padding: '110px 90px 110px' }, marca(), ...filhos));
  return Buffer.from(paraJpgPub(await svgParaPngPub(arvore, W, H), W, H));
}
async function quadros(chave) {
  const t = TEMAS[chave];
  const out = [];
  out.push({ dur: 3, jpg: await quadro([h('div', { display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'center', width: W - 180 },
    h('div', { display: 'flex', fontFamily: 'Figtree', fontWeight: 800, fontSize: 40, color: '#8A8A99', letterSpacing: 2 }, 'DIA 25 · 2º TURNO'),
    h('div', { display: 'flex', marginTop: 24, fontFamily: 'Bricolage', fontWeight: 800, fontSize: 124, lineHeight: 1.02, color: '#FFFFFF', letterSpacing: -3 }, t.gancho))]) });
  for (let i = 0; i < t.slides.length; i++) {
    const [tit, txt] = t.slides[i];
    out.push({ dur: 4.5, jpg: await quadro([h('div', { display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'center', width: W - 180 },
      h('div', { display: 'flex', width: 150, height: 110, borderRadius: 55, background: i % 2 ? BLUE : RED, alignItems: 'center', justifyContent: 'center', fontFamily: 'Bricolage', fontWeight: 800, fontSize: 60, color: '#fff' }, (i + 1) + '/' + t.slides.length),
      h('div', { display: 'flex', marginTop: 40, fontFamily: 'Bricolage', fontWeight: 800, fontSize: 96, lineHeight: 1.05, color: '#FFFFFF', letterSpacing: -2 }, tit),
      h('div', { display: 'flex', marginTop: 30, fontFamily: 'Figtree', fontWeight: 500, fontSize: 54, lineHeight: 1.3, color: '#B5B5C2' }, txt)),
      h('div', { display: 'flex', fontFamily: 'Figtree', fontWeight: 700, fontSize: 32, color: '#8A8A99' }, 'Fonte: TSE')]) });
  }
  out.push({ dur: 4, jpg: await quadro([h('div', { display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'center', width: W - 180 },
    h('div', { display: 'flex', fontFamily: 'Bricolage', fontWeight: 800, fontSize: 110, lineHeight: 1.02, color: '#FFFFFF', letterSpacing: -3 }, 'Manda no grupo da família.'),
    h('div', { display: 'flex', marginTop: 34, fontFamily: 'Figtree', fontWeight: 500, fontSize: 54, lineHeight: 1.3, color: '#B5B5C2' }, 'Alguém aí vai precisar disso no dia 25.'),
    h('div', { display: 'flex', marginTop: 60, fontFamily: 'Figtree', fontWeight: 800, fontSize: 50, color: '#1FA855' }, 'Siga @central2turno'))]) });
  return out;
}
function legenda(chave) {
  const t = TEMAS[chave];
  return t.gancho + '\n\n' + t.slides.map(([a, b]) => '✅ ' + a + ': ' + b).join('\n') +
    '\n\nFonte: TSE. Tudo sobre o dia 25 no link da bio.\n📲 Manda no grupo da família. Alguém vai precisar.\n\n#segundoturno #eleicoes2026 #dia25 #tse #eleicao';
}
module.exports = { TEMAS, AGENDA, quadros, legenda };
