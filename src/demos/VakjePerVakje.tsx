import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Canvas, { type Scales, type View } from '../components/Canvas'
import { Brief, Btn, Note, Panel, PyChip } from '../components/Overlay'
import Vaststelling, { getal, meervoud } from '../components/Vaststelling'
import { clamp } from '../lib/regression'
import {
  AANTAL_PIXELS,
  ZIJDE,
  balkas,
  bijdragen,
  keuze,
  keuzes,
  laadPixelModel,
  laatsteAndereKoploper,
  tel,
  totalenPerRijtje,
  verschuif,
  type PixelModel,
} from '../lib/mnist'
import { DATA, FOUT, INK, MODEL, MUTED, NAVY, RULE } from '../lib/palette'

/* ------------------------------------------------------------------ *
 * mAIstros 2 - les 4 - Wat telt elke pixel mee?
 *
 * EEN DOEL: het model gaf elke pixel een getal, voor elk cijfer apart,
 * en die getallen telt het op. Na dit bord moet een leerling in zijn
 * eigen woorden kunnen zeggen HOE het model aan zijn antwoord komt:
 * de computer leerde per pixel een getal, apart voor elk cijfer; bij dit
 * beeldje telt hij alle getallen op waar inkt staat; het cijfer met het
 * hoogste totaal is zijn antwoord; schuift de inkt één pixel op, dan
 * ligt ze op andere getallen en kan het antwoord veranderen.
 *
 * WAAROM DIT BORD OPNIEUW GEMAAKT IS. De vorige versie liet zien DAT het
 * model niet tegen verschuiven kan. Dat is waar en het is gemeten, maar
 * het is geen uitleg van het algoritme: het model bleef een doos waar je
 * aan de buitenkant aan mocht duwen. De gemeten brosheid is nu de
 * AFLOOP van de uitleg en niet meer het hele bord - de teller en de vier
 * richtingen staan er nog, en de getallen eronder zijn niet veranderd.
 *
 * WAAROM HET DAARNA NOG EEN KEER GEWIJZIGD IS: HET BEGON AL AFGELOPEN.
 * De vraag die erop kwam was "wat is het nut van deze slider, ik mis wat
 * context of verhaal". Die vraag had een precieze oorzaak: `rijtje` begon op
 * `ZIJDE`, dus het bord opende met alle 28 rijtjes al opgeteld. De optelling
 * rijtje na rijtje is het hele mechanisme waar dit bord voor bestaat, en die
 * was gebeurd voordat de leerling keek. Het handvat leek daardoor dood, en
 * alleen "Tel opnieuw op" liet nog zien waar het ooit voor was.
 *
 * Drie dingen zijn daarop veranderd, en alle drie staan hieronder in het
 * bestand uitgemeten:
 *
 *   1. HET BORD TELT ZELF ÉÉN KEER OP bij aankomst, van 0 tot 28 in 2,5 s.
 *      Zie het blok bij `startNarratie` voor waarom niet op 0 en niet
 *      halfweg openen: op rijtje 0 staan tien balken van nul lengte en op
 *      rijtje 14 staat bij 94 van de 120 beeldjes een ander cijfer bovenaan
 *      dan het antwoord.
 *   2. HET HANDVAT HEEFT EEN REGEL DIE ZEGT WAAR JE NAARTOE SLEEPT, met de
 *      getallen van dit beeldje in deze stand: "Sleep naar rijtje 21: cijfer
 *      7 op kop." Zie `handvatRegel` en `laatsteAndereKoploper()`.
 *   3. HET PANEEL LEEST NU VAN MECHANISME NAAR AFLOOP. De teller over 120
 *      beeldjes stond bovenaan, boven de optelling die dit bord uitlegt, dus
 *      wie van boven naar onder las, kreeg eerst de conclusie. Ze staat nu
 *      onder de knoppen die haar laten bewegen, en haar regel zei
 *      "Ander antwoord: 0." zonder te zeggen ander dan wat - zie
 *      `tellerRegel`.
 *
 * DAT DE LES DIT NERGENS UITLEGT, IS GEMETEN OP DE LES ZELF. Over alle 94
 * slides van lc 4510 komen de woorden gewicht, weegt, "telt op", optellen en
 * "per pixel" 0 keer voor. Stap 5 (2128387) roept `LogisticRegression()` aan
 * en 2128390 laat de ConvergenceWarning zien; hoe het model aan zijn antwoord
 * komt, staat er niet. Dit bord kan dus op geen enkele slide leunen en moet
 * zijn eigen context volledig zelf dragen. Vandaar de narratie bij aankomst:
 * er staat geen leerkracht bij les 3, 4 en 5.
 *
 * "RIJTJE" EN NIET "RIJ", en dat is de les na, niet ervoor. De woordenlijst
 * van dit project geeft `rij` aan één regel van het databestand, en in les 4
 * IS dat een heel beeldje: 2128308 zegt letterlijk "Een beeldje staat bij ons
 * als één lange rij van 784 getallen" en gebruikt in de volgende zin "28 rijen
 * van 28" voor een strook van het beeldje - twee betekenissen op één slide. De
 * les zelf zegt op 2128303 en op 2128387 "28 rijtjes van 28", en 2128387 is
 * een slide die alle drie de weergaven heeft. `rijtje` is dus het woord van de
 * les voor precies wat dit bord optelt, en het botst niet met `rij`.
 *
 * ALLE GETALLEN OP DIT BORD WORDEN LIVE GEREKEND, met de gewichten van het
 * model uit de les. Er staat nergens een getal in de tekst, ook niet het
 * aantal beeldjes: dat komt uit het exportbestand. Nagerekend met sklearn en
 * daarna met deze TypeScript zelf, identiek in beide:
 *
 *   stand                juist van 120     ander antwoord dan in het midden
 *   in het midden          111   92,5 %                                   0
 *   1 pixel omhoog         103   85,8 %                                  14
 *   1 pixel omlaag         100   83,3 %                                  20
 *   1 pixel naar links     103   85,8 %                                  18
 *   1 pixel naar rechts    102   85,0 %                                  16
 *   omhoog en links         87   72,5 %                                  32
 *   omhoog en rechts        97   80,8 %                                  21
 *   omlaag en links         94   78,3 %                                  26
 *   omlaag en rechts        86   71,7 %                                  36
 *
 * WAAROM ER EEN TELLER OP STAAT, EN WAAROM OVER 120 BEELDJES. Een
 * willekeurige 5 kantelt NIET bij één pixel: dat doet ongeveer 4% per
 * richting. Het openingsbeeldje is dus met opzet gekozen, en dan mag het bord
 * niet suggereren dat elk beeldje zo reageert. De verdedigbare zin daarvoor is
 * niet een tweede anekdote maar de teller.
 *
 * Die teller moet dan wel groot genoeg zijn, en dat is GEMETEN, niet gekozen.
 * Over 2000 steekproeven uit de 300 beeldjes van het eerste exportbestand,
 * hoe vaak minstens één van de acht richtingen NIET zakt:
 *
 *   60 beeldjes   249 van 2000  12,4 %
 *   80 beeldjes    72 van 2000   3,6 %
 *  100 beeldjes    16 van 2000   0,8 %
 *  120 beeldjes     9 van 2000   0,5 %
 *  150 beeldjes     1 van 2000   0,1 %
 *
 * Bij een handvol beeldjes spreekt de teller het doel van dit bord dus tegen:
 * op de eerste 30 was "omlaag" en "naar rechts" exact even juist als het
 * midden, en op de eerste 40 was "omlaag" zelfs béter. Vandaar 120: klein
 * genoeg om het bestand te halveren, groot genoeg dat alle acht de richtingen
 * zakken, met de kleinste marge op 6,7 procentpunt. Zet dit nooit lager
 * zonder die tabel opnieuw te maken.
 *
 * WAAROM ER NOOIT INKT AFVALT. Het exportbestand bevat alleen beeldjes met
 * minstens één lege pixel langs alle vier de randen, en het bord schuift
 * hoogstens één pixel per as. Nagerekend over 9 standen x 120 beeldjes: de
 * som van de pixelwaarden blijft exact gelijk. Zonder die grens zou het
 * bord twee lessen door elkaar halen - "verschuiven verwart het model" en
 * "het cijfer is afgesneden".
 *
 * WAAROM HET BORD DE VOLLE GEWICHTENKAART NIET TEKENT, hoewel ze in het
 * bestand zit. Ze is onleesbaar, en dat is gemeten op dit bestand zelf. Neem
 * per cijfer de vakjes die minstens 15% van het sterkste gewicht van dat
 * cijfer halen, en tel de samenhangende gebieden: gemiddeld 20,1 losse
 * eilandjes per cijfer, waarvan 12,2 van één enkel vakje. Cijfer 5, het
 * openingsbeeldje, is de ergste: 45 eilandjes over 138 vakjes. Op 50% zijn het
 * nog 14,2 eilandjes waarvan 8,3 van één vakje. En de kaarten zijn onderling
 * niet vergelijkbaar: het sterkste gewicht van cijfer 8 is 0,003328, een derde
 * van dat van cijfer 5 (0,009612), dus één schaal maakt acht kaarten leeg en
 * tien schalen maken ze onvergelijkbaar. Op een vakje van 13 px leest dat als
 * ruis.
 *
 * Daarom legt dit bord de gewichten OP de inkt van het beeldje zelf. Dat is de
 * eerlijkste weergave die er is: een pixel zonder inkt draagt 0 bij, wat er
 * ook aan gewicht op die plek staat, en dat is precies wat de som doet. Het
 * per-pixel niveau blijft bereikbaar - wijs een vakje aan en het getal staat
 * er - maar de kaart zelf blijft van het scherm.
 *
 * WAAROM JE NIET ZELF MAG TEKENEN. Dat is gemeten, niet gegokt - op de volle
 * MNIST en dus niet na te rekenen uit het exportbestand hiernaast, dat maar
 * 120 beeldjes bevat. Op de laatste 7000 MNIST-rijen haalt dit model 94,37%.
 * Een met de hand getekend cijfer - volle inkt op 255, dikke streep, het vak
 * vullend, gecentreerd op zijn omtrek - haalt 13,15%, en 3 pixels uit het
 * midden 15,10%. Met de voorbewerking van MNIST zelf (20-vak, gecentreerd op
 * het zwaartepunt) haalt het 86,20%, maar die voorbewerking is onzichtbare
 * magie die de les nooit
 * noemt EN ze centreert het cijfer stil opnieuw - precies het tegendeel van
 * wat de afloop van dit bord laat zien. Dus kiezen uit de 120, niet tekenen.
 * ------------------------------------------------------------------ */

