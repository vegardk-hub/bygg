// Alt som er HTML rundt kartet: råvarelinja, mål, rutepanelet, meldinger og menyen.
// Får data inn og kaller tilbake til main.js ved trykk – inneholder ingen spillregler.

import {
  RAVARER, RAVARE_REKKEFOLGE, SKJULT_TIL_FUNNET, BYGG, PRIS, MAKS_NIVAA, VEI, LANDSBY, MARKED,
  SKIP, BIOM,
} from './data/balanse.js';
import { TERRENG, T } from './data/terreng.js';
import * as S from './spill.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const gaveTekst = (gave) =>
  Object.entries(gave).filter(([, n]) => n).map(([r, n]) => `${n > 0 ? '+' : ''}${n} ${RAVARER[r].ikon}`).join(' ');

/** Hva mangler for å ha råd? → «3 🪵 og 2 🌾» */
export function manglerTekst(kost, lager) {
  const deler = Object.entries(kost)
    .map(([r, n]) => [r, n - (lager[r] || 0)])
    .filter(([, n]) => n > 0)
    .map(([r, n]) => `${n} ${RAVARER[r].ikon}`);
  return deler.length > 1 ? `${deler.slice(0, -1).join(', ')} og ${deler.at(-1)}` : deler[0] ?? '';
}

function kostHtml(kost, lager) {
  return `<span class="kostnad">${Object.entries(kost).map(([r, n]) =>
    `<span class="kost${(lager[r] || 0) < n ? ' mangler' : ''}">${n} ${RAVARER[r].ikon}</span>`).join('')}</span>`;
}

// ---------------------------------------------------------------------------
// Råvarelinja
// ---------------------------------------------------------------------------
const forrigeLager = {};
const sett = new Set(); // råvarer som har vært synlige (blir værende)

export function oppdaterHud(spill, inntekt) {
  const boks = $('ravarer');
  if (!boks.children.length) {
    boks.innerHTML = RAVARE_REKKEFOLGE.map((r) =>
      `<div class="ravare" data-r="${r}" title="${RAVARER[r].navn}"><span class="ikon">${RAVARER[r].ikon}</span>` +
      '<span class="tall"></span><span class="per-dag"></span></div>').join('');
  }
  for (const r of RAVARE_REKKEFOLGE) {
    const el = boks.querySelector(`[data-r="${r}"]`);
    const n = spill.lager[r] || 0;
    if (n > 0 || inntekt[r] > 0) sett.add(r);
    el.hidden = SKJULT_TIL_FUNNET.includes(r) && !sett.has(r);
    el.querySelector('.tall').textContent = n;
    el.querySelector('.per-dag').textContent = inntekt[r] ? `+${inntekt[r]}` : '';
    el.title = `${RAVARER[r].navn}${inntekt[r] ? ` – får ${inntekt[r]} per dag` : ''}`;
    if (r in forrigeLager && forrigeLager[r] !== n) {
      const klasse = n > forrigeLager[r] ? 'pulser' : 'minus';
      el.classList.remove('pulser', 'minus');
      void el.offsetWidth; // start animasjonen på nytt
      el.classList.add(klasse);
      setTimeout(() => el.classList.remove(klasse), 400);
    }
    forrigeLager[r] = n;
  }
  $('dag').textContent = spill.dag;
  $('verdensnavn').textContent = `${BIOM[spill.biom]?.ikon ?? ''} ${spill.navn} ·`;
}

export function oppdaterAvdekkPris(land, vann) {
  $('avdekk-pris').textContent = `🔍 Ny rute: ${land} 🪙 · vann ${vann} 🪙`;
}

// ---------------------------------------------------------------------------
// Mål
// ---------------------------------------------------------------------------
let visteMaal = new Set();

export function oppdaterMaal(aktive) {
  const liste = $('maal-liste');
  liste.innerHTML = aktive.map((m) => {
    const pst = Math.round((m.naa / m.maal) * 100);
    return `<li data-id="${m.id}" class="${visteMaal.has(m.id) ? '' : 'ny'}">
      <div class="linje"><span>${esc(m.tekst)}</span><span class="belonning">${gaveTekst(m.belonning)}</span></div>
      <div class="stolpe"><i style="width:${pst}%"></i></div>
      ${m.maal > 1 ? `<div class="liten">${m.naa} / ${m.maal}</div>` : ''}
    </li>`;
  }).join('') || '<li>Alle mål er nådd – flott! 🎉</li>';
  visteMaal = new Set(aktive.map((m) => m.id));
}

