import { useMemo, useRef, useState } from 'react'
import Canvas, { type Scales, type View } from '../components/Canvas'
import { Brief, Btn, Divider, Note, Panel, PyChip } from '../components/Overlay'
import Vaststelling, { getal, meervoud } from '../components/Vaststelling'
import {
  ALLE_IDS,
  BUDGET,
  CODERING,
  KENMERKEN,
  KLASSEN,
  LENGTE,
  LENGTE_AS,
  MAX_DIEPTE,
  VOORBEELDEN,
  WOORDEN,
  aantalBladeren,
  aantalCondities,
  aantalKlaar,
  besteConditie,
  cartBoom,
  conditieTekst,
  diepteVan,
  drempels,
  exportText,
  gelijkspelVakjes,
  grootste,
  isBlad,
  maakOpening,
  splitsVakje,
  tel,
  vervangVakje,
  waarde,
  zuiver,
  type Conditie,
  type KenmerkNr,
  type Klasse,
  type Pad,
  type Vakje,
} from '../lib/boom'
import { DATA, DERDE, DERDE_INK, FOUT, INK, MODEL, MUTED, NAVY, RULE } from '../lib/palette'

/* ------------------------------------------------------------------ *
 * mAIstros 2 - les 5 - Bouw de boom.
 *
 * EEN DOEL: een conditie splitst een vakje in twee, en de boom herhaalt dat
 * tot elk vakje één klasse bevat. Dit bord gaat dus over hoe het ALGORITME te
 * werk gaat, niet over hoe een getrainde boom zich gedraagt. Dat onderscheid
 * is de reden dat het vorige bord van deze les afgekeurd is: daar mocht je aan
 * de uitvoer van een klaar model prutsen.
 *
 * ------------------------------------------------------------------ *
 * WAT NIELS ZAG, EN WAT ER DAAROM WEG IS (2026-09-09)
 * ------------------------------------------------------------------ *
 *
 * "Why dont I see a decision tree?" en "Keep it simple stupid, the flow and
 * interpretation needs to be very clear for a 15 year old". Vier dingen:
 *
 * 1. HET BORD OPENDE ZONDER BOOM. Diepte 0, één vakje, en "Splits deze groep"
 *    stond uit tot je eerst een kenmerk gekozen had. Twee poorten voor het
 *    onderwerp van het bord, en niemand naast de leerling om te zeggen welke
 *    knop eerst. Nu opent het met `OPENING` al gezet: een wortel met twee
 *    kinderen, dus een boom, en precies één volgende zet - kies een kenmerk
 *    voor het gekozen blad. Waarom die splitsing niet van de leerling kan
 *    komen, staat gemeten bij `OPENING` in src/lib/boom.ts: geen enkele eerste
 *    conditie levert een blad met één klasse op.
 *
 * 2. HET BORD SPRAK sklearn. Er stond `samples = 20`, `value = [4, 4, 12]` en
 *    `Kleur <= 0.50` op, met onderaan een blok dat al die notatie uitlegde. Als
 *    een prent een decoder nodig heeft, is de prent fout. Een vakje zegt nu
 *    "Materiaal / is plush" en "9 Onbekend wezen"; de Python-notatie is niet
 *    weg - de les drukt ze zelf af op 2132149 en vraagt op 2224341 "Snap je wat
 *    hier staat?" - maar ze zit onder de knop "De computer", naast de codering
 *    die je nodig hebt om ze te lezen. Daar is ze een brug naar het notebook in
 *    plaats van een raadsel bij de eerste blik.
 *
 * 3. HET BORD WEES NAAR EEN GETAL DAT NIET BEWOOG. "Herhaal tot er niets meer
 *    fout staat", met de fout groot in het paneel - terwijl drie van de vier
 *    eerste zetten die fout op 8 laten staan. De teller is nu `aantalKlaar`:
 *    hoeveel voorbeelden in een vakje met één klasse zitten. Dat is de stopregel
 *    van de boom zelf, het beweegt bij 5 van de 6 mogelijke zetten meteen, en
 *    het is dezelfde finish: 20 van 20 klaar is nul fout. De getallen staan bij
 *    `aantalKlaar` in src/lib/boom.ts.
 *
 * 4. TWEE WOORDEN VOOR ÉÉN DING. `vakje` en `groep` benoemden dezelfde
 *    verzameling voorbeelden, en de paneelregel wisselde er zelfs binnen twee
 *    toestanden tussen. Nu staat er overal `vakje`. `blad` blijft, want dat is
 *    een ANDER begrip en het woord van de les zelf: een vakje waar geen pijlen
 *    meer uit vertrekken.
 *
 * DE WOORDEN KOMEN VAN DE LES ZELF, niet van mij:
 *   vakje, conditie, class                   slide 2224342 en 2224364
 *   waar / vals (de twee pijlen)             slide 2224342, letterlijk
 *   bladeren, diepte                         slide 2224243
 *   voorbeeld                                33 slides van deze les
 *   Kleur, Materiaal, Lengte, Soort          slide 2132210 en 2132327
 *   blauw/oranje, plush/metaal, haai/robot   slide 2132210
 * Twee woordbotsingen zijn met opzet zo beslecht:
 *   - `Soort` is hier een KENMERK (haai / robot). Wat de boom voorspelt heet
 *     daarom `klasse`, ook een woord van de les zelf ("de klasse die bij class
 *     staat", 2224342), en nooit `soort`.
 *   - de woordenlijst zegt `rij` voor één regel data, maar les 5 genereert
 *     wezens en noemt ze `voorbeelden`. Op dit bord dus `voorbeeld`.
 *
 * ALLE GETALLEN KOMEN UIT DE TOESTAND. Er staat geen enkel getal in de copy:
 * de teller, de vier getallen van jouw boom en de vier van de computerboom
 * worden bij elke tekening opnieuw geteld. Elk geheel getal gaat door
 * `getal()`, en een lengte door `getal(cm, 1)`, dus met een komma.
 * ------------------------------------------------------------------ */

/* --------------------------- de meetkunde --------------------------- *
 * Alles in bordpixels, en de hele tekening wordt als ÉÉN groep geschaald.
 *
 * Dat is de uitweg uit de val waar de vorige borden in liepen: schaal je
 * alleen de posities mee met de zoom en de tekst niet, dan schuiven de
 * vakjes bij uitzoomen over elkaar terwijl 13 px 13 px blijft. Nu schaalt
 * alles samen, dus overlappen kan niet.
 *
 * Het venster is de MAXIMALE boom, van de eerste tel af: vier bladeren breed
 * en drie rijen diep, met de lengte-as erboven. Zo verandert de schaal niet
 * terwijl de leerling bouwt. Een boom die bij elke splitsing zijn eigen schaal
 * verzet, herkadert het bord midden in een beweging.
 *
 * De breedte is GEMETEN en niet gekozen: vier vakjes van 124 px met 8 px
 * ertussen is 520 px, en op een beamer van 900 px laat Canvas naast de twee
 * linkerpanelen 538 px vrij (ins.left 288, rail 48, pad.right 26). Eén px
 * ruimer en het vierde blad valt van het beeld op de smalste beamer. Wie
 * aan VAK_W, GAT of de paneelbreedte raakt, maakt die som opnieuw.
 *
 * De hoogte is ruimer dan nodig en daarom niet bindend: 460 px tegen de 626 px
 * die Canvas op 900x700 vrijlaat. De schaal wordt dus door de BREEDTE bepaald,
 * op elke beamermaat. Dat is met opzet: hoogte over hebben kost niets, breedte
 * over hebben zou de tekst onder 13 px duwen.                            */

