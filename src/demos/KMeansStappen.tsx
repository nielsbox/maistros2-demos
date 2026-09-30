import { useEffect, useMemo, useRef, useState } from 'react'
import Canvas, { type Scales, type View } from '../components/Canvas'
import { Brief, Btn, Panel } from '../components/Overlay'
import Vaststelling, { getal, meervoud } from '../components/Vaststelling'
import {
  PUNTEN,
  START_SLIDES,
  aantalWissels,
  kiesDichtste,
  schuifNaarGemiddelde,
  sleutel,
  uitkomsten,
  willekeurigeStart,
  type Punt,
} from '../lib/kmeans'
import { seeded } from '../lib/regression'
import { DATA, FOUT, FOUT_INK, INK, MODEL, MUTED, NAVY } from '../lib/palette'

/* ------------------------------------------------------------------ *
 * mAIstros 2 - les 7 - K-means stap voor stap.
 *
 * EEN DOEL: k-means herhaalt twee stappen tot er niks meer verandert. Elk punt
 * kiest de dichtste centroid, en elke centroid schuift naar het gemiddelde van
 * zijn punten. Dit bord gaat dus over hoe het ALGORITME te werk gaat. Er is
 * geen getraind model om aan te prutsen: de leerling zet elke stap zelf.
 *
 * HET IS DE WALKTHROUGH VAN DE LES, INTERACTIEF. Slides 2129255-2129261
 * tonen dit op 18 zwarte punten in zeven prenten. Het bord gebruikt DIE punten
 * (zie src/lib/kmeans.ts), en "Start van de slides" speelt precies die zeven
 * prenten na: 5 blauw en 13 oranje, dan wisselen er 3, dan niks meer.
 *
 * HET BORD OPENT ZOALS SLIDE 2129255: 18 zwarte punten, geen centroid, niets
 * klaar. Het onderwerp - de punten die in clusters moeten - staat er in de
 * eerste tel, en de enige zet is de eerste zet van het algoritme zelf: kies
 * punten als centroid. De les doet dat ook zo ("kiezen we willekeurig 2
 * elementen in de data"), en daarom kan je alleen op een PUNT klikken en niet
 * vrij op het bord: een vrij geplaatste centroid kan een lege cluster geven.
 *
 * DE VOLGORDE IS WAT JE LEERT. Er zijn twee knoppen, en alleen de volgende zet
 * staat aan. Zo herhaalt de leerling met zijn eigen klikken 1, 2, 1, 2 tot
 * knop 1 geen enkel punt meer van cluster doet wisselen.
 *
 * DE TELLER die beweegt is "Punten die van kleur veranderden": 18, 3, 0 vanaf
 * de start van de slides. Kleur en niet cluster, omdat de punten bij de eerste
 * keer nog GEEN cluster hadden - ze waren zwart. "18 punten wisselden van
 * cluster" zou dus niet kloppen, "18 punten veranderden van kleur" wel. Nul is
 * de stopregel van de les zelf: "We zien dat er niks meer verandert."
 *
 * GEMETEN EN DAAROM NIET GEZEGD: "elke keer wisselen er minder punten". Dat
 * aantal stijgt eens in 26 van de 153 starts met 2 clusters. Het bord zegt
 * nergens iets over hoe de teller daalt, alleen wanneer hij nul is.
 *
 * DE WOORDEN KOMEN VAN DE LES:
 *   centroid, centroids, cluster(s)         2129254, 2129256
 *   dichtste centroid                       2129257, 2129259
 *   het gemiddelde van alle punten          2129258
 *   willekeurig                             2129256
 *   niks meer verandert, definitieve        2129261
 *   zwart, blauw, oranje                    2129259, 2129261
 *   punt (nooit element of bol)             2129258, 2129259
 * Twee woorden staan niet in de les: `schuift` (een centroid die naar het
 * gemiddelde gaat) en `knop`. Allebei gewoon Nederlands voor wat er op het
 * scherm gebeurt.
 *
 * DE BETALING komt pas na een volle run: de knop "Probeer 3 clusters". Met 2
 * clusters komt elke start hier bij dezelfde clusters uit, met 3 niet. Beide
 * halve zinnen worden bij het laden uit de punten gerekend (`uitkomsten`), niet
 * getypt. Dat is ook waarom de plaatjes van Stap 6 bij elke leerling anders
 * zijn: KMeans kiest zijn start willekeurig, net zoals hier.
 *
 * DE ANNOTATIES. Er is precies EEN tekstplek op het bord, de band boven de
 * punten, en die zegt per toestand hoogstens één zin. Verder staan er alleen
 * merken: de lijntjes van elk punt naar zijn centroid, een ring om de punten
 * die net wisselden (weg zodra de centroids schuiven), en een stippelvorm waar
 * een centroid stond (weg zodra de punten opnieuw kiezen). Nooit meer dan vier
 * dingen die iets uitleggen op één moment.
 * ------------------------------------------------------------------ */

