// Alt som er HTML rundt kartet: råvarelinja, mål, rutepanelet, meldinger og menyen.
// Får data inn og kaller tilbake til main.js ved trykk – inneholder ingen spillregler.

import { RAVARER, RAVARE_REKKEFOLGE, BYGG, PRIS, MAKS_NIVAA } from './data/balanse.js';
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
  [T.VANN]: 'Vann. Her kan det fiskes senere 🐟',
  [T.STRAND]: 'Strand. Her kan det bygges havn senere ⚓',
  [T.GRESS]: 'Eng – god jord for gårder.',
  [T.SKOG]: 'Skog – her finnes det tre.',
  [T.AAS]: 'Ås – steinete bakker.',
  [T.FJELL]: 'Fjell – mye stein.',
};

/**
 * Viser panelet for rute i. `h` = handlinger: { bygg(type), oppgrader(), selg(ravare, antall) }.
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
    html += `<h2>${def.ikon} ${def.navn}${b.type !== 'leir' ? ` <span class="liten">nivå ${b.nivaa}</span>` : ''}</h2>`;
    html += `<p class="produksjon">${gaveTekst(prod.gave)} per dag</p>`;
    if (prod.forklaring) html += `<p class="liten">${esc(prod.forklaring)}</p>`;
    html += `<p class="info-linje">${esc(def.tekst)}</p>`;
    if (b.type === 'leir') {
      html += '<h3 style="margin:12px 0 0;font-size:15px">🛒 Selg varer</h3><div class="marked">';
      for (const [r, pris] of Object.entries(PRIS)) {
        const har = spill.lager[r] || 0;
        html += `<div class="rad"><span>${RAVARER[r].ikon} ${RAVARER[r].navn}: <b>${har}</b> <span class="liten">(${pris} 🪙 per stk)</span></span>
          <button data-selg="${r}" data-antall="10" ${har < 1 ? 'disabled' : ''}>Selg ${Math.min(10, har) || 10}</button>
          <button data-selg="${r}" data-antall="${har}" ${har < 1 ? 'disabled' : ''}>Selg alt${har ? ` (+${har * pris} 🪙)` : ''}</button></div>`;
      }
      html += '</div>';
    } else if (b.nivaa < MAKS_NIVAA) {
      const kost = S.oppgraderKost(spill, i);
      const neste = S.produksjon(spill, verden, i, b.type, b.nivaa + 1);
      html += `<div class="valg"><button class="byggvalg${S.harRad(spill, kost) ? '' : ' dempet'}" data-oppgrader>
        <span class="stort-ikon">⬆️</span><span class="navn">Oppgrader til nivå ${b.nivaa + 1}</span>
        <span class="gir">${gaveTekst(neste.gave)}/dag</span>
        <span class="forklaring">${kostHtml(kost, spill.lager)}</span></button></div>`;
    } else {
      html += '<p class="liten">⭐ Høyeste nivå!</p>';
    }
  } else if (o?.type === 'landsby') {
    html += `<h2>🏘️ ${esc(verden.landsbynavn.get(i))}</h2>
      <p class="info-linje">En liten landsby. Folk her vil gjerne handle!</p>
      <p class="liten">Snart kan du bygge vei hit og tjene mynter på handel (kommer i neste versjon).</p>`;
  } else {
    html += `<h2>${terreng.ikon} ${terreng.navn}</h2><p class="info-linje">${TERRENG_TEKST[verden.terreng[i]]}</p>`;
    if (o?.type === 'dyr') html += `<p class="info-linje">${o.art === 'hjort' ? '🦌 En hjort' : '🐑 En villsau'} bor her. Jakthytte kommer senere.</p>`;
    if (o?.type === 'malm') html += '<p class="info-linje">⛓️ Jernmalm! En gruve kan bygges her senere.</p>';
    const mulige = S.muligeBygg(spill, verden, i);
    if (mulige.length) {
      html += '<div class="valg">';
      for (const type of mulige) {
        const def = BYGG[type];
        const kost = S.byggKost(spill, type);
        const prod = S.produksjon(spill, verden, i, type, 1);
        html += `<button class="byggvalg${S.harRad(spill, kost) ? '' : ' dempet'}" data-bygg="${type}">
          <span class="stort-ikon">${def.ikon}</span><span class="navn">Bygg ${def.navn.toLowerCase()}</span>
          <span class="gir">${gaveTekst(prod.gave)}/dag</span>
          <span class="forklaring">${kostHtml(kost, spill.lager)} ${esc(prod.forklaring)}</span></button>`;
      }
      html += '</div>';
    }
  }

  innhold.innerHTML = html;
  innhold.querySelectorAll('[data-bygg]').forEach((k) => { k.onclick = () => h.bygg(k.dataset.bygg); });
  innhold.querySelectorAll('[data-oppgrader]').forEach((k) => { k.onclick = () => h.oppgrader(); });
  innhold.querySelectorAll('[data-selg]').forEach((k) => { k.onclick = () => h.selg(k.dataset.selg, Number(k.dataset.antall)); });
  panel.hidden = false;
}

export function skjulRutepanel() {
  $('rutepanel').hidden = true;
}
