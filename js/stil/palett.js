// Farger for brettstilen. Bunnfargene for eng og grått fjell er målt i
// inspirasjonsbildet (bildetolker: midt/kant-median), resten er valgt for å
// passe sammen med dem – litt varmere og koseligere enn forbildet.

export const BUNN = {
  eng:    { midt: '#86aa5f', kant: '#5f7647', flak: ['#9cc070', '#73974f'], tust: '#4d6c38' },
  skog:   { midt: '#7a9e57', kant: '#55703f', flak: ['#8db467', '#678a49'], tust: '#456334' },
  aas:    { midt: '#a49a6c', kant: '#76704b', flak: ['#b6ad7e', '#8c8458'], tust: '#6b6a3e' },
  fjell:  { midt: '#6b7189', kant: '#454257', flak: ['#7d839b', '#585d74'], tust: null },
  vann:   { midt: '#4b93bd', kant: '#2c5f86', flak: ['#5fa6cf', '#3f80aa'], tust: null },
  strand: { midt: '#e2cf98', kant: '#bba46e', flak: ['#efe0ae', '#cdb985'], tust: '#9aa35a' },
  front:  { midt: '#252c3a', kant: '#161b25', flak: ['#2c3443', '#1f2531'], tust: null },
};

export const BAKGRUNN = '#010101';  // målt
export const KLAMMER = '#faf2db';   // målt (valgt-rute-hjørner)

export const FIGUR = {
  stamme: '#7a5236',
  gran: ['#4e7d35', '#3d6a2c'],        // [lys side, mørk side]
  granMork: ['#3f6b3a', '#2d5230'],
  lov: '#6f9a3f',
  lovHost: '#c98a35',
  stein: '#9aa1ae',
  steinMork: '#7d7f8a',
  sno: ['#f4f6f8', '#cdd5df'],
  fjell: ['#9ca2b3', '#626879'],
  haug: ['#9c9161', '#6f6843'],
  treVegg: ['#d0a06a', '#9e6d42'],     // [lys vegg, mørk vegg]
  pussVegg: ['#efe3c8', '#bfae8c'],
  takRod: ['#c0614a', '#8e3d2c'],
  takBla: ['#5a7aa6', '#3d5677'],
  takGronn: ['#6f9a52', '#4d6f38'],
  takMork: ['#6d5446', '#4a372d'],
  dor: '#5b3a24',
  vindu: '#f3d77a',
  jord: '#8a5a3a',
  korn: ['#e2c25a', '#c9a23f'],
  spire: ['#8fc25a', '#5e8f3a'],
  flamme: ['#ffd54a', '#f0892f'],
  ull: '#f3f0e7',
  hjort: ['#b07a48', '#7f5432'],
  baer: ['#d0453f', '#6a4fb3'],
  gull: ['#ffd23f', '#d9a520'],
  malm: ['#d98a4a', '#b8c3cf'],
  skygge: 'rgba(20, 25, 15, 0.22)',
};
