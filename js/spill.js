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
  RAVARE_REKKEFOLGE, VEI, LANDSBY, MARKED, OPPDRAG, SKIP, REISE, BIOM, HENDELSE, RAVARER,
} from './data/balanse.js';
import { MAAL, SYNLIGE_MAAL } from './data/maal.js';
import {
  kanHaVei, nettverk, handelsruter, kobletTilLeiren, finnVeiTilLeiren, stedNavn, naboer4, stederINettet,
} from './veinett.js';
import { blandSeed, lagTilfeldig } from './rng.js';

export const SPILL_VERSJON = 5;

/** Statistikk-feltene. Nye felt får 0 når en gammel lagring lastes. */
export const TOM_STAT = {
  avdekket: 0, bygget: 0, oppgradert: 0, solgt: 0, skatter: 0, landsbyer: 0, tjent: 0, dager: 0, gardNabo: 0,
  veier: 0, broer: 0, steinveier: 0, handel: 0, matLevert: 0, kobletLandsbyer: 0, storsteLandsby: 1,
  oppdrag: 0, matTyper: 0, // matTyper: bitmaske over hvilke matvarer som er gitt (korn 1, fisk 2, kjøtt 4)
  reiser: 0, verdener: 1, fraktet: 0,
};

// ---------------------------------------------------------------------------
// Oppstart og verdener
// ---------------------------------------------------------------------------
//
// Spillet kan ha flere verdener (øyer). Den du er i nå, ligger rett på `spill`
// (seed, str, avdekket, bygg, veier … og råvarene i spill.lager), så alle
// regelfunksjonene virker som før. De andre ligger som øyeblikksbilder i
// spill.verdener[k] (plassen til den aktive er null). Mynter, dag, mål og
// statistikk er felles for alle verdener.

/** Feltene som hører til én verden (resten av `spill` er felles). */
export const VERDENSFELT = ['seed', 'str', 'biom', 'navn', 'avdekket', 'bygg', 'brukt', 'veier', 'landsbyer', 'flytt', 'skattekart'];

const VERDENSNAVN = {
  temperert: [['Grønn', 'Lyng', 'Bjørke', 'Eike', 'Kløver'], ['øya', 'holmen', 'landet']],
  orken: [['Sand', 'Sol', 'Gull', 'Kaktus', 'Dyne'], ['øya', 'landet', 'stranda']],
  sno: [['Is', 'Snø', 'Frost', 'Kvit', 'Nordlys'], ['øya', 'holmen', 'landet']],
  jungel: [['Palme', 'Papegøye', 'Frukt', 'Lian', 'Kokos'], ['øya', 'holmen', 'landet']],
};

function verdensnavn(seed, biom) {
  const tilf = lagTilfeldig(blandSeed(seed, 'verdensnavn'));
  const [for_, etter] = VERDENSNAVN[biom];
  return tilf.velg(for_) + tilf.velg(etter);
}

/** Lager en helt ny verden: avdekket startområde, leiren, og (for nye øyer) en havn ved vannet. */
function lagVerdensTilstand(seed, str, biom, medHavn) {
  const verden = lagVerden({ seed, str, biom, flytt: [] }, { ny: true });
  const w = {
    seed, str, biom, navn: verdensnavn(seed, biom),
    avdekket: new Uint8Array(str * str),
    bygg: new Map(),
    brukt: new Set(),         // skatter og bærbusker som er hentet
    veier: new Map(),         // rute → 'tre' | 'stein'
    landsbyer: new Map(),     // rute → { str, mat, priser, oppdrag … } for landsbyer man har funnet
    flytt: [],                // [fra, til] for dyr som har flyttet seg (til = -1: gått inn i skogen)
    skattekart: [],           // skjulte skatter du har fått kart over (vises med ✕ i tåka)
    lager: {},                // råvarene i denne verdenen (mynter er felles)
  };
  const r = START.avdekketRadius;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const x = verden.start.x + dx, y = verden.start.y + dy;
      if (x >= 0 && y >= 0 && x < str && y < str) w.avdekket[y * str + x] = 1;
    }
  }
  const startI = verden.start.y * str + verden.start.x;
  w.bygg.set(startI, { type: 'leir', nivaa: 1 });
  if (medHavn) {
    // Skipet trenger en havn å legge til ved: nærmeste ledige land ved vann rundt leiren.
    let best = -1, bestAvst = Infinity;
    for (let i = 0; i < str * str; i++) {
      const t = verden.terreng[i];
      if ((t !== T.STRAND && t !== T.GRESS) || i === startI || verden.overlegg.has(i)) continue;
      if (!naboer(verden, i).some((j) => verden.terreng[j] === T.VANN)) continue;
      const d = Math.hypot((i % str) - verden.start.x, Math.floor(i / str) - verden.start.y);
      if (d < bestAvst) { bestAvst = d; best = i; }
    }
    if (best >= 0) {
      w.bygg.set(best, { type: 'havn', nivaa: 1 });
      w.avdekket[best] = 1;
    }
  }
  return { w, verden };
}