// ---------------------------------------------------------------------------
// Meldinger
// ---------------------------------------------------------------------------
export function melding(tekst, type = '') {
  const boks = $('meldinger');
  const el = document.createElement('div');
  el.className = `melding ${type}`;
  el.textContent = tekst;
  boks.append(el);
  while (boks.children.length > 4) boks.firstChild.remove();
  setTimeout(() => { el.classList.add('ut'); setTimeout(() => el.remove(), 450); }, type === 'maal' ? 3800 : 2600);
}

export function rist(id) {
  const el = $(id);
  el.classList.remove('ristes');
  void el.offsetWidth;
  el.classList.add('ristes');
}

// ---------------------------------------------------------------------------
// Rutepanelet
// ---------------------------------------------------------------------------
const TERRENG_TEKST = {
  [T.VANN]: 'Vann. Bygg en fiskebu på land ved vannet for å fiske 🐟',
  [T.STRAND]: 'Strand. Her kan det bygges havn senere ⚓',
  [T.GRESS]: 'Eng – god jord for gårder.',
  [T.SKOG]: 'Skog – her finnes det tre.',
  [T.AAS]: 'Ås – steinete bakker.',
  [T.FJELL]: 'Fjell – mye stein.',
};

/** Knapp-HTML for et valg i panelet. */
function valgKnapp({ ikon, navn, gir = '', kost = null, lager, forklaring = '', data }) {
  const dempet = kost && !Object.entries(kost).every(([r, n]) => (lager[r] || 0) >= n);
  return `<button class="byggvalg${dempet ? ' dempet' : ''}" ${data}>
    <span class="stort-ikon">${ikon}</span><span class="navn">${navn}</span>
    <span class="gir">${gir}</span>
    <span class="forklaring">${kost ? kostHtml(kost, lager) : ''} ${esc(forklaring)}</span></button>`;
}

/** Handelsrutene som går til/fra rute i, som korte linjer. */
function handelHtml(spill, verden, i) {
  const ruter = S.handelsruter(spill, verden).filter((r) => r.a === i || r.b === i);
  if (!ruter.length) return '';
  const sum = ruter.reduce((a, r) => a + r.mynter, 0);
  return `<p class="produksjon">+${sum} 🪙 per dag fra handel</p><p class="liten">${ruter.map((r) =>
    `↔ ${esc(S.stedNavn(spill, verden, r.a === i ? r.b : r.a))}: +${r.mynter} 🪙 (${r.lengde} ruter vei${r.stein ? `, ${r.stein} stein` : ''})`).join('<br>')}</p>`;
}

