/* ------------------------------------------------------------------ *
 * De zestien toestanden van "Waar komt de knik vandaan?" (les 8, lc 4532),
 * en elke zin die het bord erover zegt.
 *
 * DE DATA is die van les 7b ("Hoeveel clusters?"), en wordt hier geIMPORTEERD
 * uit clusterdata.ts, niet gekopieerd: Drie groepjes (60 punten) en Geen
 * groepjes (81 punten). De klanten niet: daar springt in les 7b "geen enkel
 * aantal eruit", en een knik op die data zou dat tegenspreken.
 *
 * DE TOESTANDEN. Voor k = 1..8: KMeans(n_clusters=k, n_init=10,
 * random_state=146).fit(set), de aanroep van 2130677, en een run van de lus
 * van Stap 7. Elke k is dus een NIEUWE fit, geen verfijning van de vorige:
 * gemeten (critic c2, 200 seeds) is de clustering bij k op Geen groepjes voor
 * geen enkele k >= 3 de clustering bij k - 1 met één cluster in twee. Daarom
 * zegt geen enkele zin "de nieuwe cluster" of "deze cluster": die bestaat
 * niet. Elke zin beschrijft de toestand bij k, vergeleken met die bij k - 1.
 *   De centroids staan in elleboogstaten.ts (gegenereerd, volle float64). De
 * toewijzing en de inertia rekent dit bestand zelf uit; de labels en de
 * inertia van sklearn staan er alleen om dat na te gaan (`controleer`).
 *
 * WAAROM R = 146. De meest typische run over random_state 0..199 (designer,
 * m5), en over 300 andere seeds 0,49% (Drie) en 0,38% (Geen) van de mediaan
 * van de inertia (critic, c3). Les 7b's Drie met 4 knipt een ander groepje
 * (groepje 0) dan deze run (groepje 1): dat is gewild. Maar 11 van 1 000
 * seeds geven alle vier de prenten van les 7b, en de meest typische daarvan
 * wijkt 2,18% af. Dit bord toont wat n_init=10 gewoonlijk geeft, wat 2130209
 * belooft ("Zo krijg jij dezelfde clusters als op de slides").
 *
 * DE GETALLEN die het bord toont, opnieuw uitgerekend in de browser:
 *   Drie   5,11 / 2,66 / 0,57 / 0,47 / 0,37 / 0,31 / 0,26 / 0,22
 *   Geen   13,44 / 8,21 / 5,22 / 3,25 / 2,78 / 2,36 / 2,01 / 1,68
 * Wat 1 cluster meer scheelt, in % van de inertia bij 1 cluster:
 *   Drie   48,0 / 40,8 / 2,0 / 1,8 / 1,3 / 1,0 / 0,7
 *   Geen   38,9 / 22,2 / 14,7 / 3,5 / 3,1 / 2,6 / 2,4
 * De knik (de lat over 1..8, en de kleinste verhouding tussen twee
 * opeenvolgende besparingen, die hier altijd samenvallen): Drie 3, Geen 4.
 * "veel" staat tot en met de knik, "nog maar weinig" erna. De kleinste
 * besparing die "veel" heet, is op beide sets meer dan vier keer de grootste
 * die "nog maar weinig" heet (Drie 40,8 tegen 2,0; Geen 14,7 tegen 3,5).
 *
 * WAT HET BORD NIET ZEGT, en waarom:
 *   - "Bij meer clusters blijft de knik waar hij is." Op de Pokemon van de
 *     leerling is dat vals: de lat geeft 3 over 1..8 en 4 over 1..14 (300 van
 *     300 runs). En het bord stopt bij 8, dus nagaan kan hier niet.
 *   - "Elk lijntje wordt korter." Per stap worden er lijntjes LANGER: Drie
 *     7, 2, 5, 16, 15, 6, 7 van 60; Geen 20, 27, 30, 33, 35, 29, 29 van 81.
 *   - "Elke extra cluster scheelt minder dan de vorige." Over 1..14 klopt dat
 *     maar in 6 van 300 runs (Drie).
 *   - Dat de lijntjes optellen tot de inertia. De inertia telt de lengtes in
 *     het KWADRAAT op. Het bord zegt alleen "hoe ver", zoals 2130675.
 * ------------------------------------------------------------------ */

