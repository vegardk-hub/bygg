// Kartgenerator: seed → øy med terreng, overlegg og en rettferdig startrute.
//
// Oppskrift (Red Blob Games «terrain from noise»):
//  1. Høydekart og fuktighetskart av fraktal simplex-støy.
//  2. Høyden trekkes ned mot kanten så verdenen blir en øy.
//  3. Terreng velges med kvantiler, så andelene blir like fra verden til verden.
//  4. Startrute velges med krav (skog, vann, eng og en landsby i nærheten).
//  5. Overlegg (landsbyer, dyr, bær, malm, skatter) strøs ut med minsteavstand.
// Oppfylles ikke startkravene, prøves neste «forsøk» med samme verdens-seed,
// så resultatet fortsatt er helt bestemt av seeden.

import { blandSeed, lagTilfeldig } from './rng.js';
import { lagFbm } from './stoy.js';
import { T, ANDEL, PLASSERING, START } from './data/terreng.js';

const MAKS_FORSOK = 25;

export function genererVerden(seed, { bredde = 32, hoyde = 32 } = {}) {
  for (let forsok = 0; forsok < MAKS_FORSOK; forsok++) {
    const verden = forsokVerden(seed, forsok, bredde, hoyde);
    if (verden) return verden;
  }
  throw new Error(`Fant ingen god start for seed ${seed}`);
}

