// chuva.js — gráfico + mapa sincronizados: do passado (−2 h) ao presente e ao futuro (+2 h).
// Nasceu de um comentário de usuário no próprio cartão de chuva (16/10/2026).
// Fontes, pedidas direto pelo aparelho: Open-Meteo (grade, passado e futuro, 15 min) e
// Buienradar (radar no ponto do usuário, próximas 2 h, 5 min).

const PASSOS = 8;                      // 8 × 15 min = 2 h para cada lado
const GRADE = 7, DLAT = 0.08, DLON = 0.13;   // 7 × 7 pontos, ≈ ±9 km em volta do usuário

export const cor = mm => mm < 0.1 ? null : mm < 0.5 ? '#9ecae1' : mm < 2 ? '#4292c6' : mm < 5 ? '#08519c' : '#54278f';

export async function lerGrade(centro) {
  const lats = [], lons = [];
  for (let i = 0; i < GRADE; i++) for (let j = 0; j < GRADE; j++) {
    lats.push((centro.lat + DLAT * (i / (GRADE - 1) * 2 - 1)).toFixed(3));
    lons.push((centro.lon + DLON * (j / (GRADE - 1) * 2 - 1)).toFixed(3));
  }
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}` +
    `&minutely_15=precipitation&past_minutely_15=${PASSOS}&forecast_minutely_15=${PASSOS}&timezone=Europe%2FAmsterdam`;
  const d = await (await fetch(url)).json();
  const pts = Array.isArray(d) ? d : [d];
  return { tempos: pts[0].minutely_15.time, pontos: pts.map(p => ({ lat: p.latitude, lon: p.longitude, mm: p.minutely_15.precipitation })) };
}

export async function lerRadarNoPonto(lugar) {
  const t = await (await fetch(`https://gpsgadget.buienradar.nl/data/raintext?lat=${lugar.lat.toFixed(2)}&lon=${lugar.lon.toFixed(2)}`, { cache: 'no-store' })).text();
  return t.trim().split('\n').map(l => { const [v, h] = l.split('|'); return { h: h.trim(), mm: Math.pow(10, (Number(v) - 109) / 32) }; });
}

function indiceAgora(tempos) {
  const agora = Date.now();
  let melhor = 0;
  tempos.forEach((t, i) => { if (new Date(t).getTime() <= agora) melhor = i; });
  return melhor;
}

// SVG do gráfico: barras do modelo no ponto do usuário (−2 h → +2 h) e linha do radar (+0 → +2 h)
function grafico(svg, tempos, serie, radar, cursor, iAgora) {
  const W = 320, H = 120, M = 22, n = tempos.length, bw = (W - M) / n;
  const topo = Math.max(1, ...serie, ...radar.map(r => r.mm));
  const y = mm => H - 18 - (H - 30) * Math.min(mm, topo) / topo;
  let s = `<rect x="${M + iAgora * bw}" y="4" width="${(n - iAgora) * bw}" height="${H - 22}" fill="currentColor" opacity="0.05"/>`;
  serie.forEach((mm, i) => { s += `<rect x="${M + i * bw + 1}" y="${y(mm)}" width="${bw - 2}" height="${H - 18 - y(mm)}" fill="${cor(mm) || '#ccc'}" ${i === cursor ? 'stroke="currentColor" stroke-width="1.5"' : ''}/>`; });
  if (radar.length) {
    const x0 = M + iAgora * bw, dx = (n - iAgora) * bw / radar.length;
    s += `<polyline fill="none" stroke="#e76f51" stroke-width="2" points="${radar.map((r, i) => `${x0 + i * dx},${y(r.mm)}`).join(' ')}"/>`;
  }
  s += `<line x1="${M + iAgora * bw}" x2="${M + iAgora * bw}" y1="2" y2="${H - 16}" stroke="currentColor" stroke-dasharray="3 3"/>`;
  s += `<text x="${M + iAgora * bw + 3}" y="12" font-size="10" fill="currentColor">agora</text>`;
  [[0, 'start', M], [iAgora, 'middle', M + iAgora * bw], [n - 1, 'end', W]].forEach(([i, ancora, x]) => { s += `<text x="${x}" y="${H - 4}" font-size="10" text-anchor="${ancora}" fill="currentColor">${tempos[i].slice(11, 16)}</text>`; });
  s += `<text x="0" y="${y(topo) + 4}" font-size="9" fill="currentColor">${topo.toFixed(1)}</text><text x="0" y="${H - 18}" font-size="9" fill="currentColor">0</text>`;
  svg.innerHTML = s;
}

export async function montar(raiz, lugar) {
  if (!window.L) { raiz.innerHTML = '<p class="porque">mapa indisponível sem internet</p>'; return; }
  raiz.innerHTML = `
    <svg viewBox="0 0 320 120" class="grafico-chuva" role="img" aria-label="chuva prevista e observada"></svg>
    <p class="porque">barras: modelo Open-Meteo no seu ponto (mm/h) · linha laranja: radar Buienradar, próximas 2 h</p>
    <div class="mapa-chuva"></div>
    <div class="controle-chuva"><button class="tocar">▶</button><input type="range" min="0" value="0"><span class="hora"></span></div>`;
  const [grade, radar] = await Promise.all([lerGrade(lugar), lerRadarNoPonto(lugar).catch(() => [])]);
  const { tempos, pontos } = grade, iAgora = indiceAgora(tempos);
  const meu = pontos.reduce((a, p) => (Math.hypot(p.lat - lugar.lat, p.lon - lugar.lon) < Math.hypot(a.lat - lugar.lat, a.lon - lugar.lon) ? p : a));
  const mapa = L.map(raiz.querySelector('.mapa-chuva'), { zoomControl: false, attributionControl: true }).setView([lugar.lat, lugar.lon], 11);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 15, attribution: '© OpenStreetMap' }).addTo(mapa);
  const hl = DLAT / (GRADE - 1), hn = DLON / (GRADE - 1);
  const celulas = pontos.map(p => L.rectangle([[p.lat - hl, p.lon - hn], [p.lat + hl, p.lon + hn]], { stroke: false, fillOpacity: 0 }).addTo(mapa));
  L.circleMarker([lugar.lat, lugar.lon], { radius: 7, color: '#e76f51', weight: 3, fillColor: '#fff', fillOpacity: 1 }).addTo(mapa).bindTooltip('você');
  const faixa = raiz.querySelector('input'), hora = raiz.querySelector('.hora'), svg = raiz.querySelector('svg');
  faixa.max = tempos.length - 1;
  function quadro(i) {
    pontos.forEach((p, k) => { const c = cor(p.mm[i]); celulas[k].setStyle({ fillColor: c || '#000', fillOpacity: c ? 0.55 : 0 }); });
    const rel = Math.round((i - iAgora) * 15);
    hora.textContent = `${tempos[i].slice(11, 16)} · ${rel === 0 ? 'agora' : rel < 0 ? `${-rel} min atrás` : `daqui ${rel} min`}`;
    faixa.value = i; grafico(svg, tempos, meu.mm, radar, i, iAgora);
  }
  let rodando = null;
  raiz.querySelector('.tocar').onclick = e => {
    if (rodando) { clearInterval(rodando); rodando = null; e.target.textContent = '▶'; return; }
    e.target.textContent = '❚❚'; let i = 0;
    rodando = setInterval(() => { quadro(i); i = (i + 1) % tempos.length; }, 600);
  };
  faixa.oninput = () => quadro(Number(faixa.value));
  quadro(iAgora);
}
