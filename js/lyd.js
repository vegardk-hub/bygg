// Små lydeffekter laget med Web Audio (ingen lydfiler). Lyden starter først
// etter at brukeren har trykket på noe – nettlesere krever det.

let ctx = null;
let paa = true;
try { paa = localStorage.getItem('bygg-lyd') !== 'av'; } catch { /* privat modus */ }

export const lydPaa = () => paa;
export function settLyd(verdi) {
  paa = verdi;
  try { localStorage.setItem('bygg-lyd', verdi ? 'paa' : 'av'); } catch { /* ignorer */ }
}

function lydkontekst() {
  if (!ctx) {
    const K = window.AudioContext || window.webkitAudioContext;
    if (!K) return null;
    ctx = new K();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** Én tone: frekvens (Hz), start (s fra nå), lengde (s), bølgeform, volum, glidning til frekvens. */
function tone(f, start, lengde, type = 'sine', volum = 0.15, tilF = null) {
  const a = lydkontekst();
  if (!a) return;
  const t = a.currentTime + start;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f, t);
  if (tilF) osc.frequency.exponentialRampToValueAtTime(tilF, t + lengde);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volum, t + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + lengde);
  osc.connect(gain).connect(a.destination);
  osc.start(t);
  osc.stop(t + lengde + 0.05);
}

const LYDER = {
  avdekk: () => { tone(520, 0, 0.12, 'triangle', 0.12, 780); },
  bygg: () => { tone(330, 0, 0.1, 'square', 0.06); tone(494, 0.09, 0.16, 'square', 0.06); },
  oppgrader: () => { tone(392, 0, 0.1, 'triangle', 0.12); tone(523, 0.08, 0.1, 'triangle', 0.12); tone(659, 0.16, 0.2, 'triangle', 0.12); },
  mynt: () => { tone(988, 0, 0.08, 'square', 0.05); tone(1319, 0.06, 0.18, 'square', 0.05); },
  dag: () => { [523, 659, 784, 1047].forEach((f, k) => tone(f, k * 0.07, 0.25, 'sine', 0.1)); },
  funn: () => { [784, 988, 1175, 1568].forEach((f, k) => tone(f, k * 0.06, 0.2, 'triangle', 0.1)); },
  maal: () => { [523, 784, 1047].forEach((f, k) => tone(f, k * 0.1, 0.35, 'triangle', 0.12)); },
  feil: () => { tone(180, 0, 0.18, 'sawtooth', 0.05, 140); },
};

export function spill(navn) {
  if (!paa) return;
  try { LYDER[navn]?.(); } catch { /* lyd er pynt – aldri la den stoppe spillet */ }
}