export function nyttSpill(seed, str = 32) {
  const { w, verden } = lagVerdensTilstand(seed, str, 'temperert', false);
  const spill = {
    versjon: SPILL_VERSJON,
    rotSeed: seed,             // nye verdener får seed avledet av denne
    dag: 1,
    maalFerdig: new Set(),
    stat: { ...TOM_STAT },
    aktiv: 0,
    verdener: [null],
    skip: null,                // { nivaa, plass (verden), last: { vare: n } }
    hendelse: null,            // en hendelse som venter på svar (handelsmannen)
    sisteHendelse: 0,          // dagen forrige hendelse kom
    ...w,
    lager: { ...START_LAGER },
  };
  return { spill, verden };
}

// Genererte kart gjenbrukes (det tar noen millisekunder å lage dem).
const verdenLager = new Map();

/** Kartet til en verden (samme seed → samme kart). `ny`: lag på nytt i stedet for å gjenbruke. */
export function lagVerden(w, { ny = false } = {}) {
  const nokkel = `${w.seed}:${w.str}`;
  if (!ny && verdenLager.has(nokkel)) return verdenLager.get(nokkel);
  const verden = genererVerden(w.seed, { bredde: w.str, hoyde: w.str });
  verden.landsbynavn = navngiLandsbyer(verden);
  verden.biom = w.biom ?? 'temperert';
  // Dyr som har flyttet seg, flyttes på nytt i samme rekkefølge.
  for (const [fra, til] of w.flytt ?? []) flyttOverlegg(verden, fra, til);
  verdenLager.set(nokkel, verden);
  return verden;
}

/** Øyeblikksbilde av verdenen du er i (råvarer uten mynter). */
function taUtVerden(spill) {
  const w = {};
  for (const f of VERDENSFELT) w[f] = spill[f];
  const { mynter, ...lager } = spill.lager;
  w.lager = lager;
  return w;
}

function settInnVerden(spill, w) {
  for (const f of VERDENSFELT) spill[f] = w[f] ?? (f === 'skattekart' ? [] : w[f]);
  spill.lager = { ...Object.fromEntries(RAVARE_REKKEFOLGE.map((r) => [r, 0])), ...w.lager, mynter: spill.lager.mynter };
}

/** Alle verdener som liste med navn og biom (den aktive tas fra spill). */
export function alleVerdener(spill) {
  return spill.verdener.map((w, k) => {
    const v = k === spill.aktiv ? taUtVerden(spill) : w;
    return { nr: k, navn: v.navn, biom: v.biom, str: v.str, lager: v.lager, aktiv: k === spill.aktiv, harHavn: [...v.bygg.values()].some((b) => b.type === 'havn') };
  });
}

export const kartstjerner = (spill) => spill.verdener.length - 1;

function flyttOverlegg(verden, fra, til) {
  const o = verden.overlegg.get(fra);
  if (!o) return;
  verden.overlegg.delete(fra);
  if (til >= 0) verden.overlegg.set(til, o);
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
  // Prisen stiger med hvor mye som er avdekket i *denne* verdenen (startområdet teller ikke),
  // så en ny øy er en frisk start. Kartstjerner (én per verden du har oppdaget) gir rabatt.
  let avdekket = -((2 * START.avdekketRadius + 1) ** 2);
  for (let i = 0; i < spill.avdekket.length; i++) avdekket += spill.avdekket[i];
  const rabatt = Math.max(REISE.minstePrisFaktor, REISE.kartstjerneRabatt ** kartstjerner(spill));
  const pris = AVDEKK.grunn * AVDEKK.vekst ** Math.max(0, avdekket) * rabatt;
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
  spill.skattekart = (spill.skattekart ?? []).filter((j) => j !== i);
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
    landsby(spill, verden, i);
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

/** De 8 rutene rundt i (også diagonalt). */
function naboer8(verden, i) {
  const B = verden.bredde, x = i % B, y = Math.floor(i / B), ut = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < B && ny < verden.hoyde) ut.push(ny * B + nx);
    }
  }
  return ut;
}

const dyrRundt = (verden, i) => naboer8(verden, i).filter((j) => verden.overlegg.get(j)?.type === 'dyr').length;

/** Er byggets krav oppfylt på denne ruta? (Vann ved siden av, dyr rundt, riktig nabobygg.) */
export function kravOppfylt(spill, verden, i, type) {
  const k = BYGG[type].krav;
  if (!k) return true;
  if (k.naboTerreng !== undefined && !naboer(verden, i).some((j) => verden.terreng[j] === k.naboTerreng)) return false;
  if (k.dyrRundt && !dyrRundt(verden, i)) return false;
  if (k.naboBygg && !naboer(verden, i).some((j) => spill.bygg.get(j)?.type === k.naboBygg)) return false;
  return true;
}

/**
 * Bygg som passer på ruta (riktig terreng og overlegg). `medKrav` = true: bare de der
 * kravene også er oppfylt. Uten: også de som mangler krav (panelet viser hvorfor).
 */
