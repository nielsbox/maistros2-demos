import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import Canvas, { fitView, type CanvasApi, type Scales, type View } from '../components/Canvas'
import { Brief, Note, PyChip } from '../components/Overlay'
import { getal } from '../components/Vaststelling'
import {
  controleer,
  richting,
  SPOREN,
  tienduizendsten,
  type Aanpassing,
  type Richting,
  type Start,
} from '../lib/neuron'
import { DATA, DERDE, DERDE_INK, FOUT_INK, INK, MUTED, NAVY } from '../lib/palette'

/* ------------------------------------------------------------------ *
 * mAIstros 2 - les 9 - Eén neuron zoekt zijn getal.
 *
 * EEN DOEL: voorbeeld per voorbeeld past het neuron zijn getal aan. Dit bord
 * gaat over HOE het neuron leert, niet over wat een getraind netwerk doet. Het
 * is het rekenvoorbeeld van de les (2155519-2155530) met de regel die 2155531
 * in woorden geeft, uitgerekend: bij elk voorbeeld rekent het neuron
 * invoer * getal, vergelijkt dat met wat juist is, en past zijn getal aan met
 * 0,01 * fout * invoer. Na elke keer overlopen begint het opnieuw, tot elke
 * fout kleiner is dan 0,01. Het rekenwerk staat in src/lib/neuron.ts.
 *
 * DE LINK STAAT OP 2155531, de eerste slide die de regel uitspreekt ("Is je
 * uitvoer te groot, dan had dat getal kleiner moeten zijn ... hoe verder je
 * ernaast zit, hoe meer je je getal moet aanpassen"). Alles wat dit bord nodig
 * heeft, staat op die slide of ervoor.
 *
 * DE WOORDEN KOMEN VAN DE LES:
 *   neuron                          2155236, 2155697, 2155531
 *   invoer, uitvoer                 2155517-2155519, 2155531
 *   voorbeeld                       2155519, 2155520, 2155523, 2155531
 *   pond, kg                        de tabel op 2155519 en 2155521
 *   het getal (op de verbinding)    2155523, 2155697, 2155531
 *   fout, te veel, te weinig        2155522-2155527
 *   kleiner, groter                 2155522, 2155524, 2155531
 *   aanpassen, aanpassing           2155531
 *   dicht genoeg                    2155527
 *   N keer overlopen                2228146, 2228148, 2155927, 2228151
 *   juist                           2155910, 2155926
 * NOOIT: `keer` alleen als naam voor een herhaling, want 2155522 zegt "3 keer
 * 0.6" voor een vermenigvuldiging, en hier staat "3 * 0,6000" vlak naast de
 * as. Dus altijd "keer overlopen". Ook niet: `gewicht` (pas op 2155701, na de
 * link), `stap` (Stap 1-6 zijn de opdrachten), `te groot` en `te klein` (de
 * les zegt dat zowel over de uitvoer als over het getal), `leersnelheid` (les
 * 10), `regel` (die is gereserveerd voor wat de computer leert).
 *
 * WAT HET BORD NIET TOONT, EN WAAROM:
 *   - geen doellijn op 0,4536. Het neuron kent dat getal niet.
 *   - geen handvat voor het begingetal. Met de stopregel van de les spreken
 *     12 van de 101 begingetallen 0,00-1,00 een regel op het bord tegen ("te
 *     veel" met een getal dat blijft). 0,6 en 0,3, de twee getallen van de les,
 *     doen dat nergens: nagerekend door `controleer()` in neuron.ts.
 *   - geen activatiefunctie. Elke uitvoer is hier positief, dus max(0, x) laat
 *     alles ongemoeid (design-boards/les9/m8.out).
 *   - geen schuif voor de 0,01. Die hoort bij les 10 (2156007), en met deze
 *     drie voorbeelden is een grotere 0,01 niet gewoon sneller of trager: het
 *     aantal keer overlopen is gemeten niet monotoon (m5.out).
 *
 * ELK GETAL OP HET SCHERM KOMT UIT DE TOESTAND. De vaste zinnen in het paneel
 * ("bij 7 pond is de aanpassing groter", "de fout wordt telkens kleiner",
 * "bijna 0,454") worden in dev nagerekend: zie `controleer()`.
 * ------------------------------------------------------------------ */

if (import.meta.env.DEV) {
  const fouten = controleer()
  /* getal() schrijft een kommagetal. Het bord rekent in gehele tienduizendsten
     en deelt pas bij het opschrijven, dus moet getal(v / 10000, 4) voor elk
     getonde getal precies de gehele opmaak geven. */
  for (const sp of Object.values(SPOREN)) {
    for (const a of sp.stappen) {
      for (const v of [a.getal, a.uitvoer, a.juist, Math.abs(a.fout), Math.abs(a.aanpassing), a.nieuw]) {
        if (getal(v / 10000, 4) !== tienduizendsten(v)) {
          fouten.push(`getal(${v} / 10000, 4) geeft ${getal(v / 10000, 4)}, niet ${tienduizendsten(v)}`)
        }
      }
    }
  }
  if (fouten.length > 0) console.error('Eén neuron zoekt zijn getal: het rekenwerk klopt niet.', fouten)
}

/* ------------------------------ opmaak ----------------------------- */

/** Tienduizendsten als Nederlands getal met vier cijfers na de komma. Precies
 *  nul staat er als "0", zoals de les het schrijft ("0 * 0.6 is 0"). */
function vier(v: number): string {
  return v === 0 ? '0' : getal(v / 10000, 4)
}

/** Het begingetal kort, zoals op de knoppen en in de les: 0,6 en 0,3. */
function kort(s: Start): string {
  return getal(s / 10000, 1)
}

