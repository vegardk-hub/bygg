// Brettstil: hver rute er et eget kvadratisk «kort» med mørkere kanter, flak og
// gresstuster på bunnen, og low-poly-figurer oppå. Alt tegnes i en rute på
// S × S piksler med origo i rutas øvre venstre hjørne.

import { BUNN, FIGUR } from './palett.js';
import {
  bland, lys, mork, poly, skygge, fasett, klump, kasse, hus, gran, lovtre, stein, topp, tust, iso,
} from './lavpoly.js';
import { tegnVei, tegnBane, lagUnngaa, HALVBREDDE } from './veier.js';

// ---------------------------------------------------------------------------
// Bunn
// ---------------------------------------------------------------------------
function rundRekt(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Grunnflate: midtfarge, mørkere mot kantene (målt i forbildet), flak og tuster. */
function bunn(ctx, S, b, tilf, { flak = 10, tuster = 6 } = {}) {
  rundRekt(ctx, 0, 0, S, S, S * 0.025);
  ctx.clip();
  ctx.fillStyle = b.midt;
  ctx.fillRect(0, 0, S, S);
  // Flak: små, flate polygoner i litt lysere/mørkere tone.
  for (let k = 0; k < flak; k++) {
    const x = S * (0.08 + tilf.tall() * 0.84), y = S * (0.08 + tilf.tall() * 0.84);
    const r = S * (0.03 + tilf.tall() * 0.05);
    ctx.globalAlpha = 0.55 + tilf.tall() * 0.35;
    poly(ctx, klump(tilf, x, y, r, r * (0.4 + tilf.tall() * 0.5), 3 + Math.floor(tilf.tall() * 2), 0.35), tilf.velg(b.flak));
  }
  ctx.globalAlpha = 1;
  if (b.tust) {
    for (let k = 0; k < tuster; k++) {
      tust(ctx, S * (0.1 + tilf.tall() * 0.8), S * (0.15 + tilf.tall() * 0.78), S * 0.05, b.tust);
    }
  }
}

/** Mørkere kant innover («vignett») – legges på etter figurene så hele kortet får den. */
function kantskygge(ctx, S, b) {
  const g = ctx.createRadialGradient(S / 2, S / 2, S * 0.42, S / 2, S / 2, S * 0.74);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, b.kant + '99');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const bredde = S * 0.07;
  for (const [x0, y0, x1, y1, rx, ry, rw, rh] of [
    [0, 0, 0, bredde, 0, 0, S, bredde], [0, S, 0, S - bredde, 0, S - bredde, S, bredde],
    [0, 0, bredde, 0, 0, 0, bredde, S], [S, 0, S - bredde, 0, S - bredde, 0, bredde, S],
  ]) {
    const lg = ctx.createLinearGradient(x0, y0, x1, y1);
    lg.addColorStop(0, b.kant + 'b0');
    lg.addColorStop(1, b.kant + '00');
    ctx.fillStyle = lg;
    ctx.fillRect(rx, ry, rw, rh);
  }
}

// ---------------------------------------------------------------------------
// Terreng
// ---------------------------------------------------------------------------
/** Spredte posisjoner i ruta, sortert bakfra (liten y) og fram. */
function plasser(tilf, S, n, marg = 0.18, minAvst = 0.2, o = {}) {
  const ut = [];
  for (let forsok = 0; ut.length < n && forsok < 300; forsok++) {
    const x = S * (marg + tilf.tall() * (1 - 2 * marg)), y = S * (marg + 0.08 + tilf.tall() * (1 - 2 * marg));
    // Lysning: hold midten/fronten fri så et overlegg (dyr, malm …) synes.
    if (o.lysning && y > S * 0.4 && Math.abs(x - S * 0.5) < S * 0.34) continue;
    // Vei/jernbane: ingen pynt i traseen.
    // Sjekk både foten og kronen/toppen, så ikke høye figurer stikker ut over veien.
    if (o.unngaa?.(x, y, S * 0.06) || o.unngaa?.(x, y - S * 0.15, S * 0.1)) continue;
    if (ut.every(([a, b]) => Math.hypot(a - x, b - y) > S * minAvst)) ut.push([x, y]);
  }
  return ut.sort((a, b) => a[1] - b[1]);
}

