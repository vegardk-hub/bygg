// Spillreglene. Ingen DOM her – alt kan kjøres og testes i Node.
//
// `spill` er den lagrede tilstanden (det spilleren har gjort), `verden` er det
// genererte kartet (gjenskapes fra seed). Funksjonene som endrer noe returnerer
// en liste med hendelser ({ type, ... }) som brukergrensesnittet kan vise.

import { genererVerden } from './kartgen.js';
import { navngiLandsbyer } from './navn.js';
import { T, START } from './data/terreng.js';
import {
  START_LAGER, AVDEKK, BYGG, BYGG_KOSTVEKST, NIVAA, OPPGRADER_KOSTVEKST, MAKS_NIVAA, PRIS, FUNN,
  RAVARE_REKKEFOLGE,
} from './data/balanse.js';
import { MAAL, SYNLIGE_MAAL } from './data/maal.js';

export const SPILL_VERSJON = 1;

// ---------------------------------------------------------------------------
// Oppstart
// ---------------------------------------------------------------------------
export function nyttSpill(seed, str = 32) {
  const verden = lagVerden({ seed, str });
  const spill = {
    versjon: SPILL_VERSJON,
    seed, str,
    dag: 1,
    lager: { ...START_LAGER },
    avdekket: new Uint8Array(str * str),
    bygg: new Map(),
    brukt: new Set(),         // skatter og bærbusker som er hentet
    maalFerdig: new Set(),
    stat: { avdekket: 0, bygget: 0, oppgradert: 0, solgt: 0, skatter: 0, landsbyer: 0, tjent: 0, dager: 0, gardNabo: 0 },
  };
  const r = START.avdekketRadius;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const x = verden.start.x + dx, y = verden.start.y + dy;
      if (x >= 0 && y >= 0 && x < str && y < str) spill.avdekket[y * str + x] = 1;
    }
  }
  spill.bygg.set(verden.start.y * str + verden.start.x, { type: 'leir', nivaa: 1 });
  return { spill, verden };
}

/** Genererer verdenen et spill hører til (samme seed → samme kart). */
export function lagVerden(spill) {
  const verden = genererVerden(spill.seed, { bredde: spill.str, hoyde: spill.str });
  verden.landsbynavn = navngiLandsbyer(verden);
  return verden;
}

// ---------------------------------------------------------------------------
// Hjelpere
// ---------------------------------------------------------------------------
const NABO4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function naboer(verden, i) {
  const B = verden.bredde, x = i % B, y = Math.floor(i / B);
  const ut = [];
  for (const [dx, dy] of NABO4) {
    const nx = x + dx, ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < B && ny < verden.hoyde) ut.push(ny * B + nx);
  }
  return ut;
}

export function harRad(spill, kost) {
  return Object.entries(kost).every(([r, n]) => (spill.lager[r] || 0) >= n);
}

function trekk(spill, kost) {
  for (const [r, n] of Object.entries(kost)) spill.lager[r] -= n;
}

function gi(spill, gave) {
  for (const [r, n] of Object.entries(gave)) {
    spill.lager[r] = (spill.lager[r] || 0) + n;
    if (r === 'mynter') spill.stat.tjent += n;
  }
}

const skaler = (kost, faktor) =>
  Object.fromEntries(Object.entries(kost).map(([r, n]) => [r, Math.ceil(n * faktor)]));

// ---------------------------------------------------------------------------
// Avdekking
// ---------------------------------------------------------------------------
export function kanAvdekkes(spill, verden, i) {
  if (spill.avdekket[i]) return false;
  return naboer(verden, i).some((j) => spill.avdekket[j]);
}

/** Prisen for neste rute (land eller vann), uavhengig av hvilken rute det er. */
export function avdekkPris(spill, vann = false) {
  const pris = AVDEKK.grunn * AVDEKK.vekst ** spill.stat.avdekket;
  return Math.max(1, Math.round(pris * (vann ? AVDEKK.vannFaktor : 1)));
}

