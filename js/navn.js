// Navn på landsbyer: norske forledd + etterledd, valgt deterministisk fra
// verdens-seed og landsbyens plass, så samme landsby alltid heter det samme.

import { blandSeed, lagTilfeldig } from './rng.js';

const FORLEDD = [
  'Bjørk', 'Furu', 'Eike', 'Lyng', 'Sol', 'Måne', 'Reve', 'Ulve', 'Bjørne', 'Hval',
  'Stein', 'Myr', 'Linde', 'Rogne', 'Hassel', 'Elg', 'Ørne', 'Sjø', 'Fjell', 'Kvit',
  'Rød', 'Grøn', 'Blå', 'Gull', 'Sølv', 'Mose', 'Bekke', 'Hare', 'Ugle', 'Trane',
];
const ETTERLEDD = [
  'ly', 'vik', 'dal', 'heim', 'nes', 'berg', 'stad', 'haug', 'rud', 'voll',
  'mo', 'li', 'holt', 'sund', 'bakken', 'tun', 'lund', 'eng', 'vang', 'fjord',
];

/** Gir navn til alle landsbyene i en verden, uten duplikater. */
export function navngiLandsbyer(verden) {
  const tilf = lagTilfeldig(blandSeed(verden.seed, 'landsbynavn'));
  const brukt = new Set();
  const navn = new Map();
  const landsbyer = [...verden.overlegg].filter(([, o]) => o.type === 'landsby').map(([i]) => i).sort((a, b) => a - b);
  for (const i of landsbyer) {
    let n;
    do {
      n = tilf.velg(FORLEDD) + tilf.velg(ETTERLEDD);
    } while (brukt.has(n));
    brukt.add(n);
    navn.set(i, n);
  }
  return navn;
}