export function muligeBygg(spill, verden, i, { medKrav = true } = {}) {
  if (!spill.avdekket[i] || spill.bygg.has(i) || spill.veier.has(i)) return [];
  const o = verden.overlegg.get(i)?.type;
  return Object.entries(BYGG)
    .filter(([, b]) => b.kanBygges && b.paa.includes(verden.terreng[i]))
    .filter(([, b]) => (b.paaOverlegg ? o === b.paaOverlegg : !OPPTAR_RUTA.includes(o)))
    .filter(([type]) => !medKrav || kravOppfylt(spill, verden, i, type))
    .map(([type]) => type);
}

export function bygg(spill, verden, i, type) {
  if (!muligeBygg(spill, verden, i, { medKrav: false }).includes(type)) return [{ type: 'feil', tekst: 'Det kan ikke bygges her.' }];
  if (!kravOppfylt(spill, verden, i, type)) return [{ type: 'feil', tekst: BYGG[type].krav.tekst }];
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
  if (!def.ravare) return { gave: {}, forklaring: '' };
  let bonus = 0;
  for (const j of naboer(verden, i)) {
    if (def.nabo.terreng?.includes(verden.terreng[j])) bonus += def.nabo.pr;
    if (def.nabo.bygg && spill.bygg.get(j)?.type === def.nabo.bygg) bonus += def.nabo.pr;
  }
  if (def.nabo.dyr) bonus += dyrRundt(verden, i) * def.nabo.pr;
  const gang = nivaa > 1 ? NIVAA[nivaa].gang : 1;
  const mengde = (def.grunn + bonus) * gang;
  const deler = def.grunn ? [`${def.grunn} grunn`] : [];
  if (bonus) deler.push(`${def.grunn ? '+' : ''}${bonus} fra naboer`);
  if (!def.grunn && !bonus) deler.push('ingen naboer som gir noe ennå');
  if (gang > 1) deler.push(`× ${gang} (nivå ${nivaa})`);
  return { gave: { [def.ravare]: mengde }, forklaring: deler.join(' ') };
}

export function inntektPerDag(spill, verden) {
  const sum = Object.fromEntries(RAVARE_REKKEFOLGE.map((r) => [r, 0]));
  for (const i of spill.bygg.keys()) {
    for (const [r, n] of Object.entries(produksjon(spill, verden, i).gave)) sum[r] += n;
  }
  for (const rute of handelsruter(spill, verden)) sum.mynter += rute.mynter;
  return sum;
}

export function nyDag(spill, verden) {
  const hendelser = [];
  for (const i of spill.bygg.keys()) {
    const { gave } = produksjon(spill, verden, i);
    gi(spill, gave);
    hendelser.push({ type: 'produsert', i, gave });
  }
  for (const rute of handelsruter(spill, verden)) {
    gi(spill, { mynter: rute.mynter });
    spill.stat.handel += rute.mynter;
    hendelser.push({ type: 'handel', ...rute });
  }
  // Markedsprisene henter seg inn over natta, og landsbyer uten oppdrag finner på et nytt.
  for (const [i, l] of spill.landsbyer) {
    for (const vare of Object.keys(l.priser)) l.priser[vare] += (1 - l.priser[vare]) * MARKED.gjenopprettingPerDag;
    if (!l.oppdrag && l.pause > 0) l.pause--;
    else if (!l.oppdrag && kobletTilLeiren(spill, verden, i)) {
      l.oppdrag = nyttOppdrag(spill, verden, i, l);
      hendelser.push({ type: 'oppdrag', i, tekst: `📜 ${verden.landsbynavn.get(i)} har et nytt oppdrag!` });
    }
  }
  // De andre verdenene produserer videre til sitt eget lager mens du er borte.
  spill.verdener.forEach((w, k) => {
    if (w && k !== spill.aktiv) hendelser.push(produserBorte(spill, w));
  });
  spill.dag++;
  spill.stat.dager++;
  const hendelse = trekkHendelse(spill, verden);
  if (hendelse) hendelser.push(hendelse);
  return [{ type: 'nyDag', dag: spill.dag }, ...hendelser].concat(sjekkMaal(spill));
}

// ---------------------------------------------------------------------------
// Hendelser: små, hyggelige overraskelser når dagen skifter
// ---------------------------------------------------------------------------
const VARER = () => RAVARE_REKKEFOLGE.filter((r) => r !== 'mynter');

