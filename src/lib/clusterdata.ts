/* ------------------------------------------------------------------ *
 * De drie data sets van "Hoeveel clusters?" (les 7, lc 4529), en de twaalf
 * toestanden die het bord toont.
 *
 * Alles ligt in het eenheidsvierkant, zodat een vast venster alle drie toont
 * en wisselen van data set het bord nooit herkadert.
 *
 * DRIE GROEPJES (60 punten). De enige set waar je het juiste aantal met je
 * ogen ziet, zodat een verkeerd aantal zichtbaar samenzet of knipt. Drie
 * centra, 20 punten elk, met een begrensde ruis (som van vier uniforme
 * getallen, sd 1, nooit verder dan 3,5 sd). Een kandidaat die dichter dan 3,2
 * bij een al gekozen punt valt, wordt opnieuw getrokken: zo raken geen twee
 * merken elkaar en ligt er geen los punt tussen de groepjes. Gemeten (2026-
 * 09-30, met deze code): x 0,167-0,885, y 0,150-0,813; kleinste afstand
 * tussen twee punten 0,0326, mediaan tot de dichtste buur 0,0424. Het
 * dichtste paar uit twee verschillende groepjes ligt 0,2309 uit elkaar, 5,44
 * keer die mediaan.
 *
 * GEEN GROEPJES (81 punten). K-means maakt ook dan zoveel clusters als je
 * vraagt: dat is de claim van het bord in zijn zuiverste vorm. Een rooster van
 * 9 x 9 met wat verschuiving, en geen uniforme toevalspunten: hun toevallige
 * gaten lezen als groepjes. Kleinste afstand 0,0523, mediaan 0,0859.
 *
 * KLANTEN (200 punten). De data van de oefening zelf, Mall_customers.csv,
 * leeftijd (kolom 2) tegen jaarinkomen (kolom 3), in de volgorde van het
 * bestand, en elk van de twee herschaald met de formule van Stap 4:
 * (v - min) / (max - min). Leeftijd 18-70, jaarinkomen 15-137. Acht rijen
 * vallen samen met een andere, dus er zijn 192 verschillende plaatsen.
 *
 * DE STARTS LIGGEN VAST. Elke toestand is een run van k-means (kmeans.ts, de
 * lus van bord 1) vanaf een vaste start, tot er niks meer verandert. Geen
 * knop "andere start", en dat is gemeten: het juiste aantal is niet stabiel
 * (Drie groepjes met 3 clusters komt maar in ongeveer 89% van de willekeurige
 * starts precies uit), en stabiel is niet passend (Klanten met 2 clusters is de
 * meest stabiele toestand van allemaal, en daar zijn geen groepjes). Wat dan
 * ook betekent dat de getoonde uitkomsten GEKOZEN zijn. Hoe vaak een
 * willekeurige start (k verschillende PLAATSEN) bij de getoonde uitkomst
 * uitkomt, in twee metingen van 5 000 starts met elk een eigen seed (de
 * ontwerpspec, en les7b-verify/meet.mts met deze code):
 *   - Drie groepjes, 2 / 3 / 4 / 5: 42,5 en 42,8 / 88,9 en 89,4 / 30,4 en 30,5
 *     / 4,7 en 5,0%. Telkens de vaakste uitkomst.
 *   - Klanten met 2: 52,1 en 50,3%, de vaakste uitkomst.
 *   - Klanten met 3, 4 en 5: precies de prenten van de slides van Stap 6
 *     (2129381, 2129383, 2129384), die willekeurige starts maar in 5,3 en 6,0
 *     / 4,3 en 4,0 / 3,2 en 3,3% van de keren halen.
 *   - Geen groepjes, 2 / 3 / 4 / 5: 32,4 en 32,9 / 8,6 en 8,6 / 23,7 en 24,8 /
 *     1,7 en 1,7%. Bij 3 en 5 gewone uitkomsten, geen uitschieters.
 * Het bord zegt daarom nergens "altijd" of "elke start".
 *
 * `controleer()` onderaan gaat in dev na dat elke toestand nog is wat hier
 * staat: de groottes, precies k clusters met punten, nooit een gelijke stand,
 * nooit onderweg een lege cluster, en voor Drie groepjes wat er met de
 * groepjes gebeurt.
 * ------------------------------------------------------------------ */

