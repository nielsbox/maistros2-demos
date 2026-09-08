/**
 * Een beslissingsboom van EEN vraag, de regressiegrens waar les 5 hem
 * tegenover zet, en de data set waarop dat verschil te zien is.
 *
 * Net als regression.ts blijft dit aan de oppervlakte formulevrij: het bord
 * toont gedrag, nooit een afleiding.
 *
 * ------------------------------------------------------------------------
 * WAT HIER GEMETEN IS, EN WAAROM DE OORSPRONKELIJKE CLAIM SNEUVELDE
 * ------------------------------------------------------------------------
 *
 * Het bord hierop zou eerst beweren: "sleep een punt ver weg en er beweegt
 * NIETS". Dat is FOUT voor een `DecisionTreeClassifier` met de standaard-
 * instellingen. Sleep je een punt naar de verre hoek aan de andere kant van
 * de grens, dan verschuift de grens in 100% van 900 sleepbewegingen, mediaan
 * 15,0% van het bord. Nagemeten op de data set hieronder, met sklearn zelf:
 * een onbeperkte boom verkleurt 14,5% van het bord bij een sleepbeweging naar
 * de rechterhoeken. Die 15% is dus reproduceerbaar en de claim is dood.
 *
 * Wat WEL overleeft, en het is een scherpere les, is dit: de boom trekt zijn
 * grens op EEN plek en negeert de rest. Die plek is het gat tussen de twee
 * groepen - hier "de strook" - en de grens ligt precies in het midden van dat
 * gat. Gemeten over 30 punten x 2 961 neerzetplekken = 88 830 sleepbewegingen,
 * met een boom van één vraag:
 *
 *   punt dat de grens niet vasthoudt, BUITEN de strook neergelegd
 *       -> grens exact 0 px verschoven in 68 208 van 68 208 sleepbewegingen
 *   punt dat de grens niet vasthoudt, IN de strook neergelegd
 *       -> grens verschoven in 14 700 van 14 700 sleepbewegingen
 *   de twee punten die de strook afbakenen, waar je ze ook neerlegt
 *       -> grens verschoven in 1 197 van 1 197 plekken, mediaan 0,8 px
 *   de grens van kleinste kwadraten, over al die sleepbewegingen
 *       -> verschoven in 88 830 van 88 830, mediaan 14,5 px zijwaarts
 *
 * Twee dingen die daar tegen de oorspronkelijke briefing ingaan, en waar de
 * meting voorgaat:
 *
 * 1. "Waar je het punt neerlegt maakt de boom niets uit, alleen welk punt je
 *    oppakt" is te sterk. Waar je het neerlegt maakt wél uit: in de strook
 *    beweegt de grens ALTIJD, ook bij een punt dat haar niet vasthield
 *    (14 700 van 14 700). De regel die de meting draagt is dus die van de
 *    strook, niet die van de twee punten alleen.
 * 2. De twee punten die de strook afbakenen verschuiven de grens wel altijd,
 *    maar mediaan 0,8 px - dat is op een beamer niet te zien. Het bord mag
 *    dus niet beloven dat de grens "springt" zodra je zo'n punt oppakt.
 *
 * WAAROM EEN VRAAG EN NIET MEER. Met een onbeperkte boom stort de les in (zie
 * boven). Met `min_samples_leaf=2` is het nog erger dan met 1: dan pakt de
 * boom er een buur bij en verschuift ze in de helft van de gevallen flink
 * (bimodaal, mediaan 14,7% als ze beweegt). Dus: één vraag.
 *
 * En dat is hier geen truc: op deze data set scheidt één vraag de twee
 * groepen volledig, dus de gini van beide bladeren is nul en de boom van de
 * les - `DecisionTreeClassifier()`, alle defaults - stopt zelf na die ene
 * vraag. Zolang de leerling geen punt in de strook legt, is de boom op het
 * bord exact de boom uit het notebook.
 *
 * WAAROM KLEINSTE KWADRATEN ALS TEGENSPELER EN GEEN LOGISTISCHE REGRESSIE.
 * Ook gemeten: bij een punt dat je naar buiten sleept op zijn eigen kant
 * beweegt de logistische grens een mediaan van 0,09% van het bord (0,68 px).
 * Dan lijken BEIDE modellen bevroren en leert het bord niets. Kleinste
 * kwadraten - het model uit les 1 - bewoog in elke gemeten sleepbeweging.
 *
 * Deze code is gekruiscontroleerd tegen `DecisionTreeClassifier(max_depth=1)`
 * uit sklearn: op de data set hieronder geeft ze hetzelfde kenmerk en dezelfde
 * drempel tot op 1e-6 (sklearn rekent intern in float32, vandaar het staartje).
 * Het meetscript staat in de sessienotities van les 5.
 */

