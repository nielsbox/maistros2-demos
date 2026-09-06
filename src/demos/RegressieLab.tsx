import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import Canvas, {
  Dots,
  DragDot,
  LineShape,
  type CanvasApi,
  type View,
} from '../components/Canvas'
import { Brief, Btn, Divider, Note, Panel, PyChip, Readout } from '../components/Overlay'
import {
  bestFit,
  clamp,
  predict,
  r2,
  scoreLabel,
  seeded,
  sumSquaredError,
  type Line,
  type Point,
} from '../lib/regression'
import { DERDE, DERDE_INK, MODEL, MUTED, RULE } from '../lib/palette'

/* ------------------------------------------------------------------ *
 * Les 1 - Regressie-lab.
 *
 * Eén idee: JOUW DATA BEPAALT HET MODEL. Net als bij Teachable Machine
 * teken je hier nooit zelf iets. Je levert voorbeelden, je drukt op
 * Trainen, en dan test je wat eruit komt.
 *
 * Daarom staat er bewust GEEN sleepbare lijn op dit bord. Zelf een lijn
 * zoeken is het onderwerp van "Teken de lijn", en wat de score betekent
 * is het onderwerp van "Hoe goed past de lijn?". Dit bord laat alleen
 * zien dat de lijn verandert zodra de punten veranderen - en het zegt
 * het hardop zodra het model niet meer bij de data hoort.
 *
 * Trainen is hier wel ECHT zoeken geworden, met dezelfde afdaling als op
 * "Teken de lijn": de lijn vertrekt bij een slechte gok en schuift stap
 * voor stap naar de pasvorm. Zie ZOEKEN hieronder. Dat dient het doel van
 * dit bord: wie een punt verzet en opnieuw traint, ziet het zoeken opnieuw
 * lopen en ergens anders eindigen.
 *
 * Woordafspraak, en die is hier de halve les: de bolletjes met de data
 * heten ALTIJD "punt", de knop op de x-as heet ALTIJD "handvat".
 * Nooit door elkaar, ook niet in een aria-label. Wie denkt dat een punt
 * sleepbaar is, sleept eraan en wist het per ongeluk. "Schuifknop" is
 * gereserveerd voor de echte html-slider op "Hoe goed past de lijn?".
 * ------------------------------------------------------------------ */

/* Rolverdeling op dit bord, en verder niets:
 *   MODEL  de lijn
 *   DATA   de punten (staat in Dots, de standaard van Canvas)
 *   DERDE  het handvat op de x-as met zijn stippellijnen en zijn bolletje
 * Het handvat is niet fout en het is niet het model, dus het krijgt de derde
 * merkkleur. Het was #f59e0b, en dat stond in geen enkele tabel: het haalde
 * maar 2,15:1 op wit, te weinig om van ver een merk te zijn. */
const HANDVAT = DERDE
const HANDVAT_INK = DERDE_INK

const MAX_POINTS = 120

/** Duizendtallen met een vaste spatie: "11.288" leest een Nederlandstalige
 *  als elf-komma-iets.
 *
 *  Als escape geschreven en niet als los teken. Een harde spatie overleeft
 *  niet elke kopie: in de laatste build stond hier een gewone spatie, en dan
 *  kan "11 288" stilletjes over twee regels breken. */
const NBSP = '\u00a0'
function whole(v: number): string {
  if (!Number.isFinite(v)) return '-'
  const n = Math.round(v)
  return (n < 0 ? '-' : '') + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP)
}

/** Decimalen met een komma, zoals de leerlingen ze in hun schrift schrijven.
 *  De "-0,00" die toFixed van een piepklein negatief getal maakt, wordt 0,00. */
function dec(v: number, n = 1): string {
  if (!Number.isFinite(v)) return '-'
  const s = v.toFixed(n)
  return (s === `-${(0).toFixed(n)}` ? (0).toFixed(n) : s).replace('.', ',')
}

const roundTo = (v: number, step: number) => (step > 0 ? Math.round(v / step) * step : v)

/** Hoogteverschil tussen het hoogste en het laagste punt. */
function hoogteSpreiding(pts: Point[]): number {
  if (pts.length === 0) return 0
  const ys = pts.map((p) => p.y)
  return Math.max(...ys) - Math.min(...ys)
}

const prefersStil = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