const VAK_W = 124
const GAT = 8
const PITCH = VAK_W + GAT
/** Vier bladeren naast elkaar. Dit is de cap, zie hierboven. */
const BOXW = 4 * PITCH - GAT
/** Ruimte boven een rij voor het woord "gekozen", dat boven een vakje hangt. */
const TAB_H = 16
/** Hoogte van een rij: het vakje plus de ruimte voor de twee pijlen. */
const RIJ_H = 112
const VAK_H_SPLIT = 78
const VAK_H_BLAD = 112

/* De lengte-as staat BOVEN de boom, en dat is met opzet: bij de start staat er
 * onder de wortel lege ruimte waar de boom in groeit. Stond de as onderaan, dan
 * lag die leegte tussen de twee dingen die de leerling nodig heeft en las het
 * bord als twee losse helften. Nu staan de as en het gekozen vakje bij de start
 * boven elkaar, met de pijlen ertussen. */
const AS_Y = 55
/** Hoogte van de hele band met de as erin. */
const AS_H = 108
const BOOM_TOP = AS_H + TAB_H
const BOXH = BOOM_TOP + MAX_DIEPTE * RIJ_H + VAK_H_BLAD
/** De as loopt niet van rand tot rand: links en rechts blijft plaats voor het
 *  eerste en het laatste astekstje. */
const AS_X0 = 16
const AS_X1 = BOXW - 16

const VENSTER: View = { x0: 0, x1: BOXW, y0: 0, y1: BOXH }

/** Waar rij `d` begint. */
const rijTop = (d: number) => BOOM_TOP + d * RIJ_H
/** Een blad heeft regels extra voor zijn klassen en zijn toestand. */
const vakHoogte = (v: Vakje) => (isBlad(v) ? VAK_H_BLAD : VAK_H_SPLIT)
/** Waar een lengte in cm op de as staat. */
const asX = (cm: number) =>
  AS_X0 + ((cm - LENGTE_AS.van) / (LENGTE_AS.tot - LENGTE_AS.van)) * (AS_X1 - AS_X0)

/* ---------------------------- de opmaak ----------------------------- */

type Kader = {
  pad: Pad
  vakje: Vakje
  /** Linkerbovenhoek in bordpixels; de breedte is altijd VAK_W. */
  x: number
  y: number
  h: number
  /** Het midden van het vakje: daar hangen de pijlen aan. */
  mid: number
  diepte: number
}

/**
 * De boom uitleggen als vakjes: elk blad krijgt een eigen kolom, en een
 * vakje met een conditie staat gecentreerd boven zijn twee kinderen. Daarna
 * schuift het geheel naar het midden van het venster.
 *
 * De boom schuift dus opzij als hij breder wordt. Dat is de groei zelf en
 * geen herkadering: de schaal blijft staan, want het venster is al zo groot
 * als de grootste boom die je kan bouwen.
 */
function legUit(wortel: Vakje): Kader[] {
  const kaders: Kader[] = []
  let kolom = 0

  const plaats = (v: Vakje, pad: Pad, d: number): number => {
    let mid: number
    if (isBlad(v)) {
      mid = kolom * PITCH + VAK_W / 2
      kolom++
    } else {
      const a = plaats(v.waar!, [...pad, 'waar'], d + 1)
      const b = plaats(v.vals!, [...pad, 'vals'], d + 1)
      mid = (a + b) / 2
    }
    kaders.push({
      pad,
      vakje: v,
      x: mid - VAK_W / 2,
      y: rijTop(d),
      h: vakHoogte(v),
      mid,
      diepte: d,
    })
    return mid
  }

  plaats(wortel, [], 0)
  const gebruikt = kolom * PITCH - GAT
  const schuif = (BOXW - gebruikt) / 2
  for (const kader of kaders) {
    kader.x += schuif
    kader.mid += schuif
  }
  return kaders.sort((a, b) => a.diepte - b.diepte)
}

const padSleutel = (p: Pad) => p.join('/') || 'wortel'
const zelfdePad = (a: Pad, b: Pad) => a.length === b.length && a.every((s, i) => s === b[i])

/* ------------------------------ merken ------------------------------ *
 * Elke klasse heeft een eigen VORM en een eigen kleur, en haar naam staat er
 * altijd bij. Drie dragers, dus nooit kleur alleen.
 *
 * ER IS GEEN LEGENDE MEER, en dat is geen bezuiniging maar een gevolg. Elk
 * blad noemt zijn klassen bij naam, met het merk ernaast, en samen bevatten de
 * bladeren altijd alle twintig voorbeelden. Elke klasse die ergens op het bord
 * als merk staat, staat dus ook ergens met haar naam. Een aparte legende zou
 * datzelfde werk een tweede keer doen, en de vorige versie had die legende in
 * het scrollvak van het paneel, waar op 900x700 maar één van de drie regels
 * boven de rand stond.
 *
 * Geen groen voor de derde klasse: groen tegen het gebrande oranje van FOUT
 * zakt onder protanopie naar dE 4,0. Onbekend wezen wordt daarom een OPEN
 * ruit in de huisnavy - een andere vorm en een andere vulling, geen derde
 * tint. Dat het oranje op dit bord de klasse Albert betekent en niet
 * "misser", is een keuze voor dit bord: er staat hier geen enkele misser als
 * merk op het bord.                                                       */

const KLEUR: Record<Klasse, string> = {
  Albert: FOUT,
  Blahaj: MODEL,
  'Onbekend wezen': DATA,
}

function Merk({
  klasse,
  cx,
  cy,
  maat = 5,
}: {
  klasse: Klasse
  cx: number
  cy: number
  maat?: number
}) {
  if (klasse === 'Albert') {
    return <rect x={cx - maat} y={cy - maat} width={maat * 2} height={maat * 2} fill={FOUT} />
  }
  if (klasse === 'Blahaj') {
    return <circle cx={cx} cy={cy} r={maat} fill={MODEL} />
  }
  const r = maat + 1
  return (
    <path
      d={`M ${cx} ${cy - r} L ${cx + r} ${cy} L ${cx} ${cy + r} L ${cx - r} ${cy} Z`}
      fill="#fff"
      stroke={DATA}
      strokeWidth={2}
    />
  )
}

/**
 * De strip in een vakje: de verdeling als beeld. Drie stukken naar rato van de
 * drie aantallen, altijd in dezelfde volgorde. Eén vol stuk betekent dus één
 * klasse, gestreept betekent gemengd.
 *
 * Dit is de plaats waar op de prent van de les gini zou staan - en de les heeft
 * gini er zelf uit gehaald (`impurity=False` in beide plot_tree-aanroepen). Er
 * staat dus geen score in een vakje, alleen de verdeling. De aantallen zelf
 * staan er in cijfers bij, in een blad met de klassenaam erbij.
 */