export function avdekkKost(spill, verden, i) {
  return { mynter: avdekkPris(spill, verden.terreng[i] === T.VANN) };
}

export function avdekk(spill, verden, i) {
  if (!kanAvdekkes(spill, verden, i)) return [{ type: 'feil', tekst: 'Du kan bare avdekke ruter ved siden av det du ser.' }];
  const kost = avdekkKost(spill, verden, i);
  if (!harRad(spill, kost)) return [{ type: 'feil', tekst: `Du trenger ${kost.mynter} 🪙 for å avdekke.`, mangler: kost }];
  trekk(spill, kost);
  spill.avdekket[i] = 1;
  spill.stat.avdekket++;
  const hendelser = [{ type: 'avdekket', i }];

  const o = verden.overlegg.get(i);
  if (o?.type === 'skatt' && !spill.brukt.has(i)) {
    const mynter = FUNN.skatt.grunn + FUNN.skatt.perTidligere * spill.stat.skatter;
    spill.brukt.add(i);
    spill.stat.skatter++;
    gi(spill, { mynter });
    hendelser.push({ type: 'funn', i, tekst: `Du fant en gammel skatt! +${mynter} 🪙`, gave: { mynter } });
  } else if (o?.type === 'baer' && !spill.brukt.has(i)) {
    spill.brukt.add(i);
    gi(spill, { ...FUNN.baer });
    hendelser.push({ type: 'funn', i, tekst: `Bær! +${FUNN.baer.korn} 🌾`, gave: { ...FUNN.baer } });
  } else if (o?.type === 'landsby') {
    spill.stat.landsbyer++;
    hendelser.push({ type: 'funn', i, tekst: `Du fant landsbyen ${verden.landsbynavn.get(i)}! 🏘️` });
  }
  return hendelser.concat(sjekkMaal(spill));
}

// ---------------------------------------------------------------------------
// Bygging og oppgradering
// ---------------------------------------------------------------------------
export function byggKost(spill, type) {
  const antall = [...spill.bygg.values()].filter((b) => b.type === type).length;
  return skaler(BYGG[type].kost, BYGG_KOSTVEKST ** antall);
}

/** Overlegg som opptar ruta (de får egne bygg i senere faser: jakthytte, gruve, handel). */
const OPPTAR_RUTA = ['landsby', 'dyr', 'malm'];

/** Hvilke bygg kan stå på denne ruta (uansett om man har råd)? */
export function muligeBygg(spill, verden, i) {
  if (!spill.avdekket[i] || spill.bygg.has(i) || OPPTAR_RUTA.includes(verden.overlegg.get(i)?.type)) return [];
  return Object.entries(BYGG)
    .filter(([, b]) => b.kanBygges && b.paa.includes(verden.terreng[i]))
    .map(([type]) => type);
}

export function bygg(spill, verden, i, type) {
  if (!muligeBygg(spill, verden, i).includes(type)) return [{ type: 'feil', tekst: 'Det kan ikke bygges her.' }];
  const kost = byggKost(spill, type);
  if (!harRad(spill, kost)) return [{ type: 'feil', tekst: 'Du har ikke nok råvarer ennå.', mangler: kost }];
  trekk(spill, kost);
  spill.bygg.set(i, { type, nivaa: 1 });
  spill.stat.bygget++;
  if (type === 'gard' && naboer(verden, i).some((j) => spill.bygg.get(j)?.type === 'gard')) spill.stat.gardNabo = 1;
  return [{ type: 'bygget', i, bygg: type }].concat(sjekkMaal(spill));
}

export function oppgraderKost(spill, i) {
  const b = spill.bygg.get(i);
  if (!b || b.type === 'leir' || b.nivaa >= MAKS_NIVAA) return null;
  return skaler(NIVAA[b.nivaa + 1].kost, OPPGRADER_KOSTVEKST ** spill.stat.oppgradert);
}

