// Rutetyper, overlegg og hvor stor andel av kartet hver type skal ha.
// Andelene styrer kartgeneratoren (kvantiler), så alle verdener får omtrent
// samme fordeling uansett seed – viktig for at økonomien skal være forutsigbar.

export const T = {
  VANN: 0,
  STRAND: 1,
  GRESS: 2,
  SKOG: 3,
  AAS: 4,
  FJELL: 5,
};

export const TERRENG = [
  { id: T.VANN,   navn: 'Vann',   ikon: '🌊', farge: '#4fb3d9', gir: 'fisk' },
  { id: T.STRAND, navn: 'Strand', ikon: '🏖️', farge: '#ecdcae', gir: null },
  { id: T.GRESS,  navn: 'Eng',    ikon: '🌱', farge: '#8cc63f', gir: 'korn' },
  { id: T.SKOG,   navn: 'Skog',   ikon: '🌲', farge: '#2f8a4a', gir: 'tre' },
  { id: T.AAS,    navn: 'Ås',     ikon: '⛰️', farge: '#b08a5a', gir: 'stein' },
  { id: T.FJELL,  navn: 'Fjell',  ikon: '🏔️', farge: '#9aa3ab', gir: 'stein' },
];

/** Ønsket andel av hele kartet. Eng får resten av landet etter skog. */
export const ANDEL = {
  vann: 0.28,
  strand: 0.07,
  aas: 0.08,
  fjell: 0.07,
  skogAvMidtland: 0.42, // av landet som verken er strand, ås eller fjell
};

export const OVERLEGG = {
  landsby: { navn: 'Landsby',     ikon: '🏘️', farge: '#d9534f' },
  dyr:     { navn: 'Dyr',         ikon: '🦌', farge: '#8b5a2b' },
  baer:    { navn: 'Bærbusk',     ikon: '🫐', farge: '#7b4fb3' },
  malm:    { navn: 'Jernmalm',    ikon: '⛓️', farge: '#55606b' },
  skatt:   { navn: 'Ruin/skatt',  ikon: '💰', farge: '#e0b020' },
};

/** Regler for plassering av overlegg. «per100» = antall per 100 landruter. */
export const PLASSERING = {
  landsby: { per100: 1.0, minAvstand: 6, paa: [T.GRESS] },
  dyr:     { per100: 4.0, minAvstand: 2.5, paa: [T.GRESS, T.SKOG] },
  baer:    { per100: 3.0, minAvstand: 2, paa: [T.GRESS, T.SKOG] },
  malm:    { andelAvFjell: 0.2, minAntall: 2, minAvstand: 2, paa: [T.FJELL] },
  skatt:   { per100: 1.5, minAntall: 2, minAvstand: 5, paa: [T.GRESS, T.SKOG, T.STRAND, T.AAS] },
};

/** Krav til startområdet, så ingen verden får en urettferdig start. */
export const START = {
  radius: 3,          // «i nærheten» = innenfor denne Chebyshev-avstanden
  minSkog: 2,
  minVann: 1,
  minGress: 3,
  landsbyAvstand: [4, 7], // minst én landsby innen dette avstandsintervallet
  steinInnen: 6,      // ås eller fjell innen denne avstanden (ønskelig, gir poeng)
  avdekketRadius: 2,  // hvor mye som er synlig ved start
};
