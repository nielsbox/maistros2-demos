import { useMemo, useState } from 'react'
import Canvas, { DragDot, type Scales } from '../components/Canvas'
import { Brief, Btn, Divider, Panel, PyChip } from '../components/Overlay'
import Vaststelling, { NBSP, getal, meervoud } from '../components/Vaststelling'
import {
  DAGEN,
  MAX_BOMEN,
  TRAIN,
  kaartVanBoom,
  kaartVanBos,
  knopenVan,
  maakBoom,
  stemVan,
  stemming,
  type Boom,
  type Gebied,
  type KaartVak,
  type Knoop,
  type Stap,
  type Vakje,
} from '../lib/bos'
import { DERDE, DERDE_INK, FOUT, MODEL, MUTED, NAVY, RULE } from '../lib/palette'

/* ------------------------------------------------------------------ *
 * mAIstros 2 - les 6 - Het bos stemt.
 *
 * EEN DOEL, en het staat woord voor woord in de les:
 *   2132676  "aan de hand van een willekeurig gekozen stuk van de train set
 *            wordt een boom gemaakt"
 *   2132681  "de winnaar is wie het meeste stemmen krijgt"
 * Het bord laat dus zien HOE een random forest tot zijn antwoord komt, niet hoe
 * goed het is. Na het bord moet een leerling kunnen zeggen: "Elke boom krijgt
 * een willekeurig stuk van de rijen en leert daaruit zijn eigen condities. Voor
 * een nieuwe boeking volgt elke boom zijn condities tot een blad. Dat blad is
 * zijn stem, en de meeste stemmen winnen."
 *
 * WAT ER BEWUST NIET OP STAAT: een accuracy, een vergelijking "bos tegen één
 * boom", een score. Gemeten in src/lib/bos.ts: met bomen die klein genoeg zijn
 * om te tekenen, wint het bos van één boom op alle rijen maar in 64 van 100
 * seeds. Dat is een bewering over gedrag, en ze is niet stevig genoeg om op een
 * bord te zetten. Het mechanisme is wél altijd waar, en dat toont het bord.
 *
 * DE PRENT VAN DE LES IS HET MODEL VOOR DE TEGELS. Op 2132681 staan vijf
 * boompjes van bolletjes, en bij elk boompje wijst een zwarte pijl het blad aan
 * waar het voorbeeld terechtkomt. De tegels rechts zijn precies dat, maar dan
 * met de bomen die dit bord echt maakt, en de pijl verhuist mee als je
 * de nieuwe boeking versleept. "Why dont I see a decision tree?" (Niels, les 5)
 * kan hier dus niet: er staat vanaf de eerste tel een boom.
 *
 * WAT ER OPENT: de 200 rijen, boom 1 al gemaakt (zijn rijen donker, de rest
 * lichter, zijn vakjes als vlak achter de punten), en de nieuwe boeking op een
 * plek waar de bomen het oneens zullen zijn. Eén van de negen bomen staat er,
 * dus niets is af. De volgende tegel is de knop "Maak boom 2".
 *
 * DE STARTPLEK VAN DE NIEUWE BOEKING IS GEKOZEN, en dat staat hier eerlijk: op
 * 235 dagen en een kamerprijs van 100 zegt boom 1 afgezegd en boom 2 niet. Wie
 * boom 2 maakt, ziet dus meteen "gelijk", en dat is de vraag waar 2132676 mee
 * eindigt: "welke boom of bomen moet je dan geloven?". Boom 3 beslist, en
 * daarna staat het bij geen enkel aantal bomen nog gelijk: de stemmen voor
 * afgezegd lopen 1, 1, 2, 3, 3, 4, 5, 6, 7 (nagerekend met deze code). Een
 * eerdere kandidaat, 110 dagen en 110, stond bij ELK even aantal gelijk; dat
 * las als een afgesproken wisselspel en is daarom verworpen. De plek ligt tussen
 * de kruisjes rechts, met 15 rijen binnen 40 dagen en 20 van de prijs, en de
 * leerling kan de boeking overal heen slepen.
 *
 * DE WOORDEN KOMEN VAN DE LES (6 en 5), niet van mij:
 *   boom, bos, stemmen, train set, kenmerk      2132676, 2132681
 *   boeking, afgezegd                           2132708
 *   de twee kolomnamen                          hotelreservaties.csv, letterlijk
 *   vakje, blad, conditie, waar / vals          les 5 (2224342, 2224364)
 *   rij, punt                                   de woordenlijst (C1)
 * "Maak boom 2" en niet "plant": de les zegt zelf "wordt een boom gemaakt".
 * Wat de les NIET heeft en dit bord toch nodig heeft: "dagen" en "kamerprijs"
 * als korte naam van de twee kolommen in een conditie, en "nieuwe boeking" voor
 * het handvat. Die staan ook in het rapport aan Niels.
 * ------------------------------------------------------------------ */