const TERRENG = {
  eng(ctx, S, tilf, o) {
    bunn(ctx, S, BUNN.eng, tilf, { flak: 12, tuster: 9 });
    o.etterBunn?.();
    if (!o.lysning && tilf.sjanse(0.35)) {
      const [x, y] = plasser(tilf, S, 1, 0.25, 0.2, o)[0] ?? [];
      if (x !== undefined) lovtre(ctx, tilf, x, y, S * 0.32, FIGUR.lov);
    }
    if (tilf.sjanse(0.4)) blomster(ctx, S, tilf);
  },
  skog(ctx, S, tilf, o) {
    bunn(ctx, S, BUNN.skog, tilf, { flak: 10, tuster: 4 });
    o.etterBunn?.();
    for (const [x, y] of plasser(tilf, S, o.lysning ? 4 : 6, 0.17, 0.2, o)) {
      const h = S * (0.3 + tilf.tall() * 0.14);
      if (tilf.sjanse(0.18)) lovtre(ctx, tilf, x, y, h * 0.95, tilf.sjanse(0.25) ? FIGUR.lovHost : FIGUR.lov);
      else gran(ctx, tilf, x, y, h, tilf.sjanse(0.5) ? FIGUR.gran : FIGUR.granMork);
    }
  },
  aas(ctx, S, tilf, o) {
    bunn(ctx, S, BUNN.aas, tilf, { flak: 12, tuster: 5 });
    o.etterBunn?.();
    // Haugene er brede: med vei gjennom ruta blir de mindre så de får plass ved siden av.
    const smal = o.unngaa ? 0.6 : 1;
    for (const [x, y] of plasser(tilf, S, o.lysning ? 2 : 3, 0.2, 0.26, o)) {
      const w = S * (0.36 + tilf.tall() * 0.12) * smal;
      haug(ctx, tilf, x, y, w, w * 0.42);
    }
    for (const [x, y] of plasser(tilf, S, 3, 0.15, 0.15, o)) stein(ctx, tilf, x, y, S * 0.05, FIGUR.stein);
  },
  fjell(ctx, S, tilf, o) {
    bunn(ctx, S, BUNN.fjell, tilf, { flak: 12, tuster: 0 });
    o.etterBunn?.();
    const n = tilf.sjanse(0.5) ? 2 : 3;
    const steder = o.lysning ? [[0.28, 0.42, 0.44, 0.34], [0.74, 0.46, 0.4, 0.3]] : n === 2 ? [[0.36, 0.62, 0.62, 0.55], [0.66, 0.82, 0.5, 0.4]] : [[0.3, 0.55, 0.48, 0.42], [0.68, 0.6, 0.5, 0.48], [0.48, 0.86, 0.46, 0.34]];
    for (const [x, y, w, h] of steder) topp(ctx, tilf, S * x, S * y, S * w, S * h * (0.9 + tilf.tall() * 0.2), FIGUR.fjell, FIGUR.sno);
    stein(ctx, tilf, S * 0.18, S * 0.86, S * 0.05, FIGUR.stein);
  },
  vann(ctx, S, tilf, o) {
    bunn(ctx, S, BUNN.vann, tilf, { flak: 8, tuster: 0 });
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = S * 0.012;
    ctx.lineCap = 'round';
    for (const [x, y] of plasser(tilf, S, 5, 0.15, 0.18, o)) {
      const b = S * (0.06 + tilf.tall() * 0.05);
      ctx.beginPath();
      ctx.moveTo(x - b, y);
      ctx.quadraticCurveTo(x - b / 2, y - b * 0.45, x, y);
      ctx.quadraticCurveTo(x + b / 2, y - b * 0.45, x + b, y);
      ctx.stroke();
    }
    if (!o.unngaa && tilf.sjanse(0.35)) {
      const x = S * (0.25 + tilf.tall() * 0.5), y = S * (0.25 + tilf.tall() * 0.5);
      poly(ctx, klump(tilf, x, y, S * 0.06, S * 0.04, 7, 0.1), '#5f9a4a');
      poly(ctx, [[x, y], [x + S * 0.06, y - S * 0.01], [x + S * 0.06, y + S * 0.015]], BUNN.vann.midt);
    }
    o.etterBunn?.(); // bru tegnes oppå bølgene
  },
  strand(ctx, S, tilf, o) {
    bunn(ctx, S, BUNN.strand, tilf, { flak: 14, tuster: 3 });
    o.etterBunn?.();
    for (const [x, y] of plasser(tilf, S, 4, 0.15, 0.15, o)) stein(ctx, tilf, x, y, S * (0.025 + tilf.tall() * 0.025), '#b9b3a6');
    if (!o.unngaa && tilf.sjanse(0.6)) skjell(ctx, S * (0.3 + tilf.tall() * 0.4), S * (0.3 + tilf.tall() * 0.4), S * 0.04);
    if (!o.unngaa && tilf.sjanse(0.4)) {
      // Drivved
      const x = S * (0.3 + tilf.tall() * 0.3), y = S * (0.55 + tilf.tall() * 0.25);
      poly(ctx, [[x, y], [x + S * 0.22, y - S * 0.05], [x + S * 0.23, y - S * 0.02], [x + S * 0.01, y + S * 0.03]], '#a88a68');
    }
  },
};

