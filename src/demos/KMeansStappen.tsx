import { useEffect, useRef, useState } from 'react'
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
import {
  DATA,
  DERDE,
  DERDE_INK,
  FOUT,
  FOUT_INK,
  INK,
  MODEL,
  MUTED,
  NAVY,
  VIERDE,
  VIJFDE,
  VIJFDE_INK,
} from '../lib/palette'

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
 * (zie src/lib/kmeans.ts), en "Start zoals op de slides" speelt precies die
 * zeven prenten na: 5 blauw en 13 oranje, dan wisselen er 3, dan niks meer.
 * Die knop zet het aantal dus ook terug op 2: de slides tonen 2 clusters. Hij
 * heette eerst "Start van de slides", en dat leest als "het begin van de
 * slides", een knop die terug naar de eerste slide gaat.
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
 * aantal stijgt eens in 26 van de 153 starts met 2 clusters, en in 11, 47 en
 * 146 van de starts met 3, 4 en 5 (tabel in src/lib/kmeans.ts). Het bord zegt
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
 * HET AANTAL CLUSTERS KIES JIJ. Dat is het tweede dat dit bord leert, en het
 * komt van de les zelf: "Bij deze methode om aan clustering te doen moet je
 * zelf op voorhand opgeven hoeveel clusters het model moet maken" (2129254),
 * en Stap 6 (2129379) laat de leerling 2, 3, 4 en 5 clusters maken en
 * visualiseren. Dus een kiezer met precies die vier, die op 2 opent: zo ziet
 * het bord er eerst uit als 2129255. Op het scherm staat "kiezen" en niet het
 * "opgeven" van de les: een vijftienjarige leest "dat geef jij op" als "dat
 * laat jij vallen".
 *   Het bord rekent GEEN beste aantal uit en toont geen maat. De les oordeelt
 * door te kijken ("komt mooi overeen met wat je wellicht verwachtte toen je
 * naar de zwarte punten keek", 2129261), en of die clusters iets betekenen is
 * voor de volgende les (2129385). Na een volle run vraagt het bord dus alleen
 * welk aantal het best bij de punten past, en laat het oordeel bij de leerling.
 *   Een ander aantal kiezen wist de hele run: centroids, clusters, ringen,
 * stippelvormen, de teller en een schuivende centroid die nog onderweg is.
 * Niets van een run met 5 clusters mag blijven hangen op een bord met 2.
 * Gemeten in de browser: een ander aantal kiezen 150 ms na knop 2, midden in
 * het schuiven, laat 0 centroids, 0 lijntjes en een lege teller achter, ook
 * 900 ms later. Hetzelfde aantal nog eens kiezen doet niets, zodat een
 * misklik op de gekozen knop geen run wist.
 *   "Kies willekeurig" heeft per aantal een eigen seeded() reeks: de eerste
 * keer bij 4 clusters geeft op elke beamer dezelfde punten, wat je daarvoor
 * bij 2 of 3 ook deed. 2 houdt de seed die het bord altijd had.
 *   Het bord zegt nergens "k-means maakt altijd precies zoveel clusters als jij
 * vraagt". Aan het einde klopt dat voor elke start, maar onderweg raakt er één
 * keer een cluster leeg (1 van de 8 568 starts met 5, zie kmeans.ts). In die
 * ene toestand zegt het paneel dat die centroid blijft staan.
 *   Om dezelfde reden staat er na knop 2 niet "de centroids zijn verschoven".
 * Een centroid die al op het gemiddelde van zijn punten stond, blijft staan,
 * en dat gebeurt vaak: bij 3 clusters in 606 van de 1 796 keer knop 2, bij 4
 * in 3 268 van de 6 417, bij 5 in 11 399 van de 17 703 (en bij 2 één keer, in
 * 1 van de 153 starts). Het paneel zegt dus wat ALTIJD klopt: elke centroid
 * staat nu op het gemiddelde van zijn punten.
 *
 * DE BETALING komt na een volle run: hoeveel van alle starts bij DEZE clusters
 * uitkomen. Met 2 clusters alle 153, met 3, 4 en 5 niet (39, 251 en 748
 * verschillende uitkomsten). "Dat is geen fout" is de zin van de Codi-hints
 * 13281 en 13282 voor precies dit effect. Elk getal komt uit `uitkomsten`,
 * niet uit de tekst. Het is ook waarom de plaatjes van Stap 6 bij elke
 * leerling anders zijn: KMeans kiest zijn start willekeurig, net zoals hier.
 *
 * DE ANNOTATIES. Er is precies EEN tekstplek op het bord, de band boven de
 * punten, en die zegt per toestand hoogstens één zin. Verder staan er alleen
 * merken: de lijntjes van elk punt naar zijn centroid, een ring om de punten
 * die net wisselden (weg zodra de centroids schuiven), en een stippelvorm waar
 * een centroid stond (weg zodra de punten opnieuw kiezen). Nooit meer dan vier
 * dingen die iets uitleggen op één moment. De kiezer voor het aantal staat in
 * het paneel, niet op het bord, en telt dus niet mee. Geteld in de browser over
 * elke toestand, bij elk aantal en op vier schermen: hoogstens DRIE tegelijk
 * (de zin, de lijntjes en de ringen na knop 1, of de zin, de lijntjes en de
 * stippelvormen na de eerste knop 2). Daarvoor dienen de attributen data-punt,
 * data-centroid en data-ann: een controle in de browser telt ermee hoeveel
 * merken onder een paneel liggen en welke annotaties er tegelijk staan.
 * ------------------------------------------------------------------ */

/** 2 tot 5 clusters: het bereik van Stap 6 (2129379). */
type Aantal = 2 | 3 | 4 | 5
const AANTALLEN: readonly Aantal[] = [2, 3, 4, 5]

/* ----------------------------- de merken ---------------------------- *
 * Elke cluster heeft een eigen VORM en een eigen kleur. Nooit kleur alleen:
 * ook de lijntjes van elk punt naar zijn centroid zeggen bij wie het hoort.
 *
 *   1 blauw rondje, 2 oranje vierkant      de kleuren van de les (2129259)
 *   3 groene ruit, 4 rode driehoek, 5 roze driehoek met de punt naar onder
 *
 * Een punt zonder cluster is een volle navy stip: dat leest als de "zwarte
 * bollen" van slide 2129261. DAAROM MAG GEEN ENKELE CLUSTER NAVY ZIJN. Tot
 * 2026-09-30 was de derde cluster een open ruit in navy, en dan logen twee
 * zinnen (review, gerenderd op 1440 en 1024): na knop 1 zei de teller "18 van
 * de 18 punten veranderden van kleur" en "nu heeft elk punt de kleur van zijn
 * cluster", terwijl de ruiten zwart bleven. Met de kiezer zou dat bij elk
 * aantal vanaf 3 gebeuren. Nu heeft elke cluster een echte tint.
 *
 * De vijf tinten zijn getoetst als set, ALLE paren, want op een puntenwolk
 * kan elke cluster naast elke andere liggen: validate_palette.js --mode light
 * --pairs all, alles PASS (details in index.css). Het zwakste paar is
 * groen/oranje met dE 8,9 onder protanopie. De oude opmerking hier (en in
 * KweekDeBoom) dat groen tegen dat oranje naar dE 4,0 zakt, geldt niet voor
 * DERDE: de validator geeft DERDE tegen FOUT 8,9. CLAUDE.md schrijft die 4,0
 * toe aan het donkergroen van CodeFever zelf.
 *   Tegen navy, de kleur van "nog geen cluster", haalt elke tint minstens
 * dE 35,3 bij gewoon zicht en 22,6 onder protanopie (rood). Geen cluster kan
 * dus doorgaan voor "zwart".
 *
 * Oranje betekent hier "de oranje cluster" en niet "fout", en rood "de rode
 * cluster": er staat op dit bord geen enkele misser.                       */

const KLEUR = [MODEL, FOUT, DERDE, VIERDE, VIJFDE] as const
/** De letter C op een centroid: minstens 4,5:1 op wit. MODEL haalt 4,51 en
 *  VIERDE 6,95 zelf; de andere drie krijgen hun inkt. */
const INKT = [MODEL, FOUT_INK, DERDE_INK, VIERDE, VIJFDE_INK] as const

/** Een driehoek met deze omtrekstraal (maal r) heeft dezelfde oppervlakte als
 *  een rondje met straal r: 1,299 x 1,55² = 3,12, tegen pi = 3,14. Zo weegt geen
 *  cluster zwaarder op het bord omdat zijn vorm groter is. */
const DRIEHOEK = 1.55

/** Hoe ver een vorm vanuit zijn midden reikt. De ring rond een punt dat net
 *  wisselde moet daarbuiten liggen: r + 6 is genoeg voor rondje, vierkant
 *  (1,27 r) en ruit (1,25 r), maar een punt van een driehoek staat op 1,55 r en
 *  stak door die ring heen. */
function reik(cluster: number, r: number) {
  return cluster >= 3 ? r * DRIEHOEK : r
}

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
  const fill = streep ? 'none' : vol ? kleur : '#fff'
  const stroke = !vol || dik > 0 ? kleur : 'none'
  const sw = dik > 0 ? dik : !vol ? 2.5 : 0
  const dash = streep ? '5 4' : undefined
  const common = { fill, stroke, strokeWidth: sw, strokeDasharray: dash, opacity }
  if (cluster === 0) return <circle cx={x} cy={y} r={r} {...common} />
  if (cluster === 1) {
    const h = r * 0.9
    return <rect x={x - h} y={y - h} width={h * 2} height={h * 2} {...common} />
  }
  if (cluster === 2) {
    const d = r * 1.25
    return <path d={`M ${x} ${y - d} L ${x + d} ${y} L ${x} ${y + d} L ${x - d} ${y} Z`} {...common} />
  }
  /* Een driehoek met zijn zwaartepunt op het punt, zodat het lijntje naar de
     centroid uit het midden vertrekt. Ronde hoeken in de rand: bij een
     scherpe hoek van 60 graden steekt een rand een volle randdikte voorbij de
     punt uit, twee keer zo ver als langs de zijden. */
  const d = r * DRIEHOEK
  const w = d * 0.866
  const op = cluster === 3 ? -1 : 1
  return (
    <path
      d={`M ${x} ${y + op * d} L ${x + w} ${y - (op * d) / 2} L ${x - w} ${y - (op * d) / 2} Z`}
      strokeLinejoin="round"
      {...common}
    />
  )
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
              data-ann="lijntje"
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
          <g key={`g${j}`} data-ann="spook" pointerEvents="none">
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
        <g key={`cv${j}`} data-centroid={j} pointerEvents="none">
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
            data-punt={i}
            role={kiest ? 'button' : undefined}
            tabIndex={kiest ? 0 : undefined}
            aria-label={
              kiest ? `punt ${i + 1}${gekozen.includes(i) ? ', gekozen als centroid' : ''}` : undefined
            }
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
              <circle
                data-ann="ring"
                cx={cx}
                cy={cy}
                r={Math.max(r + 6, reik(c, r) + 4)}
                fill="none"
                stroke={KLEUR[c]}
                strokeWidth={2.5}
              />
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
        <g data-ann="band">
          <Tekst x={X((MIN_X + MAX_X) / 2)} y={Y(MAX_Y) - R - 18}>
            {bandZin}
          </Tekst>
        </g>
      )}
    </g>
  )
}

