// Brettet i ny stil: hver rute er et kort (tegnet med js/stil/ruter.js) som
// ligger på svart bakgrunn med en smal fuge mellom kortene. Kortene tegnes
// én gang og gjenbrukes til innholdet eller zoomnivået endrer seg.
//
// Verdensenheter: én rute er RUTE enheter (kort + fuge). Kameraet jobber i
// samme enheter, så alt annet (trykk, effekter) bruker RUTE som før.

import { tegnKort, tegnUkjent, tegnKlammer } from './stil/ruter.js';
import { KLAMMER, BAKGRUNN } from './stil/palett.js';
import { T } from './data/terreng.js';
import { blandSeed, lagTilfeldig } from './rng.js';
import { kanAvdekkes } from './spill.js';
import { veiRetninger } from './veinett.js';

export const RUTE = 100;                 // verdensenheter per rute
export const FUGE = 1.5;                 // målt i forbildet: ca. 1,5 % av ruta
export const KORT = RUTE - FUGE;

const TERRENGNAVN = {
  [T.VANN]: 'vann', [T.STRAND]: 'strand', [T.GRESS]: 'eng',
  [T.SKOG]: 'skog', [T.AAS]: 'aas', [T.FJELL]: 'fjell',
};

/** Veiene på ei rute, gruppert per veitype: [{ type, retninger: 'NE' }]. */
function veierFor(spill, verden, i) {
  const grupper = new Map();
  for (const [d, type] of veiRetninger(spill, verden, i)) grupper.set(type, (grupper.get(type) ?? '') + d);
  // En vei uten naboer vises som en liten flekk (retninger '').
  if (spill.veier.has(i) && !grupper.size) grupper.set(spill.veier.get(i), '');
  return [...grupper].map(([type, retninger]) => ({ type, retninger }));
}

/** Hva skal kortet for rute i vise akkurat nå? null = ingenting (svart). */
export function innholdFor(spill, verden, i) {
  if (!spill.avdekket[i]) {
    // Skattekart: et ✕ i tåka – også langt inne i det ukjente.
    if (spill.skattekart?.includes(i)) return { ukjent: true, kryss: true };
    return kanAvdekkes(spill, verden, i) ? { ukjent: true } : null;
  }
  const terreng = TERRENGNAVN[verden.terreng[i]];
  const vei = veierFor(spill, verden, i);
  const medVei = vei.length ? { vei } : {};
  const b = spill.bygg.get(i);
  if (b) return { terreng, bygg: b.type, nivaa: b.nivaa, ...medVei };
  const o = verden.overlegg.get(i);
  if (o?.type === 'landsby') return { terreng, bygg: 'landsby', nivaa: spill.landsbyer.get(i)?.str ?? 1, ...medVei };
  if (spill.veier.has(i)) return { terreng, ...medVei };
  if (o && !spill.brukt.has(i)) {
    return { terreng, overlegg: o.type === 'dyr' ? (o.art === 'hjort' ? 'hjort' : 'sau') : o.type };
  }
  return { terreng };
}

const signatur = (inn) => (inn.ukjent ? (inn.kryss ? '?x' : '?')
  : `${inn.terreng}|${inn.bygg ?? ''}|${inn.nivaa ?? ''}|${inn.overlegg ?? ''}|${(inn.vei ?? []).map((v) => v.type + v.retninger).join(',')}`);

// Kort tegnes i noen faste størrelser (enhetspiksler) og skaleres litt ved tegning.
const STORRELSER = [48, 64, 96, 128, 192, 256, 384];
const passendeStorrelse = (px) => STORRELSER.find((s) => s >= px) ?? STORRELSER.at(-1);

export class Brett {
  constructor(verden) {
    this.verden = verden;
    this.kort = new Map();  // i → { sig, str, lerret }
    this.ko = new Map();    // i → { innhold, str } som venter på skarpere versjon
    this.royk = null;
    this.roykNokkel = '';
  }