/* ---------------------------- ZOEKEN ------------------------------ *
 * Dezelfde echte afdaling als op "Teken de lijn", geen glijbaan naar een
 * antwoord dat al bekend is.
 *
 * Ruwe afdaling ontspoort op dit bord: bij Huisprijs loopt x tot ruim 200
 * en y tot ver boven 700, dus de twee parameters hebben totaal verschillende
 * schalen en elke bruikbare stapgrootte is voor één van beide te groot. Erger
 * nog: de leerling klikt hier zijn eigen data bij elkaar, dus die schalen
 * liggen niet op voorhand vast. Daarom rekenen we intern in z-scores. Op
 * gestandaardiseerde data is de foutenkom perfect rond, dus één vaste
 * stapgrootte werkt voor élke dataset. Elke stap wordt meteen terugvertaald
 * naar een echte lijn, zodat de fout in de curve de ECHTE totale fout op de
 * punten van de leerling is.
 *
 * Er is hier geen lijn van de student om bij te vertrekken - met de hand een
 * lijn leggen is op dit bord bewust weggelaten - dus starten we bij de vlakke
 * lijn op de gemiddelde y: altijd hetzelfde gokken. Dat is een eerlijk slechte
 * start, en het is precies de lijn waar score 0 bij hoort.
 *
 * Nagerekend in node over 418 borden: de vier datasets, die datasets met een
 * uitschieter in elke hoek, 400 willekeurig geklikte borden van 2 tot 30 punten
 * over het zichtbare bereik, en de randgevallen (twee punten boven elkaar, twee
 * punten even hoog, drie keer hetzelfde punt, een sprong van een miljoen).
 * Resultaat over 9 108 stappen: 0 ontsporingen, 0 stappen waarin de fout steeg
 * (grootste stijging exact 0) en een eindlijn die op de vier datasets niet van
 * bestFit() te onderscheiden is. Ten opzichte van de beginfout blijft er
 * hoogstens 0,000053 % liggen, en de score verschilt hoogstens 5,3e-7 van die
 * van bestFit(), dus op twee decimalen nooit. Een percentage ten opzichte van
 * de eindfout staat er bewust niet bij: op een bord waar die fout zelf bijna
 * nul is hangt dat getal volledig af van de toevallige punten.
 * De lijn draait onderweg exact rond het zwaartepunt van de data en komt nooit
 * verder dan de eindlijn, dus ze kan tijdens het zoeken niet van het bord
 * schieten.
 */
const STEPS = 22
const RATE = 0.14

/** Vroege stappen wat vlotter, latere trager: samen ongeveer drie seconden. */
const stepMs = (k: number) => 120 + (45 * k) / (STEPS - 1)

type Attempt = { line: Line; error: number }

/** De start van elke training: altijd hetzelfde gokken. */
function startLijn(points: Point[]): Line {
  return { a: 0, b: points.reduce((s, p) => s + p.y, 0) / points.length }
}

/**
 * Eén training. Geeft de lijn en de echte totale fout na elke stap terug.
 * Een lege reeks betekent: hier valt niets te zoeken, want alle punten liggen
 * op één hoogte of op één verticale. De aanroeper zet dan meteen bestFit() neer.
 */
function zoek(points: Point[], start: Line): Attempt[] {
  const n = points.length
  if (n < 2) return []
  const mx = points.reduce((s, p) => s + p.x, 0) / n
  const my = points.reduce((s, p) => s + p.y, 0) / n
  const sx = Math.sqrt(points.reduce((s, p) => s + (p.x - mx) ** 2, 0) / n)
  const sy = Math.sqrt(points.reduce((s, p) => s + (p.y - my) ** 2, 0) / n)
  if (!(sx > 1e-9) || !(sy > 1e-9)) return []

  const zx = points.map((p) => (p.x - mx) / sx)
  const zy = points.map((p) => (p.y - my) / sy)

  // De startlijn, uitgedrukt in z-scores.
  let A = (start.a * sx) / sy
  let B = (start.a * mx + start.b - my) / sy

  const out: Attempt[] = []
  for (let k = 0; k < STEPS; k++) {
    let dA = 0
    let dB = 0
    for (let i = 0; i < n; i++) {
      const miss = A * zx[i] + B - zy[i]
      dA += miss * zx[i]
      dB += miss
    }
    A -= (RATE * 2 * dA) / n
    B -= (RATE * 2 * dB) / n

    const a = (A * sy) / sx
    const line: Line = { a, b: my + sy * B - a * mx }
    out.push({ line, error: sumSquaredError(points, line) })
  }
  return out
}

/* ----------------------------- datasets ---------------------------- */

type DsId = 'schoen' | 'huis' | 'geen' | 'leeg'

type Dataset = {
  chip: string
  points: Point[]
  xLabel: string
  yLabel: string
  /** Eenheid achter de voorspelling; de score heeft er geen. */
  yUnit?: string
  view: View
  predX: number
  predStep: number
  addSnap: { x: number; y: number }
  fmtY: (y: number) => string
  fmtX: (x: number) => string
  predSub: (x: number) => string
}

