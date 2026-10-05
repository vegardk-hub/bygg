# Bygg – innledende plan (utkast 1, 2026-10-05)

Et enkelt, firkantbasert bygge- og utforskningsspill som kjører fra GitHub Pages (PWA).
Brettet avdekkes gradvis, ulike ruter gir ulike råvarer og byggemuligheter, mynter tjenes
blant annet ved å binde landsbyer sammen med veier, og ved milepæler kan man reise til en
ny, generert verden med det man har samlet.

---

## 0. Beslutninger (avklart 2026-10-05)
| Tema | Valg | Konsekvens |
|---|---|---|
| Målgruppe | **Familie / alle aldre** | Lett å begynne (ikoner, store knapper), dybde gjennom nabobonuser, oppdrag og handelsnett |
| Tid | **Turbasert «Ny dag»-knapp** | Ingen ventetid, ingen offline-beregning; all produksjon skjer ved dagskifte |
| Press | **Helt koselig** | Ingen tap, ingen nedgang: landsbyer krymper aldri, dyr forsvinner ikke, ingen konkurs eller ødeleggende hendelser |
| Ny verden | **Skip med lasterom + seiling fram og tilbake** | Gamle verdener blir værende; man kan seile tilbake og hente mer med hvert skip. Verdener lagres side om side |

Antakelser jeg har gjort (kan overstyres): gamle verdener fortsetter å produsere til eget lager (med tak) mens man er borte; en seilas tar 1–2 dager; flere skip kan kjøpes og oppgraderes.

---

## 1. Hva research sier (59 søk) – lærdommer fra eksisterende spill

| Spill | Hva vi stjeler | Hva vi unngår |
|---|---|---|
| **Post Apo Tycoon** | Klikk på ruter for å åpne land; rutetypen bestemmer hva som kan bygges (gård på eng, sag i skog); fortelling dukker opp mens man utforsker | Premiumvaluta, ventetid på bygg, grind |
| **The Battle of Polytopia** | *Én* valuta (stjerner), firkantrutenett, tåke, ruiner med skatter, høste dyr/frukt/fisk fra ruter, **nabobonus** (sagbruk +1 per nabo-hogstbu, mølle +1 per nabogård) | Krig/enheter |
| **Civilization** | Ruteavkastning, veier som binder byer sammen gir gull, handelsrute-formel basert på bystørrelse | Kompleksitet, vedlikeholdskostnader som straffer |
| **SimCity** | Inntekt vokser med befolkning (skatt) | Budsjettmikro |
| **Catan** | 5 råvarer er nok; knapphet på én (murstein → vei) skaper valg | – |
| **Northgard** | 4 råvarer, ingen foredling; *hver ny rute koster mer* (økende pris for å utvide) | – |
| **Banished / Anno 1404** | Jordvei billig → steinvei som oppgradering; jeger/samler/fisker | Lange produksjonskjeder (Anno har 3–5 ledd – for mye her; maks 1 foredlingsledd) |
| **Against the Storm** | Roguelite-byggespill: forlat bosetningen, ta med fremgang til neste – tilsvarer «ny verden» | Tidspress |
| **Cookie Clicker** | «Ascension»: reset med permanent bonus gjør hver ny runde raskere og morsommere | – |
| **Islanders** | Prosedyregenererte øyer gir variasjon med enkle regler; «kan vi kutte dette?» | – |
| **Dorfromantik** | *Handlingen man gjør oftest skal føles best* (lyd, hopp, «Perfekt!») | – |
| **Kingdom Two Crowns** | Basen oppgraderes i synlige trinn (leir → landsby → borg) | – |
| **Idle-matte** | Kostnad = grunnpris × vekst^antall, vekst 1,07–1,15; SimCity Social: hvert nytt landstykke +~4 % | Eksponentiell tallinflasjon |

**Kjerneinnsikter**
1. Utforsking er morsomt fordi den åpner et *informasjonsgap*: man ser kanten av tåka og lurer på hva som er bak. Hver avdekking bør kunne gi noe (ressurs, dyr, ruin, landsby).
2. Få råvarer, tydelig kobling rute → råvare. 4–6 basisråvarer er normen (Catan 5, Travian 4, Northgard 4).
3. Plasseringsvalg (nabobonuser) gir dybde uten nye regler.
4. Kort, tydelige mål (oppdrag) + langt mål (ny verden) holder sandkassen retningsstyrt.
5. Firkant > heks for dette: enklere kode, bedre for bygninger og veier.

---