/* --------------------------- de tweede klik -------------------------- *
 * DE TWEEDE KLIK VAN EEN DUBBELKLIK TELT NIET, op het hele paneel. Na elke
 * klik verandert wat er aan staat: na "Volgend voorbeeld" gaan de drie keuzes
 * aan, na een juiste keuze gaat "Volgend voorbeeld" weer aan, en na de laatste
 * keuze van deel 2 staat op die plaats "Nog een keer". Een dubbelklik zou dus
 * met zijn tweede klik een andere knop indrukken. Hetzelfde patroon als in
 * KMeansStappen.tsx: `detail` is 2 bij de tweede klik met een muis, en op een
 * aanraakscherm telt een tik die binnen 400 ms en 10 px na de vorige valt ook
 * als tweede. Met het toetsenbord is `detail` 0, dus Enter en spatie tellen
 * altijd.                                                                 */

type Klik = { detail: number; timeStamp: number; clientX: number; clientY: number }

function useTweedeKlik() {
  const vorige = useRef<{ t: number; x: number; y: number } | null>(null)
  return (e: Klik) => {
    if (e.detail === 0) return false
    const v = vorige.current
    vorige.current = { t: e.timeStamp, x: e.clientX, y: e.clientY }
    if (e.detail > 1) return true
    return v !== null && e.timeStamp - v.t < 400 && Math.hypot(e.clientX - v.x, e.clientY - v.y) < 10
  }
}

/* ------------------------------ indeling --------------------------- *
 * DRIE VLAKKEN EN EEN GRAFIEK. Linksboven de Brief (doel en de drie regels),
 * rechts ervan de band met het neuron, onder de band rechts het paneel, en
 * links onder de Brief de grafiek.
 *
 * WAAROM DE BAND GEEN DEEL VAN CANVAS IS. Canvas schaalt x en y apart en laat
 * pannen en zoomen. Een neuron in wereldcoördinaten wordt dan een ellips en
 * schuift weg zodra een leerling in de grafiek zoomt. De band is dus een vaste
 * svg op het scherm, en Canvas draagt alleen de grafiek. De band telt voor
 * Canvas als een paneel: de grafiek begint eronder (`insets.top`).
 *
 * WAAROM HET PANEEL RECHTS STAAT EN NIET LINKSONDER. Op 900x700 eindigt de
 * Brief op 233 px, dus links eronder is er 435 px voor een paneel. Het einde
 * van deel 3 (de stop, de fouten, het getal, de noot en twee knoppen) is
 * gemeten 491 px hoog. Onder de band is er op 900x700 508 px. En zo staan de
 * knoppen vlak onder het neuron dat ze veranderen.
 *
 * De band krijgt een vaste hoogte per schermbreedte, nooit per toestand. Werd
 * hij hoger zodra de aanpassing verschijnt, dan kaderde de grafiek eronder bij
 * elke klik opnieuw.                                                      */

/** De band in zijn eigen eenheden. Hij schaalt als geheel mee met de ruimte
 *  naast de Brief en boven het paneel, tot hoogstens 1,3. Gemeten: 0,90 op
 *  900x700, waar de kleinste tekst (15 eenheden) 13,6 px is, 1,10 op 1024x768,
 *  1,3 op 1280x800 en 1440x900. Onder 870 px breed zakt die tekst onder de
 *  13 px; dat scherm is hier niet het doel. */
const BW = 640
const BH = 146
const BAND_RAND = 8
const MAX_SCHAAL = 1.3

type Indeling = { w: number; h: number; briefR: number; briefB: number; paneelL: number }

function useIndeling(wortel: RefObject<HTMLDivElement | null>): Indeling | null {
  const [ind, setInd] = useState<Indeling | null>(null)
  useLayoutEffect(() => {
    const el = wortel.current
    if (!el) return
    const brief = [...el.querySelectorAll<HTMLElement>(':scope > .panel')].find((p) =>
      p.querySelector('h1'),
    )
    const paneel = el.querySelector<HTMLElement>('[data-rol="paneel"]')
    const meet = () => {
      const box = el.getBoundingClientRect()
      const b = brief?.getBoundingClientRect()
      const p = paneel?.getBoundingClientRect()
      const next: Indeling = {
        w: Math.round(box.width),
        h: Math.round(box.height),
        briefR: b ? Math.round(b.right - box.left) : 272,
        briefB: b ? Math.round(b.bottom - box.top) : 240,
        paneelL: p ? Math.round(p.left - box.left) : Math.round(box.width) - 16 - 288,
      }
      setInd((prev) =>
        prev &&
        prev.w === next.w &&
        prev.h === next.h &&
        prev.briefR === next.briefR &&
        prev.briefB === next.briefB &&
        prev.paneelL === next.paneelL
          ? prev
          : next,
      )
    }
    meet()
    const ro = new ResizeObserver(meet)
    ro.observe(el)
    if (brief) ro.observe(brief)
    if (paneel) ro.observe(paneel)
    return () => ro.disconnect()
  }, [wortel])
  return ind
}

/* ------------------------------ de band ---------------------------- */

/** Tekst op het bord: vet, met een witte rand, en nooit onder 13 px op het
 *  scherm (de kleinste maat hier is 15 eenheden, zie BW). */
function T({
  x,
  y,
  maat,
  kleur = INK,
  anker = 'start',
  gewicht = 700,
  children,
}: {
  x: number
  y: number
  maat: number
  kleur?: string
  anker?: 'start' | 'middle' | 'end'
  gewicht?: number
  children: ReactNode
}) {
  return (
    <text
      x={x}
      y={y}
      fontSize={maat}
      fontWeight={gewicht}
      fill={kleur}
      textAnchor={anker}
      stroke="#fff"
      strokeWidth={3.5}
      paintOrder="stroke"
    >
      {children}
    </text>
  )
}