import { seeded } from './regression'

/** Soort 1 (0) of Soort 2 (1). Dat zijn de twee namen die les 5 zelf gebruikt
 *  voor de groepen van haar eerste voorbeeld (slide 2132149). */
export type Klasse = 0 | 1

/** Eén rij uit de data set: twee kenmerken, en de soort die erbij hoort. */
export type Rij = { x: number; y: number; klasse: Klasse }

/* ------------------------------- de data ---------------------------------
 * Dertig rijen, twee kenmerken. De vorm is niet gekozen maar afgedwongen door
 * wat er te meten valt:
 *
 * - SCHEIDBAAR OP EEN KENMERK. Kenmerk 1 zet de twee groepen uiteen, kenmerk 2
 *   niet. Bij een diagonale wolk wisselt de wortelsplitsing van as en verkleurt
 *   ~50% van het bord, en dan bleef de grens in maar 7,5% van de sleep-
 *   bewegingen staan. Op deze data set wisselde de as in 0 van 88 830.
 * - RUIM LEGE RAND. De lege ruimte links en rechts is elk ongeveer 0,7 keer de
 *   breedte van de data zelf. Dat is nodig om ver te kunnen slepen: bij een
 *   rand van 0,6 keer verschuift de regressiegrens 4,1% van het bord, bij 1,0
 *   keer 7,0%. Kleiner en het verschil is niet meer te zien van achter in de
 *   klas.
 * - DERTIG RIJEN. Genoeg om een wolk te zijn, weinig genoeg om ze te tellen.
 * - KENMERK 2 BLIJFT TUSSEN 20 EN 90, terwijl het venster tot 100 loopt. Dat
 *   is geen data-argument maar een leesbaarheidsargument: boven en onder de
 *   wolk blijft zo een strook vrij waar de aanduidingen van het bord staan.
 *   Gemeten op 1024x768: onder de wolk 147 px vrij en erboven 69 px, genoeg
 *   voor de vijf aanduidingen zonder dat er één over een punt valt. Het maakt
 *   voor de metingen niets uit - de boom splitst op kenmerk 1, en met de
 *   ruimere spreiding kwamen er exact dezelfde tellingen uit.
 *
 * `seeded` en niet `Math.random`: elke leerling en elke beamer moet exact
 * hetzelfde bord zien, anders klopt geen enkel getal dat we ooit opschrijven.
 * Deze generator is bit voor bit dezelfde als die in het meetscript, dus de
 * getallen hierboven horen echt bij deze dertig rijen.                    */

/** Het openingsbeeld van het bord, en tegelijk de grens waarbinnen het
 *  handvat mag komen. Buiten dit venster is er niets te zien. */
export const VENSTER = { x0: 0, x1: 140, y0: 0, y1: 100 }

/**
 * De hoogteband waarover een verschuiving gemeten wordt.
 *
 * Vast, en NIET het zichtbare deel van het bord: anders zou het getal van de
 * schermmaat afhangen en zou dezelfde sleepbeweging op de laptop van de
 * leerkracht een ander getal geven dan op de beamer.
 */
export const BAND = { y0: 25, y1: 85 }

function maakRijen(): Rij[] {
  const r = seeded(11)
  const uit: Rij[] = []
  for (let i = 0; i < 15; i++) uit.push({ x: 40 + r() * 20, y: 20 + r() * 70, klasse: 0 })
  for (let i = 0; i < 15; i++) uit.push({ x: 80 + r() * 20, y: 20 + r() * 70, klasse: 1 })
  return uit
}

