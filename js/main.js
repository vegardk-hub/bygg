// Spillet: binder sammen regler (spill.js), tegning (brett.js), kamera, panel,
// effekter, lyd og lagring.

import { Kamera } from './kamera.js';
import { Brett, RUTE, BAKGRUNN } from './brett.js';
import * as S from './spill.js';
import { lagre, hent, lagLagrekode, lesLagrekode } from './lagring.js';
import { flytendeTekst, sprut, harEffekter, tegnEffekter } from './effekter.js';
import { spill as lyd, lydPaa, settLyd } from './lyd.js';
import * as P from './panel.js';

const $ = (id) => document.getElementById(id);
const lerret = $('lerret');
const ctx = lerret.getContext('2d');

const t = window.bygg = {
  spill: null,
  verden: null,
  brett: null,       // kort-lager og tegning av brettet
  valgt: null,       // valgt rute (indeks) eller null
  veimodus: false,   // når på: trykk på en rute bygger trevei
  avdekkAnim: new Map(), // rute → tidspunkt den ble avdekket (for myk tåke-overgang)
  behandle: (h) => behandle(h), // for feilsøking i konsollen: bygg.behandle(S.nyDag(bygg.spill, bygg.verden))
};

const kamera = new Kamera(lerret, { vedTrykk: trykkPaa, vedEndring: tegn });
t.kamera = kamera; // for feilsøking i konsollen
kamera.minSkala = 0.15;
kamera.maksSkala = 5;

const AVDEKK_MS = 420;

// ---------------------------------------------------------------------------
// Oppstart
// ---------------------------------------------------------------------------
async function start() {
  const lagret = hent();
  if (lagret) {
    lastInn(lagret, S.lagVerden(lagret, { ny: true }));
  } else {
    const { spill, verden } = S.nyttSpill(Math.floor(Math.random() * 1_000_000), 32);
    lastInn(spill, verden);
    P.melding('Velkommen! Trykk på en ?-rute i tåka for å utforske.');
  }
  koblKnapper();
  window.addEventListener('resize', () => { kamera.tilpassLerret(); tegn(); });
}

function lastInn(spill, verden) {
  t.spill = spill;
  t.verden = verden;
  t.valgt = null;
  t.avdekkAnim.clear();
  t.brett = new Brett(verden);
  P.skjulRutepanel();
  kamera.tilpassLerret();
  kamera.grenser = { bredde: verden.bredde * RUTE, hoyde: verden.hoyde * RUTE };
  tilLeiren();
  lagre(spill);
  oppdaterAlt();
}

function tilLeiren() {
  const { x, y } = t.verden.start;
  // Store kort som i forbildet: ~7 i bredden på mobil, ~11 på iPad – men 56–110 CSS-px per rute.
  const ruteCss = Math.min(110, Math.max(56, lerret.clientWidth / 9));
  kamera.sentrer((x + 0.5) * RUTE, (y + 0.5) * RUTE, (ruteCss * kamera.dpr) / RUTE);
  tegn();
}

// ---------------------------------------------------------------------------
// Handlinger
// ---------------------------------------------------------------------------
function trykkPaa(kx, ky) {
  const { verden, spill } = t;
  const x = Math.floor(kx / RUTE), y = Math.floor(ky / RUTE);
  if (x < 0 || y < 0 || x >= verden.bredde || y >= verden.hoyde) return velg(null);
  const i = y * verden.bredde + x;
  if (t.veimodus) {
    // Veimodus: trykk på ruter du ser for å legge trevei. Tåka er «av» så man ikke avdekker ved et uhell.
    if (spill.avdekket[i] && S.kanHaVei(spill, verden, i)) behandle(S.byggVei(spill, verden, i));
    else if (spill.avdekket[i]) velg(t.valgt === i ? null : i);
    else P.melding('Veimodus er på – trykk 🛤️ for å avslutte før du utforsker videre.');
    return;
  }
  if (!spill.avdekket[i]) {
    if (S.kanAvdekkes(spill, verden, i)) {
      velg(null);
      behandle(S.avdekk(spill, verden, i));
    } else {
      velg(null);
    }
    return;
  }
  velg(t.valgt === i ? null : i);
}

function velg(i) {
  t.valgt = i;
  if (i === null) P.skjulRutepanel();
  else { visPanel(); holdSynlig(i); }
  tegn();
}

