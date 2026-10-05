// Tegner en generert verden til et lerret i kildeoppløsning: hver spillrute er
// 2×2 del-ruter à 16 px = 32 px. Fordi hver rute er minst to del-ruter bred,
// holder det med Kenneys 13-delers blob-sett for kanter (ingen 47-delers autotiling).
//
// Lag (nederst først): vann → sand (alt land) → gress (alt over strand) →
// stein (fjell) → pynt (trær, hauger, topper). Overlegg og bygg tegnes ikke inn
// i kartbildet, men oppå for hver ramme (de endrer seg mens man spiller).

import { T, OVERLEGG } from './data/terreng.js';
import {
  S, tegnDel, BLOB, VANN, HOYE_TRAER, SMA_TRAER, BUSKER, BAERBUSK,
  HAUG_BRUN, HAUG_MOSE, TOPP_GRA, TOPP_MOSE, MALM, SKATT, BYGG_SPRITE, LANDSBY_SPRITE,
} from './grafikk.js';
import { blandSeed, lagTilfeldig } from './rng.js';

export const RUTE = S * 2; // 32 px per spillrute i kildeoppløsning

/**
 * Tegner hele verdenen til et nytt lerret og returnerer det.
 * `utenPynt`: ruter der det står (eller skal stå) et bygg – der tegnes bare grunnen.
 */
export function tegnVerden(verden, ark, { fargekart = false, utenPynt = new Set() } = {}) {
  const { bredde: B, hoyde: H } = verden;
  const lerret = document.createElement('canvas');
  lerret.width = B * RUTE;
  lerret.height = H * RUTE;
  const ctx = lerret.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  if (fargekart) {
    tegnFargekart(ctx, verden);
    return lerret;
  }
  for (let i = 0; i < B * H; i++) tegnRute(ctx, verden, ark, i, utenPynt.has(i));
  return lerret;
}

/** Tegner (eller tegner på nytt) én rute i kartbildet. */
export function tegnRute(ctx, verden, ark, i, utenPynt = false) {
  const { bredde: B, hoyde: H, terreng } = verden;
  const x = i % B, y = Math.floor(i / B);
  const px = x * RUTE, py = y * RUTE;
  const t = (xx, yy) => (xx < 0 || yy < 0 || xx >= B || yy >= H ? T.VANN : terreng[yy * B + xx]);

  for (let s = 0; s < 4; s++) tegnDel(ctx, ark, VANN, px + (s % 2) * S, py + (s >> 1) * S);
  if (terreng[i] === T.VANN) {
    ctx.fillStyle = `rgba(20, 60, 120, ${(dybde(verden, i) * 0.45).toFixed(3)})`;
    ctx.fillRect(px, py, RUTE, RUTE);
    return;
  }
  tegnLagRute(ctx, ark, x, y, (a, b) => t(a, b) !== T.VANN, BLOB.sand);
  if (t(x, y) >= T.GRESS) tegnLagRute(ctx, ark, x, y, (a, b) => t(a, b) >= T.GRESS, BLOB.gress);
  if (t(x, y) === T.FJELL) tegnLagRute(ctx, ark, x, y, (a, b) => t(a, b) === T.FJELL, BLOB.stein);
  if (!utenPynt) tegnPynt(ctx, ark, verden, i, px, py);
}

/** Pynt med egen tilfeldighet per rute, så en rute kan tegnes på nytt og bli lik. */
function tegnPynt(ctx, ark, verden, i, px, py) {
  const tilf = lagTilfeldig(blandSeed(verden.seed, verden.forsok, 'pynt', i));
  const harOverlegg = verden.overlegg.has(i);
  switch (verden.terreng[i]) {
    case T.SKOG: tegnSkog(ctx, ark, px, py, tilf, harOverlegg); break;
    case T.AAS: tegnHauger(ctx, ark, px, py, tilf, HAUG_BRUN, HAUG_MOSE, harOverlegg); break;
    case T.FJELL: tegnHauger(ctx, ark, px, py, tilf, TOPP_GRA, TOPP_MOSE, harOverlegg, 4); break;
    case T.GRESS:
      if (!harOverlegg && tilf.sjanse(0.12)) tegnDel(ctx, ark, tilf.velg(BUSKER), px + tilf.heltall(0, 1) * S, py + tilf.heltall(0, 1) * S);
      break;
  }
}

/** Ett terrenglag for én rute: hver del-rute ser bare på de tre naboene i sitt hjørne. */
function tegnLagRute(ctx, ark, x, y, med, sett) {
  const n = med(x, y - 1), s = med(x, y + 1), v = med(x - 1, y), o = med(x + 1, y);
  const px = x * RUTE, py = y * RUTE;
  tegnDel(ctx, ark, velgDel(n, v, med(x - 1, y - 1), 'T', 'L', 'TL', 'iTL', sett), px, py);
  tegnDel(ctx, ark, velgDel(n, o, med(x + 1, y - 1), 'T', 'R', 'TR', 'iTR', sett), px + S, py);
  tegnDel(ctx, ark, velgDel(s, v, med(x - 1, y + 1), 'B', 'L', 'BL', 'iBL', sett), px, py + S);
  tegnDel(ctx, ark, velgDel(s, o, med(x + 1, y + 1), 'B', 'R', 'BR', 'iBR', sett), px + S, py + S);
}

function velgDel(loddrett, vannrett, diagonal, kantLoddrett, kantVannrett, ytre, indre, sett) {
  if (!loddrett && !vannrett) return sett[ytre];
  if (!loddrett) return sett[kantLoddrett];
  if (!vannrett) return sett[kantVannrett];
  if (!diagonal) return sett[indre];
  return sett.C;
}

