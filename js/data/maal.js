// Mål som gir retning i sandkassen. De vises tre om gangen, i rekkefølge; de tre
// synlige kan fullføres i hvilken som helst rekkefølge. Et mål som allerede er
// oppnådd når det dukker opp, fullføres ved neste handling. Belønningen kommer med en gang.

const sumBygg = (s, type) => [...s.bygg.values()].filter((b) => !type || b.type === type).length;
const hoyestNivaa = (s) => Math.max(0, ...[...s.bygg.values()].filter((b) => b.type !== 'leir').map((b) => b.nivaa));

export const MAAL = [
  { id: 'avdekk5',   tekst: 'Avdekk 5 nye ruter',          maal: 5,   verdi: (s) => s.stat.avdekket,      belonning: { mynter: 6 } },
  { id: 'hogstbu1',  tekst: 'Bygg en hogstbu i skogen',     maal: 1,   verdi: (s) => sumBygg(s, 'hogstbu'), belonning: { tre: 5 } },
  { id: 'gard1',     tekst: 'Bygg en gård på enga',         maal: 1,   verdi: (s) => sumBygg(s, 'gard'),    belonning: { korn: 5 } },
  { id: 'dag3',      tekst: 'Trykk «Ny dag» 3 ganger',      maal: 3,   verdi: (s) => s.stat.dager,         belonning: { mynter: 8 } },
  { id: 'selg10',    tekst: 'Selg 10 varer i leiren',       maal: 10,  verdi: (s) => s.stat.solgt,         belonning: { mynter: 5 } },
  { id: 'stein1',    tekst: 'Bygg et steinbrudd',           maal: 1,   verdi: (s) => sumBygg(s, 'steinbrudd'), belonning: { stein: 4 } },
  { id: 'skatt1',    tekst: 'Finn en skatt i tåka',         maal: 1,   verdi: (s) => s.stat.skatter,       belonning: { mynter: 10 } },
  { id: 'gard2nabo', tekst: 'Ha to gårder ved siden av hverandre', maal: 1, verdi: (s) => s.stat.gardNabo, belonning: { tre: 8 } },
  { id: 'landsby1',  tekst: 'Finn en landsby',              maal: 1,   verdi: (s) => s.stat.landsbyer,     belonning: { mynter: 15 } },
  { id: 'vei1',      tekst: 'Bygg en vei (trykk på en rute du ser)', maal: 1, verdi: (s) => s.stat.veier,     belonning: { tre: 6 } },
  { id: 'koble1',    tekst: 'Koble en landsby til leiren med vei', maal: 1, verdi: (s) => s.stat.kobletLandsbyer, belonning: { mynter: 20 } },
  { id: 'niva2',     tekst: 'Oppgrader et bygg til nivå 2', maal: 2,   verdi: (s) => hoyestNivaa(s),       belonning: { korn: 10 } },
  { id: 'handel30',  tekst: 'Tjen 30 mynter på handel',     maal: 30,  verdi: (s) => s.stat.handel,        belonning: { korn: 10 } },
  { id: 'vekst2',    tekst: 'Gi mat så en landsby vokser',  maal: 2,   verdi: (s) => s.stat.storsteLandsby, belonning: { mynter: 20 } },
  { id: 'fiskebu1',  tekst: 'Bygg en fiskebu ved vannet',   maal: 1,   verdi: (s) => sumBygg(s, 'fiskebu'), belonning: { mynter: 15 } },
  { id: 'oppdrag1',  tekst: 'Fullfør et oppdrag fra en landsby', maal: 1, verdi: (s) => s.stat.oppdrag,     belonning: { korn: 15 } },
  { id: 'avdekk40',  tekst: 'Avdekk 40 ruter',              maal: 40,  verdi: (s) => s.stat.avdekket,      belonning: { mynter: 25 } },
  { id: 'bygg6',     tekst: 'Ha 6 bygg',                    maal: 6,   verdi: (s) => sumBygg(s) - 1,       belonning: { stein: 10 } },
  { id: 'steinvei1', tekst: 'Gjør en vei om til steinvei',  maal: 1,   verdi: (s) => s.stat.steinveier,    belonning: { stein: 8 } },
  { id: 'bru1',      tekst: 'Bygg en bru over vann',        maal: 1,   verdi: (s) => s.stat.broer,         belonning: { tre: 15 } },
  { id: 'jakt1',     tekst: 'Bygg en jakthytte ved et dyr', maal: 1,   verdi: (s) => sumBygg(s, 'jakthytte'), belonning: { tre: 10 } },
  { id: 'gruve1',    tekst: 'Bygg en gruve på jernmalm',    maal: 1,   verdi: (s) => sumBygg(s, 'gruve'),   belonning: { stein: 10 } },
  { id: 'tjen200',   tekst: 'Tjen 200 mynter totalt',       maal: 200, verdi: (s) => s.stat.tjent,         belonning: { tre: 20 } },
  { id: 'landsby3',  tekst: 'Finn 3 landsbyer',             maal: 3,   verdi: (s) => s.stat.landsbyer,     belonning: { mynter: 40 } },
  { id: 'koble3',    tekst: 'Koble 3 landsbyer til leiren', maal: 3,   verdi: (s) => s.stat.kobletLandsbyer, belonning: { mynter: 60 } },
  { id: 'vekst3',    tekst: 'Få en landsby til størrelse 3', maal: 3,  verdi: (s) => s.stat.storsteLandsby, belonning: { stein: 15 } },
  { id: 'mat3',      tekst: 'Gi landsbyer korn, fisk og kjøtt', maal: 3, verdi: (s) => [1, 2, 4].filter((b) => s.stat.matTyper & b).length, belonning: { mynter: 40 } },
  { id: 'sagbruk1',  tekst: 'Bygg et sagbruk ved en hogstbu', maal: 1, verdi: (s) => sumBygg(s, 'sagbruk'), belonning: { jern: 3 } },
  { id: 'molle1',    tekst: 'Bygg en mølle ved gårdene',    maal: 1,   verdi: (s) => sumBygg(s, 'molle'),   belonning: { jern: 3 } },
  { id: 'niva3',     tekst: 'Oppgrader et bygg til nivå 3', maal: 3,   verdi: (s) => hoyestNivaa(s),       belonning: { mynter: 50 } },
  { id: 'avdekk100', tekst: 'Avdekk 100 ruter',             maal: 100, verdi: (s) => s.stat.avdekket,      belonning: { mynter: 60 } },
  { id: 'bygg12',    tekst: 'Ha 12 bygg',                   maal: 12,  verdi: (s) => sumBygg(s) - 1,       belonning: { stein: 25 } },
  { id: 'skatt5',    tekst: 'Finn 5 skatter',               maal: 5,   verdi: (s) => s.stat.skatter,       belonning: { mynter: 80 } },
  { id: 'oppdrag5',  tekst: 'Fullfør 5 oppdrag',            maal: 5,   verdi: (s) => s.stat.oppdrag,       belonning: { mynter: 80 } },
  { id: 'tjen1000',  tekst: 'Tjen 1000 mynter totalt',      maal: 1000, verdi: (s) => s.stat.tjent,        belonning: { korn: 50 } },
  { id: 'handel500', tekst: 'Tjen 500 mynter på handel',    maal: 500, verdi: (s) => s.stat.handel,        belonning: { mynter: 100 } },
  { id: 'vekst5',    tekst: 'Få en landsby til størrelse 5', maal: 5,  verdi: (s) => s.stat.storsteLandsby, belonning: { mynter: 150 } },
  { id: 'oppdrag15', tekst: 'Fullfør 15 oppdrag',           maal: 15,  verdi: (s) => s.stat.oppdrag,       belonning: { mynter: 200 } },
  { id: 'avdekk200', tekst: 'Avdekk 200 ruter',             maal: 200, verdi: (s) => s.stat.avdekket,      belonning: { mynter: 150 } },
];

export const SYNLIGE_MAAL = 3;