type DsSpec = Omit<Dataset, 'points' | 'view' | 'predX'>

/**
 * Het beeld volgt uit de data zelf, zodat elke dataset hetzelfde opent.
 *
 * Het bord opent bewust RUIM: de oefening van dit bord is "zet eens een punt
 * ver buiten de wolk en train opnieuw". Met een randje van een tiende erboven
 * was daar geen plaats voor - bij Schoenmaat bleef er drie centimeter over.
 * Nu is er aan elke kant zowat een derde van de dataset vrij, en wie meer
 * nodig heeft, zoomt uit.
 */
const PAD_X = 0.25
const PAD_ONDER = 0.3
const PAD_BOVEN = 0.4

function build(points: Point[], spec: DsSpec): Dataset {
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const x0 = Math.min(...xs)
  const x1 = Math.max(...xs)
  const y0 = Math.min(...ys)
  const y1 = Math.max(...ys)
  const wx = x1 - x0 || 1
  const wy = y1 - y0 || 1
  return {
    ...spec,
    points,
    view: {
      x0: x0 - PAD_X * wx,
      x1: x1 + PAD_X * wx,
      y0: y0 - PAD_ONDER * wy,
      y1: y1 + PAD_BOVEN * wy,
    },
    predX: roundTo((x0 + x1) / 2, spec.predStep),
  }
}

const SCHOEN: Point[] = (() => {
  const rnd = seeded(55)
  const pts: Point[] = []
  for (let i = 0; i < 24; i++) {
    const maat = 36 + Math.round(rnd() * 10)
    pts.push({ x: maat, y: Math.round(2.6 * maat + 64 + (rnd() - 0.5) * 16) })
  }
  return pts
})()

const HUIS: Point[] = (() => {
  const rnd = seeded(17)
  const pts: Point[] = []
  for (let i = 0; i < 22; i++) {
    const opp = 61 + Math.round(rnd() * 145)
    pts.push({ x: opp, y: Math.round(3.2 * opp + 95 + (rnd() - 0.5) * 70) })
  }
  return pts
})()

// Twee losse trekkingen per rij: er zit dus echt geen verband in.
const GEEN: Point[] = (() => {
  const rnd = seeded(101)
  const pts: Point[] = []
  for (let i = 0; i < 26; i++) {
    pts.push({ x: 3 + Math.round(rnd() * 8), y: 4 + Math.round(rnd() * 15) })
  }
  return pts
})()

const DATASETS: Record<DsId, Dataset> = {
  schoen: build(SCHOEN, {
    chip: 'Schoenmaat',
    xLabel: 'schoenmaat',
    yLabel: 'lengte (cm)',
    yUnit: 'cm',
    predStep: 1,
    addSnap: { x: 1, y: 1 },
    fmtY: (y) => whole(y),
    fmtX: (x) => whole(x),
    predSub: (x) => `bij schoenmaat ${whole(x)}`,
  }),
  huis: build(HUIS, {
    chip: 'Huisprijs',
    xLabel: 'oppervlakte (m²)',
    yLabel: 'prijs (duizend euro)',
    yUnit: 'duizend euro',
    predStep: 5,
    addSnap: { x: 5, y: 5 },
    fmtY: (y) => whole(y),
    fmtX: (x) => whole(x),
    predSub: (x) => `bij ${whole(x)} m²`,
  }),
  geen: build(GEEN, {
    chip: 'Geen verband',
    xLabel: 'letters in je voornaam',
    // Bewust NIET "punten op de toets": punt is hier het woord voor een
    // bolletje data, en datzelfde woord voor een toetscijfer verwart.
    yLabel: 'minuten naar school',
    yUnit: 'minuten',
    predStep: 1,
    addSnap: { x: 1, y: 1 },
    fmtY: (y) => whole(y),
    fmtX: (x) => whole(x),
    predSub: (x) => `bij ${whole(x)} letters`,
  }),
  leeg: {
    chip: 'Leeg bord',
    points: [],
    xLabel: 'x',
    yLabel: 'y',
    // Leeg bord, dus de ruimte staat hier gewoon vast.
    view: { x0: -0.5, x1: 10.5, y0: -2, y1: 12 },
    predX: 5,
    predStep: 0.5,
    addSnap: { x: 0.5, y: 0.5 },
    fmtY: (y) => dec(y, 1),
    fmtX: (x) => dec(x, 1),
    predSub: (x) => `bij x-waarde ${dec(x, 1)}`,
  },
}

const PICKER: { id: DsId; label: string }[] = [
  { id: 'schoen', label: DATASETS.schoen.chip },
  { id: 'huis', label: DATASETS.huis.chip },
  { id: 'geen', label: DATASETS.geen.chip },
  { id: 'leeg', label: DATASETS.leeg.chip },
]

