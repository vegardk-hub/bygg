// Prøveark for brettstilen: tegner små brett og gallerier med alle rutetyper,
// veier og jernbane, så stilen kan vurderes før spillet bygges om.

import { tegnKort, tegnUkjent, tegnKlammer, TERRENGTYPER, BYGGTYPER, OVERLEGGTYPER } from './stil/ruter.js';
import { KLAMMER, BAKGRUNN } from './stil/palett.js';
import { lagTilfeldig, blandSeed } from './rng.js';

const $ = (id) => document.getElementById(id);
let seed = 1;

const NAVN = {
  eng: 'Eng', skog: 'Skog', aas: 'Ås', fjell: 'Fjell', vann: 'Vann', strand: 'Strand',
  leir: 'Leiren', hogstbu: 'Hogstbu', gard: 'Gård', steinbrudd: 'Steinbrudd', landsby: 'Landsby',
  sau: 'Sau', hjort: 'Hjort', baer: 'Bærbusk', malm: 'Jernmalm', skatt: 'Skatt',
};

// ---------------------------------------------------------------------------
// Brett 1: terreng og bygg. . = ingenting (svart), ? = kan avdekkes.
// ---------------------------------------------------------------------------
const TEGN1 = {
  '.': null, '?': { ukjent: true },
  F: { terreng: 'fjell' }, M: { terreng: 'fjell', overlegg: 'malm' }, A: { terreng: 'aas' },
  T: { terreng: 'skog' }, E: { terreng: 'eng' }, V: { terreng: 'vann' }, S: { terreng: 'strand' },
  L: { terreng: 'eng', bygg: 'leir' }, H: { terreng: 'skog', bygg: 'hogstbu' }, G: { terreng: 'eng', bygg: 'gard', valgt: true },
  g: { terreng: 'eng', bygg: 'gard', nivaa: 3 }, K: { terreng: 'aas', bygg: 'steinbrudd' }, B: { terreng: 'eng', bygg: 'landsby' },
  s: { terreng: 'eng', overlegg: 'sau' }, h: { terreng: 'skog', overlegg: 'hjort' }, b: { terreng: 'eng', overlegg: 'baer' },
  x: { terreng: 'strand', overlegg: 'skatt' },
};
const KART1 = [
  '...???...',
  '..?FMF?..',
  '.?TTAKS?.',
  '?hTHEExV?',
  '?TEsLGVV?',
  '.?EbgEBS?',
  '..?AEE?..',
  '...???...',
].map((linje) => [...linje].map((t) => TEGN1[t] && { ...TEGN1[t] }));

// ---------------------------------------------------------------------------
// Brett 2: vei og jernbane. Terreng først, så legges veier og bane på.
// ---------------------------------------------------------------------------
function lagKart2() {
  const T = { T: 'skog', E: 'eng', F: 'fjell', A: 'aas', V: 'vann', S: 'strand' };
  const terreng = [
    'TTEEFFAE',
    'TLETTEEE',
    'EEETVVEB',
    'AEEEVEEE',
    'EEEEVEAE',
    'TTEEVEEB',
    'EEEEVEEE',
  ];
  const celler = terreng.map((linje) => [...linje].map((t) => {
    if (t === 'L') return { terreng: 'eng', bygg: 'leir' };
    if (t === 'B') return { terreng: 'eng', bygg: 'landsby' };
    return { terreng: T[t] };
  }));
  const vei = (x, y, type, retninger) => { const c = celler[y][x]; c.vei = [...(c.vei ?? []), { type, retninger }]; };
  const bane = (x, y, retninger) => { celler[y][x].bane = { retninger }; };
  // Trevei fra leiren (1,1) østover gjennom skogen og ned til landsbyen (7,2).
  vei(1, 1, 'tre', 'E');
  for (const x of [2, 3, 4, 5, 6]) vei(x, 1, 'tre', 'EW');
  vei(7, 1, 'tre', 'WS');
  vei(7, 2, 'tre', 'N');
  // Steinvei fra landsbyen sørover til neste landsby, med en gren vestover over elva.
  vei(7, 2, 'stein', 'S');
  vei(7, 3, 'stein', 'NSW');
  vei(7, 4, 'stein', 'NS');
  vei(7, 5, 'stein', 'N');
  for (const x of [6, 5, 4]) vei(x, 3, 'stein', 'EW');
  vei(3, 3, 'stein', 'ES');
  vei(3, 4, 'stein', 'NS');
  vei(3, 5, 'stein', 'NS');
  vei(3, 6, 'stein', 'NS');
  // Jernbane ned langs vestkanten, sving, over elva og inn til landsbyen (7,5).
  for (const y of [0, 1, 2, 3, 4]) bane(0, y, 'NS');
  bane(0, 5, 'NE');
  for (const x of [1, 2, 3, 4, 5, 6]) bane(x, 5, 'EW');
  bane(7, 5, 'W');
  celler[3][7].valgt = true;
  // Ring av «?» rundt brettet.
  const B = celler[0].length, H = celler.length;
  const ut = [];
  for (let y = -1; y <= H; y++) {
    const rad = [];
    for (let x = -1; x <= B; x++) {
      const inne = x >= 0 && y >= 0 && x < B && y < H;
      const hjorne = (x === -1 || x === B) && (y === -1 || y === H);
      rad.push(inne ? celler[y][x] : hjorne ? null : { ukjent: true });
    }
    ut.push(rad);
  }
  return ut;
}