/** Een pijl van x1 naar x2 op hoogte y, met de punt bij x2. */
function Pijl({ x1, x2, y }: { x1: number; x2: number; y: number }) {
  return (
    <g>
      <line x1={x1} y1={y} x2={x2 - 11} y2={y} stroke={NAVY} strokeWidth={3.5} />
      <path d={`M ${x2} ${y} L ${x2 - 14} ${y - 8} L ${x2 - 14} ${y + 8} Z`} fill={NAVY} />
    </g>
  )
}

/** Klein pijltje bij "getal kleiner" of "getal groter": dezelfde richting als
 *  het rode pijltje op de figuur van 2155522. */
function Richtingpijl({ x, y, naar }: { x: number; y: number; naar: 'kleiner' | 'groter' }) {
  const d = naar === 'kleiner' ? 1 : -1
  const top = y - 13
  const onder = y + 1
  const [a, b] = d === 1 ? [top, onder] : [onder, top]
  return (
    <g>
      <line x1={x} y1={a} x2={x} y2={b - d * 5} stroke={DERDE_INK} strokeWidth={2.5} />
      <path d={`M ${x} ${b} L ${x - 5} ${b - d * 7} L ${x + 5} ${b - d * 7} Z`} fill={DERDE_INK} />
    </g>
  )
}

const Y = 76
const INVOER_X = 84
const PIJL1 = [96, 264] as const
const CHIP_X = 179
const NEURON_X = 326
const NEURON_R = 56
const PIJL2 = [386, 442] as const
const UIT_X = 452
const LABEL_1 = Y + 36
const LABEL_2 = Y + 57
const A3_X = 24

/**
 * Het neuron van 2155697, opnieuw getekend: invoer, het getal op de
 * verbinding, het neuron met de vermenigvuldiging erin, de uitvoer.
 *
 * Het neuron is WIT met een navy rand, en niet blauw gevuld zoals op de slide:
 * dan zou een blauw getal erin wegvallen, en blauw is op de andere borden de
 * kleur van het model. Het getal is groen, zoals op 2155697.
 *
 * DE ANNOTATIES. Hoogstens drie tegelijk, en elk heeft één werk:
 *   A1 juist        wat de uitvoer had moeten zijn
 *   A2 fout         hoeveel ernaast, en naar welke kant. Het woord zegt altijd
 *                   de kant ("te veel", "te weinig"), dus kleur is nooit het
 *                   enige teken.
 *   A3 aanpassing   0,01 * fout * invoer, met de getallen van nu. Staat er
 *                   alleen na een aanpassing, en gaat weg bij "Volgend
 *                   voorbeeld".
 * Invoer, getal, de som in het neuron en de uitvoer zijn merken: de toestand
 * zelf, zoals de punten van een grafiek. Het neuron houdt het getal van VOOR
 * de aanpassing, zodat de som ernaast blijft kloppen; het nieuwe getal staat
 * op de verbinding, achter een pijltje.
 */
function Band({ a, aangepast }: { a: Aanpassing; aangepast: boolean }) {
  const r = richting(a)
  const kant = r === 'kleiner' ? 'te veel' : r === 'groter' ? 'te weinig' : null
  const verandert = aangepast && a.aanpassing !== 0
  return (
    <g>
      <T x={INVOER_X} y={Y + 7} maat={21} kleur={DATA} anker="end">
        {`${a.pond} pond`}
      </T>
      <Pijl x1={PIJL1[0]} x2={PIJL1[1]} y={Y} />

      {/* Het getal op de verbinding. Na een aanpassing: oud, pijltje, nieuw. */}
      <g data-merk="getal">
        <T x={CHIP_X} y={Y - 14} maat={17} kleur={DERDE_INK} anker="middle" gewicht={800}>
          {verandert ? (
            <>
              <tspan fontWeight={600}>{vier(a.getal)}</tspan>
              <tspan>{` \u2192 ${vier(a.nieuw)}`}</tspan>
            </>
          ) : (
            vier(a.getal)
          )}
        </T>
      </g>

      <circle cx={NEURON_X} cy={Y} r={NEURON_R} fill="#fff" stroke={NAVY} strokeWidth={4} />
      <g data-merk="som">
        <T x={NEURON_X} y={Y + 6} maat={18} kleur={NAVY} anker="middle">
          {`${a.pond} * ${vier(a.getal)}`}
        </T>
      </g>

      <Pijl x1={PIJL2[0]} x2={PIJL2[1]} y={Y} />
      <T x={UIT_X} y={Y + 7} maat={21} kleur={DATA}>
        {`${vier(a.uitvoer)} kg`}
      </T>

      <g data-ann="juist">
        <T x={UIT_X} y={LABEL_1} maat={15}>
          {`juist: ${vier(a.juist)} kg`}
        </T>
      </g>
      <g data-ann="fout">
        <T x={UIT_X} y={LABEL_2} maat={15} kleur={FOUT_INK}>
          {kant ? `fout: ${vier(Math.abs(a.fout))} ${kant}` : 'fout: 0'}
        </T>
      </g>

      {aangepast && (
        <g data-ann="aanpassing">
          <T x={A3_X} y={LABEL_1} maat={15}>
            <tspan>{'0,01 * '}</tspan>
            <tspan fill={FOUT_INK}>{vier(Math.abs(a.fout))}</tspan>
            <tspan>{` * ${a.pond} ${a.exact ? '=' : '\u2248'} `}</tspan>
            <tspan fill={DERDE_INK}>{vier(Math.abs(a.aanpassing))}</tspan>
          </T>
          {r !== 'blijft' && <Richtingpijl x={A3_X + 5} y={LABEL_2} naar={r} />}
          <T x={r === 'blijft' ? A3_X : A3_X + 16} y={LABEL_2} maat={15} kleur={DERDE_INK}>
            {`getal ${r}`}
          </T>
        </g>
      )}
    </g>
  )
}

