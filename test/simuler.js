// Test og balansesimulering uten nettleser:  node test/simuler.js [seed] [dager]
//  1. Regeltester (avdekking, bygging, lagring fram og tilbake).
//  2. En enkel «grådig» robot spiller N dager og skriver ut hvordan økonomien utvikler seg.

import assert from 'node:assert/strict';
import {
  nyttSpill, avdekk, kanAvdekkes, avdekkKost, bygg, muligeBygg, byggKost, oppgrader, oppgraderKost,
  produksjon, inntektPerDag, nyDag, selg, harRad, aktiveMaal,
  byggVei, kanHaVei, handelsruter, kobletTilLeiren, veiTilLeirenPlan, byggVeiTilLeiren,
  treveierINettet, oppgraderVei, steinKostFor, giMat, selgIMarked, landsby, markedsverdi, leverOppdrag,
} from '../js/spill.js';
import { tilData, fraData } from '../js/lagring.js';
import { BYGG } from '../js/data/balanse.js';

const seed = Number(process.argv[2] ?? 2026);
const DAGER = Number(process.argv[3] ?? 60);

// ---------------------------------------------------------------------------
// 1. Regeltester
// ---------------------------------------------------------------------------
{
  const { spill, verden } = nyttSpill(seed, 32);
  const B = verden.bredde;
  const startI = verden.start.y * B + verden.start.x;
  assert.equal(spill.bygg.get(startI).type, 'leir', 'leiren står på startruta');
  assert.equal(spill.avdekket.reduce((a, b) => a + b, 0), 25, '5×5 avdekket ved start');

  // Kan ikke avdekke langt unna, kan avdekke kanten.
  assert.equal(kanAvdekkes(spill, verden, 0), false);
  const kant = (verden.start.y - 3) * B + verden.start.x;
  assert.equal(kanAvdekkes(spill, verden, kant), true);
  const for_ = spill.lager.mynter;
  const kost = avdekkKost(spill, verden, kant).mynter;
  avdekk(spill, verden, kant);
  assert.equal(spill.avdekket[kant], 1);
  assert.ok(spill.lager.mynter <= for_ - kost + 100, 'mynter trekkes (pluss ev. funn)');

  // Ikke råd → feil, ingenting endres.
  const fattig = nyttSpill(seed, 32);
  fattig.spill.lager.mynter = 0;
  const h = avdekk(fattig.spill, fattig.verden, kant);
  assert.equal(h[0].type, 'feil');
  assert.equal(fattig.spill.avdekket[kant], 0);

  // Lagring fram og tilbake gir samme tilstand.
  const kopi = fraData(JSON.parse(JSON.stringify(tilData(spill))));
  assert.deepEqual(tilData({ ...kopi }).avdekket, tilData(spill).avdekket);
  assert.deepEqual([...kopi.bygg], [...spill.bygg]);
  assert.deepEqual(kopi.lager, spill.lager);
  assert.deepEqual(kopi.stat, spill.stat);
  console.log('✓ regeltester ok');
}

