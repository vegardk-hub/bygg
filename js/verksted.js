// Kartverkstedet (fase 0): generer verdener, se dem, panorer/zoom, sjekk
// fordelinger og test mange seeds på rad. Ikke selve spillet – et verktøy for å
// se at kartgeneratoren lager naturlige, varierte og rettferdige verdener.

import { genererVerden } from './kartgen.js';
import { tegnVerden, tegnAlleOverlegg, RUTE } from './tegn.js';
import { lastArk } from './grafikk.js';
import { Kamera } from './kamera.js';
import { TERRENG, OVERLEGG, ANDEL, START, T } from './data/terreng.js';

const $ = (id) => document.getElementById(id);
const lerret = $('lerret');
const ctx = lerret.getContext('2d');

const tilstand = window.verksted = {
  ark: null,
  verden: null,
  kartbilde: null,
  avdekket: new Set(),
  valgt: null,
};

const kamera = new Kamera(lerret, { vedTrykk: trykkPaa, vedEndring: tegn });

// ---------------------------------------------------------------------------
// Oppstart
// ---------------------------------------------------------------------------
async function start() {
  tilstand.ark = await lastArk();
  const fraAdresse = new URLSearchParams(location.hash.slice(1));
  $('seed').value = fraAdresse.get('seed') ?? tilfeldigSeed();
  $('storrelse').value = fraAdresse.get('str') ?? '32';
  koblKnapper();
  window.addEventListener('resize', () => { kamera.tilpassLerret(); tegn(); });
  kamera.tilpassLerret();
  lagVerden();
}

const tilfeldigSeed = () => Math.floor(Math.random() * 1_000_000);

function lagVerden() {
  const seed = Math.max(0, Math.floor(Number($('seed').value) || 0));
  const str = Number($('storrelse').value);
  history.replaceState(null, '', `#seed=${seed}&str=${str}`);
  const t0 = performance.now();
  tilstand.verden = genererVerden(seed, { bredde: str, hoyde: str });
  const t1 = performance.now();
  tilstand.avdekket = startOmrade(tilstand.verden);
  tilstand.valgt = null;
  lagKartbilde();
  const t2 = performance.now();
  kamera.grenser = { bredde: str * RUTE, hoyde: str * RUTE };
  tilStart();
  visInfo(t1 - t0, t2 - t1);
  tegn();
}

function lagKartbilde() {
  const fargekart = $('vis-farger').checked;
  tilstand.kartbilde = tegnVerden(tilstand.verden, tilstand.ark, { fargekart });
  if (!fargekart) tegnAlleOverlegg(tilstand.kartbilde, tilstand.verden, tilstand.ark);
}

function startOmrade(verden) {
  const sett = new Set();
  const r = START.avdekketRadius;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) sett.add((verden.start.y + dy) * verden.bredde + verden.start.x + dx);
  }
  return sett;
}

function tilStart() {
  const v = tilstand.verden;
  const passer = Math.min(lerret.width / (v.bredde * RUTE), lerret.height / (v.hoyde * RUTE));
  kamera.sentrer((v.start.x + 0.5) * RUTE, (v.start.y + 0.5) * RUTE, Math.max(passer, Math.min(3, lerret.width / (14 * RUTE))));
}

// ---------------------------------------------------------------------------
// Knapper
// ---------------------------------------------------------------------------
function koblKnapper() {
  $('tilfeldig').onclick = () => { $('seed').value = tilfeldigSeed(); lagVerden(); };
  $('forrige').onclick = () => { $('seed').value = Math.max(0, Number($('seed').value) - 1); lagVerden(); };
  $('neste').onclick = () => { $('seed').value = Number($('seed').value) + 1; lagVerden(); };
  $('seed').onchange = lagVerden;
  $('storrelse').onchange = lagVerden;
  $('vis-farger').onchange = () => { lagKartbilde(); tegn(); };
  $('vis-taake').onchange = () => { tilstand.avdekket = startOmrade(tilstand.verden); tegn(); };
  $('vis-rutenett').onchange = tegn;
  $('vis-info').onchange = () => { $('info').hidden = !$('vis-info').checked; };
  $('partest').onclick = partest;
  $('hele-kartet').onclick = () => {
    const v = tilstand.verden;
    kamera.passInn(v.bredde * RUTE, v.hoyde * RUTE);
    tegn();
  };
  $('til-start').onclick = () => { tilStart(); tegn(); };
}