function landsbyHtml(spill, verden, i) {
  const l = S.landsby(spill, verden, i);
  const koblet = S.kobletTilLeiren(spill, verden, i);
  let html = `<h2>🏘️ ${esc(verden.landsbynavn.get(i))} <span class="liten">størrelse ${l.str} ${'★'.repeat(l.str)}</span></h2>`;
  if (!koblet) {
    html += '<p class="info-linje">Landsbyen er ikke koblet til leiren ennå. Med vei kan dere handle, og du kan gi dem mat så de vokser.</p>';
    const plan = S.veiTilLeirenPlan(spill, verden, i);
    if (plan && plan.ruter.length) {
      html += `<div class="valg">${valgKnapp({
        ikon: '🛤️', navn: 'Bygg vei hit fra leiren', gir: `${plan.ruter.length} ruter`, kost: plan.kost, lager: spill.lager,
        forklaring: plan.broer ? `med ${plan.broer} bru` : 'billigste vei over det du har utforsket', data: 'data-vei-hit',
      })}</div>`;
    } else {
      html += '<p class="liten">Fant ingen vei hit ennå – avdekk mer av kartet mellom landsbyen og leiren.</p>';
    }
    return html;
  }
  html += handelHtml(spill, verden, i) || '<p class="liten">Koblet til leiren med vei.</p>';
  // Oppdrag
  if (l.oppdrag) {
    const o = l.oppdrag;
    html += `<h3 class="seksjon">📜 Oppdrag</h3><div class="valg">${valgKnapp({
      ikon: '📜', navn: `Lever ${o.antall} ${RAVARER[o.vare].ikon} ${RAVARER[o.vare].navn.toLowerCase()}`, gir: `+${o.mynter} 🪙`,
      kost: { [o.vare]: o.antall }, lager: spill.lager, forklaring: 'Landsbyen vokser også litt.', data: 'data-oppdrag',
    })}</div>`;
  } else {
    html += '<p class="liten">📜 Landsbyen har et nytt oppdrag til deg i morgen.</p>';
  }
  // Mat og vekst
  if (l.str < LANDSBY.maksStorrelse) {
    const trenger = LANDSBY.vekst[l.str];
    html += `<h3 class="seksjon">🧺 Mat til landsbyen</h3>
      <div class="stolpe"><i style="width:${Math.min(100, Math.round((l.mat / trenger) * 100))}%"></i></div>
      <p class="liten">${l.mat} / ${trenger} mat til størrelse ${l.str + 1}. Større landsby gir mer handel. Gi en annen mat enn sist for +50 %!</p><div class="valg">`;
    for (const vare of Object.keys(LANDSBY.matverdi)) {
      if (vare !== 'korn' && !(spill.lager[vare] > 0)) continue;
      const n = Math.min(LANDSBY.leveranse, Math.max(1, spill.lager[vare] || 0));
      const { mat, variasjon } = S.matVerdi(spill, verden, i, vare, n);
      html += valgKnapp({
        ikon: RAVARER[vare].ikon, navn: `Gi ${LANDSBY.leveranse} ${RAVARER[vare].navn.toLowerCase()}`, gir: `+${mat} mat`,
        kost: { [vare]: n }, lager: spill.lager, forklaring: variasjon ? '🌈 Variasjonsbonus!' : '', data: `data-mat="${vare}"`,
      });
    }
    html += '</div>';
  } else {
    html += '<p class="liten">⭐ Landsbyen er så stor den kan bli!</p>';
  }
  // Marked
  html += '<h3 class="seksjon">🛒 Marked – betaler bedre enn leiren</h3><div class="marked">';
  for (const vare of Object.keys(l.priser)) {
    const har = spill.lager[vare] || 0;
    const enhet = MARKED.pris[vare] * l.priser[vare];
    const ti = S.markedsverdi(spill, verden, i, vare, Math.min(10, har)).mynter;
    const alt = S.markedsverdi(spill, verden, i, vare, har).mynter;
    html += `<div class="rad"><span>${RAVARER[vare].ikon} ${RAVARER[vare].navn}: <b>${har}</b> <span class="liten">(${enhet.toFixed(1).replace('.', ',')} 🪙 per stk)</span></span>
      <button data-marked="${vare}" data-antall="10" ${har < 1 ? 'disabled' : ''}>Selg ${Math.min(10, har) || 10}${har ? ` (+${ti})` : ''}</button>
      <button data-marked="${vare}" data-antall="${har}" ${har < 1 ? 'disabled' : ''}>Alt${har ? ` (+${alt})` : ''}</button></div>`;
  }
  html += '</div><p class="liten">Prisen synker litt for hver vare du selger, og henter seg inn igjen over natta.</p>';
  return html;
}

function veiHtml(spill, verden, i) {
  const type = spill.veier.get(i);
  const bru = verden.terreng[i] === T.VANN;
  const def = VEI[type];
  let html = `<h2>${def.ikon} ${def.navn}${bru ? ' (bru)' : ''}</h2>`;
  const steder = S.stederINettet(spill, verden, i);
  html += steder.length
    ? `<p class="info-linje">Veien binder sammen: ${steder.map((j) => esc(S.stedNavn(spill, verden, j))).join(', ')}.</p>`
    : '<p class="info-linje">Veien er ikke koblet til noe sted ennå. Bygg videre mot leiren eller en landsby!</p>';
  if (type === 'tre') {
    const nett = S.treveierINettet(spill, verden, i);
    html += '<div class="valg">';
    html += valgKnapp({
      ikon: '🧱', navn: 'Gjør om til steinvei', gir: 'mer handel', kost: S.steinKostFor(verden, [i]), lager: spill.lager,
      forklaring: 'Steinvei gir opptil dobbelt så mye handel.', data: `data-steinvei="en"`,
    });
    if (nett.length > 1) {
      html += valgKnapp({
        ikon: '🧱', navn: `Gjør hele veien om til stein`, gir: `${nett.length} ruter`, kost: S.steinKostFor(verden, nett), lager: spill.lager,
        data: `data-steinvei="alle"`,
      });
    }
    html += '</div>';
  } else {
    html += '<p class="liten">⭐ Steinvei – den beste veien.</p>';
  }
  return html;
}

const lagerTekst = (lager) => Object.entries(lager ?? {})
  .filter(([r, n]) => r !== 'mynter' && n > 0).map(([r, n]) => `${n} ${RAVARER[r].ikon}`).join(' ') || 'tomt';

