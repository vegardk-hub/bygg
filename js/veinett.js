// Veinettet: hvor det kan bygges vei, hvilke steder (leiren og landsbyer) som
// er bundet sammen, handelsrutene mellom dem, og korteste nye vei til leirens nett.
// Ingen DOM – brukes av spill.js og testes i Node.
//
// Varer kan fraktes både langs veier og gjennom dine egne bygg: veier og bygg som
// henger sammen er ett nett. Ellers ville en leir omringet av gårder aldri kunne
// få vei ut.

import { T } from './data/terreng.js';
import { HANDEL } from './data/balanse.js';

const RETNING = [['N', 0, -1], ['E', 1, 0], ['S', 0, 1], ['W', -1, 0]];

function nabo(verden, i, dx, dy) {
  const B = verden.bredde, x = (i % B) + dx, y = Math.floor(i / B) + dy;
  return x >= 0 && y >= 0 && x < B && y < verden.hoyde ? y * B + x : -1;
}

export function naboer4(verden, i) {
  return RETNING.map(([, dx, dy]) => nabo(verden, i, dx, dy)).filter((j) => j >= 0);
}

/** Leiren og landsbyene er «steder» som veier kobler sammen. */
export function erSted(spill, verden, i) {
  return verden.overlegg.get(i)?.type === 'landsby' || spill.bygg.get(i)?.type === 'leir';
}

export function stedStorrelse(spill, verden, i) {
  if (spill.bygg.get(i)?.type === 'leir') return HANDEL.leirStorrelse;
  return spill.landsbyer.get(i)?.str ?? 1;
}

export function stedNavn(spill, verden, i) {
  return spill.bygg.get(i)?.type === 'leir' ? 'Leiren' : verden.landsbynavn.get(i);
}

/** Kan varer fraktes over denne ruta? (Vei eller et av dine egne bygg.) */
export function erFerdsel(spill, i) {
  return spill.veier.has(i) || spill.bygg.has(i);
}

/** Kan det ligge vei her? (Uavhengig av om man har råd.) */
export function kanHaVei(spill, verden, i) {
  if (!spill.avdekket[i] || spill.veier.has(i) || spill.bygg.has(i)) return false;
  if (verden.terreng[i] === T.FJELL) return false;
  // Dyr stenger ikke: de flytter seg når veien kommer (se flyttDyr i spill.js).
  const o = verden.overlegg.get(i)?.type;
  return o !== 'landsby' && o !== 'malm';
}

/**
 * Retningene ruta er koblet til, som [retning, veitype].
 * En vei kobles til naboveier, landsbyer og bygg. Et bygg eller en landsby får en
 * stubb inn fra hver nabovei (med den veiens type, så stubben ser riktig ut).
 */
export function veiRetninger(spill, verden, i) {
  const ut = [];
  for (const [d, dx, dy] of RETNING) {
    const j = nabo(verden, i, dx, dy);
    if (j < 0) continue;
    if (spill.veier.has(j)) ut.push([d, spill.veier.get(j)]);
    else if (spill.veier.has(i) && (erSted(spill, verden, j) || spill.bygg.has(j))) ut.push([d, spill.veier.get(i)]);
  }
  return ut;
}

/** Sammenhengende nett av veier og bygg: rute → nett-nummer. */
export function nettverk(spill, verden) {
  const nett = new Map();
  let nr = 0;
  for (const start of [...spill.veier.keys(), ...spill.bygg.keys()]) {
    if (nett.has(start)) continue;
    const ko = [start];
    nett.set(start, nr);
    while (ko.length) {
      const i = ko.pop();
      for (const j of naboer4(verden, i)) {
        if (erFerdsel(spill, j) && !nett.has(j)) { nett.set(j, nr); ko.push(j); }
      }
    }
    nr++;
  }
  return nett;
}

/** Alle steder med nettene de er del av (leiren) eller grenser til (landsbyer). */
function stederMedNett(spill, verden, nett) {
  const steder = [];
  const kandidater = [...verden.landsbynavn.keys()].filter((i) => spill.avdekket[i]);
  for (const [i, b] of spill.bygg) if (b.type === 'leir') kandidater.push(i);
  for (const i of kandidater) {
    const nr = new Set();
    if (nett.has(i)) nr.add(nett.get(i));
    for (const j of naboer4(verden, i)) if (nett.has(j)) nr.add(nett.get(j));
    steder.push({ i, nett: nr });
  }
  return steder;
}

/** Korteste vei mellom to steder innenfor ett nett (liste med ruter). */
function korteste(spill, verden, nett, nr, fra, til) {
  const forrige = new Map();
  const ko = [];
  const inn = (i) => (nett.get(i) === nr ? [i] : naboer4(verden, i).filter((j) => nett.get(j) === nr));
  for (const j of inn(fra)) { forrige.set(j, -1); ko.push(j); }
  const maal = new Set(inn(til));
  for (let k = 0; k < ko.length; k++) {
    const i = ko[k];
    if (maal.has(i)) {
      const sti = [];
      for (let c = i; c !== -1; c = forrige.get(c)) sti.push(c);
      return sti.reverse();
    }
    for (const j of naboer4(verden, i)) {
      if (nett.get(j) === nr && !forrige.has(j)) { forrige.set(j, i); ko.push(j); }
    }
  }
  return null;
}

