// 2D simplex-støy (etter Stefan Gustavsons offentlige referanseimplementasjon),
// seedet med vår egen PRNG så hver verden får sin egen støy. Skrevet selv i stedet
// for å hente et bibliotek, så spillet ikke har eksterne avhengigheter og virker offline.

import { mulberry32 } from './rng.js';

const GRAD = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1],
];
const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;

/** Lager en støyfunksjon støy(x, y) → omtrent [-1, 1]. */
export function lagSimplex(seed) {
  const r = mulberry32(seed);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  function hjorne(gi, x, y) {
    let t = 0.5 - x * x - y * y;
    if (t < 0) return 0;
    t *= t;
    const g = GRAD[gi];
    return t * t * (g[0] * x + g[1] * y);
  }

  return function stoy(xin, yin) {
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t);
    const y0 = yin - (j - t);
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;
    const ii = i & 255;
    const jj = j & 255;
    const n0 = hjorne(perm[ii + perm[jj]] & 7, x0, y0);
    const n1 = hjorne(perm[ii + i1 + perm[jj + j1]] & 7, x1, y1);
    const n2 = hjorne(perm[ii + 1 + perm[jj + 1]] & 7, x2, y2);
    return 70 * (n0 + n1 + n2);
  };
}

/** Fraktal støy: flere oktaver lagt oppå hverandre, normalisert til [0, 1]. */
export function lagFbm(seed, { oktaver = 4, utholdenhet = 0.5 } = {}) {
  const stoy = lagSimplex(seed);
  return function (x, y) {
    let sum = 0, amp = 1, frek = 1, maks = 0;
    for (let o = 0; o < oktaver; o++) {
      sum += amp * stoy(x * frek + o * 17.3, y * frek - o * 9.1);
      maks += amp;
      amp *= utholdenhet;
      frek *= 2;
    }
    return (sum / maks + 1) / 2;
  };
}
