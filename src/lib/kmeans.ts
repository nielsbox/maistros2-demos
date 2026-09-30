/* ------------------------------------------------------------------ *
 * k-means op de 18 punten van les 7 (lc 4529, slides 2129255-2129261).
 *
 * DE DATA IS DIE VAN DE LES ZELF. De punten zijn met blobdetectie uit de
 * afbeelding van slide 2129255 gehaald (0e1b02b7a1d041f08e2ab7b36132a634.png,
 * 1212x662 px, y naar beneden). Hier staat y omgedraaid (662 - y), zodat
 * boven op het bord ook boven op de slide is. Afstanden veranderen daar niet
 * door, dus elke telling hieronder geldt voor beide.
 *
 * GEMETEN, en exact: in breuken nagerekend (scratchpad km/sim.py) en hier in
 * floats opnieuw, met dezelfde uitkomst.
 *
 *   - Vanaf de start van de slides (punt 5 blauw, punt 8 oranje, of index 4
 *     en 7 in PUNTEN) volgt deze code alle zeven slides: eerst 5 blauw en 13
 *     oranje, dan wisselen er 3 punten van oranje naar blauw (2129259: "3
 *     punten van de oranje cluster"), 8 en 10, en daarna wisselt er geen
 *     enkel punt meer.
 *   - Met 2 clusters komen ALLE 153 manieren om 2 punten als centroid te
 *     kiezen bij dezelfde twee clusters uit (8 en 10).
 *   - Het bord laat 2, 3, 4 of 5 clusters kiezen (het bereik van Stap 6,
 *     2129379). Over ALLE starts, elk met deze code tot het einde gedraaid
 *     (gemeten 2026-09-30 met de functies hieronder, twee keer, met twee
 *     aparte scripts die dezelfde tabel gaven):
 *
 *       clusters  starts  uitkomsten  vaakste  wissels stijgen  knop 1 hoogstens
 *          2        153        1         153        26               6 keer
 *          3        816       39         109        11               7 keer
 *          4      3 060      251         243        47               8 keer
 *          5      8 568      748         398       146               9 keer
 *
 *     "knop 1 hoogstens" telt de laatste druk mee, die met 0 wissels. Elke
 *     start stopt: geen enkele haalt de grens van 100 rondes.
 *   - EEN LEGE CLUSTER, gemeten omdat het bord dat zinnetje anders niet mag
 *     zeggen. Na de eerste keer kiezen is er nooit een cluster leeg: een
 *     centroid begint op een punt, en dat punt ligt op afstand 0 van hem. Aan
 *     het EINDE is er ook nooit een leeg (0 van 153, 816, 3 060 en 8 568). Maar
 *     onderweg gebeurt het precies één keer: met 5 clusters en start 7, 10,
 *     13, 15, 17 (indexen in PUNTEN, zoals START_SLIDES; op het bord heten ze
 *     punt 8, 11, 14, 16 en 18) verliest de vierde cluster bij de tweede keer
 *     kiezen zijn laatste punt. `schuifNaarGemiddelde` laat die centroid
 *     dan staan, en bij de volgende keer kiezen krijgt hij er weer één. Het
 *     bord zegt daarom nergens "k-means maakt altijd precies zoveel clusters",
 *     en in die ene toestand zegt het dat die centroid blijft staan.
 *   - Er is nergens een gelijke stand: geen enkel punt ligt ooit even ver van
 *     twee centroids (0 keer over alle starts voor 2 tot 5 clusters, ook bij
 *     de eerste keer kiezen; het kleinste verschil in kwadratische afstand is
 *     3,0 bij 5 clusters, ver boven de 1e-9 hieronder). De regel voor een
 *     gelijke stand draait dus nooit, maar staat er zodat het bord ook dan
 *     iets zinnigs doet. En daarom maakt de VOLGORDE waarin je de punten
 *     aanklikt niets uit voor de uitkomst, alleen voor de kleuren.
 *
 * WAT NIET KLOPT EN DUS NERGENS OP HET BORD STAAT: "elke keer wisselen er
 * minder punten". Het aantal wissels STIJGT eens (kolom "wissels stijgen"
 * hierboven: 26 van de 153 starts met 2 clusters, 11 van de 816 met 3). Het
 * bord zegt alleen wat altijd waar is: k-means stopt de eerste keer dat geen
 * enkel punt wisselt.
 *
 * Deze getallen worden op het bord NIET overgetypt. `uitkomsten()` rekent ze
 * in de browser opnieuw uit de punten, en het bord toont wat daar uitkomt.
 * ------------------------------------------------------------------ */

export type Punt = { x: number; y: number }