import {
  aantalWissels,
  draaiTotHetEindeIn,
  gelijkeStanden,
  kiesDichtsteIn,
  schuifNaarGemiddeldeIn,
  type Aantal,
  type Eind,
  type Punt,
} from './kmeans'
import { seeded } from './regression'

export type SetId = 'drie' | 'geen' | 'klanten'

/* ----------------------------- Drie groepjes ------------------------ */

/** Begrensd en symmetrisch, sd 1: vier uniforme getallen opgeteld. */
function normaal(r: () => number) {
  return (r() + r() + r() + r() - 2) * Math.sqrt(3)
}

const round1 = (v: number) => Math.round(v * 10) / 10

function maakDrie(): { punten: Punt[]; groep: number[] } {
  const r = seeded(31)
  const centra: [number, number][] = [
    [25, 30],
    [75, 30],
    [50, 73],
  ]
  const punten: Punt[] = []
  const groep: number[] = []
  centra.forEach(([cx, cy], g) => {
    let n = 0
    while (n < 20) {
      // x eerst, dan y: de volgorde van de trekkingen ligt vast.
      const p = { x: round1(cx + 6 * normaal(r)), y: round1(cy + 6 * normaal(r)) }
      if (punten.some((q) => (q.x - p.x) ** 2 + (q.y - p.y) ** 2 < 3.2 * 3.2)) continue
      punten.push(p)
      groep.push(g)
      n++
    }
  })
  return { punten: punten.map((p) => ({ x: p.x / 100, y: p.y / 100 })), groep }
}

const DRIE = maakDrie()
export const DRIE_GROEPJES: readonly Punt[] = DRIE.punten
/** Bij welk groepje (0, 1 of 2) elk punt van Drie groepjes hoort. */
export const GROEP: readonly number[] = DRIE.groep

/* ----------------------------- Geen groepjes ------------------------ */

function maakGeen(): Punt[] {
  const r = seeded(31)
  const punten: Punt[] = []
  for (let i = 0; i < 9; i++)
    for (let j = 0; j < 9; j++) {
      const x = (i + 0.5 + 0.35 * (2 * r() - 1)) / 9
      const y = (j + 0.5 + 0.35 * (2 * r() - 1)) / 9
      punten.push({ x, y })
    }
  return punten
}

export const GEEN_GROEPJES: readonly Punt[] = maakGeen()

/* -------------------------------- Klanten --------------------------- */

/** [leeftijd, jaarinkomen (k$)] per rij van Mall_customers.csv, in de volgorde
 *  van het bestand. */
export const KLANTEN_RUW: readonly (readonly [number, number])[] = [
  [19, 15], [21, 15], [20, 16], [23, 16], [31, 17], [22, 17], [35, 18], [23, 18], [64, 19], [30, 19],
  [67, 19], [35, 19], [58, 20], [24, 20], [37, 20], [22, 20], [35, 21], [20, 21], [52, 23], [35, 23],
  [35, 24], [25, 24], [46, 25], [31, 25], [54, 28], [29, 28], [45, 28], [35, 28], [40, 29], [23, 29],
  [60, 30], [21, 30], [53, 33], [18, 33], [49, 33], [21, 33], [42, 34], [30, 34], [36, 37], [20, 37],
  [65, 38], [24, 38], [48, 39], [31, 39], [49, 39], [24, 39], [50, 40], [27, 40], [29, 40], [31, 40],
  [49, 42], [33, 42], [31, 43], [59, 43], [50, 43], [47, 43], [51, 44], [69, 44], [27, 46], [53, 46],
  [70, 46], [19, 46], [67, 47], [54, 47], [63, 48], [18, 48], [43, 48], [68, 48], [19, 48], [32, 48],
  [70, 49], [47, 49], [60, 50], [60, 50], [59, 54], [26, 54], [45, 54], [40, 54], [23, 54], [49, 54],
  [57, 54], [38, 54], [67, 54], [46, 54], [21, 54], [48, 54], [55, 57], [22, 57], [34, 58], [50, 58],
  [68, 59], [18, 59], [48, 60], [40, 60], [32, 60], [24, 60], [47, 60], [27, 60], [48, 61], [20, 61],
  [23, 62], [49, 62], [67, 62], [26, 62], [49, 62], [21, 62], [66, 63], [54, 63], [68, 63], [66, 63],
  [65, 63], [19, 63], [38, 64], [19, 64], [18, 65], [19, 65], [63, 65], [49, 65], [51, 67], [50, 67],
  [27, 67], [38, 67], [40, 69], [39, 69], [23, 70], [31, 70], [43, 71], [40, 71], [59, 71], [38, 71],
  [47, 71], [39, 71], [25, 72], [31, 72], [20, 73], [29, 73], [44, 73], [32, 73], [19, 74], [35, 74],
  [57, 75], [32, 75], [28, 76], [32, 76], [25, 77], [28, 77], [48, 77], [32, 77], [34, 78], [34, 78],
  [43, 78], [39, 78], [44, 78], [38, 78], [47, 78], [27, 78], [37, 78], [30, 78], [34, 78], [30, 78],
  [56, 79], [29, 79], [19, 81], [31, 81], [50, 85], [36, 85], [42, 86], [33, 86], [36, 87], [32, 87],
  [40, 87], [28, 87], [36, 87], [36, 87], [52, 88], [30, 88], [58, 88], [27, 88], [59, 93], [35, 93],
  [37, 97], [32, 97], [46, 98], [29, 98], [41, 99], [30, 99], [54, 101], [28, 101], [41, 103], [36, 103],
  [34, 103], [32, 103], [33, 113], [38, 113], [47, 120], [35, 120], [45, 126], [32, 126], [32, 137], [30, 137],
]