// ---------------------------------------------------------------------------
// Trykk og tåke
// ---------------------------------------------------------------------------
function trykkPaa(kx, ky) {
  const v = tilstand.verden;
  const x = Math.floor(kx / RUTE), y = Math.floor(ky / RUTE);
  if (x < 0 || y < 0 || x >= v.bredde || y >= v.hoyde) return;
  const i = y * v.bredde + x;
  // Forsmak på spillet: med tåke på kan man avdekke ruter som grenser til det synlige.
  if ($('vis-taake').checked && !tilstand.avdekket.has(i)) {
    if (grenserTilAvdekket(x, y)) tilstand.avdekket.add(i);
    else { tilstand.valgt = null; tegn(); return; }
  }
  tilstand.valgt = { x, y };
  visRute(x, y);
  tegn();
}

function grenserTilAvdekket(x, y) {
  const v = tilstand.verden;
  return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
    const nx = x + dx, ny = y + dy;
    return nx >= 0 && ny >= 0 && nx < v.bredde && ny < v.hoyde && tilstand.avdekket.has(ny * v.bredde + nx);
  });
}

// ---------------------------------------------------------------------------
// Tegning
// ---------------------------------------------------------------------------
function tegn() {
  const v = tilstand.verden;
  if (!v || !tilstand.kartbilde) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#1b2430';
  ctx.fillRect(0, 0, lerret.width, lerret.height);
  kamera.anvend(ctx);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tilstand.kartbilde, 0, 0);

  if ($('vis-taake').checked) tegnTaake(v);

  if ($('vis-rutenett').checked) {
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1 / kamera.skala;
    ctx.beginPath();
    for (let x = 0; x <= v.bredde; x++) { ctx.moveTo(x * RUTE, 0); ctx.lineTo(x * RUTE, v.hoyde * RUTE); }
    for (let y = 0; y <= v.hoyde; y++) { ctx.moveTo(0, y * RUTE); ctx.lineTo(v.bredde * RUTE, y * RUTE); }
    ctx.stroke();
  }

  ramme(v.start.x, v.start.y, '#ffffff', 2);
  if (tilstand.valgt) ramme(tilstand.valgt.x, tilstand.valgt.y, '#ffd23f', 3);
}

function ramme(x, y, farge, tykkelse) {
  ctx.strokeStyle = farge;
  ctx.lineWidth = (tykkelse / kamera.skala) * kamera.dpr;
  ctx.strokeRect(x * RUTE + 1, y * RUTE + 1, RUTE - 2, RUTE - 2);
}