/** Alle bomen die het bord ooit kan tonen. Eén keer gerekend: de data en het
 *  toeval liggen vast, dus boom 4 is op elke beamer dezelfde boom 4. */
const ALLE_BOMEN: readonly Boom[] = Array.from({ length: MAX_BOMEN }, (_, i) => maakBoom(i + 1))

/** Zie het blok hierboven: de plek waar boom 1 en boom 2 het oneens zijn. */
const START = { x: 235, y: 100 }

/** Waar de nieuwe boeking mag komen: waar de rijen zelf liggen (dagen 0 tot 418,
 *  kamerprijs 0 tot 199). GEMETEN: met 440 schoof ze op 900 px onder het paneel
 *  rechts, en met een prijs van 220 viel ze samen met haar naam boven het beeld. */
const GRENS = { x: [0, 420] as [number, number], y: [0, 200] as [number, number] }

/* Wat het bord bij de start toont. De rijen lopen van 0 tot 418 dagen en van 0
 * tot 199 in prijs, maar het venster begint links en onder een stuk VOOR de nul.
 * GEMETEN: met de gewone marge van fitView lagen elf merken van rijen met 0
 * dagen onder de getallen van de y-as (Canvas zet die in het vrije vlak, op 8 px
 * van de rand), en rijen met prijs 0 onder de naam van de x-as. 70 dagen en 30
 * in prijs extra houden beide op elke beamermaat vrij. */
const OPENING = { x0: -70, x1: 445, y0: -30, y1: 212 }

type Keuze = number | 'bos'

/* ------------------------------ merken ------------------------------ *
 * Twee klassen, en elk heeft een eigen VORM en een eigen kleur: een rondje in
 * het blauw voor niet afgezegd, een kruisje in het oranje voor afgezegd. Nooit
 * kleur alleen. Blauw tegen oranje is de as die de kleurenblindheidscheck haalt;
 * rood tegen groen haalt het nooit.                                         */

function Kruisje({ cx, cy, maat, dik = 2.4 }: { cx: number; cy: number; maat: number; dik?: number }) {
  const d = `M ${cx - maat} ${cy - maat} L ${cx + maat} ${cy + maat} M ${cx - maat} ${cy + maat} L ${cx + maat} ${cy - maat}`
  return (
    <>
      <path d={d} stroke="#fff" strokeWidth={dik + 2.2} strokeLinecap="round" />
      <path d={d} stroke={FOUT} strokeWidth={dik} strokeLinecap="round" />
    </>
  )
}

