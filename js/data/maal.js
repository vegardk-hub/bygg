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
  { id: 'niva2',     tekst: 'Oppgrader et bygg til nivå 2', maal: 2,   verdi: (s) => hoyestNivaa(s),       belonning: { korn: 10 } },
  { id: 'avdekk40',  tekst: 'Avdekk 40 ruter',              maal: 40,  verdi: (s) => s.stat.avdekket,      belonning: { mynter: 25 } },
  { id: 'bygg6',     tekst: 'Ha 6 bygg',                    maal: 6,   verdi: (s) => sumBygg(s) - 1,       belonning: { stein: 10 } },
  { id: 'tjen200',   tekst: 'Tjen 200 mynter totalt',       maal: 200, verdi: (s) => s.stat.tjent,         belonning: { tre: 20 } },
  { id: 'landsby3',  tekst: 'Finn 3 landsbyer',             maal: 3,   verdi: (s) => s.stat.landsbyer,     belonning: { mynter: 40 } },
  { id: 'niva3',     tekst: 'Oppgrader et bygg til nivå 3', maal: 3,   verdi: (s) => hoyestNivaa(s),       belonning: { mynter: 50 } },
  { id: 'avdekk100', tekst: 'Avdekk 100 ruter',             maal: 100, verdi: (s) => s.stat.avdekket,      belonning: { mynter: 60 } },
  { id: 'bygg12',    tekst: 'Ha 12 bygg',                   maal: 12,  verdi: (s) => sumBygg(s) - 1,       belonning: { stein: 25 } },
  { id: 'skatt5',    tekst: 'Finn 5 skatter',               maal: 5,   verdi: (s) => s.stat.skatter,       belonning: { mynter: 80 } },
  { id: 'tjen1000',  tekst: 'Tjen 1000 mynter totalt',      maal: 1000, verdi: (s) => s.stat.tjent,        belonning: { korn: 50 } },
  { id: 'avdekk200', tekst: 'Avdekk 200 ruter',             maal: 200, verdi: (s) => s.stat.avdekket,      belonning: { mynter: 150 } },
];

export const SYNLIGE_MAAL = 3;