// ---------------------------------------------------------------------------
// 1b. Veier og handel
// ---------------------------------------------------------------------------
{
  const { spill, verden } = nyttSpill(seed, 32);
  const B = verden.bredde;
  // Avdekk alt, så vi kan teste veier fritt.
  spill.avdekket.fill(1);
  spill.lager = { mynter: 999, tre: 999, stein: 999, korn: 999, fisk: 999, kjott: 999, jern: 999 };
  const leir = verden.start.y * B + verden.start.x;
  const landsbyer = [...verden.landsbynavn.keys()].sort((a, b) =>
    Math.hypot((a % B) - verden.start.x, Math.floor(a / B) - verden.start.y) - Math.hypot((b % B) - verden.start.x, Math.floor(b / B) - verden.start.y));
  const naer = landsbyer[0];
  assert.equal(kobletTilLeiren(spill, verden, naer), false, 'ingen vei ennå');
  assert.equal(handelsruter(spill, verden).length, 0);
  const plan = veiTilLeirenPlan(spill, verden, naer);
  assert.ok(plan && plan.ruter.length > 0, 'fant vei til nærmeste landsby');
  assert.ok(plan.ruter.every((r) => kanHaVei(spill, verden, r)), 'planen går bare over lovlige ruter');
  const h = byggVeiTilLeiren(spill, verden, naer);
  assert.ok(h.some((e) => e.type === 'nyRute'), 'ny handelsrute meldes');
  assert.equal(kobletTilLeiren(spill, verden, naer), true);
  const ruter = handelsruter(spill, verden);
  assert.equal(ruter.length, 1);
  const forStein = ruter[0].mynter;
  // Ingen bygg på vei, ingen vei på bygg.
  assert.equal(muligeBygg(spill, verden, plan.ruter[0]).length, 0);
  assert.equal(kanHaVei(spill, verden, leir), false);
  // Steinvei gir mer handel.
  const tre = treveierINettet(spill, verden, plan.ruter[0]);
  const kost = steinKostFor(verden, tre);
  oppgraderVei(spill, verden, tre);
  assert.ok(handelsruter(spill, verden)[0].mynter > forStein, 'steinvei øker handelen');
  assert.ok(Object.values(kost).every((n) => n > 0));
  // Landsbyen vokser av mat, og markedet gir lavere pris for hver vare.
  const l = landsby(spill, verden, naer);
  giMat(spill, verden, naer);
  assert.equal(l.str, 1, 'ikke nok mat ennå');
  giMat(spill, verden, naer);
  assert.equal(l.str, 2, 'vokser etter 20 korn');
  const vare = Object.keys(l.priser)[0];
  const ti = markedsverdi(spill, verden, naer, vare, 10).mynter;
  selgIMarked(spill, verden, naer, vare, 10);
  assert.ok(markedsverdi(spill, verden, naer, vare, 10).mynter < ti, 'prisen faller etter salg');
  nyDag(spill, verden);
  assert.ok(l.priser[vare] > 0.74 && l.priser[vare] < 1, 'prisen henter seg inn over natta');
  // Lagring tar med veier og landsbyer.
  const kopi = fraData(JSON.parse(JSON.stringify(tilData(spill))));
  assert.deepEqual([...kopi.veier], [...spill.veier]);
  assert.deepEqual([...kopi.landsbyer], [...spill.landsbyer]);
  // Gammel lagring (versjon 1) lastes uten tap.
  const gammel = { ...tilData(spill), versjon: 1 };
  delete gammel.veier; delete gammel.landsbyer;
  const migrert = fraData(gammel);
  assert.equal(migrert.veier.size, 0);
  assert.equal(migrert.stat.handel, spill.stat.handel);
  // Vei kan ikke bygges i tåka eller på fjell.
  const fersk = nyttSpill(seed, 32);
  assert.equal(byggVei(fersk.spill, fersk.verden, 0)[0].type, 'feil');
  console.log(`✓ vei- og handelstester ok (rute ${forStein} → ${handelsruter(spill, verden)[0].mynter} 🪙/dag med stein)`);
}

// ---------------------------------------------------------------------------
// 2. Robot-simulering
// ---------------------------------------------------------------------------
const { spill, verden } = nyttSpill(seed, 32);
const N = verden.bredde * verden.hoyde;
const fmt = (o) => Object.entries(o).filter(([, n]) => n).map(([r, n]) => `${r} ${n}`).join(', ');
const maalLogg = [];

