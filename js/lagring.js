// Lagring i localStorage, med versjonsnummer og migreringer så gamle lagringer
// aldri går tapt når spillet oppdateres. Kartet lagres ikke – bare seed og det
// spilleren har gjort – så lagringen er liten.

import { SPILL_VERSJON, TOM_STAT } from './spill.js';

const NOKKEL = 'bygg-lagring';

/** Migreringer: MIGRERINGER[n] gjør en versjon-n-lagring om til versjon n+1. */
const MIGRERINGER = {
  // Versjon 2 (fase 2): veier og landsbyer.
  1: (d) => ({ ...d, versjon: 2, veier: [], landsbyer: [], flytt: [] }),
  // Versjon 3 (fase 3): fisk, kjøtt og jern i lageret.
  2: (d) => ({ ...d, versjon: 3, lager: { fisk: 0, kjott: 0, jern: 0, ...d.lager } }),
  // Versjon 4 (fase 4): flere verdener og skip. Den gamle verdenen blir verden nr. 0.
  3: (d) => ({ ...d, versjon: 4, biom: 'temperert', navn: 'Hjemøya', rotSeed: d.seed, aktiv: 0, verdener: [null], skip: null }),
};

/** Én verden (feltene i VERDENSFELT + lager) som ren data. */
function verdenTilData(w) {
  return {
    seed: w.seed, str: w.str, biom: w.biom, navn: w.navn,
    avdekket: bitsTilTekst(w.avdekket),
    bygg: [...w.bygg].map(([i, b]) => [i, b.type, b.nivaa]),
    brukt: [...w.brukt],
    veier: [...w.veier],
    flytt: w.flytt.map((f) => [...f]),
    landsbyer: [...w.landsbyer].map(([i, l]) => [i, { ...l, priser: { ...l.priser }, oppdrag: l.oppdrag ? { ...l.oppdrag } : null }]),
    lager: { ...w.lager },
  };
}

function verdenFraData(d) {
  return {
    seed: d.seed, str: d.str, biom: d.biom ?? 'temperert', navn: d.navn ?? 'Hjemøya',
    avdekket: tekstTilBits(d.avdekket, d.str * d.str),
    bygg: new Map(d.bygg.map(([i, type, nivaa]) => [i, { type, nivaa }])),
    brukt: new Set(d.brukt),
    veier: new Map(d.veier ?? []),
    flytt: d.flytt ?? [],
    landsbyer: new Map(d.landsbyer ?? []),
    lager: d.lager,
  };
}

export function tilData(spill) {
  return {
    versjon: SPILL_VERSJON,
    // Verdenen du er i ligger øverst (som i eldre versjoner) …
    ...verdenTilData(spill),
    lager: { ...spill.lager },
    // … resten er felles, og de andre verdenene ligger i `verdener` (null = den aktive).
    rotSeed: spill.rotSeed,
    dag: spill.dag,
    maalFerdig: [...spill.maalFerdig],
    stat: { ...spill.stat },
    aktiv: spill.aktiv,
    verdener: spill.verdener.map((w) => (w ? verdenTilData(w) : null)),
    skip: spill.skip ? { ...spill.skip, last: { ...spill.skip.last } } : null,
    lagret: Date.now(),
  };
}

export function fraData(data) {
  let d = structuredClone(data);
  while (d.versjon < SPILL_VERSJON) {
    const m = MIGRERINGER[d.versjon];
    if (!m) throw new Error(`Mangler migrering fra versjon ${d.versjon}`);
    d = m(d);
  }
  if (d.versjon > SPILL_VERSJON) throw new Error('Lagringen er fra en nyere versjon av spillet.');
  return {
    versjon: d.versjon,
    ...verdenFraData(d),
    lager: d.lager,
    rotSeed: d.rotSeed,
    dag: d.dag,
    maalFerdig: new Set(d.maalFerdig),
    stat: { ...TOM_STAT, ...d.stat },
    aktiv: d.aktiv,
    verdener: d.verdener.map((w) => (w ? verdenFraData(w) : null)),
    skip: d.skip,
  };
}

export function lagre(spill) {
  try {
    localStorage.setItem(NOKKEL, JSON.stringify(tilData(spill)));
    return true;
  } catch {
    return false;
  }
}

/** Returnerer et spill, eller null hvis det ikke finnes noe (eller det er ødelagt). */
export function hent() {
  try {
    const tekst = localStorage.getItem(NOKKEL);
    return tekst ? fraData(JSON.parse(tekst)) : null;
  } catch (e) {
    console.warn('Kunne ikke lese lagringen:', e);
    return null;
  }
}

export function slett() {
  try { localStorage.removeItem(NOKKEL); } catch { /* ignorer */ }
}

/** Lagrekode: hele lagringen som kopierbar tekst (sikkerhetskopi, flytte mellom enheter). */
export function lagLagrekode(spill) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(tilData(spill)))));
}

export function lesLagrekode(kode) {
  return fraData(JSON.parse(decodeURIComponent(escape(atob(kode.trim())))));
}

// Avdekket-kartet som base64 av en bitmaske (32×32 → ~172 tegn).
function bitsTilTekst(arr) {
  const bytes = new Uint8Array(Math.ceil(arr.length / 8));
  for (let i = 0; i < arr.length; i++) if (arr[i]) bytes[i >> 3] |= 1 << (i & 7);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function tekstTilBits(tekst, n) {
  const s = atob(tekst);
  const arr = new Uint8Array(n);
  for (let i = 0; i < n; i++) arr[i] = (s.charCodeAt(i >> 3) >> (i & 7)) & 1;
  return arr;
}