/** Kanskje en hendelse i dag. Bestemt av verden og dag, så den er lik om man laster på nytt. */
export function trekkHendelse(spill, verden) {
  spill.hendelse = null; // et ubesvart tilbud fra i går er borte
  if (spill.dag - (spill.sisteHendelse ?? 0) < HENDELSE.minstDagerMellom) return null;
  const tilf = lagTilfeldig(blandSeed(spill.rotSeed ?? spill.seed, 'hendelse', spill.dag));
  if (!tilf.sjanse(HENDELSE.sjanse)) return null;
  // Velg blant hendelsene som gir mening akkurat nå.
  const inntekt = inntektPerDag(spill, verden);
  const koblet = [...verden.landsbynavn.keys()].filter((i) => spill.avdekket[i] && kobletTilLeiren(spill, verden, i));
  const skjulteSkatter = [...verden.overlegg].filter(([i, o]) => o.type === 'skatt' && !spill.avdekket[i] && !spill.brukt.has(i)
    && !(spill.skattekart ?? []).includes(i)).map(([i]) => i);
  const produserte = VARER().filter((r) => inntekt[r] > 0);
  const mulige = Object.entries(HENDELSE.vekt).filter(([art]) => {
    if (art === 'festival' || art === 'gave') return koblet.length > 0;
    if (art === 'skattekart') return skjulteSkatter.length > 0;
    if (art === 'avling') return produserte.length > 0;
    return true;
  });
  let r = tilf.tall() * mulige.reduce((a, [, v]) => a + v, 0);
  const [art] = mulige.find(([, v]) => (r -= v) < 0) ?? mulige[0];
  spill.sisteHendelse = spill.dag;

  if (art === 'handelsmann') {
    // Et byttetilbud: gi noe du har mye av, få noe annet (litt bedre enn markedet).
    const har = VARER().filter((v) => (spill.lager[v] || 0) >= 10).sort((a, b) => spill.lager[b] - spill.lager[a]);
    const gi = har[0] ?? 'korn';
    const faa = tilf.velg(VARER().filter((v) => v !== gi));
    const giN = 10 + 5 * tilf.heltall(0, 2);
    const faaN = Math.max(3, Math.round((giN * MARKED.pris[gi] * 1.4) / MARKED.pris[faa]));
    spill.hendelse = { art, gi: { [gi]: giN }, faa: { [faa]: faaN } };
    return { type: 'hendelse', art, valg: true, gi: { [gi]: giN }, faa: { [faa]: faaN },
      tittel: '🧳 En vandrende handelsmann', tekst: 'Han vil gjerne bytte med deg!' };
  }
  if (art === 'avling') {
    const vare = tilf.velg(produserte);
    const n = inntekt[vare];
    gi(spill, { [vare]: n });
    const ord = { korn: 'God avling', tre: 'Godt hogstvær', stein: 'Lett å bryte stein', fisk: 'Fisken biter', kjott: 'God jakt', jern: 'Rik malmåre' };
    return { type: 'hendelse', art, gave: { [vare]: n }, tittel: `☀️ ${ord[vare] ?? 'Flott dag'}!`, tekst: 'Du får en ekstra dags produksjon av' };
  }
  if (art === 'festival') {
    const i = tilf.velg(koblet);
    const ruter = handelsruter(spill, verden).filter((rt) => rt.a === i || rt.b === i);
    const n = Math.max(10, ruter.reduce((a, rt) => a + rt.mynter, 0) * 2);
    gi(spill, { mynter: n });
    return { type: 'hendelse', art, i, gave: { mynter: n }, tittel: `🎉 Festival i ${verden.landsbynavn.get(i)}!`, tekst: 'Alle kommer for å handle. Du tjener' };
  }
  if (art === 'gave') {
    const i = tilf.velg(koblet);
    const vare = tilf.velg(['korn', 'fisk', 'kjott', 'tre', 'stein']);
    const n = 8 + 4 * (landsby(spill, verden, i).str);
    gi(spill, { [vare]: n });
    return { type: 'hendelse', art, i, gave: { [vare]: n }, tittel: `🎁 Gave fra ${verden.landsbynavn.get(i)}`, tekst: 'Takk for veien! De gir deg' };
  }
  // Skattekart: vis hvor en skjult skatt ligger.
  const i = tilf.velg(skjulteSkatter);
  spill.skattekart = [...(spill.skattekart ?? []), i];
  return { type: 'hendelse', art, i, tittel: '🗺️ Et gammelt skattekart!', tekst: 'Det viser hvor en skatt ligger gjemt i tåka. Se etter ✕ og utforsk dit!' };
}

/** Svar på handelsmannens tilbud. */
export function svarHendelse(spill, ja) {
  const h = spill.hendelse;
  spill.hendelse = null;
  if (!h || !ja) return [];
  if (!harRad(spill, h.gi)) return [{ type: 'feil', tekst: 'Du har ikke nok til å bytte.', mangler: h.gi }];
  trekk(spill, h.gi);
  gi(spill, h.faa);
  return [{ type: 'byttet', gi: h.gi, faa: h.faa }].concat(sjekkMaal(spill));
}

/** Produksjon i en verden du ikke er i: råvarer til dens lager (med tak), handel gir mynter til deg. */
function produserBorte(spill, w) {
  const verden = lagVerden(w);
  const vis = { ...w, stat: { ...TOM_STAT } }; // regelfunksjonene trenger et «spill» å se på
  const sum = {};
  for (const i of w.bygg.keys()) {
    for (const [r, n] of Object.entries(produksjon(vis, verden, i).gave)) {
      if (r === 'mynter') { gi(spill, { mynter: n }); continue; }
      const for_ = w.lager[r] || 0;
      // Taket stopper bare videre oppsamling – det tar aldri bort noe man allerede har.
      w.lager[r] = for_ >= REISE.lagerTakBorte ? for_ : Math.min(REISE.lagerTakBorte, for_ + n);
      sum[r] = (sum[r] || 0) + (w.lager[r] - for_);
    }
  }
  let handel = 0;
  for (const rute of handelsruter(vis, verden)) handel += rute.mynter;
  if (handel) { gi(spill, { mynter: handel }); spill.stat.handel += handel; }
  return { type: 'borte', navn: w.navn, gave: sum, mynter: handel };
}

