import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Canvas, { type Scales, type View } from '../components/Canvas'
import { Brief, Btn, Divider, Note, Panel, PyChip } from '../components/Overlay'
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
  useEffect(() => {
    let levend = true
    laadPixelModel()
      .then((m) => {
        if (levend) setModel(m)
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
  }, [])

  /** Welk beeldje groot op het bord staat. 0 is de 5 die naar een 3 kantelt. */
  const [nr, setNr] = useState(0)
  const [dy, setDy] = useState(0)
  const [dx, setDx] = useState(0)
  /** Hoeveel rijtjes van het beeldje al opgeteld zijn, 0 tot 28. */
  const [rijtje, setRijtje] = useState(ZIJDE)
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
        <p>Tel de rijtjes op en verschuif het beeldje.</p>
        {/* Het aantal komt uit het exportbestand, niet uit deze zin. Zolang
            het model laadt staat er "alle", want dan is er nog niets geteld. */}
        <p>
          De teller doet hetzelfde met {aantal > 0 ? getal(aantal) : 'alle'} beeldjes uit de test
          set.
        </p>
      </Brief>

      {/*
        LINKSONDER: de teller die de afloop meet, en de bediening. Dit paneel
        staat er van bij het begin en verandert nooit van breedte. Canvas meet
        elk paneel naast het bord en reserveert die breedte, dus een paneel dat
        pas na een klik verschijnt zou het hele bord opnieuw kaderen terwijl de
        leerling ernaar kijkt.

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

        De maat is nu: 6 px BINNEN een set, 14 px TUSSEN twee sets, en één
        streepje in het hele paneel (tussen de vaststelling en de eerste set).
        Een streepje tussen de sets kost 21 px, en bij 900x700 staat dit paneel
        precies op zijn cap van 508 px, dus die 21 px zouden recht uit de
        uitleg onderaan komen. De ladder doet hetzelfde werk voor 0 px.

        Alle vier de richtingen staan in een `grid-cols-2` met `full`, dus het
        paneel heeft op ELK formaat dezelfde vorm: vier regels, knoppen van
        108 px bij smal en 148 px bij breed, en nergens een afgekapt opschrift.

        NAGEMETEN in de browser, op de zes formaten waarop dit bord getoetst
        wordt. "vrij" is de hoogte die er na het vaste deel overblijft voor de
        uitleg onderaan, en "gat" is de afstand tussen de onderkant van de
        Brief en de bovenkant van dit paneel:

                     cap   vast   vrij   gat   knop
          1440x900   572    397    137    66    148
          1366x768   512    397     77    17    148
          1280x800   544    397    109    17    148
          1280x720   464    397     29    17    148
          1024x768   560    422    100     7    108
           900x700   492    422     32     7    108

        Op geen enkel formaat valt een knop onder de vouw, staat er een
        opschrift afgekapt (scrollWidth - clientWidth is overal 0) of ligt er
        bordtekst onder een paneel. Bij 900x700 is 32 px net genoeg voor de
        eerste regel van de uitleg (21,9 px), en dat is de reden dat de
        eerlijkheidszin bovenaan dat blok staat.
      */}
      <Panel className="pointer-events-auto absolute bottom-4 left-4 z-10 flex max-h-[calc(100%-13rem)] w-[16rem] flex-col px-4 py-3.5 xl:max-h-[calc(100%-16rem)] xl:w-[21rem]">
        <div className="shrink-0">
          {/* De vaststelling: één regel die zegt wat de leerling nu waar
              gemaakt heeft, met alle getallen uit de toestand van het bord en
              door `getal()`, zodat het decimaalteken op elk bord hetzelfde is.

              Vaste hoogte, ook als de detailregel er twee nodig heeft. Anders
              schuift alles eronder op zodra die regel omslaat, en dan valt de
              laatste regel van dit paneel bij 1024x768 net onder de rand.

              De detailregel wisselt met wat de leerling aan het doen is.
              Tijdens de optelling is het aantal beeldjes met een ander
              antwoord niet waar hij naar kijkt, en het rijtje dat hij net zag
              binnenkomen wel. Geen van beide noemt een winnaar. */}
          <div className="min-h-[4.4rem]">
            <Vaststelling
              label="Juist"
              value={teller ? teller.juist : null}
              outOf={teller ? { total: teller.totaal, noun: 'beeldjes' } : undefined}
              detail={
                !teller
                  ? undefined
                  : klaar
                    ? `Ander antwoord: ${getal(teller.anders)}.`
                    : rijtje === 0
                      ? 'Nog niets opgeteld.'
                      : `Rijtje ${getal(rijtje)} bracht ${metTeken(bijdrageRijtje)} bij.`
              }
              empty="Het model wordt geladen."
              color={NAVY}
            />
          </div>

          <Divider />

          {/* SET 1: de optelling. Het handvat en de knop doen hetzelfde ding,
              en staan daarom bij elkaar.

              Kopje en waarde staan op ÉÉN regel, en dat is een meting en geen
              smaak: met de waarde onder het kopje was het vaste deel van dit
              paneel 466 px, tegen een cap van 508 bij 900x700, en dan bleef er
              1,7 px over voor de uitleg onderaan - de eerlijkheidszin over de
              120 beeldjes was op de beamervloer dus volledig onzichtbaar. Twee
              kopjes op één regel brengen dat op 47 px, precies genoeg voor de
              eerste twee regels van die zin. */}
          <Groep label="Opgeteld">
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

          {/* SET 3: het onderwerp. Een ander beeldje is geen andere stand, dus
              het staat 14 px lager, in zijn eigen groep met de teller ernaast.

              De verschuiving blijft staan als je een ander beeldje neemt: dat
              is één stand voor het hele bord, en ze staat in woorden boven de
              knoppen. Ze stil terugzetten zou de klik van de leerling ongedaan
              maken zonder dat hij het ziet. Het gekozen cijfer gaat WEL terug
              naar het echte cijfer van het nieuwe beeldje: het cijfer van het
              vorige beeldje zou hier een toestand zijn die nergens meer bij
              hoort. En de balkas wordt hier opnieuw gerekend - dit is het
              enige moment waarop dat eerlijk is. */}
          <div className="mt-3.5 flex flex-wrap items-baseline gap-x-2 gap-y-1.5">
            <Btn
              variant="ghost"
              disabled={!model}
              onClick={() => {
                stopTellen()
                setNr(nr + 1)
                setRijtje(ZIJDE)
                setGekozenCijfer(null)
                setAangewezen(null)
              }}
            >
              Ander beeldje
            </Btn>
            {/* Waar de leerling in de rij zit. Zonder dit is "Ander beeldje"
                een knop zonder bodem: de teller gaat over een set die je niet
                kan overzien. Met het nummer erbij is het dezelfde set die je
                zelf kan doorlopen. Beide getallen komen uit de toestand. */}
            {aantal > 0 && (
              <span className="text-[13px] tabular-nums text-ink/80">
                beeldje {getal(plek + 1)} van de {getal(aantal)}
              </span>
            )}
          </div>
        </div>

        <div className="mt-2 min-h-0 overflow-y-auto">
          {/* Deze zin staat eerst omdat ze de eerlijkheid van dit bord draagt:
              het openingsbeeldje is met opzet gekozen en ongeveer 4% van de
              beeldjes kantelt per richting, dus het bord mag niet suggereren
              dat elk beeldje zo reageert. Bij 900x700 valt de tweede regel van
              dit blok in het scrollgebied, dus als er iets onder de rand valt,
              moet het deze zin niet zijn. */}
          <Note>
            {/* De eerste vier woorden vormen een afgeronde bewering, en dat is
                nodig: bij 900x700 is van dit blok maar 25,6 px zichtbaar, dus
                één regel van 21,9 px. "Niet elk beeldje verandert van" brak
                middenin een zinsdeel af en las als een stuk bord dat kapot is;
                "Niet elk beeldje kantelt" staat er heel. `kantelt` is in dit
                project al het woord voor een beeldje dat van antwoord
                verandert. */}
            <p>Niet elk beeldje kantelt bij één pixel. De teller zegt bij hoeveel wel.</p>
            <p className="mt-1.5">
              Een pixel zonder inkt telt niet mee, welk getal er ook op staat.
            </p>
          </Note>

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
   *  stippellijn bestaat alleen als je verschoven hebt, en het grijze vakje
   *  is juist in de begintoestand het ding dat uitleg vraagt. */
  const bijschriftB = verschoven
    ? 'stippellijn: het beeldje in het midden'
    : 'grijs vakje: die pixel telt bijna niets mee'

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
              onPointerDown={(e) => {
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