/** De formule van `normaliseer_lijst` in Stap 4: (v - min) / (max - min). */
export function normaliseer(lijst: readonly number[]): number[] {
  const min = Math.min(...lijst)
  const max = Math.max(...lijst)
  return lijst.map((v) => (v - min) / (max - min))
}

const LEEFTIJDEN = normaliseer(KLANTEN_RUW.map(([l]) => l))
const JAARINKOMENS = normaliseer(KLANTEN_RUW.map(([, j]) => j))
export const KLANTEN: readonly Punt[] = LEEFTIJDEN.map((x, i) => ({ x, y: JAARINKOMENS[i] }))

/* -------------------------------- de sets --------------------------- */

export const PUNTEN_VAN: Record<SetId, readonly Punt[]> = {
  drie: DRIE_GROEPJES,
  geen: GEEN_GROEPJES,
  klanten: KLANTEN,
}

/**
 * De start van elke getoonde toestand: indexen in de punten van die set. Elke
 * start ligt op k verschillende PLAATSEN (bij Klanten vallen rijen samen).
 * Gemeten met deze code, per aantal 2 / 3 / 4 / 5:
 *
 *   drie     groottes 20,40 / 20,20,20 / 20,20,12,8 / 20,12,11,8,9
 *            rondes   6 / 3 / 4 / 4
 *            twee groepjes samen / elk groepje één cluster / één groepje in
 *            twee / twee groepjes elk in twee
 *   geen     groottes 40,41 / 29,25,27 / 22,23,18,18 / 14,14,22,14,17
 *            rondes   5 / 4 / 12 / 6
 *   klanten  groottes 127,73 / 57,76,67 / 44,55,61,40 / 29,45,32,42,52
 *            rondes   5 / 5 / 8 / 20
 *            de prenten van 2129382 / 2129381 / 2129383 / 2129384: 1 / 0 / 0 /
 *            0 punten verschil (dat ene punt is op de slide een stip onder een
 *            centroid)
 *
 * "Rondes" is hoe vaak de centroids naar het gemiddelde schoven.
 */
export const START: Record<SetId, Record<Aantal, readonly number[]>> = {
  drie: { 2: [51, 24], 3: [51, 30, 38], 4: [51, 35, 19, 17], 5: [18, 1, 22, 0, 20] },
  geen: { 2: [80, 19], 3: [14, 9, 56], 4: [30, 33, 5, 69], 5: [41, 78, 48, 32, 66] },
  klanten: { 2: [135, 56], 3: [78, 143, 173], 4: [121, 188, 8, 93], 5: [79, 159, 177, 75, 94] },
}