/** Wat er na Trainen op het bord staat. De score hoort bij dit model en bij
 *  de punten waarop het getraind is, dus hij wordt hier één keer bewaard in
 *  plaats van live herrekend: zo zie je hem pas veranderen als je opnieuw
 *  traint. `score` is null als alle punten even hoog liggen. */
type Model = { line: Line; score: number | null }

/* ----------------------------- component --------------------------- */

export default function RegressieLab() {
  const [dsId, setDsId] = useState<DsId>('schoen')
  const ds = DATASETS[dsId]

  const [points, setPoints] = useState<Point[]>(() => [...DATASETS.schoen.points])
  const [predX, setPredX] = useState(() => DATASETS.schoen.predX)

  // Het getrainde model. null = nog nooit getraind, dus geen lijn op het bord.
  const [model, setModel] = useState<Model | null>(null)
  // De data is veranderd sinds de laatste training.
  const [verouderd, setVerouderd] = useState(false)
  // Tussenstand terwijl het zoeken loopt: de lijn van de huidige stap.
  const [anim, setAnim] = useState<Line | null>(null)
  const [bezig, setBezig] = useState(false)
  /** Eén punt per poging: de fout van de startlijn, dan die van elke stap.
   *  Blijft staan na de training, zodat je twee trainingen kan vergelijken. */
  const [curve, setCurve] = useState<number[]>([])

  const api = useRef<CanvasApi | null>(null)
  const timer = useRef<number | null>(null)
  /** Het model en de volledige curve die aan het einde van het zoeken op het
   *  bord komen. Ook nodig als de leerling er middenin iets verandert. */
  const wacht = useRef<{ model: Model; curve: number[] } | null>(null)

  // Het beeld dat de leerling NU ziet, niet het beeld waarmee de dataset
  // opende: hij mag uitzoomen en dan ook daarbuiten punten zetten.
  const viewRef = useRef<View>(ds.view)
  const rememberView = useCallback((v: View) => {
    viewRef.current = v
  }, [])

  // Een lopend zoekwerk mag nooit een unmounted bord blijven bijwerken.
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    },
    [],
  )

  /** Zet het zoeken stil. Het model dat er staat, blijft staan. */
  const stopZoeken = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
    wacht.current = null
    setAnim(null)
    setBezig(false)
  }, [])

  /** Stopt het zoeken en zet meteen het model neer waar het naartoe ging, met
   *  de volledige curve erbij. Halverwege afbreken zou anders een lijn
   *  achterlaten die bij niets hoort. */
  const rondAf = useCallback(() => {
    const klaar = wacht.current
    stopZoeken()
    if (klaar) {
      setModel(klaar.model)
      setCurve(klaar.curve)
      setVerouderd(false)
    }
  }, [stopZoeken])

  /** Gooit het getrainde model weg. Er staat dan geen lijn meer op het bord,
   *  geen score in het paneel, geen voorspelling en geen curve.
   *
   *  Dit hoort bij elke wissel van dataset. Een score van de vorige dataset
   *  naast "0 punten" laten staan is gewoon een leugen op het scherm: het
   *  getal hoort bij data die er niet meer is. Alleen wie de punten van de
   *  HUIDIGE dataset aanpast, krijgt het oude model te zien, want daar leert
   *  hij iets van. */
  const wisModel = useCallback(() => {
    stopZoeken()
    setModel(null)
    setVerouderd(false)
    setCurve([])
  }, [stopZoeken])

  const kanTrainen = points.length >= 2
  const lijn = anim ?? model?.line ?? null
  const badge = model?.score != null ? scoreLabel(model.score) : null
  // Twee verschillende "oud": de LIJN schuift tijdens het zoeken al naar de
  // nieuwe pasvorm, dus die tekenen we dan gewoon vol. Het CIJFER hoort nog
  // bij de vorige training tot het zoeken klaar is, dus dat blijft grijs.
  const oud = verouderd && !bezig

  /* ------------------------------ data ----------------------------- */

  /** Elke wijziging aan de punten maakt het getrainde model verouderd. */
  function dataGewijzigd() {
    const wasErEenModel = model !== null || wacht.current !== null
    rondAf()
    if (wasErEenModel) setVerouderd(true)
  }

  function addPoint(w: Point) {
    // Een klik in de asrand valt naast het bord en zou een punt ergens in het
    // niets zetten. Alles wat je WEL ziet mag wel, ook ver buiten de wolk.
    const v = viewRef.current
    if (w.x < v.x0 || w.x > v.x1 || w.y < v.y0 || w.y > v.y1) return
    if (points.length >= MAX_POINTS) return
    dataGewijzigd()
    setPoints((prev) =>
      prev.length >= MAX_POINTS
        ? prev
        : [...prev, { x: roundTo(w.x, ds.addSnap.x), y: roundTo(w.y, ds.addSnap.y) }],
    )
  }

  function removePoint(i: number) {
    dataGewijzigd()
    setPoints((prev) => prev.filter((_, k) => k !== i))
  }

  /** Andere data, dus ook een ander model. Alles gaat weg: de lijn, de score,
   *  de voorspelling en de curve. Het bord staat weer op "nog niet getraind". */
  function kiesDataset(id: DsId) {
    if (id === dsId) return
    wisModel()
    setDsId(id)
    setPoints([...DATASETS[id].points])
    setPredX(DATASETS[id].predX)
    api.current?.reset()
  }

  /* ---------------------------- trainen ---------------------------- */

  function train() {
    if (!kanTrainen || bezig) return
    rondAf()

    // Liggen alle punten even hoog, dan is "altijd hetzelfde gokken" al
    // perfect en zegt de score niets: r2 geeft dan 0, en dat zou naast een
    // lijn die er dwars doorheen loopt een tegenspraak op het scherm zijn.
    const vlak = hoogteSpreiding(points) < 1e-4
    const maakModel = (l: Line): Model => ({ line: l, score: vlak ? null : r2(points, l) })

    const start = startLijn(points)
    const spoor = zoek(points, start)

    // Vlakke of verticale data: elke lijn door het gemiddelde is even goed, dus
    // er valt niets te zoeken. Meteen het antwoord, en geen curve die doet
    // alsof er iets gedaald is.
    if (spoor.length === 0) {
      setModel(maakModel(bestFit(points)))
      setVerouderd(false)
      setCurve([])
      return
    }

    const eind = maakModel(spoor[spoor.length - 1].line)
    const volledig = [sumSquaredError(points, start), ...spoor.map((a) => a.error)]

    if (prefersStil()) {
      setModel(eind)
      setVerouderd(false)
      setCurve(volledig)
      return
    }

    // Eerst alleen de startlijn en het eerste punt van de curve. Het bord
    // herkadert daardoor vóór de lijn begint te bewegen, niet ertijdens.
    wacht.current = { model: eind, curve: volledig }
    setBezig(true)
    setAnim(start)
    setCurve([volledig[0]])

    const stap = (k: number) => {
      setAnim(spoor[k].line)
      setCurve(volledig.slice(0, k + 2))
      if (k + 1 < spoor.length) {
        timer.current = window.setTimeout(() => stap(k + 1), stepMs(k + 1))
      } else {
        timer.current = null
        rondAf()
      }
    }
    timer.current = window.setTimeout(() => stap(0), stepMs(0))
  }

  function opnieuw() {
    wisModel()
    setPoints([...ds.points])
    setPredX(ds.predX)
    api.current?.reset()
  }

  /* ---------------------------- aflezen ---------------------------- */

  const scoreValue = bezig || !model || model.score === null ? '-' : dec(model.score, 2)
  const scoreSub = bezig
    ? // Tijdens het zoeken hoort er nog geen cijfer te staan: het cijfer is
      // het resultaat, en het oude cijfer hoort bij een lijn die al weg is.
      'aan het trainen'
    : !model
      ? kanTrainen
        ? 'nog niet getraind'
        : 'zet minstens twee punten'
      : model.score === null
        ? 'alle punten liggen even hoog'
        : verouderd
          ? // Zelfde woorden als het label op het bord en als de tip eronder:
            // het gaat drie keer over hetzelfde oude model.
            'van het oude model'
          : badge?.label
  const scoreColor = bezig || !model || verouderd ? MUTED : (badge?.color ?? MUTED)

  const voorspelling = lijn ? predict(lijn, predX) : null

  /* ----------------------------- render ---------------------------- */

  return (
    <div className="relative h-full w-full">
      <Canvas
        defaultView={ds.view}
        xLabel={ds.xLabel}
        yLabel={ds.yLabel}
        apiRef={api}
        onBoardClick={addPoint}
        onViewChange={rememberView}
      >
        {(s) => {
          const markY = s.view.y0 + 0.05 * (s.view.y1 - s.view.y0)
          const predY = voorspelling
          const predInBeeld = predY !== null && predY > s.view.y0 && predY < s.view.y1
          // Label bij de oude lijn, maar alleen als die lijn ook echt in beeld
          // ligt: wie een punt ver weg zet, duwt ze soms buiten het bord.
          const oudX = s.view.x0 + 0.74 * (s.view.x1 - s.view.x0)
          const oudY = lijn ? predict(lijn, oudX) : 0
          const oudInBeeld = oud && lijn !== null && oudY > s.view.y0 && oudY < s.view.y1

          return (
            <>
              <ViewProbe view={s.view} onView={rememberView} />

              {lijn && (
                <LineShape
                  line={lijn}
                  scales={s}
                  color={MODEL}
                  width={oud ? 2.5 : 3}
                  dashed={oud}
                  opacity={oud ? 0.4 : 1}
                />
              )}

              <Dots
                points={points}
                scales={s}
                r={5}
                onPointClick={removePoint}
                title={() => 'klik om dit punt weg te halen'}
              />

              {/* Na de punten getekend, anders verdwijnt dit label eronder. */}
              {oudInBeeld && (
                <text
                  x={s.sx(oudX)}
                  y={s.sy(oudY) - 14}
                  textAnchor="middle"
                  fontSize={13}
                  fontWeight={700}
                  fill={MUTED}
                  stroke="#fff"
                  strokeWidth={3.5}
                  paintOrder="stroke"
                  pointerEvents="none"
                >
                  oud model
                </text>
              )}

              {!kanTrainen && (
                <text
                  x={s.area.left + s.area.w * 0.58}
                  y={s.area.top + s.area.h * 0.4}
                  textAnchor="middle"
                  fontSize={13.5}
                  fontWeight={600}
                  fill={MUTED}
                  stroke="#fff"
                  strokeWidth={3.5}
                  paintOrder="stroke"
                  pointerEvents="none"
                >
                  {points.length === 0
                    ? 'Klik op het bord om punten te zetten.'
                    : 'Zet er nog een punt bij. Met twee punten kan je trainen.'}
                </text>
              )}

              {/* Van de gekozen x-waarde omhoog naar de lijn en dan naar de
                  y-as. Pas zodra er een getraind model is: zonder model valt
                  er niets te voorspellen. */}
              {predY !== null && (
                <g pointerEvents="none" opacity={oud ? 0.45 : 1}>
                  <line
                    x1={s.sx(predX)}
                    y1={s.sy(markY)}
                    x2={s.sx(predX)}
                    y2={s.sy(predY)}
                    stroke={HANDVAT}
                    strokeWidth={1.75}
                    strokeDasharray="5 5"
                  />
                  <line
                    x1={s.sx(predX)}
                    y1={s.sy(predY)}
                    x2={s.area.left}
                    y2={s.sy(predY)}
                    stroke={HANDVAT}
                    strokeWidth={1.75}
                    strokeDasharray="5 5"
                  />
                  <circle
                    cx={s.sx(predX)}
                    cy={s.sy(predY)}
                    r={5.5}
                    fill={HANDVAT}
                    stroke="#fff"
                    strokeWidth={2}
                  />
                  {predInBeeld && (
                    <text
                      x={s.sx(predX) + 12}
                      y={s.sy(predY) - 11}
                      fontSize={14}
                      fontWeight={700}
                      fill={HANDVAT_INK}
                      stroke="#fff"
                      strokeWidth={3.5}
                      paintOrder="stroke"
                    >
                      {ds.fmtY(predY)}
                    </text>
                  )}
                </g>
              )}

              {predY !== null && (
                <>
                  <DragDot
                    point={{ x: predX, y: markY }}
                    scales={s}
                    // Meebewegen met wat er te zien is: na uitzoomen of
                    // verschuiven mag het handvat ook naar de nieuwe rand.
                    onMove={(p) => {
                      const v = viewRef.current
                      setPredX(roundTo(clamp(p.x, v.x0, v.x1), ds.predStep))
                    }}
                    color={HANDVAT}
                    r={8}
                    cursor="ew-resize"
                    step={{ x: ds.predStep, y: ds.predStep }}
                    bounds={{ y: [markY, markY] }}
                    ariaLabel="handvat: kies een x-waarde"
                  />
                  {/* Eigen label in plaats van dat van DragDot: op een beamer
                      moet ook dit getal een witte rand hebben. */}
                  <text
                    x={s.sx(predX) + 15}
                    y={s.sy(markY) + 5}
                    fontSize={13.5}
                    fontWeight={700}
                    fill={HANDVAT_INK}
                    stroke="#fff"
                    strokeWidth={3.5}
                    paintOrder="stroke"
                    pointerEvents="none"
                  >
                    {ds.fmtX(predX)}
                  </text>
                </>
              )}

            </>
          )
        }}
      </Canvas>

      {/* Eén regel doel, dan één blokje uitleg. Uitgeklapt is deze Brief
          190 px hoog op een 1024x768-scherm, en het paneel hieronder begint
          op 221 px: met een tweede alinea erbij gingen ze over elkaar heen. */}
      <Brief eyebrow="mAIstros 2 - les 1" title="Regressie-lab">
        <p>Jouw data bepaalt het model.</p>
        <p>Je tekent hier zelf geen lijn. Jij levert de punten. Druk daarna op Trainen.</p>
      </Brief>

      {/* Gemeten op 1024x768: dit paneel is 531 px hoog in zijn hoogste stand
          (met de waarschuwing erbij), begint dus op 221 px en blijft onder de
          576 px die de max-h hier toelaat. Geen scrollbalk, en de uitgeklapte
          Brief hierboven stopt op 190 px. De foutcurve staat daarom in een
          eigen paneel rechtsonder en niet als extra blok hierin: er is nog
          zowat 45 px over, en de curve is 140 px hoog. */}
      <Panel className="pointer-events-auto absolute bottom-4 left-4 z-10 max-h-[calc(100%-12rem)] w-[16rem] overflow-y-auto px-4 py-3 xl:w-[21rem]">
        <Sec label="Data" meta={`${points.length} ${points.length === 1 ? 'punt' : 'punten'}`} />
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {PICKER.map((o) => (
            <SegBtn
              key={o.id}
              active={o.id === dsId}
              onClick={() => kiesDataset(o.id)}
              label={o.label}
            />
          ))}
        </div>
        <p className="mt-2 text-[13px] leading-snug text-ink/80">
          Klik op het bord: punt erbij.
          <br />
          Klik op een punt: punt weg.
        </p>

        <Divider />

        <Sec label="Trainen" meta={<PyChip>regr.fit(x, y)</PyChip>} />
        <div className="mt-3 flex gap-2">
          <div className="min-w-0 flex-1">
            <Btn onClick={train} disabled={!kanTrainen || bezig} full>
              Trainen
            </Btn>
          </div>
          <div className="shrink-0">
            <Btn onClick={opnieuw} variant="ghost">
              Begin opnieuw
            </Btn>
          </div>
        </div>
        <div className="mt-3">
          <Readout label="Score" value={scoreValue} sub={scoreSub} color={scoreColor} />
        </div>

        {/* Eén plek voor de tip, zodat de hoogte van het paneel niet
            verspringt terwijl de leerling bezig is. De tip noemt de knop
            "Trainen" letterlijk: "train opnieuw" stuurt een leerling naar
            de knop "Begin opnieuw" ernaast, en die gooit zijn werk weg.

            Tijdens het zoeken heeft "druk op Trainen" geen zin: dat duurt nu
            drie seconden en de knop staat al uit. Deze regel is even lang als
            die waarschuwing, dus het paneel blijft even hoog. */}
        {bezig ? (
          <div className="mt-2.5">
            <Note>De computer probeert lijn na lijn. Rechtsonder zie je de fout dalen.</Note>
          </div>
        ) : verouderd ? (
          <div className="mt-2.5">
            <Note tone="warn">
              Je data is veranderd. Het model is nog het oude. Druk op Trainen.
            </Note>
          </div>
        ) : model ? (
          <div className="mt-2.5">
            <Note>Zet een punt ver van de rest. Druk daarna op Trainen.</Note>
          </div>
        ) : null}

        <Divider />

        <Sec label="Voorspellen" meta={lijn ? 'sleep het handvat' : undefined} />
        <div className="mt-2">
          <Readout
            label="Voorspelling"
            value={voorspelling === null ? '-' : ds.fmtY(voorspelling)}
            unit={voorspelling === null ? undefined : ds.yUnit}
            sub={voorspelling === null ? 'train eerst een model' : ds.predSub(predX)}
            color={voorspelling === null || oud ? MUTED : HANDVAT_INK}
          />
        </div>
      </Panel>

      {/*
        De foutcurve, als eigen paneel. Twee redenen om het niet bij het paneel
        links te zetten: dat zit met 531 van de 576 px bijna vol, en de curve
        hoort bij wat er OP het bord gebeurt, niet bij de knoppen.

        Het draagt zelf de klasse "panel", dus Canvas meet het mee en houdt de
        astekst eronder vandaan. Het verschijnt één tik vóór de eerste stap, dus
        het bord herkadert vóór de lijn begint te bewegen.

        pointer-events-auto, en dat is hier geen detail: een klik op het bord
        zet een punt, dus een paneel dat klikken doorlaat zou een punt achter de
        curve zetten.

        Maat: 200 breed, 2 rand + 20 padding + 16 kopje + 6 marge + 96 svg
        = 140 hoog. Rechtsonder is vrij: de zoomknoppen staan op de linkerrail.

        Het paneel staat er ALTIJD, ook voor de eerste training. Zijn breedte is
        een inset voor Canvas, dus als het zou verschijnen en verdwijnen, zou het
        bord bij elke Trainen en elke Begin opnieuw opnieuw kaderen - op 1024
        breed rekt de x-as dan 1,45x uit. Leeg toont het alleen zijn assen.
      */}
      <Panel className="pointer-events-auto absolute bottom-4 right-4 z-10 w-[200px] px-3 py-2.5">
        <div className="text-[11px] font-semibold uppercase leading-4 tracking-[0.11em] text-muted">
          Trainen
        </div>
        <div className="mt-1.5">
          <FoutCurve values={curve} oud={oud} />
        </div>
      </Panel>
    </div>
  )
}

