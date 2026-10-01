import type { Scales } from './Canvas'
import {
  DATA,
  DERDE,
  DERDE_INK,
  FOUT,
  FOUT_INK,
  INK,
  MODEL,
  VIERDE,
  VIJFDE,
  VIJFDE_INK,
} from '../lib/palette'

/* ------------------------------------------------------------------ *
 * De merken van de twee borden van les 7: "K-means stap voor stap" en
 * "Hoeveel clusters?". Ze staan hier en niet in een van de twee borden, zodat
 * een cluster op beide borden dezelfde vorm en dezelfde kleur heeft.
 *
 * Elke cluster heeft een eigen VORM en een eigen kleur. Nooit kleur alleen.
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
 * groen/oranje met dE 8,9 onder protanopie. De oude opmerking in KweekDeBoom
 * dat groen tegen dat oranje naar dE 4,0 zakt, geldt niet voor DERDE: de
 * validator geeft DERDE tegen FOUT 8,9. CLAUDE.md schrijft die 4,0 toe aan het
 * donkergroen van CodeFever zelf.
 *   Tegen navy, de kleur van "nog geen cluster", haalt elke tint minstens
 * dE 35,3 bij gewoon zicht en 22,6 onder protanopie (rood). Geen cluster kan
 * dus doorgaan voor "zwart".
 *   Groen en rood staan samen in deze set, en dat mag hier: DERDE tegen
 * VIERDE geeft dE 11,1 onder deuteranopie en 29,9 bij gewoon zicht, PASS.
 * CLAUDE.md zegt dat elk paar rood en groen zakt "however you step it". Voor
 * deze twee tinten klopt dat niet (gemeten 2026-09-30). Draai de validator
 * opnieuw in plaats van een van beide zinnen te geloven.
 *
 * Oranje betekent hier "de oranje cluster" en niet "fout", en rood "de rode
 * cluster": er staat op deze borden geen enkele misser.                     */

export const KLEUR = [MODEL, FOUT, DERDE, VIERDE, VIJFDE] as const
/** De letter C op een centroid: minstens 4,5:1 op wit. MODEL haalt 4,51 en
 *  VIERDE 6,95 zelf; de andere drie krijgen hun inkt. */
export const INKT = [MODEL, FOUT_INK, DERDE_INK, VIERDE, VIJFDE_INK] as const

/** Een driehoek met deze omtrekstraal (maal r) heeft dezelfde oppervlakte als
 *  een rondje met straal r: 1,299 x 1,55² = 3,12, tegen pi = 3,14. Zo weegt geen
 *  cluster zwaarder op het bord omdat zijn vorm groter is. */
export const DRIEHOEK = 1.55

/** Hoe ver een vorm vanuit zijn midden reikt. De ring rond een punt dat net
 *  wisselde moet daarbuiten liggen: r + 6 is genoeg voor rondje, vierkant
 *  (1,27 r) en ruit (1,25 r), maar een punt van een driehoek staat op 1,55 r en
 *  stak door die ring heen. */
export function reik(cluster: number, r: number) {
  return cluster >= 3 ? r * DRIEHOEK : r
}

/** Hoe ver een vorm BOVEN zijn midden reikt, zonder de rand: waar een lijntje
 *  dat van boven komt de vorm raakt. */
export function bovenkant(cluster: number, r: number) {
  if (cluster === 1) return r * 0.9
  if (cluster === 2) return r * 1.25
  if (cluster === 3) return r * DRIEHOEK
  if (cluster === 4) return (r * DRIEHOEK) / 2
  return r
}

export function Vorm({
  cluster,
  x,
  y,
  r,
  vol = true,
  dik = 0,
  streep = false,
  opacity = 1,
  halo = 0,
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
  /** Een witte rand van zoveel px BUITEN een volle vorm, zodat twee merken die
   *  dicht bij elkaar liggen van elkaar los blijven. De rand wordt eerst
   *  geschilderd en de vorm erover (paintOrder), dus de vorm zelf blijft even
   *  groot. 0 = geen rand, zoals op "K-means stap voor stap". */
  halo?: number
}) {
  const wit = halo > 0 && vol && dik === 0 && !streep
  const randWit = wit ? { stroke: '#fff', strokeWidth: halo * 2, paintOrder: 'stroke' as const } : {}
  if (cluster < 0)
    return <circle cx={x} cy={y} r={r} fill={DATA} opacity={opacity} {...randWit} />
  const kleur = KLEUR[cluster]
  const fill = streep ? 'none' : vol ? kleur : '#fff'
  const stroke = !vol || dik > 0 ? kleur : 'none'
  const sw = dik > 0 ? dik : !vol ? 2.5 : 0
  const dash = streep ? '5 4' : undefined
  const common = { fill, stroke, strokeWidth: sw, strokeDasharray: dash, opacity, ...randWit }
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
export function Tekst({
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

/**
 * EEN SCHAAL VOOR BEIDE ASSEN, en dat is hier geen smaak. "Dichtste centroid"
 * moet op het scherm ook de dichtste ZIJN. Canvas schaalt x en y apart om de
 * vrije ruimte te vullen, en dan ligt een punt dat op het scherm dichter bij
 * blauw lijkt soms echt dichter bij oranje. Dus: de kleinste van de twee
 * schalen, en het kader (met midden `mx`, `my`) in het midden van het vrije
 * vlak. `schaal` is het aantal pixels per eenheid.
 */
export function eenSchaal(s: Scales, mx: number, my: number) {
  const schaal = Math.min(1 / s.unitPerPx.x, 1 / s.unitPerPx.y)
  const X = (x: number) => s.sx(mx) + (x - mx) * schaal
  const Y = (y: number) => s.sy(my) - (y - my) * schaal
  return { schaal, X, Y }
}
