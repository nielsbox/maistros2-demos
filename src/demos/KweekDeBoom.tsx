import { useMemo, useRef, useState } from 'react'
import Canvas, { type Scales, type View } from '../components/Canvas'
import { Brief, Btn, Divider, Note, Panel, PyChip } from '../components/Overlay'
import Vaststelling, { getal, meervoud } from '../components/Vaststelling'
import {
  ALLE_IDS,
  BUDGET,
  KENMERKEN,
  KLASSEN,
  LENGTE,
  LENGTE_AS,
  MAX_DIEPTE,
  VOORBEELDEN,
  aantalBladeren,
  aantalCondities,
  besteConditie,
  cartBoom,
  conditieTekst,
  diepteVan,
  drempels,
  exportText,
  foutVanBoom,
  gelijkspelVakjes,
  grootste,
  isBlad,
  maakWortel,
  splitsIds,
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
 * EEN DOEL: een conditie splitst een groep in twee, en de boom splitst
 * door tot elke groep uit één klasse bestaat. Dit bord gaat dus over hoe
 * het ALGORITME te werk gaat, niet over hoe een getrainde boom zich
 * gedraagt. Dat onderscheid is de reden dat het vorige bord van deze les
 * afgekeurd is: daar mocht je aan de uitvoer van een klaar model prutsen.
 *
 * De toets die dit bord moet halen: kan een leerling erna in zijn eigen
 * woorden zeggen HOE de boom aan zijn antwoord komt? Wat daar niet aan
 * meehelpt, staat er niet op.
 *
 * WAAROM DE BESTANDSNAAM EN DE TITEL VERSCHILLEN. Het bord heet "Bouw de
 * boom", want dat is wat de leerling doet: hij zet condities. De
 * bestandsnaam is ouder dan die titel. Een leerling leest de route en de
 * titel, nooit de bestandsnaam - dezelfde afspraak als bij les 4, waar
 * VakjePerVakje.tsx het bord "Pixel per pixel" tekent.
 *
 * DE WOORDEN KOMEN VAN DE LES ZELF, niet van mij:
 *   vakje, conditie, samples, value, class   slide 2224342 en 2224364
 *   waar / vals (de twee pijlen)             slide 2224342, letterlijk
 *   bladeren, diepte                         slide 2224243
 *   voorbeeld                                33 slides van deze les
 *   Kleur, Materiaal, Lengte, Soort          slide 2132210 en 2132327
 * Twee woordbotsingen zijn met opzet zo beslecht, en ze horen in de
 * woordenlijst van het project:
 *   - `Soort` is hier een KENMERK (haai 0.0 / robot 1.0). Wat de boom
 *     voorspelt heet daarom `klasse`, ook een woord van de les zelf ("de
 *     klasse die bij class staat", 2224342), en nooit `soort`.
 *   - de woordenlijst zegt `rij` voor één regel data, maar les 5 genereert
 *     wezens en noemt ze `voorbeelden`, en een vakje drukt af hoeveel
 *     voorbeelden erin getest zijn. Op dit bord dus `voorbeeld`.
 *
 * ALLE GETALLEN KOMEN UIT DE TOESTAND. Er staat geen enkel getal in de
 * copy: de 8 fout bij de start, de vier getallen van jouw boom en de vier
 * van de computerboom worden bij elke tekening opnieuw geteld. Waar die
 * getallen op gemeten zijn, staat in src/lib/boom.ts.
 *
 * PYTHON WORDT GECITEERD, NOOIT VERTAALD. Een drempel staat altijd in een
 * conditie, en dus altijd zoals Python haar afdrukt: `Lengte <= 53.04`, met
 * een punt. Elk getal dat het bord in zijn EIGEN woorden zegt (fout,
 * condities, bladeren, diepte, samples) is een heel getal en gaat door
 * `getal()`. Zo staat hetzelfde getal nergens twee keer anders
 * opgeschreven, en is de prent op het bord karakter voor karakter de prent
 * uit het notebook.
 * ------------------------------------------------------------------ */

/* --------------------------- de meetkunde --------------------------- *
 * Alles in bordpixels, en de hele tekening wordt als ÉÉN groep geschaald.
 *
 * Dat is de uitweg uit de val waar de vorige borden in liepen: schaal je
 * alleen de posities mee met de zoom en de tekst niet, dan schuiven de
 * vakjes bij uitzoomen over elkaar terwijl 13 px 13 px blijft. Nu schaalt
 * alles samen, dus overlappen kan niet.
 *
 * Het venster is de MAXIMALE boom, van de eerste tel af: vier vakjes breed
 * en vier rijen diep, met de lengte-as eronder. Zo verandert de schaal niet
 * terwijl de leerling bouwt. Een boom die bij elke splitsing zijn eigen
 * schaal verzet, herkadert het bord midden in een beweging.
 *
 * De breedte is GEMETEN en niet gekozen: vier vakjes van 124 px met 8 px
 * ertussen is 520 px, en op een beamer van 900 px laat Canvas naast de twee
 * linkerpanelen 538 px vrij (ins.left 288, rail 48, pad.right 26). Eén px
 * ruimer en het vierde blad valt van het beeld op de smalste beamer. Wie
 * aan VAK_W, GAT of de paneelbreedte raakt, maakt die som opnieuw.
 *
 * De hoogte volgt dezelfde som: bij 900x700 laat Canvas 626 px vrij en bij
 * 1024x768 694 px, dus het venster mag niet hoger zijn dan ongeveer 600 px
 * of de tekst zakt onder de 13 px.                                       */

const VAK_W = 124
const GAT = 8
const PITCH = VAK_W + GAT
/** Vier bladeren naast elkaar. Dit is de cap, zie hierboven. */
const BOXW = 4 * PITCH - GAT
/** Ruimte boven een rij voor het woord "gekozen", dat boven een vakje hangt. */
const TAB_H = 16
/** Hoogte van een rij: het vakje plus de ruimte voor de twee pijlen. */
const RIJ_H = 124
const VAK_H_SPLIT = 75
const VAK_H_BLAD = 104

/* De lengte-as staat BOVEN de boom, en dat is met opzet.
 *
 * Het venster is even hoog als de diepste boom die je kan bouwen, dus bij de
 * start staat er onder de wortel veel lege ruimte. Stond de as onderaan, dan
 * lag die leegte tussen de twee dingen die de leerling nodig heeft en las het
 * bord als twee losse helften - op 1024x768 zat er 400 px niets tussen. Nu
 * staan de as en het gekozen vakje bij de start naast elkaar, en groeit de
 * boom de vrije ruimte in. */
const AS_Y = 57
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
/** Een blad heeft twee regels extra voor zijn klasse. */
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
 * Elke klasse heeft een eigen VORM en een eigen kleur, en haar naam staat
 * er altijd bij. Drie dragers, dus nooit kleur alleen.
 *
 * Geen groen voor de derde klasse: groen tegen het gebrande oranje van FOUT
 * zakt onder protanopie naar dE 4,0. Onbekend wezen wordt daarom een OPEN
 * ruit in de huisnavy - een andere vorm en een andere vulling, geen derde
 * tint. Dat het oranje op dit bord de klasse Albert betekent en niet
 * "misser", is een keuze voor dit bord: er staat hier geen enkele misser als
 * merk op het bord, alleen als geteld getal in het paneel.                */

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

/** Hetzelfde merk in het paneel, waar het naast zijn naam staat. */
function MerkHTML({ klasse }: { klasse: Klasse }) {
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" aria-hidden className="shrink-0">
      <Merk klasse={klasse} cx={7} cy={7} maat={4.5} />
    </svg>
  )
}

/**
 * De strip in een vakje: `value` als beeld. Drie stukken naar rato van de
 * drie getallen, altijd in dezelfde volgorde als `value` zelf. Eén vol stuk
 * betekent dus één klasse, gestreept betekent gemengd.
 *
 * Dit is de plaats waar op de prent van de les gini zou staan - en de les
 * heeft gini er zelf uit gehaald (`impurity=False` in beide plot_tree-
 * aanroepen). Er staat dus geen score in een vakje, alleen de verdeling.
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

/** `value = [4, 4, 12]`, letterlijk zoals een vakje het afdrukt. */
const valueTekst = (ids: readonly number[]) => `value = [${tel(ids).join(', ')}]`

/**
 * Een klassenaam die in een vakje past, over maximaal twee regels.
 *
 * "Onbekend wezen" is 14 tekens en de binnenkant van een vakje is 102 px
 * breed; op één regel loopt die naam tegen de rand. Afkorten mag niet - een
 * klasse houdt haar naam - dus breekt hij op de spatie.
 */
function inRegels(naam: string, maxTekens = 12): string[] {
  const regels: string[] = []
  let huidig = ''
  for (const w of naam.split(' ')) {
    const kandidaat = huidig ? `${huidig} ${w}` : w
    if (kandidaat.length > maxTekens && huidig) {
      regels.push(huidig)
      huidig = w
    } else {
      huidig = kandidaat
    }
  }
  if (huidig) regels.push(huidig)
  return regels.slice(0, 2)
}

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

  /* Klikken is geen slepen. Waar de leerling neerdrukte wordt hier onthouden
     en in `onClick` vergeleken: verschoof hij meer dan een paar px, dan was
     het een pan van het bord en geen keuze. De tweede klik van een
     dubbelklik wordt ook genegeerd. Pointerdown wordt NIET tegengehouden,
     anders kan je niet meer pannen zodra je op een vakje begint. */
  const neer = useRef<{ x: number; y: number } | null>(null)

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`vakje met ${vakje.ids.length} voorbeelden, klasse ${klasse}`}
      style={{ cursor: 'pointer' }}
      className="outline-none"
      onPointerDown={(e) => {
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
          klasse, sterker als de groep zuiverder is. Ze zegt niets wat er niet
          ook in cijfers staat - de strip en `value` doen dat werk. */}
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

      {vakje.conditie && (
        <Tekst x={x + 8} y={y + 20}>
          {conditieTekst(vakje.conditie)}
        </Tekst>
      )}
      {blad && (
        <Tekst x={x + VAK_W - 8} y={y + 20} kleur={MUTED} anker="end">
          blad
        </Tekst>
      )}

      <Tekst x={x + 8} y={y + 37} dik={600}>
        {`samples = ${vakje.ids.length}`}
      </Tekst>
      <Tekst x={x + 8} y={y + 54} dik={600}>
        {valueTekst(vakje.ids)}
      </Tekst>

      <Strip ids={vakje.ids} x={x + 8} y={y + 60} w={VAK_W - 16} h={9} />

      {/* Een blad draagt zijn klasse, want dat is het antwoord van de boom.
          De naam mag over twee regels, en die plaats wordt in elk blad
          gehouden, zodat alle bladeren even hoog blijven. */}
      {blad && (
        <>
          <Merk klasse={klasse} cx={x + 14} cy={y + 82} />
          {inRegels(klasse).map((regel, i) => (
            <Tekst key={regel} x={x + 25} y={y + 87 + i * 15} maat={13.5}>
              {regel}
            </Tekst>
          ))}
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

/* ------------------------- het voorbeeldvakje ----------------------- *
 * Wat je zou krijgen: de conditie, en de twee groepen met hun samples en
 * hun value. Het staat op de plaats waar de twee echte vakjes komen, en daar
 * kan het niets overdekken: je splitst alleen een blad, en onder een blad
 * hangt niets.
 *
 * Twee toestanden, op dezelfde plaats, elk met hun eigen woord erboven: jouw
 * conditie, of die van de computer. Dat ze elkaar afwisselen op één plek is
 * met opzet - zo lees je het verschil af zonder je ogen te verplaatsen.
 * Naast elkaar kon niet: twee van deze vakjes zijn 248 px en een kolom is
 * 124 px breed, dus het tweede zou over de buurkolom vallen.               */

const VOORB_H = 100

function VoorbeeldVakje({
  kader,
  conditie,
  kleur,
  woord,
}: {
  kader: Kader
  conditie: Conditie
  kleur: string
  woord: string
}) {
  const { waar, vals } = splitsIds(kader.vakje.ids, conditie)
  const x = kader.x
  const y = rijTop(kader.diepte + 1)
  return (
    <g pointerEvents="none">
      <Tekst x={x + 2} y={y - 6} kleur={kleur}>
        {woord}
      </Tekst>
      <rect
        x={x}
        y={y}
        width={VAK_W}
        height={VOORB_H}
        rx={8}
        fill="#fff"
        fillOpacity={0.92}
        stroke={kleur}
        strokeWidth={2}
        strokeDasharray="5 4"
      />
      <Tekst x={x + 8} y={y + 20} kleur={kleur}>
        {conditieTekst(conditie)}
      </Tekst>

      {/* Alleen `value`, en geen `samples` erbij. Gemeten: "waar" naast
          "samples = 10" is 107 px en de binnenkant van een vakje is 102 px
          breed, dus die twee liepen over elkaar. Het is ook geen verlies: de
          les zegt zelf dat samples de som van de drie getallen uit value is
          (slide 2224342), en in de echte vakjes eronder staan beide. */}
      <Tekst x={x + 8} y={y + 40}>
        waar
      </Tekst>
      <Tekst x={x + 8} y={y + 56} dik={600}>
        {valueTekst(waar)}
      </Tekst>

      <Tekst x={x + 8} y={y + 77}>
        vals
      </Tekst>
      <Tekst x={x + 8} y={y + 93} dik={600}>
        {valueTekst(vals)}
      </Tekst>
    </g>
  )
}

/* ---------------------------- de lengte-as -------------------------- *
 * De lengtes van de gekozen groep op één lijn, elk met het merk van zijn
 * klasse, en het handvat ertussen. Zo zie je waarom een drempel de groep
 * scheidt: links van het handvat staan andere merken dan rechts.
 *
 * De band staat er ALTIJD, ook als er nog geen kenmerk gekozen is. Ze zegt
 * dan wat je moet doen. Een as die pas na een klik opduikt, zou het bord
 * opnieuw kaderen terwijl de leerling ernaar kijkt.
 *
 * Het handvat snapt naar de middens tussen twee opeenvolgende lengtes in de
 * gekozen groep - in de wortel zijn dat 19 stops. Dat zijn exact de drempels
 * die een boom overweegt, dus de waarde waar de leerling op uitkomt, is
 * dezelfde soort waarde als in zijn notebook.                              */

function LengteAs({
  ids,
  drempel,
  actief,
  stops,
  onSleep,
  onStap,
}: {
  ids: readonly number[]
  drempel: number | null
  actief: boolean
  stops: number[]
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
          <Tekst x={asX(t)} y={AS_Y + 22} maat={12.5} dik={600} kleur={MUTED} anker="middle">
            {String(t)}
          </Tekst>
        </g>
      ))}
      <Tekst x={AS_X1} y={AS_Y + 22} maat={12.5} dik={600} kleur={MUTED} anker="end">
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

      {/* Eén regel, altijd op dezelfde plaats en altijd links: of ze zegt wat
          je moet doen, of ze zegt welke conditie er nu staat. Ze staat NIET
          onder het handvat gecentreerd - dan zou ze bij een drempel aan de
          linkerkant over de astekst schuiven. */}
      {!actief && (
        <Tekst x={AS_X0} y={AS_Y + 42} kleur={MUTED}>
          Kies Lengte om een drempel te slepen.
        </Tekst>
      )}

      {actief && drempel !== null && (
        <>
          {/* Naast slepen mag je ook ergens op de as tikken: het handvat gaat
              dan naar de dichtste stop. Dat is niet alleen vriendelijker op een
              aanraakscherm, het dekt ook het gebaar van iemand die indrukt en
              elders lost zonder ertussen te bewegen. Klikken is geen slepen,
              dus een gebaar dat verschoof wordt genegeerd en pant het bord. */}
          <rect
            x={AS_X0}
            y={AS_Y - 42}
            width={AS_X1 - AS_X0}
            height={58}
            fill="transparent"
            style={{ cursor: 'pointer' }}
            onPointerDown={(e) => {
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
          <Tekst x={AS_X0} y={AS_Y + 42} kleur={DERDE_INK}>
            {conditieTekst({ kenmerk: LENGTE, drempel })}
          </Tekst>
          <g
            role="slider"
            tabIndex={0}
            aria-label="sleep dit handvat om de drempel te kiezen"
            aria-valuetext={conditieTekst({ kenmerk: LENGTE, drempel })}
            style={{ cursor: 'ew-resize' }}
            className="outline-none"
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
  drempel: number | null
  lengteActief: boolean
  stops: number[]
  voorbeeld: { conditie: Conditie; kleur: string; woord: string } | null
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
  lengteActief,
  stops,
  voorbeeld,
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
    return (
      LENGTE_AS.van + ((lokaal - AS_X0) / (AS_X1 - AS_X0)) * (LENGTE_AS.tot - LENGTE_AS.van)
    )
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

      {voorbeeld && (
        <VoorbeeldVakje
          kader={gekozenKader}
          conditie={voorbeeld.conditie}
          kleur={voorbeeld.kleur}
          woord={voorbeeld.woord}
        />
      )}

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
        actief={lengteActief}
        stops={stops}
        onSleep={(clientX) => onDrempel(naarCm(clientX))}
        onStap={onStap}
      />
    </g>
  )
}

/* ------------------------------- het bord --------------------------- */

export default function KweekDeBoom() {
  const [boom, setBoom] = useState<Vakje>(maakWortel)
  /** Elke splitsing legt de vorige boom hierop, zodat één stap terug kan. Met
   *  een budget van drie condities zou één misstap anders een herstart zijn. */
  const [terug, setTerug] = useState<{ boom: Vakje; pad: Pad }[]>([])
  const [pad, setPad] = useState<Pad>([])
  const [kenmerk, setKenmerk] = useState<KenmerkNr | null>(null)
  const [drempel, setDrempel] = useState<number | null>(null)
  const [schaduw, setSchaduw] = useState(false)
  const [computerOpen, setComputerOpen] = useState(false)

  const kaders = useMemo(() => legUit(boom), [boom])
  const gekozenKader = kaders.find((kader) => zelfdePad(kader.pad, pad)) ?? kaders[0]
  const gekozen = gekozenKader.vakje

  const condities = aantalCondities(boom)
  const fout = foutVanBoom(boom)
  const bladeren = aantalBladeren(boom)
  const diepte = diepteVan(boom)

  const stops = useMemo(() => drempels(gekozen.ids, LENGTE), [gekozen.ids])
  const computerKeuze = useMemo(() => besteConditie(gekozen.ids), [gekozen.ids])

  /* De boom van de computer en zijn vier getallen. Eén keer gerekend: hij
     verandert nooit, want de data verandert nooit. */
  const cart = useMemo(() => cartBoom(ALLE_IDS), [])
  const cartGetallen = useMemo(
    () => ({
      condities: aantalCondities(cart),
      bladeren: aantalBladeren(cart),
      diepte: diepteVan(cart),
      fout: foutVanBoom(cart),
      gelijkspel: gelijkspelVakjes(cart),
    }),
    [cart],
  )

  const budgetOver = BUDGET - condities
  const alGesplitst = !isBlad(gekozen)
  const isZuiver = zuiver(gekozen.ids)
  const teDiep = pad.length >= MAX_DIEPTE
  const magSplitsen = !alGesplitst && !isZuiver && !teDiep && budgetOver > 0

  const conditie: Conditie | null =
    kenmerk !== null && drempel !== null ? { kenmerk, drempel } : null

  /** Welke kenmerken je in deze groep nog kan gebruiken. Een kenmerk waarop
   *  alle voorbeelden dezelfde waarde hebben, heeft geen drempel meer - dat is
   *  geen storing maar iets om te tonen: een kenmerk kan opgebruikt zijn. */
  const mogelijk = useMemo(
    () => ([0, 1, 2, 3] as KenmerkNr[]).map((k) => drempels(gekozen.ids, k).length > 0),
    [gekozen.ids],
  )

  const kies = (nieuwPad: Pad) => {
    setPad(nieuwPad)
    setKenmerk(null)
    setDrempel(null)
    setSchaduw(false)
  }

  const kiesKenmerk = (k: KenmerkNr) => {
    const opties = drempels(gekozen.ids, k)
    if (opties.length === 0) return
    setKenmerk(k)
    setSchaduw(false)
    /* Kleur, Materiaal en Soort hebben maar één mogelijke drempel: 0.50. Eén
       klik en de conditie staat er. Dat is geen vereenvoudiging maar de data
       van de les zelf (slide 2132210). Bij Lengte begint het handvat in het
       midden van de stops, zodat er langs beide kanten te slepen valt. */
    setDrempel(opties[Math.floor((opties.length - 1) / 2)])
  }

  const stapDrempel = (richting: -1 | 1) => {
    if (drempel === null || stops.length === 0) return
    const i = stops.indexOf(drempel)
    const volgende = stops[Math.max(0, Math.min(stops.length - 1, i + richting))]
    if (volgende !== undefined) setDrempel(volgende)
  }

  /** Naar de dichtste stop, want dat zijn de enige drempels die een boom
   *  overweegt. */
  const zetDrempel = (cm: number) => {
    if (stops.length === 0) return
    let beste = stops[0]
    for (const stop of stops) if (Math.abs(stop - cm) < Math.abs(beste - cm)) beste = stop
    setDrempel(beste)
  }

  const splits = () => {
    if (!conditie || !magSplitsen) return
    const nieuwVakje = splitsVakje(gekozen, conditie)
    setTerug([...terug, { boom, pad }])
    setBoom(vervangVakje(boom, pad, nieuwVakje))
    setKenmerk(null)
    setDrempel(null)
    setSchaduw(false)
    /* Verder waar er nog werk is: het kind met de meeste fout. Zo staat het
       gekozen vakje na een splitsing nooit op een vakje waar niets meer kan,
       en de leerling ziet het woord "gekozen" mee verhuizen. */
    const naar: Pad =
      foutVanBoom(nieuwVakje.vals!) > foutVanBoom(nieuwVakje.waar!)
        ? [...pad, 'vals']
        : [...pad, 'waar']
    setPad(naar)
  }

  const stapTerug = () => {
    const laatste = terug[terug.length - 1]
    if (!laatste) return
    setTerug(terug.slice(0, -1))
    setBoom(laatste.boom)
    setPad(laatste.pad)
    setKenmerk(null)
    setDrempel(null)
    setSchaduw(false)
  }

  const opnieuw = () => {
    setBoom(maakWortel())
    setTerug([])
    setPad([])
    setKenmerk(null)
    setDrempel(null)
    setSchaduw(false)
    setComputerOpen(false)
  }

  /* Wat er onder het gekozen vakje getoond wordt: jouw conditie, of die van
     de computer. Nooit beide, want het is één plaats. */
  const voorbeeld =
    schaduw && computerKeuze && !alGesplitst
      ? { conditie: computerKeuze.conditie, kleur: MODEL, woord: 'de computer kiest' }
      : conditie && magSplitsen
        ? { conditie, kleur: DERDE_INK, woord: 'jouw conditie' }
        : null

  /** Eén regel die zegt wat er met het gekozen vakje kan. Elke toestand heeft
   *  haar eigen zin, want een knop die uitstaat zonder reden leest als een
   *  bord dat stuk is. */
  const stand = alGesplitst
    ? 'Dit vakje is al gesplitst. Kies een blad om verder te bouwen.'
    : isZuiver
      ? 'Deze groep bestaat uit één klasse. Hier stopt de boom.'
      : teDiep
        ? 'Dit vakje staat op de onderste rij. Dieper gaat de boom hier niet.'
        : budgetOver === 0
          ? 'Je condities zijn op. Haal er een weg om verder te bouwen.'
          : conditie
            ? `Jouw conditie: ${conditieTekst(conditie)}`
            : 'Kies een kenmerk voor deze groep.'

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
            drempel={drempel}
            lengteActief={kenmerk === LENGTE}
            stops={stops}
            voorbeeld={voorbeeld}
            onKies={kies}
            onDrempel={zetDrempel}
            onStap={stapDrempel}
          />
        )}
      </Canvas>

      <Brief eyebrow="mAIstros 2 - les 5" title="Bouw de boom">
        {/* De eerste alinea is het doel. Brief klapt op een beamer alles
            daarna in, dus dit is de enige zin die een leerling zeker leest. */}
        <p>
          Een conditie splitst een groep in twee. De boom splitst door tot elke groep uit één
          klasse bestaat.
        </p>
        {/* Eén alinea en niet twee: de Brief staat open vanaf 1280 px, en elke
            alinea die hij daar toont, duwt het knoppenpaneel naar onder. Op
            1280x720 - een echte beamerstand - viel de tweede computerknop
            daardoor van het paneel. Gemeten: samen 192 px hoog in plaats van
            230. */}
        <p>
          Kies een vakje, kies een kenmerk, en splits de groep. Met {getal(BUDGET)} condities kun
          je alle {getal(VOORBEELDEN.length)} voorbeelden juist krijgen.
        </p>
      </Brief>

      {/* Het paneel staat er van de eerste tel af en verandert nooit van
          breedte: Canvas reserveert die breedte als inzet, dus een paneel dat
          later opduikt zou het bord herkaderen. De teller en de knoppen staan
          vast; alleen de uitleg onderin scrollt, want een knop onder de rand
          leest als een knop die er niet is.

          GEMETEN, EN DAAROM RUILT DIT PANEEL VAN INHOUD. Op 900x700 is het
          paneel 508 px hoog, houdt het vaste deel er 375 van bezet en blijft er
          122 px over.
          De vergelijking met de computerboom is een tabel plus twee blokken
          export_text, samen ongeveer 250 px: die past daar niet in en las
          onleesbaar. Ze komt dus IN de plaats van de knoppen, niet eronder -
          zelfde paneel, zelfde breedte, dus het bord blijft staan waar het
          staat. De teller blijft wel boven, want die hoort naast de vier
          getallen van de computer gelezen te worden. */}
      <Panel className="pointer-events-auto absolute bottom-4 left-4 z-10 flex max-h-[calc(100%-12rem)] w-[16rem] flex-col px-4 py-3.5 xl:max-h-[calc(100%-15rem)] xl:w-[21rem]">
        <div className="shrink-0">
          <div className="min-h-[4.7rem]">
            <Vaststelling
              label="Fout"
              value={fout}
              outOf={{ total: VOORBEELDEN.length, noun: 'voorbeelden' }}
              detail={`${getal(condities)} van de ${getal(BUDGET)} condities gebruikt.`}
              color={NAVY}
            />
          </div>

          <div className="mt-1 flex gap-3 text-[13px] tabular-nums text-ink/80">
            <span>bladeren {getal(bladeren)}</span>
            <span>diepte {getal(diepte)}</span>
          </div>

          <Divider />
        </div>

        {!computerOpen && (
          <>
            <div className="shrink-0">
              {/* Geen kopje boven deze vier knoppen: ze noemen zelf de vier
                  kenmerken, en de regel eronder zegt wat je ermee doet. Het
                  kopje kostte 21 px die de uitleg onderin nodig heeft. */}
              <div className="flex flex-wrap gap-1.5">
                {KENMERKEN.map((naam, i) => (
                  <Btn
                    key={naam}
                    variant={kenmerk === i ? 'primary' : 'ghost'}
                    disabled={!magSplitsen || !mogelijk[i]}
                    onClick={() => kiesKenmerk(i as KenmerkNr)}
                  >
                    {naam}
                  </Btn>
                ))}
              </div>

              <div className="mt-2 text-[13.5px] leading-snug text-ink">{stand}</div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                <Btn disabled={!conditie || !magSplitsen} onClick={splits}>
                  Splits deze groep
                </Btn>
                <Btn variant="ghost" disabled={terug.length === 0} onClick={stapTerug}>
                  Laatste conditie weg
                </Btn>
                <Btn variant="ghost" disabled={condities === 0} onClick={opnieuw}>
                  Begin opnieuw
                </Btn>
              </div>
            </div>

            {/* Het streepje hoort BIJ de twee knoppen en staat daarom in het
                scrollende deel: in het vaste deel kostte het 21 px die op
                1280x720 net de tweede knop van het paneel duwden. Het is ook
                krapper dan `Divider` (9 px in plaats van 21), en dat is
                gemeten: met die 21 px bleef er 94 px over voor 101 px knoppen,
                dus de tweede knop viel weer onder de rand. */}
            <div className="min-h-0 overflow-y-auto">
              <div className="mb-2 h-px bg-black/[0.07]" />

              {/* De twee computerknoppen staan boven de uitleg en tegen elkaar
                  aan. Gemeten: er blijft 122 px over op 900x700 en 94 px op
                  1280x720, dus zo staan ze allebei volledig binnen bereik en
                  scrollt alleen de tekst. Zetten we ze in het vaste deel, dan valt de tweede
                  van het paneel af; zetten we de uitleg ertussen, dan valt ze
                  onder de rand - beide gemeten. De eerste legt het mechanisme
                  uit, dus die komt eerst. */}
              <div className="flex flex-col gap-1.5">
                <Btn
                  variant="ghost"
                  disabled={alGesplitst || !computerKeuze}
                  onClick={() => setSchaduw(!schaduw)}
                >
                  {schaduw ? 'Verberg die conditie' : 'Wat kiest de computer?'}
                </Btn>
                <Btn variant="ghost" onClick={() => setComputerOpen(true)}>
                  De boom van de computer
                </Btn>
              </div>

              <div className="h-2" />

              {schaduw && computerKeuze && (
                <div className="mb-2 text-[13.5px] leading-snug text-ink">
                  De computer kiest hier {conditieTekst(computerKeuze.conditie)}.
                  {computerKeuze.evenGoed > 1 && (
                    <>
                      {' '}
                      Hier zijn {getal(computerKeuze.evenGoed)} condities even goed. Dan kiest
                      sklearn er willekeurig één.
                    </>
                  )}
                </div>
              )}

              {/* Nooit dat de uitkomst de beste boom is: gemeten is hij op deze
                  data met drie condities te verslaan. Wel wat hij DOET. */}
              <Note>
                <p>De computer probeert alle condities op alle kenmerken.</p>
                <p className="mt-1.5">
                  Hij kiest de conditie die de twee groepen het meest uit één klasse maakt.
                </p>
                <p className="mt-1.5">Hij kijkt één conditie vooruit, niet verder.</p>
              </Note>

              <Divider />

              <ul className="space-y-1">
                {KLASSEN.map((klasse) => (
                  <li key={klasse} className="flex items-center gap-2 text-[13px] text-ink/80">
                    <MerkHTML klasse={klasse} />
                    {klasse}
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-[12.5px] leading-snug text-muted">
                De strip in een vakje staat in de volgorde van value. De as bovenaan toont de
                lengtes van het gekozen vakje.
              </p>
              {/* Waarom een kenmerkknop soms uit staat. Als vaste regel en niet
                  als melding bij de knoppen: een zin die komt en gaat, verschuift
                  alles eronder, en op 1280x720 blijft er maar 5 px over onder de
                  twee computerknoppen. Zo staat de uitleg er altijd en springt
                  er niets. */}
              <p className="mt-1.5 text-[12.5px] leading-snug text-muted">
                Een kenmerk staat uit als elk voorbeeld in de groep daar dezelfde waarde heeft.
                Dan valt er niets te splitsen.
              </p>

              <div className="mt-2 text-[11.5px] leading-relaxed text-muted">
                In je notebook: <PyChip>DecisionTreeClassifier()</PyChip> en{' '}
                <PyChip>export_text(clf)</PyChip>
              </div>
            </div>
          </>
        )}

        {computerOpen && (
          <>
            <div className="shrink-0">
              <Btn variant="ghost" full onClick={() => setComputerOpen(false)}>
                Terug naar de knoppen
              </Btn>
            </div>

            <div className="mt-2 min-h-0 space-y-2 overflow-y-auto">
              <table className="w-full border-collapse text-[13px] tabular-nums">
                <thead>
                  <tr className="text-left text-[11.5px] uppercase tracking-[0.06em] text-ink/70">
                    <th className="font-bold">boom</th>
                    <th className="font-bold">cond.</th>
                    <th className="font-bold">blad.</th>
                    <th className="font-bold">diep.</th>
                    <th className="font-bold">fout</th>
                  </tr>
                </thead>
                <tbody className="text-ink">
                  <tr>
                    <td className="pr-1">jouw boom</td>
                    <td>{getal(condities)}</td>
                    <td>{getal(bladeren)}</td>
                    <td>{getal(diepte)}</td>
                    <td>{getal(fout)}</td>
                  </tr>
                  <tr>
                    <td className="pr-1">de computer</td>
                    <td>{getal(cartGetallen.condities)}</td>
                    <td>{getal(cartGetallen.bladeren)}</td>
                    <td>{getal(cartGetallen.diepte)}</td>
                    <td>{getal(cartGetallen.fout)}</td>
                  </tr>
                </tbody>
              </table>

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

              {/* Zonder deze regel zou het bord een tekst tonen die een
                  notebook niet hoeft af te drukken: de les geeft geen
                  random_state mee, en bij een gelijkspel kiest sklearn
                  willekeurig. De vier getallen hierboven zijn wel stabiel -
                  over 300 runs altijd dezelfde. */}
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