/** De groottes hierboven, per cluster in de volgorde van de start. */
const GROOTTES: Record<SetId, Record<Aantal, readonly number[]>> = {
  drie: { 2: [20, 40], 3: [20, 20, 20], 4: [20, 20, 12, 8], 5: [20, 12, 11, 8, 9] },
  geen: { 2: [40, 41], 3: [29, 25, 27], 4: [22, 23, 18, 18], 5: [14, 14, 22, 14, 17] },
  klanten: { 2: [127, 73], 3: [57, 76, 67], 4: [44, 55, 61, 40], 5: [29, 45, 32, 42, 52] },
}

const AANTALLEN_OP: readonly Aantal[] = [2, 3, 4, 5]

/* ------------------------------ de kleuren -------------------------- *
 * EEN CLUSTER HOUDT ZIJN KLEUR als je een aantal verder gaat. Anders krijgt
 * dezelfde bende punten bij 3 clusters groen en bij 4 blauw, en leest een
 * leerling een verschil dat er niet is.
 *   - Bij 2 krijgt de cluster met de kleinste x van zijn centroid kleur 0.
 *   - Bij elk volgend aantal: de verdeling van de kleuren waarbij de meeste
 *     punten hun kleur van het vorige aantal houden. Bij een gelijke stand
 *     wint de eerste permutatie in lexicografische volgorde. De ene cluster
 *     die overschiet, krijgt de nieuwe kleur k - 1.
 * Berekend uit de vier vaste toestanden, dus het hangt niet af van de
 * volgorde waarin je klikt.
 *   Punten die naar een ANDERE oude kleur gaan (van 2 naar 3, 3 naar 4, 4
 * naar 5): Drie groepjes 0 / 0 / 0 (de nieuwe kleur valt precies op de knip),
 * Geen groepjes 0 / 3 / 1, Klanten 6 / 6 / 28. Het bord zegt dus niets over
 * kleuren.                                                               */

function* permutaties(n: number): Generator<number[]> {
  // Lexicografisch: [0,1,2], [0,2,1], [1,0,2], ...
  function* rec(rest: number[], huidig: number[]): Generator<number[]> {
    if (rest.length === 0) {
      yield huidig
      return
    }
    for (let i = 0; i < rest.length; i++)
      yield* rec([...rest.slice(0, i), ...rest.slice(i + 1)], [...huidig, rest[i]])
  }
  yield* rec(
    Array.from({ length: n }, (_, i) => i),
    [],
  )
}

/**
 * Per aantal: welke kleur (0 tot k - 1) elke cluster krijgt.
 * `eindes[k]` is de toestand met k clusters.
 */
export function kleurKeten(eindes: Record<Aantal, Eind>): Record<Aantal, number[]> {
  const twee = eindes[2]
  const volgorde = [0, 1].sort((a, b) => twee.centroids[a].x - twee.centroids[b].x || a - b)
  const kleur2 = [0, 0]
  volgorde.forEach((c, kl) => (kleur2[c] = kl))
  const uit = { 2: kleur2 } as Record<Aantal, number[]>
  let vorigePerPunt = twee.clusters.map((c) => kleur2[c])
  for (const k of [3, 4, 5] as const) {
    const e = eindes[k]
    let beste = -1
    let besteP: number[] = []
    for (const p of permutaties(k)) {
      let houdt = 0
      e.clusters.forEach((c, i) => {
        if (p[c] === vorigePerPunt[i]) houdt++
      })
      if (houdt > beste) {
        beste = houdt
        besteP = p
      }
    }
    uit[k] = besteP
    vorigePerPunt = e.clusters.map((c) => besteP[c])
  }
  return uit
}

/* ------------------------------ de toestanden ----------------------- */

export type Toestand = Eind & {
  /** Per cluster zijn kleur (0 tot k - 1), zie `kleurKeten`. */
  kleur: number[]
}

const cache = new Map<SetId, Record<Aantal, Toestand>>()

/** De vier toestanden van een set, een keer uitgerekend en dan onthouden. */
export function toestandenVan(set: SetId): Record<Aantal, Toestand> {
  const al = cache.get(set)
  if (al) return al
  const punten = PUNTEN_VAN[set]
  const eindes = {} as Record<Aantal, Eind>
  for (const k of AANTALLEN_OP) eindes[k] = draaiTotHetEindeIn(punten, START[set][k])
  const kleuren = kleurKeten(eindes)
  const uit = {} as Record<Aantal, Toestand>
  for (const k of AANTALLEN_OP) uit[k] = { ...eindes[k], kleur: kleuren[k] }
  cache.set(set, uit)
  return uit
}

