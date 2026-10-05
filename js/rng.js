// Seedet tilfeldighet. Samme seed gir alltid samme tallrekke, slik at en verden
// kan gjenskapes fra ett tall i stedet for å lagre hele kartet.

/** Mulberry32: rask 32-bits PRNG. Returnerer en funksjon som gir tall i [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Blander flere heltall til ett seed (brukes til «verden 123, forsøk 2, lag 'fukt'»). */
export function blandSeed(...deler) {
  let h = 0x9e3779b9;
  for (const d of deler) {
    const s = String(d);
    for (let i = 0; i < s.length; i++) {
      h = Math.imul(h ^ s.charCodeAt(i), 0x85ebca6b);
      h ^= h >>> 13;
    }
    h = Math.imul(h ^ 0x2c1b3c6d, 0xc2b2ae35);
    h ^= h >>> 16;
  }
  return h >>> 0;
}

/** Hjelpere oppå en rng-funksjon. */
export function lagTilfeldig(seed) {
  const r = mulberry32(seed);
  return {
    tall: r,
    heltall: (min, maks) => min + Math.floor(r() * (maks - min + 1)),
    velg: (liste) => liste[Math.floor(r() * liste.length)],
    sjanse: (p) => r() < p,
    stokk(liste) {
      for (let i = liste.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        [liste[i], liste[j]] = [liste[j], liste[i]];
      }
      return liste;
    },
  };
}