function havnHtml(spill) {
  let html = '';
  if (!spill.skip) {
    html += `<h3 class="seksjon">⛵ Skip</h3><div class="valg">${valgKnapp({
      ikon: '⛵', navn: 'Bygg skip', gir: `${SKIP.lasterom[1]} lasterom`, kost: SKIP.kost, lager: spill.lager,
      forklaring: 'Med skip kan du seile til nye verdener og frakte råvarer.', data: 'data-skip',
    })}</div>`;
    return html;
  }
  if (!S.skipHer(spill)) {
    html += '<p class="info-linje">⛵ Skipet ligger i en annen verden. Seil dit fra havkartet når du er der.</p>';
    html += `<div class="valg">${valgKnapp({ ikon: '🗺️', navn: 'Åpne havkartet', data: 'data-havkart', lager: spill.lager })}</div>`;
    return html;
  }
  const rom = S.lasterom(spill), brukt = S.lastSum(spill);
  html += `<h3 class="seksjon">⛵ Skipet (nivå ${spill.skip.nivaa})</h3>
    <div class="stolpe"><i style="width:${Math.round((brukt / rom) * 100)}%"></i></div>
    <p class="liten">${brukt} / ${rom} i lasterommet. Lasten følger med dit du seiler.</p><div class="marked">`;
  for (const r of RAVARE_REKKEFOLGE) {
    if (r === 'mynter') continue;
    const har = spill.lager[r] || 0, iSkip = spill.skip.last[r] || 0;
    if (!har && !iSkip) continue;
    html += `<div class="lastrad"><span>${RAVARER[r].ikon} ${RAVARER[r].navn}: <b>${har}</b> · i skipet <b>${iSkip}</b></span>
      <button data-last="${r}" data-n="-${SKIP.lastSteg}" ${iSkip ? '' : 'disabled'}>−${SKIP.lastSteg}</button>
      <button data-last="${r}" data-n="${SKIP.lastSteg}" ${har && brukt < rom ? '' : 'disabled'}>+${SKIP.lastSteg}</button></div>`;
  }
  html += '</div><div class="valg">';
  html += valgKnapp({ ikon: '🗺️', navn: 'Seil – åpne havkartet', gir: '1 dag', lager: spill.lager, forklaring: 'Velg en øy å seile til, eller oppdag en ny.', data: 'data-havkart' });
  const kost = S.oppgraderSkipKost(spill);
  if (kost) {
    html += valgKnapp({ ikon: '⬆️', navn: 'Større skip', gir: `${SKIP.lasterom[spill.skip.nivaa + 1]} lasterom`, kost, lager: spill.lager, data: 'data-skip-opp' });
  }
  return html + '</div>';
}

/** Havkartet: alle øyene du har oppdaget, og havet der ute med nye. */
export function visHavkart(spill, verden, h) {
  const verdener = S.alleVerdener(spill);
  const kanSeile = S.skipHer(spill) && S.harHavn(spill);
  const skipNavn = spill.skip ? verdener[spill.skip.plass]?.navn : null;
  $('havkart-info').textContent = !spill.skip
    ? 'Du har ikke skip ennå. Bygg en havn ved vannet, og et skip i havna.'
    : kanSeile
      ? `Skipet ligger klart her, med ${S.lastSum(spill)} / ${S.lasterom(spill)} i lasterommet. Reisen tar én dag.`
      : `Skipet ligger i ${skipNavn}.${S.harHavn(spill) ? '' : ' Bygg en havn her for å seile herfra.'}`;
  let html = '';
  for (const v of verdener) {
    const skipHer = spill.skip?.plass === v.nr;
    html += `<div class="oy ${v.biom}">
      <span class="ikon">${BIOM[v.biom]?.ikon ?? '🏝️'}</span>
      <span class="navn">${esc(v.navn)}</span>
      <span class="liten">${BIOM[v.biom]?.navn ?? ''} · ${v.str}×${v.str}</span>
      <span class="liten">Lager: ${lagerTekst(v.lager)}</span>
      ${v.aktiv ? '<span class="her">📍 Du er her</span>' : ''}
      ${skipHer && !v.aktiv ? '<span class="her">⛵ Skipet</span>' : ''}
      ${!v.aktiv ? `<button data-seil="${v.nr}" ${kanSeile ? '' : 'disabled'}>⛵ Seil hit</button>` : ''}
    </div>`;
  }
  const k = S.kanOppdage(spill, verden);
  html += `<div class="oy ukjent">
    <span class="ikon">❓</span><span class="navn">Ukjent hav</span>
    <span class="liten">${k.ok ? 'Hvem vet hva som venter der ute?' : esc(k.tekst)}</span>
    <button data-seil="ny" ${kanSeile && k.ok ? '' : 'disabled'}>⛵ Oppdag ny verden</button>
  </div>`;
  $('havkart-hav').innerHTML = html;
  $('havkart-hav').querySelectorAll('[data-seil]').forEach((b) => {
    b.onclick = () => h.seil(b.dataset.seil === 'ny' ? 'ny' : Number(b.dataset.seil));
  });
}