/** 0 = grunt, 1 = dypest vann i verdenen. Beregnes én gang per verden. */
function dybde(verden, i) {
  if (!verden._vannSpenn) {
    let min = Infinity, maks = -Infinity;
    for (let j = 0; j < verden.terreng.length; j++) {
      if (verden.terreng[j] !== T.VANN) continue;
      min = Math.min(min, verden.hoydeKart[j]);
      maks = Math.max(maks, verden.hoydeKart[j]);
    }
    verden._vannSpenn = { min, maks };
  }
  const { min, maks } = verden._vannSpenn;
  return 1 - (verden.hoydeKart[i] - min) / (maks - min || 1);
}

function tegnSkog(ctx, ark, px, py, tilf, harOverlegg) {
  const arter = [HOYE_TRAER.morkGran, HOYE_TRAER.lysGran, HOYE_TRAER.morkRund, HOYE_TRAER.gronnRund,
    HOYE_TRAER.morkGran, tilf.sjanse(0.15) ? HOYE_TRAER.hostRund : HOYE_TRAER.lysGran];
  if (harOverlegg) {
    // Gi plass til overlegget: bare et lite tre i øvre hjørne.
    tegnDel(ctx, ark, tilf.velg(SMA_TRAER), px, py);
    return;
  }
  for (let kol = 0; kol < 2; kol++) {
    const art = tilf.velg(arter);
    tegnDel(ctx, ark, [art, 10], px + kol * S, py);
    tegnDel(ctx, ark, [art, 11], px + kol * S, py + S);
  }
}

function tegnHauger(ctx, ark, px, py, tilf, vanlig, mose, harOverlegg, antall = 3) {
  const plasser = tilf.stokk([[0, 0], [1, 0], [0, 1], [1, 1]]);
  const n = harOverlegg ? 1 : antall;
  for (let k = 0; k < n; k++) {
    const [dx, dy] = plasser[k];
    const del = tilf.sjanse(0.3) ? tilf.velg(mose) : tilf.velg(vanlig);
    tegnDel(ctx, ark, del, px + dx * S, py + dy * S);
  }
}

/** Tegner en sprite-komposisjon: liste av [dx, dy, [kol, rad]] i del-ruter fra rutens hjørne. */
export function tegnSprite(ctx, ark, deler, px, py) {
  for (const [dx, dy, del] of deler) tegnDel(ctx, ark, del, px + dx * S, py + dy * S);
}

/** Overlegg (dyr, bær, malm, skatt, landsby) på ruta med hjørne (px, py). */
export function tegnOverlegg(ctx, ark, o, px, py) {
  switch (o.type) {
    case 'landsby': tegnSprite(ctx, ark, LANDSBY_SPRITE, px, py); break;
    case 'baer': tegnDel(ctx, ark, BAERBUSK, px + S / 2, py + S / 2); break;
    case 'malm': tegnDel(ctx, ark, MALM, px + S / 2, py + S); break;
    case 'skatt': tegnDel(ctx, ark, SKATT, px + S / 2, py + S / 2); break;
    case 'dyr':
      // Plassholder: Kenney-arket har ingen dyr. Emoji tegnes lite i kildeoppløsning,
      // så den skaleres opp med samme pikselpreg som resten.
      ctx.save();
      ctx.font = '18px serif';
      ctx.fillStyle = '#000'; // alfa arves av emoji – må være 1
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(o.art === 'hjort' ? '🦌' : '🐑', px + RUTE / 2, py + RUTE / 2 + 1);
      ctx.restore();
      break;
  }
}

/** Et bygg med nivåmerke. */
export function tegnBygg(ctx, ark, b, px, py) {
  tegnSprite(ctx, ark, BYGG_SPRITE[b.type], px, py);
  if (b.nivaa > 1) {
    ctx.save();
    ctx.fillStyle = b.nivaa >= 3 ? '#e0a030' : '#f6f1e4';
    ctx.strokeStyle = '#5a3d1e';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(px + RUTE - 6, py + 6, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#5a3d1e';
    ctx.font = 'bold 8px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(b.nivaa), px + RUTE - 6, py + 6.5);
    ctx.restore();
  }
}

/** Overlegg tegnet rett inn i et kartbilde (kartverkstedet, der alt vises på en gang). */
export function tegnAlleOverlegg(lerret, verden, ark) {
  const ctx = lerret.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const sortert = [...verden.overlegg].sort((a, b) => a[0] - b[0]);
  for (const [i, o] of sortert) {
    tegnOverlegg(ctx, ark, o, (i % verden.bredde) * RUTE, Math.floor(i / verden.bredde) * RUTE);
  }
}

function tegnFargekart(ctx, verden) {
  const { bredde: B, hoyde: H, terreng, overlegg } = verden;
  const farger = ['#4fb3d9', '#ecdcae', '#8cc63f', '#2f8a4a', '#b08a5a', '#9aa3ab'];
  for (let i = 0; i < B * H; i++) {
    ctx.fillStyle = farger[terreng[i]];
    ctx.fillRect((i % B) * RUTE, Math.floor(i / B) * RUTE, RUTE, RUTE);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '20px serif';
  for (const [i, o] of overlegg) {
    ctx.fillText(OVERLEGG[o.type].ikon, (i % B) * RUTE + RUTE / 2, Math.floor(i / B) * RUTE + RUTE / 2 + 1);
  }
}