// ---------------------------------------------------------------------------
// Skip og seiling
// ---------------------------------------------------------------------------
export const harHavn = (spill) => [...spill.bygg.values()].some((b) => b.type === 'havn');
export const lasterom = (spill) => (spill.skip ? SKIP.lasterom[spill.skip.nivaa] : 0);
export const lastSum = (spill) => Object.values(spill.skip?.last ?? {}).reduce((a, n) => a + n, 0);
export const skipHer = (spill) => spill.skip && spill.skip.plass === spill.aktiv;

export function byggSkip(spill) {
  if (spill.skip) return [{ type: 'feil', tekst: 'Du har allerede et skip.' }];
  if (!harHavn(spill)) return [{ type: 'feil', tekst: 'Bygg en havn først.' }];
  if (!harRad(spill, SKIP.kost)) return [{ type: 'feil', tekst: 'Du har ikke nok til skipet.', mangler: SKIP.kost }];
  trekk(spill, SKIP.kost);
  spill.skip = { nivaa: 1, plass: spill.aktiv, last: {} };
  return [{ type: 'skip', tekst: '⛵ Skipet ligger klart i havna!' }].concat(sjekkMaal(spill));
}

export function oppgraderSkipKost(spill) {
  if (!spill.skip || spill.skip.nivaa >= SKIP.maksNivaa) return null;
  return { ...SKIP.oppgrader[spill.skip.nivaa + 1] };
}

export function oppgraderSkip(spill) {
  const kost = oppgraderSkipKost(spill);
  if (!kost) return [{ type: 'feil', tekst: 'Skipet kan ikke bli større.' }];
  if (!skipHer(spill)) return [{ type: 'feil', tekst: 'Skipet er ikke her.' }];
  if (!harRad(spill, kost)) return [{ type: 'feil', tekst: 'Du har ikke nok.', mangler: kost }];
  trekk(spill, kost);
  spill.skip.nivaa++;
  return [{ type: 'skip', tekst: `⛵ Skipet er større! Lasterom: ${lasterom(spill)}` }].concat(sjekkMaal(spill));
}

/** Flytter n av en vare mellom lageret og skipet (n > 0: last på, n < 0: ta av). */
export function lastSkip(spill, vare, n) {
  if (!skipHer(spill)) return [{ type: 'feil', tekst: 'Skipet er ikke her.' }];
  const last = spill.skip.last;
  if (n > 0) n = Math.min(n, spill.lager[vare] || 0, lasterom(spill) - lastSum(spill));
  else n = -Math.min(-n, last[vare] || 0);
  if (!n) return [{ type: 'feil', tekst: n === 0 && lastSum(spill) >= lasterom(spill) ? 'Skipet er fullt.' : 'Ingenting å flytte.' }];
  spill.lager[vare] -= n;
  last[vare] = (last[vare] || 0) + n;
  if (!last[vare]) delete last[vare];
  return [{ type: 'last', vare, n }];
}

/** Kan du seile til en ukjent verden nå? Returnerer en forklaring hvis ikke. */
export function kanOppdage(spill, verden) {
  let koblet = 0;
  for (const i of verden.landsbynavn.keys()) if (spill.avdekket[i] && kobletTilLeiren(spill, verden, i)) koblet++;
  if (koblet < REISE.krevKobletLandsbyer) {
    return { ok: false, tekst: `Koble minst ${REISE.krevKobletLandsbyer} landsbyer til leiren med vei før du seiler ut på ukjent hav (nå: ${koblet}).` };
  }
  return { ok: true };
}

/**
 * Seil til verden nr `mal` (eller 'ny' for å oppdage en ny). Reisen tar en dag – alle
 * verdener produserer – og lasten losses i havna du kommer til. Etterpå er `spill`
 * den nye verdenen; kalleren må hente kartet på nytt med lagVerden(spill).
 */