/* ------------------------------ helpers ---------------------------- */

/**
 * Canvas geeft zijn schalen alleen aan de tekenfunctie mee, en zijn eigen
 * beeldwissels (openen, Fit, venster verkleinen) lopen niet via onViewChange.
 * Dit onzichtbare hulpje schrijft het huidige beeld NA de render in een ref,
 * zodat klikken en het handvat rekenen met het bord dat de leerling echt
 * ziet. Tijdens de render iets in een ref schrijven mag niet.
 */
function ViewProbe({ view, onView }: { view: View; onView: (v: View) => void }) {
  useEffect(() => {
    onView(view)
  }, [view, onView])
  return null
}

/**
 * De fout per poging, zonder getallen: alleen de vorm telt. Bij data met een
 * duidelijk verband duikt de curve naar de bodem; bij "Geen verband" blijft ze
 * bijna bovenaan hangen, want daar valt weinig te verbeteren. Dat verschil is
 * precies wat twee trainingen naast elkaar laten zien.
 *
 * De hoogte staat vast op de eerste poging, dus de curve herschaalt niet onder
 * je ogen terwijl ze zich opbouwt - en ze vergelijkt binnen één training, nooit
 * tussen twee trainingen door: daarom staan er geen getallen bij.
 *
 * Zonder waarden tekent ze alleen haar assen. Dat is met opzet: het paneel mag
 * niet verschijnen of verdwijnen, want zijn breedte bepaalt hoe Canvas kadert.
 */
