// sensores.js — transforma o mundo em fatos para a situação s.
// Tudo é pedido DIRETO do aparelho para a fonte pública: nenhum servidor nosso vê o lugar do usuário.

// Buienradar: 24 linhas "vvv|hh:mm" a cada 5 min; intensidade mm/h = 10^((v-109)/32)
export function lerChuva(texto) {
  const linhas = texto.trim().split('\n').map(l => l.split('|'));
  const i = linhas.findIndex(([v]) => Math.pow(10, (Number(v) - 109) / 32) >= 0.1);
  return i < 0 ? null : i * 5;          // null = sem chuva nas próximas 2 h
}

export async function fatosDoTempo(lugar) {
  if (!lugar) return {};
  const q = `lat=${lugar.lat.toFixed(2)}&lon=${lugar.lon.toFixed(2)}`;
  const fatos = {};
  try {
    const r = await fetch(`https://gpsgadget.buienradar.nl/data/raintext?${q}`, { cache: 'no-store' });
    if (r.ok) fatos.chuva_min = lerChuva(await r.text());
  } catch {}
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lugar.lat.toFixed(2)}&longitude=${lugar.lon.toFixed(2)}&daily=temperature_2m_max&forecast_days=1&timezone=Europe%2FAmsterdam`);
    if (r.ok) fatos.temp_max = (await r.json()).daily.temperature_2m_max[0];
  } catch {}
  return fatos;
}

// evento "saiu da estação": esteve a < 150 m de uma estação e agora está a > 300 m
export function detectorDeSaida(lugares, distancia) {
  let dentro = null;
  return pos => {
    const perto = Object.entries(lugares).map(([id, l]) => ({ id, d: distancia(pos, l) })).sort((a, b) => a.d - b.d)[0];
    if (perto.d < 150) { dentro = perto.id; return null; }
    if (dentro && distancia(pos, lugares[dentro]) > 300) { const id = dentro; dentro = null; return { evento: 'saiu_estacao', estacao: id }; }
    return null;
  };
}