  #lagKort(i, innhold, str) {
    const lerret = document.createElement('canvas');
    lerret.width = lerret.height = str;
    const ctx = lerret.getContext('2d');
    const tilf = lagTilfeldig(blandSeed(this.verden.seed, this.verden.forsok, 'kort', i));
    if (innhold.ukjent) tegnUkjent(ctx, str, tilf, { kryss: innhold.kryss });
    else tegnKort(ctx, str, tilf, { ...innhold, biom: this.verden.biom });
    const k = { sig: signatur(innhold), str, lerret };
    this.kort.set(i, k);
    return k;
  }

  /** Kortet for rute i i ønsket størrelse. Endret innhold tegnes straks; bare ny zoom tegnes etter hvert. */
  hent(i, innhold, str) {
    const sig = signatur(innhold);
    const k = this.kort.get(i);
    if (k && k.sig === sig) {
      if (k.str !== str) this.ko.set(i, { innhold, str });
      return k.lerret;
    }
    this.ko.delete(i);
    return this.#lagKort(i, innhold, str).lerret;
  }

  /** Tegner opp til `maks` kort fra køen. Returnerer true hvis det gjenstår noe. */
  jobb(maks = 10) {
    for (const [i, { innhold, str }] of this.ko) {
      if (maks-- <= 0) break;
      this.ko.delete(i);
      this.#lagKort(i, innhold, str);
    }
    return this.ko.size > 0;
  }

  /**
   * Røyk rundt kanten av det kjente: et lite bilde med noen få piksler per rute,
   * forstørret med utjevning. Tegnes på nytt bare når kanten flytter seg.
   */
  #roykBilde(spill) {
    const { bredde: B, hoyde: H } = this.verden;
    const nokkel = `${spill.stat.avdekket}`;
    if (this.royk && this.roykNokkel === nokkel) return this.royk;
    const P = 6, M = 2; // piksler per rute, marg i ruter
    const c = this.royk ?? document.createElement('canvas');
    c.width = (B + 2 * M) * P;
    c.height = (H + 2 * M) * P;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    for (let i = 0; i < B * H; i++) {
      if (spill.avdekket[i] || !kanAvdekkes(spill, this.verden, i)) continue;
      const tilf = lagTilfeldig(blandSeed(this.verden.seed, 'royk', i));
      const cx = ((i % B) + M + 0.5) * P, cy = (Math.floor(i / B) + M + 0.5) * P;
      for (let k = 0; k < 2; k++) {
        const r = P * (0.8 + tilf.tall() * 0.7);
        const ox = (tilf.tall() - 0.5) * P * 1.2, oy = (tilf.tall() - 0.5) * P * 1.2;
        const g = ctx.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, r);
        g.addColorStop(0, 'rgba(120, 125, 140, 0.16)');
        g.addColorStop(1, 'rgba(120, 125, 140, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(cx + ox - r, cy + oy - r, r * 2, r * 2);
      }
    }
    this.royk = c;
    this.roykNokkel = nokkel;
    this.roykMarg = M;
    return c;
  }

  /**
   * Tegner brettet. ctx må ha kameraets transformasjon. utsnitt = synlige ruter.
   * avdekkAnim: rute → starttid, for kort som snur seg fram når de avdekkes.
   */
  tegn(ctx, spill, { utsnitt, skala, valgt, avdekkAnim, naa, avdekkMs }) {
    const { bredde: B, hoyde: H } = this.verden;
    const str = passendeStorrelse(KORT * skala);

    const royk = this.#roykBilde(spill);
    const M = this.roykMarg;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(royk, -M * RUTE, -M * RUTE, (B + 2 * M) * RUTE, (H + 2 * M) * RUTE);

    const { x0, y0, x1, y1 } = utsnitt;
    for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++) {
      for (let x = Math.max(0, x0); x <= Math.min(B - 1, x1); x++) {
        const i = y * B + x;
        const innhold = innholdFor(spill, this.verden, i);
        if (!innhold) continue;
        const px = x * RUTE + FUGE / 2, py = y * RUTE + FUGE / 2;
        const start = avdekkAnim.get(i);
        if (start !== undefined) {
          // Avdekking: det mørke kortet blekner mens det nye vokser litt fram.
          const p = Math.min(1, (naa - start) / avdekkMs);
          const ukjent = this.hent(-1 - i, { ukjent: true }, str);
          ctx.globalAlpha = 1 - p;
          ctx.drawImage(ukjent, px, py, KORT, KORT);
          const s = 0.86 + 0.14 * (1 - (1 - p) ** 3);
          ctx.globalAlpha = p;
          ctx.drawImage(this.hent(i, innhold, str), px + KORT * (1 - s) / 2, py + KORT * (1 - s) / 2, KORT * s, KORT * s);
          ctx.globalAlpha = 1;
          if (p >= 1) avdekkAnim.delete(i);
          continue;
        }
        ctx.drawImage(this.hent(i, innhold, str), px, py, KORT, KORT);
      }
    }

    // Nivåmerke på bygg som er oppgradert.
    for (const [i, b] of spill.bygg) {
      if (b.nivaa < 2) continue;
      const x = i % B, y = Math.floor(i / B);
      if (x < x0 || x > x1 || y < y0 || y > y1) continue;
      nivaamerke(ctx, x * RUTE + RUTE - 13, y * RUTE + 13, b.nivaa);
    }

    if (valgt !== null) {
      ctx.save();
      ctx.translate((valgt % B) * RUTE + FUGE / 2, Math.floor(valgt / B) * RUTE + FUGE / 2);
      tegnKlammer(ctx, KORT, KLAMMER);
      ctx.restore();
    }
  }
}

function nivaamerke(ctx, x, y, nivaa) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, Math.PI * 2);
  ctx.fillStyle = nivaa >= 3 ? '#e0a030' : KLAMMER;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(40, 30, 15, 0.7)';
  ctx.stroke();
  ctx.fillStyle = '#3b2a14';
  ctx.font = '700 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(nivaa), x, y + 0.5);
  ctx.restore();
}

export { BAKGRUNN };