function robotDag() {
  // a2) Koble funne landsbyer til leiren, gi dem mat og selg i markedet.
  for (const i of verden.landsbynavn.keys()) {
    if (!spill.avdekket[i]) continue;
    if (!kobletTilLeiren(spill, verden, i)) {
      const plan = veiTilLeirenPlan(spill, verden, i);
      if (plan && plan.ruter.length && harRad(spill, plan.kost)) loggHendelser(byggVeiTilLeiren(spill, verden, i));
      continue;
    }
    // Gi den maten vi har mest av (gir variasjon over tid), og lever oppdrag når vi kan.
    const mat = ['korn', 'fisk', 'kjott'].sort((a, b) => (spill.lager[b] || 0) - (spill.lager[a] || 0))[0];
    if (spill.lager[mat] >= 20) loggHendelser(giMat(spill, verden, i, mat));
    const o = landsby(spill, verden, i).oppdrag;
    if (o && harRad(spill, { [o.vare]: o.antall })) loggHendelser(leverOppdrag(spill, verden, i));
    for (const vare of Object.keys(landsby(spill, verden, i).priser)) {
      if (spill.lager[vare] > 20) loggHendelser(selgIMarked(spill, verden, i, vare, spill.lager[vare] - 20));
    }
  }
  const tre = [...spill.veier].filter(([, t]) => t === 'tre').map(([r]) => r);
  if (tre.length && spill.lager.stein >= 30) {
    const nett = treveierINettet(spill, verden, tre[0]);
    if (harRad(spill, steinKostFor(verden, nett))) loggHendelser(oppgraderVei(spill, verden, nett));
  }
  // a) Selg overskudd over 15 av tre/korn, over 20 stein.
  for (const [r, behold] of [['tre', 15], ['korn', 15], ['stein', 20]]) {
    if (spill.lager[r] > behold) loggHendelser(selg(spill, r, spill.lager[r] - behold));
  }
  // b) Bygg det som gir mest per kostnad, så lenge vi har råd.
  for (let runde = 0; runde < 10; runde++) {
    let best = null;
    for (let i = 0; i < N; i++) {
      for (const type of muligeBygg(spill, verden, i)) {
        const kost = byggKost(spill, type);
        if (!harRad(spill, kost)) continue;
        const prod = Object.values(produksjon(spill, verden, i, type, 1).gave)[0];
        const pris = Object.values(kost).reduce((a, b) => a + b, 0);
        const harTypen = [...spill.bygg.values()].some((b) => b.type === type);
        const poeng = prod / pris + (harTypen ? 0 : 1); // første av hver type først
        if (!best || poeng > best.poeng) best = { i, type, poeng };
      }
    }
    if (!best) break;
    loggHendelser(bygg(spill, verden, best.i, best.type));
  }
  // c) Oppgrader hvis råd.
  for (const [i] of spill.bygg) {
    const kost = oppgraderKost(spill, i);
    if (kost && harRad(spill, kost)) loggHendelser(oppgrader(spill, verden, i));
  }
  // d) Avdekk kantruter (land foretrekkes, som en person ville gjort), behold litt i reserve.
  const reserve = 12;
  for (let runde = 0; runde < 30; runde++) {
    let best = null;
    for (let i = 0; i < N; i++) {
      if (!kanAvdekkes(spill, verden, i)) continue;
      const k = avdekkKost(spill, verden, i).mynter;
      const vekt = k * (verden.terreng[i] === 0 ? 4 : 1);
      if (!best || vekt < best.vekt) best = { i, k, vekt };
    }
    if (!best || spill.lager.mynter - best.k < reserve) break;
    loggHendelser(avdekk(spill, verden, best.i));
  }
  loggHendelser(nyDag(spill, verden));
}

function loggHendelser(h) {
  for (const e of h) {
    if (['maal', 'funn', 'nyRute', 'vekst', 'oppdragFerdig'].includes(e.type)) maalLogg.push(`dag ${spill.dag}: ${e.type === 'maal' ? '🎯 ' : ''}${e.tekst}`);
  }
}

console.log(`\nSeed ${seed}, ${DAGER} dager. Start: ${fmt(spill.lager)}`);
console.log('dag | lager                                  | inntekt/dag                 | avdekket | bygg | neste avdekk | veier | handel/dag');
for (let d = 1; d <= DAGER; d++) {
  robotDag();
  if (d <= 10 || d % 5 === 0) {
    const ant = [...spill.bygg.values()].reduce((m, b) => (m[b.type] = (m[b.type] || 0) + 1, m), {});
    const neste = Math.min(...[...Array(N).keys()].filter((i) => kanAvdekkes(spill, verden, i)).map((i) => avdekkKost(spill, verden, i).mynter));
    console.log(
      `${String(spill.dag).padStart(3)} | ${fmt(spill.lager).padEnd(38)} | ${fmt(inntektPerDag(spill, verden)).padEnd(27)} | ` +
      `${String(spill.stat.avdekket).padStart(8)} | ${Object.entries(ant).map(([t, n]) => `${BYGG[t].ikon}${n}`).join(' ').padEnd(4)} | ${neste} | ${spill.veier.size} | ${handelsruter(spill, verden).reduce((a, r) => a + r.mynter, 0)}`);
  }
}
console.log('\nHendelser:\n' + maalLogg.join('\n'));
console.log('\nAktive mål ved slutt:', aktiveMaal(spill).map((m) => `${m.tekst} (${m.naa}/${m.maal})`).join(' · '));