function Strip({
  ids,
  x,
  y,
  w,
  h,
}: {
  ids: readonly number[]
  x: number
  y: number
  w: number
  h: number
}) {
  const c = tel(ids)
  const n = ids.length
  /* Elk stuk rekent zijn eigen begin uit de getallen ervoor. Geen teller die
     tijdens het tekenen oploopt: die leest als toestand die de tekening
     verandert, en oxlint vlagt dat terecht. */
  const stukken = KLASSEN.map((klasse, i) => ({
    klasse,
    x: x + (n === 0 ? 0 : (w * c.slice(0, i).reduce((s, v) => s + v, 0)) / n),
    breed: n === 0 ? 0 : (w * c[i]) / n,
  }))
  return (
    <>
      {stukken.map(
        (stuk) =>
          stuk.breed > 0 && (
            <rect
              key={stuk.klasse}
              x={stuk.x}
              y={y}
              width={stuk.breed}
              height={h}
              fill={stuk.klasse === 'Onbekend wezen' ? '#fff' : KLEUR[stuk.klasse]}
              stroke={stuk.klasse === 'Onbekend wezen' ? DATA : 'none'}
              strokeWidth={1.25}
            />
          ),
      )}
      <rect x={x} y={y} width={w} height={h} fill="none" stroke={RULE} strokeWidth={1} />
    </>
  )
}

/** Tekst op het bord: minstens 13 px, vet, met een witte rand eronder zodat
 *  ze over een lijn of een merk heen leesbaar blijft. */
function Tekst({
  x,
  y,
  children,
  maat = 13,
  dik = 700,
  kleur = INK,
  anker,
}: {
  x: number
  y: number
  children: string
  maat?: number
  dik?: number
  kleur?: string
  anker?: 'start' | 'middle' | 'end'
}) {
  return (
    <text
      x={x}
      y={y}
      fontSize={maat}
      fontWeight={dik}
      fill={kleur}
      textAnchor={anker}
      stroke="#fff"
      strokeWidth={3.5}
      paintOrder="stroke"
      pointerEvents="none"
    >
      {children}
    </text>
  )
}

/* ------------------------- een vakje in woorden --------------------- */

/**
 * Wat een gesplitst vakje op zijn twee eerste regels zegt: het kenmerk, en wat
 * het test - in de woorden van de les, niet in de notatie van sklearn.
 *
 * Waarom het op TWEE regels staat: de binnenkant van een vakje is 108 px en
 * "Materiaal is plush" haalt 13 px vet niet op één regel. Twee korte regels
 * lezen bovendien als een vraag met een antwoord eronder.
 *
 * `is plush` en niet `is niet metaal`: `splitsIds` zet `waarde <= drempel`
 * links, en bij een kenmerk met twee waarden is dat de waarde 0 - het eerste
 * woord in `WOORDEN`. De pijl naar links heet `waar`, dus links staat wat er
 * hier staat.
 *
 * Bij Lengte staat er een getal met een eenheid: `< 53,0 cm`. Met een komma,
 * want dat is een getal dat het bord zelf opschrijft. `<` en niet `<=`, en dat
 * is exact: een drempel ligt altijd MIDDEN tussen twee lengtes die echt
 * voorkomen, dus geen enkel voorbeeld staat er precies op.
 */
function conditieRegels(c: Conditie): [string, string] {
  const woorden = WOORDEN[c.kenmerk]
  if (woorden) return [KENMERKEN[c.kenmerk], `is ${woorden[0]}`]
  return [KENMERKEN[c.kenmerk], `< ${getal(c.drempel, 1)} cm`]
}

type KlasseTelling = { klasse: Klasse; aantal: number; naam: string[] }

/**
 * Wat er in een blad staat: per klasse die erin zit, het aantal en de naam.
 * "4 Blahaj", "9 Onbekend wezen".
 *
 * DIT IS DE VERVANGING VAN `value = [4, 4, 12]`. Een leerling leest hier namen
 * en aantallen in plaats van een rijtje dat hij eerst moet decoderen, en de
 * volgorde is nog altijd die van `KLASSEN`, dus dezelfde als die van `value`
 * in zijn notebook. Klassen met nul voorbeelden staan er niet: een blad zegt
 * wat erin zit, niet wat er niet in zit.
 *
 * DRIE KOLOMMEN, en die staan vast: het merk, het aantal, de naam. Gemeten in
 * de echte letter van het bord (Hanken Grotesk): "9 Onbekend wezen" is 111,5 px
 * op 13 px vet, en de binnenkant van een vakje is 108 px. Die naam moet dus
 * breken, en dan is een vaste naamkolom het verschil tussen "9 Onbekend /
 * wezen" - wat als twee losse dingen leest - en een naam die netjes onder
 * zichzelf doorloopt. Afkorten mag niet: een klasse houdt haar naam, en
 * "Onbekend" alleen zou een tweede woord voor dezelfde klasse zijn.
 *
 * Breder maken kon niet. Op 900x700 laat Canvas 538 px vrij (nagemeten in de
 * browser, k = 1,0346 bij BOXW 520), dus vier bladeren van 132 px zouden de
 * schaal onder 1 duwen en alle tekst onder 13 px.
 */
function klasseTellingen(ids: readonly number[]): KlasseTelling[] {
  const c = tel(ids)
  const uit: KlasseTelling[] = []
  KLASSEN.forEach((klasse, i) => {
    if (c[i] === 0) return
    uit.push({ klasse, aantal: c[i], naam: klasse.split(' ') })
  })
  return uit
}

/** De toestand van een blad, uitgeschreven. Dit is precies wat de teller in
 *  het paneel telt, dus het staat er met dezelfde woorden. */
const bladStaat = (ids: readonly number[]) => (zuiver(ids) ? 'één klasse' : 'gemengd')

/* ------------------------------ het vakje --------------------------- */

