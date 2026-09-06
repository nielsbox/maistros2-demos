# mAIstros 2 - interactieve borden

Vijf borden bij de lessenreeks **mAIstros 2** (machine learning, leerlingen van 15 tot 17). Ze
worden vanuit een slide in FTRPRF Studio geopend, meestal op een beamer, en daarna door de
leerlingen zelf op hun eigen laptop.

| Bord | Doel | Route |
|---|---|---|
| Regressie-lab | jouw data bepaalt het model | `/les1/regressie-lab` |
| Teken de lijn | trainen is zoeken | `/les1/teken-de-lijn` |
| Hoe goed past de lijn? | wat de score betekent | `/les1/hoe-goed-past-de-lijn` |
| Data-dokter | jij beslist welke rijen het model mag gebruiken | `/les2/data-dokter` |
| Kijk in de q-tabel | de agent leert eerst bij de schat | `/les12/kijk-in-de-q-tabel` |

Eén bord, één doel. Dat doel staat als eerste zin op het bord zelf, want een leerling die via een
slide binnenkomt ziet de overzichtspagina nooit.

## Lokaal draaien

```bash
npm install
npm run dev
```

`npm run build` bouwt naar `dist/`. `npm run lint` draait oxlint.

## Deployen op Cloudflare Workers

Verbind deze repo met een Workers-project en zet build command `npm run build`. De rest staat in
`wrangler.jsonc`: de gebouwde bestanden komen uit `dist/`, en `not_found_handling` op
`single-page-application` geeft elk pad dat geen bestand is `index.html` terug.

Doe dat **niet** met een `_redirects`-regel `/* /index.html 200`. Workers stript zelf `.html` en
`/index`, ziet daarna zijn eigen resultaat opnieuw, en weigert de regel als een oneindige lus:

```
Invalid _redirects configuration:
Line 1: Infinite loop detected in this rule.
```

`public/_headers` blijft wel gewoon werken. Het zet `X-Content-Type-Options` en `Referrer-Policy`,
en zet **bewust geen** `X-Frame-Options`: de borden worden in een iframe op studio.ftrprf.be
getoond.

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
toestand `#1f8a6d`, datapunten `#00065d`. Het handvat op de x-as van het Regressie-lab is niet fout
en niet het model, dus dat is de derde toestand. Bij elk merk hoort een inkt voor tekst: `#8a5a12`
en `#187159`. Getoetst op kleurenblindheid; rood tegen groen zakt door elke test.

Die waarden staan op precies één plaats, het `@theme`-blok in `src/index.css`. De borden lezen ze
via `src/lib/palette.ts` en schrijven zelf nooit een hex op. De namen zeggen wat een kleur betekent,
nooit hoe ze eruitziet: een token die `purple` heette maar blauw tekende, stuurde leerlingen ooit op
zoek naar een paars handvat dat er niet was.

## Verwant

De startcode die de leerlingen invullen staat in
[CodeFever-VZW/Maistros2](https://github.com/CodeFever-VZW/Maistros2).