## 2. Kartgenerering – anbefaling

**Ikke** et ferdig spillmotorbibliotek. Anbefalt oppskrift (Red Blob Games «terrain from noise»):

1. **Seedet tilfeldighet:** `mulberry32(seed)` (5 linjer). Samme seed = samme verden → lagringen blir liten (seed + endringer), og en verden kan deles som et nummer.
2. **Støy:** egen simplex/fbm-implementasjon i `js/stoy.js` (etter Gustavsons referanse, ~80 linjer) – ingen ekstern avhengighet, virker offline.
3. **To kart:** høyde (e) og fuktighet (m), 3–4 oktaver, høyde opphøyd i potens for flatere lavland og spissere fjell.
4. **Biomtabell** (forenklet Whittaker):

   | Høyde e | Fuktighet lav | middels | høy |
   |---|---|---|---|
   | < 0,30 | Vann | Vann | Vann |
   | 0,30–0,35 | Strand | Strand | Myr/siv |
   | 0,35–0,65 | Eng/gress | Gress | Skog |
   | 0,65–0,78 | Ås (stein) | Skog | Skog |
   | > 0,78 | Fjell | Fjell | Fjell (snø) |

5. **Overlegg (plassering med minsteavstand, «Poisson-disk» light):** landsbyer (minst 6–8 ruter fra hverandre, kun på gress), dyreflokker (gress/skog), bærbusker, ruiner/skattekister, malmårer i fjell.
6. **Elver (valgfritt, fase 4):** følg bratteste vei nedover fra et fjell til vann.
7. **Rettferdig start:** startruten tvinges til gress, og det garanteres skog + vann + dyr innen radius 3 og en landsby innen radius 6–8. Ellers forkastes seeden og neste prøves.

Vurdert og forkastet: *Wave Function Collapse* (vakker, men styrer dårlig mengden ressurser), *rot.js FOV* (unødvendig – vi avdekker per rute, ikke synslinjer), Tiled/LDtk (håndlagde kart – vi vil ha nye verdener).

---

## 3. Ruter og råvarer – forslag

### Rutetyper (≈ andel av kartet)
| Rute | ≈ andel | Gir | Kan bygge |
|---|---|---|---|
| 🌱 Eng/gress | 30 % | 🌾 Korn | Gård, Hus, Marked, Vei |
| 🌲 Skog | 20 % | 🪵 Tre | Hogstbu, Sagbruk (nabobonus) |
| ⛰️ Ås | 8 % | 🪨 Stein | Steinbrudd |
| 🏔️ Fjell | 7 % | 🪨 Stein + ⛓️ Jern (malmåre) | Gruve, Utkikkstårn (avdekker langt) |
| 🌊 Vann | 20 % | 🐟 Fisk | Fiskebu (fra kystrute), Bru |
| 🏖️ Strand | 5 % | – | Havn (→ skip til ny verden) |
| 🦌 Dyr (overlegg) | 4 % | 🍖 Kjøtt | Jakthytte; flokken vandrer av og til til en naborute (forsvinner aldri); Beite (gjerde) gir mer og holder den på plass |
| 🏘️ Landsby (overlegg) | ~1 per 80 ruter | 🪙 Handel | Kobles med vei, selger/kjøper, gir oppdrag |
| 🏚️ Ruin / skattekiste | 1–2 % | Engangsfunn | – |
| 🫐 Bærbusk | 3 % | Mat-bonus | – |

### Råvarer: 5 basis + 1 sjelden + mynter
- **Basis:** 🪵 Tre · 🪨 Stein · 🌾 Korn · 🐟 Fisk · 🍖 Kjøtt
- **Sjelden:** ⛓️ Jern (bare fjell, få steder)
- **Valuta:** 🪙 Mynter
- Korn, fisk og kjøtt teller alle som **mat** for landsbyene (variasjon gir bonus), men holdes adskilt fordi de kommer fra ulike ruter.
- **Foredlet (fase 4, valgfritt):** 🪚 Planker (tre → sagbruk), 🔨 Verktøy (jern + tre → smie). Maks ett foredlingsledd.

---

## 4. Pengesystem – inntekt og utgifter

### Inntekt
1. **Handelsveier mellom landsbyer** *(kjernen)*. Når to landsbyer er bundet sammen av en sammenhengende vei (sjekkes med flood-fill/union-find), opprettes en handelsrute:
   `inntekt per dag = (størrelse A + størrelse B) × veifaktor + ⌊lengde / 5⌋`
   - Tresti: faktor 1 (koster 1 tre per rute)
   - Steinvei: faktor 2 (oppgradering, koster 1 stein per rute)
   - Bru over vann: planker/tre + stein
   - Flere landsbyer i samme nett gir flere ruter (3 landsbyer = 3 par) → nettverket blir mer verdt.
