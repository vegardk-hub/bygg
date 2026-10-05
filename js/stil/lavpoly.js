// Små byggeklosser for flat «low-poly»-tegning på canvas: fasetterte polygoner
// med lys fra øvre venstre, isometriske bokser og hus, trær, steiner og topper.
// Alle mål er i piksler i den ruta som tegnes; kalleren bestemmer størrelsen.

// ---------------------------------------------------------------------------
// Farger
// ---------------------------------------------------------------------------
function tilRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function bland(a, b, t) {
  const x = tilRgb(a), y = tilRgb(b);
  const c = x.map((v, k) => Math.round(v + (y[k] - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
export const lys = (hex, t) => bland(hex, '#ffffff', t);
export const mork = (hex, t) => bland(hex, '#000000', t);

// Lyset kommer fra øvre venstre.
const LYS = [-0.65, -0.76];

// ---------------------------------------------------------------------------
// Grunnformer
// ---------------------------------------------------------------------------
export function poly(ctx, pts, farge) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
  ctx.closePath();
  ctx.fillStyle = farge;
  ctx.fill();
  // Tynn kant i samme farge lukker hårfine sprekker mellom fasetter.
  ctx.strokeStyle = farge;
  ctx.lineWidth = 0.6;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

export function skygge(ctx, x, y, rx, ry, alfa = 0.22) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(20, 25, 15, ${alfa})`;
  ctx.fill();
}

/**
 * Fasettert polygon: deles i trekanter fra et punkt litt opp mot lyset, og hver
 * trekant får lys eller skygge etter hvilken vei den vender.
 */
export function fasett(ctx, pts, farge, { styrke = 1 } = {}) {
  let cx = 0, cy = 0;
  for (const [x, y] of pts) { cx += x; cy += y; }
  cx /= pts.length; cy /= pts.length;
  let r = 0;
  for (const [x, y] of pts) r = Math.max(r, Math.hypot(x - cx, y - cy));
  const ox = cx + LYS[0] * r * 0.18, oy = cy + LYS[1] * r * 0.18;
  for (let k = 0; k < pts.length; k++) {
    const a = pts[k], b = pts[(k + 1) % pts.length];
    const mx = (a[0] + b[0]) / 2 - ox, my = (a[1] + b[1]) / 2 - oy;
    const len = Math.hypot(mx, my) || 1;
    const prikk = (mx * LYS[0] + my * LYS[1]) / len; // 1 = vender mot lyset
    const f = prikk > 0 ? lys(farge, 0.28 * prikk * styrke) : mork(farge, 0.3 * -prikk * styrke);
    poly(ctx, [[ox, oy], a, b], f);
  }
}

/** Uregelmessig «klump» rundt (x, y): n punkter på en ellipse med litt støy. */
export function klump(tilf, x, y, rx, ry, n = 7, uro = 0.18) {
  const pts = [];
  const start = tilf.tall() * Math.PI * 2;
  for (let k = 0; k < n; k++) {
    const v = start + (k / n) * Math.PI * 2;
    const f = 1 + (tilf.tall() * 2 - 1) * uro;
    pts.push([x + Math.cos(v) * rx * f, y + Math.sin(v) * ry * f]);
  }
  return pts;
}

// ---------------------------------------------------------------------------
// Isometri: x går ned mot høyre, y ned mot venstre, z opp.
// ---------------------------------------------------------------------------
export function iso(ax, ay) {
  return (x, y, z = 0) => [ax + (x - y) * 0.866, ay + (x + y) * 0.5 - z];
}

/** Boks med topp, venstre front (+y) og høyre front (+x). farger: { topp, venstre, hoyre } */
export function kasse(ctx, ax, ay, w, d, h, farger) {
  const p = iso(ax, ay);
  const W = w / 2, D = d / 2;
  poly(ctx, [p(-W, D, 0), p(W, D, 0), p(W, D, h), p(-W, D, h)], farger.venstre);
  poly(ctx, [p(W, -D, 0), p(W, D, 0), p(W, D, h), p(W, -D, h)], farger.hoyre);
  poly(ctx, [p(-W, -D, h), p(W, -D, h), p(W, D, h), p(-W, D, h)], farger.topp);
}

/**
 * Hus med saltak (mønet langs x). vegg/tak = [lys, mørk].
 * Dør og vindu på venstre front (den som vender mot lyset).
 */
export function hus(ctx, ax, ay, w, d, h, rygg, { vegg, tak, dor = '#5b3a24', vindu = '#f3d77a', pipe = false }) {
  const p = iso(ax, ay);
  const W = w / 2, D = d / 2, o = Math.min(w, d) * 0.08;
  // Vegger
  poly(ctx, [p(-W, D, 0), p(W, D, 0), p(W, D, h), p(-W, D, h)], vegg[0]);
  poly(ctx, [p(W, -D, 0), p(W, D, 0), p(W, D, h), p(W, 0, h + rygg), p(W, -D, h)], vegg[1]);
  // Dør og vindu på venstre front
  const flate = (u, v) => p(-W + u * w, D, v * h);
  poly(ctx, [flate(0.18, 0), flate(0.36, 0), flate(0.36, 0.68), flate(0.18, 0.68)], dor);
  poly(ctx, [flate(0.55, 0.35), flate(0.8, 0.35), flate(0.8, 0.72), flate(0.55, 0.72)], vindu);
  poly(ctx, [flate(0.665, 0.35), flate(0.685, 0.35), flate(0.685, 0.72), flate(0.665, 0.72)], mork(vegg[0], 0.35));
  // Pipe (bak taket)
  if (pipe) kasse(ctx, ...p(-W * 0.45, -D * 0.3, 0), w * 0.12, d * 0.12, h + rygg * 1.05,
    { topp: '#7d6a5f', venstre: '#a3604a', hoyre: '#7a4637' });
  // Tak: bakre flate først, så den fremre som vender mot lyset.
  poly(ctx, [p(-W - o, -D - o, h - o * 0.6), p(W + o, -D - o, h - o * 0.6), p(W + o, 0, h + rygg), p(-W - o, 0, h + rygg)], tak[1]);
  poly(ctx, [p(-W - o, D + o, h - o * 0.6), p(W + o, D + o, h - o * 0.6), p(W + o, 0, h + rygg), p(-W - o, 0, h + rygg)], tak[0]);
  // Mønelinje
  ctx.beginPath();
  ctx.moveTo(...p(-W - o, 0, h + rygg));
  ctx.lineTo(...p(W + o, 0, h + rygg));
  ctx.strokeStyle = lys(tak[0], 0.25);
  ctx.lineWidth = Math.max(1, w * 0.03);
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// Natur
// ---------------------------------------------------------------------------
/** Gran med bunn (stammefot) i (x, y) og høyde h. farger = [lys, mørk]. */
export function gran(ctx, tilf, x, y, h, farger, stamme = '#7a5236') {
  skygge(ctx, x + h * 0.1, y, h * 0.3, h * 0.09);
  ctx.fillStyle = stamme;
  ctx.fillRect(x - h * 0.045, y - h * 0.18, h * 0.09, h * 0.18);
  for (let k = 0; k < 3; k++) {
    const bunn = y - h * 0.13 - k * h * 0.22;
    const halv = h * (0.3 - k * 0.07);
    const topp = bunn - h * (0.4 - k * 0.03);
    const tx = x + (tilf.tall() - 0.5) * h * 0.04;
    const midt = [x, bunn + halv * 0.12];
    poly(ctx, [[x - halv, bunn], [tx, topp], midt], farger[0]);
    poly(ctx, [[tx, topp], [x + halv, bunn], midt], farger[1]);
  }
}

/** Løvtre: stamme + fasettert krone. */
export function lovtre(ctx, tilf, x, y, h, farge, stamme = '#7a5236') {
  skygge(ctx, x + h * 0.1, y, h * 0.32, h * 0.1);
  ctx.fillStyle = stamme;
  ctx.fillRect(x - h * 0.05, y - h * 0.38, h * 0.1, h * 0.38);
  fasett(ctx, klump(tilf, x, y - h * 0.62, h * 0.34, h * 0.34, 8, 0.12), farge);
}

/** Stein: fasettert, flat bunn. */
export function stein(ctx, tilf, x, y, r, farge) {
  skygge(ctx, x + r * 0.2, y, r * 1.05, r * 0.3);
  const pts = klump(tilf, x, y - r * 0.45, r, r * 0.62, 7, 0.2).map(([px, py]) => [px, Math.min(py, y)]);
  fasett(ctx, pts, farge, { styrke: 1.2 });
}

/** Fjelltopp med snø: bunn fra (x - w/2, y) til (x + w/2, y), høyde h. */
export function topp(ctx, tilf, x, y, w, h, fjell, sno) {
  const ax = x + (tilf.tall() - 0.5) * w * 0.15, ay = y - h;
  const L = [x - w / 2, y], R = [x + w / 2, y], F = [x + w * 0.1, y];
  const mL = [x - w * 0.27, y - h * 0.48]; // knekk på venstre side for mer «low-poly»
  poly(ctx, [L, mL, F], mork(fjell[0], 0.06));
  poly(ctx, [mL, [ax, ay], F], fjell[0]);
  poly(ctx, [[ax, ay], R, F], fjell[1]);
  // Snølue
  const t = 0.34;
  const p1 = [ax + (mL[0] - ax) * t * 1.3, ay + (mL[1] - ay) * t * 1.3];
  const p2 = [ax + (F[0] - ax) * t * 0.9, ay + (F[1] - ay) * t * 0.9];
  const p3 = [ax + (R[0] - ax) * t, ay + (R[1] - ay) * t];
  const tagg = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2 - h * 0.05];
  poly(ctx, [[ax, ay], p1, tagg, p2], sno[0]);
  poly(ctx, [[ax, ay], p2, [(p2[0] + p3[0]) / 2, (p2[1] + p3[1]) / 2 - h * 0.04], p3], sno[1]);
}

/** Gresstust: tre-fire strå. */
export function tust(ctx, x, y, s, farge) {
  const straa = [[-0.5, -0.9], [0, -1.25], [0.45, -0.85], [0.85, -0.55]];
  for (const [dx, dy] of straa) {
    poly(ctx, [[x - s * 0.12 + dx * s * 0.2, y], [x + dx * s * 0.5, y + dy * s], [x + s * 0.12 + dx * s * 0.2, y]], farge);
  }
}