function VakjeVorm({
  kader,
  gekozen,
  onKlik,
}: {
  kader: Kader
  gekozen: boolean
  onKlik: (pad: Pad) => void
}) {
  const { vakje, x, y, h } = kader
  const blad = isBlad(vakje)
  const klasse = grootste(vakje.ids)
  const c = tel(vakje.ids)
  const zuiverheid = vakje.ids.length === 0 ? 0 : Math.max(...c) / vakje.ids.length
  const regels = vakje.conditie ? conditieRegels(vakje.conditie) : null

  /* Klikken is geen slepen. Waar de leerling neerdrukte wordt hier onthouden
     en in `onClick` vergeleken: verschoof hij meer dan een paar px, dan was
     het een pan van het bord en geen keuze. De tweede klik van een
     dubbelklik wordt ook genegeerd.

     Pointerdown MOET hier wel tegengehouden worden, en dat stond er eerst
     niet. Gemeten met een echte klik op een vakje: de pointerdown komt op de
     rect aan, maar de CLICK komt aan op de svg van Canvas. Die svg roept op
     pointerdown namelijk setPointerCapture aan, en vanaf dat moment gaan
     pointerup, mouseup EN click naar de svg. Een klik op een vakje deed dus
     niets, en dan blijft altijd de linkse tak gekozen: de leerling kan het
     rechtse vakje nooit splitsen, en juist die twee splitsingen samen zijn de
     boom van 3 condities en 20 van 20 klaar. Wat het tegenhouden kost: een
     sleep die op een vakje begint pant het bord niet. Precies wat Dots in
     Canvas.tsx ook doet. */
  const neer = useRef<{ x: number; y: number } | null>(null)

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`vakje met ${vakje.ids.length} ${meervoud(vakje.ids.length, 'voorbeeld', 'voorbeelden')}, ${bladStaat(vakje.ids)}`}
      style={{ cursor: 'pointer' }}
      className="outline-none"
      onPointerDown={(e) => {
        e.stopPropagation()
        neer.current = { x: e.clientX, y: e.clientY }
      }}
      onClick={(e) => {
        const start = neer.current
        neer.current = null
        if (!start || e.detail > 1) return
        if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 4) return
        onKlik(kader.pad)
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        e.preventDefault()
        onKlik(kader.pad)
      }}
    >
      {/* De vulling volgt `filled=True` uit de les: de kleur van de grootste
          klasse, sterker als het vakje zuiverder is. Ze zegt niets wat er niet
          ook in cijfers staat - de strip en de klassenregels doen dat werk. */}
      <rect
        x={x}
        y={y}
        width={VAK_W}
        height={h}
        rx={8}
        fill={KLEUR[klasse]}
        fillOpacity={0.05 + 0.13 * zuiverheid}
        stroke={gekozen ? DERDE : MUTED}
        strokeWidth={gekozen ? 3 : 1.25}
      />

      {/* Het gekozen vakje: een dikkere rand EN het woord erbij. Nooit kleur
          alleen, ook niet als die rand duidelijk lijkt. */}
      {gekozen && (
        <Tekst x={x + 2} y={y - 5} kleur={DERDE_INK}>
          gekozen
        </Tekst>
      )}

      {/* Een gesplitst vakje: de conditie in woorden, het aantal, de strip. Niet
          de aantallen per klasse - die staan in de bladeren eronder, en samen
          zijn de bladeren dit vakje. */}
      {regels && (
        <>
          <Tekst x={x + 8} y={y + 20} maat={14}>
            {regels[0]}
          </Tekst>
          <Tekst x={x + 8} y={y + 37} maat={14}>
            {regels[1]}
          </Tekst>
          <Tekst x={x + 8} y={y + 55} dik={600} kleur={MUTED}>
            {`${getal(vakje.ids.length)} ${meervoud(vakje.ids.length, 'voorbeeld', 'voorbeelden')}`}
          </Tekst>
          <Strip ids={vakje.ids} x={x + 8} y={y + 61} w={VAK_W - 16} h={11} />
        </>
      )}

      {/* Een blad: het aantal, de strip, wat erin zit, en of het klaar is. De
          plaats van elke regel staat vast, ook als er minder klassen in zitten,
          zodat alle bladeren er hetzelfde uitzien en de leerling in één blik
          kan zien welke "één klasse" zeggen. */}
      {blad && (
        <>
          <Tekst x={x + 8} y={y + 19} dik={600} kleur={MUTED}>
            {`${getal(vakje.ids.length)} ${meervoud(vakje.ids.length, 'voorbeeld', 'voorbeelden')}`}
          </Tekst>
          <Strip ids={vakje.ids} x={x + 8} y={y + 25} w={VAK_W - 16} h={12} />
          {(() => {
            /* De regelteller loopt door over de klassen heen, want een naam van
               twee woorden neemt twee regels. Drie regels is het maximum in
               deze data: twee klassen, waarvan één met een naam die breekt. */
            let regel = 0
            return klasseTellingen(vakje.ids).map((telling) => {
              const eersteRegel = regel
              const rijen = telling.naam.map((woord, w) => {
                const yy = y + 58 + (eersteRegel + w) * 16
                return (
                  <Tekst key={woord} x={x + 40} y={yy} maat={13.5}>
                    {woord}
                  </Tekst>
                )
              })
              regel += telling.naam.length
              return (
                <g key={telling.klasse}>
                  <Merk klasse={telling.klasse} cx={x + 14} cy={y + 53.5 + eersteRegel * 16} maat={4.5} />
                  <Tekst x={x + 22} y={y + 58 + eersteRegel * 16} maat={13.5}>
                    {getal(telling.aantal)}
                  </Tekst>
                  {rijen}
                </g>
              )
            })
          })()}
          <Tekst x={x + 8} y={y + 104} kleur={zuiver(vakje.ids) ? DERDE_INK : INK}>
            {bladStaat(vakje.ids)}
          </Tekst>
        </>
      )}
    </g>
  )
}

/* --------------------------- de twee pijlen ------------------------- */

function Pijlen({ ouder, kind, woord }: { ouder: Kader; kind: Kader; woord: 'waar' | 'vals' }) {
  const y0 = ouder.y + ouder.h
  const y1 = kind.y
  const knik = (y0 + y1) / 2
  return (
    <>
      <path
        d={`M ${ouder.mid} ${y0} L ${ouder.mid} ${knik} L ${kind.mid} ${knik} L ${kind.mid} ${y1}`}
        fill="none"
        stroke={MUTED}
        strokeWidth={1.5}
      />
      <Tekst
        x={kind.mid + (woord === 'waar' ? -6 : 6)}
        y={knik - 6}
        kleur={MUTED}
        anker={woord === 'waar' ? 'end' : 'start'}
      >
        {woord}
      </Tekst>
    </>
  )
}

/* ---------------------------- de lengte-as -------------------------- *
 * De lengtes van het gekozen vakje op één lijn, elk met het merk van zijn
 * klasse. Zo zie je waarom een drempel een vakje scheidt: links van het
 * handvat staan andere merken dan rechts.
 *
 * De band staat er ALTIJD, ook zonder handvat. Een as die pas na een klik
 * opduikt, zou het bord opnieuw kaderen terwijl de leerling ernaar kijkt.
 *
 * HET HANDVAT HOORT BIJ EEN GEZETTE CONDITIE, niet bij een die je nog moet
 * zetten. Dat is de vereenvoudiging van deze versie: klikken op een kenmerk
 * splitst meteen, en daarna sleep je de grens van die splitsing terwijl de twee
 * bladeren eronder live meetellen. Het oude bord had er een stippelvakje en een
 * aparte knop "Splits deze groep" voor nodig - drie poorten voor één zet.
 *
 * Het handvat snapt naar de middens tussen twee opeenvolgende lengtes in het
 * vakje. Dat zijn exact de drempels die een boom overweegt, dus de waarde waar
 * de leerling op uitkomt, is dezelfde soort waarde als in zijn notebook.     */