/* ------------------------ wat er met de groepjes gebeurt ------------ */

export type Structuur = {
  /** Clusters met punten van meer dan één groepje. */
  samen: number
  /** Groepjes met punten in meer dan één cluster. */
  geknipt: number
  /** Per cluster: van hoeveel groepjes hij punten heeft. */
  groepjesPerCluster: number[]
  /** Per groepje: over hoeveel clusters zijn punten verdeeld zijn. */
  clustersPerGroepje: number[]
}

export function structuur(clusters: readonly number[], groep: readonly number[] = GROEP): Structuur {
  const k = Math.max(...clusters) + 1
  const g = Math.max(...groep) + 1
  const perCluster = Array.from({ length: k }, () => new Set<number>())
  const perGroepje = Array.from({ length: g }, () => new Set<number>())
  clusters.forEach((c, i) => {
    perCluster[c].add(groep[i])
    perGroepje[groep[i]].add(c)
  })
  const groepjesPerCluster = perCluster.map((s) => s.size)
  const clustersPerGroepje = perGroepje.map((s) => s.size)
  return {
    samen: groepjesPerCluster.filter((n) => n > 1).length,
    geknipt: clustersPerGroepje.filter((n) => n > 1).length,
    groepjesPerCluster,
    clustersPerGroepje,
  }
}

/**
 * De zin op het bord bij Drie groepjes. BEREKEND uit de clusters en de
 * groepjes, nooit per aantal overgetypt. Een structuur die hier niet staat,
 * krijgt geen zin (en in dev een foutmelding in de console). In de vier vaste
 * toestanden gebeurt dat niet: `controleer()` gaat dat na.
 */
export function bandZinDrie(clusters: readonly number[]): string | null {
  const s = structuur(clusters)
  const twee = (n: number) => n === 2
  if (s.samen === 1 && s.geknipt === 0 && s.groepjesPerCluster.filter((n) => n > 1).every(twee))
    return 'K-means zet twee groepjes samen in één cluster.'
  if (s.samen === 0 && s.geknipt === 0) return 'Elk groepje is één cluster.'
  if (s.samen === 0 && s.geknipt === 1 && s.clustersPerGroepje.filter((n) => n > 1).every(twee))
    return 'K-means knipt één groepje in twee clusters.'
  if (s.samen === 0 && s.geknipt === 2 && s.clustersPerGroepje.filter((n) => n > 1).every(twee))
    return 'K-means knipt twee groepjes elk in twee clusters.'
  if (import.meta.env?.DEV) console.error('Hoeveel clusters: geen zin voor deze structuur', s)
  return null
}

/**
 * Waar de wijzer "het gemiddelde van twee groepjes" staat, uit de data en
 * niet uit pixels. Alleen bij een toestand waar precies één cluster twee
 * groepjes samenzet.
 *   x: die van de centroid van die cluster.
 *   y: midden tussen het hoogste punt van de twee samengezette groepjes en het
 *      laagste punt van het andere. Daar ligt een lege horizontale strook.
 * Gemeten op Drie groepjes met 2 clusters: de centroid staat op (0,5069;
 * 0,2899), 2,23 keer de mediaanafstand tot een buur van zijn dichtste punt.
 * Elke andere centroid van de vier toestanden staat hoogstens 0,83 keer die
 * afstand van een punt. De wijzer staat op y 0,544, en de gang van het lijntje
 * (|x - 0,507| < 0,04, y van 0,29 tot 0,62) bevat 0 punten.
 */
export function wijzerDrie(t: Eind): { cluster: number; x: number; y: number } | null {
  const s = structuur(t.clusters)
  const cluster = s.groepjesPerCluster.findIndex((n) => n === 2)
  if (s.samen !== 1 || s.geknipt !== 0 || cluster < 0) return null
  const samen = new Set(GROEP.filter((_, i) => t.clusters[i] === cluster))
  let hoogste = -Infinity
  let laagste = Infinity
  DRIE_GROEPJES.forEach((p, i) => {
    if (samen.has(GROEP[i])) hoogste = Math.max(hoogste, p.y)
    else laagste = Math.min(laagste, p.y)
  })
  return { cluster, x: t.centroids[cluster].x, y: (hoogste + laagste) / 2 }
}

