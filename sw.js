// Service worker: gjør at spillet virker uten nett og kan legges på Hjem-skjermen.
// Strategi «svar fra lageret, oppdater i bakgrunnen»: spillet starter med en gang,
// og neste gang det åpnes, har det den nyeste versjonen fra GitHub.
const LAGER = 'bygg-v5';
const FILER = [
  './', 'index.html', 'spill.css', 'manifest.webmanifest',
  'ikoner/ikon-180.png', 'ikoner/ikon-192.png', 'ikoner/ikon-512.png',
  'js/main.js', 'js/brett.js', 'js/kamera.js', 'js/panel.js', 'js/spill.js', 'js/veinett.js', 'js/lagring.js',
  'js/kartgen.js', 'js/stoy.js', 'js/rng.js', 'js/navn.js', 'js/effekter.js', 'js/lyd.js',
  'js/data/terreng.js', 'js/data/balanse.js', 'js/data/maal.js',
  'js/stil/palett.js', 'js/stil/lavpoly.js', 'js/stil/ruter.js', 'js/stil/veier.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(LAGER).then((c) => c.addAll(FILER)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((navn) => Promise.all(navn.filter((n) => n !== LAGER).map((n) => caches.delete(n))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(LAGER).then(async (c) => {
    const lagret = await c.match(e.request, { ignoreSearch: true });
    const fraNett = fetch(e.request).then((svar) => {
      if (svar.ok) c.put(e.request, svar.clone());
      return svar;
    }).catch(() => lagret);
    return lagret ?? fraNett;
  }));
});