export function seil(spill, verden, mal) {
  if (!spill.skip) return [{ type: 'feil', tekst: 'Du trenger et skip. Bygg det i havna.' }];
  if (!skipHer(spill)) return [{ type: 'feil', tekst: 'Skipet ligger i en annen verden.' }];
  if (!harHavn(spill)) return [{ type: 'feil', tekst: 'Du trenger en havn å seile fra.' }];
  if (mal === spill.aktiv) return [{ type: 'feil', tekst: 'Du er allerede her!' }];
  if (mal === 'ny') {
    const k = kanOppdage(spill, verden);
    if (!k.ok) return [{ type: 'feil', tekst: k.tekst }];
  } else if (!spill.verdener[mal]) {
    return [{ type: 'feil', tekst: 'Den verdenen finnes ikke.' }];
  }
  // Reisen: en dag går for alle verdener.
  const dag = nyDag(spill, verden).filter((h) => h.type === 'maal');
  const fraNavn = spill.navn;
  spill.verdener[spill.aktiv] = taUtVerden(spill);
  let nr = mal, ny = false;
  if (mal === 'ny') {
    nr = spill.verdener.length;
    const str = Math.min(REISE.maksStorrelse, REISE.forsteStorrelse + REISE.storrelseVekst * nr);
    const biom = REISE.biomer[(nr - 1) % REISE.biomer.length];
    const { w } = lagVerdensTilstand(blandSeed(spill.rotSeed, 'verden', nr) % 1_000_000, str, biom, true);
    spill.verdener.push(w);
    spill.stat.verdener++;
    ny = true;
  }
  const w = spill.verdener[nr];
  spill.verdener[nr] = null;
  spill.aktiv = nr;
  settInnVerden(spill, w);
  // Loss lasten i den nye havna.
  const last = spill.skip.last;
  for (const [vare, n] of Object.entries(last)) {
    spill.lager[vare] = (spill.lager[vare] || 0) + n;
    spill.stat.fraktet += n;
  }
  spill.skip.last = {};
  spill.skip.plass = nr;
  spill.stat.reiser++;
  const tekst = ny
    ? `⛵ Du har oppdaget ${spill.navn}! ${BIOM[spill.biom].ikon} En ny kartstjerne gjør utforsking billigere.`
    : `⛵ Velkommen tilbake til ${spill.navn}!`;
  return [{ type: 'seilt', fra: fraNavn, til: spill.navn, ny, last, tekst }, ...dag].concat(sjekkMaal(spill));
}

// ---------------------------------------------------------------------------
// Veier
// ---------------------------------------------------------------------------
export { kanHaVei, handelsruter, kobletTilLeiren, stedNavn, stederINettet };

export function veiKost(verden, i) {
  return verden.terreng[i] === T.VANN ? { ...VEI.tre.bruKost } : { ...VEI.tre.kost };
}

export function steinKost(verden, i) {
  return verden.terreng[i] === T.VANN ? { ...VEI.stein.bruKost } : { ...VEI.stein.kost };
}

const sum = (kostnader) => kostnader.reduce((acc, k) => {
  for (const [r, n] of Object.entries(k)) acc[r] = (acc[r] || 0) + n;
  return acc;
}, {});

/** Sammenligner handelsrutene før og etter en endring og melder om nye ruter. */
function nyeRuter(spill, verden, for_) {
  const kjente = new Set(for_.map((r) => `${r.a}-${r.b}`));
  const ut = [];
  for (const r of handelsruter(spill, verden)) {
    if (kjente.has(`${r.a}-${r.b}`)) continue;
    ut.push({ type: 'nyRute', ...r, tekst: `Ny handelsrute: ${stedNavn(spill, verden, r.a)} ↔ ${stedNavn(spill, verden, r.b)}! +${r.mynter} 🪙 per dag` });
  }
  return ut;
}

function oppdaterKoblet(spill, verden) {
  let n = 0;
  for (const i of verden.landsbynavn.keys()) if (spill.avdekket[i] && kobletTilLeiren(spill, verden, i)) n++;
  spill.stat.kobletLandsbyer = Math.max(spill.stat.kobletLandsbyer, n);
}

/** Et dyr som står i veien, rusler til nærmeste ledige eng- eller skogrute. */
function flyttDyr(spill, verden, i) {
  const o = verden.overlegg.get(i);
  const B = verden.bredde;
  const ledig = (j) => (verden.terreng[j] === T.GRESS || verden.terreng[j] === T.SKOG)
    && !verden.overlegg.has(j) && !spill.bygg.has(j) && !spill.veier.has(j) && j !== i;
  let til = -1, best = Infinity;
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const x = (i % B) + dx, y = Math.floor(i / B) + dy;
      if (x < 0 || y < 0 || x >= B || y >= verden.hoyde) continue;
      const j = y * B + x, d = Math.hypot(dx, dy);
      if (ledig(j) && d < best) { best = d; til = j; }
    }
  }
  flyttOverlegg(verden, i, til);
  spill.flytt.push([i, til]);
  const navn = o.art === 'hjort' ? 'Hjorten' : 'Sauen';
  return { type: 'dyrFlytter', fra: i, til, tekst: til >= 0 ? `${navn} ruslet litt unna veien 🐾` : `${navn} gikk inn i skogen 🌲` };
}

function leggVei(spill, verden, i, hendelser) {
  if (verden.overlegg.get(i)?.type === 'dyr') hendelser.push(flyttDyr(spill, verden, i));
  spill.veier.set(i, 'tre');
  spill.stat.veier++;
  if (verden.terreng[i] === T.VANN) spill.stat.broer++;
}