function forsokVerden(seed, forsok, B, H) {
  const N = B * H;
  const idx = (x, y) => y * B + x;
  const tilf = lagTilfeldig(blandSeed(seed, forsok, 'plassering'));

  // --- 1–2. Høyde og fuktighet ------------------------------------------------
  const hoydeStoy = lagFbm(blandSeed(seed, forsok, 'hoyde'), { oktaver: 4, utholdenhet: 0.5 });
  const fuktStoy = lagFbm(blandSeed(seed, forsok, 'fukt'), { oktaver: 3, utholdenhet: 0.55 });
  const warpGrunn = lagFbm(blandSeed(seed, forsok, 'warp'), { oktaver: 2 });
  const warpStoy = (x, y) => warpGrunn(x, y) * 2 - 1;
  const fjellStoy = lagFbm(blandSeed(seed, forsok, 'fjell'), { oktaver: 3, utholdenhet: 0.5 });
  const hoydeKart = new Float32Array(N);
  const fjellVerdi = new Float32Array(N);
  const fukt = new Float32Array(N);
  const frekH = 3.2 * (B / 32) ** 0.35; // større kart → litt flere landskapsformer
  const frekF = 4.0 * (B / 32) ** 0.35;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < B; x++) {
      const nx = (2 * (x + 0.5)) / B - 1;
      const ny = (2 * (y + 0.5)) / H - 1;
      // Litt «domene-forvrengning» (støyen forskyver seg selv) gir mer organiske kyster.
      const vx = (x / B) * frekH, vy = (y / H) * frekH;
      const e = hoydeStoy(vx + 0.6 * warpStoy(vx, vy), vy + 0.6 * warpStoy(vx + 31, vy + 17));
      // Rund avstand fra midten (0 i midten, ~1 i hjørnene) gir en øy der kysten
      // følger støyen, ikke kartkanten. Den ytterste ringen tvinges uansett til hav.
      const d = Math.hypot(nx, ny) / Math.SQRT2;
      const kant = Math.max(Math.abs(nx), Math.abs(ny));
      hoydeKart[idx(x, y)] = 0.55 * e + 0.45 * (1 - d * 1.25) - Math.max(0, kant - 0.93) * 6;
      // Fjellhøyde avgjøres mest av egen støy, ikke av avstand til midten – ellers
      // ender fjellet alltid som én klump midt på øya.
      fjellVerdi[idx(x, y)] = 0.8 * fjellStoy(vx * 0.9 + 7, vy * 0.9 - 3) + 0.2 * (1 - d);
      fukt[idx(x, y)] = fuktStoy((x / B) * frekF + 50, (y / H) * frekF + 50);
    }
  }

  // --- 3. Terreng via kvantiler ------------------------------------------------
  const sortert = Array.from(hoydeKart).sort((a, b) => a - b);
  const kvantil = (q) => sortert[Math.min(N - 1, Math.floor(q * N))];
  const grVann = kvantil(ANDEL.vann);
  const grStrand = kvantil(ANDEL.vann + ANDEL.strand);

  const terreng = new Uint8Array(N);
  const innland = [];
  for (let i = 0; i < N; i++) {
    const e = hoydeKart[i];
    if (e < grVann) terreng[i] = T.VANN;
    else if (e < grStrand) terreng[i] = T.STRAND;
    else { terreng[i] = T.GRESS; innland.push(i); }
  }
  // Fjell og ås: de høyeste innlandsrutene etter fjellVerdi, i antall ruter
  // regnet av hele kartet så andelene stemmer med ANDEL.
  innland.sort((a, b) => fjellVerdi[b] - fjellVerdi[a]);
  const antFjell = Math.round(ANDEL.fjell * N);
  const antAas = Math.round(ANDEL.aas * N);
  innland.forEach((i, k) => {
    if (k < antFjell) terreng[i] = T.FJELL;
    else if (k < antFjell + antAas) terreng[i] = T.AAS;
  });
  const midtland = innland.slice(antFjell + antAas);
  // Skog = den fuktigste delen av midtlandet.
  const fuktSortert = midtland.map((i) => fukt[i]).sort((a, b) => a - b);
  const grSkog = fuktSortert[Math.floor((1 - ANDEL.skogAvMidtland) * fuktSortert.length)] ?? 2;
  for (const i of midtland) if (fukt[i] >= grSkog) terreng[i] = T.SKOG;

  ryddEnslige(terreng, B, H);

  // --- Fastlandet: største sammenhengende landmasse ---------------------------
  const fastland = finnFastland(terreng, B, H);
  let antallLand = 0;
  for (let i = 0; i < N; i++) if (terreng[i] !== T.VANN) antallLand++;

  // --- 4. Startrute ------------------------------------------------------------
  const start = velgStart(terreng, fastland, B, H, tilf);
  if (!start) return null;

  // --- 5. Overlegg ---------------------------------------------------------------
  const overlegg = new Map();
  const ledig = (i) => !overlegg.has(i) && i !== idx(start.x, start.y);
  const avstand = (a, b) => Math.hypot((a % B) - (b % B), Math.floor(a / B) - Math.floor(b / B));
  const startIdx = idx(start.x, start.y);

  function stro(type, antall, regel, ekstraKrav = () => true, lagObjekt = () => ({})) {
    const kandidater = [];
    for (let i = 0; i < N; i++) {
      if (regel.paa.includes(terreng[i]) && ledig(i) && ekstraKrav(i)) kandidater.push(i);
    }
    tilf.stokk(kandidater);
    const satt = [];
    for (const i of kandidater) {
      if (satt.length >= antall) break;
      if (satt.some((j) => avstand(i, j) < regel.minAvstand)) continue;
      if ([...overlegg.entries()].some(([j, o]) => o.type === type && avstand(i, j) < regel.minAvstand)) continue;
      overlegg.set(i, { type, ...lagObjekt(i) });
      satt.push(i);
    }
    return satt.length;
  }

  // Landsbyer: først én garantert i passe avstand fra start, så resten.
  const [lMin, lMaks] = START.landsbyAvstand;
  const naerLandsby = stro('landsby', 1, PLASSERING.landsby,
    (i) => fastland[i] && avstand(i, startIdx) >= lMin && avstand(i, startIdx) <= lMaks);
  if (!naerLandsby) return null;
  const malLandsbyer = Math.max(3, Math.round((antallLand / 100) * PLASSERING.landsby.per100));
  stro('landsby', malLandsbyer - 1, PLASSERING.landsby,
    (i) => fastland[i] && avstand(i, startIdx) >= lMin);

  // Dyr: ett garantert nær start, så resten.
  const dyrArt = (i) => ({ art: terreng[i] === T.SKOG ? 'hjort' : 'villsau' });
  if (!stro('dyr', 1, PLASSERING.dyr, (i) => chebyshev(i, startIdx, B) <= START.radius, dyrArt)) return null;
  stro('dyr', Math.round((antallLand / 100) * PLASSERING.dyr.per100) - 1, PLASSERING.dyr, () => true, dyrArt);

  stro('baer', Math.round((antallLand / 100) * PLASSERING.baer.per100), PLASSERING.baer);

  let antallFjell = 0;
  for (let i = 0; i < N; i++) if (terreng[i] === T.FJELL) antallFjell++;
  stro('malm', Math.max(PLASSERING.malm.minAntall, Math.round(antallFjell * PLASSERING.malm.andelAvFjell)), PLASSERING.malm);

  stro('skatt', Math.max(PLASSERING.skatt.minAntall, Math.round((antallLand / 100) * PLASSERING.skatt.per100)),
    PLASSERING.skatt, (i) => avstand(i, startIdx) >= 4);

  return {
    seed, forsok, bredde: B, hoyde: H,
    terreng, hoydeKart, fukt, fastland, overlegg, start,
    statistikk: lagStatistikk(terreng, overlegg, N, antallLand),
  };
}

