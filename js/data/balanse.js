// Alle tall som styrer økonomien, samlet ett sted så de er lette å justere.
// Endrer du noe her, kjør `node test/simuler.js` for å se hvordan de første
// dagene utvikler seg.

import { T } from './terreng.js';

export const RAVARER = {
  mynter: { navn: 'Mynter', ikon: '🪙' },
  tre:    { navn: 'Tre',    ikon: '🪵' },
  stein:  { navn: 'Stein',  ikon: '🪨' },
  korn:   { navn: 'Korn',   ikon: '🌾' },
  fisk:   { navn: 'Fisk',   ikon: '🐟' },
  kjott:  { navn: 'Kjøtt',  ikon: '🍖' },
  jern:   { navn: 'Jern',   ikon: '⛓️' },
};
export const RAVARE_REKKEFOLGE = ['mynter', 'tre', 'stein', 'korn', 'fisk', 'kjott', 'jern'];
/** Disse vises først i råvarelinja når man har fått noen (så mobilen ikke fylles opp med nuller). */
export const SKJULT_TIL_FUNNET = ['fisk', 'kjott', 'jern'];

export const START_LAGER = { mynter: 15, tre: 10, stein: 0, korn: 5, fisk: 0, kjott: 0, jern: 0 };

/** Avdekking: grunnpris × vekst^(antall avdekket så langt). Vann er billigere. */
export const AVDEKK = { grunn: 2, vekst: 1.01, vannFaktor: 0.5 };

/**
 * Bygg. Produksjon per dag = (grunn + nabobonus) × nivå.
 * nabo.terreng: +pr for hver nabo (4 retninger) med en av disse terrengtypene.
 * nabo.bygg:    +pr for hver nabo (4 retninger) med denne typen bygg.
 * nabo.dyr:     +pr for hvert dyr i de 8 rutene rundt.
 * krav:         må være oppfylt for å kunne bygge (f.eks. minst ett dyr eller vann ved siden av).
 * paaOverlegg:  bygget kan bare stå på ruter med dette overlegget (gruve på jernmalm).
 */
export const BYGG = {
  leir: {
    navn: 'Leiren', ikon: '⛺', paa: [], kanBygges: false,
    gir: { mynter: 2, korn: 1 },
    tekst: 'Her bor du. Gir litt mynter og korn hver dag, og her kan du selge varer.',
  },
  hogstbu: {
    navn: 'Hogstbu', ikon: '🪓', paa: [T.SKOG], kanBygges: true,
    ravare: 'tre', grunn: 1, nabo: { terreng: [T.SKOG], pr: 1 },
    kost: { mynter: 5, korn: 2 },
    tekst: 'Hugger tre. +1 for hver skogrute ved siden av.',
  },
  gard: {
    navn: 'Gård', ikon: '🌾', paa: [T.GRESS], kanBygges: true,
    ravare: 'korn', grunn: 2, nabo: { bygg: 'gard', pr: 1 },
    kost: { tre: 3, mynter: 3 },
    tekst: 'Dyrker korn. +1 for hver gård ved siden av – gårder liker selskap.',
  },
  steinbrudd: {
    navn: 'Steinbrudd', ikon: '⛏️', paa: [T.AAS, T.FJELL], kanBygges: true,
    ravare: 'stein', grunn: 1, nabo: { terreng: [T.AAS, T.FJELL], pr: 1 },
    kost: { tre: 6, korn: 4, mynter: 8 },
    tekst: 'Bryter stein. +1 for hver ås- eller fjellrute ved siden av.',
  },
  fiskebu: {
    navn: 'Fiskebu', ikon: '🎣', paa: [T.STRAND, T.GRESS], kanBygges: true,
    ravare: 'fisk', grunn: 1, nabo: { terreng: [T.VANN], pr: 1 },
    krav: { naboTerreng: T.VANN, tekst: 'Må stå ved vann.' },
    kost: { tre: 5, mynter: 6 },
    tekst: 'Fisker i vannet. +1 for hver vannrute ved siden av.',
  },
  jakthytte: {
    navn: 'Jakthytte', ikon: '🏹', paa: [T.GRESS, T.SKOG], kanBygges: true,
    ravare: 'kjott', grunn: 0, nabo: { dyr: true, pr: 2 },
    krav: { dyrRundt: true, tekst: 'Må stå rett ved et dyr.' },
    kost: { tre: 6, korn: 3, mynter: 6 },
    tekst: 'Jegerne skaffer kjøtt. +2 for hvert dyr i rutene rundt.',
  },
  gruve: {
    navn: 'Gruve', ikon: '⛓️', paa: [T.FJELL], paaOverlegg: 'malm', kanBygges: true,
    ravare: 'jern', grunn: 2, nabo: { terreng: [T.FJELL], pr: 0 },
    kost: { tre: 10, stein: 6, mynter: 12 },
    tekst: 'Henter jernmalm ut av fjellet.',
  },
  sagbruk: {
    navn: 'Sagbruk', ikon: '🪚', paa: [T.GRESS, T.SKOG], kanBygges: true,
    ravare: 'tre', grunn: 0, nabo: { bygg: 'hogstbu', pr: 3 },
    krav: { naboBygg: 'hogstbu', tekst: 'Må stå ved siden av en hogstbu.' },
    kost: { tre: 8, stein: 4, jern: 2, mynter: 10 },
    tekst: 'Sager tømmer fra hogstbuene rundt. +3 tre for hver hogstbu ved siden av.',
  },
  molle: {
    navn: 'Mølle', ikon: '🌬️', paa: [T.GRESS], kanBygges: true,
    ravare: 'korn', grunn: 0, nabo: { bygg: 'gard', pr: 3 },
    krav: { naboBygg: 'gard', tekst: 'Må stå ved siden av en gård.' },
    kost: { tre: 8, stein: 6, jern: 1, mynter: 10 },
    tekst: 'Maler kornet fra gårdene rundt. +3 korn for hver gård ved siden av.',
  },
};