2. **Landsbyer vokser** (størrelse 1→5) når de får mat levert → mer handel.
3. **Salg på marked:** hver landsby kjøper visse varer. Prisen synker litt for hver enhet man selger, og stiger igjen over tid, så det ikke lønner seg å spamme én vare.
4. **Oppdrag fra landsbyer:** «Bjørkly trenger 10 fisk» → mynter + vekst.
5. **Funn under utforsking:** skattekister, ruiner, vandrende handelsmann.

### Utgifter (sluk)
- **Avdekke rute:** grunnpris × 1,04^(antall avdekket), så det blir gradvis dyrere (Northgard/SimCity Social).
- **Bygg** (råvarer + mynter), oppgraderinger (nivå 1–3), veier.
- **Skip/reise** til ny verden (stort mål).
- Ingen vedlikeholdskostnader i første versjon (de straffer mer enn de underholder).

All tallbalanse samles i én fil (`data/balanse.js`) så det er lett å justere.

---

## 5. Ny verden og seiling mellom verdener
- **Første reise utløses** når en milepæl er nådd, for eksempel ≥ 40 % av kartet avdekket, ≥ 3 landsbyer koblet sammen og en havn med skip bygget.
- **Ny verden genereres** med nytt seed. Mynter følger alltid med; råvarer begrenses av skipets *lasterom*.
- **Verdenene blir værende.** Et lite *havkart* viser alle oppdagede verdener som øyer. Man kan seile tilbake til en tidligere verden, fortsette å bygge der og hente mer. Hvert skip frakter én last per seilas.
- **Gamle verdener produserer videre** til sitt eget lager mens man er borte (lageret har et tak som kan bygges ut). Det lønner seg altså å dra tilbake og hente, uten at noe går tapt.
- **Skip som langsiktig mål:** flere skip, større lasterom, raskere seil. Senere kan man kanskje sette opp en *fast handelsrute* (et skip som går automatisk mellom to verdener, som veiene mellom landsbyer, bare på havet).
- **Hver ny verden er litt annerledes:** større kart og nytt biom (🏜️ ørken med kameler og kaktus, ❄️ snø med isbjørn og is, 🌴 jungel med frukt og papegøyer). Noen råvarer finnes bare i én verden (f.eks. glass fra ørkensand, pels fra snøverden). Det gir en naturlig grunn til å seile fram og tilbake.
- **Permanente bonuser** («Kartstjerner») for hver nye verden: +1 startrute avdekket, billigere veier, osv.
- **Verdensnummer (seed)** vises, slik at en god verden kan deles.

---

## 6. Variasjon – det som gjør det morsomt over tid
- Nabobonuser (Polytopia): sagbruk ved hogstbuer, mølle ved gårder, smie ved gruver.
- Hendelser (bare positive eller nøytrale, siden spillet er koselig): vandrende handelsmann, dyreflokk som flytter seg, festival i en landsby, god fiskesesong, skattekart som peker inn i tåka.
- Oppdrag fra landsbyer (korte mål) + milepæler (mellomlange) + ny verden (langt mål).
- Sjeldne ruter: gullåre, fyrtårn, hellig tre, dragehule (?).
- Juice: lyd (jsfxr), små hopp når noe bygges, flytende «+3 🪵», konfetti ved ny handelsrute. Den hyppigste handlingen (avdekke rute) skal føles best.

---