/** Wat een schermlezer over de band voorleest. */
function bandTekst(a: Aanpassing, aangepast: boolean): string {
  const r = richting(a)
  const kant = r === 'kleiner' ? 'te veel' : r === 'groter' ? 'te weinig' : 'geen fout'
  const basis =
    `${a.pond} pond maal ${vier(a.getal)} geeft ${vier(a.uitvoer)} kg. ` +
    `Juist is ${vier(a.juist)} kg. Fout: ${r === 'blijft' ? '0' : `${vier(Math.abs(a.fout))} ${kant}`}.`
  if (!aangepast) return basis
  return `${basis} Aanpassing ${vier(Math.abs(a.aanpassing))}: het getal ${r === 'blijft' ? 'blijft' : `wordt ${vier(a.nieuw)}`}.`
}

/* ----------------------------- de grafiek -------------------------- *
 * Het getal na elk voorbeeld. De x-as telt de keren overlopen: het getal van
 * het begin staat op 0, de drie voorbeelden van keer k op k - 2/3, k - 1/3 en
 * k. Zo vormen ze een trap: plat bij 0 pond, een kleine trede bij 3 pond, een
 * grotere bij 7 pond, en elke keer worden de treden kleiner. Gemeten op dit
 * bord vanaf 0,6, op 1024x768: 210, 98, 45, 21, 10, 4,6 en 2,1 px per keer
 * overlopen (op 900x700 177 tot 1,8 px). Na keer 7 stopt het neuron. Keer 8
 * tot 10 zouden het punt nog 0,7, 0,2 en 0,2 px verzetten op een as van 260
 * px (critic/c3.out): een knop die niets zichtbaar verandert.
 *
 * DE ASSEN TEKENT DIT BORD ZELF, en niet Canvas. Canvas kiest zijn stap uit de
 * breedte van het hele bord, en op 900x700 werd dat 0, 2, 4, 6: de helft van
 * de keren had geen getal. Hier staat er één per keer overlopen, zolang ze
 * minstens 34 px uit elkaar staan. En de asnamen staan in een eigen strook
 * boven en onder de grafiek, niet erin: vanaf 0,6 ligt het laatste punt
 * rechtsonder en vanaf 0,3 rechtsboven, dus in de grafiek botste een asnaam
 * altijd met een van de twee.                                            */

type Punt = { x: number; y: number; wat: string }

function puntenVan(start: Start, toegepast: number): Punt[] {
  const stappen = SPOREN[start].stappen
  const uit: Punt[] = [{ x: 0, y: start / 10000, wat: `begin: getal ${vier(start)}` }]
  for (const a of stappen.slice(0, toegepast)) {
    uit.push({
      x: a.keer - 1 + (a.plaats + 1) / 3,
      y: a.nieuw / 10000,
      wat: `de ${a.keer}e keer overlopen, ${a.pond} pond: getal ${vier(a.nieuw)}`,
    })
  }
  return uit
}

function venster(start: Start): View {
  return fitView(puntenVan(start, SPOREN[start].stappen.length), { padFrac: 0.06 })!
}

/** Een mooie stap voor de y-as: 1, 2 of 5 maal een macht van tien. */
function mooi(ruw: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(ruw)))
  const n = ruw / p
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p
}

/** De minimale rand van Canvas, met links plaats voor rail (48 px) en y-getallen. */
const PAD = { top: 26, right: 26, bottom: 42, left: 110 }

/** Zelfde maat als de asgetallen van Canvas: 13 px, vet, met een witte rand. */
const ASGETAL = { fontSize: 13, fontWeight: 700, fill: MUTED, stroke: '#fff', strokeWidth: 3.5 }

function Grafiek({ s, punten }: { s: Scales; punten: Punt[] }) {
  const { x0, x1, y0, y1 } = s.view
  const perKeer = s.sx(1) - s.sx(0)
  const xStap = perKeer >= 34 ? 1 : perKeer >= 17 ? 2 : perKeer >= 7 ? 5 : 10
  const keren: number[] = []
  for (let k = Math.max(0, Math.ceil(x0 / xStap) * xStap); k <= x1 && keren.length < 60; k += xStap) keren.push(k)

  const yStap = mooi(s.unitPerPx.y * 56)
  const dec = Math.max(0, -Math.floor(Math.log10(yStap) + 1e-9))
  const yWaarden: number[] = []
  for (let v = Math.ceil(y0 / yStap) * yStap; v <= y1 && yWaarden.length < 60; v += yStap) {
    yWaarden.push(Number(v.toFixed(dec + 2)))
  }

  const lijn = punten.map((p) => `${s.sx(p.x)},${s.sy(p.y)}`).join(' ')
  const laatste = punten[punten.length - 1]

  return (
    <g>
      {/* Een lijn per keer overlopen, zodat elk asgetal op een lijn staat. */}
      {keren.map((k) => (
        <line key={`k${k}`} x1={s.sx(k)} y1={0} x2={s.sx(k)} y2={s.area.bottom} stroke="#ebe8f3" />
      ))}

      <polyline points={lijn} fill="none" stroke={DERDE} strokeWidth={2.5} strokeLinejoin="round" />
      {punten.map((p, i) => (
        <circle
          key={i}
          data-punt={i}
          cx={s.sx(p.x)}
          cy={s.sy(p.y)}
          r={p === laatste ? 6.5 : 4.5}
          fill={DERDE}
          stroke="#fff"
          strokeWidth={p === laatste ? 2 : 1.5}
        >
          <title>{p.wat}</title>
        </circle>
      ))}

      {/* De assen: getallen en namen, in de stroken rond het vrije vlak. */}
      {keren
        .filter((k) => s.sx(k) >= s.safe.left - 6 && s.sx(k) <= s.safe.right + 6)
        .map((k) => (
          <text key={`tx${k}`} x={s.sx(k)} y={s.safe.bottom + 22} textAnchor="middle" paintOrder="stroke" {...ASGETAL}>
            {getal(k)}
          </text>
        ))}
      {yWaarden
        .filter((v) => s.sy(v) >= s.safe.top + 6 && s.sy(v) <= s.safe.bottom + 6)
        .map((v) => (
          <text key={`ty${v}`} x={s.safe.left - 12} y={s.sy(v) + 4.5} textAnchor="end" paintOrder="stroke" {...ASGETAL}>
            {getal(v, dec)}
          </text>
        ))}
      <text
        x={s.safe.right}
        y={s.safe.bottom + 44}
        textAnchor="end"
        fontSize={13.5}
        fontWeight={700}
        fill={INK}
        stroke="#fff"
        strokeWidth={3.5}
        paintOrder="stroke"
      >
        keer overlopen
      </text>
      <text
        x={s.safe.left - 12}
        y={s.safe.top - 14}
        textAnchor="end"
        fontSize={13.5}
        fontWeight={700}
        fill={DERDE_INK}
        stroke="#fff"
        strokeWidth={3.5}
        paintOrder="stroke"
      >
        getal
      </text>
    </g>
  )
}

