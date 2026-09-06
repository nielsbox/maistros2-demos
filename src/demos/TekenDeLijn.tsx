import { useEffect, useMemo, useRef, useState } from 'react'
import Canvas, { Dots, DragDot, LineShape, Residuals } from '../components/Canvas'
import { Brief, Btn, Divider, Legend, Note, Panel, PyChip, Readout } from '../components/Overlay'
import { predict, seeded, sumSquaredError, type Line, type Point } from '../lib/regression'

/* ------------------------------------------------------------------ *
 * Les 1 - Teken de lijn.
 *
 * Eén idee: TRAINEN IS ZOEKEN. De student sleept twee punten en ziet de
 * totale fout mee bewegen; daarna zoekt de machine verder vanaf precies
 * die lijn. Verder niets op het bord.
 *
 * Het zoeken is echt, geen animatie naar een vooraf gekend antwoord: het
 * bord daalt stap voor stap af op de fout, vertrekkend bij de lijn van de
 * student. Zie ZOEKEN hieronder.
 * ------------------------------------------------------------------ */

const VIEW = { x0: 0, x1: 11, y0: 0, y1: 110 }

/** De twee grepen staan vast op deze x-posities; alleen hun hoogte beweegt. */
const HANDLE_X = [1, 10] as const
const Y_MIN = 3
const Y_MAX = 107

/** Bewust een slechte start: vlak en veel te laag. */
const START: [number, number] = [30, 30]

const POINTS: Point[] = (() => {
  const rnd = seeded(7)
  const pts: Point[] = []
  for (let x = 1; x <= 10; x++) pts.push({ x, y: 7.5 * x + 14 + (rnd() - 0.5) * 22 })
  return pts
})()

/* --------------------------- de marks ---------------------------- *
 * Gevalideerde bordkleuren (zie index.css): het model, de misser, de data.
 * Niet met de hand bijstellen. */
const MODEL = '#4c6fe0'
const MISS = '#b8791f'
const DATA = '#00065d'

/* ---------------------------- ZOEKEN ------------------------------ *
 * Echte afdaling op de fout, niet een glijbaan naar een gekend antwoord.
 *
 * Ruwe afdaling op deze data ontspoort: x loopt tot 10 en y tot 100, dus de
 * twee parameters hebben totaal verschillende schalen en elke bruikbare
 * stapgrootte is voor één van beide te groot. Daarom rekenen we intern in
 * z-scores. Op gestandaardiseerde data is de foutenkom perfect rond, dus
 * één vaste stapgrootte werkt voor élke startlijn. Elke stap wordt meteen
 * terugvertaald naar een echte lijn, zodat de fout die het bord toont de
 * ECHTE totale fout op de originele punten is.
 *
 * Nagerekend in node over 525 startlijnen (een 15x15-raster over het hele
 * sleepbereik plus 300 willekeurige): geen enkele ontspoort, de totale fout
 * daalt bij élke stap (grootste stijging 0), de eindlijn zit op 1,000025x de
 * fout van bestFit() en de grepen wijken hoogstens 0,061 af - ruim onder een
 * halve pixel. De grepen verlaten onderweg nooit [3, 107], dus er hoeft
 * tijdens het zoeken niets afgekapt te worden.
 */
const STEPS = 22
const RATE = 0.14

const N = POINTS.length
const MX = POINTS.reduce((s, p) => s + p.x, 0) / N
const MY = POINTS.reduce((s, p) => s + p.y, 0) / N
const SX = Math.sqrt(POINTS.reduce((s, p) => s + (p.x - MX) ** 2, 0) / N)
const SY = Math.sqrt(POINTS.reduce((s, p) => s + (p.y - MY) ** 2, 0) / N)
const ZX = POINTS.map((p) => (p.x - MX) / SX)
const ZY = POINTS.map((p) => (p.y - MY) / SY)

type Attempt = { ys: [number, number]; error: number }

function search(start: Line): Attempt[] {
  // De lijn van de student, uitgedrukt in z-scores.
  let A = (start.a * SX) / SY
  let B = (start.a * MX + start.b - MY) / SY

  const out: Attempt[] = []
  for (let k = 0; k < STEPS; k++) {
    let dA = 0
    let dB = 0
    for (let i = 0; i < N; i++) {
      const miss = A * ZX[i] + B - ZY[i]
      dA += miss * ZX[i]
      dB += miss
    }
    A -= (RATE * 2 * dA) / N
    B -= (RATE * 2 * dB) / N

    const a = (A * SY) / SX
    const line: Line = { a, b: MY + SY * B - a * MX }
    out.push({
      ys: [predict(line, HANDLE_X[0]), predict(line, HANDLE_X[1])],
      error: sumSquaredError(POINTS, line),
    })
  }
  return out
}

