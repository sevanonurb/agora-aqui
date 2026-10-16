// offline: guarda os 4 arquivos na primeira visita; depois serve do cache e atualiza por trás
const CACHE = 'agora-aqui-2026-10-16f';
const ARQ = ['./', 'index.html', 'kernel.js', 'cartoes.json', 'manifest.webmanifest', 'icone.svg', 'sensores.js', 'chuva.js'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQ))));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))));
self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(r => {
    const rede = fetch(e.request).then(resp => { caches.open(CACHE).then(c => c.put(e.request, resp.clone())); return resp; }).catch(() => r);
    return r || rede;
  }));
});
