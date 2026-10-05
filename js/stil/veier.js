// Veier og jernbane på brettrutene. En rute vet hvilke sider den er koblet til
// («NSØV» skrevet som N, S, E, W) og tegner en trasé fra kant til kant:
//  - to motsatte sider  → rett strekning
//  - to sider i vinkel  → myk sving (kvadratisk kurve)
//  - én side            → blindvei / endestopp inn mot midten
//  - tre–fire sider     → kryss fra midten og ut
// Trasé-midtlinjene samples som punkter med retning, så planker, brostein,
// sviller og skinner kan legges langs dem – også i svinger.

import { poly, klump, mork, lys } from './lavpoly.js';

const KANT = { N: [0.5, 0], S: [0.5, 1], E: [1, 0.5], W: [0, 0.5] };
const MOTSATT = { N: 'S', S: 'N', E: 'W', W: 'E' };

/** Midtlinjer for en rute koblet til sidene i `retninger` (f.eks. 'NS', 'WS', 'NEW'). */
export function stier(S, retninger) {
  const r = [...retninger];
  const ut = 0.02; // stikk litt ut i fugen så veien ser sammenhengende ut mellom rutene
  const kant = (d) => {
    const [x, y] = KANT[d];
    return [x * S + (x - 0.5) * 2 * ut * S, y * S + (y - 0.5) * 2 * ut * S];
  };
  const C = [S / 2, S / 2];
  const rett = (A, B) => ({
    punkt: (t) => [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t],
    retning: () => norm([B[0] - A[0], B[1] - A[1]]),
    lengde: Math.hypot(B[0] - A[0], B[1] - A[1]),
    tegn: (ctx) => { ctx.moveTo(...A); ctx.lineTo(...B); },
  });
  if (r.length === 2 && MOTSATT[r[0]] === r[1]) return [rett(kant(r[0]), kant(r[1]))];
  if (r.length === 2) {
    const A = kant(r[0]), B = kant(r[1]);
    return [{
      punkt: (t) => [(1 - t) ** 2 * A[0] + 2 * (1 - t) * t * C[0] + t * t * B[0], (1 - t) ** 2 * A[1] + 2 * (1 - t) * t * C[1] + t * t * B[1]],
      retning: (t) => norm([2 * (1 - t) * (C[0] - A[0]) + 2 * t * (B[0] - C[0]), 2 * (1 - t) * (C[1] - A[1]) + 2 * t * (B[1] - C[1])]),
      lengde: S * 0.8,
      tegn: (ctx) => { ctx.moveTo(...A); ctx.quadraticCurveTo(...C, ...B); },
    }];
  }
  return r.map((d) => rett(C, kant(d)));
}

function norm([x, y]) {
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
}

/** Går langs alle stiene med fast steg og kaller fn(x, y, dx, dy) – (dx, dy) er retningen. */
function langs(stiliste, steg, fn, forskyv = 0) {
  for (const sti of stiliste) {
    const n = Math.max(1, Math.round(sti.lengde / steg));
    for (let k = 0; k < n; k++) {
      const t = Math.min(1, (k + 0.5 + forskyv) / n);
      const [x, y] = sti.punkt(t);
      const [dx, dy] = sti.retning(t);
      fn(x, y, dx, dy, k);
    }
  }
}

function strek(ctx, stiliste, bredde, farge, kapp = 'butt') {
  ctx.beginPath();
  for (const sti of stiliste) sti.tegn(ctx);
  ctx.strokeStyle = farge;
  ctx.lineWidth = bredde;
  ctx.lineCap = kapp;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

/** Fyller midten der flere stier møtes, så krysset blir helt. */
function midtflekk(ctx, S, retninger, bredde, farge) {
  if (retninger.length === 2) return; // rett strekning eller sving trenger ingen flekk

  ctx.fillStyle = farge;
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, bredde / 2, 0, Math.PI * 2);
  ctx.fill();
}

/** Lager en «hold deg unna»-funksjon for pynt: sann hvis (x, y) med radius r treffer traseen. */
export function lagUnngaa(S, lag) {
  const punkter = [];
  for (const { retninger, halvbredde } of lag) {
    langs(stier(S, retninger), S * 0.04, (x, y) => punkter.push([x, y, halvbredde]));
  }
  return (x, y, r = 0) => punkter.some(([px, py, h]) => Math.hypot(px - x, py - y) < h + r + S * 0.03);
}