/** Hoogstens 3 clusters. Blauw en oranje zijn de kleuren van de les zelf. */
type Aantal = 2 | 3

/* ----------------------------- de merken ---------------------------- *
 * Elke cluster heeft een eigen VORM en een eigen kleur. Nooit kleur alleen.
 *
 * De derde cluster is geen groen: groen tegen het gebrande oranje van FOUT
 * zakt onder protanopie naar dE 4,0 (zie KweekDeBoom). Het is een OPEN ruit
 * in de huisnavy, dezelfde oplossing als de derde klasse op het bord van les 5.
 * Oranje betekent hier "de oranje cluster" en niet "fout": er staat op dit
 * bord geen enkele misser.
 *
 * Een punt zonder cluster is een volle navy stip: dat leest als de "zwarte
 * bollen" van slide 2129261.                                             */

const KLEUR = [MODEL, FOUT, DATA] as const
const INKT = [MODEL, FOUT_INK, DATA] as const

function Vorm({
  cluster,
  x,
  y,
  r,
  vol = true,
  dik = 0,
  streep = false,
  opacity = 1,
}: {
  /** -1 = nog geen cluster. */
  cluster: number
  x: number
  y: number
  r: number
  /** Vol met de clusterkleur, of wit met een rand in de clusterkleur. */
  vol?: boolean
  dik?: number
  streep?: boolean
  opacity?: number
}) {
  if (cluster < 0) return <circle cx={x} cy={y} r={r} fill={DATA} opacity={opacity} />
  const kleur = KLEUR[cluster]
  // De derde cluster is altijd open, ook als punt: dat is zijn vorm.
  const open = !vol || cluster === 2
  const fill = streep ? 'none' : open ? '#fff' : kleur
  const stroke = open || dik > 0 ? kleur : 'none'
  const sw = dik > 0 ? dik : open ? 2.5 : 0
  const dash = streep ? '5 4' : undefined
  const common = { fill, stroke, strokeWidth: sw, strokeDasharray: dash, opacity }
  if (cluster === 0) return <circle cx={x} cy={y} r={r} {...common} />
  if (cluster === 1) {
    const h = r * 0.9
    return <rect x={x - h} y={y - h} width={h * 2} height={h * 2} {...common} />
  }
  const d = r * 1.25
  return <path d={`M ${x} ${y - d} L ${x + d} ${y} L ${x} ${y + d} L ${x - d} ${y} Z`} {...common} />
}

/** Tekst op het bord: minstens 13 px, vet, met een witte rand eronder. */
function Tekst({
  x,
  y,
  children,
  maat = 15,
  kleur = INK,
}: {
  x: number
  y: number
  children: string
  maat?: number
  kleur?: string
}) {
  return (
    <text
      x={x}
      y={y}
      fontSize={maat}
      fontWeight={700}
      fill={kleur}
      textAnchor="middle"
      stroke="#fff"
      strokeWidth={3.5}
      paintOrder="stroke"
      pointerEvents="none"
    >
      {children}
    </text>
  )
}

/* ---------------------------- de meetkunde --------------------------- *
 * De punten staan in de pixels van de slide (1212 x 662, y omgedraaid). Het
 * venster is het kader van de punten plus een rand, en BOVENAAN een extra band
 * van 130 eenheden: daar staat de ene zin van het bord, boven de punten en dus
 * nooit erop.
 *
 * EEN SCHAAL VOOR BEIDE ASSEN, en dat is hier geen smaak. "Dichtste centroid"
 * moet op het scherm ook de dichtste ZIJN. Canvas schaalt x en y apart om de
 * vrije ruimte te vullen, en dan ligt een punt dat op het scherm dichter bij
 * blauw lijkt soms echt dichter bij oranje. Dus: de kleinste van de twee
 * schalen, en het kader in het midden van het vrije vlak.                  */