## 7. Teknisk
- **Vanilla JS (ES-moduler), ingen byggesteg**, Canvas 2D, GitHub Pages, PWA (manifest og service worker med cache-first), som de andre PWA-ene.
- **Grafikk:** Kenney Roguelike RPG-pakken (CC0, 16 px), allerede lastet ned i `C:\Vegard\Claude\kenney` med koordinatoppslag fra Lesestjerna-kartet. Skaleres med heltall og `imageSmoothingEnabled = false`. Alternativ: Kenney Tiny Town (CC0, 16 px). Emoji fungerer for en rask prototype, men ser ulikt ut på ulike plattformer.
- **Overganger** (strandkanter): start med enkle kanter; full «blob-47»-autotiling bare hvis det trengs.
- **Kontroll:** trykk = velg rute, dra = panorer, knip = zoom. Store knapper (≥ 48 px) for iPad.
- **Lagring:** localStorage med `versjon` og migreringer. Tilstanden er `{ dag, mynter, skip[], kartstjerner, aktivVerden, verdener[] }`, der hver verden er `{ seed, biom, størrelse, avdekket, bygg, veier, lager }`. Selve terrenget lagres ikke, men genereres på nytt fra seeden, så mange verdener tar lite plass. Pluss en «lagrekode» for eksport og import, fordi iOS kan slette data etter lang inaktivitet.
- **Dagskifte:** «Ny dag» kjører produksjon i *alle* verdener, flytter skip som er på sjøen ett steg og trekker eventuelle hendelser.
- **Kartstørrelse:** verden 1 er 32×32 (ca. 12×9 synlig om gangen). Senere verdener 40×40 og 48×48.
- **Moduler:** `rng.js`, `kartgen.js`, `tegn.js`, `input.js`, `spill.js` (tilstand og regler), `okonomi.js`, `veinett.js`, `ui.js`, `lagring.js`, `data/*.js`.

---

## 8. Faser
| Fase | Innhold | Ferdig når |
|---|---|---|
| 0 ✅ | Kartgenerator + visning (debugknapp: «ny seed») | Kartene ser naturlige og varierte ut |
| 1 ✅ | Kjerne: tåke, avdekke, 3 råvarer (tre, stein, korn), 3 bygg, mynter, lagring | 10 min spill uten feil og med lyst på mer |
| 2 | Landsbyer, veier (tre → stein), handelsruter, marked | Veibygging føles lønnsomt |
| 3 | Alle råvarer, dyr, fisk, jern, nabobonuser, oppdrag | Variert midtspill |
| 4 | Havn, skip, ny verden, havkart, seiling fram og tilbake, lager i gamle verdener, kartstjerner, nye biomer | Det er morsomt å seile tilbake og hente last |
| 5 | Hendelser, lyd, juice, PWA-polish, iPad-test, balansering | Klar for familien |

---

## 9. Gjenstående spørsmål (antakelse i parentes)
Grafikkstil (Kenney-piksler) · avdekking (betale per nabo-rute + utkikkstårn) · befolkning/arbeidere (ikke i v1) · kartstørrelse (32×32 → voksende) · navn/repo (`vegardk-hub/bygg`) · produserer gamle verdener mens man er borte (ja, til lager med tak) · seilastid (1–2 dager).

---

## Kilder (utvalg)
- Red Blob Games – Making maps with noise: https://www.redblobgames.com/maps/terrain-from-noise/
- simplex-noise (jwagner): https://www.npmjs.com/package/simplex-noise
- Mulberry32 / PRNG-er i JS: https://github.com/bryc/code/blob/master/jshash/PRNGs.md
- Post Apo Tycoon-anmeldelse: https://snappattack.com/2024/11/18/post-apo-tycoon-ios-snapp-review/
- Polytopia designperspektiv: https://www.pixelatedplaygrounds.com/sidequests/game-design-perspective-the-battle-of-polytopia
- Polytopia befolkning/ressurser: https://polytopia.fandom.com/wiki/Population
- Civ5 handelsrute-formel: https://civilization.fandom.com/wiki/Trade_route_(Civ5)
- Endless Legend handelsruter: https://endlesslegend.fandom.com/wiki/Trade_Routes
- Northgard ressurser: https://northgard.fandom.com/wiki/Resources
- Banished veier: https://banishedinfo.com/wiki/Stone_road
- Catan-ressurser: https://settlersboard.com/blog/catan-resources-explained
- Anno 1800 forsyningskjeder: https://chillplacegaming.com/anno-1800-supply-chains/
- Against the Storm-anmeldelse: https://rogueliker.com/against-the-storm-review/
- Islanders – strategisk minimalisme: https://medium.com/game-world-observer/strategic-minimalism-behind-indie-hit-islanders-e45180827514
- Dorfromantik – tilfredsstillende plassering: https://www.gamedeveloper.com/business/sparking-joy-through-tile-placement-in-idyllic-village-builder-i-dorfromantik-i-
- The Math of Idle Games: https://www.gamedeveloper.com/design/the-math-of-idle-games-part-i
- SimCity Social landutvidelse: https://simcitysocial.fandom.com/wiki/Land_Expansion
- Grids in Games – skala og form: https://www.gamedeveloper.com/design/grids-in-games-scale-and-shape
- Amit om grids (heks vs firkant): https://theory.stanford.edu/~amitp/game-programming/grids
- Autotiling / blob-47: https://www.boristhebrave.com/2021/09/12/beyond-basic-autotiling/
- Kenney Tiny Town: https://kenney.nl/assets/tiny-town
- Crisp pixel art (MDN): https://developer.mozilla.org/en-US/docs/Games/Techniques/Crisp_pixel_art_look
- PWA på iOS – begrensninger: https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide
- localStorage-versjonering: https://www.abratabia.com/game-saves/localstorage-saves.php
- UX for barn (NN/G): https://www.nngroup.com/articles/children-ux-physical-development/
- Kompulsjonsløkker og nysgjerrighet: https://www.gamedeveloper.com/design/compulsion-loops-dopamine-in-games-and-gamification
- jsfxr lydeffekter: https://sfxr.me/