function tegnTaake(v) {
  for (let y = 0; y < v.hoyde; y++) {
    for (let x = 0; x < v.bredde; x++) {
      if (tilstand.avdekket.has(y * v.bredde + x)) continue;
      const kant = grenserTilAvdekket(x, y);
      ctx.fillStyle = kant ? 'rgba(40,52,70,0.78)' : 'rgba(27,36,48,0.97)';
      ctx.fillRect(x * RUTE, y * RUTE, RUTE, RUTE);
      if (kant) {
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = '14px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', x * RUTE + RUTE / 2, y * RUTE + RUTE / 2);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Infopanel
// ---------------------------------------------------------------------------
function visInfo(msGen, msTegn) {
  const v = tilstand.verden;
  const st = v.statistikk;
  $('info-seed').textContent = `nr. ${v.seed}`;
  $('info-forsok').textContent =
    `${v.bredde}×${v.hoyde} · ${st.antallLand} landruter · forsøk ${v.forsok + 1}\n` +
    `generert på ${msGen.toFixed(0)} ms, tegnet på ${msTegn.toFixed(0)} ms`;

  const midt = 1 - ANDEL.vann - ANDEL.strand - ANDEL.aas - ANDEL.fjell;
  const mal = {
    [T.VANN]: ANDEL.vann, [T.STRAND]: ANDEL.strand, [T.AAS]: ANDEL.aas, [T.FJELL]: ANDEL.fjell,
    [T.SKOG]: midt * ANDEL.skogAvMidtland, [T.GRESS]: midt * (1 - ANDEL.skogAvMidtland),
  };
  $('info-terreng').innerHTML = TERRENG.map((t) =>
    `<tr><td>${t.ikon} ${t.navn}</td><td class="tall">${pst(st.terrengAndel[t.id])}</td><td class="mal">mål ${pst(mal[t.id])}</td></tr>`).join('');
  $('info-overlegg').innerHTML = Object.entries(OVERLEGG).map(([k, o]) =>
    `<tr><td>${o.ikon} ${o.navn}</td><td class="tall">${st.overleggAntall[k] || 0}</td></tr>`).join('');
  $('info-rute').textContent = 'Trykk på en rute.';
}

function visRute(x, y) {
  const v = tilstand.verden;
  const i = y * v.bredde + x;
  const t = TERRENG[v.terreng[i]];
  const o = v.overlegg.get(i);
  const linjer = [
    `(${x}, ${y}) ${t.ikon} ${t.navn}${t.gir ? ` – gir ${t.gir}` : ''}`,
    o ? `${OVERLEGG[o.type].ikon} ${OVERLEGG[o.type].navn}${o.art ? ` (${o.art})` : ''}` : '',
    `høyde ${v.hoydeKart[i].toFixed(2)} · fukt ${v.fukt[i].toFixed(2)}`,
    v.fastland[i] ? 'fastland' : (v.terreng[i] === T.VANN ? '' : 'holme'),
  ];
  if (x === v.start.x && y === v.start.y) linjer.push('★ startrute');
  $('info-rute').textContent = linjer.filter(Boolean).join('\n');
}

const pst = (x) => `${Math.round(x * 100)} %`;

// Genererer mange verdener og oppsummerer – fanger feil og skjeve fordelinger.
function partest() {
  const str = Number($('storrelse').value);
  const fra = Number($('seed').value);
  const n = 100;
  const tall = { forsok: [], landsby: [], dyr: [], skatt: [], malm: [], land: [], ms: [] };
  let feil = 0;
  for (let s = fra; s < fra + n; s++) {
    const t0 = performance.now();
    try {
      const v = genererVerden(s, { bredde: str, hoyde: str });
      tall.ms.push(performance.now() - t0);
      tall.forsok.push(v.forsok + 1);
      tall.land.push(v.statistikk.antallLand);
      for (const k of ['landsby', 'dyr', 'skatt', 'malm']) tall[k].push(v.statistikk.overleggAntall[k] || 0);
    } catch {
      feil++;
    }
  }
  const sammendrag = (a) => a.length ? `${Math.min(...a)}–${Math.max(...a)} (snitt ${(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1)})` : '–';
  $('partest-resultat').textContent = [
    `${n} verdener fra nr. ${fra}, ${str}×${str}`,
    `feilet: ${feil}`,
    `forsøk: ${sammendrag(tall.forsok)}`,
    `landruter: ${sammendrag(tall.land)}`,
    `landsbyer: ${sammendrag(tall.landsby)}`,
    `dyr: ${sammendrag(tall.dyr)}`,
    `malm: ${sammendrag(tall.malm)}`,
    `skatter: ${sammendrag(tall.skatt)}`,
    `ms per verden: ${sammendrag(tall.ms.map((x) => Math.round(x)))}`,
  ].join('\n');
}

start().catch((e) => {
  document.body.insertAdjacentHTML('beforeend', `<p style="color:#fff;padding:1em">Feil: ${e.message}</p>`);
  console.error(e);
});