/* ------------------------------ het paneel ------------------------- *
 * DRIE DELEN, genummerd, en nooit "stap": Stap 1 tot 6 zijn de opdrachten van
 * de les. Alleen het deel van nu heeft tekst. Een afgewerkt deel klapt dicht
 * tot zijn titel, anders stapelt het paneel zich op.
 *
 * DE VOLGORDE IN HET PANEEL IS VAST: de delen, wat je in dit deel doet, de
 * knoppen, en daaronder wat er net gebeurde. Zo staan de knoppen stil zolang
 * een deel duurt, ook als de tekst eronder van lengte verandert.           */

const DELEN = ['Eén voorbeeld', 'Alle voorbeelden', 'Keer na keer'] as const

function Delen({ deel }: { deel: 1 | 2 | 3 }) {
  return (
    <ol className="space-y-0.5">
      {DELEN.map((titel, i) => {
        const n = i + 1
        const nu = n === deel
        const af = n < deel
        return (
          <li
            key={titel}
            aria-current={nu ? 'step' : undefined}
            className={`flex items-center gap-2 text-[13.5px] leading-tight ${
              nu ? 'font-bold text-navy' : af ? 'text-ink/85' : 'text-muted'
            }`}
          >
            <span
              className={`flex size-[18px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums ${
                nu ? 'bg-navy text-white' : af ? 'bg-navy/12 text-navy' : 'bg-black/[0.06] text-muted'
              }`}
            >
              {n}
            </span>
            {titel}
          </li>
        )
      })}
    </ol>
  )
}

/** De drie knoppen, van klein naar groot. */
const KEUZES: readonly Richting[] = ['kleiner', 'blijft', 'groter']

/** De drie regels in de Brief, in de volgorde van de spec: "het wordt groter"
 *  leunt op "het getal" in de regel erboven, dus te weinig komt tweede. */
const REGELS: readonly Richting[] = ['kleiner', 'groter', 'blijft']

/** Welke regel van de Brief bij een richting hoort. */
const REGEL: Record<Richting, string> = {
  kleiner: 'Te veel: het getal wordt kleiner.',
  groter: 'Te weinig: het wordt groter.',
  blijft: 'Geen fout: het blijft.',
}

/** Wat het paneel zegt na een verkeerde keuze. Het zegt welke regel geldt,
 *  zonder oordeel: geen kruis, geen teller, geen kleur van "fout". */
const WELKE_REGEL: Record<Richting, string> = {
  kleiner: 'De uitvoer is te veel. Dan wordt het getal kleiner.',
  groter: 'De uitvoer is te weinig. Dan wordt het getal groter.',
  blijft: 'Er is geen fout. Dan blijft het getal.',
}

/** De aanpassing in woorden, met harde spaties: op 1024x768 brak "0,01 /
 *  * fout * invoer" over twee regels, met de formule in twee stukken. */
const FORMULE = '0,01\u00a0*\u00a0fout\u00a0*\u00a0invoer'

/** Hoe lang elk voorbeeld staat als "Nog een keer" een hele keer overloopt. */
const TEMPO = 500

type Toestand = {
  start: Start
  /** Het voorbeeld dat nu in de band staat, als plaats in het spoor. */
  cursor: number
  /** Is zijn aanpassing al gedaan? */
  aangepast: boolean
  /** Koos de leerling bij dit voorbeeld verkeerd? Dan staat de regel in beeld. */
  mis: boolean
}

/** Het bord opent zoals 2155522: 0 pond is al gedaan (dat klopte), en 3 pond
 *  staat in de band met zijn fout. */
const BEGIN: Toestand = { start: 6000, cursor: 1, aangepast: false, mis: false }