/** Rund, lav haug: en bue av punkter, delt i fasetter som lyses fra venstre. */
function haug(ctx, tilf, x, y, w, h) {
  skygge(ctx, x + w * 0.06, y + h * 0.04, w * 0.52, w * 0.1);
  const n = 6;
  const bue = [];
  for (let k = 0; k <= n; k++) {
    const v = Math.PI * (1 - k / n);
    const uro = k === 0 || k === n ? 0 : (tilf.tall() - 0.5) * 0.12;
    bue.push([x + Math.cos(v) * w / 2, y - Math.sin(v) * h * (1 + uro)]);
  }
  const fot = [x + w * 0.04, y];
  for (let k = 0; k < n; k++) {
    const t = k / (n - 1); // 0 = venstre (lys) … 1 = høyre (skygge)
    poly(ctx, [bue[k], bue[k + 1], fot], bland(lys(FIGUR.haug[0], 0.12), FIGUR.haug[1], t));
  }
  // Grønn lue av gress på toppen
  if (tilf.sjanse(0.7)) {
    const a = bue[2], b = bue[3], c = bue[4];
    poly(ctx, [a, b, c, [c[0] - w * 0.04, c[1] + h * 0.18], [b[0], b[1] + h * 0.22], [a[0] + w * 0.04, a[1] + h * 0.18]], '#87a352');
  }
}

function blomster(ctx, S, tilf) {
  const farger = ['#f4e36a', '#ffffff', '#e57a9a'];
  for (let k = 0; k < 4; k++) {
    const x = S * (0.15 + tilf.tall() * 0.7), y = S * (0.15 + tilf.tall() * 0.7);
    ctx.fillStyle = tilf.velg(farger);
    ctx.beginPath();
    ctx.arc(x, y, S * 0.014, 0, Math.PI * 2);
    ctx.fill();
  }
}

function skjell(ctx, x, y, r) {
  ctx.fillStyle = '#f2c9b5';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, r, Math.PI * 1.1, Math.PI * 1.9);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#d99c86';
  ctx.lineWidth = r * 0.12;
  for (let k = 1; k < 4; k++) {
    const v = Math.PI * (1.1 + k * 0.2);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(v) * r, y + Math.sin(v) * r);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------