/** Flytter kartet hvis den valgte ruta havner bak rutepanelet. */
function holdSynlig(i) {
  const panelTopp = $('rutepanel').getBoundingClientRect().top - lerret.getBoundingClientRect().top;
  const ruteBunn = ((Math.floor(i / t.verden.bredde) + 1) * RUTE - kamera.y) * kamera.skala / kamera.dpr;
  const luft = 16;
  if (ruteBunn > panelTopp - luft) {
    kamera.y += (ruteBunn - panelTopp + luft + 40) * kamera.dpr / kamera.skala;
  }
}

function visPanel() {
  if (t.valgt === null) return;
  const { spill, verden } = t;
  P.visRutepanel(spill, verden, t.valgt, {
    bygg: (type) => behandle(S.bygg(spill, verden, t.valgt, type)),
    oppgrader: () => behandle(S.oppgrader(spill, verden, t.valgt)),
    selg: (r, n) => behandle(S.selg(spill, r, n)),
    byggVei: () => behandle(S.byggVei(spill, verden, t.valgt)),
    steinvei: (alle) => behandle(S.oppgraderVei(spill, verden, alle ? S.treveierINettet(spill, verden, t.valgt) : [t.valgt])),
    veiHit: () => behandle(S.byggVeiTilLeiren(spill, verden, t.valgt)),
    mat: (vare) => behandle(S.giMat(spill, verden, t.valgt, vare)),
    oppdrag: () => behandle(S.leverOppdrag(spill, verden, t.valgt)),
    skip: () => behandle(S.byggSkip(spill)),
    skipOpp: () => behandle(S.oppgraderSkip(spill)),
    last: (vare, n) => behandle(S.lastSkip(spill, vare, n)),
    havkart: aapneHavkart,
    marked: (vare, n) => behandle(S.selgIMarked(spill, verden, t.valgt, vare, n)),
  });
}

function nyDag() {
  behandle(S.nyDag(t.spill, t.verden));
}

// ---------------------------------------------------------------------------
// Havkart og seiling
// ---------------------------------------------------------------------------
function aapneHavkart() {
  P.visHavkart(t.spill, t.verden, { seil });
  if (!$('havkart').open) $('havkart').showModal();
}

function seil(mal) {
  const h = S.seil(t.spill, t.verden, mal);
  if (h[0].type === 'feil') { behandle(h); return; }
  $('havkart').close();
  $('meny').close();
  // Liten seilas på skjermen mens vi bytter verden.
  $('seiling-tekst').textContent = h[0].ny ? 'Seiler ut på ukjent hav …' : `Seiler til ${h[0].til} …`;
  $('seiling').hidden = false;
  lyd('dag');
  setTimeout(() => {
    t.verden = S.lagVerden(t.spill);
    t.brett = new Brett(t.verden);
    t.valgt = null;
    t.avdekkAnim.clear();
    P.skjulRutepanel();
    kamera.grenser = { bredde: t.verden.bredde * RUTE, hoyde: t.verden.hoyde * RUTE };
    tilHavna();
    $('seiling').hidden = true;
    behandle(h);
  }, 1400);
}

function tilHavna() {
  const havn = [...t.spill.bygg].find(([, b]) => b.type === 'havn')?.[0];
  if (havn === undefined) return tilLeiren();
  tilLeiren();
  kamera.sentrer(((havn % t.verden.bredde) + 0.5) * RUTE, (Math.floor(havn / t.verden.bredde) + 0.5) * RUTE);
  tegn();
}

function settVeimodus(paa) {
  t.veimodus = paa;
  $('veimodus').classList.toggle('aktiv', paa);
  $('veimodus-hint').hidden = !paa;
  if (paa) velg(null);
}

