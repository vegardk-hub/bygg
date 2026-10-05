"""Lager app-ikonene (Hjem-skjerm/PWA) i samme stil som brettet: et grønt kort med
mørkere kant, et lite hus med rødt saltak og en gran, på mørk bakgrunn.
Kjøres én gang:  python verktoy/lag_ikon.py   (krever Pillow)."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

UT = Path(__file__).resolve().parent.parent / 'ikoner'
UT.mkdir(exist_ok=True)


def hex2rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[k:k + 2], 16) for k in (0, 2, 4))


def tegn(storrelse, marg):
    """marg = andel av bildet som er luft rundt kortet (maskable-ikoner trenger mer)."""
    S = 1024  # tegn stort, skaler ned til slutt (myke kanter)
    im = Image.new('RGB', (S, S), hex2rgb('#1b2430'))
    d = ImageDraw.Draw(im)
    k0, k1 = int(S * marg), int(S * (1 - marg))
    kort = k1 - k0
    # Kortet: mørk kant, lysere midt (som brettets ruter)
    d.rounded_rectangle([k0, k0, k1, k1], radius=int(kort * 0.08), fill=hex2rgb('#5f7647'))
    innv = int(kort * 0.05)
    lag = Image.new('RGB', (S, S), (0, 0, 0))
    ImageDraw.Draw(lag).rounded_rectangle([k0 + innv, k0 + innv, k1 - innv, k1 - innv], radius=int(kort * 0.1), fill=(255, 255, 255))
    lag = lag.filter(ImageFilter.GaussianBlur(kort * 0.06)).convert('L')
    im.paste(Image.new('RGB', (S, S), hex2rgb('#86aa5f')), (0, 0), lag)
    d = ImageDraw.Draw(im)

    def p(x, y):  # brøkdel av kortet → piksler
        return (k0 + x * kort, k0 + y * kort)

    # Skygger
    d.ellipse([*p(0.34, 0.6), *p(0.9, 0.8)], fill=hex2rgb('#6d8a50'))
    d.ellipse([*p(0.16, 0.68), *p(0.34, 0.75)], fill=hex2rgb('#6d8a50'))
    # Gran til venstre
    d.rectangle([*p(0.235, 0.62), *p(0.265, 0.72)], fill=hex2rgb('#7a5236'))
    for k, (bunn, halv, topp) in enumerate([(0.66, 0.13, 0.42), (0.55, 0.1, 0.33), (0.45, 0.075, 0.25)]):
        d.polygon([p(0.25 - halv, bunn), p(0.25, topp), p(0.25, bunn + 0.02)], fill=hex2rgb('#4e7d35'))
        d.polygon([p(0.25, topp), p(0.25 + halv, bunn), p(0.25, bunn + 0.02)], fill=hex2rgb('#3d6a2c'))
    # Hus (isometrisk): venstre vegg lys, høyre vegg mørk, saltak
    d.polygon([p(0.38, 0.62), p(0.6, 0.74), p(0.6, 0.56), p(0.38, 0.44)], fill=hex2rgb('#d0a06a'))
    d.polygon([p(0.6, 0.74), p(0.8, 0.63), p(0.8, 0.45), p(0.7, 0.36), p(0.6, 0.56)], fill=hex2rgb('#9e6d42'))
    d.polygon([p(0.43, 0.6), p(0.5, 0.64), p(0.5, 0.52), p(0.43, 0.48)], fill=hex2rgb('#5b3a24'))       # dør
    d.polygon([p(0.53, 0.58), p(0.57, 0.6), p(0.57, 0.53), p(0.53, 0.51)], fill=hex2rgb('#f3d77a'))     # vindu
    d.polygon([p(0.33, 0.43), p(0.6, 0.58), p(0.7, 0.36), p(0.45, 0.22)], fill=hex2rgb('#c0614a'))      # tak, fremre
    d.polygon([p(0.7, 0.36), p(0.84, 0.46), p(0.6, 0.58)], fill=hex2rgb('#8e3d2c'))                     # tak, gavl
    d.line([p(0.45, 0.22), p(0.7, 0.36)], fill=hex2rgb('#d98a74'), width=int(kort * 0.015))
    return im.resize((storrelse, storrelse), Image.LANCZOS)


for navn, str_, marg in [('ikon-180.png', 180, 0.08), ('ikon-192.png', 192, 0.08), ('ikon-512.png', 512, 0.08),
                         ('ikon-maskable-512.png', 512, 0.16)]:
    tegn(str_, marg).save(UT / navn)
    print('laget', UT / navn)