import { DRIE_GROEPJES, GEEN_GROEPJES, GROEP, structuur, type Structuur } from './clusterdata'
import type { Punt } from './kmeans'
import { RUWE_STATEN } from './elleboogstaten'

export type SetId = 'drie' | 'geen'

/** Het bord loopt van 1 tot 8 clusters. Niet tot 14, zoals de lus van Stap 7:
 *  na 8 komt er op deze twee sets niets meer bij om naar te kijken. */
export const MAX_AANTAL = 8

export const PUNTEN_VAN: Record<SetId, readonly Punt[]> = {
  drie: DRIE_GROEPJES,
  geen: GEEN_GROEPJES,
}

export type Staat = {
  k: number
  centroids: Punt[]
  /** Per punt: de index van de dichtste centroid. */
  clusters: number[]
  /** De som over alle punten van de afstand tot hun centroid, in het kwadraat
   *  (sklearn's inertia_). */
  inertia: number
}

const kwadraat = (p: Punt, c: Punt) => (p.x - c.x) ** 2 + (p.y - c.y) ** 2

/** Elk punt gaat naar de dichtste centroid. Bij een gelijke stand de eerste,
 *  zoals argmin; `controleer` gaat na dat er nergens een gelijke stand is. */
export function toewijzing(punten: readonly Punt[], centroids: readonly Punt[]): number[] {
  return punten.map((p) => {
    let beste = 0
    let besteD = Infinity
    centroids.forEach((c, j) => {
      const d = kwadraat(p, c)
      if (d < besteD) {
        beste = j
        besteD = d
      }
    })
    return beste
  })
}

export function inertia(punten: readonly Punt[], centroids: readonly Punt[], clusters: readonly number[]) {
  let som = 0
  punten.forEach((p, i) => (som += kwadraat(p, centroids[clusters[i]])))
  return som
}

function maakStaten(set: SetId): Staat[] {
  const punten = PUNTEN_VAN[set]
  return RUWE_STATEN[set].map((r, i) => {
    const centroids = r.centroids.map(([x, y]) => ({ x, y }))
    const clusters = toewijzing(punten, centroids)
    return { k: i + 1, centroids, clusters, inertia: inertia(punten, centroids, clusters) }
  })
}

const STATEN: Record<SetId, Staat[]> = { drie: maakStaten('drie'), geen: maakStaten('geen') }

/** De toestand met k clusters, k = 1..8. */
export function staat(set: SetId, k: number): Staat {
  return STATEN[set][k - 1]
}

/** De inertia bij 1 tot 8 clusters, uitgerekend uit de centroids. */
export function inertias(set: SetId): number[] {
  return STATEN[set].map((s) => s.inertia)
}

/* ------------------------------- de knik ----------------------------- *
 * De lat van 2228141: een rechte van het eerste punt van de grafiek naar het
 * laatste, en de knik is het aantal dat er het verst onder ligt. Over 1..8,
 * want zo ver gaat het bord. Intern: het bord tekent de lat niet (op de
 * Pokemon verschuift het antwoord van de lat met het bereik), het noemt
 * alleen het aantal, en pas als de leerling twee stappen voorbij de knik is.  */

function knikLat(I: readonly number[]): number {
  const n = I.length
  let beste = 1
  let besteD = -Infinity
  I.forEach((v, i) => {
    const lat = I[0] + ((I[n - 1] - I[0]) * i) / (n - 1)
    if (lat - v > besteD) {
      besteD = lat - v
      beste = i + 1
    }
  })
  return beste
}

/** "Vanaf een bepaald aantal nog maar weinig" (2130675), als getal: het aantal
 *  k waarna de besparing van k + 1 het kleinste deel is van die van k. */