/** De dertig rijen waarmee het bord opent. */
export const RIJEN: readonly Rij[] = maakRijen()

/* ------------------------------- de boom --------------------------------- */

/**
 * De vraag die de boom stelt, en dus zijn grens.
 *
 * `kenmerk` is 0 voor de x-as en 1 voor de y-as. De grens is een rechte lijn:
 * bij kenmerk 0 verticaal, bij kenmerk 1 horizontaal. Op deze data set koos de
 * boom in 88 830 gemeten toestanden altijd kenmerk 0, maar de code zegt dat
 * niet vooraf - anders zou ze de boom voorliegen.
 */
export type Grens = {
  kenmerk: 0 | 1
  drempel: number
  /** Wat de boom voorspelt onder de drempel, en wat erboven. */
  onder: Klasse
  boven: Klasse
  gini: number
}

const giniVan = (aantal: number, enen: number): number => {
  if (aantal === 0) return 0
  const p = enen / aantal
  return 1 - p * p - (1 - p) * (1 - p)
}

/**
 * De beste vraag over één kenmerk, met gini als maat - precies wat CART doet.
 *
 * Gelijkspel wordt vast beslecht: eerst de x-as, dan de laagste drempel. Dat
 * moet, want een bord moet op elke beamer hetzelfde beeld geven, en sklearn
 * laat juist dit door het toeval beslissen. Een gelijkspel is trouwens ook in
 * sklearn willekeurig, dus geen van de twee keuzes is "de juiste".
 */
export function boomGrens(rijen: readonly Rij[]): Grens | null {
  const n = rijen.length
  if (n < 2) return null
  const enenTotaal = rijen.reduce((s, r) => s + r.klasse, 0)
  let best: Grens | null = null

  for (const kenmerk of [0, 1] as const) {
    const waarde = (r: Rij) => (kenmerk === 0 ? r.x : r.y)
    const orde = rijen.map((_, i) => i).sort((a, b) => waarde(rijen[a]) - waarde(rijen[b]))
    let enenLinks = 0
    for (let i = 0; i < n - 1; i++) {
      enenLinks += rijen[orde[i]].klasse
      const hier = waarde(rijen[orde[i]])
      const volgende = waarde(rijen[orde[i + 1]])
      // Geen drempel tussen twee gelijke waarden: daar valt niets te splitsen.
      if (!(volgende > hier)) continue
      const nL = i + 1
      const nR = n - nL
      const enenRechts = enenTotaal - enenLinks
      const gini = (nL * giniVan(nL, enenLinks) + nR * giniVan(nR, enenRechts)) / n
      if (best === null || gini < best.gini - 1e-12) {
        best = {
          kenmerk,
          drempel: (hier + volgende) / 2,
          onder: enenLinks / nL > 0.5 ? 1 : 0,
          boven: enenRechts / nR > 0.5 ? 1 : 0,
          gini,
        }
      }
    }
  }
  return best
}

/** De waarde van een rij op het kenmerk waarop de boom splitst. */
export const opKenmerk = (grens: Grens, r: { x: number; y: number }): number =>
  grens.kenmerk === 0 ? r.x : r.y

/**
 * De twee rijen die de grens vastleggen: de laatste onder de drempel en de
 * eerste erboven. De drempel ligt er precies tussenin, en dat is het hele
 * mechanisme dat dit bord laat zien.
 */
export function naastDeGrens(rijen: readonly Rij[], grens: Grens): number[] {
  let onder = -1
  let boven = -1
  for (let i = 0; i < rijen.length; i++) {
    const v = opKenmerk(grens, rijen[i])
    if (v < grens.drempel) {
      if (onder < 0 || v > opKenmerk(grens, rijen[onder])) onder = i
    } else if (boven < 0 || v < opKenmerk(grens, rijen[boven])) boven = i
  }
  return [onder, boven].filter((i) => i >= 0)
}

/**
 * De strook: het gat tussen de twee groepen, afgebakend door precies die twee
 * rijen. Alles wat de boom van zijn grens weet, zit hierin - en de meting zegt
 * het scherp: buiten de strook neerleggen liet de grens 68 208 van de 68 208
 * keer exact staan, erin neerleggen verschoof haar 14 700 van de 14 700 keer.
 */
