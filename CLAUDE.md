# Bygg
Koselig, turbasert byggespill på firkantbrett for hele familien: avdekk tåka, bygg, lag veier mellom landsbyer og seil til nye øyer. Statisk PWA (ren HTML/CSS/JS som ES-moduler, ingen byggesteg).

## Kjøre og teste
- Forhåndsvisning: `bygg` i `.claude/launch.json` (python http.server, port 8123).
- Røyktest: `node .dev/roykTest.mjs` (skal skrive «Røyktest OK»).
- Egne tester og balansesimulering: `node test/simuler.js [seed] [dager]` (regeltester + en robot som spiller).

## Publisering
- Repo `vegardk-hub/bygg`, gren `main`, live: https://vegardk-hub.github.io/bygg/
- Cache-navnet står i `sw.js`, linje 4: `const LAGER = 'bygg-v6';` (nå `bygg-v6`). Tell det opp ved hver utgivelse, ellers får brukerne gammel kode.
- Skillen `publiser-pwa` gjør røyktest, cache-oppteller, commit, push og kontroll av live-siden.
- Nye JS-/ikonfiler som spillet trenger må også inn i `FILER`-lista i `sw.js` (ellers virker de ikke offline).

## Struktur
- Spillregler uten DOM: `js/spill.js` (og `js/veinett.js` for veier/handelsruter). Alle balansetall: `js/data/balanse.js`; mål: `js/data/maal.js`.
- Tegning: `js/brett.js` bestemmer hva hver rute viser; selve grafikken er kode-tegnet i `js/stil/` (ruter, veier, lavpoly, palett). Ingen bildefiler.
- Lagring: `js/lagring.js` (localStorage, nøkkel `bygg-lagring`, versjonert med migreringer). Kartet lagres ikke, bare seed + spillerens endringer.
- `js/main.js` binder sammen UI, kamera, effekter og lyd; `js/panel.js` er HUD og paneler.
- `verksted.html` (+ `js/verksted.js`, bruker Kenney-grafikk) er et kartverksted for utvikling. `proveark.html` (+ `js/proveark.js`) viser alle ruter, bygg og veier.

## Verdt å vite
- Spillet er bevisst helt koselig: ingen tap, ingen nedgang, bare hyggelige hendelser. Ikke legg inn straff, vedlikeholdskostnader eller ødeleggende hendelser.
- Endrer du lagrede data, øk `SPILL_VERSJON` og legg til en migrering i `js/lagring.js` så gamle lagringer ikke går tapt.
- Service workeren cacher: ved lokal testing kan du få gammel kode. Avregistrer SW / last på nytt to ganger.
- Seeden bestemmer hele kartet; samme seed gir identisk verden (`js/rng.js`, `js/kartgen.js`). Ikke bruk `Math.random` i kartgenerering.
- Brukes av familie på iPad og mobil: store knapper (minst 48 px), `touch-action`, safe-area-innrykk, råvarelinja sveipes på én rad på høykant. Brukeren tester via GitHub Pages.
- `Inspirasjon/` (skjermbilder fra kommersielle spill) er gitignored og skal ikke committes. `PLAN.md` er historikk og designgrunnlag; `PLAN2.md` er et annet, ikke-utgitt spill og hører ikke til denne appen.