/** Vroege stappen wat vlotter, latere trager: samen ongeveer drie seconden. */
const stepMs = (k: number) => 120 + (45 * k) / (STEPS - 1)

/** Duizendtallen met een harde spatie: "11 288" leest niemand als 11,288,
 *  en met een gewone spatie kan het getal over twee regels breken. */
const whole = (v: number) => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0')

export default function TekenDeLijn() {
  const [ys, setYs] = useState<[number, number]>(START)
  const [revealed, setRevealed] = useState(false)
  const [animating, setAnimating] = useState(false)
  const [touched, setTouched] = useState(false)
  /** Eén punt per poging: de fout van de lijn van de student, dan die van elke stap. */
  const [curve, setCurve] = useState<number[]>([])
  /** De fout van de lijn die de student zelf had staan, voor de machine begon. */
  const [preFit, setPreFit] = useState<number | null>(null)
  const timer = useRef<number | null>(null)

  function stopRun() {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
  }

  // Een lopend zoekwerk mag nooit een unmounted bord blijven bijwerken.
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    },
    [],
  )

  const line: Line = useMemo(() => {
    const a = (ys[1] - ys[0]) / (HANDLE_X[1] - HANDLE_X[0])
    return { a, b: ys[0] - a * HANDLE_X[0] }
  }, [ys])

  const error = sumSquaredError(POINTS, line)

  /** Een greep vastnemen breekt het zoeken af: vanaf dan is het weer hun lijn. */
  const dragHandle = (i: 0 | 1) => (p: Point) => {
    stopRun()
    setAnimating(false)
    setRevealed(false)
    setTouched(true)
    setCurve([])
    setPreFit(null)
    setYs((prev) => (i === 0 ? [p.y, prev[1]] : [prev[0], p.y]))
  }

  function runFit() {
    stopRun()
    setTouched(true)

    const base = error
    const trail = search(line)
    setPreFit(base)

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      // Meteen naar het antwoord, met de volledige curve er meteen bij.
      setYs(trail[trail.length - 1].ys)
      setCurve([base, ...trail.map((a) => a.error)])
      setAnimating(false)
      setRevealed(true)
      return
    }

    setCurve([base])
    setAnimating(true)

    const tick = (k: number) => {
      setYs(trail[k].ys)
      setCurve([base, ...trail.slice(0, k + 1).map((a) => a.error)])
      if (k + 1 < trail.length) {
        timer.current = window.setTimeout(() => tick(k + 1), stepMs(k + 1))
      } else {
        timer.current = null
        setAnimating(false)
        setRevealed(true)
      }
    }
    timer.current = window.setTimeout(() => tick(0), stepMs(0))
  }

  function reset() {
    stopRun()
    setAnimating(false)
    setYs(START)
    setRevealed(false)
    setTouched(false)
    setCurve([])
    setPreFit(null)
  }

  return (
    <div className="relative h-full w-full">
      <Canvas defaultView={VIEW} xLabel="x" yLabel="y">
        {(s) => (
          <>
            <Residuals points={POINTS} line={line} scales={s} color={MISS} width={1.75} opacity={0.6} />
            <LineShape line={line} scales={s} color={MODEL} />
            <Dots points={POINTS} scales={s} color={DATA} />
            {([0, 1] as const).map((i) => (
              <DragDot
                key={i}
                point={{ x: HANDLE_X[i], y: ys[i] }}
                scales={s}
                onMove={dragHandle(i)}
                color={MODEL}
                r={7.5}
                cursor="ns-resize"
                label={touched ? undefined : 'sleep'}
                bounds={{ x: [HANDLE_X[i], HANDLE_X[i]], y: [Y_MIN, Y_MAX] }}
                ariaLabel={i === 0 ? 'linker handvat van de lijn' : 'rechter handvat van de lijn'}
              />
            ))}
          </>
        )}
      </Canvas>

      {/*
        De eerste alinea is het DOEL van dit bord. Brief toont die altijd en
        klapt alleen alles daarna in, dus op een beamer is dit de enige zin
        die een leerling gegarandeerd leest. Een leerling die hier vanaf een
        slide binnenvalt, ziet de portaalkaart nooit: staat het doel niet op
        het bord, dan staat het nergens.
      */}
      <Brief eyebrow="mAIstros 2 - les 1" title="Teken de lijn">
        <p>Trainen is zoeken naar de lijn met de kleinste fout.</p>
        <p>Sleep de twee handvatten tot de lijn zo goed mogelijk door de punten loopt.</p>
        <p>Elk streepje is de fout bij één punt.</p>
      </Brief>

      {/*
        Hoogte doorgerekend uit de CSS op 1024x768, paneel 256 px breed, in de
        hoogste stand (fout + subregel, de knop op twee regels, het blokje
        uitleg en de fit-regel er allemaal bij): 28 padding + 66 Readout + 21
        divider + 17 regel + 97 knoppen + 210 uitleg + 29 fit-regel + 21 divider
        + 36 legende + 2 rand = 527 px. De max-h laat 768 - 192 = 576 px toe,
        dus geen scrollbalk; de bovenkant komt op 225 px, ruim onder de Brief,
        die op dit scherm ingeklapt opent en rond 86 px stopt.
      */}
      <Panel className="pointer-events-auto absolute bottom-4 left-4 z-10 max-h-[calc(100%-12rem)] w-[16rem] overflow-y-auto px-4 py-3.5 xl:w-[20rem]">
        <Readout
          label="Totale fout: alle streepjes samen"
          value={whole(error)}
          color={MODEL}
          sub={revealed && preFit !== null ? `jouw lijn zat op ${whole(preFit)}` : undefined}
        />

        <Divider />

        <p className="text-[12.5px] leading-snug text-ink/70">De computer begint bij jouw lijn.</p>

        <div className="mt-2 flex flex-col gap-2">
          <Btn onClick={runFit} disabled={animating || revealed} full>
            Laat de computer het doen
          </Btn>
          <Btn onClick={reset} variant="ghost" full>
            Opnieuw
          </Btn>
        </div>

        {revealed && (
          <>
            <div className="mt-2.5">
              <Note tone="info">
                <p>De computer probeert een lijn en meet hoe ver ze van de punten ligt.</p>
                <p className="mt-1">
                  Daarna verschuift ze de lijn een beetje, zodat de fout kleiner wordt.
                </p>
                <p className="mt-1">Dat herhaalt ze tot de fout amper nog daalt.</p>
              </Note>
            </div>
            <div className="mt-2 text-[11.5px] leading-relaxed text-muted">
              Dat zoeken is <PyChip>regr.fit(x, y)</PyChip>
            </div>
          </>
        )}

        <Divider />

        <Legend
          items={[
            { color: MISS, label: 'de fout bij één punt' },
            { color: MODEL, label: 'jouw lijn' },
          ]}
        />
      </Panel>

      {/*
        De foutcurve. Ze staat er ALTIJD, ook voor het zoeken begint. Canvas
        meet elk '.panel' naast het bord, ook door een div heen, en gebruikt de
        breedte als inset. Een paneel dat halverwege verschijnt, laat het bord
        dus opnieuw kaderen terwijl de lijn beweegt. Leeg toont ze haar assen.
        Rechtsonder is verder leeg: de data loopt naar rechtsboven en de
        zoomknoppen staan op de linkerrail. Maat: 200 breed, 10 + 96 + 10 + 2
        = 118 hoog.
      */}
      <div className="pointer-events-none absolute bottom-4 right-4 z-10">
        <Panel className="w-[200px] px-3 py-2.5">
          <ErrorCurve values={curve} />
        </Panel>
      </div>
    </div>
  )
}