/** Hvert nytt bygg av samme type blir litt dyrere. */
export const BYGG_KOSTVEKST = 1.25;

/** Nivåer: produksjonen ganges med «gang». Kostnaden vokser med antall oppgraderinger gjort. */
export const NIVAA = {
  2: { gang: 2, kost: { stein: 4, tre: 5, korn: 5 } },
  3: { gang: 3, kost: { stein: 12, tre: 12, korn: 12, jern: 3, mynter: 20 } },
};
export const OPPGRADER_KOSTVEKST = 1.15;
export const MAKS_NIVAA = 3;

/** Salgspriser i leiren (mynter per enhet). Landsbyene betaler bedre (se MARKED). */
export const PRIS = { tre: 1, korn: 1, stein: 2, fisk: 1, kjott: 2, jern: 3 };

/** Funn ved avdekking. */
export const FUNN = {
  skatt: { grunn: 15, perTidligere: 5 }, // mynter
  baer: { korn: 4 },
};

// ---------------------------------------------------------------------------
// Fase 2: veier, handel og landsbyer
// ---------------------------------------------------------------------------

/**
 * Veier. Nye veier er alltid trevei; en trevei kan gjøres om til steinvei.
 * Over vann blir veien en bru (dyrere). Fjell kan ikke ha vei (tunneler kommer senere).
 */
export const VEI = {
  tre: { navn: 'Trevei', ikon: '🛤️', kost: { tre: 2 }, bruKost: { tre: 6 } },
  stein: { navn: 'Steinvei', ikon: '🧱', kost: { stein: 2 }, bruKost: { stein: 5 } }, // oppgradering fra tre
};

/**
 * Handelsrute mellom to steder (landsbyer eller leiren) bundet sammen av vei:
 *   mynter per dag = (størrelse A + størrelse B) × (1 + andel steinvei på veien) + ⌊lengde / perLengde⌋
 */
export const HANDEL = { perLengde: 5, leirStorrelse: 1 };

/**
 * Landsbyer vokser når de får mat. vekst[n] = mat som trengs for å gå fra størrelse n til n+1.
 * Ulike matvarer er verdt ulikt mye, og å gi en annen mat enn sist gir bonus (variasjon er sunt!).
 */
export const LANDSBY = {
  maksStorrelse: 5,
  vekst: { 1: 20, 2: 40, 3: 80, 4: 160 },
  leveranse: 10, // enheter per trykk på «Gi mat»
  matverdi: { korn: 1, fisk: 1.5, kjott: 2 },
  variasjonsbonus: 0.5,
};

/**
 * Oppdrag: hver landsby som er koblet til leiren ber om en vare av gangen.
 * Antall = grunn + perStorrelse × størrelse. Belønning = antall × markedspris × belonningsfaktor,
 * pluss litt mat så landsbyen vokser. Etter et fullført oppdrag går det pauseDager før neste kommer.
 */
export const OPPDRAG = { grunn: 8, perStorrelse: 4, belonningsfaktor: 1.5, matAndel: 1, pauseDager: 1 };

/**
 * Marked i landsbyene (bare når landsbyen er koblet til leiren med vei).
 * Hver landsby kjøper to av varene. Prisen synker litt for hver vare du selger,
 * og henter seg inn igjen over natta.
 */
export const MARKED = {
  pris: { tre: 2, korn: 2, stein: 4, fisk: 3, kjott: 4, jern: 6 },
  fallPerVare: 0.97,
  minFaktor: 0.4,
  gjenopprettingPerDag: 0.25, // andel av avstanden opp til full pris som hentes inn hver natt
};
