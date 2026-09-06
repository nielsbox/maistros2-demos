# mAIstros 2 - interactieve borden

Vier borden bij de lessenreeks **mAIstros 2** (machine learning, leerlingen van 15 tot 17). Ze
worden vanuit een slide in FTRPRF Studio geopend, meestal op een beamer, en daarna door de
leerlingen zelf op hun eigen laptop.

| Bord | Doel | Route |
|---|---|---|
| Regressie-lab | jouw data bepaalt het model | `/les1/regressie-lab` |
| Teken de lijn | trainen is zoeken | `/les1/teken-de-lijn` |
| Hoe goed past de lijn? | wat de score betekent | `/les1/hoe-goed-past-de-lijn` |
| Data-dokter | jij beslist welke rijen het model mag gebruiken | `/les2/data-dokter` |

Eén bord, één doel. Dat doel staat als eerste zin op het bord zelf, want een leerling die via een
slide binnenkomt ziet de overzichtspagina nooit.

## Lokaal draaien

```bash
npm install
npm run dev
```

`npm run build` bouwt naar `dist/`. `npm run lint` draait oxlint.

## Deployen op Cloudflare Pages

Verbind deze repo met een Pages-project en zet:

| | |
|---|---|
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node version | 22 (`NODE_VERSION`) |

`public/_redirects` stuurt elk pad naar `index.html`, want de routes zijn client-side. Zonder dat
geeft een directe link naar een bord een 404. `public/_headers` zet `X-Content-Type-Options` en
`Referrer-Policy`, en zet **bewust geen** `X-Frame-Options`: de borden worden in een iframe op
studio.ftrprf.be getoond.

## Hoe dit gebouwd is

`src/components/Canvas.tsx` is het gedeelde 2D-bord en hoort hergebruikt te worden voor elke
volgende grafiek: het vult het hele scherm, je sleept om te pannen, je zoomt met scroll of knijpen,
"Fit" kadert opnieuw, en x en y schalen los van elkaar. De panelen zweven erboven. Canvas meet die
panelen en houdt hun plaats vrij bij het kaderen, dus een paneel dat halverwege verschijnt laat het
bord opnieuw kaderen - daarom staan ze er altijd, ook leeg.

Regels die uit echte fouten in de klas komen:

- **Test op 1024x768**, niet op je laptop. Een bord dat er op 1440x900 perfect uitzag was op
  beamerformaat helemaal leeg.
- **Elke knop moet een zichtbaar resultaat geven**, anders leest ze als kapot.
- **Toon de toestand, beschrijf ze niet.** Wat meedoet en wat niet moet van achteraan in het lokaal
  leesbaar zijn, en nooit alleen aan de kleur.
- **Wat je aanklikt moet zijn wat je raakt**, en een klik is geen sleep.
- **Eén woord per begrip.** Een regel uit het gegevensbestand is een *rij*, de *lijn* is die van het
  model, en de *fout* is hoe ver het model ernaast zit.
- Getallen zijn Nederlands: komma als decimaalteken, een harde spatie bij duizendtallen.
- Geen emoji, geen punten, geen badges. Data is deterministisch via `seeded(n)`, nooit
  `Math.random`, zodat elke leerling en elke beamer hetzelfde beeld ziet.

Kleuren zijn berekend, niet gekozen: de lijn van het model `#4c6fe0`, missers `#b8791f`, een derde
toestand `#1f8a6d`, datapunten `#00065d`. Getoetst op kleurenblindheid; rood tegen groen zakt door
elke test.

## Verwant

De startcode die de leerlingen invullen staat in
[CodeFever-VZW/Maistros2](https://github.com/CodeFever-VZW/Maistros2).