export const HALVBREDDE = { tre: 0.11, stein: 0.13, bane: 0.16 }; // brøk av ruta

// ---------------------------------------------------------------------------
// Vei av tre: plankevei
// ---------------------------------------------------------------------------
const PLANKER = ['#b9874f', '#a8784a', '#c49460', '#b07f4b'];
const STEIN = ['#b8b2a6', '#a9a397', '#c4bfb3', '#9d978b', '#b3ad9f'];

/** type: 'tre' | 'stein'. bru: tegnes som bru over vann (bare rette strekninger). */
export function tegnVei(ctx, S, tilf, type, retninger, { bru = false } = {}) {
  const st = stier(S, retninger);
  const b = S * HALVBREDDE[type] * 2;
  if (bru) bruUnder(ctx, S, st, b + S * 0.06, type === 'tre' ? '#5a3a22' : '#8f8a80');

  if (type === 'tre') {
    strek(ctx, st, b + S * 0.03, '#4e3420');                 // mørk kant
    strek(ctx, st, b, '#6e4a2c');                            // mellomrom mellom plankene
    midtflekk(ctx, S, retninger, b + S * 0.03, '#4e3420');
    midtflekk(ctx, S, retninger, b, '#6e4a2c');
    langs(st, b * 0.26, (x, y, dx, dy, k) => {
      const nx = -dy, ny = dx, h = b * 0.47, t = b * 0.1;
      const f = PLANKER[(k + Math.floor(tilf.tall() * 2)) % PLANKER.length];
      poly(ctx, [[x + nx * h - dx * t, y + ny * h - dy * t], [x + nx * h + dx * t, y + ny * h + dy * t],
        [x - nx * h + dx * t, y - ny * h + dy * t], [x - nx * h - dx * t, y - ny * h - dy * t]], f);
    });
  } else {
    strek(ctx, st, b + S * 0.04, '#5f5a52');                 // kantstein
    strek(ctx, st, b, '#7d776c');                            // fuger
    midtflekk(ctx, S, retninger, b + S * 0.04, '#5f5a52');
    midtflekk(ctx, S, retninger, b, '#7d776c');
    langs(st, b * 0.24, (x, y, dx, dy, k) => {
      const nx = -dy, ny = dx;
      const forskyv = k % 2 ? 0.17 : 0;
      for (const u of [-0.34, 0, 0.34]) {
        const v = u + forskyv * (u > 0 ? -1 : 1) * 0.5;
        if (Math.abs(v) > 0.38) continue;
        const cx = x + nx * b * v, cy = y + ny * b * v;
        poly(ctx, klump(tilf, cx, cy, b * 0.12, b * 0.1, 6, 0.15), tilf.velg(STEIN));
      }
    });
  }
  if (bru) rekkverk(ctx, S, st, b + S * 0.05, type === 'tre' ? '#5a3a22' : '#c9c4b8', type === 'stein');
}