/** Viser alle følgene av en handling: lyd, effekter, meldinger – og lagrer. */
function behandle(hendelser) {
  const { verden } = t;
  const midt = (i) => ({ kx: ((i % verden.bredde) + 0.5) * RUTE, ky: (Math.floor(i / verden.bredde) + 0.3) * RUTE });
  let produsert = 0;
  let maalForsinkelse = 250;

  for (const h of hendelser) {
    switch (h.type) {
      case 'feil': {
        const mangler = h.mangler ? P.manglerTekst(h.mangler, t.spill.lager) : '';
        P.melding(mangler ? `Du mangler ${mangler}` : h.tekst, 'feil');
        P.rist($('rutepanel').hidden ? 'avdekk-pris' : 'rutepanel');
        lyd('feil');
        break;
      }
      case 'avdekket':
        t.avdekkAnim.set(h.i, performance.now());
        lyd('avdekk');
        break;
      case 'funn': {
        const { kx, ky } = midt(h.i);
        P.melding(h.tekst);
        if (h.gave) flytendeTekst(kx, ky, P.gaveTekst(h.gave), { farge: '#ffe27a', forsinkelse: 150 });
        sprut(kx, ky, { farger: ['#ffd23f', '#fff3b0', '#e0a030'], antall: 18 });
        setTimeout(() => lyd('funn'), 120);
        break;
      }
      case 'bygget': {
        const { kx, ky } = midt(h.i);
        sprut(kx, ky + RUTE * 0.3);
        lyd('bygg');
        break;
      }
      case 'oppgradert': {
        const { kx, ky } = midt(h.i);
        flytendeTekst(kx, ky, `Nivå ${h.nivaa}!`, { farge: '#ffe27a' });
        sprut(kx, ky, { farger: ['#ffd23f', '#ffffff', '#e0a030'], antall: 20 });
        lyd('oppgrader');
        break;
      }
      case 'solgt': {
        const sted = h.i ?? [...t.spill.bygg].find(([, b]) => b.type === 'leir')[0];
        const { kx, ky } = midt(sted);
        flytendeTekst(kx, ky, `+${h.mynter} 🪙`, { farge: '#ffe27a' });
        lyd('mynt');
        break;
      }
      case 'vei':
        for (const r of h.ruter.slice(0, 12)) {
          const { kx, ky } = midt(r);
          sprut(kx, ky + RUTE * 0.3, { antall: 8 });
        }
        lyd('bygg');
        break;
      case 'steinvei':
        for (const r of h.ruter.slice(0, 12)) {
          const { kx, ky } = midt(r);
          sprut(kx, ky + RUTE * 0.3, { farger: ['#b8b2a6', '#d6d1c6', '#8d877c'], antall: 8 });
        }
        lyd('oppgrader');
        break;
      case 'dyrFlytter':
        P.melding(h.tekst);
        break;
      case 'nyRute': {
        const { kx, ky } = midt(h.b);
        flytendeTekst(kx, ky, `+${h.mynter} 🪙/dag`, { farge: '#ffe27a', forsinkelse: 200 });
        setTimeout(() => { P.melding(`🤝 ${h.tekst}`, 'maal'); lyd('funn'); }, 150);
        break;
      }
      case 'handel': {
        const { kx, ky } = midt(h.b);
        flytendeTekst(kx, ky, `+${h.mynter} 🪙`, { farge: '#ffe27a', forsinkelse: 80 * produsert++ });
        break;
      }
      case 'mat': {
        const { kx, ky } = midt(h.i);
        flytendeTekst(kx, ky, `🧺 +${h.mat} mat${h.variasjon ? ' 🌈' : ''}`, { farge: '#fff3b0' });
        lyd('bygg');
        break;
      }
      case 'oppdrag':
        P.melding(h.tekst);
        break;
      case 'skip':
        P.melding(h.tekst, 'maal');
        lyd('oppgrader');
        break;
      case 'last':
        lyd('mynt');
        break;
      case 'seilt': {
        const last = P.gaveTekst(h.last);
        setTimeout(() => {
          P.melding(h.tekst, 'maal');
          if (last) P.melding(`Lasten er losset: ${last}`);
          lyd(h.ny ? 'funn' : 'maal');
        }, 200);
        break;
      }
      case 'oppdragFerdig': {
        const { kx, ky } = midt(h.i);
        flytendeTekst(kx, ky, `+${h.mynter} 🪙`, { farge: '#ffe27a' });
        sprut(kx, ky, { farger: ['#ffd23f', '#fff3b0', '#e0a030'], antall: 22 });
        setTimeout(() => { P.melding(h.tekst, 'maal'); lyd('maal'); }, 150);
        break;
      }
      case 'vekst': {
        const { kx, ky } = midt(h.i);
        sprut(kx, ky, { farger: ['#ffd23f', '#e57a9a', '#9fc3e0', '#ffffff'], antall: 24, fart: 1.3 });
        setTimeout(() => { P.melding(h.tekst, 'maal'); lyd('maal'); }, 200);
        break;
      }
      case 'nyDag':
        lyd('dag');
        $('ny-dag').classList.remove('vipp');
        void $('ny-dag').offsetWidth;
        $('ny-dag').classList.add('vipp');
        break;
      case 'produsert': {
        const { kx, ky } = midt(h.i);
        flytendeTekst(kx, ky, P.gaveTekst(h.gave), { forsinkelse: 80 * produsert++ });
        break;
      }
      case 'maal':
        setTimeout(() => {
          P.melding(`🎯 ${h.tekst}! ${P.gaveTekst(h.gave)}`, 'maal');
          lyd('maal');
        }, maalForsinkelse);
        maalForsinkelse += 700;
        break;
    }
  }
  if (!lagre(t.spill)) P.melding('Klarte ikke å lagre – er lagring slått av i nettleseren?', 'feil');
  oppdaterAlt();
}

