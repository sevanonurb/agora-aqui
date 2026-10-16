// kernel.js — o princípio inteiro, sem dependência e sem rede.
// relevância(k, s) = C_k(s) · w_k · frescor(k)      (KERNEL.md §1)
// w_k = α / (α + β), com prior pela autoridade da fonte e esquecimento λ (KERNEL.md §2 e §8)

export const PRIOR = { oficial: [4, 1], medido: [4, 1], imprensa: [3, 1], comunidade: [2, 1], blog: [2, 2] };
export const LAMBDA = 0.98;          // esquecimento por dia: avaliação de 35 dias atrás pesa ~0,5
export const N_SAIDA = 3;

const RAIO_TERRA = 6371000;
export function distancia(a, b) {
  const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * RAIO_TERRA * Math.asin(Math.sqrt(h));
}

const minutos = hhmm => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const PICOS = [['06:30', '09:00'], ['16:00', '18:30']];

export function noPico(data) {
  const dia = data.getDay();                       // 0 = domingo
  if (dia === 0 || dia === 6) return false;
  const m = data.getHours() * 60 + data.getMinutes();
  return PICOS.some(([a, b]) => m >= minutos(a) && m < minutos(b));
}
export function minAtePico(data) {
  const m = data.getHours() * 60 + data.getMinutes();
  const prox = PICOS.map(([a]) => minutos(a)).filter(x => x > m);
  return prox.length ? Math.min(...prox) - m : null;
}

// C_k(s): cada cláusula é um predicado; a explicação é a lista das cláusulas que bateram
export function condicao(cartao, s, lugares) {
  const c = cartao.condicao || {}, motivos = [];
  if (c.perfil) {
    if (!s.perfil.includes(c.perfil)) return { ok: false };
    motivos.push(`você tem ${c.perfil === 'dalvrij' ? 'Dal Vrij' : c.perfil}`);
  }
  if (c.perto_de) {
    if (!s.lugar) return { ok: false };
    const perto = c.perto_de
      .map(id => ({ id, d: distancia(s.lugar, lugares[id]) }))
      .filter(x => x.d <= (c.raio_m || 300))
      .sort((a, b) => a.d - b.d)[0];
    if (!perto) return { ok: false };
    motivos.push(`você está a ${Math.round(perto.d)} m de ${lugares[perto.id].nome}`);
  }
  if (c.dias && !c.dias.includes(s.agora.getDay())) return { ok: false };
  if (c.janelas) {
    const m = s.agora.getHours() * 60 + s.agora.getMinutes();
    const j = c.janelas.find(([a, b]) => m >= minutos(a) && m < minutos(b));
    if (!j) return { ok: false };
    motivos.push(`são ${s.agora.toTimeString().slice(0, 5)}, entre ${j[0]} e ${j[1]}`);
  }
  const f = s.fatos || {};
  if (c.chuva_em_ate_min != null) {
    if (f.chuva_min == null || f.chuva_min > c.chuva_em_ate_min) return { ok: false };
    motivos.push(f.chuva_min === 0 ? 'está chovendo aqui agora (Buienradar)' : `o Buienradar prevê chuva aqui em ${f.chuva_min} min`);
  }
  if (c.temp_max_min != null) {
    if (f.temp_max == null || f.temp_max < c.temp_max_min) return { ok: false };
    motivos.push(`a máxima de hoje é ${Math.round(f.temp_max)} °C`);
  }
  if (c.evento) {
    if (!(s.eventos || []).includes(c.evento)) return { ok: false };
    motivos.push({ saiu_estacao: 'você acabou de sair da área da estação' }[c.evento] || c.evento);
  }
  if (c.fora_do_pico) {
    if (noPico(s.agora)) return { ok: false };
    motivos.push('agora é fora do pico');
  }
  if (!motivos.length) motivos.push('vale em qualquer lugar e hora');
  return { ok: true, motivos };
}

export function frescor(cartao, agora) {
  return cartao.valido_ate && agora >= new Date(cartao.valido_ate + 'T00:00:00') ? 0 : 1;
}

// avaliações locais: { [id]: { a, b, t } }, t = dia da última atualização
export function peso(cartao, avaliacoes, agora) {
  const aut = cartao.fontes?.[0]?.autoridade || 'blog';
  const [a0, b0] = PRIOR[aut] || PRIOR.blog;
  const av = avaliacoes[cartao.id];
  if (!av) return { w: a0 / (a0 + b0), n: 0 };
  const dias = Math.max(0, (agora - new Date(av.t)) / 864e5);
  const f = LAMBDA ** dias;
  const a = a0 + av.a * f, b = b0 + av.b * f;
  return { w: a / (a + b), n: av.a + av.b };
}

export function avaliar(avaliacoes, id, ajudou, agora) {
  const atual = avaliacoes[id] || { a: 0, b: 0, t: agora.toISOString() };
  const f = LAMBDA ** Math.max(0, (agora - new Date(atual.t)) / 864e5);
  return { ...avaliacoes, [id]: { a: atual.a * f + (ajudou ? 1 : 0), b: atual.b * f + (ajudou ? 0 : 1), t: agora.toISOString() } };
}

export function relevantes(base, s, avaliacoes, n = N_SAIDA) {
  return base.cartoes
    .map(k => {
      const c = condicao(k, s, base.lugares);
      if (!c.ok) return null;
      const { w, n: nav } = peso(k, avaliacoes, s.agora);
      // desempate: quantos predicados de fato bateram (raio_m é parâmetro, não conta); evento vence tudo
      const especificidade = c.motivos.filter(m => m !== 'vale em qualquer lugar e hora').length + (k.condicao?.evento ? 10 : 0);
      const r = w * frescor(k, s.agora);
      return r > 0 ? { k, r, w, nav, motivos: c.motivos, especificidade } : null;
    })
    .filter(Boolean)
    .sort((x, y) => y.especificidade - x.especificidade || y.r - x.r)
    .slice(0, n)
    .map(x => ({ ...x, titulo: preencher(x.k.titulo, s) }));
}

export function preencher(texto, s) {
  const f = s.fatos || {};
  const v = { min_ate_pico: minAtePico(s.agora), chuva_min: f.chuva_min, chuva_quando: f.chuva_min === 0 ? 'agora' : `em ${f.chuva_min} min`, temp_max: f.temp_max != null ? Math.round(f.temp_max) : null };
  return texto.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '?');
}