/**
 * Het venster is 30 bij 48 eenheden. Canvas kadert dat venster precies in wat
 * de panelen vrij laten, dus één eenheid wordt `min(vrijBreed/30,
 * vrijHoog/48)` pixels, en dat is de zijde van één pixel van het beeldje.
 *
 * Die 48 is GEMETEN, niet gekozen. De stapel is 28 eenheden beeldje plus een
 * vaste voet in pixels (twee bijschriften, de kop, tien balken en twee
 * antwoordregels), en die voet krimpt niet mee op een smal scherm. Nagemeten
 * in de browser, met de bovenrand van het kader en de onderrand van de
 * laatste antwoordregel, allebei ten opzichte van de bovenkant van het bord:
 *
 *              k      stapel   van boven   tot onder   bord hoog
 *   1440x900   17,2     767         37         804        900
 *   1366x768   14,5     690         33         723        768
 *   1280x800   15,1     709         35         744        800
 *   1280x720   13,5     662         19         681        720
 *   1024x768   14,5     690         29         719        768
 *    900x700   13,0     649         15         664        700
 *
 * De stapel staat gecentreerd, en op de twee laagste schermen is hij 16 en
 * 23 px hoger dan het vlak dat de panelen strikt vrij laten (646 en 626 px).
 * Dat mag: die 26 px boven en 48 px onder zijn de marge voor astekst, geen
 * harde rand. Wat WEL hard is, is de laatste regel - de onderste
 * antwoordregel eindigt op elk formaat minstens 36 px boven de onderkant van
 * het bord, en er staat op geen enkel formaat bordtekst op een paneel.
 *
 * Die zes sommen blijven gelden omdat de nieuwe stapel even hoog is als de
 * oude: er is één bijschrift bij gekomen, maar dat past in de bestaande 34 px
 * tussen het beeldje en de kop boven de balken. `hoogte` hieronder is
 * letterlijk dezelfde som als in de vorige versie van dit bord, met dezelfde
 * NA_BEELD, KOP en NA_BALKEN, dus de stapel is geen pixel gegroeid.
 *
 * Eén ding over de kolom "tot onder": die 36 px is gemeten tot de BASISLIJN
 * van de laatste regel. Meet je met `getBBox()`, dan zit de staart van een
 * letter als de p of de j er nog bij en kom je op 34,2 px bij 900x700 en
 * 38,1 bij 1280x720 - hetzelfde bord, twee meetmanieren. Nagerekend op de
 * basislijn haalt 900x700 38,6 px, en dus alle zes de formaten de 36. Een ELFDE regel zou het niet
 * halen: één extra regel van 18 px brengt de vrije ruimte onder de stapel bij
 * 900x700 op 17 px, ver onder de 36 die hierboven hard is. Verlaag deze 48
 * nooit, en voeg geen regel toe zonder die zes sommen opnieuw te maken.
 */
const VENSTER: View = { x0: 0, x1: 30, y0: 0, y1: 48 }

/** Ruimte tussen het beeldje en de kop boven de balken. Er staan twee
 *  bijschriften in, op 14 en 30 px onder de onderrand van het beeldje. */
const NA_BEELD = 34
/** De kopregel boven de balken, met de kop op 7 px boven de eerste balk. */
const KOP = 20
/** Tussen de laatste balk en de twee antwoordregels. */
const NA_BALKEN = 8

const NUL = new Uint8Array(AANTAL_PIXELS)

/* ------------------------------------------------------------------ *
 * DE KLEUR VAN EEN VAKJE.
 *
 * Twee armen van twee stappen plus een vlak voor bijna nul. De sterke
 * stappen ZIJN de merken die dit project al heeft: --color-model voor
 * "voor" en --color-fout voor "tegen". Alleen de twee lichte stappen en
 * het vlak zijn nieuw.
 *
 * DEZE DRIE HEXWAARDEN HOREN IN HET @theme-BLOK VAN src/index.css, want dat
 * is in dit project de enige plaats waar een merkkleur geschreven staat, en
 * src/lib/palette.ts is de enige plaats waar een bord er een naam voor
 * opvraagt. Ze staan hier omdat aan dit bord parallel met twee andere borden
 * gewerkt is en index.css niet van dit bord is. Verplaats ze bij de eerste
 * gelegenheid naar `--color-voor-licht`, `--color-tegen-licht` en
 * `--color-bijna-nul`, en laat deze drie regels dan verdwijnen.
 *
 * ZE ZIJN GETOETST, niet gekozen. Een divergerend palet is twee ordinale
 * paletten, dus de checker is per arm gedraaid (--ordinal --mode light
 * --surface #fcfbff):
 *
 *   tegen  #ceaa81 -> #b8791f   ALL CHECKS PASS  (dL 0,132, licht 2,10:1, 0 graden)
 *   voor   #96afef -> #4c6fe0   ALL CHECKS PASS  (dL 0,184, licht 2,11:1, 0 graden)
 *
 * En de kruisparen, dus de paren die tegengestelde betekenis dragen, halen
 * allemaal zowel de kleurenblindheidsgrens als de vloer voor normaal zicht:
 * licht tegen licht dE 15,9 protan / 16,4 normaal; sterk tegen sterk 28,8 /
 * 30,3; de twee overige kruisparen 24,6 en 27,4 bij het slechtste zicht.
 *
 * Wat de checker WEL afkeurt als je hem categorisch draait, is bij een
 * verloop de bedoeling: de chroma-vloer (#96afef 0,097 en #ceaa81 0,069) en
 * de vloer voor normaal zicht op het paar BINNEN één arm (#b8791f tegen
 * #ceaa81, dE 14,4). De docstring van de checker noemt die twee zelf "fail a
 * correct ramp by design". Hij waarschuwt ook dat de twee lichte stappen
 * onder 3:1 tegen het papier staan, en dat is legaal met relief: elk vakje
 * heeft een haarlijnrand, elk vakje met inkt heeft een navy stip, en wie een
 * vakje aanwijst krijgt het getal te lezen. Haal dat relief er niet uit.
 *
 * Een gekleurd midden bestaat niet: elke bijna-witte neutraal zakt door de
 * 2:1-vloer voor het lichte uiteinde (#f2f0f7 1,10:1, #d5d3de 1,44:1). Bijna
 * nul is daarom een VLAK, zoals de haarlijn `rule` er een is, en nooit een
 * merk.
 * ------------------------------------------------------------------ */

/** Licht "voor". Zie het blok hierboven: hoort in index.css. */
const VOOR_LICHT = '#96afef'
/** Licht "tegen". Zie het blok hierboven: hoort in index.css. */
const TEGEN_LICHT = '#ceaa81'
/** Vlak, geen merk: hier staat inkt maar ze telt bijna niets mee. 1,34:1
 *  tegen het papier, dus feller dan de haarlijn `rule` op 1,22:1. */
const BIJNA_NUL = '#dcdae4'

/**
 * De twee drempels tussen de drie banden.
 *
 * GEMETEN over 120 beeldjes x 10 cijfers, dus 181.960 bijdragen van pixels
 * met inkt: bij 0,10 en 0,30 valt 45,5% in de laagste band, 34,4% in de
 * middelste en 20,1% in de hoogste. Drie banden die alle drie echt gevuld
 * zijn, en op een vakje van 13 px zijn drie tinten van achter in de klas nog
 * te scheiden. Zeven waren dat niet.
 */
const BAND_LICHT = 0.1
const BAND_STERK = 0.3

function celkleur(v: number): string {
  const a = Math.abs(v)
  if (a < BAND_LICHT) return BIJNA_NUL
  if (v > 0) return a < BAND_STERK ? VOOR_LICHT : MODEL
  return a < BAND_STERK ? TEGEN_LICHT : FOUT
}

/** Eén stap van de optelling, in milliseconden. 28 stappen is dus 2,52 s:
 *  lang genoeg om de wedloop te volgen, kort genoeg om opnieuw te doen. */
const STAP_MS = 90

/** Een getal met een teken ervoor, Nederlands geschreven. `getal()` zet de
 *  komma en het minteken; het plusteken staat er niet in omdat een teller
 *  geen plusteken heeft. Op dit bord wel: het gaat om optellen en aftrekken. */
function metTeken(v: number): string {
  const s = getal(v, 2)
  return s.startsWith('-') || Number(v.toFixed(2)) === 0 ? s : `+${s}`
}

/**
 * De verschuiving in woorden. Dit is de enige plaats waar ze beschreven staat.
 *
 * "1 pixel" staat er één keer en niet bij elke richting. "1 pixel omhoog en
 * 1 pixel naar rechts" was 37 tekens en dat past bij 222 px inhoud niet naast
 * het kopje op één regel; "1 pixel omhoog en naar rechts" is 29 tekens, zegt
 * hetzelfde en past wel.
 */
function standInWoorden(dy: number, dx: number): string {
  const delen: string[] = []
  if (dy === -1) delen.push('omhoog')
  if (dy === 1) delen.push('omlaag')
  if (dx === -1) delen.push('naar links')
  if (dx === 1) delen.push('naar rechts')
  return delen.length === 0 ? 'in het midden' : `1 pixel ${delen.join(' en ')}`
}

/**
 * Het kopje van een bedieningsgroep, met de toestand van die groep op dezelfde
 * regel: links het kopje in kleinkapitaal, rechts wat er nu waar is.
 *
 * Waarom op één regel en niet eronder, zoals op de andere borden: hoogte. Met
 * de waarde onder het kopje was het vaste deel van dit paneel 466,3 px en de
 * cap bij 900x700 is 508, dus bleef er na de knoppen 1,7 px over voor de
 * uitleg onderaan. Twee groepen x 20 px teruggewonnen is precies wat de
 * eerste twee regels van die uitleg nodig hebben.
 *
 * `justify-between` en geen wrap: deze regel mag niet omslaan, want dan
 * verschuift alles eronder zodra de leerling verschuift. Daarom is de
 * langste waarde ook nagemeten - "1 pixel omlaag en naar rechts" op 13 px
 * naast het kopje "Stand" blijft binnen de 222 px inhoudsbreedte.
 */
function Groep({ label, children }: { label: string; children: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-ink/75">
        {label}
      </span>
      <span className="text-[13px] font-semibold tabular-nums leading-snug text-ink">
        {children}
      </span>
    </div>
  )
}