export function oppgrader(spill, verden, i) {
  const kost = oppgraderKost(spill, i);
  if (!kost) return [{ type: 'feil', tekst: 'Dette kan ikke oppgraderes mer.' }];
  if (!harRad(spill, kost)) return [{ type: 'feil', tekst: 'Du har ikke nok råvarer ennå.', mangler: kost }];
  trekk(spill, kost);
  const b = spill.bygg.get(i);
  b.nivaa++;
  spill.stat.oppgradert++;
  return [{ type: 'oppgradert', i, nivaa: b.nivaa }].concat(sjekkMaal(spill));
}

// ---------------------------------------------------------------------------
// Produksjon
// ---------------------------------------------------------------------------
/** Hva et bygg (eller et tenkt bygg av `type` på rute i) lager per dag, med forklaring. */
export function produksjon(spill, verden, i, type = spill.bygg.get(i)?.type, nivaa = spill.bygg.get(i)?.nivaa ?? 1) {
  const def = BYGG[type];
  if (!def) return null;
  if (type === 'leir') return { gave: { ...def.gir }, forklaring: '' };
  let bonus = 0;
  for (const j of naboer(verden, i)) {
    if (def.nabo.terreng?.includes(verden.terreng[j])) bonus += def.nabo.pr;
    if (def.nabo.bygg && spill.bygg.get(j)?.type === def.nabo.bygg) bonus += def.nabo.pr;
  }
  const gang = nivaa > 1 ? NIVAA[nivaa].gang : 1;
  const mengde = (def.grunn + bonus) * gang;
  const deler = [`${def.grunn} grunn`];
  if (bonus) deler.push(`+${bonus} fra naboer`);
  if (gang > 1) deler.push(`× ${gang} (nivå ${nivaa})`);
  return { gave: { [def.ravare]: mengde }, forklaring: deler.join(' ') };
}

export function inntektPerDag(spill, verden) {
  const sum = Object.fromEntries(RAVARE_REKKEFOLGE.map((r) => [r, 0]));
  for (const i of spill.bygg.keys()) {
    for (const [r, n] of Object.entries(produksjon(spill, verden, i).gave)) sum[r] += n;
  }
  return sum;
}

export function nyDag(spill, verden) {
  const hendelser = [];
  for (const i of spill.bygg.keys()) {
    const { gave } = produksjon(spill, verden, i);
    gi(spill, gave);
    hendelser.push({ type: 'produsert', i, gave });
  }
  spill.dag++;
  spill.stat.dager++;
  return [{ type: 'nyDag', dag: spill.dag }, ...hendelser].concat(sjekkMaal(spill));
}

// ---------------------------------------------------------------------------
// Salg i leiren
// ---------------------------------------------------------------------------
export function selg(spill, ravare, antall) {
  const n = Math.min(antall, spill.lager[ravare] || 0);
  if (!PRIS[ravare] || n <= 0) return [{ type: 'feil', tekst: 'Ingenting å selge.' }];
  const mynter = n * PRIS[ravare];
  spill.lager[ravare] -= n;
  gi(spill, { mynter });
  spill.stat.solgt += n;
  return [{ type: 'solgt', ravare, antall: n, mynter }].concat(sjekkMaal(spill));
}

// ---------------------------------------------------------------------------
// Mål
// ---------------------------------------------------------------------------
export function aktiveMaal(spill) {
  return MAAL.filter((m) => !spill.maalFerdig.has(m.id)).slice(0, SYNLIGE_MAAL)
    .map((m) => ({ ...m, naa: Math.min(m.maal, m.verdi(spill)) }));
}

function sjekkMaal(spill) {
  const hendelser = [];
  // Gjenta til ingenting nytt fullføres (en belønning kan fullføre et annet mål).
  for (let runde = 0; runde < 5; runde++) {
    const ferdige = aktiveMaal(spill).filter((m) => m.verdi(spill) >= m.maal);
    if (!ferdige.length) break;
    for (const m of ferdige) {
      spill.maalFerdig.add(m.id);
      gi(spill, m.belonning);
      hendelser.push({ type: 'maal', id: m.id, tekst: m.tekst, gave: m.belonning });
    }
  }
  return hendelser;
}
