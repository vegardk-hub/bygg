// Kamera for et lerret: panorering (dra), zoom (hjul/knip) og trykk.
// Brukes av både spillet og kartverkstedet. Koordinater:
//  - skjerm:  CSS-piksler relativt til lerretet (det pekerhendelser gir)
//  - kilde:   piksler i kartbildet (32 per spillrute)

export class Kamera {
  constructor(lerret, { vedTrykk = () => {}, vedEndring = () => {} } = {}) {
    this.lerret = lerret;
    this.x = 0;
    this.y = 0;
    this.skala = 2; // lerretspiksler per kildepiksel
    this.minSkala = 0.3;
    this.maksSkala = 8;
    this.vedTrykk = vedTrykk;
    this.vedEndring = vedEndring;
    this.grenser = null; // { bredde, hoyde } i kildepiksler – hindrer at kartet forsvinner helt
    this.#koblPekere();
  }

  get dpr() { return window.devicePixelRatio || 1; }

  tilpassLerret() {
    this.lerret.width = Math.round(this.lerret.clientWidth * this.dpr);
    this.lerret.height = Math.round(this.lerret.clientHeight * this.dpr);
  }

  /** Setter transformasjonen på ctx slik at man kan tegne i kildepiksler. */
  anvend(ctx) {
    ctx.setTransform(this.skala, 0, 0, this.skala, -this.x * this.skala, -this.y * this.skala);
  }

  skjermTilKilde(sx, sy) {
    return { x: (sx * this.dpr) / this.skala + this.x, y: (sy * this.dpr) / this.skala + this.y };
  }

  sentrer(kx, ky, skala = this.skala) {
    this.skala = skala;
    this.x = kx - this.lerret.width / 2 / this.skala;
    this.y = ky - this.lerret.height / 2 / this.skala;
    this.#hold();
  }

  /** Zoom som får plass til et område (kildepiksler) på skjermen. */
  passInn(bredde, hoyde, kx = bredde / 2, ky = hoyde / 2) {
    const s = Math.min(this.lerret.width / bredde, this.lerret.height / hoyde);
    this.sentrer(kx, ky, s);
  }

  zoomRundt(sx, sy, faktor) {
    const for_ = this.skjermTilKilde(sx, sy);
    this.skala = Math.min(this.maksSkala, Math.max(this.minSkala, this.skala * faktor));
    const etter = this.skjermTilKilde(sx, sy);
    this.x += for_.x - etter.x;
    this.y += for_.y - etter.y;
    this.#hold();
    this.vedEndring();
  }

  /** Lar ikke kartet skli helt ut av syne: minst en kvart skjerm av kartet skal vises. */
  #hold() {
    if (!this.grenser) return;
    const synligB = this.lerret.width / this.skala, synligH = this.lerret.height / this.skala;
    const margB = synligB * 0.75, margH = synligH * 0.75;
    this.x = Math.min(this.grenser.bredde - synligB + margB, Math.max(-margB, this.x));
    this.y = Math.min(this.grenser.hoyde - synligH + margH, Math.max(-margH, this.y));
  }

  #koblPekere() {
    const l = this.lerret;
    const pekere = new Map();
    let knipAvstand = null;
    let flyttet = 0;

    l.addEventListener('pointerdown', (e) => {
      l.setPointerCapture(e.pointerId);
      pekere.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
      if (pekere.size === 1) flyttet = 0;
    });

    l.addEventListener('pointermove', (e) => {
      const forrige = pekere.get(e.pointerId);
      if (!forrige) return;
      const naa = { x: e.offsetX, y: e.offsetY };
      pekere.set(e.pointerId, naa);
      if (pekere.size === 1) {
        this.x -= ((naa.x - forrige.x) * this.dpr) / this.skala;
        this.y -= ((naa.y - forrige.y) * this.dpr) / this.skala;
        flyttet += Math.abs(naa.x - forrige.x) + Math.abs(naa.y - forrige.y);
        this.#hold();
        this.vedEndring();
      } else if (pekere.size === 2) {
        const [a, b] = [...pekere.values()];
        const avst = Math.hypot(a.x - b.x, a.y - b.y);
        if (knipAvstand) this.zoomRundt((a.x + b.x) / 2, (a.y + b.y) / 2, avst / knipAvstand);
        knipAvstand = avst;
        flyttet = 999;
      }
    });

    const slipp = (e) => {
      if (pekere.size === 1 && flyttet < 10 && e.type === 'pointerup') {
        const p = this.skjermTilKilde(e.offsetX, e.offsetY);
        this.vedTrykk(p.x, p.y, e);
      }
      pekere.delete(e.pointerId);
      if (pekere.size < 2) knipAvstand = null;
    };
    l.addEventListener('pointerup', slipp);
    l.addEventListener('pointercancel', slipp);

    l.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoomRundt(e.offsetX, e.offsetY, e.deltaY < 0 ? 1.15 : 1 / 1.15);
    }, { passive: false });
  }
}