export default function VakjePerVakje() {
  const [model, setModel] = useState<PixelModel | null>(null)
  const [laadfout, setLaadfout] = useState<string | null>(null)

  /** Welk beeldje groot op het bord staat. 0 is de 5 die naar een 3 kantelt. */
  const [nr, setNr] = useState(0)
  const [dy, setDy] = useState(0)
  const [dx, setDx] = useState(0)
  /**
   * Hoeveel rijtjes van het beeldje al opgeteld zijn, 0 tot 28.
   *
   * DIT BEGINT OP 0, EN HET BORD TELT ZELF ÉÉN KEER OP. Zie het blok over de
   * openingstoestand boven `startNarratie`: die drie regels samen zijn de
   * reden dat een leerling die hier koud aankomt, binnen drie tellen de hele
   * optelling gezien heeft zonder te klikken.
   */
  const [rijtje, setRijtje] = useState(0)
  /** Van welk cijfer de getallen op het beeldje liggen. `null` betekent: het
   *  echte cijfer van dit beeldje. Zo is er niets stil te houden als de
   *  leerling een ander beeldje neemt - dan hoort er ook een ander cijfer bij. */
  const [gekozenCijfer, setGekozenCijfer] = useState<number | null>(null)
  /** De pixel die de leerling aanwijst. Alleen om het getal af te drukken. */
  const [aangewezen, setAangewezen] = useState<number | null>(null)

  /* De optelling die zichzelf afdraait. `useRef` en geen state: de leerling
     hoeft niet te zien DAT er een klok loopt, alleen wat ze doet. */
  const klok = useRef<number | null>(null)
  const stopTellen = useCallback(() => {
    if (klok.current !== null) {
      window.clearInterval(klok.current)
      klok.current = null
    }
  }, [])
  useEffect(() => stopTellen, [stopTellen])

  const telOpnieuw = useCallback(() => {
    stopTellen()
    setRijtje(0)
    klok.current = window.setInterval(() => {
      setRijtje((r) => {
        if (r + 1 >= ZIJDE) {
          stopTellen()
          return ZIJDE
        }
        return r + 1
      })
    }, STAP_MS)
  }, [stopTellen])

  /* ---------------------------------------------------------------- *
   * DE OPENINGSTOESTAND, en waarom het bord zelf begint te tellen.
   *
   * Dit bord stond op `useState(ZIJDE)`: het opende volledig opgeteld. De
   * optelling rijtje na rijtje is het hele mechanisme waar het bord voor
   * bestaat, en die was al gebeurd voordat de leerling keek. Het handvat leek
   * daardoor niets te doen, en alleen "Tel opnieuw op" liet zien waar het ooit
   * voor was.
   *
   * De drie mogelijkheden, en waarom deze het is. Alle drie zijn NAGEREKEND op
   * public/les4-pixelmodel.json, niet afgewogen op gevoel:
   *
   * 1. OPGETELD OPENEN (wat het deed). Tien volle balken, een antwoord, en het
   *    mechanisme onzichtbaar. Dit is het gebrek.
   *
   * 2. OP 0 OPENEN. Op rijtje 0 zijn de tien totalen alleen de constanten, en
   *    de grootste daarvan is in absolute waarde 0,0003 - `metTeken()` schrijft
   *    dat als "0,00". Een leerling ziet dus tien balken van nul lengte, tien
   *    keer 0,00, en geen antwoord. Zonder iemand om het te vragen is dat een
   *    bord dat stuk lijkt.
   *
   * 3. HALFWEG OPENEN. Nog erger, en dat is de verrassing van deze meting: op
   *    rijtje 14 staat bij 94 van de 120 beeldjes een ANDER cijfer bovenaan dan
   *    het antwoord. Bij het openingsbeeldje is dat de 7, terwijl het model 5
   *    kiest. Een bord dat halverwege opent, zet er dus een verkeerd cijfer
   *    bovenaan zonder ook maar te zeggen dat het nog niet klaar is.
   *
   * Daarom: op 0 beginnen en de optelling ÉÉN KEER ZELF AFDRAAIEN. 28 stappen
   * van 90 ms is 2,52 s. De leerling ziet de markeerlijn zakken, de inkt
   * oplichten, de tien balken groeien en het antwoord aan het eind verschijnen,
   * zonder één klik. Daarna staat het bord in de toestand die het vroeger bij
   * aankomst al had, met dit verschil: de optelling is nu gezien en het handvat
   * draait haar terug.
   *
   * DIT HERKADERT HET BORD NIET, en dat is de huisregel die hier had kunnen
   * breken. Twee redenen: elk paneel staat er van het eerste beeld af, en
   * `balkas()` rekent de as één keer per beeldje over alle negen standen EN
   * alle 29 tussenstanden. De as staat dus al op zijn eindwaarde voordat de
   * eerste tik valt.
   *
   * DE NARRATIE IS GEEN GEVRAAGDE BEWEGING, dus ze respecteert
   * `prefers-reduced-motion` en springt dan naar de eindstand. De KNOP doet dat
   * niet: wie zelf op "Tel opnieuw op" duwt, vraagt de beweging, en een knop
   * die dan niets doet is precies de dode knop die dit project al drie keer
   * geleverd heeft.
   * ---------------------------------------------------------------- */
  const startNarratie = useCallback(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true) {
      /* Wie geen beweging wil, krijgt geen beweging, en dan is de VOLLE stand
         de minst slechte. Ik heb hier eerst `setRijtje(0)` van gemaakt, omdat de
         volle stand precies het gebrek is dat Niels aanwees: het optellen is dan
         al gebeurd voor de leerling kijkt. Maar op 0 gemeten staan alle tien de
         totalen op 0,00 - tien balken van niets en geen antwoord - en dat is
         voor deze leerling erger, want de optelling die 0 leesbaar maakt is juist
         de animatie die hij heeft afgezet. Wat de slider hier draagt, draagt hij
         dus in WOORDEN: de regel bij het handvat zegt naar welk rijtje je moet
         slepen en welk cijfer daar bovenaan komt, en "Tel opnieuw op" laat de
         optelling alsnog stap voor stap zien zodra de leerling erom vraagt. */
      stopTellen()
      setRijtje(ZIJDE)
      return
    }
    telOpnieuw()
  }, [stopTellen, telOpnieuw])

  /* Het model binnenhalen, en de narratie starten op het moment dat het binnen
     is. Dit staat hier en niet bovenaan, en het is één effect en geen twee: de
     narratie hoort bij de GEBEURTENIS "het model is er" en niet bij een effect
     dat toestand staat te bekijken. Het model komt met een fetch van 202 kB,
     dus bij het eerste beeld is er nog niets: tot dan staat `rijtje` op 0 en
     tekent het bord het lege kader met "Het model wordt geladen." erin. */
  useEffect(() => {
    let levend = true
    laadPixelModel()
      .then((m) => {
        if (!levend) return
        setModel(m)
        startNarratie()
      })
      .catch((e: unknown) => {
        /* De technische reden gaat naar de console en niet naar het bord. Een
           leerling kan niets met "Unexpected token '<'" - dat is wat een
           ontbrekend bestand hier oplevert, want de host stuurt dan index.html
           terug in plaats van een 404. Op het bord staat wat hij wel kan doen. */
        console.error('les4: het pixelmodel laadt niet', e)
        if (levend) setLaadfout('Herlaad de pagina.')
      })
    return () => {
      levend = false
    }
  }, [startNarratie])

  /** Met de hand aan het handvat draaien zet de klok stil. Anders vechten
   *  twee dingen om hetzelfde getal en springt de balk heen en terug. */
  const zetRijtje = useCallback(
    (r: number) => {
      stopTellen()
      setRijtje(clamp(Math.round(r), 0, ZIJDE))
    },
    [stopTellen],
  )

  /* Een richtingsknop zet de optelling eerst af. Zonder dat kan een leerling
     op "Omhoog" duwen terwijl er nog niets opgeteld is: alle tien de balken
     staan dan op nul, er verandert niets zichtbaar, en dat leest als een bord
     dat stuk is. Bovendien zijn twee standen alleen te vergelijken als ze
     allebei helemaal opgeteld zijn. */
  const schuif = useCallback(
    (ddy: number, ddx: number) => {
      stopTellen()
      setRijtje(ZIJDE)
      /* Functionele updates, geen `dy - 1` uit de omsluitende render. Twee
         klikken in hetzelfde tikje (of React die ze samenvoegt) lazen anders
         allebei dezelfde oude waarde, en dan gaat één van de twee verloren:
         "Omlaag" en daarna "Rechts" leverde alleen "1 pixel naar rechts". */
      if (ddy !== 0) setDy((v) => clamp(v + ddy, -1, 1))
      if (ddx !== 0) setDx((v) => clamp(v + ddx, -1, 1))
      if (ddy === 0 && ddx === 0) {
        setDy(0)
        setDx(0)
      }
    },
    [stopTellen],
  )

  /* Eén modulo voor het beeldje EN voor zijn cijfer, want twee losse modulo's
     op twee lijsten kunnen uit de pas gaan lopen en dan staat er een ring bij
     het cijfer van een ander beeldje. */
  const aantal = model ? model.beelden.length : 0
  const plek = aantal === 0 ? 0 : nr % aantal
  const beeld = model ? model.beelden[plek] : NUL
  const echt = model ? model.echt[plek] : -1
  const geschoven = useMemo(() => verschuif(beeld, dy, dx), [beeld, dy, dx])

  /** Het cijfer waarvan de getallen op de inkt liggen. */
  const cijfer = gekozenCijfer ?? Math.max(0, echt)

  /* De hele optelling in één keer, onderbroken na elk rijtje. Daaruit komt
     zowel de tussenstand van nu als het volle totaal. */
  const perRijtje = useMemo(
    () => (model ? totalenPerRijtje(model, geschoven) : new Float64Array((ZIJDE + 1) * 10)),
    [model, geschoven],
  )
  const nuTotalen = useMemo(
    () => perRijtje.slice(rijtje * 10, rijtje * 10 + 10),
    [perRijtje, rijtje],
  )
  const volTotalen = useMemo(
    () => perRijtje.slice(ZIJDE * 10, ZIJDE * 10 + 10),
    [perRijtje],
  )
  const gekozen = model ? keuze(volTotalen) : -1

  /* De halve balkas. Eén keer per beeldje over alle negen standen en alle 29
     tussenstanden, en daarna vast - zie balkas() in lib/mnist.ts. */
  const as = useMemo(() => (model ? balkas(model, beeld) : 20), [model, beeld])

  /** Wat elke pixel bijdraagt aan het gekozen cijfer. */
  const bij = useMemo(
    () => (model ? bijdragen(model, geschoven, cijfer) : new Float64Array(AANTAL_PIXELS)),
    [model, geschoven, cijfer],
  )

  /* De teller. `midden` is de keuze zonder verschuiving en verandert dus nooit;
     hij wordt één keer per model gerekend. `nu` verandert alleen als de stand
     verandert, niet als de leerling een ander beeldje kiest. */
  const midden = useMemo(() => (model ? keuzes(model, 0, 0) : new Int8Array(0)), [model])
  const nu = useMemo(() => (model ? keuzes(model, dy, dx) : new Int8Array(0)), [model, dy, dx])
  const teller = useMemo(() => (model ? tel(model, nu, midden) : null), [model, nu, midden])

  const stand = standInWoorden(dy, dx)
  const klaar = rijtje >= ZIJDE
  const tegaan = ZIJDE - rijtje

  /* Wat dit rijtje bijbracht bij het gekozen cijfer. Tijdens de optelling is
     dit het interessantste getal van het bord, en het noemt geen winnaar. */
  const bijdrageRijtje =
    rijtje > 0 ? perRijtje[rijtje * 10 + cijfer] - perRijtje[(rijtje - 1) * 10 + cijfer] : 0

  /* Het laatste rijtje waarop een ander cijfer bovenaan stond dan het antwoord.
     Zie laatsteAndereKoploper() in lib/mnist.ts: dat bestaat in het midden bij
     120 van de 120 beeldjes en over alle negen standen bij 1078 van 1080. */
  const koploper = useMemo(
    () => (model ? laatsteAndereKoploper(perRijtje) : null),
    [model, perRijtje],
  )

  /* ---------------------------------------------------------------- *
   * WAT HET HANDVAT ERVOOR DIENT, in één regel onder het handvat zelf.
   *
   * Dit is de regel die er niet was. Het kopje zei "Opgeteld - 28 van de 28
   * rijtjes": dat noemt de TOESTAND van het handvat en nooit zijn NUT, en met
   * de optelling al gebeurd bij aankomst was er ook niets meer aan te zien.
   *
   * De reden om terug te slepen is niet "dan zie je de optelling opnieuw" maar
   * iets scherpers, en het staat er met de getallen van DIT beeldje in DEZE
   * stand erin: op een rijtje verderop stond een ander cijfer bovenaan dan het
   * antwoord. Bij het openingsbeeldje is dat rijtje 21 van de 28, met cijfer 7,
   * terwijl het model 5 kiest. Sleep de leerling daarheen en de optelling
   * bewijst zichzelf: het antwoord staat er nog niet, ook niet op driekwart.
   *
   * Eén regel, en dat is een maat. Het paneel is bij 1024x768 en 900x700 222 px
   * breed binnen zijn rand, en er was maar plaats voor één regel: het streepje
   * dat hier ooit stond is ervoor weggehaald (21 px) en deze regel kost er
   * ongeveer 22. Twee regels zouden de eerlijkheidszin onderaan bij 900x700
   * onder de rand duwen. Houd elke variant dus onder ongeveer 40 tekens en meet
   * na - er staat een controle op in de browser, geen schatting per teken.
   *
   * Tijdens het optellen staat hier het getal van het rijtje dat net binnenkwam
   * en NOOIT een winnaar: halverwege leidt bij 118 van de 120 beeldjes een
   * ander cijfer dan het uiteindelijke antwoord.
   *
   * DE REGEL WISTE ZICHZELF UIT ZODRA JE HAAR OPVOLGDE, en dat is het gebrek
   * dat hier gerepareerd is. In rust stond er "Sleep naar rijtje 21: cijfer 7
   * op kop." Sleepte de leerling daarheen, dan werd het "Rijtje 21 bracht +1,14
   * bij." - de bewering die hij ging controleren, was weg op het moment dat hij
   * aankwam om ze te controleren. Dan is de reis niets waard.
   *
   * De reparatie kost GEEN vijfde bijschrift op het bord: dezelfde ene regel in
   * hetzelfde paneel krijgt één toestand erbij. Staat er op het rijtje waar de
   * leerling nu staat een ander cijfer bovenaan dan het uiteindelijke antwoord,
   * dan zegt de regel dat, met beide cijfers erin. Staat het antwoord er al
   * bovenaan, dan is er niets bijzonders te melden en staat er weer het getal
   * van het rijtje dat net binnenkwam.
   *
   * Dat spreekt de regel hierboven niet tegen. "Op kop" is niet het antwoord van
   * het model maar de stand van nu, en die is op het bord af te lezen: de
   * langste balk. Het bord noemt op dat moment nog altijd geen winnaar - de
   * antwoordregel zegt "nog 7 rijtjes te gaan" en niets meer.
   *
   * MAAR ER STOND ", NIET 5." ACHTER, en dat moest eraf. Die 5 was `gekozen`,
   * het uiteindelijke antwoord van het model, en dat is precies de winnaar die
   * deze regel hierboven belooft niet te noemen. Bij het openingsbeeldje viel
   * het niet op, want daar kiest het model 5 en staat "het echte cijfer: 5" al
   * op het bord. Gemeten in de stand "1 pixel omhoog en naar links", waar het
   * model 3 kiest terwijl het echte cijfer 5 is: op rijtje 14 van de 28 zei
   * deze regel "Rijtje 14: cijfer 7 op kop, niet 3." terwijl het bord alleen
   * "nog 14 rijtjes te gaan" en "het echte cijfer: 5" toonde. Die 3 stond
   * nergens anders op het scherm. Halverwege de optelling wist de leerling dus
   * al waar ze uitkomt - en juist de verschoven standen zijn de standen waar
   * dit bord om draait.
   *
   * Zonder die staart doet de regel zijn werk nog: in rust belooft ze rijtje
   * 21 met cijfer 7 op kop, en op rijtje 21 staat er "Rijtje 21: cijfer 7 op
   * kop." Dat is dezelfde bewering, woord voor woord, op de plaats waar je ze
   * kunt controleren. Het antwoord komt bij het laatste rijtje, waar het hoort.
   *
   * De maat blijft één regel, en ze werd korter: de langste variant hier is nu
   * "Rijtje 21: cijfer 7 op kop." op 27 tekens, tegen de 38 van de rustregel
   * die al paste in de 222 px van dit paneel.
   * ---------------------------------------------------------------- */
  /** Welk cijfer op dit rijtje bovenaan staat. Op rijtje 0 staan alle tien de
   *  balken op nul, dus daar is een koploper afrondingsruis - zie
   *  `laatsteAndereKoploper()` in lib/mnist.ts, die om dezelfde reden bij 1
   *  begint. */
  const kopNu = model && rijtje > 0 ? keuze(nuTotalen) : null
  const handvatRegel = !klaar
    ? rijtje === 0
      ? 'Nog niets opgeteld.'
      : kopNu !== null && kopNu !== gekozen
        ? `Rijtje ${getal(rijtje)}: cijfer ${kopNu} op kop.`
        : `Rijtje ${getal(rijtje)} bracht ${metTeken(bijdrageRijtje)} bij.`
    : koploper
      ? `Sleep naar rijtje ${getal(koploper.rijtje)}: cijfer ${koploper.cijfer} op kop.`
      : `Sleep terug: cijfer ${gekozen} bleef op kop.`

  /* ---------------------------------------------------------------- *
   * WAT DE TELLER TELT, in de regel onder de teller.
   *
   * Hier stond "Ander antwoord: 0." onder "111 van de 120 beeldjes", en dat is
   * twee gebreken in vier woorden. Ander antwoord DAN WAT stond er nergens. En
   * in de openingstoestand is er niets verschoven, dus was het getal 0: een
   * teller die bij aankomst op nul staat en niet zegt waarvan, leest als een
   * teller die niet werkt.
   *
   * Nu heeft de regel twee toestanden en in geen van beide staat een nul. Is er
   * niets verschoven, dan staat er wat je moet doen om de teller te laten
   * bewegen. Is er wel verschoven, dan staat er waar het getal een verschil met
   * IS, met zoveel woorden. Gemeten op het bestand: over de acht verschuivingen
   * is de kleinste waarde 14 en de grootste 36, dus de tweede toestand kan
   * nooit nul zijn.
   * ---------------------------------------------------------------- */
  const tellerRegel = !teller
    ? undefined
    : dy === 0 && dx === 0
      ? 'Verschuif en kijk wat er verandert.'
      : `Ander cijfer dan in het midden: ${getal(teller.anders)}.`

  return (
    <div className="relative h-full w-full">
      {/*
        Geen astekst: het vlak is hier een beeldje van 28 bij 28 pixels met
        balken eronder, geen grafiek. Getallen langs de randen zouden zeggen
        dat de plaats op het bord een waarde heeft, en dat is hier niet zo.
      */}
      <Canvas defaultView={VENSTER} axes={false}>
        {(s) =>
          model && teller ? (
            <Bord
              s={s}
              beeld={geschoven}
              midden={beeld}
              verschoven={dy !== 0 || dx !== 0}
              bij={bij}
              totalen={nuTotalen}
              as={as}
              cijfer={cijfer}
              zelfGekozen={gekozenCijfer !== null}
              gekozen={gekozen}
              echt={echt}
              rijtje={rijtje}
              klaar={klaar}
              tegaan={tegaan}
              hoogste={volTotalen[gekozen]}
              aangewezen={aangewezen}
              opAangewezen={setAangewezen}
              opCijfer={setGekozenCijfer}
            />
          ) : (
            /* Een paneel dat nog niets te tonen heeft, tekent het lege kader en
               zegt dat. Het kader staat er dus van de eerste tel. */
            <Leeg
              s={s}
              melding={laadfout ? `Het model laadt niet. ${laadfout}` : 'Het model wordt geladen.'}
            />
          )
        }
      </Canvas>

      {/*
        De eerste alinea is het DOEL. Brief toont die altijd en klapt alleen
        alles daarna in, dus op een beamer is dit de enige zin die een leerling
        zeker leest. Wie hier vanaf een slide binnenvalt, ziet de portaalkaart
        nooit: staat het doel niet op het bord, dan staat het nergens.
      */}
      <Brief eyebrow="mAIstros 2 - les 4" title="Wat telt elke pixel mee?">
        {/* Twee zinnen, één idee per zin, en "het model" voluit. Dit is de
            uitleg van het algoritme zelf en niet van zijn gedrag: de eerste
            zin zegt wat het model heeft, de tweede wat het ermee doet. */}
        <p>
          Het model gaf elke pixel een getal, voor elk cijfer apart. Die getallen telt het op.
        </p>
        {/* Drie alinea's en niet vier, en elke alinea zo kort dat ze op de
            brede panelen op één of twee regels blijft. Dat is GEMETEN: bij
            1280x720, 1280x800 en 1366x768 staat de onderkant van dit paneel
            op 240 px, en een vierde alinea duwde de Brief 59,4 px over het
            bedieningspaneel heen. Met een tweede regel in deze alinea was dat
            nog 5,9 px. Nu blijft er 16 px tussen. Voeg hier geen regel bij
            zonder die drie formaten opnieuw te meten. */}
        {/* Deze alinea is het VERHAAL, in de volgorde waarin het bord het
            aflevert: het bord telt eerst zelf op, en daarna is het handvat er
            om die optelling terug te draaien. "Tel de rijtjes op en verschuif
            het beeldje" stond hier eerst, en dat was een opdracht voor een bord
            dat de leerling al opgeteld aantrof - de eerste helft was dus al
            gebeurd voor hij ze las. Het aantal rijtjes komt uit `ZIJDE` en niet
            uit deze zin.

            Eén regel, want de meting hierboven laat maar 5,9 px marge bij een
            tweede. Dat het handvat de optelling terugdraait, staat daarom niet
            hier maar onder het handvat zelf - en dat is ook de plek waar het
            hoort, want bij 1024x768 klapt de Brief alles na de eerste alinea
            in en blijft het paneel wel staan. */}
        <p>Het bord telt de {getal(ZIJDE)} rijtjes één voor één op.</p>
        {/* Het aantal komt uit het exportbestand, niet uit deze zin. Zolang
            het model laadt staat er "alle", want dan is er nog niets geteld. */}
        <p>
          De teller doet hetzelfde met {aantal > 0 ? getal(aantal) : 'alle'} beeldjes uit de test
          set.
        </p>
      </Brief>

      {/*
        LINKSONDER: de bediening, en onder de bediening de teller die de afloop
        meet. Dit paneel staat er van bij het begin en verandert nooit van
        breedte. Canvas meet elk paneel naast het bord en reserveert die
        breedte, dus een paneel dat pas na een klik verschijnt zou het hele
        bord opnieuw kaderen terwijl de leerling ernaar kijkt.

        DE LEESRICHTING WAS OMGEKEERD, en dat is nu de belangrijkste wijziging
        in dit paneel. Bovenaan stond de teller over 120 beeldjes - de AFLOOP -
        en daaronder de optelling die dit bord uitlegt. Een leerling die van
        boven naar onder leest, kwam dus eerst de conclusie tegen en daarna de
        uitleg, terwijl de kop van dit bestand zelf zegt dat de gemeten
        brosheid de afloop is en niet het bord. De orde is nu het verhaal:

          1  de optelling   het handvat, de knop, en waar je naartoe sleept
          2  de stand       de vier richtingen en terug naar het midden
          3  de teller      wat die stand met 120 beeldjes doet
          4  het onderwerp  een ander beeldje

        De teller staat daarmee ONDER de knoppen die hem laten bewegen, en zijn
        eigen regel zegt in de openingstoestand wat je moet doen om dat te
        zien. Hij blijft in het vaste deel van het paneel, dus hij valt op geen
        enkel formaat onder de vouw.

        De hoogte is begrensd zoals op de andere borden, zodat de Brief
        bovenaan altijd vrij blijft. Alleen de uitleg onderin scrollt: de kop,
        de teller en de knoppen staan vast, want een knop onder de vouw leest
        als een knop die er niet is.

        DE LADDERMAAT VAN DIT PANEEL, en waarom ze zo is. Alle knoppen zaten
        ooit in één `flex-wrap`, en dan volgt het aantal regels de breedte van
        de opschriften: bij 302 px inhoud werd dat 3+2+1 en bij 222 px 2+2+1+1,
        dus het paneel had twee verschillende vormen en op de brede stond een
        rafelrand. Het echte gebrek zat er nog onder: "Ander beeldje" - een
        knop die van ONDERWERP wisselt - had computed margin-top 0 px en stond
        dus dichter tegen de vier richtingen aan dan die vier onderling (6 px),
        terwijl de blokken eromheen wel lucht hadden.

        De maat is nu: 6 px BINNEN een set en 14 px TUSSEN twee sets. Er staat
        GEEN streepje meer in dit paneel. Het stond tussen de teller en de
        eerste set, en met de teller onderaan is het daar niet meer nodig - de
        ladder scheidt de vier blokken al. Die 21 px zijn precies wat de regel
        onder het handvat kost, dus het nut van het handvat staat er nu voor
        ongeveer nul px extra hoogte. Bij 900x700 staat dit paneel op zijn cap,
        dus elke px die je hier bijzet, komt recht uit de uitleg onderaan.

        Alle vier de richtingen staan in een `grid-cols-2` met `full`, dus het
        paneel heeft op ELK formaat dezelfde vorm: vier regels, knoppen van
        108 px bij smal en 148 px bij breed, en nergens een afgekapt opschrift.

        NAGEMETEN in de browser, op de zes formaten waarop dit bord getoetst
        wordt. "vrij" is de hoogte die er na het vaste deel overblijft voor de
        uitleg onderaan, "gat" is de afstand tussen de onderkant van de Brief
        en de bovenkant van dit paneel, en "eerlijk" is hoeveel px van de
        eerlijkheidszin onderaan zichtbaar is - haar eerste regel is 18,6 px:

                     cap   vast   vrij   gat   knop   eerlijk
          1440x900   577  410,3  132,7    84    148      37,1
          1366x768   512  410,3   67,7    17    148      37,1
          1280x800   544  410,3   99,7    17    148      37,1
          1280x720   464  410,3   19,7    17    148      19,7
          1024x768   560  410,3  115,7     7    108      37,1
           900x700   492  410,3   47,7     7    108      37,1

        Het vaste deel is nu op ELK formaat 410,3 px, waar het vroeger 397 bij
        breed en 422 bij smal was: het opschrift naast "Ander beeldje" sloeg bij
        222 px om naar een tweede regel en doet dat niet meer. Op geen enkel
        formaat valt een knop onder de vouw, staat er een opschrift afgekapt
        (scrollWidth - clientWidth is overal 0), ligt er bordtekst onder een
        paneel of valt de eerste regel van de eerlijkheidszin weg. 1280x720 is
        de krapste: daar is de vrije hoogte exact één regel, en dat is de reden
        dat die zin `leading-snug` heeft en buiten het kadertje staat.
      */}
      <Panel className="pointer-events-auto absolute bottom-4 left-4 z-10 flex max-h-[calc(100%-13rem)] w-[16rem] flex-col px-4 py-3.5 xl:max-h-[calc(100%-16rem)] xl:w-[21rem]">
        <div className="shrink-0">
          {/* SET 1: de optelling. Het handvat en de knop doen hetzelfde ding,
              en staan daarom bij elkaar. Dit is nu het EERSTE blok van het
              paneel: het is het mechanisme dat dit bord uitlegt.

              Kopje en waarde staan op ÉÉN regel, en dat is een meting en geen
              smaak: met de waarde onder het kopje was het vaste deel van dit
              paneel 466 px, tegen een cap van 508 bij 900x700, en dan bleef er
              1,7 px over voor de uitleg onderaan - de eerlijkheidszin over de
              120 beeldjes was op de beamervloer dus volledig onzichtbaar. Twee
              kopjes op één regel brengen dat op 47 px, precies genoeg voor de
              eerste twee regels van die zin.

              "Optelling" en niet "Opgeteld": een kopje is op deze borden een
              kort zelfstandig naamwoord, en een voltooid deelwoord zei
              bovendien dat het al gebeurd was - wat bij aankomst ook zo was, en
              dat was het gebrek. */}
          <Groep label="Optelling">
            {`${getal(rijtje)} van de ${getal(ZIJDE)} rijtjes`}
          </Groep>
          {/* Het handvat. De opmaak staat al in index.css: spoor van 4 px, duim
              van 16 px met een rand in de kleur van het model. Terugslepen mag,
              want de optelling is in beide richtingen te lezen. */}
          <input
            type="range"
            min={0}
            max={ZIJDE}
            step={1}
            value={rijtje}
            disabled={!model}
            onChange={(e) => zetRijtje(Number(e.target.value))}
            aria-label="Hoeveel rijtjes opgeteld"
            className="mt-1 w-full"
          />
          <div className="mt-1.5">
            <Btn full disabled={!model} onClick={telOpnieuw}>
              Tel opnieuw op
            </Btn>
          </div>
          {/* WAAR HET HANDVAT VOOR DIENT. Zie het blok bij `handvatRegel`: één
              regel, met de getallen van dit beeldje in deze stand, die zegt
              waar je naartoe sleept en wat daar staat. Zonder deze regel noemt
              het paneel alleen de toestand van het handvat en nooit zijn nut,
              en dat was de vraag die dit bord kreeg.

              13 px en niet 12,5, want dit is dezelfde soort regel als de regel
              onder de teller en die staat op 13. Nagemeten met de letter van
              het bord zelf: de langste variant hier is "Sleep naar rijtje 21:
              cijfer 7 op kop." op 202 px, tegen 222 px inhoud bij 1024x768 en
              900x700. Eén regel dus, met 20 px over.

              `min-h` van één regel, zodat de knoppen eronder niet opschuiven
              als de tekst van vorm wisselt. Twee regels mag deze niet worden:
              bij 900x700 en 1280x720 gaat dat recht uit de eerlijkheidszin
              onderaan. */}
          <p className="mt-1 min-h-[1.15rem] text-[13px] leading-snug text-ink/80">
            {model ? handvatRegel : ''}
          </p>

          {/* SET 2: de stand. "Stand" en niet "Verschoven": in de begintoestand
              las dat als "Verschoven: in het midden", en dat spreekt zichzelf
              tegen. Alle andere kopjes op de borden zijn korte zelfstandige
              naamwoorden, een voltooid deelwoord niet. */}
          <div className="mt-3.5">
            <Groep label="Stand">{stand}</Groep>
          </div>

          {/* Vier richtingen, één set, één vorm op elk formaat. Elke knop die
              niets meer kan doen, staat uit: een knop die je kan indrukken en
              waar niets van verandert, leest als een bord dat stuk is. Verder
              dan één pixel per as gaat het niet - zie de kop van dit bestand. */}
          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
            <Btn variant="ghost" full disabled={!model || dy === -1} onClick={() => schuif(-1, 0)}>
              Omhoog
            </Btn>
            <Btn variant="ghost" full disabled={!model || dy === 1} onClick={() => schuif(1, 0)}>
              Omlaag
            </Btn>
            <Btn variant="ghost" full disabled={!model || dx === -1} onClick={() => schuif(0, -1)}>
              Links
            </Btn>
            <Btn variant="ghost" full disabled={!model || dx === 1} onClick={() => schuif(0, 1)}>
              Rechts
            </Btn>
          </div>
          {/* Terugzetten is geen vijfde richting, dus het staat op zijn eigen
              regel. En het is een ghost: de enige lime knop op dit bord is
              "Tel opnieuw op", want twee lime knoppen vechten om dezelfde blik. */}
          <div className="mt-1.5">
            <Btn
              variant="ghost"
              full
              disabled={!model || (dy === 0 && dx === 0)}
              onClick={() => schuif(0, 0)}
            >
              Terug naar het midden
            </Btn>
          </div>

          {/* SET 3: DE TELLER, de afloop van set 2. Ze staat hier en niet meer
              bovenaan het paneel, want ze meet wat de vier knoppen erboven
              doen: eerst het mechanisme, dan de stand, dan wat die stand met
              120 beeldjes doet.

              Het label zegt nu waarover het getal gaat. "Juist" alleen liet
              open bij welke stand die 111 hoorde, en dat is de helft van de
              vraag die dit paneel kreeg; de andere helft was de regel eronder,
              die "Ander antwoord: 0." zei zonder te zeggen ander dan wat.

              Vaste hoogte van één detailregel, zodat "Ander beeldje" eronder
              niet opschuift als de regel van vorm wisselt. Beide varianten van
              `tellerRegel` zijn daarvoor onder de 40 tekens gehouden.

              12 px erboven en niet de 14 van de ladder: de teller is de afloop
              van de vier knoppen erboven en geen nieuwe set. Die 2 px plus de 2
              onder het handvat zijn wat de eerlijkheidszin bij 1280x720 nodig
              heeft om helemaal te passen. */}
          <div className="mt-3 min-h-[4.4rem]">
            <Vaststelling
              label="Juist bij deze stand"
              value={teller ? teller.juist : null}
              outOf={teller ? { total: teller.totaal, noun: 'beeldjes' } : undefined}
              detail={tellerRegel}
              empty="Het model wordt geladen."
              color={NAVY}
            />
          </div>

          {/* SET 4: het onderwerp. Een ander beeldje is geen andere stand, dus
              het staat 14 px lager, in zijn eigen groep met de teller ernaast.

              De verschuiving blijft staan als je een ander beeldje neemt: dat
              is één stand voor het hele bord, en ze staat in woorden boven de
              knoppen. Ze stil terugzetten zou de klik van de leerling ongedaan
              maken zonder dat hij het ziet. Het gekozen cijfer gaat WEL terug
              naar het echte cijfer van het nieuwe beeldje: het cijfer van het
              vorige beeldje zou hier een toestand zijn die nergens meer bij
              hoort. En de balkas wordt hier opnieuw gerekend - dit is het
              enige moment waarop dat eerlijk is.

              En het nieuwe beeldje wordt OPNIEUW OPGETELD, met `startNarratie`
              in plaats van `setRijtje(ZIJDE)`. Een ander beeldje is een ander
              onderwerp, dus het krijgt dezelfde opening als het eerste: de
              leerling ziet de optelling gebeuren in plaats van er een afgelopen
              versie van te krijgen. Dat is ook de enige manier waarop deze knop
              op elk formaat zichtbaar iets doet - een beeldje dat vol opgeteld
              verschijnt, verschilt van het vorige alleen in de vorm van de
              inkt. */}
          <div className="mt-3.5 flex flex-wrap items-baseline gap-x-2 gap-y-1.5">
            <Btn
              variant="ghost"
              disabled={!model}
              onClick={() => {
                setNr(nr + 1)
                setGekozenCijfer(null)
                setAangewezen(null)
                startNarratie()
              }}
            >
              Ander beeldje
            </Btn>
            {/* Waar de leerling in de rij zit. Zonder dit is "Ander beeldje"
                een knop zonder bodem: de teller gaat over een set die je niet
                kan overzien. Met het nummer erbij is het dezelfde set die je
                zelf kan doorlopen. Beide getallen komen uit de toestand.

                ER STOND "beeldje 1 van de 120", EN DAT KOSTTE 25 px. Bij 222 px
                inhoud is de knop 132 px en het opschrift 110 px, samen met de
                tussenruimte 250 px, dus dit blok sloeg om naar twee regels: 62,3
                px voor één knop en één getal. Zonder het woord "beeldje" is het
                66 px en past het naast de knop, en dan is dit blok 36,8 px. Die
                25 px zijn precies wat de eerlijkheidszin onderaan bij 900x700
                nodig heeft. Het woord ontbreekt ook niet echt: het staat op de
                knop waar dit getal tegenaan staat. */}
            {aantal > 0 && (
              <span className="text-[13px] tabular-nums text-ink/80">
                {getal(plek + 1)} van de {getal(aantal)}
              </span>
            )}
          </div>
        </div>

        {/* `mt-1` en niet `mt-2`: bij 900x700 en 1280x720 komt elke px hier
            recht uit de eerste regel van de uitleg eronder. */}
        <div className="mt-1 min-h-0 overflow-y-auto">
          {/* DE EERLIJKHEIDSZIN, EN WAAROM ZE UIT HET KADERTJE GEHAALD IS.
              Ze draagt de eerlijkheid van dit bord: het openingsbeeldje is met
              opzet gekozen en ongeveer 4% van de beeldjes kantelt per richting,
              dus het bord mag niet suggereren dat elk beeldje zo reageert.

              Ze stond in de `Note` eronder, en die heeft `py-2`: 8 px die vóór
              de eerste regel komen. Bij 1280x720 blijft er 22 px van dit
              scrollgebied over, dus in het kadertje was van een regel van 21,9
              px maar 14 px te zien. Als plattekst begint ze op 0 px en past ze
              er helemaal in. Het kadertje houdt de tweede uitleg, die wel mag
              wegscrollen.

              De eerste vier woorden vormen een afgeronde bewering, en dat is
              nodig: "Niet elk beeldje verandert van" brak middenin een zinsdeel
              af en las als een stuk bord dat kapot is; "Niet elk beeldje
              kantelt" staat er heel. `kantelt` is in dit project al het woord
              voor een beeldje dat van antwoord verandert. */}
          {/* `leading-snug` en niet `leading-relaxed`, wat het in het kadertje
              was: 18,6 px per regel in plaats van 21,9. Bij 1280x720 blijft er
              19,7 px van dit scrollgebied over, dus dat verschil is precies het
              verschil tussen een hele eerste regel en een afgekapte. Het is ook
              de regelafstand van elke andere korte regel in dit paneel. */}
          <p className="text-[13.5px] leading-snug text-ink/85">
            Niet elk beeldje kantelt bij één pixel. De teller zegt bij hoeveel wel.
          </p>

          <div className="mt-2">
            <Note>
              <p>Een pixel zonder inkt telt niet mee, welk getal er ook op staat.</p>
            </Note>
          </div>

          <div className="mt-2 text-[11.5px] leading-relaxed text-muted">
            In je notebook: <PyChip>lrmodel.predict(x_test)</PyChip>
          </div>
        </div>
      </Panel>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * De meetkunde van de stapel. Beeldje boven, balken onder, samen
 * gecentreerd in het vlak dat de panelen vrij laten.
 * ------------------------------------------------------------------ */

type Maten = {
  /** De zijde van één pixel van het beeldje, in schermpixels. */
  k: number
  /** De breedte van de stapel: het beeldje EN de balken zijn even breed. */
  breed: number
  /** Hoogte van één balkregel. */
  regel: number
  /** Lettergrootte van de twee antwoordregels. */
  maat: number
  links: number
  boven: number
  hoogte: number
}

function meet(s: Scales): Maten {
  /* Eén schaal voor x en y, zodat een pixel van het beeldje vierkant is.
     Canvas rekt beide assen los van elkaar tot het vrije vlak, dus zonder die
     gelijke schaal wordt een vierkant beeldje een liggende strook. */
  const k = Math.min(1 / s.unitPerPx.x, 1 / s.unitPerPx.y)
  const breed = ZIJDE * k
  /* Ondergrens 17,5 px, want daaronder past de 13 px tekst in een balkregel
     niet meer, en 13 px is de bodem voor tekst die je van achter in de klas
     moet lezen. Bovengrens 26 px: groter voegt niets toe en duwt de
     antwoordregels naar beneden. */
  const regel = clamp(k, 17.5, 26)
  const maat = clamp(breed / 24, 13, 15.5)
  const hoogte = breed + NA_BEELD + KOP + 10 * regel + NA_BALKEN + 2 * (maat * 1.5)
  return {
    k,
    breed,
    regel,
    maat,
    links: s.sx(15) - breed / 2,
    boven: s.sy(24) - hoogte / 2,
    hoogte,
  }
}

/**
 * De breedte van een bijschrift, om te zien of twee labels op één regel
 * elkaar raken.
 *
 * Dit wordt ECHT gemeten, met dezelfde letter en hetzelfde gewicht als op het
 * bord, en niet geschat uit het aantal tekens. Een schatting van 0,58 keer de
 * lettergrootte per teken zat er 37% naast - de bijschriften van dit bord
 * meten 236,3 px voor 43 tekens, dus 5,5 px per teken - en daardoor viel het
 * opschrift bij de stippellijn altijd weg, ook waar er ruim plaats voor was.
 * Op het verschil tussen wég en er staan mag geen schatting zitten.
 *
 * Zolang het weblettertype nog niet binnen is, meet dit de terugvalletter.
 * Dat scheelt één beeld en nooit een verkeerde beslissing die blijft staan:
 * bij de volgende tekening staat het goed.
 */
const meter = (() => {
  let ctx: CanvasRenderingContext2D | null = null
  return (t: string, px: number, gewicht: number) => {
    if (ctx === null) ctx = document.createElement('canvas').getContext('2d')
    if (!ctx) return t.length * px * 0.44
    ctx.font = `${gewicht} ${px}px 'Hanken Grotesk', ui-sans-serif, system-ui, sans-serif`
    return ctx.measureText(t).width
  }
})()

function tekstbreed(t: string, px: number): number {
  return meter(t, px, 600)
}

/** Het kader van 28 bij 28 met de rasterlijnen. De pixels komen erbovenop. */
function Kader({ m }: { m: Maten }) {
  const lijnen: number[] = []
  for (let i = 1; i < ZIJDE; i++) lijnen.push(i)
  return (
    <>
      <rect x={m.links} y={m.boven} width={m.breed} height={m.breed} fill="#fff" />
      {/* De rasterlijnen maken zichtbaar dat het beeldje uit pixels bestaat.
          Zonder die lijnen is "één pixel opschuiven" een sprong van niets. */}
      {lijnen.map((i) => (
        <line
          key={`v${i}`}
          x1={m.links + i * m.k}
          y1={m.boven}
          x2={m.links + i * m.k}
          y2={m.boven + m.breed}
          stroke={RULE}
        />
      ))}
      {lijnen.map((i) => (
        <line
          key={`h${i}`}
          x1={m.links}
          y1={m.boven + i * m.k}
          x2={m.links + m.breed}
          y2={m.boven + i * m.k}
          stroke={RULE}
        />
      ))}
      <rect
        x={m.links}
        y={m.boven}
        width={m.breed}
        height={m.breed}
        fill="none"
        stroke={MUTED}
        strokeWidth={1.5}
      />
    </>
  )
}

/** Een bijschrift van 13 px met een witte rand eromheen, zodat het over een
 *  rasterlijn of een balk heen leesbaar blijft. */
function Bijschrift({
  x,
  y,
  children,
  anker = 'start',
}: {
  x: number
  y: number
  children: string
  anker?: 'start' | 'end'
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anker}
      fontSize={13}
      fontWeight={600}
      fill={MUTED}
      stroke="#fff"
      strokeWidth={3.5}
      paintOrder="stroke"
    >
      {children}
    </text>
  )
}