function oppdaterAlt() {
  const { spill, verden } = t;
  P.oppdaterHud(spill, S.inntektPerDag(spill, verden));
  P.oppdaterMaal(S.aktiveMaal(spill));
  P.oppdaterAvdekkPris(S.avdekkPris(spill, false), S.avdekkPris(spill, true));
  if (t.valgt !== null) visPanel();
  tegn();
}

// ---------------------------------------------------------------------------
// Tegning
// ---------------------------------------------------------------------------
let planlagt = false;
function tegn() {
  if (planlagt) return;
  planlagt = true;
  requestAnimationFrame(() => {
    planlagt = false;
    tegnNaa();
    // Skarpere kort etter zoom tegnes litt om gangen, så det aldri hakker.
    const mer = t.brett?.jobb(12);
    if (harEffekter() || t.avdekkAnim.size || mer) tegn();
  });
}

function tegnNaa() {
  const { verden, spill, brett } = t;
  if (!verden || !brett) return;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = BAKGRUNN;
  ctx.fillRect(0, 0, lerret.width, lerret.height);
  kamera.anvend(ctx);

  const utsnitt = {
    x0: Math.floor(kamera.x / RUTE) - 1,
    y0: Math.floor(kamera.y / RUTE) - 1,
    x1: Math.ceil((kamera.x + lerret.width / kamera.skala) / RUTE),
    y1: Math.ceil((kamera.y + lerret.height / kamera.skala) / RUTE),
  };
  brett.tegn(ctx, spill, {
    utsnitt, skala: kamera.skala, valgt: t.valgt,
    avdekkAnim: t.avdekkAnim, naa: performance.now(), avdekkMs: AVDEKK_MS,
  });

  // Skjermkoordinater herfra: landsbynavn og effekter (skarp tekst uansett zoom).
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const tilSkjerm = (kx, ky) => ({ x: (kx - kamera.x) * kamera.skala, y: (ky - kamera.y) * kamera.skala });
  if (kamera.skala * RUTE > 50 * kamera.dpr) tegnLandsbynavn(tilSkjerm);
  tegnEffekter(ctx, tilSkjerm, kamera.skala, kamera.dpr);
}