const XS = PUNTEN.map((p) => p.x)
const YS = PUNTEN.map((p) => p.y)
const MIN_X = Math.min(...XS)
const MAX_X = Math.max(...XS)
const MIN_Y = Math.min(...YS)
const MAX_Y = Math.max(...YS)
const RAND = 50
const BAND = 130
const VENSTER: View = { x0: MIN_X - RAND, x1: MAX_X + RAND, y0: MIN_Y - RAND, y1: MAX_Y + BAND }
const MX = (VENSTER.x0 + VENSTER.x1) / 2
const MY = (VENSTER.y0 + VENSTER.y1) / 2

const DUUR = 700

type Fase = 'kiezen' | 'stap1' | 'stap2' | 'klaar'

/* ------------------------------ de tekening -------------------------- */

function Bord({
  s,
  aantal,
  fase,
  gekozen,
  clusters,
  centroids,
  spoken,
  gewisseld,
  bandZin,
  onKlik,
}: {
  s: Scales
  aantal: number
  fase: Fase
  gekozen: readonly number[]
  clusters: readonly number[] | null
  centroids: readonly Punt[]
  spoken: readonly Punt[] | null
  gewisseld: ReadonlySet<number>
  bandZin: string | null
  onKlik: (i: number) => void
}) {
  const schaal = Math.min(1 / s.unitPerPx.x, 1 / s.unitPerPx.y)
  const X = (x: number) => s.sx(MX) + (x - MX) * schaal
  const Y = (y: number) => s.sy(MY) - (y - MY) * schaal
  /* De maat van een punt volgt de schaal, zodat de prent op elke beamer op de
     slide lijkt, maar nooit onder 10 px: op 900x700 is de schaal 0,47 en de
     kleinste afstand tussen twee punten dan 51 px, dus ook een centroid van
     16 px raakt geen buur. */
  const r = Math.max(10, Math.min(16, 20 * schaal))
  const R = r + 6
  const kiest = fase === 'kiezen'
  const neer = useRef<{ x: number; y: number; i: number } | null>(null)

  return (
    <g>
      {/* 1. De lijntjes van elk punt naar zijn centroid. Onderaan, zodat geen
             lijn over een merk loopt. Ze tonen wat knop 1 doet (elk punt hangt
             aan de dichtste) en wat knop 2 doet (de centroid schuift tot hij in
             het midden van zijn lijntjes staat). */}
      {clusters &&
        PUNTEN.map((p, i) => {
          const c = centroids[clusters[i]]
          return (
            <line
              key={`l${i}`}
              x1={X(p.x)}
              y1={Y(p.y)}
              x2={X(c.x)}
              y2={Y(c.y)}
              stroke={KLEUR[clusters[i]]}
              strokeWidth={1.5}
              opacity={0.45}
              pointerEvents="none"
            />
          )
        })}

      {/* 2. Waar de centroids stonden: een stippelvorm en een lijntje naar
             waar ze nu staan. Weg zodra de punten opnieuw kiezen. */}
      {spoken &&
        spoken.map((g, j) => (
          <g key={`g${j}`} pointerEvents="none">
            <line
              x1={X(g.x)}
              y1={Y(g.y)}
              x2={X(centroids[j].x)}
              y2={Y(centroids[j].y)}
              stroke={MUTED}
              strokeWidth={1.5}
              strokeDasharray="3 4"
            />
            <Vorm cluster={j} x={X(g.x)} y={Y(g.y)} r={R} streep dik={2} opacity={0.7} />
          </g>
        ))}

      {/* 2b. De vorm van elke centroid: wit, met een dikke rand, zoals de
             C-merken op de slides. ONDER de punten, en dat is gemeten (audit
             2026-09-30). Bovenop verborg de witte vorm het punt waar hij op
             begint helemaal: na knop 1 zei de teller "18 van de 18 punten" en
             stonden er 16 gekleurde punten op het bord. In de eindstand verborg
             de oranje centroid ook 35 tot 45% van een buurpunt. Nu blijft elk
             punt heel zichtbaar, en de letter C staat nog bovenop (stap 4).
             Tijdens het kiezen staan alleen de al gekozen centroids er. */}
      {centroids.slice(0, kiest ? gekozen.length : aantal).map((c, j) => (
        <g key={`cv${j}`} pointerEvents="none">
          <Vorm cluster={j} x={X(c.x)} y={Y(c.y)} r={R} vol={false} dik={4} />
        </g>
      ))}

      {/* 3. De punten. Klikken kan alleen in de eerste fase, en alleen op een
             punt: een centroid begint altijd op een punt, zoals in de les. */}
      {PUNTEN.map((p, i) => {
        const cx = X(p.x)
        const cy = Y(p.y)
        const c = clusters ? clusters[i] : -1
        return (
          <g
            key={`p${i}`}
            role={kiest ? 'button' : undefined}
            tabIndex={kiest ? 0 : undefined}
            aria-label={kiest ? `punt ${i + 1}` : undefined}
            className={kiest ? 'group outline-none' : undefined}
            style={kiest ? { cursor: 'pointer' } : undefined}
            /* Klikken is geen slepen. Pointerdown MOET hier tegengehouden
               worden: Canvas neemt anders de pointer over, en dan komt de click
               op de svg aan in plaats van op dit punt (gemeten op les 5). Een
               gebaar dat meer dan 4 px verschoof was een pan, en de tweede klik
               van een dubbelklik telt niet. */
            onPointerDown={
              kiest
                ? (e) => {
                    e.stopPropagation()
                    neer.current = { x: e.clientX, y: e.clientY, i }
                  }
                : undefined
            }
            onClick={
              kiest
                ? (e) => {
                    const d = neer.current
                    neer.current = null
                    if (!d || d.i !== i || e.detail > 1) return
                    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) return
                    onKlik(i)
                  }
                : undefined
            }
            onKeyDown={
              kiest
                ? (e) => {
                    if (e.key !== 'Enter' && e.key !== ' ') return
                    e.preventDefault()
                    onKlik(i)
                  }
                : undefined
            }
          >
            {kiest && <circle cx={cx} cy={cy} r={r + 10} fill="transparent" />}
            {kiest && (
              <circle
                cx={cx}
                cy={cy}
                r={r + 6}
                fill="none"
                stroke={NAVY}
                strokeWidth={2}
                className="opacity-0 transition-opacity group-hover:opacity-40 group-focus-visible:opacity-60"
              />
            )}
            {gewisseld.has(i) && c >= 0 && (
              <circle cx={cx} cy={cy} r={r + 6} fill="none" stroke={KLEUR[c]} strokeWidth={2.5} />
            )}
            <Vorm cluster={c} x={cx} y={cy} r={r} />
          </g>
        )
      })}

      {/* 4. De letter C van elke centroid, helemaal bovenop en met een witte
             rand, zodat ze ook leesbaar blijft als er een punt onder ligt. */}
      {centroids.slice(0, kiest ? gekozen.length : aantal).map((c, j) => (
        <text
          key={`c${j}`}
          x={X(c.x)}
          y={Y(c.y) + 5}
          textAnchor="middle"
          fontSize={15}
          fontWeight={800}
          fill={INKT[j]}
          stroke="#fff"
          strokeWidth={3.5}
          paintOrder="stroke"
          pointerEvents="none"
        >
          C
        </text>
      ))}

      {/* 5. De ene zin van het bord, in de band boven de punten. */}
      {bandZin && (
        <Tekst x={X((MIN_X + MAX_X) / 2)} y={Y(MAX_Y) - R - 18}>
          {bandZin}
        </Tekst>
      )}
    </g>
  )
}

