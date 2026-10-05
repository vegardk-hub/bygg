// Alle tall som styrer økonomien, samlet ett sted så de er lette å justere.
// Endrer du noe her, kjør `node test/simuler.js` for å se hvordan de første
// dagene utvikler seg.

import { T } from './terreng.js';

export const RAVARER = {
  mynter: { navn: 'Mynter', ikon: '🪙' },
  tre:    { navn: 'Tre',    ikon: '🪵' },
  stein:  { navn: 'Stein',  ikon: '🪨' },
  korn:   { navn: 'Korn',   ikon: '🌾' },
};
export const RAVARE_REKKEFOLGE = ['mynter', 'tre', 'stein', 'korn'];

export const START_LAGER = { mynter: 15, tre: 10, stein: 0, korn: 5 };

/** Avdekking: grunnpris × vekst^(antall avdekket så langt). Vann er billigere. */
export const AVDEKK = { grunn: 2, vekst: 1.01, vannFaktor: 0.5 };

/**
 * Bygg. Produksjon per dag = (grunn + nabobonus) × nivå.
 * nabo.terreng: +pr for hver nabo (4 retninger) med en av disse terrengtypene.
 * nabo.bygg:    +pr for hver nabo med samme type bygg.
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
};

/** Hvert nytt bygg av samme type blir litt dyrere. */
export const BYGG_KOSTVEKST = 1.25;

/** Nivåer: produksjonen ganges med «gang». Kostnaden vokser med antall oppgraderinger gjort. */
export const NIVAA = {
  2: { gang: 2, kost: { stein: 4, tre: 5, korn: 5 } },
  3: { gang: 3, kost: { stein: 12, tre: 12, korn: 12, mynter: 20 } },
};
export const OPPGRADER_KOSTVEKST = 1.15;
export const MAKS_NIVAA = 3;

/** Salgspriser i leiren (mynter per enhet). Landsbyene betaler bedre (se MARKED). */
export const PRIS = { tre: 1, korn: 1, stein: 2 };

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

/** Landsbyer vokser når de får mat. vekst[n] = korn som trengs for å gå fra størrelse n til n+1. */
export const LANDSBY = {
  maksStorrelse: 5,
  vekst: { 1: 20, 2: 40, 3: 80, 4: 160 },
  leveranse: 10, // korn per trykk på «Gi mat»
};

/**
 * Marked i landsbyene (bare når landsbyen er koblet til leiren med vei).
 * Hver landsby kjøper to av varene. Prisen synker litt for hver vare du selger,
 * og henter seg inn igjen over natta.
 */
export const MARKED = {
  pris: { tre: 2, korn: 2, stein: 4 },
  fallPerVare: 0.97,
  minFaktor: 0.4,
  gjenopprettingPerDag: 0.25, // andel av avstanden opp til full pris som hentes inn hver natt
};