/** Navneskilt nederst på landsbykortet: lys lapp med mørk tekst, som klammerne. */
function tegnLandsbynavn(tilSkjerm) {
  const { verden, spill } = t;
  const d = kamera.dpr;
  ctx.font = `650 ${Math.round(12 * d)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const [i, navn] of verden.landsbynavn) {
    if (!spill.avdekket[i]) continue;
    const { x, y } = tilSkjerm(((i % verden.bredde) + 0.5) * RUTE, (Math.floor(i / verden.bredde) + 0.92) * RUTE);
    const b = ctx.measureText(navn).width + 12 * d, h = 18 * d;
    ctx.fillStyle = 'rgba(250, 242, 219, 0.94)';
    ctx.beginPath();
    ctx.roundRect(x - b / 2, y - h / 2, b, h, h / 2);
    ctx.fill();
    ctx.fillStyle = '#3b2a14';
    ctx.fillText(navn, x, y + 0.5 * d);
  }
}

// ---------------------------------------------------------------------------
// Knapper og meny
// ---------------------------------------------------------------------------
function koblKnapper() {
  $('ny-dag').onclick = nyDag;
  $('hjem').onclick = tilLeiren;
  $('veimodus').onclick = () => settVeimodus(!t.veimodus);
  $('lukk-panel').onclick = () => velg(null);
  $('meny-knapp').onclick = aapneMeny;
  $('meny-havkart').onclick = () => { $('meny').close(); aapneHavkart(); };
  $('lukk-havkart').onclick = () => $('havkart').close();
  // Mål-kortet kan klappes sammen; på smale skjermer starter det sammenklappet.
  let sammen = window.innerWidth < 1000;
  try { const v = localStorage.getItem('bygg-maal-sammen'); if (v !== null) sammen = v === '1'; } catch { /* ignorer */ }
  $('maal').classList.toggle('sammen', sammen);
  $('maal-tittel').onclick = () => {
    const ny = !$('maal').classList.contains('sammen');
    $('maal').classList.toggle('sammen', ny);
    try { localStorage.setItem('bygg-maal-sammen', ny ? '1' : '0'); } catch { /* ignorer */ }
  };
  $('lukk-meny').onclick = () => $('meny').close();
  $('lyd-knapp').onclick = () => { settLyd(!lydPaa()); oppdaterMeny(); };
  $('vis-kode').onclick = () => visKodefelt('vis');
  $('les-kode').onclick = () => visKodefelt('les');
  $('nytt-spill').onclick = () => {
    if (!confirm('Starte på nytt i en ny verden? Det du har bygget nå blir borte.')) return;
    const { spill, verden } = S.nyttSpill(Math.floor(Math.random() * 1_000_000), 32);
    lastInn(spill, verden);
    $('meny').close();
    P.melding('En ny verden venter! 🌍');
  };
  // Tastatur på PC: mellomrom = ny dag, Esc = lukk panel.
  window.addEventListener('keydown', (e) => {
    if ($('meny').open || $('havkart').open || e.target.tagName === 'TEXTAREA') return;
    if (e.code === 'Space') { e.preventDefault(); nyDag(); }
    if (e.code === 'Escape') { velg(null); settVeimodus(false); }
    if (e.code === 'KeyV') settVeimodus(!t.veimodus);
  });
}

function aapneMeny() {
  $('kode-felt').hidden = true;
  oppdaterMeny();
  $('meny').showModal();
}

function oppdaterMeny() {
  const { spill } = t;
  $('meny-info').textContent = `Verden nr. ${spill.seed} · dag ${spill.dag} · ${spill.stat.avdekket} ruter avdekket · ${spill.bygg.size - 1} bygg`;
  $('lyd-knapp').textContent = lydPaa() ? '🔊 Lyd: på' : '🔇 Lyd: av';
}

function visKodefelt(modus) {
  const felt = $('kode-felt');
  felt.hidden = false;
  const kode = $('kode');
  if (modus === 'vis') {
    $('kode-tekst').textContent = 'Ta vare på denne koden – med den kan du hente spillet tilbake, også på en annen enhet.';
    kode.value = lagLagrekode(t.spill);
    kode.readOnly = true;
    $('kode-ok').textContent = '📋 Kopier';
    $('kode-ok').onclick = async () => {
      try { await navigator.clipboard.writeText(kode.value); P.melding('Kopiert!'); } catch { kode.select(); }
    };
  } else {
    $('kode-tekst').textContent = 'Lim inn en lagrekode. Spillet du har nå blir erstattet.';
    kode.value = '';
    kode.readOnly = false;
    $('kode-ok').textContent = '📥 Last inn';
    $('kode-ok').onclick = () => {
      try {
        const spill = lesLagrekode(kode.value);
        lastInn(spill, S.lagVerden(spill, { ny: true }));
        $('meny').close();
        P.melding('Spillet er lastet inn!');
      } catch {
        P.melding('Koden virker ikke – sjekk at hele koden er med.', 'feil');
      }
    };
  }
}

start().catch((e) => {
  document.body.insertAdjacentHTML('beforeend', `<p style="color:#fff;padding:1em;position:fixed;top:0">Feil: ${e.message}</p>`);
  console.error(e);
});