export function strook(rijen: readonly Rij[], grens: Grens): { van: number; tot: number } | null {
  const naast = naastDeGrens(rijen, grens)
  if (naast.length < 2) return null
  const a = opKenmerk(grens, rijen[naast[0]])
  const b = opKenmerk(grens, rijen[naast[1]])
  return { van: Math.min(a, b), tot: Math.max(a, b) }
}

/**
 * Hoever twee boomgrenzen uit elkaar liggen, in de eenheden van het kenmerk.
 *
 * Voor een verticale grens is dit exact hetzelfde getal als
 * `regressieVerschuiving` hieronder: de gemiddelde zijwaartse afstand over de
 * band. Een verticale lijn staat op elke hoogte even ver, dus het gemiddelde
 * is de afstand zelf. Daarom mogen de twee getallen naast elkaar op het bord -
 * ze meten hetzelfde.
 *
 * `null` als de boom van kenmerk gewisseld is: dan staat de ene grens
 * horizontaal en de andere verticaal, en is er geen afstand te noemen die niet
 * misleidt. Gemeten kwam dat op deze data set in 0 van 88 830 sleepbewegingen
 * voor, maar het bord moet er toch iets eerlijks over kunnen zeggen.
 */
export function boomVerschuiving(a: Grens, b: Grens): number | null {
  if (a.kenmerk !== b.kenmerk) return null
  return Math.abs(a.drempel - b.drempel)
}

/* ---------------------------- de regressie ------------------------------- */

/**
 * De grens van regressie: kleinste kwadraten op de soort als getal (Soort 1 is
 * 0, Soort 2 is 1), en de grens ligt waar die voorspelling precies halfweg
 * valt. `x = (0,5 - c0 - c2*y) / c1`, dus een rechte lijn die mag hellen -
 * en dat hellen is precies wat je op het bord ziet gebeuren.
 */
export type RegGrens = { c0: number; c1: number; c2: number }

export function regressieGrens(rijen: readonly Rij[]): RegGrens | null {
  const n = rijen.length
  if (n < 3) return null
  let sx = 0,
    sy = 0,
    sxx = 0,
    syy = 0,
    sxy = 0,
    sk = 0,
    skx = 0,
    sky = 0
  for (const r of rijen) {
    sx += r.x
    sy += r.y
    sxx += r.x * r.x
    syy += r.y * r.y
    sxy += r.x * r.y
    sk += r.klasse
    skx += r.klasse * r.x
    sky += r.klasse * r.y
  }
  // De normaalvergelijkingen, 3 bij 3, met de regel van Cramer.
  const m = [
    [n, sx, sy],
    [sx, sxx, sxy],
    [sy, sxy, syy],
  ]
  const b = [sk, skx, sky]
  const det = (a: number[][]) =>
    a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) -
    a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) +
    a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0])
  const D = det(m)
  if (Math.abs(D) < 1e-9) return null
  const kolom = (j: number) => m.map((rij, i) => rij.map((v, k) => (k === j ? b[i] : v)))
  const c1 = det(kolom(1)) / D
  // Zonder helling in x is er geen grens te tekenen die de groepen scheidt.
  if (!Number.isFinite(c1) || Math.abs(c1) < 1e-9) return null
  return { c0: det(kolom(0)) / D, c1, c2: det(kolom(2)) / D }
}

/** Waar de grens van regressie ligt op hoogte y. */
export function regressieX(g: RegGrens, y: number): number {
  return (0.5 - g.c0 - g.c2 * y) / g.c1
}

/** De gemiddelde zijwaartse afstand tussen twee regressiegrenzen over de
 *  vaste band. Zie `boomVerschuiving`: bewust dezelfde maat. */
export function regressieVerschuiving(a: RegGrens, b: RegGrens, stappen = 41): number {
  let som = 0
  for (let i = 0; i < stappen; i++) {
    const y = BAND.y0 + ((BAND.y1 - BAND.y0) * i) / (stappen - 1)
    som += Math.abs(regressieX(a, y) - regressieX(b, y))
  }
  return som / stappen
}