/** 2 tot 5 clusters: het bereik van Stap 6 (2129379). Beide borden van les 7
 *  laten precies die vier kiezen. */
export type Aantal = 2 | 3 | 4 | 5
export const AANTALLEN: readonly Aantal[] = [2, 3, 4, 5]

const HOOGTE = 662

const RUW: [number, number][] = [
  [80, 328],
  [210, 288],
  [232, 428],
  [292, 544],
  [312, 178],
  [422, 404],
  [444, 138],
  [508, 282],
  [656, 504],
  [664, 370],
  [736, 200],
  [796, 578],
  [820, 342],
  [860, 98],
  [870, 498],
  [940, 200],
  [1050, 426],
  [1136, 304],
]

export const PUNTEN: readonly Punt[] = RUW.map(([x, y]) => ({ x, y: HOOGTE - y }))

/** De twee punten die de slides als centroid kiezen (2129256): blauw, dan oranje. */
export const START_SLIDES: readonly number[] = [4, 7]

const afstand2 = (a: Punt, b: Punt) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2

/**
 * Stap 1: elk punt kiest de dichtste centroid.
 *
 * Bij een gelijke stand blijft een punt bij zijn vorige cluster, en anders
 * kiest het de centroid met het laagste nummer. Dat is de enige keuze die
 * een punt nooit laat wisselen zonder dat een andere centroid echt dichterbij
 * ligt, dus de stopregel blijft eerlijk. (Gemeten: het gebeurt op deze data
 * nooit.)
 *
 * EEN ALGORITME, TWEE BORDEN. De versies met `In` nemen de punten als
 * argument: "Hoeveel clusters?" (src/lib/clusterdata.ts) draait deze zelfde
 * lus op drie andere data sets. De versies zonder `In` zijn die met de 18
 * punten van de slides, en gedragen zich precies zoals voor die splitsing.
 * Gemeten 2026-10-01 tegen de code van voor de splitsing, over alle 12 597
 * starts met 2 tot 5 clusters: elke tussenstap van `kiesDichtste` en
 * `schuifNaarGemiddelde` gelijk (0 verschillen), dezelfde eindclusters, en
 * dezelfde telling van `uitkomsten` (1 / 39 / 251 / 748). Kopieer de lus
 * nergens naar een bord: er is maar een plek waar k-means staat.
 */
export function kiesDichtsteIn(
  punten: readonly Punt[],
  centroids: readonly Punt[],
  vorige: readonly number[] | null,
): number[] {
  return punten.map((p, i) => {
    let beste = 0
    let besteD = Infinity
    centroids.forEach((c, j) => {
      const d = afstand2(p, c)
      if (d < besteD - 1e-9) {
        beste = j
        besteD = d
      }
    })
    if (vorige) {
      const v = vorige[i]
      if (v !== beste && Math.abs(afstand2(p, centroids[v]) - besteD) <= 1e-9) return v
    }
    return beste
  })
}

export function kiesDichtste(centroids: readonly Punt[], vorige: readonly number[] | null): number[] {
  return kiesDichtsteIn(PUNTEN, centroids, vorige)
}

/**
 * Hoeveel punten even ver (op 1e-9) van twee of meer centroids liggen. Alleen
 * om te meten: bij 0 doet de regel voor een gelijke stand hierboven nooit iets,
 * en maakt de volgorde van de centroids niets uit voor de uitkomst.
 */
export function gelijkeStanden(punten: readonly Punt[], centroids: readonly Punt[]): number {
  let n = 0
  for (const p of punten) {
    let besteD = Infinity
    for (const c of centroids) besteD = Math.min(besteD, afstand2(p, c))
    let dicht = 0
    for (const c of centroids) if (Math.abs(afstand2(p, c) - besteD) <= 1e-9) dicht++
    if (dicht > 1) n++
  }
  return n
}

/**
 * Stap 2: elke centroid schuift naar het gemiddelde van zijn punten.
 *
 * Een cluster zonder punten houdt zijn centroid waar hij stond. Met starts op
 * datapunten gebeurt dat hier één keer, in één van de 8 568 starts met 5
 * clusters (zie boven), en een NaN-centroid zou het hele bord leeg tekenen.
 */
export function schuifNaarGemiddeldeIn(
  punten: readonly Punt[],
  centroids: readonly Punt[],
  clusters: readonly number[],
): Punt[] {
  return centroids.map((c, j) => {
    const van = punten.filter((_, i) => clusters[i] === j)
    if (van.length === 0) return c
    return {
      x: van.reduce((s, p) => s + p.x, 0) / van.length,
      y: van.reduce((s, p) => s + p.y, 0) / van.length,
    }
  })
}