/** Tegner ett kort til et eget lerret i full oppløsning (skarpt på retina). */
function kort(innhold, S, tilfSeed) {
  const dpr = window.devicePixelRatio || 1;
  const c = document.createElement('canvas');
  c.width = c.height = Math.round(S * dpr);
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  const tilf = lagTilfeldig(tilfSeed);
  if (innhold.ukjent) tegnUkjent(ctx, S, tilf);
  else tegnKort(ctx, S, tilf, innhold);
  return c;
}

function tegnBrett(lerretId, celler, S, nr) {
  const dpr = window.devicePixelRatio || 1;
  const fuge = Math.max(2, Math.round(S * 0.015)); // målt: ca. 1,5 % av ruta
  const pitch = S + fuge;
  const marg = S * 0.3;
  const kol = celler[0].length, rad = celler.length;
  const lerret = $(lerretId);
  const bredde = kol * pitch + 2 * marg, hoyde = rad * pitch + 2 * marg;
  lerret.width = Math.round(bredde * dpr);
  lerret.height = Math.round(hoyde * dpr);
  lerret.style.width = `${bredde}px`;
  lerret.style.height = `${hoyde}px`;
  const ctx = lerret.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.fillStyle = BAKGRUNN;
  ctx.fillRect(0, 0, bredde, hoyde);

  // Røyk rundt kanten av det kjente – myke, gråaktige skyer i mørket.
  const tilf = lagTilfeldig(blandSeed(seed, nr, 'royk'));
  celler.forEach((linje, y) => linje.forEach((c, x) => {
    if (!c?.ukjent) return;
    const cx = marg + x * pitch + S / 2, cy = marg + y * pitch + S / 2;
    for (let k = 0; k < 2; k++) {
      const r = S * (0.7 + tilf.tall() * 0.6);
      const ox = (tilf.tall() - 0.5) * S, oy = (tilf.tall() - 0.5) * S;
      const g = ctx.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, r);
      g.addColorStop(0, 'rgba(120, 125, 140, 0.10)');
      g.addColorStop(1, 'rgba(120, 125, 140, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx + ox - r, cy + oy - r, r * 2, r * 2);
    }
  }));

  let valgt = null;
  celler.forEach((linje, y) => linje.forEach((c, x) => {
    if (!c) return;
    const px = marg + x * pitch, py = marg + y * pitch;
    ctx.drawImage(kort(c, S, blandSeed(seed, nr, x, y)), px, py, S, S);
    if (c.valgt) valgt = [px, py];
  }));
  if (valgt) {
    ctx.save();
    ctx.translate(...valgt);
    tegnKlammer(ctx, S, KLAMMER);
    ctx.restore();
  }
}