/**
 * Handelsrutene: ett par steder bundet sammen av vei gir mynter hver dag.
 * Returnerer [{ a, b, sti, lengde, stein, mynter }].
 */
export function handelsruter(spill, verden) {
  const nett = nettverk(spill, verden);
  const steder = stederMedNett(spill, verden, nett);
  const beste = new Map();
  for (let p = 0; p < steder.length; p++) {
    for (let q = p + 1; q < steder.length; q++) {
      const A = steder[p], B = steder[q];
      for (const nr of A.nett) {
        if (!B.nett.has(nr)) continue;
        const sti = korteste(spill, verden, nett, nr, A.i, B.i);
        if (!sti) continue;
        // Lengde og steinandel regnes av veirutene; bygg på veien teller ikke.
        const lengde = sti.filter((i) => spill.veier.has(i)).length;
        const stein = sti.filter((i) => spill.veier.get(i) === 'stein').length;
        const mynter = Math.round(
          (stedStorrelse(spill, verden, A.i) + stedStorrelse(spill, verden, B.i)) * (1 + stein / Math.max(1, lengde))
          + Math.floor(lengde / HANDEL.perLengde));
        const nokkel = `${A.i}-${B.i}`;
        if (!beste.has(nokkel) || beste.get(nokkel).mynter < mynter) {
          beste.set(nokkel, { a: A.i, b: B.i, sti, lengde, stein, mynter });
        }
      }
    }
  }
  return [...beste.values()];
}

export function leirIndeks(spill) {
  for (const [i, b] of spill.bygg) if (b.type === 'leir') return i;
  return -1;
}

/** Er stedet bundet til leiren med vei og/eller bygg? */
export function kobletTilLeiren(spill, verden, i) {
  const leir = leirIndeks(spill);
  if (i === leir) return true;
  const nett = nettverk(spill, verden);
  const leirNr = nett.get(leir);
  return naboer4(verden, i).some((j) => nett.get(j) === leirNr);
}

/**
 * Billigste nye vei fra stedet `fra` til leirens nett (Dijkstra over avdekkede ruter).
 * Eksisterende vei er gratis å bruke. Returnerer { ruter: [nye veiruter], broer } eller null.
 */
export function finnVeiTilLeiren(spill, verden, fra, { prisLand = 1, prisVann = 3 } = {}) {
  if (kobletTilLeiren(spill, verden, fra)) return { ruter: [], broer: 0 };
  const nett = nettverk(spill, verden);
  const leirNr = nett.get(leirIndeks(spill));
  const erMaal = (i) => nett.get(i) === leirNr;
  // Eksisterende veier og bygg er gratis å gå gjennom; nye veier koster.
  const kost = (i) => (erFerdsel(spill, i) ? 0 : kanHaVei(spill, verden, i) ? (verden.terreng[i] === T.VANN ? prisVann : prisLand) : Infinity);

  const avstand = new Map(), forrige = new Map();
  const apne = [];
  for (const j of naboer4(verden, fra)) {
    const k = kost(j);
    if (k === Infinity) continue;
    avstand.set(j, k);
    forrige.set(j, -1);
    apne.push(j);
  }
  while (apne.length) {
    // Liten liste (≤ 1000 ruter): enkel «finn minste» holder.
    let m = 0;
    for (let k = 1; k < apne.length; k++) if (avstand.get(apne[k]) < avstand.get(apne[m])) m = k;
    const i = apne.splice(m, 1)[0];
    if (erMaal(i)) {
      const ruter = [];
      for (let c = i; c !== -1; c = forrige.get(c)) if (!erFerdsel(spill, c)) ruter.push(c);
      ruter.reverse();
      return { ruter, broer: ruter.filter((r) => verden.terreng[r] === T.VANN).length };
    }
    for (const j of naboer4(verden, i)) {
      const k = kost(j);
      if (k === Infinity) continue;
      const ny = avstand.get(i) + k;
      if (!avstand.has(j) || ny < avstand.get(j)) {
        if (!avstand.has(j)) apne.push(j);
        avstand.set(j, ny);
        forrige.set(j, i);
      }
    }
  }
  return null;
}

/** Stedene (leiren og landsbyer) som er koblet til nettet rute i ligger i. */
export function stederINettet(spill, verden, i) {
  const nett = nettverk(spill, verden);
  const nr = nett.get(i);
  if (nr === undefined) return [];
  return stederMedNett(spill, verden, nett).filter((s) => s.nett.has(nr)).map((s) => s.i);
}
