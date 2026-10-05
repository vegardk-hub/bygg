// Kenney Roguelike RPG-arket (CC0): 16 px ruter med 1 px mellomrom, 57 × 31.
// Alle koordinater under er målt på arket (gjennomsiktige hjørner/kanter sjekket
// piksel for piksel), ikke gjettet.

export const ARK_URL = 'grafikk/kenney-roguelike.png';
export const S = 16; // pikselstørrelse på én del-rute i arket

export function lastArk() {
  return new Promise((ok, feil) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => feil(new Error('Klarte ikke laste ' + ARK_URL));
    img.src = ARK_URL;
  });
}

/** Tegner del-rute (kol, rad) fra arket på (dx, dy) i målet. */
export function tegnDel(ctx, ark, [kol, rad], dx, dy, str = S) {
  ctx.drawImage(ark, kol * 17, rad * 17, 16, 16, dx, dy, str, str);
}

/**
 * Et «blob»-sett: 3×3 ytterkanter + 4 innerhjørner. Innerhjørnene er navngitt
 * etter hvor hakket (det gjennomsiktige) sitter.
 */
function blob3x3(k0, r0, innerK, innerR) {
  return {
    TL: [k0, r0], T: [k0 + 1, r0], TR: [k0 + 2, r0],
    L: [k0, r0 + 1], C: [k0 + 1, r0 + 1], R: [k0 + 2, r0 + 1],
    BL: [k0, r0 + 2], B: [k0 + 1, r0 + 2], BR: [k0 + 2, r0 + 2],
    iBR: [innerK, innerR], iBL: [innerK + 1, innerR],
    iTR: [innerK, innerR + 1], iTL: [innerK + 1, innerR + 1],
  };
}

export const BLOB = {
  gress: blob3x3(2, 15, 0, 15),
  sand: blob3x3(7, 21, 5, 21),
  stein: blob3x3(7, 15, 5, 15),
  jord: blob3x3(7, 9, 5, 9),
};

export const VANN = [3, 1];

// Høye trær = to del-ruter: topp (rad 10) og stamme (rad 11).
export const HOYE_TRAER = {
  gronnRund: 13, hostRund: 14, morkRund: 15,
  lysGran: 16, hostGran: 17, morkGran: 18,
};
export const SMA_TRAER = [[13, 9], [15, 9], [16, 9], [18, 9]];
export const BUSKER = [[19, 9], [21, 9]];
export const BAERBUSK = [24, 9];
export const FRUKTTRE = [[23, 10], [23, 11]];
export const HAUG_BRUN = [[54, 19], [55, 19], [56, 19]];
export const HAUG_MOSE = [[54, 20], [55, 20], [56, 20]];
export const TOPP_GRA = [[54, 21], [55, 21], [56, 21]];
export const TOPP_MOSE = [[54, 22], [55, 22], [56, 22]];
export const MALM = [44, 10];
export const SKATT = [43, 10]; // gyllen statue – plassholder for ruin/skatt

// Sammensatte figurer: [dx, dy, [kol, rad]] i del-ruter fra rutens øvre venstre hjørne.
// Prøvd ut og sett på før de ble tatt i bruk.
const hytte = [
  [0, 0, [22, 21]], [1, 0, [23, 21]],   // lavt tak
  [0, 1, [14, 15]], [1, 1, [16, 15]],   // vegg
  [0, 1, [33, 1]],                      // dør
];
export const BYGG_SPRITE = {
  leir: hytte,
  hogstbu: [[0, 0, [16, 9]], [1, 0, [18, 9]], [0, 1, [53, 21]], [1, 1, [53, 19]]],   // trær, stubbe med øks, stubbe
  gard: [
    [0, 0, [2, 18]], [1, 0, [4, 18]], [0, 1, [2, 20]], [1, 1, [4, 20]],                 // åker (oransje jord)
    [0, 0, [22, 10]], [1, 0, [22, 10]], [0, 1, [22, 10]], [1, 1, [22, 10]],             // spirer
  ],
  steinbrudd: [[0, 0, [54, 21]], [1, 0, [55, 21]], [0, 1, [50, 20]], [1, 1, [56, 22]]], // steiner og gruvevogn
};
// Landsby: et hus som er 2 del-ruter bredt og 3 høyt – stikker en halv rute opp over ruta si.
export const LANDSBY_SPRITE = [
  [0, -1, [24, 21]], [1, -1, [26, 21]], [0, 0, [17, 15]], [1, 0, [19, 15]], [0, 1, [14, 15]], [1, 1, [16, 15]],
  [0, -1, [20, 21]], [1, -1, [21, 21]], [0, 0, [20, 23]], [1, 0, [21, 23]], [0, 1, [33, 1]],
];