export function byggVei(spill, verden, i) {
  if (!kanHaVei(spill, verden, i)) return [{ type: 'feil', tekst: 'Her kan det ikke bygges vei.' }];
  const kost = veiKost(verden, i);
  if (!harRad(spill, kost)) return [{ type: 'feil', tekst: 'Du har ikke nok til veien.', mangler: kost }];
  const for_ = handelsruter(spill, verden);
  trekk(spill, kost);
  const dyr = [];
  leggVei(spill, verden, i, dyr);
  oppdaterKoblet(spill, verden);
  return [{ type: 'vei', ruter: [i] }, ...dyr, ...nyeRuter(spill, verden, for_)].concat(sjekkMaal(spill));
}

/** Billigste vei fra en landsby til leirens nett: hvilke ruter, og hva det koster. */
export function veiTilLeirenPlan(spill, verden, i) {
  const plan = finnVeiTilLeiren(spill, verden, i);
  if (!plan) return null;
  return { ...plan, kost: sum(plan.ruter.map((r) => veiKost(verden, r))) };
}

export function byggVeiTilLeiren(spill, verden, i) {
  const plan = veiTilLeirenPlan(spill, verden, i);
  if (!plan) return [{ type: 'feil', tekst: 'Fant ingen vei dit ennå – avdekk mer av kartet mellom landsbyen og leiren.' }];
  if (!plan.ruter.length) return [{ type: 'feil', tekst: 'Landsbyen er allerede koblet til leiren.' }];
  if (!harRad(spill, plan.kost)) return [{ type: 'feil', tekst: 'Du har ikke nok til hele veien.', mangler: plan.kost }];
  const for_ = handelsruter(spill, verden);
  trekk(spill, plan.kost);
  const dyr = [];
  for (const r of plan.ruter) leggVei(spill, verden, r, dyr);
  oppdaterKoblet(spill, verden);
  return [{ type: 'vei', ruter: plan.ruter }, ...dyr, ...nyeRuter(spill, verden, for_)].concat(sjekkMaal(spill));
}

/** Treveiene i samme nett som rute i (for «gjør hele veien om til stein»). */
export function treveierINettet(spill, verden, i) {
  const nett = nettverk(spill, verden);
  const nr = nett.get(i);
  return [...spill.veier].filter(([j, type]) => type === 'tre' && nett.get(j) === nr).map(([j]) => j);
}

export function steinKostFor(verden, ruter) {
  return sum(ruter.map((r) => steinKost(verden, r)));
}

/** Gjør treveier om til steinvei. `ruter` = én rute eller hele nettet. */
export function oppgraderVei(spill, verden, ruter) {
  ruter = ruter.filter((r) => spill.veier.get(r) === 'tre');
  if (!ruter.length) return [{ type: 'feil', tekst: 'Det er ingen trevei å oppgradere her.' }];
  const kost = steinKostFor(verden, ruter);
  if (!harRad(spill, kost)) return [{ type: 'feil', tekst: 'Du har ikke nok stein.', mangler: kost }];
  trekk(spill, kost);
  for (const r of ruter) spill.veier.set(r, 'stein');
  spill.stat.steinveier += ruter.length;
  return [{ type: 'steinvei', ruter }].concat(sjekkMaal(spill));
}

// ---------------------------------------------------------------------------
// Landsbyer: vekst og marked
// ---------------------------------------------------------------------------
/** Tilstanden til en landsby (lages første gang den trengs). */
export function landsby(spill, verden, i) {
  if (!spill.landsbyer.has(i)) {
    // Hver landsby kjøper to av varene – bestemt av verdenen, så det er likt hver gang.
    const tilf = lagTilfeldig(blandSeed(verden.seed, 'marked', i));
    const varer = tilf.stokk(Object.keys(MARKED.pris)).slice(0, 2);
    spill.landsbyer.set(i, { str: 1, mat: 0, priser: Object.fromEntries(varer.map((v) => [v, 1])) });
  }
  return spill.landsbyer.get(i);
}

/** Hvor mye vekst gir n enheter av en matvare nå (med variasjonsbonus)? */
export function matVerdi(spill, verden, i, vare, n) {
  const l = landsby(spill, verden, i);
  const bonus = l.sisteMat && l.sisteMat !== vare ? 1 + LANDSBY.variasjonsbonus : 1;
  return { mat: Math.round(n * LANDSBY.matverdi[vare] * bonus), variasjon: bonus > 1 };
}

/** Legger mat til landsbyen og lar den vokse. Returnerer vekst-hendelser. */
function voks(spill, verden, i, l, mat) {
  const hendelser = [];
  if (l.str >= LANDSBY.maksStorrelse) return hendelser;
  l.mat += mat;
  while (l.str < LANDSBY.maksStorrelse && l.mat >= LANDSBY.vekst[l.str]) {
    l.mat -= LANDSBY.vekst[l.str];
    l.str++;
    spill.stat.storsteLandsby = Math.max(spill.stat.storsteLandsby, l.str);
    hendelser.push({ type: 'vekst', i, str: l.str, tekst: `${verden.landsbynavn.get(i)} vokser! Nå størrelse ${l.str} 🏘️` });
  }
  if (l.str >= LANDSBY.maksStorrelse) l.mat = 0;
  return hendelser;
}

const MATBIT = { korn: 1, fisk: 2, kjott: 4 };

