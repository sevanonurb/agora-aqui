// node teste.mjs — cenários de uso; cada um diz o que DEVE aparecer e o que NÃO deve
import { relevantes, noPico, avaliar, peso } from './kernel.js';
import { carregarSkills } from './skills.js';
import fs from 'fs';
const base = await carregarSkills(p => JSON.parse(fs.readFileSync(p)));
const L = base.lugares; let falhas = 0;
function caso(nome, s, espera, naoEspera = []) {
  const ids = relevantes(base, s, {}).map(x => x.k.id);
  const ok = espera.every(i => ids.includes(i)) && naoEspera.every(i => !ids.includes(i));
  if (!ok) falhas++;
  console.log(`${ok ? 'OK  ' : 'FALHA'} ${nome} → [${ids.join(', ')}]`);
}
const d = s => new Date(s);
caso('Zuid, qui 11:10, Dal Vrij', { lugar: L['ams-zuid'], agora: d('2026-03-12T11:10:00'), perfil: ['dalvrij'] }, ['zuid-baldeacao']);
caso('RAI, qui 15:54 (6 min do pico)', { lugar: L['ams-rai'], agora: d('2026-03-12T15:54:00'), perfil: ['dalvrij'] }, ['dal-vrij-pico'], ['zuid-baldeacao']);
caso('Zuid depois de 01/11 (regra vencida)', { lugar: L['ams-zuid'], agora: d('2026-11-02T11:00:00'), perfil: [] }, [], ['zuid-baldeacao']);
caso('sem GPS, sábado', { lugar: null, agora: d('2026-03-14T14:00:00'), perfil: ['dalvrij'] }, ['dal-vrij-livre'], ['check-out', 'zuid-baldeacao']);
caso('pico (qua 17:00): não diz que é grátis', { lugar: L['duivendrecht'], agora: d('2026-03-11T17:00:00'), perfil: ['dalvrij'] }, [], ['dal-vrij-livre']);
caso('sem Dal Vrij: nenhum cartão de passe', { lugar: L['ams-rai'], agora: d('2026-03-12T15:54:00'), perfil: [] }, [], ['dal-vrij-pico', 'dal-vrij-livre']);
caso('saiu da estação: check-out vence tudo', { lugar: L['diemen-zuid'], agora: d('2026-03-12T21:50:00'), perfil: ['dalvrij'], eventos: ['saiu_estacao'] }, ['saiu-checkout']);
caso('chuva em 10 min', { lugar: L['diemen-zuid'], agora: d('2026-03-12T16:50:00'), perfil: [], fatos: { chuva_min: 10 } }, ['chuva']);
caso('sem chuva: cartão de chuva não aparece', { lugar: L['diemen-zuid'], agora: d('2026-03-12T16:50:00'), perfil: [], fatos: { chuva_min: null } }, [], ['chuva']);
caso('calor de 27 °C', { lugar: null, agora: d('2026-03-14T12:00:00'), perfil: [], fatos: { temp_max: 27 } }, ['calor']);
// --- absorção de skills (o core novo) ---
caso('recém-chegado: cartões de chegar/conexão aparecem', { lugar: null, agora: d('2026-03-12T12:00:00'), perfil: ['recem'] }, ['marktplaats-usado', 'esim-sem-dados']);
caso('turista (sem recem): cartões de recém NÃO aparecem', { lugar: null, agora: d('2026-03-12T12:00:00'), perfil: [] }, [], ['marktplaats-usado', 'esim-sem-dados']);
caso('ESPANHA: a 2ª skill de país carrega e dispara', { lugar: null, agora: d('2026-03-12T12:00:00'), perfil: ['espanha'] }, ['es-empadronamiento', 'es-nie']);
caso('sem destino Espanha: cartões de ES não aparecem', { lugar: null, agora: d('2026-03-12T12:00:00'), perfil: ['recem'] }, [], ['es-empadronamiento', 'es-nie']);
caso('em Schiphol com Dal Vrij: alerta do Intercity Direct', { lugar: L['schiphol'], agora: d('2026-03-12T11:00:00'), perfil: ['dalvrij'] }, ['intercity-direct-toeslag']);
caso('perto da balsa de Holwerd: passe não cobre balsa', { lugar: L['holwerd-veerdam'], agora: d('2026-03-12T11:00:00'), perfil: ['dalvrij'] }, ['ilhas-balsa']);
{ const { lerChuva } = await import('./sensores.js');
  const t = '000|16:50\n000|16:55\n087|17:00\n000|17:05';
  const r = lerChuva(t) === 10 && lerChuva('000|16:50\n000|16:55') === null; if (!r) falhas++;
  console.log(`${r ? 'OK  ' : 'FALHA'} Buienradar: "087" no 3º passo = chuva em 10 min; tudo 000 = sem chuva`); }
// matemática
const pico = [['2026-03-12T15:59:00', false], ['2026-03-12T16:00:00', true], ['2026-03-12T18:30:00', false], ['2026-03-14T17:00:00', false]];
for (const [t, e] of pico) { const r = noPico(d(t)) === e; if (!r) falhas++; console.log(`${r ? 'OK  ' : 'FALHA'} noPico(${t}) = ${e}`); }
const k = base.cartoes.find(c => c.id === 'agua');
let av = {}; for (let i = 0; i < 5; i++) av = avaliar(av, 'agua', false, d('2026-03-12T12:00:00'));
const p1 = peso(k, av, d('2026-03-12T12:00:00')).w, p2 = peso(k, av, d('2026-08-12T12:00:00')).w, p0 = peso(k, {}, d('2026-03-12')).w;
const r = p1 < p0 && p2 > p1; if (!r) falhas++;
console.log(`${r ? 'OK  ' : 'FALHA'} Beta: prior ${p0.toFixed(2)} → 5 "não" ${p1.toFixed(2)} → 5 meses depois esquece ${p2.toFixed(2)}`);
// --- estrutura: o loader fundiu 2 países e todo cartão tem ação ou é informativo ---
{ const paises = new Set(base.skills.map(s => s.pais));
  const semAcao = base.cartoes.filter(c => !c.acoes).map(c => c.id);
  const r = base.skills.length === 6 && paises.has('nl') && paises.has('es') && base.cartoes.length === 19;
  if (!r) falhas++;
  console.log(`${r ? 'OK  ' : 'FALHA'} loader: ${base.skills.length} skills, ${paises.size} países (${[...paises].join(',')}), ${base.cartoes.length} cartões`);
  console.log(`      cartões sem ação (informativos, ok): ${semAcao.join(', ') || 'nenhum'}`); }
console.log(falhas ? `${falhas} FALHA(S)` : 'TUDO OK'); process.exit(falhas ? 1 : 0);