function knikVerhouding(I: readonly number[]): number {
  let beste = 2
  let besteR = Infinity
  for (let k = 2; k < I.length; k++) {
    const r = (I[k - 1] - I[k]) / (I[k - 2] - I[k - 1])
    if (r < besteR) {
      besteR = r
      beste = k
    }
  }
  return beste
}

const KNIK: Record<SetId, number> = {
  drie: knikLat(inertias('drie')),
  geen: knikLat(inertias('geen')),
}

/* --------------------------- wat het bord zegt ----------------------- */

/** Kwadrant van een punt: 0 linksonder, 1 linksboven, 2 rechtsonder, 3
 *  rechtsboven, rond het midden van het vierkant. */
const kwadrant = (c: Punt) => 2 * Number(c.x > 0.5) + Number(c.y > 0.5)

/** Hoeveel verschillende kwadranten de centroids bezetten. */
export function hoeken(centroids: readonly Punt[]) {
  return new Set(centroids.map(kwadrant)).size
}

const grootste = (xs: readonly number[]) => Math.max(...xs)
const som = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0)

/** Wat er bij k met de drie groepjes gebeurt, vergeleken met k - 1. */
function deelDrie(nu: Structuur, voor: Structuur, k: number): string | null {
  // Bij 1 cluster deelden alle drie de groepjes één centroid; nu nog twee.
  if (
    nu.samen === 1 &&
    nu.geknipt === 0 &&
    grootste(nu.groepjesPerCluster) === 2 &&
    voor.samen === 1 &&
    grootste(voor.groepjesPerCluster) === 3
  )
    return 'Eén groepje krijgt een eigen cluster.'
  if (nu.samen === 0 && nu.geknipt === 0 && voor.samen > 0) return 'Nu heeft elk groepje een eigen cluster.'
  if (
    nu.samen === 0 &&
    nu.geknipt === 1 &&
    grootste(nu.clustersPerGroepje) === 2 &&
    voor.samen === 0 &&
    voor.geknipt === 0
  )
    return 'Nu knipt k-means een groepje in twee.'
  // Al geknipt, en nu in meer stukken: elk van de k clusters ligt in één
  // groepje, dus de stukken tellen op tot k.
  if (
    nu.samen === 0 &&
    voor.samen === 0 &&
    voor.geknipt >= 1 &&
    som(nu.clustersPerGroepje) === k &&
    som(nu.clustersPerGroepje) > som(voor.clustersPerGroepje)
  )
    return 'K-means knipt de groepjes verder.'
  return null
}

const LIJNTJES = 'Elk lijntje gaat van een punt naar zijn centroid.'

/**
 * De ene zin boven de punten. BEREKEND, nooit per aantal overgetypt:
 *   - bij Drie groepjes het eerste deel uit `structuur()` van de toestand bij
 *     k tegen die bij k - 1;
 *   - "veel" of "nog maar weinig" uit de knik, uitgerekend uit de inertia
 *     hierboven: veel tot en met de knik, nog maar weinig erna.
 * Een toestand die hier niet past, krijgt geen zin (en in dev een melding).
 */
export function bandZin(set: SetId, k: number): string | null {
  if (k === 1) return LIJNTJES
  const knik = KNIK[set]
  const veel = k <= knik
  const nu = staat(set, k)
  if (set === 'drie') {
    const deel = deelDrie(structuur(nu.clusters), structuur(staat(set, k - 1).clusters), k)
    if (!deel) {
      if (import.meta.env?.DEV)
        console.error('Waar komt de knik vandaan: geen zin voor deze structuur', k, structuur(nu.clusters))
      return null
    }
    // "weer" als de stap ervoor ook al veel scheelde.
    const scheelt = !veel
      ? 'Dat scheelt nog maar weinig.'
      : k - 1 >= 2
        ? 'Dat scheelt weer veel.'
        : 'Dat scheelt veel.'
    return `${deel} ${scheelt}`
  }
  if (veel && k === 4 && hoeken(nu.centroids) === 4) return 'Nu heeft elke cluster een eigen hoek. Dat scheelt nog veel.'
  if (veel) return 'Hier zijn geen groepjes. Toch scheelt een cluster meer veel.'
  return 'Nu scheelt een cluster meer nog maar weinig.'
}