export function giMat(spill, verden, i, vare = 'korn') {
  const l = landsby(spill, verden, i);
  if (!kobletTilLeiren(spill, verden, i)) return [{ type: 'feil', tekst: 'Bygg vei til landsbyen først, så maten kommer fram.' }];
  if (l.str >= LANDSBY.maksStorrelse) return [{ type: 'feil', tekst: 'Landsbyen er så stor den kan bli!' }];
  if (!LANDSBY.matverdi[vare]) return [{ type: 'feil', tekst: 'Det er ikke mat.' }];
  const n = Math.min(LANDSBY.leveranse, spill.lager[vare] || 0);
  if (n <= 0) return [{ type: 'feil', tekst: 'Du har ikke noe å gi.', mangler: { [vare]: LANDSBY.leveranse } }];
  const { mat, variasjon } = matVerdi(spill, verden, i, vare, n);
  spill.lager[vare] -= n;
  l.sisteMat = vare;
  spill.stat.matLevert += n;
  spill.stat.matTyper |= MATBIT[vare];
  const hendelser = [{ type: 'mat', i, vare, antall: n, mat, variasjon }];
  return hendelser.concat(voks(spill, verden, i, l, mat), sjekkMaal(spill));
}

// ---------------------------------------------------------------------------
// Oppdrag
// ---------------------------------------------------------------------------
/** Nytt oppdrag: en vare spilleren kan skaffe, i en mengde som passer landsbyens størrelse. */
function nyttOppdrag(spill, verden, i, l) {
  l.oppdragNr = (l.oppdragNr ?? 0) + 1;
  const tilf = lagTilfeldig(blandSeed(verden.seed, 'oppdrag', i, l.oppdragNr));
  const inntekt = inntektPerDag(spill, verden);
  const kan = Object.keys(MARKED.pris).filter((v) => inntekt[v] > 0 || (spill.lager[v] || 0) > 0);
  const vare = tilf.velg(kan.length ? kan : ['tre', 'korn']);
  const antall = Math.round((OPPDRAG.grunn + OPPDRAG.perStorrelse * l.str) / (MARKED.pris[vare] >= 4 ? 2 : 1));
  return {
    vare, antall,
    mynter: Math.round(antall * MARKED.pris[vare] * OPPDRAG.belonningsfaktor),
    mat: Math.round(antall * OPPDRAG.matAndel * (LANDSBY.matverdi[vare] ?? 1)),
  };
}

export function leverOppdrag(spill, verden, i) {
  const l = landsby(spill, verden, i);
  const o = l.oppdrag;
  if (!o) return [{ type: 'feil', tekst: 'Landsbyen har ikke noe oppdrag akkurat nå.' }];
  if (!kobletTilLeiren(spill, verden, i)) return [{ type: 'feil', tekst: 'Bygg vei til landsbyen først.' }];
  const kost = { [o.vare]: o.antall };
  if (!harRad(spill, kost)) return [{ type: 'feil', tekst: 'Du har ikke nok ennå.', mangler: kost }];
  trekk(spill, kost);
  gi(spill, { mynter: o.mynter });
  l.oppdrag = null;
  l.pause = OPPDRAG.pauseDager; // en liten pause før neste oppdrag
  spill.stat.oppdrag++;
  const hendelser = [{ type: 'oppdragFerdig', i, mynter: o.mynter, tekst: `📜 Oppdrag fullført for ${verden.landsbynavn.get(i)}! +${o.mynter} 🪙` }];
  return hendelser.concat(voks(spill, verden, i, l, o.mat), sjekkMaal(spill));
}

/** Hva får man for å selge `antall` av en vare i landsbyen nå? (Prisen faller for hver vare.) */
export function markedsverdi(spill, verden, i, vare, antall) {
  const l = landsby(spill, verden, i);
  let f = l.priser[vare];
  if (f === undefined) return { mynter: 0, faktor: 0 };
  let mynter = 0;
  for (let k = 0; k < antall; k++) {
    mynter += MARKED.pris[vare] * f;
    f = Math.max(MARKED.minFaktor, f * MARKED.fallPerVare);
  }
  return { mynter: Math.round(mynter), faktor: f };
}

export function selgIMarked(spill, verden, i, vare, antall) {
  const l = landsby(spill, verden, i);
  if (!kobletTilLeiren(spill, verden, i)) return [{ type: 'feil', tekst: 'Bygg vei til landsbyen først, så varene kommer fram.' }];
  if (l.priser[vare] === undefined) return [{ type: 'feil', tekst: 'Den landsbyen kjøper ikke det.' }];
  const n = Math.min(antall, spill.lager[vare] || 0);
  if (n <= 0) return [{ type: 'feil', tekst: 'Ingenting å selge.' }];
  const { mynter, faktor } = markedsverdi(spill, verden, i, vare, n);
  spill.lager[vare] -= n;
  l.priser[vare] = faktor;
  gi(spill, { mynter });
  spill.stat.solgt += n;
  return [{ type: 'solgt', i, ravare: vare, antall: n, mynter }].concat(sjekkMaal(spill));
}

export { naboer4 };

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