/**
 * Viser panelet for rute i. `h` = handlinger:
 * { bygg(type), oppgrader(), selg(ravare, antall), byggVei(), steinvei(alle), veiHit(), mat(vare), oppdrag(), marked(vare, antall) }.
 */
export function visRutepanel(spill, verden, i, h) {
  const panel = $('rutepanel');
  const innhold = $('rutepanel-innhold');
  const terreng = TERRENG[verden.terreng[i]];
  const o = verden.overlegg.get(i);
  const b = spill.bygg.get(i);
  let html = '';

  if (b) {
    const def = BYGG[b.type];
    const prod = S.produksjon(spill, verden, i);
    html += `<h2>${def.ikon} ${def.navn}${b.type !== 'leir' && b.type !== 'havn' ? ` <span class="liten">nivå ${b.nivaa}</span>` : ''}</h2>`;
    if (gaveTekst(prod.gave)) html += `<p class="produksjon">${gaveTekst(prod.gave)} per dag</p>`;
    if (prod.forklaring) html += `<p class="liten">${esc(prod.forklaring)}</p>`;
    html += `<p class="info-linje">${esc(def.tekst)}</p>`;
    if (b.type === 'leir') {
      html += handelHtml(spill, verden, i);
      html += '<h3 class="seksjon">🛒 Selg varer</h3><div class="marked">';
      for (const [r, pris] of Object.entries(PRIS)) {
        const har = spill.lager[r] || 0;
        html += `<div class="rad"><span>${RAVARER[r].ikon} ${RAVARER[r].navn}: <b>${har}</b> <span class="liten">(${pris} 🪙 per stk)</span></span>
          <button data-selg="${r}" data-antall="10" ${har < 1 ? 'disabled' : ''}>Selg ${Math.min(10, har) || 10}</button>
          <button data-selg="${r}" data-antall="${har}" ${har < 1 ? 'disabled' : ''}>Selg alt${har ? ` (+${har * pris} 🪙)` : ''}</button></div>`;
      }
      html += '</div><p class="liten">Tips: landsbyer som er koblet til leiren med vei, betaler bedre.</p>';
    } else if (b.type === 'havn') {
      html += havnHtml(spill);
    } else if (b.nivaa < MAKS_NIVAA) {
      const kost = S.oppgraderKost(spill, i);
      const neste = S.produksjon(spill, verden, i, b.type, b.nivaa + 1);
      html += `<div class="valg">${valgKnapp({
        ikon: '⬆️', navn: `Oppgrader til nivå ${b.nivaa + 1}`, gir: `${gaveTekst(neste.gave)}/dag`, kost, lager: spill.lager, data: 'data-oppgrader',
      })}</div>`;
    } else {
      html += '<p class="liten">⭐ Høyeste nivå!</p>';
    }
  } else if (o?.type === 'landsby') {
    html += landsbyHtml(spill, verden, i);
  } else if (spill.veier.has(i)) {
    html += veiHtml(spill, verden, i);
  } else {
    html += `<h2>${terreng.ikon} ${terreng.navn}</h2><p class="info-linje">${TERRENG_TEKST[verden.terreng[i]]}</p>`;
    if (o?.type === 'dyr') html += `<p class="info-linje">${o.art === 'hjort' ? '🦌 En hjort' : '🐑 En villsau'} bor her. Bygg en jakthytte rett ved siden av for å få kjøtt.</p>`;
    if (o?.type === 'malm') html += '<p class="info-linje">⛓️ Jernmalm! Bygg en gruve her for å få jern.</p>';
    const valg = [];
    const mangler = [];
    for (const type of S.muligeBygg(spill, verden, i, { medKrav: false })) {
      const def = BYGG[type];
      if (!S.kravOppfylt(spill, verden, i, type)) {
        mangler.push(`${def.ikon} ${def.navn}: ${def.krav.tekst.toLowerCase()}`);
        continue;
      }
      const prod = S.produksjon(spill, verden, i, type, 1);
      valg.push(valgKnapp({
        ikon: def.ikon, navn: `Bygg ${def.navn.toLowerCase()}`, gir: `${gaveTekst(prod.gave)}/dag`,
        kost: S.byggKost(spill, type), lager: spill.lager, forklaring: prod.forklaring, data: `data-bygg="${type}"`,
      }));
    }
    if (S.kanHaVei(spill, verden, i)) {
      const bru = verden.terreng[i] === T.VANN;
      valg.push(valgKnapp({
        ikon: '🛤️', navn: bru ? 'Bygg bru' : 'Bygg trevei', kost: S.veiKost(verden, i), lager: spill.lager,
        forklaring: o?.type === 'dyr' ? 'Dyret flytter seg litt unna.' : 'Veier mellom leiren og landsbyer gir handel.', data: 'data-vei',
      }));
    }
    if (valg.length) html += `<div class="valg">${valg.join('')}</div>`;
    if (mangler.length) html += `<p class="liten">Kan ikke bygges her ennå:<br>${mangler.map(esc).join('<br>')}</p>`;
  }

  innhold.innerHTML = html;
  const koble = (sel, fn) => innhold.querySelectorAll(sel).forEach((k) => { k.onclick = () => fn(k); });
  koble('[data-bygg]', (k) => h.bygg(k.dataset.bygg));
  koble('[data-oppgrader]', () => h.oppgrader());
  koble('[data-selg]', (k) => h.selg(k.dataset.selg, Number(k.dataset.antall)));
  koble('[data-vei]', () => h.byggVei());
  koble('[data-steinvei]', (k) => h.steinvei(k.dataset.steinvei === 'alle'));
  koble('[data-vei-hit]', () => h.veiHit());
  koble('[data-mat]', (k) => h.mat(k.dataset.mat));
  koble('[data-oppdrag]', () => h.oppdrag());
  koble('[data-skip]', () => h.skip());
  koble('[data-skip-opp]', () => h.skipOpp());
  koble('[data-last]', (k) => h.last(k.dataset.last, Number(k.dataset.n)));
  koble('[data-havkart]', () => h.havkart());
  koble('[data-marked]', (k) => h.marked(k.dataset.marked, Number(k.dataset.antall)));
  panel.hidden = false;
}