/* -------------------------------- controle -------------------------- */

/**
 * Loopt een run stap voor stap na, zoals `draaiTotHetEindeIn`, en telt wat de
 * uitkomst zou kunnen vertekenen.
 */
export function volgRun(punten: readonly Punt[], start: readonly number[]) {
  let centroids = start.map((i) => punten[i])
  let gelijk = gelijkeStanden(punten, centroids)
  let clusters = kiesDichtsteIn(punten, centroids, null)
  const k = start.length
  let leegOnderweg = new Set(clusters).size < k
  let rondes = 0
  for (let keer = 0; keer < 100; keer++) {
    centroids = schuifNaarGemiddeldeIn(punten, centroids, clusters)
    rondes++
    gelijk += gelijkeStanden(punten, centroids)
    const volgende = kiesDichtsteIn(punten, centroids, clusters)
    if (new Set(volgende).size < k) leegOnderweg = true
    if (aantalWissels(clusters, volgende) === 0) break
    clusters = volgende
  }
  const plaatsen = new Set(start.map((i) => `${punten[i].x},${punten[i].y}`)).size
  return { rondes, gelijk, leegOnderweg, verschillendePlaatsen: plaatsen === k }
}

const VERWACHT_DRIE: Record<Aantal, string> = {
  2: 'K-means zet twee groepjes samen in één cluster.',
  3: 'Elk groepje is één cluster.',
  4: 'K-means knipt één groepje in twee clusters.',
  5: 'K-means knipt twee groepjes elk in twee clusters.',
}

/** Alle beweringen hierboven, opnieuw nagegaan. Geeft de fouten terug. */
export function controleer(): string[] {
  const fouten: string[] = []
  for (const set of ['drie', 'geen', 'klanten'] as const) {
    const punten = PUNTEN_VAN[set]
    const alle = toestandenVan(set)
    for (const k of AANTALLEN_OP) {
      const t = alle[k]
      const naam = `${set} met ${k}`
      const groottes = Array.from({ length: k }, (_, j) => t.clusters.filter((c) => c === j).length)
      if (groottes.join() !== GROOTTES[set][k].join())
        fouten.push(`${naam}: groottes ${groottes} in plaats van ${GROOTTES[set][k]}`)
      if (groottes.some((n) => n === 0)) fouten.push(`${naam}: een lege cluster`)
      const run = volgRun(punten, START[set][k])
      if (run.gelijk > 0) fouten.push(`${naam}: ${run.gelijk} gelijke standen`)
      if (run.leegOnderweg) fouten.push(`${naam}: onderweg een lege cluster`)
      if (!run.verschillendePlaatsen) fouten.push(`${naam}: start op dezelfde plaats`)
      if (new Set(t.kleur).size !== k) fouten.push(`${naam}: twee clusters met dezelfde kleur`)
      if (set === 'drie' && bandZinDrie(t.clusters) !== VERWACHT_DRIE[k])
        fouten.push(`${naam}: de zin klopt niet`)
    }
  }
  // De gang van het lijntje van de wijzer is leeg.
  const w = wijzerDrie(toestandenVan('drie')[2])
  if (!w) fouten.push('drie met 2: geen wijzer')
  else {
    const c = toestandenVan('drie')[2].centroids[w.cluster]
    const inGang = DRIE_GROEPJES.filter(
      (p) => Math.abs(p.x - w.x) < 0.04 && p.y > c.y && p.y < 0.62,
    ).length
    if (inGang > 0) fouten.push(`drie met 2: ${inGang} punten in de gang van de wijzer`)
  }
  if (DRIE_GROEPJES.length !== 60 || GEEN_GROEPJES.length !== 81 || KLANTEN.length !== 200)
    fouten.push('een data set heeft niet het juiste aantal punten')
  return fouten
}

if (import.meta.env?.DEV) {
  const fouten = controleer()
  if (fouten.length > 0) console.error('Hoeveel clusters: de toestanden kloppen niet meer.', fouten)
}