/* ------------------------------ de kiezer --------------------------- *
 * Vier knoppen, 2 tot 5. De gekozen knop is navy en niet blauw: blauw is op
 * dit bord de kleur van cluster 1, en een blauwe "4" zou lezen alsof die knop
 * iets met de blauwe cluster te maken heeft. Navy is de kleur van alle
 * knoptekst op dit bord, dus de gekozen knop is gewoon een omgekeerde knop.
 * De rand blijft ook bij de gekozen knop staan, anders verspringt het raster
 * een pixel bij elke keuze.                                                */

function Kiezer({ aantal, onKies }: { aantal: Aantal; onKies: (k: Aantal) => void }) {
  return (
    <div>
      <div
        id="kmeans-aantal"
        className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-ink/75"
      >
        Aantal clusters
      </div>
      <div role="group" aria-labelledby="kmeans-aantal" className="mt-1.5 grid grid-cols-4 gap-1.5">
        {AANTALLEN.map((k) => {
          const aan = k === aantal
          return (
            <button
              key={k}
              type="button"
              onClick={() => onKies(k)}
              aria-pressed={aan}
              className={`h-8 rounded-full font-display text-[15px] font-extrabold tabular-nums transition ${
                aan ? 'bg-navy text-white' : 'bg-white text-navy hover:bg-navy/5'
              }`}
              style={{ boxShadow: `inset 0 0 0 1.5px ${aan ? NAVY : 'color-mix(in srgb, var(--color-navy) 22%, white)'}` }}
            >
              {k}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------- het bord --------------------------- */

/** De seed van "Kies willekeurig" bij 2 clusters. Elk aantal heeft zijn eigen
 *  reeks (zie `toeval`), en 2 houdt de seed die het bord altijd had. */
const SEED = 20260930

export default function KMeansStappen() {
  const [aantal, setAantal] = useState<Aantal>(2)
  /** De punten die de leerling als centroid koos, in volgorde: cluster 1, 2, ... */
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

  /** Elke leerling en elke beamer krijgt dezelfde "willekeurige" reeks, en
   *  dat per aantal: de eerste keer "Kies willekeurig" bij 4 clusters geeft
   *  overal dezelfde punten, wat je daarvoor bij 2 of 3 ook deed. */
  const toeval = useRef(new Map<Aantal, () => number>())

  /* De betaling telt alle starts voor dit aantal. Bij 5 zijn dat 8 568 runs:
     gemeten 40 ms in node en 48 ms in Chromium. Het bord rekent ze pas uit als
     een run klaar is, en warmt ze 400 ms nadat het aantal gekozen is al op,
     zodat de klik op het aantal zelf niet hapert. `uitkomsten` onthoudt elk
     aantal maar één keer. */
  useEffect(() => {
    const t = window.setTimeout(() => uitkomsten(aantal), 400)
    return () => window.clearTimeout(t)
  }, [aantal])
  const alle = fase === 'klaar' ? uitkomsten(aantal) : null

  const getoond: Punt[] =
    beeld ?? (fase === 'kiezen' ? gekozen.map((i) => PUNTEN[i]) : centroids)

  /* ------------------------------ de zetten ----------------------------- */

  /** Alles van een run weg, ook een centroid die nog onderweg is. */
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
    // Niets van een vorige run blijft hangen, ook geen centroid die nog schuift.
    setAnim(null)
    setBeeld(null)
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
    setFase(!eerste && n === 0 ? 'klaar' : 'stap2')
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
    let r = toeval.current.get(aantal)
    if (!r) {
      r = seeded(SEED + aantal - 2)
      toeval.current.set(aantal, r)
    }
    zetStart(willekeurigeStart(aantal, r))
  }

  /** Een ander aantal wist de hele run. Hetzelfde aantal nog eens kiezen doet
   *  niets: wie per ongeluk op de gekozen knop drukt, verliest zijn run niet. */
  const kiesAantal = (k: Aantal) => {
    if (k === aantal) return
    setAantal(k)
    wis()
  }

  /** De start van de slides is een start met 2 clusters, dus het aantal gaat
   *  mee naar 2. De kiezer springt zichtbaar mee. */
  const startSlides = () => {
    setAantal(2)
    zetStart([...START_SLIDES])
  }

  /* ------------------------------ de zinnen ----------------------------- */

  const nogTeKiezen = aantal - gekozen.length
  /** Met 2 centroids is er maar één andere: "de". Vanaf 3 zijn er meer: "een". */
  const andere = aantal === 2 ? 'de andere centroid' : 'een andere centroid'
  /** Gemeten: één start op 8 568, bij 5 clusters (zie kmeans.ts). */
  const legeCluster = clusters !== null && new Set(clusters).size < aantal

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
          ? `${getal(wissels)} ${meervoud(wissels, 'punt koos', 'punten kozen')} ${andere}.`
          : fase === 'stap1' && spoken && geschoven === 1
            ? 'De gestippelde vormen tonen waar de centroids eerst stonden.'
            : null

  /** Wat de leerling nu doet, in het paneel dat nooit inklapt. */
  const stand =
    fase === 'kiezen'
      ? gekozen.length === 0
        ? `Klik op ${getal(aantal)} punten. Dat worden de centroids, één voor elke cluster.`
        : `Klik nog op ${getal(nogTeKiezen)} ${meervoud(nogTeKiezen, 'punt', 'punten')}. Klik je een centroid nog eens aan, dan is hij weer een gewoon punt.`
      : fase === 'stap1' && clusters === null
        ? 'De centroids staan klaar. Druk op knop 1: elk punt kiest de dichtste centroid.'
        : fase === 'stap2'
          ? legeCluster
            ? 'Druk op knop 2: elke centroid schuift naar het gemiddelde van zijn punten. Eén centroid heeft geen punten meer. Die blijft staan.'
            : 'Druk op knop 2: elke centroid schuift naar het gemiddelde van zijn punten.'
          : fase === 'stap1'
            ? /* NIET "de centroids zijn verschoven": gemeten over alle starts
                 blijft bij knop 2 vaak een centroid staan, omdat hij al op het
                 gemiddelde van zijn punten stond. Bij 3 clusters in 606 van de
                 1 796 keer knop 2, bij 4 in 3 268 van de 6 417, bij 5 in
                 11 399 van de 17 703, en bij 2 één keer. Wat altijd klopt, is
                 waar ze nu staan. */
              legeCluster
              ? 'De centroid zonder punten bleef staan. De andere staan nu op het gemiddelde van hun punten. Kiest elk punt nog altijd dezelfde centroid? Druk op knop 1.'
              : 'Elke centroid staat nu op het gemiddelde van zijn punten. Kiest elk punt nog altijd dezelfde centroid? Druk op knop 1.'
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
            ? `Dat punt ligt nu dichter bij ${andere}.`
            : `Die punten liggen nu dichter bij ${andere}.`

  /* De betaling: pas na een volle run, en elk getal komt uit `uitkomsten`. */
  const dezeUitkomst = alle && clusters ? (alle.telling.get(sleutel(clusters)) ?? 0) : 0
  const eenUitkomst = alle !== null && alle.telling.size === 1

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
          nooit inklapt, en in de band op het bord. De harde spatie in de titel
          houdt "voor stap" bij elkaar: op 1024x768 brak hij als "K-means stap
          voor / stap", met één los woord op de tweede regel. */}
      <Brief eyebrow="mAIstros 2 - les 7" title={'K-means stap voor stap'}>
        <p>K-means herhaalt twee stappen tot er niks meer verandert.</p>
        <p>
          Dit zijn de {getal(PUNTEN.length)} punten van de slides. Jij kiest in hoeveel clusters
          k-means ze opdeelt.
        </p>
      </Brief>

      {/* Het paneel staat er van de eerste tel af en verandert nooit van
          breedte: Canvas houdt die breedte vrij, dus een paneel dat later
          opduikt zou het bord herkaderen. Alleen de hoogte verandert.

          DE VOLGORDE IS VAST en volgt het algoritme: eerst het aantal clusters,
          dan wat je nu doet, dan de twee knoppen van het algoritme, dan de
          teller, en onderaan de knoppen voor de start.

          WAT ER STAAT HANGT AF VAN DE FASE, en dat is gemeten. Met de kiezer
          erbij scrolde het paneel op 900x700 in ELKE toestand (535 tot 592 px
          inhoud in 506 px), en op 1024x768 na elke volle run met 3 of meer
          clusters. Wat er nu wegvalt, heeft in die fase geen werk:
            - de twee knoppen van het algoritme staan er alleen tijdens de run.
              Bij het kiezen en na het einde staan ze allebei uit.
            - de zin onder de kiezer staat er alleen als je het aantal kiest:
              bij het kiezen, en na het einde als vraag. Midden in een run
              heeft hij zijn werk gedaan.
            - "Start zoals op de slides" staat er alleen bij het kiezen en na
              het einde: dat zijn de twee momenten waarop je een start kiest.
              Midden in een run is "Opnieuw" de uitweg.
          Zo wisselen de knoppen van het algoritme en de betaling elkaar af, en
          blijft het paneel ongeveer even hoog. Gemeten op 900x700, waar het
          paneel 506 px heeft: kiezen 395-414, tijdens de run 453-472, na het
          einde 415-452, en 490 in de ene toestand met een lege cluster. Op
          1024x768 dezelfde getallen (574 px vrij), op 1280 en 1440 336-418.
          Geen enkel paneel scrolt, bij geen enkel aantal. */}
      <Panel className="pointer-events-auto absolute bottom-4 left-4 z-10 flex max-h-[calc(100%-12rem)] w-[16rem] flex-col overflow-y-auto px-4 py-3.5 xl:max-h-[calc(100%-15rem)] xl:w-[21rem]">
        {/* HET AANTAL KIES JIJ. De zin eronder is de reden dat de kiezer er
            is, en na een volle run wordt hij de vraag die de leerling zelf
            beantwoordt. Het bord rekent geen beste aantal uit: de les oordeelt
            door te kijken (2129261). */}
        <Kiezer aantal={aantal} onKies={kiesAantal} />
        {(fase === 'kiezen' || fase === 'klaar') && (
          <p className="mt-2 text-[13.5px] leading-snug text-ink">
            {fase === 'klaar'
              ? 'Probeer 2, 3, 4 en 5. Welk aantal past het best bij de punten?'
              : 'K-means kiest niet hoeveel clusters er komen. Dat kies jij.'}
          </p>
        )}

        {stand && <p className="mt-3 text-[13.5px] leading-snug text-ink">{stand}</p>}
        {/* DE BETALING, zodra het algoritme stopt: dan is dit wat de leerling
            nu moet lezen. Elk getal komt uit `uitkomsten`, en de derde zin
            volgt uit die telling, niet uit deze tekst. */}
        {alle && clusters && (
          <p className="mt-3 text-[13.5px] leading-snug text-ink">
            Er zijn {getal(alle.starts)} manieren om {getal(aantal)} punten als centroids te
            kiezen.{' '}
            {dezeUitkomst === alle.starts
              ? `Alle ${getal(dezeUitkomst)} komen bij deze clusters uit.`
              : `Daarvan ${meervoud(dezeUitkomst, 'komt', 'komen')} er maar ${getal(dezeUitkomst)} bij deze clusters uit.`}{' '}
            {eenUitkomst
              ? 'De start maakt hier dus niet uit.'
              : 'De uitkomst hangt dus af van waar je start. Dat is geen fout. Druk op Opnieuw en kies andere punten.'}
          </p>
        )}

        {/* De twee stappen van het algoritme, alleen tijdens de run. Alleen de
            volgende staat aan: de volgorde is wat je hier leert. */}
        {(fase === 'stap1' || fase === 'stap2') && (
          <div className="mt-2.5 flex flex-col gap-1.5">
            <Btn full disabled={fase !== 'stap1' || bezig} onClick={stap1}>
              1. Elk punt kiest de dichtste centroid
            </Btn>
            <Btn full disabled={fase !== 'stap2' || bezig} onClick={stap2}>
              2. Elke centroid schuift naar het gemiddelde
            </Btn>
          </div>
        )}

        <Vaststelling
          label="Punten die van kleur veranderden"
          value={wissels}
          outOf={{ total: PUNTEN.length, noun: 'punten' }}
          detail={detail}
          empty="Nog geen enkel punt hoort bij een cluster."
        />

        {/* DE KNOPPEN VOOR DE START. Er stonden er ooit vier in vier rijen plus
            een regel tekst, en na een run met 3 clusters zakte de laatste knop
            36 px onder de rand van het paneel, al op 1024x768. Daarom delen
            "Kies willekeurig" en "Opnieuw" één plaats: kiezen kan alleen zolang
            er nog geen centroids staan, en opnieuw beginnen heeft pas zin als
            ze er wel staan. Het aantal clusters staat bovenaan, in de kiezer. */}
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
          {(fase === 'kiezen' || fase === 'klaar') && (
            <Btn variant="ghost" onClick={startSlides}>
              Start zoals op de slides
            </Btn>
          )}
        </div>
      </Panel>
    </div>
  )
}