export function skjulRutepanel() {
  $('rutepanel').hidden = true;
}

// ---------------------------------------------------------------------------
// Hendelser
// ---------------------------------------------------------------------------
/** Viser et hendelseskort. h = hendelsen, valg = { ja(), nei(), vis() }. */
export function visHendelse(spill, h, valg) {
  $('hendelse-tittel').textContent = h.tittel;
  $('hendelse-tekst').textContent = h.tekst;
  const innhold = $('hendelse-innhold');
  const knapper = $('hendelse-knapper');
  if (h.art === 'handelsmann') {
    innhold.innerHTML = `${gaveTekst(h.gi).replace('+', '')}<span class="pil">→</span>${gaveTekst(h.faa).replace('+', '')}`;
    const harRad = Object.entries(h.gi).every(([r, n]) => (spill.lager[r] || 0) >= n);
    knapper.innerHTML = `<button class="hoved" data-ja ${harRad ? '' : 'disabled'}>🤝 Bytt!</button><button data-nei>Nei takk</button>`;
    if (!harRad) innhold.insertAdjacentHTML('beforeend', `<p class="liten">Du mangler ${manglerTekst(h.gi, spill.lager)}</p>`);
  } else if (h.art === 'skattekart') {
    innhold.textContent = '🗺️ ✕';
    knapper.innerHTML = '<button class="hoved" data-vis>👀 Vis meg!</button>';
  } else {
    innhold.textContent = gaveTekst(h.gave);
    knapper.innerHTML = '<button class="hoved" data-ja>😊 Flott!</button>';
  }
  knapper.querySelectorAll('[data-ja]').forEach((b) => { b.onclick = () => { $('hendelse').close(); valg.ja(); }; });
  knapper.querySelectorAll('[data-nei]').forEach((b) => { b.onclick = () => { $('hendelse').close(); valg.nei(); }; });
  knapper.querySelectorAll('[data-vis]').forEach((b) => { b.onclick = () => { $('hendelse').close(); valg.vis(); }; });
  $('hendelse').showModal();
}