/**
 * De fout per poging, zonder getallen: alleen de vorm telt. Steil naar
 * beneden en dan bijna vlak - dat is het verhaal, en het bouwt zich live op
 * terwijl de machine zoekt.
 */
function ErrorCurve({ values }: { values: number[] }) {
  const W = 174
  const H = 96
  const L = 4
  const R = W - 4
  const T = 18
  const B = 74

  // De eerste poging staat bovenaan en de schaal ligt daarmee vast, zodat de
  // curve tijdens het opbouwen niet onder je ogen herschaalt.
  const top = values[0] > 0 ? values[0] : 1
  const px = (i: number) => L + (i / STEPS) * (R - L)
  const py = (v: number) => B - (Math.max(0, v) / top) * (B - T)

  const leeg = values.length === 0
  const last = values.length - 1
  const path = values.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ')

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="De totale fout per poging, van hoog naar bijna vlak."
    >
      <line x1={L} y1={T - 4} x2={L} y2={B} stroke="#e6e4ec" strokeWidth={1} />
      <line x1={L} y1={B} x2={R} y2={B} stroke="#e6e4ec" strokeWidth={1} />
      <text x={L - 2} y={10} fontSize={10.5} fontWeight={600} fill="#6b6b78">
        fout
      </text>
      <text x={R} y={H - 3} textAnchor="end" fontSize={10.5} fontWeight={600} fill="#6b6b78">
        poging
      </text>
      {leeg && (
        <text
          x={(L + R) / 2}
          y={(T + B) / 2 + 4}
          textAnchor="middle"
          fontSize={11}
          fill="#6b6b78"
          opacity={0.75}
        >
          nog niet gezocht
        </text>
      )}
      <polyline
        points={path}
        fill="none"
        stroke={MODEL}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {!leeg && (
        <circle
          cx={px(last)}
          cy={py(values[last])}
          r={3}
          fill={MODEL}
          stroke="#fff"
          strokeWidth={1.5}
        />
      )}
    </svg>
  )
}