function FoutCurve({ values, oud }: { values: number[]; oud: boolean }) {
  const W = 174
  const H = 96
  const L = 4
  const R = W - 4
  const T = 18
  const B = 74

  const leeg = values.length === 0
  const top = values[0] > 0 ? values[0] : 1
  const px = (i: number) => L + (i / STEPS) * (R - L)
  const py = (v: number) => B - (Math.max(0, v) / top) * (B - T)

  const last = values.length - 1
  const path = values.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ')
  // Hoort de curve nog bij het model dat er staat? Zo niet, dan vergrijst ze
  // mee met de streepjeslijn van het oude model.
  const kleur = oud ? MUTED : MODEL

  return (
    <svg
      className="block"
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="De totale fout na elke poging tijdens het trainen."
    >
      <line x1={L} y1={T - 4} x2={L} y2={B} stroke={RULE} strokeWidth={1} />
      <line x1={L} y1={B} x2={R} y2={B} stroke={RULE} strokeWidth={1} />
      <text x={L - 2} y={10} fontSize={10.5} fontWeight={600} fill={MUTED}>
        fout
      </text>
      <text x={R} y={H - 3} textAnchor="end" fontSize={10.5} fontWeight={600} fill={MUTED}>
        poging
      </text>
      {leeg && (
        <text
          x={(L + R) / 2}
          y={(T + B) / 2 + 4}
          textAnchor="middle"
          fontSize={11}
          fill={MUTED}
          opacity={0.75}
        >
          nog niet getraind
        </text>
      )}
      <polyline
        points={path}
        fill="none"
        stroke={kleur}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={oud ? 0.55 : 1}
      />
      {!leeg && (
        <circle
          cx={px(last)}
          cy={py(values[last])}
          r={3}
          fill={kleur}
          stroke="#fff"
          strokeWidth={1.5}
          opacity={oud ? 0.55 : 1}
        />
      )}
    </svg>
  )
}

/** Kopje van een blok in het paneel, met eventueel een kort cijfer rechts. */
function Sec({ label, meta }: { label: string; meta?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.11em] text-muted">
        {label}
      </span>
      {meta && <span className="text-[11.5px] leading-none text-muted/80">{meta}</span>}
    </div>
  )
}

/** Eén keuze uit de kiezer van de data set. De rand blijft staan als hij actief is,
 *  anders verspringt het raster een pixel bij elke wissel. */
function SegBtn({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-lg border px-2 py-1.5 text-[12.5px] font-semibold transition ${
        active
          ? 'border-model bg-model text-white'
          : 'border-model/20 text-model hover:bg-model/6'
      }`}
    >
      {label}
    </button>
  )
}