function LengteAs({
  ids,
  drempel,
  stops,
  regel,
  onSleep,
  onStap,
}: {
  ids: readonly number[]
  /** De drempel van het gekozen vakje, of `null` als er geen handvat is. */
  drempel: number | null
  stops: number[]
  /** De ene regel onder de as. Zie `asRegel()` in het bord zelf. */
  regel: { tekst: string; kleur: string }
  onSleep: (clientX: number) => void
  onStap: (richting: -1 | 1) => void
}) {
  const slepend = useRef(false)
  const tik = useRef<{ x: number; y: number } | null>(null)
  const ticks = [25, 50, 75, 100, 125]

  return (
    <g>
      <line x1={AS_X0} y1={AS_Y} x2={AS_X1} y2={AS_Y} stroke={RULE} strokeWidth={2} />
      {ticks.map((t) => (
        <g key={t}>
          <line x1={asX(t)} y1={AS_Y - 4} x2={asX(t)} y2={AS_Y + 4} stroke={RULE} strokeWidth={2} />
          <Tekst x={asX(t)} y={AS_Y + 22} maat={13} dik={600} kleur={MUTED} anker="middle">
            {String(t)}
          </Tekst>
        </g>
      ))}
      {/* 13 px en niet 12,5: op 900x700 schaalt het bord met 1,035, en 12,5 px
          kwam daar op 12,93 px effectief uit - net onder de 13 px die een
          beamerbord moet halen. Gemeten, niet geschat. */}
      <Tekst x={AS_X1} y={AS_Y + 22} maat={13} dik={600} kleur={MUTED} anker="end">
        cm
      </Tekst>

      {ids.map((id) => (
        <Merk
          key={id}
          klasse={VOORBEELDEN[id].klasse}
          cx={asX(waarde(id, LENGTE))}
          cy={AS_Y - 13}
          maat={4.5}
        />
      ))}

      {/* Eén regel, altijd op dezelfde plaats en altijd links. Ze staat NIET
          onder het handvat gecentreerd - dan zou ze bij een drempel aan de
          linkerkant over de astekst schuiven. */}
      <Tekst x={AS_X0} y={AS_Y + 42} kleur={regel.kleur}>
        {regel.tekst}
      </Tekst>

      {drempel !== null && (
        <>
          {/* Naast slepen mag je ook ergens op de as tikken: het handvat gaat
              dan naar de dichtste stop. Dat is niet alleen vriendelijker op een
              aanraakscherm, het dekt ook het gebaar van iemand die indrukt en
              elders lost zonder ertussen te bewegen. Klikken is geen slepen,
              dus een gebaar dat verschoof wordt genegeerd.

              Ook hier houdt pointerdown de gebeurtenis tegen, om dezelfde
              gemeten reden als bij een vakje: laat je haar door, dan neemt de
              svg van Canvas de pointer over en komt de click daar aan in plaats
              van hier, zodat tikken op de as niets deed. */}
          <rect
            x={AS_X0}
            y={AS_Y - 42}
            width={AS_X1 - AS_X0}
            height={58}
            fill="transparent"
            style={{ cursor: 'pointer' }}
            onPointerDown={(e) => {
              e.stopPropagation()
              tik.current = { x: e.clientX, y: e.clientY }
            }}
            onClick={(e) => {
              const start = tik.current
              tik.current = null
              if (!start || e.detail > 1) return
              if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 4) return
              onSleep(e.clientX)
            }}
          />

          {/* Elke stop staat op de as, zodat te zien is dat het handvat niet
              zomaar ergens landt: het valt tussen twee voorbeelden. */}
          {stops.map((s) => (
            <line
              key={s}
              x1={asX(s)}
              y1={AS_Y + 5}
              x2={asX(s)}
              y2={AS_Y + 9}
              stroke={DERDE}
              strokeWidth={1.5}
              opacity={0.5}
            />
          ))}
          <line
            x1={asX(drempel)}
            y1={AS_Y - 26}
            x2={asX(drempel)}
            y2={AS_Y + 12}
            stroke={DERDE}
            strokeWidth={2.5}
          />
          <g
            role="slider"
            tabIndex={0}
            aria-label="sleep dit handvat om de grens te verplaatsen"
            aria-valuetext={`${getal(drempel, 1)} cm`}
            style={{ cursor: 'ew-resize' }}
            className="outline-none"
            /* Het sleepdoel wordt hier ÉÉN keer vastgelegd, met
               setPointerCapture op dit handvat. Zoek je per pointermove opnieuw
               welk element onder de muis ligt, dan valt de sleep stil zodra de
               muis het bolletje verlaat - en dat leest als een knop die stuk
               is. */
            onPointerDown={(e) => {
              slepend.current = true
              ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
              e.stopPropagation()
            }}
            onPointerMove={(e) => {
              if (!slepend.current) return
              e.stopPropagation()
              onSleep(e.clientX)
            }}
            onPointerUp={(e) => {
              // Ook bij het lossen nog één keer plaatsen: een gebaar dat
              // indrukt en elders lost zonder ertussen te bewegen, komt anders
              // nergens uit - en dat gebeurt op een aanraakscherm echt.
              if (slepend.current) onSleep(e.clientX)
              slepend.current = false
              e.stopPropagation()
            }}
            onPointerCancel={() => {
              slepend.current = false
            }}
            onKeyDown={(e) => {
              const richting = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0
              if (richting === 0) return
              e.preventDefault()
              e.stopPropagation()
              onStap(richting)
            }}
          >
            <circle cx={asX(drempel)} cy={AS_Y - 30} r={17} fill={DERDE} opacity={0.12} />
            <circle
              cx={asX(drempel)}
              cy={AS_Y - 30}
              r={8}
              fill={DERDE}
              stroke="#fff"
              strokeWidth={2.5}
            />
          </g>
        </>
      )}
    </g>
  )
}

/* ------------------------------ de tekening -------------------------- */

type BordProps = {
  s: Scales
  kaders: Kader[]
  gekozenKader: Kader
  pad: Pad
  /** De drempel die het handvat toont, of `null` als er geen handvat is. */
  drempel: number | null
  stops: number[]
  regel: { tekst: string; kleur: string }
  onKies: (pad: Pad) => void
  onDrempel: (cm: number) => void
  onStap: (richting: -1 | 1) => void
}

function Bord({
  s,
  kaders,
  gekozenKader,
  pad,
  drempel,
  stops,
  regel,
  onKies,
  onDrempel,
  onStap,
}: BordProps) {
  /* Eén schaal voor beide assen, zodat een vakje niet uitgerekt wordt, en de
     HELE tekening wordt ermee geschaald, tekst inbegrepen. Daardoor kunnen
     twee vakjes nooit over elkaar schuiven. Bij de opening is k >= 1 op elke
     beamer vanaf 900 px breed; zoomt de leerling zelf uit, dan wordt de tekst
     kleiner en zet "Alles" het weer terug. */
  const k = Math.min(1 / s.unitPerPx.x, 1 / s.unitPerPx.y)
  const ox = s.sx(BOXW / 2) - (BOXW * k) / 2
  const oy = s.sy(BOXH / 2) - (BOXH * k) / 2

  /** Van een muispositie naar een lengte in cm. `s.sx(s.toWorld(...))` is de
   *  afstand tot de linkerrand van het bord; daarna terug naar bordpixels. */
  const naarCm = (clientX: number) => {
    const lokaal = (s.sx(s.toWorld({ clientX, clientY: 0 }).x) - ox) / k
    return LENGTE_AS.van + ((lokaal - AS_X0) / (AS_X1 - AS_X0)) * (LENGTE_AS.tot - LENGTE_AS.van)
  }

  const perPad = new Map(kaders.map((kader) => [padSleutel(kader.pad), kader]))

  return (
    <g transform={`translate(${ox} ${oy}) scale(${k})`}>
      {/* Eerst de pijlen, dan de vakjes: zo komt geen lijn over een cijfer. */}
      {kaders.map((kader) => {
        if (isBlad(kader.vakje)) return null
        const waarKind = perPad.get(padSleutel([...kader.pad, 'waar']))
        const valsKind = perPad.get(padSleutel([...kader.pad, 'vals']))
        return (
          <g key={`pijl-${padSleutel(kader.pad)}`}>
            {waarKind && <Pijlen ouder={kader} kind={waarKind} woord="waar" />}
            {valsKind && <Pijlen ouder={kader} kind={valsKind} woord="vals" />}
          </g>
        )
      })}

      {kaders.map((kader) => (
        <VakjeVorm
          key={padSleutel(kader.pad)}
          kader={kader}
          gekozen={zelfdePad(kader.pad, pad)}
          onKlik={onKies}
        />
      ))}

      <LengteAs
        ids={gekozenKader.vakje.ids}
        drempel={drempel}
        stops={stops}
        regel={regel}
        onSleep={(clientX) => onDrempel(naarCm(clientX))}
        onStap={onStap}
      />
    </g>
  )
}