/** Hoeveel clusters van k - 1 er bij k precies zo terugkomen (dezelfde punten). */
export function heelGebleven(set: SetId, k: number): number {
  const sleutels = (s: Staat) => {
    const per = new Map<number, number[]>()
    s.clusters.forEach((c, i) => per.set(c, [...(per.get(c) ?? []), i]))
    return new Set([...per.values()].map((v) => v.join(',')))
  }
  const nu = sleutels(staat(set, k))
  let n = 0
  sleutels(staat(set, k - 1)).forEach((s) => {
    if (nu.has(s)) n++
  })
  return n
}

/**
 * De zinnen onderaan het paneel, voor de toestand bij k.
 *   - k = 1: wat je moet doen.
 *   - k = 2 tot knik + 1: kijk naar de grafiek. Op Geen groepjes vanaf 3 ook
 *     waarom het hele beeld verschuift: daar komt GEEN ENKELE cluster van
 *     k - 1 terug (`heelGebleven` is 0 bij 3, 4 en 5; `controleer`), en zonder
 *     die zin leest dat als een fout.
 *   - vanaf knik + 2: de knik, met zijn aantal. Pas dan, want pas dan staan
 *     er twee stappen na de knik in de grafiek om hem aan te zien.
 */
export function statusZinnen(set: SetId, k: number): string[] {
  const knik = KNIK[set]
  if (k === 1) return ['Druk op 1 cluster meer. Kijk wat er met de lijntjes gebeurt.']
  if (k <= knik + 1) {
    const zinnen = ['Kijk in de grafiek hoeveel 1 cluster meer scheelde.']
    if (set === 'geen' && k >= 3) zinnen.push('De clusters liggen telkens anders. K-means begint voor elk aantal opnieuw.')
    return zinnen
  }
  if (set === 'drie') return [`De knik zit bij ${knik} clusters. Zoveel groepjes zie je ook.`]
  return [`De knik zit bij ${knik} clusters. Toch zijn er geen groepjes.`, 'De knik helpt je kiezen. Kiezen doe jij.']
}

/* -------------------------------- controle -------------------------- */

/** Wat elke zin op het bord hoort te zijn. Alleen voor `controleer`: het bord
 *  zelf leest deze tabel nooit. */
const VERWACHT: Record<SetId, readonly string[]> = {
  drie: [
    LIJNTJES,
    'Eén groepje krijgt een eigen cluster. Dat scheelt veel.',
    'Nu heeft elk groepje een eigen cluster. Dat scheelt weer veel.',
    'Nu knipt k-means een groepje in twee. Dat scheelt nog maar weinig.',
    'K-means knipt de groepjes verder. Dat scheelt nog maar weinig.',
    'K-means knipt de groepjes verder. Dat scheelt nog maar weinig.',
    'K-means knipt de groepjes verder. Dat scheelt nog maar weinig.',
    'K-means knipt de groepjes verder. Dat scheelt nog maar weinig.',
  ],
  geen: [
    LIJNTJES,
    'Hier zijn geen groepjes. Toch scheelt een cluster meer veel.',
    'Hier zijn geen groepjes. Toch scheelt een cluster meer veel.',
    'Nu heeft elke cluster een eigen hoek. Dat scheelt nog veel.',
    'Nu scheelt een cluster meer nog maar weinig.',
    'Nu scheelt een cluster meer nog maar weinig.',
    'Nu scheelt een cluster meer nog maar weinig.',
    'Nu scheelt een cluster meer nog maar weinig.',
  ],
}