export function schuifNaarGemiddelde(centroids: readonly Punt[], clusters: readonly number[]): Punt[] {
  return schuifNaarGemiddeldeIn(PUNTEN, centroids, clusters)
}

/** Hoeveel punten een andere cluster kregen. */
export function aantalWissels(voor: readonly number[], na: readonly number[]): number {
  let n = 0
  for (let i = 0; i < na.length; i++) if (voor[i] !== na[i]) n++
  return n
}

/**
 * Een uitkomst los van de nummers van de clusters: "blauw en oranje
 * omgewisseld" is dezelfde verdeling van de punten. Punt 0 krijgt altijd
 * cluster 0, het eerste punt uit een andere cluster krijgt 1, enzovoort.
 */
export function sleutel(clusters: readonly number[]): string {
  const nieuw = new Map<number, number>()
  return clusters
    .map((c) => {
      if (!nieuw.has(c)) nieuw.set(c, nieuw.size)
      return nieuw.get(c)!
    })
    .join(',')
}

/** Het eindresultaat van een run: de clusters en waar de centroids staan. */
export type Eind = { clusters: number[]; centroids: Punt[] }

/**
 * Het hele algoritme vanaf een start (indexen in `punten`), tot er geen enkel
 * punt meer wisselt.
 *
 * De centroids die terugkomen staan op het gemiddelde van de clusters die
 * terugkomen. Dat hoeft niet opnieuw uitgerekend te worden: de lus stopt pas
 * als knop 1 na de laatste keer schuiven niemand van cluster doet wisselen, en
 * dan zijn het nog dezelfde clusters als die waarvan net het gemiddelde
 * genomen werd. Alleen als de grens van 100 rondes zou vallen, is dat niet zo
 * (gemeten: dat gebeurt nooit), en dan schuiven ze nog een keer.
 */
export function draaiTotHetEindeIn(punten: readonly Punt[], start: readonly number[]): Eind {
  let centroids: Punt[] = start.map((i) => punten[i])
  let clusters = kiesDichtsteIn(punten, centroids, null)
  for (let keer = 0; keer < 100; keer++) {
    centroids = schuifNaarGemiddeldeIn(punten, centroids, clusters)
    const volgende = kiesDichtsteIn(punten, centroids, clusters)
    if (aantalWissels(clusters, volgende) === 0) return { clusters: volgende, centroids }
    clusters = volgende
  }
  return { clusters, centroids: schuifNaarGemiddeldeIn(punten, centroids, clusters) }
}

/** Het hele algoritme op de 18 punten van de slides. */
export function draaiTotHetEinde(start: readonly number[]): number[] {
  return draaiTotHetEindeIn(PUNTEN, start).clusters
}

function* combinaties(n: number, k: number, van = 0, huidig: number[] = []): Generator<number[]> {
  if (huidig.length === k) {
    yield huidig
    return
  }
  for (let i = van; i <= n - (k - huidig.length); i++) yield* combinaties(n, k, i + 1, [...huidig, i])
}

export type Uitkomsten = {
  /** Op hoeveel manieren je k punten als centroid kan kiezen. */
  starts: number
  /** Per uitkomst (zie `sleutel`): uit hoeveel van die starts ze volgt. */
  telling: Map<string, number>
}

const cache = new Map<number, Uitkomsten>()

/**
 * Alle starts voor k clusters, elk tot het einde gedraaid. Voor 5 clusters
 * zijn dat 8 568 runs: gemeten 40 ms in node en 48 ms in Chromium, en maar één
 * keer per k. Het bord vraagt dit pas op als een run klaar is, en warmt het
 * 400 ms nadat het aantal gekozen is al op, zodat de klik op het aantal zelf
 * niet hapert.
 */
export function uitkomsten(k: number): Uitkomsten {
  const al = cache.get(k)
  if (al) return al
  const telling = new Map<string, number>()
  let starts = 0
  for (const start of combinaties(PUNTEN.length, k)) {
    starts++
    const s = sleutel(draaiTotHetEinde(start))
    telling.set(s, (telling.get(s) ?? 0) + 1)
  }
  const uit = { starts, telling }
  cache.set(k, uit)
  return uit
}

/**
 * Een willekeurige start, maar elke keer dezelfde reeks: `r` is een seeded()
 * generator, zodat elke leerling en elke beamer dezelfde "willekeurige"
 * punten ziet.
 */
export function willekeurigeStart(k: number, r: () => number): number[] {
  const gekozen: number[] = []
  while (gekozen.length < k) {
    const i = Math.min(PUNTEN.length - 1, Math.floor(r() * PUNTEN.length))
    if (!gekozen.includes(i)) gekozen.push(i)
  }
  return gekozen
}