---

## Status fase 0 (2026-10-05)
Kartverkstedet ligger i `index.html` + `js/` (start lokalt: `python -m http.server 8123`).
- `js/rng.js` (mulberry32 + seed-blanding), `js/stoy.js` (egen simplex/fbm), `js/kartgen.js`, `js/tegn.js`, `js/grafikk.js`, `js/data/terreng.js`, `js/verksted.js`.
- Øy-form: rund avstandsfalloff + domene-forvrengt støy; fjell styres av egen støy (ikke midten).
- Kenney-blobsett målt piksel for piksel: gress (2,15), sand (7,21), stein (7,15); innerhjørner ved siden av.
- Test: 300 verdener (24/32/48) – 0 feil, alle på første forsøk, 1–5 ms per verden; samme seed gir identisk verden.
- Kjente plassholdere: dyr tegnes som emoji (arket har ingen dyr), landsby som telt, skatt som gullstatue.
- Små avvik: strand ~5 % (mål 7 %) og ås ~6–8 % fordi enslige ruter ryddes bort etter kvantilene.

## Status fase 1 (2026-10-05)
Spillet ligger i `index.html` (kartverkstedet flyttet til `verksted.html`).
- Regler uten DOM i `js/spill.js`; tall i `js/data/balanse.js`; mål i `js/data/maal.js`.
- Visning: `js/main.js` (tilstand, tegning, tåke), `js/panel.js` (HUD, mål, rutepanel, meny), `js/kamera.js` (delt med verkstedet), `js/effekter.js`, `js/lyd.js` (Web Audio, ingen filer), `js/lagring.js` (localStorage, versjon + migreringer, lagrekode), `js/navn.js` (landsbynavn).
- Løkke: trykk ?-rute = avdekk (koster mynter, +1 % per rute, vann halv pris) → bygg hogstbu/gård/steinbrudd med nabobonus → «Ny dag» gir produksjon → selg i leiren → oppgrader (nivå 2–3 krever stein).
- Funn: skatter (mynter), bærbusker (korn), landsbyer (navn, handel i fase 2). Dyr og malm opptar ruta til fase 3.
- 20 mål i rekkefølge, 3 synlige, belønning med en gang.
- Test: `node test/simuler.js [seed] [dager]` – regeltester + robot som spiller. Robot når 19/20 mål på ~25 dager; økonomien flater ut rundt dag 20 (fase 2-handel gir ny inntekt).
- Kjent: stein brukes bare til oppgraderinger (veier i fase 2 gir mer bruk); dyr er fortsatt emoji.

## Ny grafikk: brettstil (2026-10-05)
Inspirert av Post Apo Tycoon (`inspirasjon/eksempel 1.png`, målt med bildetolker: fuge ≈1,5 % av ruta,
mørkere kanter, svart bakgrunn `#010101`, klammer `#faf2db`). All grafikk er tegnet med kode – ingen bildefiler.
- `js/stil/palett.js` (farger), `js/stil/lavpoly.js` (fasetter, isometri, trær, steiner, topper),
  `js/stil/ruter.js` (terreng, bygg, overlegg, ukjent-kort, klammer), `js/stil/veier.js` (trevei, steinvei, jernbane, bruer, planovergang).
- `js/brett.js`: hva hver rute viser (`innholdFor`), kort-hurtiglager per zoomtrinn (48–384 px), røyk rundt kanten, avdekkingsanimasjon, nivåmerker, klammer.
- `proveark.html`: prøveark med alle ruter, bygg, veier og jernbane (fase 2-forberedelse).
- Kartverkstedet (`verksted.html`) bruker fortsatt Kenney-grafikken – det er bare et utviklerverktøy.