/* ------------------------------- het bord --------------------------- */

export default function KMeansStappen() {
  const [aantal, setAantal] = useState<Aantal>(2)
  /** De punten die de leerling als centroid koos, in volgorde: blauw, oranje, navy. */
  const [gekozen, setGekozen] = useState<number[]>([])
  const [centroids, setCentroids] = useState<Punt[]>([])
  const [clusters, setClusters] = useState<number[] | null>(null)
  /** Hoeveel punten bij de laatste keer kiezen van kleur veranderden. */
  const [wissels, setWissels] = useState<number | null>(null)
  const [gewisseld, setGewisseld] = useState<Set<number>>(new Set())
  const [spoken, setSpoken] = useState<Punt[] | null>(null)
  const [fase, setFase] = useState<Fase>('kiezen')
  /** Hoeveel keer de centroids in deze run al schoven. De zin over de
   *  stippelvorm staat er alleen de eerste keer: daarna kent de leerling ze. */
  const [geschoven, setGeschoven] = useState(0)
  const [ooitKlaar, setOoitKlaar] = useState(false)

  /* Het schuiven, beeld per beeld. `beeld` is wat er getekend wordt terwijl de
     centroids onderweg zijn; daarna is het null en telt `centroids`. */
  const [anim, setAnim] = useState<{ van: Punt[]; naar: Punt[] } | null>(null)
  const [beeld, setBeeld] = useState<Punt[] | null>(null)
  useEffect(() => {
    if (!anim) return
    const stil = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    const t0 = performance.now()
    const tik = (t: number) => {
      const u = stil ? 1 : Math.min(1, (t - t0) / DUUR)
      const e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2
      setBeeld(
        anim.van.map((p, j) => ({
          x: p.x + (anim.naar[j].x - p.x) * e,
          y: p.y + (anim.naar[j].y - p.y) * e,
        })),
      )
      if (u < 1) raf = requestAnimationFrame(tik)
      else {
        setBeeld(null)
        setAnim(null)
      }
    }
    raf = requestAnimationFrame(tik)
    /* EEN VANGNET, en het is gemeten nodig. Een browser laat requestAnimation-
       Frame stilvallen in een tabblad of iframe dat niet zichtbaar is. Dan
       kwam `tik` nooit aan zijn laatste beeld, bleef `anim` staan en stonden
       BEIDE knoppen voorgoed uit: in een verborgen paneel stonden ze na 900 ms
       nog allebei grijs. Na de duur plus wat marge zet deze timer de centroids
       dus hoe dan ook op hun plaats. */
    const vangnet = window.setTimeout(() => {
      setBeeld(null)
      setAnim(null)
    }, DUUR + 150)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(vangnet)
    }
  }, [anim])
  const bezig = anim !== null

  /** Elke leerling en elke beamer krijgt dezelfde "willekeurige" reeks. */
  const toeval = useRef(seeded(20260930))

  const alle = useMemo(() => uitkomsten(aantal), [aantal])

  const getoond: Punt[] =
    beeld ?? (fase === 'kiezen' ? gekozen.map((i) => PUNTEN[i]) : centroids)

  /* ------------------------------ de zetten ----------------------------- */

  const wis = () => {
    setGekozen([])
    setCentroids([])
    setClusters(null)
    setWissels(null)
    setGewisseld(new Set())
    setSpoken(null)
    setGeschoven(0)
    setFase('kiezen')
    setAnim(null)
    setBeeld(null)
  }

  const zetStart = (start: number[]) => {
    setGekozen(start)
    setCentroids(start.map((i) => PUNTEN[i]))
    setClusters(null)
    setWissels(null)
    setGewisseld(new Set())
    setSpoken(null)
    setGeschoven(0)
    setFase('stap1')
  }

  /** Een punt aanklikken: het wordt de volgende centroid, of klik je een
   *  gekozen punt opnieuw aan, dan is het weer gewoon een punt. */
  const klikPunt = (i: number) => {
    if (fase !== 'kiezen') return
    if (gekozen.includes(i)) {
      setGekozen(gekozen.filter((g) => g !== i))
      return
    }
    const nieuw = [...gekozen, i]
    if (nieuw.length === aantal) zetStart(nieuw)
    else setGekozen(nieuw)
  }

  /** Knop 1: elk punt kiest de dichtste centroid. */
  const stap1 = () => {
    if (fase !== 'stap1' || bezig) return
    const nieuw = kiesDichtste(centroids, clusters)
    const eerste = clusters === null
    const n = eerste ? nieuw.length : aantalWissels(clusters, nieuw)
    setGewisseld(
      eerste ? new Set() : new Set(nieuw.flatMap((c, i) => (c !== clusters[i] ? [i] : []))),
    )
    setClusters(nieuw)
    setWissels(n)
    setSpoken(null)
    if (!eerste && n === 0) {
      setFase('klaar')
      setOoitKlaar(true)
    } else setFase('stap2')
  }

  /** Knop 2: elke centroid schuift naar het gemiddelde van zijn punten. */
  const stap2 = () => {
    if (fase !== 'stap2' || !clusters || bezig) return
    const naar = schuifNaarGemiddelde(centroids, clusters)
    setSpoken(centroids)
    setAnim({ van: centroids, naar })
    setCentroids(naar)
    setGewisseld(new Set())
    setGeschoven(geschoven + 1)
    setFase('stap1')
  }

  const willekeurig = () => {
    if (fase !== 'kiezen') return
    zetStart(willekeurigeStart(aantal, toeval.current))
  }

  const wisselAantal = () => {
    setAantal(aantal === 2 ? 3 : 2)
    wis()
  }

  const startSlides = () => {
    setAantal(2)
    zetStart([...START_SLIDES])
  }

  /* ------------------------------ de zinnen ----------------------------- */

  const nogTeKiezen = aantal - gekozen.length

  /** De ene zin op het bord. Elke zin doet één ding en verdwijnt als dat
   *  gedaan is. */
  const bandZin =
    fase === 'kiezen'
      ? gekozen.length === 0
        ? `Klik op ${getal(aantal)} punten.`
        : `Klik nog op ${getal(nogTeKiezen)} ${meervoud(nogTeKiezen, 'punt', 'punten')}.`
      : fase === 'klaar'
        ? 'Er verandert niks meer. Dit zijn de definitieve clusters.'
        : fase === 'stap2' && wissels !== null && clusters && gewisseld.size > 0
          ? `${getal(wissels)} ${meervoud(wissels, 'punt koos', 'punten kozen')} een andere centroid.`
          : fase === 'stap1' && spoken && geschoven === 1
            ? 'De stippellijn toont waar de centroids stonden.'
            : null

  /** Wat de leerling nu doet, in het paneel dat nooit inklapt. */
  const stand =
    fase === 'kiezen'
      ? gekozen.length === 0
        ? `Klik op ${getal(aantal)} punten. Dat worden de centroids, één voor elke cluster.`
        : `Klik nog op ${getal(nogTeKiezen)} ${meervoud(nogTeKiezen, 'punt', 'punten')}.`
      : fase === 'stap1' && clusters === null
        ? 'De centroids staan er. Druk op knop 1: elk punt kiest de dichtste centroid.'
        : fase === 'stap2'
          ? 'Druk op knop 2: elke centroid schuift naar het gemiddelde van zijn punten.'
          : fase === 'stap1'
            ? 'De centroids staan op een nieuwe plaats. Kiest elk punt nog dezelfde centroid? Druk op knop 1.'
            : null

  /** De vaststelling: de teller en de ene regel eronder. */
  const detail =
    wissels === null
      ? undefined
      : clusters && wissels === PUNTEN.length && fase !== 'klaar' && gewisseld.size === 0
        ? 'Alle punten waren zwart. Nu heeft elk punt de kleur van zijn cluster.'
        : wissels === 0
          ? 'Hier stopt k-means.'
          : wissels === 1
          ? 'Dat punt ligt nu dichter bij een andere centroid.'
          : 'Die punten liggen nu dichter bij een andere centroid.'

  /* De betaling: pas na een volle run, en elk getal komt uit `uitkomsten`. */
  const dezeUitkomst = fase === 'klaar' && clusters ? (alle.telling.get(sleutel(clusters)) ?? 0) : 0
  const eenUitkomst = alle.telling.size === 1

  return (
    <div className="relative h-full w-full">
      {/* Geen astekst: de voorbeelden op de slides hebben geen assen, en de
          plaats van een punt is hier geen waarde die je moet aflezen. */}
      <Canvas defaultView={VENSTER} axes={false}>
        {(s) => (
          <Bord
            s={s}
            aantal={aantal}
            fase={fase}
            gekozen={gekozen}
            clusters={clusters}
            centroids={getoond}
            spoken={spoken}
            gewisseld={gewisseld}
            bandZin={bandZin}
            onKlik={klikPunt}
          />
        )}
      </Canvas>

      {/* DE EERSTE ALINEA IS HET DOEL. Onder 1280 px klapt de rest in, dus hier
          staat geen opdracht: wat je doet staat in het paneel eronder, dat
          nooit inklapt, en in de band op het bord. */}
      <Brief eyebrow="mAIstros 2 - les 7" title="K-means stap voor stap">
        <p>K-means herhaalt twee stappen tot er niks meer verandert.</p>
        <p>
          Dit zijn de {getal(PUNTEN.length)} punten van de slides. We willen ze in{' '}
          {getal(aantal)} clusters opdelen.
        </p>
      </Brief>

      {/* Het paneel staat er van de eerste tel af en verandert nooit van
          breedte: Canvas houdt die breedte vrij, dus een paneel dat later
          opduikt zou het bord herkaderen. Alleen de hoogte verandert.

          DE VOLGORDE IS VAST: eerst wat je nu doet, dan de twee knoppen van het
          algoritme, dan de teller. Wat daarna komt is naslag of betaling. Zo
          staat er op 900x700 nooit een knop of een getal onder de rand. */}
      <Panel className="pointer-events-auto absolute bottom-4 left-4 z-10 flex max-h-[calc(100%-12rem)] w-[16rem] flex-col overflow-y-auto px-4 py-3.5 xl:max-h-[calc(100%-15rem)] xl:w-[21rem]">
        {stand && <p className="text-[13.5px] leading-snug text-ink">{stand}</p>}
        {/* DE BETALING, bovenaan zodra het algoritme stopt: dan is dit wat de
            leerling nu moet lezen. Elk getal komt uit `uitkomsten`, en de derde
            zin volgt uit die telling, niet uit deze tekst. */}
        {fase === 'klaar' && clusters && (
          <p className="text-[13.5px] leading-snug text-ink">
            Er zijn {getal(alle.starts)} manieren om {getal(aantal)} punten als centroids te
            kiezen.{' '}
            {dezeUitkomst === alle.starts
              ? `Ze komen alle ${getal(dezeUitkomst)} bij deze clusters uit.`
              : `Maar ${getal(dezeUitkomst)} ervan ${meervoud(dezeUitkomst, 'komt', 'komen')} bij deze clusters uit.`}{' '}
            {eenUitkomst
              ? 'De start maakt hier dus niet uit.'
              : 'De uitkomst hangt dus af van waar je start. Probeer andere punten.'}
          </p>
        )}

        {/* De twee stappen van het algoritme. Alleen de volgende staat aan: de
            volgorde is wat je hier leert. */}
        <div className="mt-2.5 flex flex-col gap-1.5">
          <Btn full disabled={fase !== 'stap1' || bezig} onClick={stap1}>
            1. Elk punt kiest de dichtste centroid
          </Btn>
          <Btn full disabled={fase !== 'stap2' || bezig} onClick={stap2}>
            2. Elke centroid schuift naar het gemiddelde
          </Btn>
        </div>

        <Vaststelling
          label="Punten die van kleur veranderden"
          value={wissels}
          outOf={{ total: PUNTEN.length, noun: 'punten' }}
          detail={detail}
          empty="Nog geen enkel punt hoort bij een cluster."
        />

        {/* DRIE KNOPPEN VOOR DE START, IN TWEE RIJEN, en dat is gemeten. Er
            stonden er vier in vier rijen plus een regel tekst, en na een run met
            3 clusters zakte de laatste knop 36 px onder de rand van het paneel,
            al op 1024x768. Daarom delen "Kies willekeurig" en "Opnieuw" nu één
            plaats: kiezen kan alleen zolang er nog geen centroids staan, en
            opnieuw beginnen heeft pas zin als ze er wel staan. Een gekozen punt
            haal je weg door er nog eens op te klikken. */}
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {fase === 'kiezen' ? (
            <Btn variant="ghost" onClick={willekeurig}>
              Kies willekeurig
            </Btn>
          ) : (
            <Btn variant="ghost" onClick={wis}>
              Opnieuw
            </Btn>
          )}
          <Btn variant="ghost" onClick={startSlides}>
            Start van de slides
          </Btn>
          {/* Pas na een volle run: eerst ziet de leerling de twee stappen met 2
              clusters, zoals op de slides. */}
          {ooitKlaar && (
            <Btn variant="ghost" onClick={wisselAantal}>
              {aantal === 2 ? 'Probeer 3 clusters' : 'Terug naar 2 clusters'}
            </Btn>
          )}
        </div>
      </Panel>
    </div>
  )
}