export default function EenNeuronZoektZijnGetal() {
  const [t, setT] = useState<Toestand>(BEGIN)
  /** Speelt "Nog een keer"? Dan tot en met deze plaats in het spoor. */
  const [spelen, setSpelen] = useState<number | null>(null)
  /** Hoeveel zetten de leerling al deed. Alleen voor de focus. */
  const [zetten, setZetten] = useState(0)
  const zet = () => setZetten((n) => n + 1)

  const wortel = useRef<HTMLDivElement>(null)
  const paneel = useRef<HTMLDivElement>(null)
  const canvas = useRef<CanvasApi | null>(null)
  const tweedeKlik = useTweedeKlik()
  const ind = useIndeling(wortel)

  const sp = SPOREN[t.start]
  const a = sp.stappen[t.cursor]
  const toegepast = t.cursor + (t.aangepast ? 1 : 0)
  const laatste = sp.stappen.length - 1
  /** Deel 1 is alleen de eerste aanpassing vanaf 0,6. Deel 2 loopt tot keer 2
   *  af is, deel 3 daarna. Vanaf 0,3 begint het bord in deel 2. */
  const deel: 1 | 2 | 3 =
    t.start === 6000 && t.cursor === 1 ? 1 : t.cursor < 5 || (t.cursor === 5 && !t.aangepast) ? 2 : 3
  const klaar = deel === 3 && t.cursor === laatste && t.aangepast && spelen === null

  /* ----------------------------- "Nog een keer" -------------------------- *
   * Elk voorbeeld staat TEMPO ms in de band, met A1, A2 en A3, en het laatste
   * ook: pas daarna gaat de knop weer aan of stopt het neuron. Een tabblad dat
   * niet zichtbaar is, vertraagt deze timers, maar ze lopen wel af: er is geen
   * requestAnimationFrame die stil kan vallen.                              */
  useEffect(() => {
    if (spelen === null) return
    const id = window.setTimeout(() => {
      if (t.cursor >= spelen) setSpelen(null)
      else setT((v) => ({ ...v, cursor: v.cursor + 1, aangepast: true, mis: false }))
    }, TEMPO)
    return () => window.clearTimeout(id)
  }, [spelen, t.cursor])

  /* De grafiek kadert opnieuw bij een ander begingetal, ook als de leerling
     gezoomd had: een oud venster rond 0,6 toont niets van een run vanaf 0,3. */
  const kader = useMemo(() => venster(t.start), [t.start])
  useEffect(() => {
    canvas.current?.reset()
  }, [t.start])

  const punten = useMemo(() => puntenVan(t.start, toegepast), [t.start, toegepast])

  /* ------------------------------ de zetten ---------------------------- */

  const pasAan = () => {
    zet()
    setT((v) => (v.aangepast ? v : { ...v, aangepast: true, mis: false }))
  }
  const volgend = () => {
    zet()
    setT((v) => (!v.aangepast || v.cursor >= laatste ? v : { ...v, cursor: v.cursor + 1, aangepast: false, mis: false }))
  }
  const kies = (k: Richting) => {
    zet()
    setT((v) => {
      if (v.aangepast) return v
      const juist = richting(SPOREN[v.start].stappen[v.cursor]) === k
      return juist ? { ...v, aangepast: true, mis: false } : { ...v, mis: true }
    })
  }
  const nogEenKeer = () => {
    if (spelen !== null || !t.aangepast || t.cursor >= laatste) return
    zet()
    const eindeKeer = t.cursor + 3
    setT((v) => ({ ...v, cursor: v.cursor + 1, aangepast: true, mis: false }))
    setSpelen(Math.min(eindeKeer, laatste))
  }
  const begin = (s: Start) => {
    zet()
    setSpelen(null)
    setT({ start: s, cursor: 1, aangepast: false, mis: false })
  }

  /* DE FOCUS VOLGT DE VOLGENDE ZET, voor wie met het toetsenbord werkt. Bij
     elke zet gaat de knop die de focus had uit, of hij verdwijnt. Is de focus
     dan kwijt, dan gaat ze naar de knop die nu de volgende zet is. Wie ergens
     anders staat, wordt niet verplaatst. En niets bij het laden: dan heeft de
     leerling nog niets gedaan, en een focusring op een knop die hij niet
     aanraakte leest als "die is al ingedrukt". */
  useEffect(() => {
    if (zetten === 0) return
    const nu = document.activeElement
    const kwijt =
      !nu ||
      nu === document.body ||
      !nu.isConnected ||
      (nu instanceof HTMLButtonElement && nu.disabled)
    if (!kwijt) return
    paneel.current
      ?.querySelector<HTMLButtonElement>('[data-volgende="ja"]:not(:disabled)')
      ?.focus({ preventScroll: true })
  }, [zetten, spelen])

  /* ----------------------------- de indeling ---------------------------- */

  const briefR = ind?.briefR ?? 272
  const briefB = ind?.briefB ?? 240
  const w = ind?.w ?? 1024
  const h = ind?.h ?? 768
  const bandL = briefR + 16
  const paneelL = ind?.paneelL ?? w - 16 - 288
  /* DE BAND MAG HET PANEEL NIET VERDRINGEN. Hij schaalt mee met de breedte,
     maar ook met wat er onder hem overblijft: het paneel heeft in zijn hoogste
     toestand (de stop vanaf 0,6) gemeten 491 px nodig bij 18 rem breed en 432
     px bij 21 rem. Op 1180x720 gaf alleen de breedte schaal 1,3, en dan
     scrolde het paneel 23 px. */
  const paneelNodig = w - 16 - paneelL > 300 ? 440 : 500
  const schaal = Math.max(
    0.5,
    Math.min(
      MAX_SCHAAL,
      (w - 16 - bandL - 2 * BAND_RAND) / BW,
      (h - 16 - 12 - 16 - paneelNodig - 2 * BAND_RAND) / BH,
    ),
  )
  const bandH = Math.round(BH * schaal + 2 * BAND_RAND)
  const bandB = 16 + bandH
  const paneelTop = bandB + 12
  /* Het vrije vlak voor de grafiek. Onder 64 px voor de getallen en de naam
     van de x-as, en boven een rij van 22 px voor de naam van de y-as. Links
     staat de zoomrail van Canvas; de getallen van de y-as komen RECHTS van die
     rail, dus die ruimte gaat via `pad` en niet via `insets.left`. Canvas zet
     de rail op insets.left - 8, en met 56 px daar schoof hij recht over de
     y-getallen (gemeten op 1024x768: "0,55" stond onder de rail). */
  const insTop = Math.max(briefB, bandB) + 12 + 22
  const insRight = w - paneelL + 16
  const insets = useMemo(
    () => ({ top: insTop, right: insRight, bottom: 64, left: 0 }),
    [insTop, insRight],
  )

  /* ------------------------------- de zinnen ---------------------------- */

  const r = richting(a)
  const eerste7 = a.keer === 1 && a.pond === 7
  const tweede3 = a.keer === 2 && a.pond === 3
  const eersteTeWeinig = t.start === 3000 && t.cursor === 1

  /** Wat er net gebeurde, onder de knoppen. Gaat weg bij "Volgend voorbeeld",
   *  net als A3. */
  let gebeurd: string | null = null
  if (deel === 1 && t.aangepast) {
    gebeurd = `Het getal werd ${vier(Math.abs(a.aanpassing))} kleiner. Dat is ${FORMULE}.`
  } else if (deel === 2 && t.mis) {
    gebeurd = WELKE_REGEL[r]
  } else if (deel === 2 && t.aangepast) {
    gebeurd = eersteTeWeinig
      ? 'Nu is de uitvoer te weinig. Het getal wordt dus groter.'
      : eerste7
        ? 'Bij 7 pond is de aanpassing groter dan bij 3 pond. De fout is groter, en de invoer ook. Allebei zitten ze in de aanpassing.'
        : tweede3
          ? 'Bij 3 pond is de fout nu kleiner dan de eerste keer. Dus is de aanpassing ook kleiner.'
          : a.pond === 0
            ? 'Bij 0 pond is de invoer 0. Dan is de aanpassing ook 0.'
            : null
  } else if (deel === 2 && eersteTeWeinig) {
    gebeurd = `Het neuron begint nu met ${vier(t.start)}, het tweede getal uit de\u00a0les.`
  }

  /* De fouten van de keer die nu loopt, in deel 3. Een voorbeeld dat in deze
     keer nog niet aan de beurt was, staat er als streepje. */
  const keerNu = a.keer
  const foutenNu = [0, 1, 2].map((i) => {
    const plaats = (keerNu - 1) * 3 + i
    return plaats <= t.cursor ? sp.stappen[plaats] : null
  })

  return (
    <div ref={wortel} className="relative h-full w-full">
      <Canvas defaultView={kader} axes={false} insets={insets} pad={PAD} apiRef={canvas}>
        {(s) => <Grafiek s={s} punten={punten} />}
      </Canvas>

      {/* DE BRIEF: het doel en de drie regels, samen in de eerste alinea. Onder
          1280 px klapt alles na de eerste alinea in, en de regels moeten er op
          elk scherm staan: bij een verkeerde keuze licht de regel op die geldt.
          Dat oplichten is een achtergrond en een streep, nooit een vetter
          lettertype: vetter tekst kan een regel laten omslaan, dan wordt de
          Brief hoger en kadert de grafiek eronder opnieuw. */}
      <Brief eyebrow="mAIstros 2 - les 9" title={'Eén neuron zoekt zijn\u00a0getal'}>
        <div>
          <p>Voorbeeld per voorbeeld past het neuron zijn getal aan.</p>
          <ul className="mt-1.5 space-y-0.5 text-[13.5px] leading-snug">
            {REGELS.map((k) => {
              const aan = t.mis && k === r
              return (
                <li
                  key={k}
                  data-regel={k}
                  data-aan={aan ? 'ja' : undefined}
                  className={`-mx-1.5 rounded-md px-1.5 py-px transition-colors ${
                    aan ? 'bg-navy/[0.07] text-navy' : ''
                  }`}
                  style={aan ? { boxShadow: `inset 3px 0 0 ${NAVY}` } : undefined}
                >
                  {REGEL[k]}
                </li>
              )
            })}
          </ul>
        </div>
      </Brief>

      {/* DE BAND: het neuron, vast op het scherm. Hij loopt tot de rechterrand,
          net als het paneel eronder, en het neuron staat in het midden. Vanaf
          1280 px is er meer ruimte dan de band bij schaal 1,3 nodig heeft, en
          een band die links bleef hangen, liet rechtsboven een gat boven het
          paneel. */}
      <div
        data-rol="band"
        className="panel pointer-events-auto absolute right-4 top-4 z-10 flex justify-center rounded-xl"
        style={{ left: bandL, padding: BAND_RAND }}
      >
        <svg
          width={Math.round(BW * schaal)}
          height={Math.round(BH * schaal)}
          viewBox={`0 0 ${BW} ${BH}`}
          role="img"
          aria-label={bandTekst(a, t.aangepast)}
          className="block"
        >
          <Band a={a} aangepast={t.aangepast} />
        </svg>
      </div>

      <div
        ref={paneel}
        data-rol="paneel"
        className="panel pointer-events-auto absolute right-4 z-10 flex w-[18rem] flex-col overflow-y-auto rounded-xl px-4 py-3.5 xl:w-[21rem]"
        style={{ top: paneelTop, maxHeight: h - paneelTop - 16 }}
        onClickCapture={(e) => {
          if (tweedeKlik(e)) e.stopPropagation()
        }}
      >
        <Delen deel={deel} />

        <div className="mt-3 space-y-1.5 text-[13.5px] leading-snug text-ink">
          {deel === 1 && (
            <>
              <p>Het neuron begint met het getal {vier(t.start)}, net als in de{"\u00a0"}les.</p>
              <p>Bij 0 pond was de uitvoer 0, en dat was juist. Er viel niets aan te passen.</p>
              <p>
                Druk op{' '}
                <span className="font-semibold text-navy">
                  {t.aangepast ? 'Volgend voorbeeld' : 'Pas het getal aan'}
                </span>
                .
              </p>
            </>
          )}
          {deel === 2 && (
            <>
              <p>Neem het volgende voorbeeld.</p>
              <p>Kies daarna: wordt het getal kleiner, blijft het, of wordt het groter?</p>
            </>
          )}
          {deel === 3 && !klaar && (
            <p>Nog een keer: het neuron overloopt alle voorbeelden nog een keer.</p>
          )}
          {klaar && (
            <p>Alle fouten zijn nu kleiner dan 0,01. Dat is dicht genoeg: het neuron stopt.</p>
          )}
        </div>

        {/* DE KNOPPEN. Alleen de volgende zet staat aan. Na de stop is er
            geen knop meer op deze plaats, en dan ook geen lege rij. */}
        <div className={`flex flex-col gap-1.5 ${klaar ? '' : 'mt-3'}`}>
          {deel === 1 && (
            <>
              <Knop volgende={!t.aangepast} disabled={t.aangepast} onClick={pasAan}>
                Pas het getal aan
              </Knop>
              <Knop volgende={t.aangepast} disabled={!t.aangepast} onClick={volgend}>
                Volgend voorbeeld
              </Knop>
            </>
          )}
          {deel === 2 && (
            <>
              <Knop volgende={t.aangepast} disabled={!t.aangepast} onClick={volgend}>
                Volgend voorbeeld
              </Knop>
              <div role="group" aria-labelledby="neuron-keuze" className="mt-1">
                <div id="neuron-keuze" className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-ink/75">
                  Het getal
                </div>
                <div className="mt-1 grid grid-cols-3 gap-1.5">
                  {KEUZES.map((k, i) => (
                    <button
                      key={k}
                      type="button"
                      data-keuze={k}
                      data-volgende={!t.aangepast && i === 0 ? 'ja' : undefined}
                      aria-label={`Getal ${k}`}
                      disabled={t.aangepast}
                      onClick={() => kies(k)}
                      className="cf-btn cf-btn-ghost px-1"
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          {deel === 3 && !klaar && (
            <Knop volgende disabled={spelen !== null} onClick={nogEenKeer}>
              Nog een keer
            </Knop>
          )}
        </div>

        {/* Wat er net gebeurde. Een schermlezer leest het voor. */}
        <div aria-live="polite" className="text-[13.5px] leading-snug text-ink">
          {gebeurd && <p className="mt-3">{gebeurd}</p>}
        </div>

        {deel === 3 && (
          <>
            {/* DE FOUTEN VAN DEZE KEER, alle drie naast elkaar. De band toont
                maar één voorbeeld tegelijk, en de stopregel gaat over alle
                drie: zo is hij te zien. Het is ook waar "de fout wordt telkens
                kleiner" af te lezen is, keer na keer. */}
            <div className={klaar ? 'mt-2' : 'mt-3'}>
              {/* Na de stop staat de zin "Alle fouten zijn nu kleiner dan 0,01"
                  er vlak boven, en die is het opschrift. Een tweede opschrift
                  kostte op 900x700 de 22 px waardoor het paneel ging scrollen. */}
              {!klaar && (
                <div className="mb-1 text-[12.5px] font-semibold text-ink/80">
                  Fouten bij de {getal(keerNu)}e keer overlopen
                </div>
              )}
              <div className="grid grid-cols-3 gap-1.5 text-center">
                {foutenNu.map((f, i) => (
                  <div key={i} className="rounded-lg bg-black/[0.035] px-1 py-1">
                    <div className="text-[11.5px] font-semibold text-ink/75">
                      {sp.stappen[i].pond} pond
                    </div>
                    <div
                      className="font-display text-[15px] font-extrabold tabular-nums"
                      style={{ color: f && f.fout !== 0 ? FOUT_INK : INK }}
                    >
                      {f ? vier(Math.abs(f.fout)) : '-'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {!klaar && (
              <p className="mt-2 text-[13.5px] leading-snug text-ink">
                Bij 3 pond en bij 7 pond wordt de fout telkens kleiner.
              </p>
            )}
          </>
        )}

        {klaar && (
          <>
            {/* DE VASTSTELLING, als zin en niet als groot getal: het nieuwe
                getal staat al groot en groen op de verbinding in de band, en een
                tweede groot getal kostte 33 px die er op 900x700 niet zijn. */}
            <p className="mt-3 text-[13.5px] leading-snug text-ink">
              Na {getal(sp.keren)} keer overlopen staat het getal op{' '}
              <span className="font-bold" style={{ color: DERDE_INK }}>
                {vier(a.nieuw)}
              </span>
              . Dat is bijna 0,454, het getal uit de{'\u00a0'}les.
            </p>
            <div className="mt-3">
              <Note>
                Hetzelfde getal 0,01 staat straks in je code bij Stap 2:{' '}
                <PyChip>learning_rate_init=0.01</PyChip>
              </Note>
            </div>
            {t.start === 6000 && (
              <p className="mt-3 text-[13.5px] leading-snug text-ink">
                Probeer nu {kort(3000)}, het tweede getal uit de{'\u00a0'}les.
              </p>
            )}
            <div className="mt-2.5 flex flex-col gap-1.5">
              {t.start === 6000 ? (
                <>
                  <Knop volgende onClick={() => begin(3000)}>
                    Begin bij {kort(3000)}
                  </Knop>
                  <Knop ghost onClick={() => begin(6000)}>
                    Begin opnieuw bij {kort(6000)}
                  </Knop>
                </>
              ) : (
                <Knop volgende onClick={() => begin(6000)}>
                  Begin opnieuw bij {kort(6000)}
                </Knop>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/** Een knop in de stijl van Btn uit Overlay (cf-btn), met een merkje voor de
 *  focus: `data-volgende` wijst de knop aan die de volgende zet is. Btn zelf
 *  geeft geen attributen door, en Overlay blijft ongewijzigd. */
function Knop({
  children,
  onClick,
  disabled,
  volgende = false,
  ghost = false,
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  volgende?: boolean
  ghost?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-volgende={volgende ? 'ja' : undefined}
      className={`cf-btn w-full ${ghost ? 'cf-btn-ghost' : 'cf-btn-primary'}`}
    >
      {children}
    </button>
  )
}