// ---------------------------------------------------------------------------
// Jernbane
// ---------------------------------------------------------------------------
export function tegnBane(ctx, S, tilf, retninger, { bru = false, kryssVei = null, paaBygg = false } = {}) {
  const st = stier(S, retninger);
  const b = S * HALVBREDDE.bane * 2;
  if (bru) bruUnder(ctx, S, st, b + S * 0.04, '#4a4f5a');
  else {
    // Pukk (grus) under sporet
    strek(ctx, st, b, '#7b7368');
    strek(ctx, st, b * 0.82, '#958c7f');
    midtflekk(ctx, S, retninger, b, '#7b7368');
    langs(st, S * 0.03, (x, y, dx, dy) => {
      const nx = -dy, ny = dx, u = (tilf.tall() - 0.5) * b * 0.8;
      ctx.fillStyle = tilf.sjanse(0.5) ? '#a69d90' : '#6f685e';
      ctx.fillRect(x + nx * u - S * 0.006, y + ny * u - S * 0.006, S * 0.012, S * 0.012);
    });
  }
  // Planovergang: veien legges over pukken, skinnene ligger oppå veien.
  if (kryssVei) tegnVei(ctx, S, tilf, kryssVei.type, kryssVei.retninger);
  // Sviller
  if (!kryssVei) {
    langs(st, S * 0.075, (x, y, dx, dy) => {
      const nx = -dy, ny = dx, h = S * 0.13, t = S * 0.018;
      poly(ctx, [[x + nx * h - dx * t, y + ny * h - dy * t], [x + nx * h + dx * t, y + ny * h + dy * t],
        [x - nx * h + dx * t, y - ny * h + dy * t], [x - nx * h - dx * t, y - ny * h - dy * t]], bru ? '#5b4030' : '#6b4a30');
    });
  }
  // Skinner: to forskjøvne linjer langs hver sti
  for (const side of [-1, 1]) {
    for (const [bredde, farge] of [[S * 0.034, '#4d515a'], [S * 0.018, '#d3d8df']]) {
      ctx.beginPath();
      for (const sti of st) {
        const n = 24;
        for (let k = 0; k <= n; k++) {
          const t = k / n;
          const [x, y] = sti.punkt(t);
          const [dx, dy] = sti.retning(t);
          const px = x - dy * side * S * 0.065, py = y + dx * side * S * 0.065;
          if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
      }
      ctx.strokeStyle = farge;
      ctx.lineWidth = bredde;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
  }
  // Endestopp på blindspor
  if (retninger.length === 1 && !paaBygg) {
    const [x, y] = [S / 2, S / 2];
    poly(ctx, [[x - S * 0.12, y - S * 0.04], [x + S * 0.12, y - S * 0.04], [x + S * 0.12, y + S * 0.04], [x - S * 0.12, y + S * 0.04]], '#c0392b');
    ctx.fillStyle = '#fff';
    for (const u of [-0.06, 0.02]) ctx.fillRect(x + S * u, y - S * 0.04, S * 0.04, S * 0.08);
  }
  if (bru) rekkverk(ctx, S, st, b + S * 0.02, '#4a4f5a', false, true);
  if (kryssVei) krysskilt(ctx, S);
}

// ---------------------------------------------------------------------------
// Bru og pynt
// ---------------------------------------------------------------------------
function bruUnder(ctx, S, st, bredde, farge) {
  // Skygge på vannet, litt ned og til høyre
  ctx.save();
  ctx.translate(S * 0.03, S * 0.045);
  strek(ctx, st, bredde, 'rgba(10, 30, 50, 0.35)');
  ctx.restore();
  strek(ctx, st, bredde, farge);
}

function rekkverk(ctx, S, st, bredde, farge, mur = false, fagverk = false) {
  for (const side of [-1, 1]) {
    // Langsgående list
    ctx.beginPath();
    for (const sti of st) {
      for (let k = 0; k <= 12; k++) {
        const t = k / 12;
        const [x, y] = sti.punkt(t);
        const [dx, dy] = sti.retning(t);
        const px = x - dy * side * bredde / 2, py = y + dx * side * bredde / 2;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
    }
    ctx.strokeStyle = farge;
    ctx.lineWidth = mur ? S * 0.035 : S * 0.016;
    ctx.stroke();
    // Stolper / fagverk
    langs(st, S * 0.12, (x, y, dx, dy, k) => {
      const px = x - dy * side * bredde / 2, py = y + dx * side * bredde / 2;
      if (fagverk) {
        ctx.beginPath();
        ctx.moveTo(px - dx * S * 0.06, py - dy * S * 0.06);
        ctx.lineTo(px + dx * S * 0.06, py + dy * S * 0.06);
        ctx.strokeStyle = lys(farge, 0.25);
        ctx.lineWidth = S * 0.012;
        ctx.stroke();
      }
      ctx.fillStyle = mur ? mork(farge, 0.15) : mork(farge, 0.2);
      ctx.beginPath();
      ctx.arc(px, py, mur ? S * 0.022 : S * 0.014, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}

/** Kryssmerke (rødt og hvitt) ved planovergang. */
function krysskilt(ctx, S) {
  for (const [x, y] of [[S * 0.22, S * 0.24], [S * 0.78, S * 0.82]]) {
    ctx.fillStyle = '#5b5e66';
    ctx.fillRect(x - S * 0.008, y - S * 0.1, S * 0.016, S * 0.12);
    ctx.save();
    ctx.translate(x, y - S * 0.11);
    for (const v of [Math.PI / 4, -Math.PI / 4]) {
      ctx.rotate(v);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-S * 0.055, -S * 0.012, S * 0.11, S * 0.024);
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(-S * 0.02, -S * 0.012, S * 0.04, S * 0.024);
      ctx.rotate(-v);
    }
    ctx.restore();
  }
}