/* ------------------------------- het bord --------------------------- */

export default function KweekDeBoom() {
  /* HET BORD OPENT MET EEN BOOM. Zie `OPENING` in src/lib/boom.ts voor de
     meting achter die ene conditie. Het gekozen vakje is meteen het linkse
     blad: dat is het volste gemengde vakje, dus er is precies één zinvolle
     volgende zet - kies er een kenmerk voor. */
  const [boom, setBoom] = useState<Vakje>(maakOpening)
  /** Elke splitsing legt de vorige boom hierop, zodat stap terug kan. De stapel
   *  begint leeg, dus je kan nooit vóór de opening terug: een bord zonder boom
   *  is precies de toestand die hier weg moest. */
  const [terug, setTerug] = useState<{ boom: Vakje; pad: Pad }[]>([])
  const [pad, setPad] = useState<Pad>(['waar'])
  const [computerOpen, setComputerOpen] = useState(false)

  const kaders = useMemo(() => legUit(boom), [boom])
  const gekozenKader = kaders.find((kader) => zelfdePad(kader.pad, pad)) ?? kaders[0]
  const gekozen = gekozenKader.vakje

  const condities = aantalCondities(boom)
  const klaar = aantalKlaar(boom)
  const bladeren = aantalBladeren(boom)
  const diepte = diepteVan(boom)

  const computerKeuze = useMemo(() => besteConditie(gekozen.ids), [gekozen.ids])

  /* De boom van de computer en zijn vier getallen. Eén keer gerekend: hij
     verandert nooit, want de data verandert nooit. */
  const cart = useMemo(() => cartBoom(ALLE_IDS), [])
  const cartGetallen = useMemo(
    () => ({
      condities: aantalCondities(cart),
      bladeren: aantalBladeren(cart),
      diepte: diepteVan(cart),
      klaar: aantalKlaar(cart),
      gelijkspel: gelijkspelVakjes(cart),
    }),
    [cart],
  )

  const budgetOver = BUDGET - condities
  const isZuiver = zuiver(gekozen.ids)
  const teDiep = pad.length >= MAX_DIEPTE
  const magSplitsen = isBlad(gekozen) && !isZuiver && !teDiep && budgetOver > 0

  /** Welke kenmerken je in dit vakje nog kan gebruiken. Een kenmerk waarop alle
   *  voorbeelden dezelfde waarde hebben, heeft geen drempel meer - dat is geen
   *  storing maar iets om te tonen: een kenmerk kan opgebruikt zijn. */
  const mogelijk = useMemo(
    () => ([0, 1, 2, 3] as KenmerkNr[]).map((k) => drempels(gekozen.ids, k).length > 0),
    [gekozen.ids],
  )

  /* HET HANDVAT HOORT BIJ HET GEKOZEN VAKJE, en alleen als dat vakje al op
     Lengte gesplitst is EN zijn twee kinderen nog bladeren zijn. Die tweede
     voorwaarde is nodig: slepen splitst dit vakje opnieuw en maakt er twee
     verse bladeren van, dus een kleinkind zou verdwijnen zonder dat de leerling
     erom vroeg. */
  const opLengte =
    !isBlad(gekozen) &&
    gekozen.conditie!.kenmerk === LENGTE &&
    isBlad(gekozen.waar!) &&
    isBlad(gekozen.vals!)
  const handvat = opLengte ? gekozen.conditie!.drempel : null
  const stops = useMemo(() => (opLengte ? drempels(gekozen.ids, LENGTE) : []), [opLengte, gekozen])

  const kies = (nieuwPad: Pad) => setPad(nieuwPad)

  /**
   * ÉÉN KLIK IS ÉÉN SPLITSING. Geen voorbeeldvakje, geen tweede knop: je kiest
   * een kenmerk en de twee nieuwe vakjes staan er. Dat is de flow die Niels
   * vroeg, en het maakt van elke knop een knop met een zichtbaar gevolg.
   *
   * De drempel begint in het MIDDEN van de stops en niet op de beste. Dat is
   * met opzet: een handvat dat op zijn eindstand opent, geeft de leerling niets
   * te doen en vertelt hem niet dat de grens iets uitmaakt. Gemeten vanaf de
   * opening: in het linkse vakje zet Lengte de teller van 0 op 7, en slepen
   * naar 53,0 cm brengt hem op 13.
   */
  const splitsMet = (k: KenmerkNr) => {
    if (!magSplitsen) return
    const opties = drempels(gekozen.ids, k)
    if (opties.length === 0) return
    const drempel = opties[Math.floor((opties.length - 1) / 2)]
    const nieuw = splitsVakje(gekozen, { kenmerk: k, drempel })
    setTerug([...terug, { boom, pad }])
    setBoom(vervangVakje(boom, pad, nieuw))
    /* Bij Lengte blijft dit vakje gekozen: het handvat hoort erbij en er valt
       hier dus nog werk te doen. Bij de andere kenmerken is dit vakje af, en
       gaat de keuze naar het kind waar nog het meeste gemengd staat. Zo is er
       na elke zet precies één zinvolle volgende zet. */
    if (k === LENGTE) return
    const open = (v: Vakje) => (zuiver(v.ids) ? 0 : v.ids.length)
    const openWaar = open(nieuw.waar!)
    const openVals = open(nieuw.vals!)
    if (openWaar === 0 && openVals === 0) return
    setPad(openVals > openWaar ? [...pad, 'vals'] : [...pad, 'waar'])
  }

  /** Naar de dichtste stop, want dat zijn de enige drempels die een boom
   *  overweegt. Slepen splitst het gekozen vakje opnieuw; de twee bladeren
   *  eronder tellen dus live mee. */
  const zetDrempel = (cm: number) => {
    if (!opLengte || stops.length === 0) return
    let beste = stops[0]
    for (const stop of stops) if (Math.abs(stop - cm) < Math.abs(beste - cm)) beste = stop
    if (beste === gekozen.conditie!.drempel) return
    setBoom(vervangVakje(boom, pad, splitsVakje(gekozen, { kenmerk: LENGTE, drempel: beste })))
  }

  const stapDrempel = (richting: -1 | 1) => {
    if (!opLengte || stops.length === 0) return
    const i = stops.indexOf(gekozen.conditie!.drempel)
    const volgende = stops[Math.max(0, Math.min(stops.length - 1, i + richting))]
    if (volgende === undefined || volgende === gekozen.conditie!.drempel) return
    setBoom(vervangVakje(boom, pad, splitsVakje(gekozen, { kenmerk: LENGTE, drempel: volgende })))
  }

  const stapTerug = () => {
    const laatste = terug[terug.length - 1]
    if (!laatste) return
    setTerug(terug.slice(0, -1))
    setBoom(laatste.boom)
    setPad(laatste.pad)
  }

  /* De ene regel onder de lengte-as. Ze staat er altijd, op dezelfde plaats, en
     ze zegt het nuttigste van wat er op dat moment te zeggen valt. */
  const asRegel = opLengte
    ? { tekst: 'Sleep het handvat om de grens te verplaatsen.', kleur: DERDE_INK }
    : { tekst: 'De as toont de lengtes van het gekozen vakje.', kleur: MUTED }

  /** Eén regel die zegt wat er met het gekozen vakje kan. Elke toestand heeft
   *  haar eigen zin, want een knop die uitstaat zonder reden leest als een bord
   *  dat stuk is. Overal `vakje` en `blad`, nooit `groep`.
   *
   *  DE EINDSTAND STAAT BOVENAAN, en dat is gemeten en niet gekozen. Met de
   *  boom af (wortel op Materiaal, links Lengte op 53,0 cm, rechts Kleur:
   *  20 van 20 klaar) bleef hier "Dit vakje is al gesplitst. Klik op een blad
   *  om verder te bouwen." staan. Het doel van het bord is precies dat elk
   *  vakje één klasse heeft, dus dan mag de regel niet vragen om verder te
   *  bouwen - er valt niets meer te bouwen. Het woord blijft `klaar`, hetzelfde
   *  woord als de teller erboven. */
  const stand = klaar === VOORBEELDEN.length
    ? 'Elk vakje heeft één klasse. De boom is klaar.'
    : opLengte
    ? 'Sleep het handvat, of klik op een blad om verder te bouwen.'
    : !isBlad(gekozen)
      ? 'Dit vakje is al gesplitst. Klik op een blad om verder te bouwen.'
      : isZuiver
        ? 'Dit vakje heeft één klasse. Hier stopt de boom.'
        : teDiep
          ? 'Dit vakje staat op de onderste rij. Dieper gaat de boom niet.'
          : budgetOver === 0
            ? 'Je condities zijn op. Haal er een weg om verder te bouwen.'
            : 'Kies een kenmerk voor dit vakje.'

  return (
    <div className="relative h-full w-full">
      {/* Geen astekst van Canvas: de plaats van een vakje is hier opmaak en
          geen waarde. Getallen langs de rand zouden zeggen dat de hoogte van
          een vakje iets betekent. De lengte heeft wel haar eigen as op het
          bord, met haar eigen getallen erbij. */}
      <Canvas defaultView={VENSTER} axes={false}>
        {(s) => (
          <Bord
            s={s}
            kaders={kaders}
            gekozenKader={gekozenKader}
            pad={pad}
            drempel={handvat}
            stops={stops}
            regel={asRegel}
            onKies={kies}
            onDrempel={zetDrempel}
            onStap={stapDrempel}
          />
        )}
      </Canvas>

      {/* DE EERSTE ALINEA IS HET DOEL. Brief klapt onder 1280 px alles na de
          eerste alinea in, dus dit is de enige tekst die een leerling op een
          beamer zeker leest - en wie via een slidelink binnenkomt, ziet de
          portaalpagina nooit. */}
      <Brief eyebrow="mAIstros 2 - les 5" title="Bouw de boom">
        <p>
          Een conditie splitst een vakje in twee. De boom herhaalt dat tot elk vakje één klasse
          bevat.
        </p>
        <p>
          Bovenaan zitten alle {getal(VOORBEELDEN.length)} voorbeelden door elkaar. Klik op een
          blad en kies een kenmerk.
        </p>
      </Brief>

      {/* Het paneel staat er van de eerste tel af en verandert nooit van
          breedte: Canvas reserveert die breedte als inzet, dus een paneel dat
          later opduikt zou het bord herkaderen (gemeten: 1,45x op 1024 px).

          GEMETEN, EN DAAROM RUILT DIT PANEEL VAN INHOUD. Op 900x700 is het
          paneel 508 px hoog. De vergelijking met de computerboom is een tabel
          plus twee blokken export_text plus de codering, samen ruim 300 px: die
          past daar niet onder de knoppen. Ze komt dus IN de plaats van de
          knoppen - zelfde paneel, zelfde breedte, dus het bord blijft staan
          waar het staat. De teller blijft wel boven, want die hoort naast de
          vier getallen van de computer gelezen te worden. */}
      <Panel className="pointer-events-auto absolute bottom-4 left-4 z-10 flex max-h-[calc(100%-12rem)] w-[16rem] flex-col px-4 py-3.5 xl:max-h-[calc(100%-15rem)] xl:w-[21rem]">
        <div className="shrink-0">
          <div className="min-h-[4.7rem]">
            {/* DE TELLER DIE BEWEEGT. Waarom niet de fout: zie `aantalKlaar` in
                src/lib/boom.ts - drie van de vier eerste condities laten de fout
                op 8 staan, en een leerling alleen leest dat als een misser. */}
            <Vaststelling
              label="Klaar"
              value={klaar}
              outOf={{ total: VOORBEELDEN.length, noun: 'voorbeelden' }}
              detail="Een voorbeeld is klaar als zijn vakje één klasse heeft."
              color={NAVY}
            />
          </div>

          {/* `whitespace-nowrap` per stukje, en niet één regel: op 16 rem brak
              "condities 1 van 3" achter het woord "van" af, zodat er een losse
              3 op de volgende regel stond. Nu wijkt het hele stukje uit. */}
          <div className="mt-1 flex flex-wrap gap-x-3 text-[13px] tabular-nums text-ink/80">
            <span className="whitespace-nowrap">
              condities {getal(condities)} van {getal(BUDGET)}
            </span>
            <span className="whitespace-nowrap">bladeren {getal(bladeren)}</span>
            <span className="whitespace-nowrap">diepte {getal(diepte)}</span>
          </div>

          <Divider />
        </div>

        {!computerOpen && (
          <div className="min-h-0 overflow-y-auto">
            {/* Geen kopje boven deze vier knoppen: ze noemen zelf de vier
                kenmerken, en de regel eronder zegt wat je ermee doet. Eén klik
                zet de conditie en splitst het gekozen vakje meteen. */}
            <div className="flex flex-wrap gap-1.5">
              {KENMERKEN.map((naam, i) => (
                <Btn
                  key={naam}
                  variant="ghost"
                  disabled={!magSplitsen || !mogelijk[i]}
                  onClick={() => splitsMet(i as KenmerkNr)}
                >
                  {naam}
                </Btn>
              ))}
            </div>

            <div className="mt-2 text-[13.5px] leading-snug text-ink">{stand}</div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              <Btn variant="ghost" disabled={terug.length === 0} onClick={stapTerug}>
                Laatste conditie weg
              </Btn>
            </div>

            <div className="my-2 h-px bg-black/[0.07]" />

            <Btn variant="ghost" full onClick={() => setComputerOpen(true)}>
              De computer
            </Btn>

            {/* Waarom een kenmerkknop soms uit staat. Als vaste regel en niet als
                melding bij de knoppen: een zin die komt en gaat, verschuift alles
                eronder.

                DIT IS HET LAATSTE BLOK IN DIT PANEEL, en dat is gemeten. Hier
                stond ook een Note van drie alinea's over hoe de computer zoekt.
                Daarmee toonde het scrollvak op 1024x768 390 van 454 px: 64 px
                stond onder de rand, waaronder deze regel. Die Note is verhuisd
                naar het scherm van de computer, waar de rest over die boom ook
                staat - proza over de computer hoort daar, niet naast de knoppen
                waarmee de leerling zijn eigen boom bouwt. Nu is de inhoud 209 px
                en scrollt er niets, ook niet op 900x700. */}
            <p className="mt-2 text-[12.5px] leading-snug text-muted">
              Een kenmerk staat uit als elk voorbeeld in het vakje daar dezelfde waarde heeft.
            </p>
          </div>
        )}

        {/* DE BRUG NAAR HET NOTEBOOK, achter één knop. Hier staat de notatie die
            de les zelf afdrukt (2132149) en waar ze op 2224341 "Snap je wat hier
            staat?" over vraagt: export_text, met de codering van de vier
            kenmerken ernaast. Niet op het bord, want daar zou een leerling ze
            moeten decoderen voor hij een boom kan lezen. Hier is ze het antwoord
            op die vraag, naast dezelfde boom in woorden. */}
        {computerOpen && (
          <>
            <div className="shrink-0">
              <Btn variant="ghost" full onClick={() => setComputerOpen(false)}>
                Terug naar de knoppen
              </Btn>
            </div>

            <div className="mt-2 min-h-0 space-y-2 overflow-y-auto">
              {/* GEMETEN OP 900x700, waar dit paneel 16 rem breed is en er 224 px
                  binnen de rand overblijft. Met kapitalen en `tracking` liepen
                  de vier kopjes samen tot "COND.BLAD.DIEP.KLAA" en viel de
                  laatste letter buiten het paneel. Kleine letters zonder
                  tracking halen dezelfde vier kopjes in 110 px, en dan past
                  "de computer" er ongebroken naast. */}
              <table className="w-full border-collapse text-[13px] tabular-nums">
                <thead>
                  <tr className="text-right text-[11.5px] font-semibold text-ink/70">
                    <th />
                    <th className="pl-2">cond.</th>
                    <th className="pl-2">blad.</th>
                    <th className="pl-2">diep.</th>
                    <th className="pl-2">klaar</th>
                  </tr>
                </thead>
                <tbody className="text-right text-ink">
                  <tr>
                    <td className="whitespace-nowrap text-left">jouw boom</td>
                    <td className="pl-2">{getal(condities)}</td>
                    <td className="pl-2">{getal(bladeren)}</td>
                    <td className="pl-2">{getal(diepte)}</td>
                    <td className="pl-2">{getal(klaar)}</td>
                  </tr>
                  <tr>
                    <td className="whitespace-nowrap text-left">de computer</td>
                    <td className="pl-2">{getal(cartGetallen.condities)}</td>
                    <td className="pl-2">{getal(cartGetallen.bladeren)}</td>
                    <td className="pl-2">{getal(cartGetallen.diepte)}</td>
                    <td className="pl-2">{getal(cartGetallen.klaar)}</td>
                  </tr>
                </tbody>
              </table>

              {computerKeuze && (
                <p className="text-[13px] leading-snug text-ink/80">
                  In het gekozen vakje zou de computer {conditieTekst(computerKeuze.conditie)}{' '}
                  kiezen.
                  {computerKeuze.evenGoed > 1 && (
                    <>
                      {' '}
                      Hier zijn {getal(computerKeuze.evenGoed)} condities even goed. Dan kiest
                      sklearn er willekeurig één.
                    </>
                  )}
                </p>
              )}

              {/* Nooit dat de uitkomst van de computer de beste boom is: gemeten
                  is hij op deze data met drie condities te verslaan. Wel wat hij
                  DOET, want dat is het mechanisme. */}
              <Note>
                <p>De computer probeert alle condities op alle kenmerken.</p>
                <p className="mt-1.5">
                  Hij kiest de conditie die de twee vakjes het meest uit één klasse maakt.
                </p>
                <p className="mt-1.5">
                  Hier heeft hij er {getal(cartGetallen.condities)} nodig. Jij mag er{' '}
                  {getal(BUDGET)} zetten.
                </p>
              </Note>

              {/* Eén zin die de brug benoemt. Zonder haar staan er twee
                  schrijfwijzen van dezelfde conditie op één scherm - "< 53,0 cm"
                  op het bord en `Lengte <= 53.04` hieronder - en moet een
                  leerling zelf raden dat het hetzelfde is. */}
              <p className="text-[13px] leading-snug text-ink/80">
                Hieronder staat dezelfde boom zoals Python hem afdrukt.
              </p>

              {/* DE CODERING STAAT PAL BOVEN DE TWEE CODEBLOKKEN, want ze is de
                  decoder ervan: zonder "0 blauw, 1 oranje" is `Kleur <= 0.50`
                  onleesbaar. Op het bord hoort ze niet - daar staan de woorden
                  zelf in de vakjes. Gemeten: dit scrollvak is 278 px hoog op
                  900x700 en de inhoud 999 px, dus wat je nodig hebt om het
                  volgende blok te lezen, moet ervoor staan en niet erna. */}
              <ul className="space-y-0.5">
                {KENMERKEN.map((naam, i) => (
                  <li key={naam} className="flex gap-2 text-[13px] text-ink/80">
                    <span className="w-[4.6rem] shrink-0 font-semibold">{naam}</span>
                    <span className="text-muted">{CODERING[i]}</span>
                  </li>
                ))}
              </ul>

              <div>
                <div className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-ink/75">
                  jouw boom
                </div>
                <pre className="mt-0.5 overflow-x-auto whitespace-pre rounded-lg bg-black/[0.03] px-2 py-1.5 font-mono text-[11px] leading-relaxed text-ink">
                  {exportText(boom).join('\n')}
                </pre>
              </div>

              <div>
                <div className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-ink/75">
                  de boom van de computer
                </div>
                <pre className="mt-0.5 overflow-x-auto whitespace-pre rounded-lg bg-black/[0.03] px-2 py-1.5 font-mono text-[11px] leading-relaxed text-ink">
                  {exportText(cart).join('\n')}
                </pre>
              </div>

              {/* Zonder deze regel zou het bord een tekst tonen die een notebook
                  niet hoeft af te drukken: de les geeft geen random_state mee, en
                  bij een gelijkspel kiest sklearn willekeurig. De vier getallen
                  hierboven zijn wel stabiel - over 300 runs altijd dezelfde. */}
              {cartGetallen.gelijkspel > 0 && (
                <p className="text-[13px] leading-snug text-ink/80">
                  Op {getal(cartGetallen.gelijkspel)}{' '}
                  {meervoud(cartGetallen.gelijkspel, 'vakje', 'vakjes')} zijn meerdere condities
                  even goed. Jouw notebook kan daar een ander kenmerk kiezen.
                </p>
              )}

              <div className="text-[11.5px] leading-relaxed text-muted">
                In je notebook: <PyChip>DecisionTreeClassifier()</PyChip> en{' '}
                <PyChip>export_text(clf)</PyChip>
              </div>
            </div>
          </>
        )}
      </Panel>
    </div>
  )
}