/** Alle beweringen hierboven, opnieuw nagegaan in de browser. Geeft de fouten. */
export function controleer(): string[] {
  const fouten: string[] = []
  for (const set of ['drie', 'geen'] as const) {
    const punten = PUNTEN_VAN[set]
    const I = inertias(set)
    for (let k = 1; k <= MAX_AANTAL; k++) {
      const s = staat(set, k)
      const r = RUWE_STATEN[set][k - 1]
      const naam = `${set} met ${k}`
      if (Math.abs(s.inertia - r.inertia) > 1e-12)
        fouten.push(`${naam}: inertia ${s.inertia} tegen sklearn ${r.inertia}`)
      if (s.clusters.some((c, i) => c !== r.labels[i])) fouten.push(`${naam}: de toewijzing verschilt van sklearn`)
      if (new Set(s.clusters).size !== k) fouten.push(`${naam}: een lege cluster`)
      if (k > 1) {
        let gat = Infinity
        punten.forEach((p) => {
          const d = s.centroids.map((c) => kwadraat(p, c)).sort((a, b) => a - b)
          gat = Math.min(gat, d[1] - d[0])
        })
        if (!(gat > 1e-9)) fouten.push(`${naam}: een gelijke stand (${gat})`)
        if (!(I[k - 1] < I[k - 2])) fouten.push(`${naam}: de inertia daalt niet`)
      }
      const zin = bandZin(set, k)
      if (zin !== VERWACHT[set][k - 1]) fouten.push(`${naam}: de zin is "${zin}"`)
      if (zin && /deze cluster|nieuwe cluster/i.test(zin)) fouten.push(`${naam}: "${zin}" spreekt van één nieuwe cluster`)
    }
    const knik = KNIK[set]
    if (knik !== knikVerhouding(I)) fouten.push(`${set}: de lat (${knik}) en de verhouding (${knikVerhouding(I)}) geven een andere knik`)
    if (knik !== (set === 'drie' ? 3 : 4)) fouten.push(`${set}: de knik is ${knik}`)
    // "veel" en "nog maar weinig" liggen ver uit elkaar.
    const bespaard = I.slice(1).map((v, i) => I[i] - v)
    const veel = Math.min(...bespaard.slice(0, knik - 1))
    const weinig = Math.max(...bespaard.slice(knik - 1))
    if (!(veel > 3 * weinig)) fouten.push(`${set}: "veel" (${veel}) is geen drie keer "nog maar weinig" (${weinig})`)
  }
  // Drie groepjes: drie groepjes in één cluster, dan twee samen, dan elk een
  // eigen cluster, dan één geknipt, dan alleen nog stukken.
  const st = Array.from({ length: MAX_AANTAL }, (_, i) => structuur(staat('drie', i + 1).clusters))
  const ok =
    st[0].samen === 1 &&
    grootste(st[0].groepjesPerCluster) === 3 &&
    st[1].samen === 1 &&
    st[1].geknipt === 0 &&
    st[2].samen === 0 &&
    st[2].geknipt === 0 &&
    st[3].samen === 0 &&
    st[3].geknipt === 1 &&
    st.slice(4).every((s, i) => s.samen === 0 && som(s.clustersPerGroepje) === i + 5)
  if (!ok) fouten.push('drie: de groepjes volgen niet samen / elk een eigen / één geknipt / stukken')
  // "Zoveel groepjes zie je ook": de knik is het aantal groepjes.
  if (KNIK.drie !== new Set(GROEP).size) fouten.push('drie: de knik is niet het aantal groepjes')
  // "Nu heeft elke cluster een eigen hoek."
  if (hoeken(staat('geen', 4).centroids) !== 4) fouten.push('geen met 4: niet elke cluster in een eigen hoek')
  // "De clusters liggen telkens anders": van k - 1 naar k komt geen enkele
  // cluster terug, overal waar die zin staat.
  for (let k = 3; k <= KNIK.geen + 1; k++)
    if (heelGebleven('geen', k) !== 0) fouten.push(`geen met ${k}: ${heelGebleven('geen', k)} clusters blijven heel`)
  if (DRIE_GROEPJES.length !== 60 || GEEN_GROEPJES.length !== 81) fouten.push('een data set heeft niet het juiste aantal punten')
  return fouten
}

if (import.meta.env?.DEV) {
  const fouten = controleer()
  if (fouten.length > 0) console.error('Waar komt de knik vandaan: de toestanden kloppen niet meer.', fouten)
}