function galleri(id, S, liste) {
  const g = $(id);
  g.innerHTML = '';
  liste.forEach(([innhold, tekst], k) => {
    const fig = document.createElement('figure');
    const c = kort(innhold, S, blandSeed(seed, id, tekst, k));
    c.style.width = c.style.height = `${S}px`;
    fig.append(c);
    const cap = document.createElement('figcaption');
    cap.textContent = tekst;
    fig.append(cap);
    g.append(fig);
  });
}

function terrengGalleri() {
  const liste = [];
  for (const t of TERRENGTYPER) for (let k = 0; k < 3; k++) liste.push([{ terreng: t }, NAVN[t]]);
  for (const b of BYGGTYPER) liste.push([{ terreng: b === 'hogstbu' ? 'skog' : b === 'steinbrudd' ? 'aas' : 'eng', bygg: b }, NAVN[b]]);
  liste.push([{ terreng: 'eng', bygg: 'gard', nivaa: 2 }, 'Gård nivå 2']);
  liste.push([{ terreng: 'eng', bygg: 'gard', nivaa: 3 }, 'Gård nivå 3']);
  liste.push([{ terreng: 'skog', bygg: 'hogstbu', nivaa: 3 }, 'Hogstbu nivå 3']);
  for (const o of OVERLEGGTYPER) {
    const t = o === 'hjort' ? 'skog' : o === 'malm' ? 'fjell' : o === 'skatt' ? 'strand' : 'eng';
    liste.push([{ terreng: t, overlegg: o }, NAVN[o]]);
  }
  liste.push([{ ukjent: true }, 'Kan avdekkes']);
  return liste;
}

function veiGalleri() {
  const v = (terreng, type, retninger, tekst) => [{ terreng, vei: { type, retninger } }, tekst];
  const b = (terreng, retninger, tekst) => [{ terreng, bane: { retninger } }, tekst];
  return [
    v('eng', 'tre', 'EW', 'Trevei – rett'),
    v('eng', 'tre', 'WS', 'Trevei – sving'),
    v('eng', 'tre', 'NEW', 'Trevei – T-kryss'),
    v('skog', 'tre', 'NS', 'Trevei – gjennom skog'),
    v('vann', 'tre', 'EW', 'Trevei – trebru'),
    v('eng', 'stein', 'NS', 'Steinvei – rett'),
    v('eng', 'stein', 'ES', 'Steinvei – sving'),
    v('eng', 'stein', 'NESW', 'Steinvei – kryss'),
    v('aas', 'stein', 'EW', 'Steinvei – over ås'),
    v('vann', 'stein', 'NS', 'Steinvei – steinbru'),
    b('eng', 'EW', 'Jernbane – rett'),
    b('eng', 'NE', 'Jernbane – sving'),
    b('skog', 'NS', 'Jernbane – gjennom skog'),
    b('vann', 'EW', 'Jernbane – jernbanebru'),
    b('eng', 'W', 'Jernbane – endestopp'),
    [{ terreng: 'eng', bane: { retninger: 'EW' }, vei: { type: 'stein', retninger: 'NS' } }, 'Planovergang'],
    [{ terreng: 'eng', bygg: 'landsby', vei: { type: 'stein', retninger: 'S' }, bane: { retninger: 'E' } }, 'Landsby med vei og bane'],
    [{ terreng: 'eng', bygg: 'leir', vei: { type: 'tre', retninger: 'E' } }, 'Leiren med vei'],
  ];
}

function tegnAlt() {
  const S = Number($('str').value);
  $('str-tall').textContent = `${S} px`;
  const t0 = performance.now();
  tegnBrett('brett', KART1, S, 1);
  tegnBrett('brett2', lagKart2(), S, 2);
  galleri('galleri2', 130, veiGalleri());
  galleri('galleri', 130, terrengGalleri());
  console.log(`Prøveark tegnet på ${Math.round(performance.now() - t0)} ms`);
}

$('ny').onclick = () => { seed++; tegnAlt(); };
$('str').oninput = tegnAlt;
tegnAlt();