function Leeg({ s, melding }: { s: Scales; melding: string }) {
  const m = meet(s)
  return (
    <>
      <Kader m={m} />
      <text
        x={m.links}
        y={m.boven + m.breed + NA_BEELD + 14}
        fontSize={m.maat}
        fontWeight={700}
        fill={INK}
        stroke="#fff"
        strokeWidth={3.5}
        paintOrder="stroke"
      >
        {melding}
      </text>
    </>
  )
}

/** Het kleinste rechthoekje dat alle pixels met inkt bevat. */
function omtrek(beeld: Uint8Array) {
  let r0 = ZIJDE
  let r1 = -1
  let k0 = ZIJDE
  let k1 = -1
  for (let i = 0; i < AANTAL_PIXELS; i++) {
    if (beeld[i] === 0) continue
    const r = Math.floor(i / ZIJDE)
    const k = i % ZIJDE
    if (r < r0) r0 = r
    if (r > r1) r1 = r
    if (k < k0) k0 = k
    if (k > k1) k1 = k
  }
  return { r0, r1, k0, k1 }
}

function Bord({
  s,
  beeld,
  midden,
  verschoven,
  bij,
  totalen,
  as,
  cijfer,
  zelfGekozen,
  gekozen,
  echt,
  rijtje,
  klaar,
  tegaan,
  hoogste,
  aangewezen,
  opAangewezen,
  opCijfer,
}: {
  s: Scales
  beeld: Uint8Array
  /** Hetzelfde beeldje zonder verschuiving. Alleen voor de stippellijn. */
  midden: Uint8Array
  verschoven: boolean
  /** Wat elke pixel bijdraagt aan `cijfer`. */
  bij: Float64Array
  /** De tien totalen bij de huidige tussenstand. */
  totalen: Float64Array
  /** De halve balkas, vast per beeldje. */
  as: number
  cijfer: number
  zelfGekozen: boolean
  gekozen: number
  echt: number
  rijtje: number
  klaar: boolean
  tegaan: number
  /** Het hoogste volle totaal. Alleen voor de stippellijn bij de balken. */
  hoogste: number
  aangewezen: number | null
  opAangewezen: (i: number | null) => void
  opCijfer: (c: number) => void
}) {
  const m = meet(s)
  const juist = gekozen === echt

  /* Alleen de pixels met inkt worden getekend. De rest is de witte
     achtergrond van MNIST, en 630 lege rechthoeken tekenen kost alleen tijd.
     Een pixel zonder inkt heeft ook niets te kleuren: hij draagt 0 bij, wat
     er ook aan gewicht op die plek staat. */
  const inkt: number[] = []
  for (let i = 0; i < AANTAL_PIXELS; i++) if (beeld[i] > 0) inkt.push(i)

  /* De stippellijn op het beeldje: waar het staat als je het niet verschuift.
     Eén pixel opschuiven is 1/28 van het kader, en dat ziet een leerling die
     naar twee beeldjes na elkaar kijkt niet. Tegen deze lijn is het wel te
     meten. Ze staat er alleen als er iets te vergelijken is. */
  const o = omtrek(midden)

  const balkenBoven = m.boven + m.breed + NA_BEELD + KOP
  const balkenOnder = balkenBoven + 10 * m.regel
  const antwoordBoven = balkenOnder + NA_BALKEN + m.maat
  /* De vaste stroken in een balkregel, van links naar rechts: twee merken, het
     cijfer, de balk, het totaal. In pixels en niet in eenheden, want het is
     tekst en die krimpt niet mee. 58 px rechts, want een totaal is nu
     ondertekend en zes tekens lang ("-10,37"). */
  const merkA = m.links + 9
  const merkB = m.links + 26
  const cijferX = m.links + 46
  const balkX = m.links + 54
  const balkBreed = Math.max(40, m.breed - 54 - 58)
  /* De nullijn staat in het midden van de balkstrook: een totaal met een
     minteken loopt naar links, een totaal met een plusteken naar rechts. */
  const nulX = balkX + balkBreed / 2
  const halve = balkBreed / 2

  /* De stippellijn bij het hoogste totaal. Die staat er om een valse
     aanwijzing te doden: op het openingsbeeldje tekent cijfer 1 op -10,37 een
     LANGERE balk dan de winnende 5 op +6,80, dus "de langste balk wint" is
     niet waar. Wat wel waar is, is "het hoogste totaal wint", en deze lijn
     maakt dat letterlijk zichtbaar. Tijdens de optelling staat ze er niet:
     dan zou ze de leider aanwijzen, en halverwege leidt bij 118 van de 120
     beeldjes een ander cijfer dan het uiteindelijke antwoord. */
  const hoogsteX = nulX + clamp(hoogste / as, -1, 1) * halve

  /* Het opschrift bij die lijn staat op dezelfde regel als de kop boven de
     balken, naast het driehoekje, en wijkt naar de kant waar plaats is:
     rechts van de lijn als het daar voor de getallenkolom past, anders links
     van de lijn als het daar de kop niet raakt. Past het nergens, dan valt het
     weg - de kop draagt de betekenis dan al, en het driehoekje zegt nog steeds
     dat hier een waarde staat. */
  const kop = 'totaal per cijfer - links tegen, rechts voor'
  const kopEinde = m.links + tekstbreed(kop, 13)
  const label = 'hoogste totaal'
  const labelBreed = tekstbreed(label, 13)
  /** Waar de getallenkolom rechts begint. Daar mag het opschrift niet in. */
  const getallenVan = m.links + m.breed - 58
  const rechtsPast = hoogsteX + 7 + labelBreed < getallenVan && hoogsteX > kopEinde + 6
  const linksPast = hoogsteX - 7 - labelBreed > kopEinde + 6
  const labelKant = rechtsPast ? 'rechts' : linksPast ? 'links' : 'weg'

  /* De pixel die de leerling aanwijst, uit de coördinaten van de aanwijzer.
     Eén doorzichtig vlak over het hele beeldje, niet 784 vakjes met elk hun
     eigen handler: dat laatste zou React 784 elementen laten hertekenen bij
     elke stap van de optelling, elf keer per seconde. */
  const wijs = (e: { clientX: number; clientY: number }) => {
    const w = s.toWorld(e)
    const kolom = Math.floor((s.sx(w.x) - m.links) / m.k)
    const rij = Math.floor((s.sy(w.y) - m.boven) / m.k)
    if (kolom < 0 || kolom >= ZIJDE || rij < 0 || rij >= ZIJDE) {
      opAangewezen(null)
      return
    }
    opAangewezen(rij * ZIJDE + kolom)
  }

  /* Klikken op een balkregel kiest dat cijfer. Een sleep is geen klik: wie in
     een bord pant, mag niet ongemerkt een ander cijfer kiezen. En de tweede
     klik van een dubbelklik hoort bij het opnieuw kaderen van het bord. */
  const neer = useRef<{ x: number; y: number; c: number } | null>(null)



  /** Wat er in het eerste bijschrift onder het beeldje staat. */
  const bijschriftA =
    aangewezen !== null
      ? `deze pixel: ${metTeken(bij[aangewezen])} ${bij[aangewezen] < 0 ? 'tegen' : 'voor'} cijfer ${cijfer}`
      : zelfGekozen
        ? `de getallen van cijfer ${cijfer}`
        : `de getallen van cijfer ${cijfer} - klik op een balk`

  /** En in het tweede. Eén slot, twee toestanden, geen extra regel: de
   *  stippellijn bestaat alleen als je verschoven hebt, en de grijze pixel
   *  is juist in de begintoestand het ding dat uitleg vraagt.
   *
   *  Hier stond eerst "grijs vakje: die pixel telt bijna niets mee", en dat is
   *  één begrip met twee woorden in één regel. `vakje` is bovendien het woord
   *  van les 5 voor een KNOOP van de boom - negen keer in die les, en het bord
   *  "Bouw de boom" gebruikt het ook zo. Les 4 zegt zelf `pixel`, dus dat is
   *  hier het enige woord. */
  const bijschriftB = verschoven
    ? 'stippellijn: het beeldje in het midden'
    : 'grijze pixel: die telt bijna niets mee'

  return (
    <>
      <Kader m={m} />
      {verschoven && o.r1 >= 0 && (
        <rect
          x={m.links + o.k0 * m.k}
          y={m.boven + o.r0 * m.k}
          width={(o.k1 - o.k0 + 1) * m.k}
          height={(o.r1 - o.r0 + 1) * m.k}
          fill="none"
          stroke={MUTED}
          strokeWidth={1.25}
          strokeDasharray="4 3"
        />
      )}

      {/* De inkt, gekleurd naar wat ze bijdraagt aan het gekozen cijfer. Een
          rijtje dat nog niet opgeteld is, staat op 22%: dan is te zien wat er
          al meegerekend is en wat nog komt. De haarlijnrand en de navy stip
          zijn het relief bij de twee lichte tinten - die staan onder 3:1 tegen
          het papier, en zonder relief is een licht vakje niet meer als vakje
          te zien. */}
      {inkt.map((i) => {
        const rij = Math.floor(i / ZIJDE)
        const kolom = i % ZIJDE
        const x = m.links + kolom * m.k
        const y = m.boven + rij * m.k
        const flauw = rij >= rijtje
        return (
          <g key={i} opacity={flauw ? 0.22 : 1}>
            <rect
              x={x}
              y={y}
              width={m.k}
              height={m.k}
              fill={celkleur(bij[i])}
              stroke={RULE}
              strokeWidth={0.75}
            />
            <circle cx={x + m.k / 2} cy={y + m.k / 2} r={Math.max(1.1, m.k * 0.11)} fill={DATA} />
          </g>
        )
      })}
      {/* Het vakje dat de leerling aanwijst, met een navy rand. Geen tweede
          kleur: alleen een rand, zodat de tint van het vakje zelf blijft. */}
      {aangewezen !== null && beeld[aangewezen] > 0 && (
        <rect
          x={m.links + (aangewezen % ZIJDE) * m.k}
          y={m.boven + Math.floor(aangewezen / ZIJDE) * m.k}
          width={m.k}
          height={m.k}
          fill="none"
          stroke={NAVY}
          strokeWidth={2}
        />
      )}
      {/* De markeerlijn: tot hier is opgeteld. Ze steekt aan beide kanten
          buiten het kader, zodat ze op de rand van het beeldje niet wegvalt. */}
      {!klaar && (
        <line
          x1={m.links - 5}
          y1={m.boven + rijtje * m.k}
          x2={m.links + m.breed + 5}
          y2={m.boven + rijtje * m.k}
          stroke={NAVY}
          strokeWidth={2.25}
        />
      )}
      {/* Het doorzichtige vlak dat het aanwijzen opvangt. Het stopt de
          gebeurtenis NIET, dus slepen om te pannen werkt eronder gewoon door. */}
      <rect
        x={m.links}
        y={m.boven}
        width={m.breed}
        height={m.breed}
        fill="transparent"
        onPointerMove={wijs}
        onPointerLeave={() => opAangewezen(null)}
      />

      {/* De twee bijschriften onder het beeldje, in de 34 px die er al waren.
          Vorm "ding: wat het is", zoals op de andere borden. */}
      <Bijschrift x={m.links} y={m.boven + m.breed + 14}>
        {bijschriftA}
      </Bijschrift>
      <Bijschrift x={m.links} y={m.boven + m.breed + 30}>
        {bijschriftB}
      </Bijschrift>

      <Bijschrift x={m.links} y={balkenBoven - 7}>
        {kop}
      </Bijschrift>

      {/* De stippellijn bij het hoogste totaal, met een driehoekje aan de kop
          zodat ze ook zonder opschrift als een merk leest. */}
      {klaar && (
        <>
          <line
            x1={hoogsteX}
            y1={balkenBoven}
            x2={hoogsteX}
            y2={balkenOnder}
            stroke={NAVY}
            strokeWidth={1.5}
            strokeDasharray="5 4"
          />
          {/* Het driehoekje staat ONDER de balken en niet erboven. Boven zat
              het in de 9 px onder de kopregel, en bij een beeldje met een klein
              winnend totaal komt de lijn links uit - dan staat het driehoekje
              bovenop de woorden "links tegen, rechts voor". Onder de laatste
              balk is er 8 px die niemand anders gebruikt: de antwoordregel
              eronder begint pas 12 px lager. */}
          <path
            d={`M ${hoogsteX - 4} ${balkenOnder + 6} L ${hoogsteX + 4} ${balkenOnder + 6} L ${hoogsteX} ${balkenOnder} Z`}
            fill={NAVY}
          />
          {labelKant !== 'weg' && (
            <Bijschrift
              x={labelKant === 'rechts' ? hoogsteX + 7 : hoogsteX - 7}
              y={balkenBoven - 7}
              anker={labelKant === 'rechts' ? 'start' : 'end'}
            >
              {label}
            </Bijschrift>
          )}
        </>
      )}

      {Array.from({ length: 10 }, (_, c) => {
        const y = balkenBoven + c * m.regel
        const mid = y + m.regel / 2
        const hoog = Math.max(9, m.regel * 0.56)
        const v = totalen[c]
        const eind = nulX + clamp(v / as, -1, 1) * halve
        const isGekozenCijfer = c === cijfer
        return (
          <g key={c} style={{ cursor: 'pointer' }}>
            {/* Het cijfer waarvan de getallen op het beeldje liggen: een tint
                over de hele regel EN een navy streep aan de rand, en het
                bijschrift onder het beeldje noemt het cijfer met zoveel
                woorden. Drie aanwijzingen, dus nooit alleen kleur. */}
            {isGekozenCijfer && (
              <>
                <rect
                  x={m.links}
                  y={y}
                  width={m.breed}
                  height={m.regel}
                  fill={NAVY}
                  fillOpacity={0.055}
                  rx={3}
                />
                <rect x={m.links} y={y + 2} width={3} height={m.regel - 4} fill={NAVY} rx={1.5} />
              </>
            )}
            {/* Het spoor: de hele as, zodat te zien is hoeveel er nog kan. */}
            <rect
              x={balkX}
              y={mid - hoog / 2}
              width={balkBreed}
              height={hoog}
              fill={RULE}
              fillOpacity={0.85}
              rx={2}
            />
            <rect
              x={Math.min(nulX, eind)}
              y={mid - hoog / 2}
              width={Math.max(1, Math.abs(eind - nulX))}
              height={hoog}
              fill={v < 0 ? FOUT : MODEL}
              rx={2}
            />
            {/* De nullijn. Hier begint elke balk, en van hieruit is te zien
                welke kant hij op gaat. */}
            <line
              x1={nulX}
              y1={mid - hoog / 2 - 1}
              x2={nulX}
              y2={mid + hoog / 2 + 1}
              stroke={MUTED}
              strokeWidth={1}
            />
            {/* De keuze van het model: een driehoek, niet alleen een kleur. Ze
                staat er pas als alles opgeteld is - halverwege heeft het model
                nog geen antwoord. Navy, want deze driehoek zegt "dit koos het
                model" en niet of dat juist is; dat staat in woorden onderaan. */}
            {klaar && c === gekozen && (
              <path
                d={`M ${merkA - 4} ${mid - 6} L ${merkA + 5} ${mid} L ${merkA - 4} ${mid + 6} Z`}
                fill={NAVY}
              />
            )}
            {/* Het echte cijfer: een ring, in de neutrale tekstkleur. Met opzet
                geen derde merkkleur: de derde is groen, en groen naast het
                gebrande oranje valt onder protanopie samen (dE 4,0). De
                betekenis hangt aan de VORM en aan het woord onderaan. */}
            {c === echt && (
              <circle cx={merkB} cy={mid} r={4.5} fill="#fff" stroke={INK} strokeWidth={2} />
            )}
            <text
              x={cijferX}
              y={mid + 5.5}
              textAnchor="end"
              fontSize={15.5}
              fontWeight={800}
              fill={INK}
              stroke="#fff"
              strokeWidth={3.5}
              paintOrder="stroke"
            >
              {c}
            </text>
            <text
              x={m.links + m.breed}
              y={mid + 4.5}
              textAnchor="end"
              fontSize={13}
              fontWeight={isGekozenCijfer ? 800 : 700}
              fill={isGekozenCijfer ? INK : MUTED}
              stroke="#fff"
              strokeWidth={3.5}
              paintOrder="stroke"
            >
              {metTeken(v)}
            </text>
            {/* Het klikvlak ligt boven alles van deze regel, en is de hele
                regel breed: op een beamer is een balk van 10 px hoog geen
                doel. */}
            <rect
              x={m.links}
              y={y}
              width={m.breed}
              height={m.regel}
              fill="transparent"
              /* Deze regel MOET hier staan, precies zoals Dots in Canvas.tsx
                 het doet. Zonder haar bereikt de pointerdown ook de svg van
                 Canvas, en die roept daar setPointerCapture aan. Vanaf dat
                 moment gaat niet alleen elke pointerup naar die svg, maar ook
                 de mouseup en de CLICK - gemeten met een echte klik: doel
                 pointerdown = rect, doel click = svg. Een klik op een balk deed
                 daardoor niets, en dat is de knop waarmee dit bord van cijfer
                 wisselt. Onclick in plaats van onPointerUp lost het dus niet
                 op; alleen de gebeurtenis tegenhouden werkt. Wat het kost: een
                 sleep die op een balk begint pant het bord niet. Dat is dezelfde
                 afweging die Dots al maakt. */
              onPointerDown={(e) => {
                e.stopPropagation()
                neer.current = { x: e.clientX, y: e.clientY, c }
              }}
              onPointerUp={(e) => {
                const d = neer.current
                neer.current = null
                if (!d || d.c !== c) return
                if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) return
                if (e.detail >= 2) return
                e.stopPropagation()
                opCijfer(c)
              }}
            />
          </g>
        )
      })}

      {/* De twee antwoordregels. Elke toestand heeft zijn eigen vorm, zijn
          eigen getal en zijn eigen woord, dus niets hangt aan kleur alleen.

          Tijdens de optelling staat hier GEEN winnaar. Dat is de belangrijkste
          regel van dit bord: halverwege leidt bij 118 van de 120 beeldjes een
          ander cijfer dan het uiteindelijke antwoord - de kop wisselt mediaan
          8 keer - dus een bord dat tussentijds "het model zegt 7" laat staan,
          leert het tegendeel van wat het bedoelt. */}
      {klaar ? (
        <path
          d={`M ${m.links + 4} ${antwoordBoven - 5} L ${m.links + 13} ${antwoordBoven + 1} L ${m.links + 4} ${antwoordBoven + 7} Z`}
          fill={NAVY}
        />
      ) : null}
      <text
        x={m.links + 20}
        y={antwoordBoven + 6}
        fontSize={m.maat}
        fontWeight={700}
        fill={INK}
        stroke="#fff"
        strokeWidth={3.5}
        paintOrder="stroke"
      >
        {klaar
          ? `de keuze van het model: ${gekozen} - ${juist ? 'juist' : 'fout'}`
          : `nog ${getal(tegaan)} ${meervoud(tegaan, 'rijtje', 'rijtjes')} te gaan`}
      </text>
      <circle
        cx={m.links + 8.5}
        cy={antwoordBoven + m.maat * 1.5 + 1}
        r={4.5}
        fill="#fff"
        stroke={INK}
        strokeWidth={2}
      />
      <text
        x={m.links + 20}
        y={antwoordBoven + m.maat * 1.5 + 6}
        fontSize={m.maat}
        fontWeight={700}
        fill={INK}
        stroke="#fff"
        strokeWidth={3.5}
        paintOrder="stroke"
      >
        {`het echte cijfer: ${echt}`}
      </text>
      {/* Er staat GEEN totaal van het gekozen cijfer bij de antwoordregels.
          Dat getal staat al rechts op zijn eigen balkregel, en een tweede
          exemplaar naast het antwoord liep op 900x700 over de regel
          "de keuze van het model: 5 - juist" heen. */}
    </>
  )
}