// Overlegg (dyr, bær, malm, skatt)
// ---------------------------------------------------------------------------
const OVERLEGG = {
  sau(ctx, S, tilf) {
    const x = S * 0.5, y = S * 0.66;
    skygge(ctx, x + S * 0.03, y + S * 0.02, S * 0.16, S * 0.045);
    ctx.fillStyle = '#3b3a3f';
    for (const dx of [-0.08, -0.03, 0.04, 0.09]) ctx.fillRect(x + S * dx, y - S * 0.03, S * 0.025, S * 0.06);
    fasett(ctx, klump(tilf, x, y - S * 0.1, S * 0.15, S * 0.1, 9, 0.1), FIGUR.ull, { styrke: 0.7 });
    fasett(ctx, [[x - S * 0.2, y - S * 0.15], [x - S * 0.12, y - S * 0.2], [x - S * 0.1, y - S * 0.1], [x - S * 0.18, y - S * 0.07]], '#45434a');
  },
  hjort(ctx, S) {
    const x = S * 0.5, y = S * 0.7, f = FIGUR.hjort;
    skygge(ctx, x + S * 0.02, y + S * 0.01, S * 0.15, S * 0.04);
    ctx.fillStyle = f[1];
    for (const dx of [-0.1, -0.06, 0.06, 0.1]) ctx.fillRect(x + S * dx, y - S * 0.1, S * 0.022, S * 0.11);
    poly(ctx, [[x - S * 0.13, y - S * 0.18], [x + S * 0.12, y - S * 0.17], [x + S * 0.13, y - S * 0.08], [x - S * 0.12, y - S * 0.08]], f[0]);
    poly(ctx, [[x - S * 0.12, y - S * 0.08], [x + S * 0.13, y - S * 0.08], [x + S * 0.1, y - S * 0.12]], f[1]);
    poly(ctx, [[x - S * 0.13, y - S * 0.18], [x - S * 0.17, y - S * 0.3], [x - S * 0.12, y - S * 0.31], [x - S * 0.08, y - S * 0.17]], f[0]);
    poly(ctx, [[x - S * 0.2, y - S * 0.32], [x - S * 0.11, y - S * 0.34], [x - S * 0.13, y - S * 0.27]], f[1]);
    ctx.strokeStyle = '#e9dcc0';
    ctx.lineWidth = S * 0.012;
    ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x - S * 0.15, y - S * 0.33);
      ctx.lineTo(x - S * (0.15 + s * 0.05), y - S * 0.43);
      ctx.moveTo(x - S * (0.15 + s * 0.03), y - S * 0.38);
      ctx.lineTo(x - S * (0.15 + s * 0.08), y - S * 0.39);
      ctx.stroke();
    }
  },
  baer(ctx, S, tilf) {
    const x = S * 0.5, y = S * 0.66;
    skygge(ctx, x + S * 0.03, y, S * 0.2, S * 0.05);
    fasett(ctx, klump(tilf, x, y - S * 0.12, S * 0.2, S * 0.14, 9, 0.12), '#5c8a3e');
    const farge = tilf.velg(FIGUR.baer);
    for (let k = 0; k < 9; k++) {
      ctx.fillStyle = farge;
      ctx.beginPath();
      ctx.arc(x + (tilf.tall() - 0.5) * S * 0.3, y - S * 0.12 + (tilf.tall() - 0.5) * S * 0.18, S * 0.018, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  malm(ctx, S, tilf) {
    const x = S * 0.5, y = S * 0.72;
    stein(ctx, tilf, x, y, S * 0.2, '#6f7080');
    for (let k = 0; k < 4; k++) {
      const cx = x + (tilf.tall() - 0.5) * S * 0.22, cy = y - S * 0.12 + (tilf.tall() - 0.5) * S * 0.1;
      poly(ctx, [[cx, cy - S * 0.04], [cx + S * 0.025, cy], [cx, cy + S * 0.02], [cx - S * 0.025, cy]], FIGUR.malm[k % 2]);
    }
  },
  skatt(ctx, S) {
    const ax = S * 0.5, ay = S * 0.72;
    const p = iso(ax, ay);
    skygge(ctx, ax, ay - S * 0.02, S * 0.24, S * 0.07);
    kasse(ctx, ax, ay, S * 0.3, S * 0.2, S * 0.13, { topp: '#b98552', venstre: '#a36d3e', hoyre: '#7a4f2c' });
    // Buet lokk
    const lokk = iso(ax, ay - S * 0.13);
    poly(ctx, [lokk(-S * 0.15, S * 0.1), lokk(S * 0.15, S * 0.1), lokk(S * 0.15, 0, S * 0.07), lokk(-S * 0.15, 0, S * 0.07)], '#c99560');
    poly(ctx, [lokk(S * 0.15, -S * 0.1), lokk(S * 0.15, S * 0.1), lokk(S * 0.15, 0, S * 0.07)], '#8a5a32');
    // Metallbånd og lås
    ctx.strokeStyle = '#5b5e66';
    ctx.lineWidth = S * 0.015;
    for (const u of [-0.1, 0.1]) {
      ctx.beginPath();
      ctx.moveTo(...p(u * S, S * 0.1, 0));
      ctx.lineTo(...p(u * S, S * 0.1, S * 0.13));
      ctx.lineTo(...lokk(u * S, 0, S * 0.07));
      ctx.stroke();
    }
    const [lx, ly] = p(0, S * 0.1, S * 0.1);
    ctx.fillStyle = FIGUR.gull[0];
    ctx.fillRect(lx - S * 0.022, ly - S * 0.02, S * 0.044, S * 0.045);
    // Gnister
    ctx.fillStyle = '#fff6c4';
    for (const [dx, dy] of [[-0.2, -0.32], [0.18, -0.38], [0.24, -0.2]]) {
      const sx = ax + dx * S, sy = ay + dy * S, r = S * 0.03;
      poly(ctx, [[sx, sy - r], [sx + r * 0.3, sy], [sx, sy + r], [sx - r * 0.3, sy]], '#fff6c4');
      poly(ctx, [[sx - r, sy], [sx, sy - r * 0.3], [sx + r, sy], [sx, sy + r * 0.3]], '#fff6c4');
    }
  },
};

// ---------------------------------------------------------------------------
// Bygg
// ---------------------------------------------------------------------------
const BYGG = {
  leir(ctx, S, tilf) {
    hus(ctx, S * 0.43, S * 0.62, S * 0.34, S * 0.3, S * 0.17, S * 0.15,
      { vegg: FIGUR.treVegg, tak: FIGUR.takRod, pipe: true });
    baal(ctx, S * 0.76, S * 0.82, S * 0.1);
    flagg(ctx, S * 0.18, S * 0.82, S * 0.32);
  },
  hogstbu(ctx, S, tilf, nivaa = 1) {
    gran(ctx, tilf, S * 0.22, S * 0.36, S * 0.3, FIGUR.granMork);
    gran(ctx, tilf, S * 0.8, S * 0.32, S * 0.26, FIGUR.gran);
    hus(ctx, S * 0.5, S * 0.55, S * 0.3, S * 0.24, S * 0.13, S * 0.12, { vegg: FIGUR.treVegg, tak: FIGUR.takMork });
    tommerstabel(ctx, S * 0.28, S * 0.86, S * 0.055, nivaa >= 2 ? 6 : 3);
    stubbe(ctx, S * 0.76, S * 0.84, S * 0.07, true);
    if (nivaa >= 3) stubbe(ctx, S * 0.6, S * 0.92, S * 0.05, false);
  },
  gard(ctx, S, tilf, nivaa = 1) {
    if (nivaa < 2) {
      // Nivå 1: bare åker over hele ruta, med en høystakk.
      aker(ctx, S, tilf, nivaa, { y0: 0.18, h: 0.72, rader: 6 });
      hoystakk(ctx, S * 0.78, S * 0.3, S * 0.09);
      return;
    }
    // Nivå 2–3: byggene står på tunet øverst, åkeren blir mindre og ligger nedenfor.
    tun(ctx, S, tilf);
    hus(ctx, S * 0.3, S * 0.3, S * 0.28, S * 0.22, S * 0.14, S * 0.11, { vegg: ['#c8574a', '#963d33'], tak: ['#7d7d86', '#5c5c66'] });
    if (nivaa >= 3) molle(ctx, S * 0.76, S * 0.44, S);
    else hoystakk(ctx, S * 0.76, S * 0.4, S * 0.08);
    aker(ctx, S, tilf, nivaa, { y0: 0.56, h: 0.34, rader: 3 });
  },
  steinbrudd(ctx, S, tilf) {
    // Fjellvegg i terrasser bak, med sprekker – så tilhugde blokker og grus foran.
    fjellvegg(ctx, tilf, S);
    const blokk = { topp: '#d2d5dc', venstre: '#aeb3bf', hoyre: '#868b99' };
    kasse(ctx, S * 0.3, S * 0.76, S * 0.12, S * 0.12, S * 0.07, blokk);
    kasse(ctx, S * 0.44, S * 0.8, S * 0.12, S * 0.12, S * 0.07, blokk);
    kasse(ctx, S * 0.36, S * 0.71, S * 0.11, S * 0.11, S * 0.065, { topp: '#dcdfe5', venstre: '#b6bbc6', hoyre: '#8f94a2' });
    for (let k = 0; k < 5; k++) stein(ctx, tilf, S * (0.14 + tilf.tall() * 0.2), S * (0.86 + tilf.tall() * 0.06), S * 0.022, '#a9aeb8');
    vogn(ctx, tilf, S * 0.74, S * 0.84, S * 0.17);
    hakke(ctx, S * 0.57, S * 0.93, S * 0.12);
  },
  landsby(ctx, S, tilf) {
    hus(ctx, S * 0.32, S * 0.36, S * 0.26, S * 0.22, S * 0.14, S * 0.12, { vegg: FIGUR.pussVegg, tak: FIGUR.takBla });
    hus(ctx, S * 0.72, S * 0.42, S * 0.24, S * 0.2, S * 0.13, S * 0.11, { vegg: FIGUR.treVegg, tak: FIGUR.takGronn });
    bronn(ctx, S * 0.5, S * 0.66, S * 0.12);
    hus(ctx, S * 0.34, S * 0.8, S * 0.28, S * 0.22, S * 0.15, S * 0.12, { vegg: FIGUR.pussVegg, tak: FIGUR.takRod, pipe: true });
  },
};

function baal(ctx, x, y, r) {
  skygge(ctx, x, y, r * 1.1, r * 0.35, 0.25);
  for (let k = 0; k < 7; k++) {
    const v = (k / 7) * Math.PI * 2;
    ctx.fillStyle = k % 2 ? '#8d8f98' : '#a9abb3';
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(v) * r, y + Math.sin(v) * r * 0.4, r * 0.28, r * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  poly(ctx, [[x - r * 0.55, y], [x, y - r * 1.5], [x + r * 0.55, y]], FIGUR.flamme[1]);
  poly(ctx, [[x - r * 0.3, y], [x + r * 0.05, y - r * 1.05], [x + r * 0.32, y]], FIGUR.flamme[0]);
}

function flagg(ctx, x, y, h) {
  ctx.fillStyle = '#6d4a30';
  ctx.fillRect(x - h * 0.02, y - h, h * 0.04, h);
  poly(ctx, [[x + h * 0.02, y - h], [x + h * 0.38, y - h * 0.88], [x + h * 0.02, y - h * 0.74]], '#e0a030');
  poly(ctx, [[x + h * 0.02, y - h * 0.87], [x + h * 0.38, y - h * 0.88], [x + h * 0.02, y - h * 0.74]], '#b77f1c');
}

function tommerstabel(ctx, x, y, r, n) {
  skygge(ctx, x + r, y, r * 2.4, r * 0.6);
  const rader = n >= 6 ? [3, 2, 1] : [2, 1];
  rader.forEach((antall, rad) => {
    for (let k = 0; k < antall; k++) {
      const cx = x + (k - (antall - 1) / 2) * r * 1.9, cy = y - r - rad * r * 1.6;
      poly(ctx, [[cx - r * 2.2, cy - r], [cx, cy - r], [cx, cy + r], [cx - r * 2.2, cy + r]].map(([a, b]) => [a + r * 1.3, b - r * 0.55]), '#8f6440');
      ctx.fillStyle = '#d8b07a';
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#a8794a'; ctx.lineWidth = r * 0.18;
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2); ctx.stroke();
    }
  });
}

function stubbe(ctx, x, y, r, medOks) {
  skygge(ctx, x + r * 0.3, y, r * 1.2, r * 0.35);
  poly(ctx, [[x - r, y - r * 0.2], [x + r, y - r * 0.2], [x + r * 0.9, y - r * 1.2], [x - r * 0.9, y - r * 1.2]], '#8a5c38');
  ctx.fillStyle = '#d8b07a';
  ctx.beginPath(); ctx.ellipse(x, y - r * 1.2, r * 0.9, r * 0.38, 0, 0, Math.PI * 2); ctx.fill();
  if (medOks) {
    ctx.strokeStyle = '#6b4a2b'; ctx.lineWidth = r * 0.22; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x + r * 0.1, y - r * 1.3); ctx.lineTo(x + r * 1.2, y - r * 2.6); ctx.stroke();
    poly(ctx, [[x - r * 0.3, y - r * 1.15], [x + r * 0.35, y - r * 1.55], [x + r * 0.25, y - r * 1.05]], '#c9ced6');
  }
}

/** Gårdstun: en flekk med tråkket jord der bygningene står. */
function tun(ctx, S, tilf) {
  poly(ctx, klump(tilf, S * 0.5, S * 0.34, S * 0.4, S * 0.17, 9, 0.08), '#a9a06c');
}

/** Åker med rader av spirer (nivå 1) eller korn (nivå 2+). y0/h er brøkdeler av ruta. */
function aker(ctx, S, tilf, nivaa, { y0: fy0, h: fh, rader }) {
  const x0 = S * 0.1, y0 = S * fy0, w = S * 0.8, h = S * fh;
  skygge(ctx, S * 0.52, y0 + h, w * 0.5, S * 0.03, 0.15);
  ctx.fillStyle = FIGUR.jord;
  ctx.beginPath();
  ctx.moveTo(x0 + S * 0.03, y0); ctx.lineTo(x0 + w, y0 + S * 0.02); ctx.lineTo(x0 + w - S * 0.02, y0 + h); ctx.lineTo(x0, y0 + h - S * 0.02);
  ctx.closePath(); ctx.fill();
  for (let k = 0; k < rader; k++) {
    const y = y0 + h * ((k + 0.6) / (rader + 0.2));
    poly(ctx, [[x0 + S * 0.03, y - S * 0.035], [x0 + w - S * 0.03, y - S * 0.03], [x0 + w - S * 0.03, y + S * 0.012], [x0 + S * 0.03, y + S * 0.01]], mork(FIGUR.jord, 0.18));
    // Plantene på rada
    for (let j = 0; j < 9; j++) {
      const x = x0 + S * 0.07 + j * (w - S * 0.12) / 8;
      if (nivaa >= 2) {
        poly(ctx, [[x - S * 0.022, y], [x, y - S * 0.075], [x + S * 0.022, y]], j % 2 ? FIGUR.korn[0] : FIGUR.korn[1]);
      } else {
        poly(ctx, [[x - S * 0.018, y], [x - S * 0.008, y - S * 0.05], [x, y]], FIGUR.spire[0]);
        poly(ctx, [[x, y], [x + S * 0.01, y - S * 0.045], [x + S * 0.02, y]], FIGUR.spire[1]);
      }
    }
  }
}

function hoystakk(ctx, x, y, r) {
  skygge(ctx, x + r * 0.2, y + r * 0.1, r * 1.1, r * 0.35);
  poly(ctx, [[x - r, y], [x - r * 0.5, y - r * 1.1], [x, y - r * 1.35], [x + r * 0.1, y]], FIGUR.korn[0]);
  poly(ctx, [[x, y - r * 1.35], [x + r * 0.5, y - r * 1.05], [x + r, y], [x + r * 0.1, y]], FIGUR.korn[1]);
}

function molle(ctx, x, y, S) {
  const p = iso(x, y);
  kasse(ctx, x, y, S * 0.14, S * 0.14, S * 0.26, { topp: '#efe3c8', venstre: '#efe3c8', hoyre: '#bfae8c' });
  poly(ctx, [p(-S * 0.09, S * 0.09, S * 0.26), p(S * 0.09, S * 0.09, S * 0.26), p(0, 0, S * 0.38)], FIGUR.takRod[0]);
  poly(ctx, [p(S * 0.09, -S * 0.09, S * 0.26), p(S * 0.09, S * 0.09, S * 0.26), p(0, 0, S * 0.38)], FIGUR.takRod[1]);
  const [nx, ny] = p(S * 0.02, S * 0.08, S * 0.27);
  ctx.save();
  ctx.translate(nx, ny);
  for (let k = 0; k < 4; k++) {
    ctx.rotate(Math.PI / 2);
    poly(ctx, [[0, -S * 0.012], [S * 0.2, -S * 0.03], [S * 0.2, S * 0.025], [0, S * 0.012]], k % 2 ? '#f4ead2' : '#d9c9a3');
  }
  ctx.fillStyle = '#5b3a24';
  ctx.beginPath(); ctx.arc(0, 0, S * 0.018, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** Uthugget fjellvegg: tre trinn med lys topp, mørk front og sprekker. */
function fjellvegg(ctx, tilf, S) {
  const trinn = [
    { y: 0.4, h: 0.22, x0: 0.08, x1: 0.92 },
    { y: 0.54, h: 0.13, x0: 0.14, x1: 0.86 },
    { y: 0.64, h: 0.08, x0: 0.22, x1: 0.8 },
  ];
  for (const t of trinn) {
    const topp = S * (t.y - t.h), bunn = S * t.y;
    const kant = [];
    for (let k = 0; k <= 6; k++) kant.push([S * (t.x0 + (t.x1 - t.x0) * (k / 6)), topp + (tilf.tall() - 0.5) * S * 0.025]);
    // Mørk front mot betrakteren og en smal lys flate på toppen
    poly(ctx, [...kant, [S * t.x1, bunn], [S * t.x0, bunn]], '#7d8392');
    poly(ctx, [...kant, ...kant.slice().reverse().map(([x, y]) => [x, y - S * 0.03])], '#b9bec9');
    ctx.strokeStyle = '#5c6170';
    ctx.lineWidth = S * 0.008;
    for (let k = 0; k < 3; k++) {
      const x = S * (t.x0 + 0.1 + tilf.tall() * (t.x1 - t.x0 - 0.2));
      ctx.beginPath();
      ctx.moveTo(x, topp + S * 0.01);
      ctx.lineTo(x + S * 0.015, topp + (bunn - topp) * 0.5);
      ctx.lineTo(x - S * 0.005, bunn - S * 0.005);
      ctx.stroke();
    }
  }
}

function vogn(ctx, tilf, x, y, w) {
  skygge(ctx, x, y, w * 0.6, w * 0.15);
  kasse(ctx, x, y - w * 0.12, w * 0.7, w * 0.45, w * 0.28, { topp: '#5a4a3e', venstre: '#8a6a4c', hoyre: '#6a4f38' });
  for (let k = 0; k < 3; k++) stein(ctx, tilf, x - w * 0.12 + k * w * 0.12, y - w * 0.36, w * 0.09, '#b4b9c3');
  ctx.fillStyle = '#3b3a3f';
  for (const [dx, dy] of [[-0.28, 0.02], [0.05, 0.12]]) {
    ctx.beginPath(); ctx.ellipse(x + dx * w, y + dy * w - w * 0.08, w * 0.1, w * 0.12, 0, 0, Math.PI * 2); ctx.fill();
  }
}

function hakke(ctx, x, y, l) {
  ctx.strokeStyle = '#7a5236'; ctx.lineWidth = l * 0.09; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - l * 0.5, y); ctx.lineTo(x + l * 0.4, y - l * 0.35); ctx.stroke();
  ctx.strokeStyle = '#a7adb8'; ctx.lineWidth = l * 0.1;
  ctx.beginPath(); ctx.moveTo(x + l * 0.15, y - l * 0.6); ctx.quadraticCurveTo(x + l * 0.45, y - l * 0.4, x + l * 0.55, y - l * 0.05); ctx.stroke();
}

function bronn(ctx, x, y, r) {
  skygge(ctx, x + r * 0.2, y, r * 1.1, r * 0.35);
  kasse(ctx, x, y, r * 1.2, r * 1.2, r * 0.6, { topp: '#3c5f80', venstre: '#a3a9b5', hoyre: '#7c8190' });
  ctx.fillStyle = '#7a5236';
  ctx.fillRect(x - r * 0.75, y - r * 1.5, r * 0.1, r * 1.0);
  ctx.fillRect(x + r * 0.65, y - r * 1.5, r * 0.1, r * 1.0);
  poly(ctx, [[x - r * 0.95, y - r * 1.45], [x, y - r * 1.95], [x + r * 0.95, y - r * 1.45]], FIGUR.takRod[0]);
}

// ---------------------------------------------------------------------------
// Offentlig: tegn ett kort
// ---------------------------------------------------------------------------
const BUNN_FOR = { eng: 'eng', skog: 'skog', aas: 'aas', fjell: 'fjell', vann: 'vann', strand: 'strand' };

/**
 * Tegner én rute (kort) i et S×S-område. innhold:
 *  { terreng, bygg?, nivaa?, overlegg? } – bygg tegnes på en enklere bunn uten terrengpynt.
 */
export function tegnKort(ctx, S, tilf, { terreng, bygg, nivaa = 1, overlegg, vei, bane }) {
  ctx.save();
  const bru = terreng === 'vann';
  // `vei` kan være én vei eller en liste (f.eks. trevei inn og steinvei ut av en landsby).
  const veier = vei ? [].concat(vei) : [];
  // Vei og bane tegnes rett på bakken, før trær, steiner og bygg.
  const tegnFerdsel = () => {
    // Vei og bane på samme terrengrute = planovergang. På en byggrute er de bare to stubber inn mot bygget.
    if (bane && veier.length && !bygg) {
      tegnBane(ctx, S, tilf, bane.retninger, { bru, kryssVei: veier[0] });
      return;
    }
    for (const v of veier) tegnVei(ctx, S, tilf, v.type, v.retninger, { bru });
    if (bane) tegnBane(ctx, S, tilf, bane.retninger, { bru, paaBygg: !!bygg });
  };
  if (bygg) {
    const b = BUNN[BUNN_FOR[terreng]] ?? BUNN.eng;
    bunn(ctx, S, b, tilf, { flak: 8, tuster: 4 });
    tegnFerdsel(); // på en byggrute går veien inn mot midten, under bygget
    BYGG[bygg](ctx, S, tilf, nivaa);
    kantskygge(ctx, S, b);
  } else {
    const lag = [];
    for (const v of veier) lag.push({ retninger: v.retninger, halvbredde: S * HALVBREDDE[v.type] });
    if (bane) lag.push({ retninger: bane.retninger, halvbredde: S * HALVBREDDE.bane });
    // Med overlegg lager terrenget en lysning i midten så figuren synes.
    TERRENG[terreng](ctx, S, tilf, {
      lysning: !!overlegg,
      unngaa: lag.length ? lagUnngaa(S, lag) : null,
      etterBunn: lag.length ? tegnFerdsel : null,
    });
    if (overlegg) OVERLEGG[overlegg](ctx, S, tilf);
    kantskygge(ctx, S, BUNN[terreng]);
  }
  ctx.restore();
}

/** Ruter man kan avdekke: mørkt kort med et svakt spørsmålstegn. */
export function tegnUkjent(ctx, S, tilf) {
  ctx.save();
  bunn(ctx, S, BUNN.front, tilf, { flak: 6, tuster: 0 });
  kantskygge(ctx, S, BUNN.front);
  ctx.fillStyle = 'rgba(250, 242, 219, 0.22)';
  ctx.font = `700 ${Math.round(S * 0.34)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', S / 2, S / 2 + S * 0.02);
  ctx.restore();
}

/** Hjørneklammer rundt valgt rute (fra forbildet): tegnes rundt (0,0)–(S,S). */
export function tegnKlammer(ctx, S, farge) {
  const u = S * 0.08, t = S * 0.07, a = S * 0.36;
  ctx.fillStyle = farge;
  for (const [sx, sy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const x = sx ? S + u : -u, y = sy ? S + u : -u;
    const dx = sx ? -1 : 1, dy = sy ? -1 : 1;
    ctx.fillRect(Math.min(x, x + dx * a), Math.min(y, y + dy * t), a, t);
    ctx.fillRect(Math.min(x, x + dx * t), Math.min(y, y + dy * a), t, a);
  }
}

export const TERRENGTYPER = Object.keys(TERRENG);
export const BYGGTYPER = Object.keys(BYGG);
export const OVERLEGGTYPER = Object.keys(OVERLEGG);
