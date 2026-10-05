// Lagring i localStorage, med versjonsnummer og migreringer så gamle lagringer
// aldri går tapt når spillet oppdateres. Kartet lagres ikke – bare seed og det
// spilleren har gjort – så lagringen er liten.

import { SPILL_VERSJON, TOM_STAT } from './spill.js';

const NOKKEL = 'bygg-lagring';

/** Migreringer: MIGRERINGER[n] gjør en versjon-n-lagring om til versjon n+1. */
const MIGRERINGER = {
  // Versjon 2 (fase 2): veier og landsbyer.
  1: (d) => ({ ...d, versjon: 2, veier: [], landsbyer: [], flytt: [] }),
};

export function tilData(spill) {
  return {
    versjon: SPILL_VERSJON,
    seed: spill.seed,
    str: spill.str,
    dag: spill.dag,
    lager: { ...spill.lager },
    avdekket: bitsTilTekst(spill.avdekket),
    bygg: [...spill.bygg].map(([i, b]) => [i, b.type, b.nivaa]),
    brukt: [...spill.brukt],
    maalFerdig: [...spill.maalFerdig],
    stat: { ...spill.stat },
    veier: [...spill.veier],
    flytt: spill.flytt.map((f) => [...f]),
    landsbyer: [...spill.landsbyer].map(([i, l]) => [i, { ...l, priser: { ...l.priser } }]),
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
    seed: d.seed,
    str: d.str,
    dag: d.dag,
    lager: d.lager,
    avdekket: tekstTilBits(d.avdekket, d.str * d.str),
    bygg: new Map(d.bygg.map(([i, type, nivaa]) => [i, { type, nivaa }])),
    brukt: new Set(d.brukt),
    maalFerdig: new Set(d.maalFerdig),
    stat: { ...TOM_STAT, ...d.stat },
    veier: new Map(d.veier),
    flytt: d.flytt ?? [],
    landsbyer: new Map(d.landsbyer),
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