function Rondje({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return <circle cx={cx} cy={cy} r={r} fill={MODEL} stroke="#fff" strokeWidth={1.2} />
}

function Merk({ afgezegd, cx, cy, maat }: { afgezegd: boolean; cx: number; cy: number; maat: number }) {
  return afgezegd ? <Kruisje cx={cx} cy={cy} maat={maat * 0.9} /> : <Rondje cx={cx} cy={cy} r={maat} />
}

/* ------------------------------ het vlak ------------------------------ *
 * Achter de punten: wat de gekozen boom (of het bos) op elke plek zou zeggen.
 * Afgezegd krijgt behalve de oranje tint ook een arcering, zodat het vlak ook
 * zonder kleur te lezen is. Waar het bos gelijk staat, blijft het wit: daar
 * zegt het niets, en dat mag je zien.                                        */

function Vlak({ vakken, s }: { vakken: KaartVak[]; s: Scales }) {
  return (
    <g pointerEvents="none">
      <defs>
        <pattern id="bos-arcering" width={9} height={9} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1={0} y1={0} x2={0} y2={9} stroke={FOUT} strokeWidth={1.4} opacity={0.32} />
        </pattern>
      </defs>
      {vakken.map((v, i) => {
        if (v.uitslag === 'gelijk') return null
        const x = s.sx(v.x0)
        const y = s.sy(v.y1)
        const w = s.sx(v.x1) - x
        const h = s.sy(v.y0) - y
        if (w <= 0 || h <= 0) return null
        return v.uitslag === 'afgezegd' ? (
          <g key={i}>
            <rect x={x} y={y} width={w} height={h} fill={FOUT} fillOpacity={0.1} />
            <rect x={x} y={y} width={w} height={h} fill="url(#bos-arcering)" />
          </g>
        ) : (
          <rect key={i} x={x} y={y} width={w} height={h} fill={MODEL} fillOpacity={0.07} />
        )
      })}
    </g>
  )
}

/* ------------------------------ de tegel ------------------------------ *
 * Eén boom als een boompje van bolletjes, zoals op 2132681. Een vakje met een
 * conditie is een wit bolletje; een blad is het merk van zijn klasse. De weg
 * van de nieuwe boeking is dik, en onder het blad waar ze uitkomt staat de
 * zwarte pijl van de prent. Die pijl IS de stem van de boom.
 *
 * Het boompje zelf heeft geen tekst: een tegel van 100 px kan geen condities
 * dragen. Wat de gekozen boom vraagt, staat in woorden in het paneel links.  */

const TEGEL_W = 100
const TEGEL_H = 76
const RIJ_H = 12.5
const TOP = 7

type Plek = { pad: Stap[]; knoop: Knoop; x: number; y: number }

function legUit(boom: Boom): Plek[] {
  const bladeren = knopenVan(boom.wortel).filter((k) => k.knoop.soort === 'blad').length
  const stap = (TEGEL_W - 14) / bladeren
  const plekken: Plek[] = []
  let kolom = 0
  const plaats = (k: Knoop, pad: Stap[]): number => {
    let x: number
    if (k.soort === 'blad') {
      x = 7 + (kolom + 0.5) * stap
      kolom++
    } else {
      x = (plaats(k.waar, [...pad, 'waar']) + plaats(k.vals, [...pad, 'vals'])) / 2
    }
    plekken.push({ pad, knoop: k, x, y: TOP + pad.length * RIJ_H })
    return x
  }
  plaats(boom.wortel, [])
  return plekken
}

const padSleutel = (p: readonly Stap[]) => p.join('/')
const opPad = (p: readonly Stap[], weg: readonly Stap[]) =>
  p.length <= weg.length && p.every((s, i) => s === weg[i])

function Boompje({ boom, weg }: { boom: Boom; weg: Stap[] }) {
  const plekken = useMemo(() => legUit(boom), [boom])
  const perPad = new Map(plekken.map((p) => [padSleutel(p.pad), p]))
  const eind = perPad.get(padSleutel(weg))
  return (
    /* Vaste hoogte, en niet mee met de breedte: vanaf 1280 px wordt het paneel
       breder, en dan werden vijf rijen tegels GEMETEN 712 px hoog op een beamer
       van 1280x720 - het paneel ging scrollen. Nu is een tegel op elke breedte
       even hoog; het boompje blijft in het midden staan. */
    <svg viewBox={`0 0 ${TEGEL_W} ${TEGEL_H}`} className="block h-[4.5rem] w-full" aria-hidden="true">
      {/* Eerst de takken, dan de bolletjes, zodat geen tak over een merk loopt. */}
      {plekken.map((p) => {
        if (p.knoop.soort === 'blad') return null
        return (['waar', 'vals'] as const).map((kant) => {
          const kind = perPad.get(padSleutel([...p.pad, kant]))
          if (!kind) return null
          const dik = opPad(kind.pad, weg)
          return (
            <line
              key={padSleutel(kind.pad)}
              x1={p.x}
              y1={p.y}
              x2={kind.x}
              y2={kind.y}
              stroke={dik ? DERDE : MUTED}
              strokeWidth={dik ? 2.4 : 1}
              opacity={dik ? 1 : 0.7}
            />
          )
        })
      })}
      {plekken.map((p) =>
        p.knoop.soort === 'vakje' ? (
          <circle
            key={padSleutel(p.pad)}
            cx={p.x}
            cy={p.y}
            r={4.2}
            fill="#fff"
            stroke={opPad(p.pad, weg) ? DERDE : MUTED}
            strokeWidth={opPad(p.pad, weg) ? 1.8 : 1.2}
          />
        ) : (
          <g key={padSleutel(p.pad)}>
            <Merk afgezegd={p.knoop.afgezegd} cx={p.x} cy={p.y} maat={4.9} />
          </g>
        ),
      )}
      {eind && (
        <>
          <circle cx={eind.x} cy={eind.y} r={7.8} fill="none" stroke={DERDE} strokeWidth={1.8} />
          {/* De zwarte pijl van de prent, recht onder het blad. */}
          <path
            d={`M ${eind.x} ${eind.y + 9.5} l 5.5 5.5 h -3 v 4.5 h -5 v -4.5 h -3 Z`}
            fill={NAVY}
          />
        </>
      )}
    </svg>
  )
}

/* ----------------------------- de naam bij het handvat ----------------------------- *
 * "nieuwe boeking", het enige woord op het bord naast de asnamen en de
 * asgetallen. Het stond eerst gecentreerd boven het handvat, zoals DragDot het
 * zet, en dan liep het GEMETEN over het asgetal "200" zodra de leerling de
 * boeking tegen de linkerrand sleepte. Nu kiest het de eerste van vier plekken
 * (boven, rechts, onder, links) die niet op een asgetal of een asnaam valt.
 * De breedte is geschat op 7,6 px per teken (13 px vet); de marge vangt het
 * verschil op.                                                               */

const NAAM = 'nieuwe boeking'
const NAAM_W = NAAM.length * 7.6
const NAAM_H = 14

function HandvatNaam({
  s,
  x,
  y,
  merken,
}: {
  s: Scales
  x: number
  y: number
  /** Waar de merken van de rijen op het scherm staan: de naam kiest liefst een
   *  plek waar ze er geen enkel bedekt. */
  merken: readonly { x: number; y: number }[]
}) {
  const { safe, area } = s
  // Waar Canvas zijn eigen tekst zet: de kolom met y-getallen, de rij met
  // x-getallen, en de twee asnamen rechts. Zie Canvas.tsx.
  const bezet = [
    // naast het vrije vlak liggen de panelen en de zoomknoppen, erboven en
    // eronder valt de naam van het bord
    { x0: -1e4, x1: safe.left, y0: -1e4, y1: 1e4 },
    { x0: safe.right, x1: 1e4, y0: -1e4, y1: 1e4 },
    { x0: -1e4, x1: 1e4, y0: -1e4, y1: 4 },
    { x0: -1e4, x1: 1e4, y0: area.h - 4, y1: 1e4 },
    { x0: safe.left, x1: safe.left + 44, y0: 0, y1: area.h },
    { x0: 0, x1: area.w, y0: safe.bottom - 26, y1: safe.bottom },
    { x0: safe.right - 320, x1: safe.right, y0: safe.bottom - 46, y1: safe.bottom - 26 },
    { x0: safe.right - 170, x1: safe.right, y0: safe.top, y1: safe.top + 22 },
  ]
  // Boven en onder schuift de naam opzij tot ze naast de kolom met y-getallen
  // en voor het paneel rechts blijft. Zonder die schuif was er aan de linkerrand
  // GEEN vrije plek, en dan viel de naam terug op het getal "50".
  const midden = Math.min(Math.max(x, safe.left + 48 + NAAM_W / 2), safe.right - 4 - NAAM_W / 2)
  type Plek = { x: number; y: number; anker: 'middle' | 'start' | 'end' }
  /* Eerst de acht plekken vlak bij het handvat, dan recht erboven en eronder
     een of twee regels verder. GEMETEN (audit 2026-09-30): met alleen de eerste
     acht bedekte de naam OP DE STARTPLEK al 2 merken op 1024x768 en 3 op
     900x700 - een kruisje stond half onder "boeking", in het eerste beeld dat
     een leerling ziet. De verre plekken schuiven alleen OMHOOG of OMLAAG, nooit
     opzij: een naam die opzij wegschoof, kwam achter twee kruisjes te staan en
     las dan als de naam van die kruisjes. */
  const plekken: Plek[] = [
    { x: midden, y: y - 19, anker: 'middle' },
    { x: Math.max(x + 16, safe.left + 48), y: y + 5, anker: 'start' },
    { x: Math.max(x + 8, safe.left + 48), y: y - 17, anker: 'start' },
    { x: x - 8, y: y - 17, anker: 'end' },
    { x: x - 16, y: y + 5, anker: 'end' },
    { x: midden, y: y + 29, anker: 'middle' },
    { x: Math.max(x + 8, safe.left + 48), y: y + 27, anker: 'start' },
    { x: x - 8, y: y + 27, anker: 'end' },
    ...[14, 28, 42].flatMap((v): Plek[] => [
      { x: midden, y: y - 19 - v, anker: 'middle' },
      { x: midden, y: y + 29 + v, anker: 'middle' },
    ]),
  ]
  const vak = (p: Plek) => {
    const x0 = p.anker === 'middle' ? p.x - NAAM_W / 2 : p.anker === 'start' ? p.x : p.x - NAAM_W
    return { x0: x0 - 3, x1: x0 + NAAM_W + 3, y0: p.y - NAAM_H, y1: p.y + 4 }
  }
  /* Een plek op een asgetal of onder een paneel valt af. Van wat overblijft,
     wint de plek die de minste merken bedekt, en bij gelijke stand de eerste in
     de lijst - boven eerst, zoals een leerling het verwacht. GEMETEN op de
     startplek: gecentreerd erboven bedekte de naam 7 merken. */
  const kost = (p: Plek) => {
    const v = vak(p)
    if (bezet.some((b) => v.x0 < b.x1 && v.x1 > b.x0 && v.y0 < b.y1 && v.y1 > b.y0)) return Infinity
    let n = 0
    for (const m of merken) if (m.x > v.x0 - 5 && m.x < v.x1 + 5 && m.y > v.y0 - 5 && m.y < v.y1 + 5) n++
    return n
  }
  let p = plekken[0]
  let beste = Infinity
  for (const kandidaat of plekken) {
    const k = kost(kandidaat)
    if (k < beste) {
      beste = k
      p = kandidaat
    }
  }
  return (
    <text
      x={p.x}
      y={p.y}
      textAnchor={p.anker}
      fontSize={13}
      fontWeight={700}
      fill={DERDE_INK}
      stroke="#fff"
      strokeWidth={3.5}
      paintOrder="stroke"
      pointerEvents="none"
    >
      {NAAM}
    </text>
  )
}

/* ------------------------------ de stemmen ------------------------------ */

function Stembalk({ stemmen }: { stemmen: boolean[] }) {
  const maat = 5
  const stap = 14
  return (
    <svg
      viewBox={`0 0 ${Math.max(1, stemmen.length) * stap} 14`}
      height={14}
      width={Math.max(1, stemmen.length) * stap}
      aria-hidden="true"
      className="block shrink-0"
    >
      {stemmen.map((af, i) => (
        <Merk key={i} afgezegd={af} cx={i * stap + stap / 2} cy={7} maat={maat} />
      ))}
    </svg>
  )
}

/** De rand van een tegel. Gekozen: dik, in de kleur van het handvat, en met een
 *  getint vlak erachter - dus nooit kleur alleen. Het is een schaduw aan de
 *  binnenkant en geen `border`: een dikkere border maakte de gekozen tegel 3 px
 *  groter en duwde het hele paneel bij elke klik een stukje omlaag. */
const rand = (gekozen: boolean) => (gekozen ? `inset 0 0 0 2.5px ${DERDE}` : `inset 0 0 0 1px ${RULE}`)

/* --------------------------- de conditie in woorden --------------------------- *
 * "dagen < 101" en "kamerprijs < 99,73", met een komma, in de schrijfwijze van
 * les 5 op het bord Bouw de boom. De grens is EXACT, niet afgerond: een drempel
 * ligt midden tussen twee waarden die echt voorkomen, en de nieuwe boeking
 * springt per hele dag en per hele euro. Dagen zijn gehele getallen, dus
 * "<= 100,5" is hetzelfde als "< 101". Prijzen hebben hoogstens twee decimalen,
 * dus "<= 99,725" is hetzelfde als "< 99,73". Zo zegt de tekst nooit "waar"
 * waar de boom "vals" rekent.                                                 */

function conditieTekst(v: Vakje): string {
  if (v.kenmerk === DAGEN) return `dagen < ${getal(Math.floor(v.drempel + 1e-9) + 1)}`
  const grens = (Math.floor(v.drempel * 100 + 1e-6) + 1) / 100
  return `kamerprijs < ${getal(grens, 2)}`
}

function wegInWoorden(boom: Boom, weg: Stap[]): { vraag: string; antwoord: Stap }[] {
  const uit: { vraag: string; antwoord: Stap }[] = []
  let k: Knoop = boom.wortel
  for (const stap of weg) {
    if (k.soort !== 'vakje') break
    uit.push({ vraag: conditieTekst(k), antwoord: stap })
    k = stap === 'waar' ? k.waar : k.vals
  }
  return uit
}

/* ------------------------------- het bord ------------------------------- */

export default function StemmendBos() {
  const [aantal, setAantal] = useState(1)
  const [keuze, setKeuze] = useState<Keuze>(1)
  const [boeking, setBoeking] = useState(START)

  const bomen = ALLE_BOMEN.slice(0, aantal)
  const punt = { dagen: boeking.x, prijs: boeking.y }
  const stemmen = bomen.map((b) => stemVan(b, punt))
  const uitslag = stemming(bomen, punt)
  const gekozenBoom = keuze === 'bos' ? null : ALLE_BOMEN[keuze - 1]

  const maak = () => {
    if (aantal >= MAX_BOMEN) return
    setAantal(aantal + 1)
    // De nieuwe boom wordt meteen de gekozen boom: zijn rijen en zijn vakjes
    // verschijnen op het bord, dus een boom maken verandert zichtbaar iets.
    setKeuze(aantal + 1)
  }

  const haalWeg = () => {
    if (aantal <= 1) return
    setAantal(aantal - 1)
    if (keuze !== 'bos' && keuze >= aantal) setKeuze(aantal - 1)
  }

  /* De ene zin die zegt wat je nu doet. Elke toestand heeft er één, en ze staat
     ALTIJD zichtbaar in het paneel, nooit achter de uitklap van de Brief. */
  const stand =
    uitslag.bos === 'gelijk'
      ? 'Welke boom moet je geloven? Maak nog een boom.'
      : aantal < 3
        ? `Maak boom ${aantal + 1}. Hij leert van een ander stuk van de train set.`
        : keuze !== 'bos'
          ? 'Klik op het bos. Dan zie je overal op het bord wat de meeste bomen zeggen.'
          : 'Sleep de nieuwe boeking. Zoek een plek waar de bomen het oneens zijn.'

  /* Eén regel. Het getal erboven telt de stemmen voor afgezegd; deze regel zegt
     wat het bos daaruit besluit. De stemmen zelf staan als merkjes in de tegel
     "het bos" rechts, dus hier hoeft niet nog eens te staan hoeveel bomen niet
     afgezegd stemmen. */
  const detail =
    uitslag.bos === 'gelijk'
      ? 'Het staat gelijk. Het bos kan niet kiezen.'
      : `Het bos zegt: ${uitslag.bos}.`

  const weg = gekozenBoom ? stemVan(gekozenBoom, punt).pad : []
  const woorden = gekozenBoom ? wegInWoorden(gekozenBoom, weg) : []
  const bladZegt = gekozenBoom ? stemVan(gekozenBoom, punt).afgezegd : false

  return (
    <div className="relative h-full w-full">
      <Canvas
        defaultView={OPENING}
        /* De kolomnaam zonder "aantal". Voluit liep ze op 900 px tot tegen het
           asgetal "0" van de kamerprijs, en dan las de onderrand als "0 aantal
           dagen ...". "dagen" is ook het woord in elke conditie in het paneel. */
        xLabel="dagen tussen reservatie en boeking"
        yLabel="gemiddelde kamerprijs"
      >
        {(s) => {
          const zicht: Gebied = s.view
          const vakken = gekozenBoom ? kaartVanBoom(gekozenBoom, zicht) : kaartVanBos(bomen, zicht)
          return (
            <>
              <Vlak vakken={vakken} s={s} />
              {/* De rijen. Bij een gekozen boom staan de rijen die hij nooit
                  trok lichter: dat is het "willekeurig gekozen stuk van de
                  train set" van 2132676, zichtbaar. */}
              <g pointerEvents="none">
                {TRAIN.map((r, i) => {
                  const gezien = !gekozenBoom || gekozenBoom.getrokken[i] > 0
                  return (
                    <g key={r.nr} opacity={gezien ? 1 : 0.18}>
                      <Merk afgezegd={r.afgezegd} cx={s.sx(r.dagen)} cy={s.sy(r.prijs)} maat={4.3} />
                    </g>
                  )
                })}
              </g>
              <DragDot
                point={boeking}
                scales={s}
                onMove={(p) => setBoeking({ x: Math.round(p.x), y: Math.round(p.y) })}
                color={DERDE}
                r={8}
                bounds={{ x: GRENS.x, y: GRENS.y }}
                step={{ x: 5, y: 5 }}
                ariaLabel="sleep dit handvat: de nieuwe boeking"
              />
              <HandvatNaam
                s={s}
                x={s.sx(boeking.x)}
                y={s.sy(boeking.y)}
                merken={TRAIN.map((r) => ({ x: s.sx(r.dagen), y: s.sy(r.prijs) }))}
              />
            </>
          )
        }}
      </Canvas>

      {/* DE EERSTE ALINEA IS HET DOEL. Brief klapt onder 1280 px alles daarna in,
          dus dit is de enige tekst die op een beamer zeker blijft staan. Er staat
          geen opdracht achter de uitklap: wat je DOET, staat in het paneel. */}
      <Brief eyebrow="mAIstros 2 - les 6" title="Het bos stemt">
        <p>
          Elke boom leert van een willekeurig stuk van de train set. Bij een nieuwe boeking
          stemt elke boom, en de meeste stemmen winnen.
        </p>
        <p>Elk punt is een rij uit hotelreservaties.csv: een boeking die wel of niet is afgezegd.</p>
        <p>
          Elk vakje kijkt maar naar één kenmerk, willekeurig gekozen. In je notebook maakt{' '}
          <PyChip>RandomForestClassifier()</PyChip> 100 bomen, en die zijn veel dieper.
        </p>
      </Brief>

      {/* LINKS ONDER: wat er nu gestemd wordt, wat je doet, en hoe de gekozen
          boom tot zijn stem komt. Het paneel staat er van de eerste tel af en
          verandert nooit van breedte, want Canvas houdt die breedte vrij: een
          paneel dat later opduikt, herkadert het bord. */}
      <Panel className="pointer-events-auto absolute bottom-4 left-4 z-10 flex max-h-[calc(100%-14.5rem)] w-[16rem] flex-col overflow-y-auto px-4 py-3.5 xl:max-h-[calc(100%-19rem)] xl:w-[21rem]">
        <Vaststelling
          label="Stemmen voor afgezegd"
          value={uitslag.afgezegd}
          outOf={{ total: aantal, noun: meervoud(aantal, 'boom', 'bomen') }}
          detail={detail}
          color={NAVY}
        />

        <p className="mt-2 text-[13.5px] font-semibold leading-snug text-ink">{stand}</p>

        <Divider />

        {gekozenBoom ? (
          <div className="text-[13px] leading-snug text-ink/85">
            {/* DE LICHTE RIJEN HEBBEN EEN NAAM EN EEN GETAL. Er stond "De andere
                staan lichter", en Niels vroeg of je ze niet beter "de test set"
                noemt. Niet als naam: deze zin zegt zelf dat ze uit de train set
                komen, de les heeft haar eigen test set (70/30), en de woordenlijst
                houdt "train set / test set" voor de twee helften van de data. Twee
                test sets op één scherm is precies de verwarring die de lijst
                verbiedt. Wat wel klopt: voor DEZE boom zijn het rijen die hij nooit
                zag, en dat is hoe een random forest elke boom apart kan testen.
                Daarom "als een test set": een vergelijking, geen naam.
                Het getal wordt gerekend, nooit getypt. GEMETEN over de 9 bomen: 62
                (boom 1) tot 77 rijen, dus altijd meervoud.
                Deze zin past ALLEEN samen met de korte kop eronder. GEMETEN in de
                langste toestand (2 bomen, gelijk, boom 1, 4 condities): de zin is
                5 regels onder 1280 px en 3 vanaf 1280, en het paneel blijft 451 px
                (900x700, 1024x768) en 397 px (1280 en breder), net als met de oude
                zin. Met de oude kop "Zo stemt boom 1 over de nieuwe boeking:" brak
                die onder 1280 px op "boeking:", en dan scrolde het paneel op
                900x700 2 px (468 tegen 466). */}
            <p>
              Boom {gekozenBoom.nr} trok {getal(TRAIN.length)} keer een willekeurige rij uit de train set,
              soms dezelfde. De {getal(TRAIN.length - gekozenBoom.gezien)} rijen die hij nooit trok, staan
              lichter. Voor hem zijn ze als een test set.
            </p>
            <p className="mt-1.5 font-semibold text-ink">Zo stemt boom {gekozenBoom.nr}:</p>
            <ol className="mt-0.5 space-y-0.5">
              {woorden.map((w, i) => (
                <li key={i} className="flex justify-between gap-2 tabular-nums">
                  <span>{w.vraag}?</span>
                  <span className="font-semibold" style={{ color: DERDE_INK }}>
                    {w.antwoord}
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-0.5">
              Het blad zegt: <span className="font-semibold text-ink">{bladZegt ? 'afgezegd' : 'niet afgezegd'}</span>.
            </p>
            {/* AUDIT 2026-09-30: in het bos stond uitgelegd wat het vlak is, bij
                één boom niet. Een leerling die koud aankomt, zag een oranje
                gearceerd vlak zonder één woord erover. Dezelfde zin als bij het
                bos, met de boom in de plaats van de meeste bomen. Kort genoeg
                voor één regel: met "op elke plek" erbij ging het paneel op
                900x700 in de langste toestand 2 px scrollen (gemeten). */}
            <p className="mt-1.5">Het vlak toont wat boom {gekozenBoom.nr} zegt.</p>
          </div>
        ) : (
          <p className="text-[13px] leading-snug text-ink/85">
            Het vlak toont wat de meeste bomen zeggen. Waar de stemmen gelijk staan, blijft het
            wit.
          </p>
        )}

        {/* De twee merken met hun woord. Het vlak gebruikt dezelfde kleuren, en
            afgezegd heeft daar ook nog een arcering. */}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink/80">
          <span className="flex items-center gap-1.5">
            <svg width={12} height={12} aria-hidden="true">
              <Kruisje cx={6} cy={6} maat={3.8} dik={2.2} />
            </svg>
            afgezegd
          </span>
          <span className="flex items-center gap-1.5">
            <svg width={12} height={12} aria-hidden="true">
              <Rondje cx={6} cy={6} r={4.3} />
            </svg>
            niet afgezegd
          </span>
        </div>
      </Panel>

      {/* RECHTS: het bos zelf. Bovenaan de stemming, daaronder één tegel per
          boom. De eerstvolgende lege tegel is de knop om een boom te maken, zodat de
          nieuwe boom verschijnt op de plek waar je klikte.

          14 rem en niet 16 onder 1280 px: GEMETEN. Canvas laat de panelen samen
          hoogstens 66% van de breedte nemen. Op 900 px is dat 594 px, en links
          staat al 288 + 48 px. Met 16 rem rechts (288 px) wordt het 624 en duwt
          Canvas de rijen onder een paneel. Met 14 rem (256 px) is het 592. */}
      <Panel className="pointer-events-auto absolute right-4 top-4 z-10 flex max-h-[calc(100%-2rem)] w-[14rem] flex-col overflow-y-auto px-3 py-3 xl:w-[18rem]">
        <div className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-ink/75">Het bos</div>

        <button
          type="button"
          onClick={() => setKeuze('bos')}
          aria-pressed={keuze === 'bos'}
          className={`mt-2 rounded-lg px-2 py-1.5 text-left transition ${
            keuze === 'bos' ? 'bg-derde/8' : 'hover:bg-black/[0.03]'
          }`}
          style={{ boxShadow: rand(keuze === 'bos') }}
        >
          {/* Twee vaste regels: de uitslag, en eronder één merkje per boom. Naast
              elkaar liep "niet afgezegd" met negen merkjes GEMETEN over de
              breedte, brak over twee regels en liet het paneel op 900x700
              scrollen. */}
          <span className="block whitespace-nowrap text-[13px] font-bold text-ink">
            {uitslag.bos === 'gelijk' ? 'de stemmen staan gelijk' : `het bos zegt: ${uitslag.bos}`}
          </span>
          <span className="mt-1 block">
            <Stembalk stemmen={stemmen.map((st) => st.afgezegd)} />
          </span>
        </button>

        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {Array.from({ length: MAX_BOMEN }, (_, i) => {
            const nr = i + 1
            /* Drie verschillende sleutels voor drie verschillende dingen. Met
               alleen `nr` hergebruikte React de limoen knop "Maak boom 2" als
               tegel van boom 2, en door `transition` liep die tegel nog even
               van limoen naar wit: in een schermafdruk vlak na de klik stond
               de nieuwe boom in een limoen tegel, net waar de leerling kijkt. */
            if (nr <= aantal) {
              const boom = ALLE_BOMEN[i]
              const gekozen = keuze === nr
              return (
                <button
                  key={`boom-${nr}`}
                  type="button"
                  onClick={() => setKeuze(nr)}
                  aria-pressed={gekozen}
                  aria-label={`boom ${nr}, stemt ${stemmen[i].afgezegd ? 'afgezegd' : 'niet afgezegd'}`}
                  className={`rounded-lg px-1 pb-0.5 pt-1 text-left transition ${
                    gekozen ? 'bg-derde/8' : 'hover:bg-black/[0.03]'
                  }`}
                  style={{ boxShadow: rand(gekozen) }}
                >
                  <span className="block px-0.5 text-[13px] font-bold leading-none text-ink">
                    boom {nr}
                  </span>
                  <Boompje boom={boom} weg={stemmen[i].pad} />
                </button>
              )
            }
            if (nr === aantal + 1) {
              return (
                <button
                  key={`maak-${nr}`}
                  type="button"
                  onClick={maak}
                  className="flex min-h-[5.6rem] items-center justify-center rounded-lg bg-lime px-2 text-center text-[13px] font-extrabold uppercase leading-tight text-navy transition hover:bg-lime-deep"
                >
                  {/* Harde spatie: onder 1280 px is de tegel 96 px breed, en dan
                      stond het getal GEMETEN alleen op de tweede regel ("MAAK
                      BOOM" / "2"). Nu breekt het als "MAAK" / "BOOM 2". */}
                  Maak boom{NBSP}{nr}
                </button>
              )
            }
            return (
              <div
                key={`leeg-${nr}`}
                aria-hidden="true"
                className="min-h-[5.6rem] rounded-lg border border-dashed"
                style={{ borderColor: RULE }}
              />
            )
          })}
        </div>

        {/* Een werkwoord, net als de tegel "Maak boom N", en het nummer van de
            tegel die verdwijnt. Was "Laatste boom weg". Eén regel op elke maat
            (gemeten 900 tot 1440 px). */}
        <div className="mt-2">
          <Btn variant="ghost" full disabled={aantal <= 1} onClick={haalWeg}>
            Haal boom {aantal} weg
          </Btn>
        </div>
      </Panel>
    </div>
  )
}