function chebyshev(a, b, B) {
  return Math.max(Math.abs((a % B) - (b % B)), Math.abs(Math.floor(a / B) - Math.floor(b / B)));
}

/** Fjerner enkeltruter som står helt alene (én skogrute midt i enga osv.) – ser rotete ut. */
function ryddEnslige(terreng, B, H) {
  const kopi = terreng.slice();
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < B - 1; x++) {
      const i = y * B + x;
      const naboer = [kopi[i - 1], kopi[i + 1], kopi[i - B], kopi[i + B]];
      if (naboer.includes(kopi[i])) continue;
      // Bytt til den vanligste naboen.
      const telling = {};
      for (const n of naboer) telling[n] = (telling[n] || 0) + 1;
      terreng[i] = Number(Object.entries(telling).sort((a, b) => b[1] - a[1])[0][0]);
    }
  }
}

function finnFastland(terreng, B, H) {
  const N = B * H;
  const merke = new Int32Array(N).fill(-1);
  let storst = -1, storstStr = 0, nr = 0;
  for (let s = 0; s < N; s++) {
    if (terreng[s] === T.VANN || merke[s] !== -1) continue;
    let str = 0;
    const ko = [s];
    merke[s] = nr;
    while (ko.length) {
      const i = ko.pop();
      str++;
      const x = i % B, y = Math.floor(i / B);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= B || ny >= H) continue;
        const j = ny * B + nx;
        if (terreng[j] !== T.VANN && merke[j] === -1) { merke[j] = nr; ko.push(j); }
      }
    }
    if (str > storstStr) { storstStr = str; storst = nr; }
    nr++;
  }
  const fastland = new Uint8Array(N);
  for (let i = 0; i < N; i++) fastland[i] = merke[i] === storst ? 1 : 0;
  return fastland;
}

function velgStart(terreng, fastland, B, H, tilf) {
  const r = START.radius;
  const kandidater = [];
  for (let y = r; y < H - r; y++) {
    for (let x = r; x < B - r; x++) {
      const i = y * B + x;
      if (terreng[i] !== T.GRESS || !fastland[i]) continue;
      const telling = [0, 0, 0, 0, 0, 0];
      let steinNaer = false;
      for (let dy = -START.steinInnen; dy <= START.steinInnen; dy++) {
        for (let dx = -START.steinInnen; dx <= START.steinInnen; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= B || ny >= H) continue;
          const t = terreng[ny * B + nx];
          if (Math.abs(dx) <= r && Math.abs(dy) <= r) telling[t]++;
          if (t === T.AAS || t === T.FJELL) steinNaer = true;
        }
      }
      if (telling[T.SKOG] < START.minSkog || telling[T.VANN] < START.minVann || telling[T.GRESS] < START.minGress) continue;
      // Poeng: variasjon rundt start, stein i nærheten, og ikke for langt fra midten.
      const variasjon = telling.filter((n) => n > 0).length;
      const midt = Math.hypot(x - B / 2, y - H / 2) / (B / 2);
      const poeng = variasjon * 2 + (steinNaer ? 3 : 0) - midt * 3 + tilf.tall() * 1.5;
      kandidater.push({ x, y, poeng });
    }
  }
  if (!kandidater.length) return null;
  kandidater.sort((a, b) => b.poeng - a.poeng);
  return { x: kandidater[0].x, y: kandidater[0].y };
}

function lagStatistikk(terreng, overlegg, N, antallLand) {
  const terrengAndel = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < N; i++) terrengAndel[terreng[i]]++;
  const overleggAntall = {};
  for (const o of overlegg.values()) overleggAntall[o.type] = (overleggAntall[o.type] || 0) + 1;
  return {
    terrengAndel: terrengAndel.map((n) => n / N),
    overleggAntall,
    antallLand,
  };
}
