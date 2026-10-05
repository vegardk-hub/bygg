// Små visuelle effekter oppå kartet: flytende tall («+3 🪵») og støvskyer når
// noe bygges. Alt lever i kildekoordinater og tegnes i skjermkoordinater.

const effekter = [];

/** Flytende tekst som stiger og blekner. (kx, ky) = kildepiksler. */
export function flytendeTekst(kx, ky, tekst, { farge = '#fff', forsinkelse = 0, varighet = 1300 } = {}) {
  effekter.push({ type: 'tekst', kx, ky, tekst, farge, start: performance.now() + forsinkelse, varighet });
}

/** Støv/konfetti som spruter ut fra et punkt. */
export function sprut(kx, ky, { farger = ['#c8a26b', '#e3cfa1', '#8a6a3c'], antall = 14, fart = 1 } = {}) {
  const naa = performance.now();
  for (let k = 0; k < antall; k++) {
    const vinkel = Math.random() * Math.PI * 2;
    const v = (0.6 + Math.random()) * 40 * fart;
    effekter.push({
      type: 'partikkel', kx, ky,
      vx: Math.cos(vinkel) * v, vy: Math.sin(vinkel) * v - 25 * fart,
      farge: farger[k % farger.length], str: 2 + Math.random() * 2,
      start: naa, varighet: 600 + Math.random() * 400,
    });
  }
}

export const harEffekter = () => effekter.length > 0;

/** Tegner alle effekter. `tilSkjerm(kx, ky)` gir lerretspiksler; `skala` = lerretspiksler per kildepiksel. */
export function tegnEffekter(ctx, tilSkjerm, skala, dpr) {
  const naa = performance.now();
  for (let k = effekter.length - 1; k >= 0; k--) {
    const e = effekter[k];
    const t = (naa - e.start) / e.varighet;
    if (t >= 1) { effekter.splice(k, 1); continue; }
    if (t < 0) continue;
    if (e.type === 'tekst') {
      const { x, y } = tilSkjerm(e.kx, e.ky);
      const loft = t * 36 * dpr;
      ctx.globalAlpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
      ctx.font = `bold ${Math.round(17 * dpr)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 4 * dpr;
      ctx.strokeStyle = 'rgba(30, 25, 15, 0.85)';
      ctx.strokeText(e.tekst, x, y - loft);
      ctx.fillStyle = e.farge;
      ctx.fillText(e.tekst, x, y - loft);
    } else {
      const sek = (t * e.varighet) / 1000;
      const { x, y } = tilSkjerm(e.kx + e.vx * sek, e.ky + e.vy * sek + 60 * sek * sek);
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = e.farge;
      const s = e.str * skala;
      ctx.fillRect(x - s / 2, y - s / 2, s, s);
    }
  }
  ctx.globalAlpha = 1;
}
