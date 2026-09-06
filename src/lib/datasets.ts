import { bestFit, meanAbsError, seeded, type Line, type Point } from './regression'

/**
 * A stand-in for les 2's schoenmaatlengte.csv: a realistic cluster plus the
 * three kinds of rubbish the students actually discover in that file -
 * rows with NA, lengths typed in metres (1,73 instead of 173) and an
 * impossible person (schoenmaat 88, 364 cm).
 *
 * Generated from a fixed seed so every student, and every teacher on the
 * projector, sees exactly the same picture and the same numbers.
 */
export type RowKind = 'ok' | 'na' | 'meter' | 'onmogelijk'

export type Row = {
  maat: number
  /** null for an NA row: there is no number to plot, and float() will crash. */
  lengte: number | null
  kind: RowKind
}

const OK_ROWS: Row[] = (() => {
  const rnd = seeded(5)
  const rows: Row[] = []
  for (let i = 0; i < 26; i++) {
    const maat = 35 + Math.round(rnd() * 12)
    const lengte = Math.round(2.7 * maat + 58 + (rnd() - 0.5) * 14)
    rows.push({ maat, lengte, kind: 'ok' })
  }
  return rows
})()

const NA_ROWS: Row[] = [39, 42, 45].map((maat) => ({ maat, lengte: null, kind: 'na' }))

// Lengths entered in metres - they land on the floor of a centimetre axis.
const METER_ROWS: Row[] = [
  { maat: 38, lengte: 1.63, kind: 'meter' },
  { maat: 39, lengte: 1.68, kind: 'meter' },
  { maat: 40, lengte: 1.73, kind: 'meter' },
  { maat: 41, lengte: 1.84, kind: 'meter' },
]

// The impossible person from the real dataset.
export const ONMOGELIJK_START = { maat: 88, lengte: 364 }
const ONMOGELIJK_ROWS: Row[] = [
  { maat: ONMOGELIJK_START.maat, lengte: ONMOGELIJK_START.lengte, kind: 'onmogelijk' },
]

export const ALL_ROWS: Row[] = [...OK_ROWS, ...NA_ROWS, ...METER_ROWS, ...ONMOGELIJK_ROWS]

/** The realistic rows: our yardstick for "does this model work on normal people?" */
export const OK_POINTS: Point[] = OK_ROWS.map((r) => ({ x: r.maat, y: r.lengte as number }))

/**
 * One named classmate used to make the miss concrete. Chosen because her
 * story is strictly monotone across the cleaning steps: 32 cm off, then
 * 7 cm, then 2 cm.
 */
export const VOORBEELD = { naam: 'Amber', maat: 37, echteLengte: 160 }

export const CLEAN_STEPS = [
  {
    id: 'ruw',
    kort: 'Ruw bestand',
    knop: 'Verwijder de NA-rijen',
    /** Nothing is dropped yet, and float() blows up on the NA rows. */
    drop: [] as RowKind[],
    crasht: true,
    uitleg: 'Zo komt het bestand binnen. Je code crasht meteen.',
  },
  {
    id: 'zonder-na',
    kort: 'NA-rijen verwijderd',
    knop: 'Verwijder de lengtes in meter',
    drop: ['na'] as RowKind[],
    crasht: false,
    uitleg: 'Nu draait je code. Kijk eens hoe ver dat ene punt rechtsboven buiten de groep ligt.',
  },
  {
    id: 'zonder-meter',
    kort: 'Lengtes in meter verwijderd',
    knop: 'Verwijder de onmogelijke rij',
    drop: ['na', 'meter'] as RowKind[],
    crasht: false,
    uitleg: 'De vier lengtes van rond de 1,7 cm zijn weg. Nu trekt alleen die rij van 364 cm de lijn nog scheef.',
  },
  {
    id: 'schoon',
    kort: 'Onmogelijke rij verwijderd',
    knop: null,
    drop: ['na', 'meter', 'onmogelijk'] as RowKind[],
    crasht: false,
    uitleg: 'Een duidelijk verband: grotere schoenmaat, grotere lengte.',
  },
] as const

export type CleanStep = (typeof CLEAN_STEPS)[number]

/** Rows that survive a given cleaning step, in the order they were read. */
export function rowsAtStep(step: number, onmogelijk: { maat: number; lengte: number }): Row[] {
  const drop = CLEAN_STEPS[step].drop as readonly RowKind[]
  return ALL_ROWS.filter((r) => !drop.includes(r.kind)).map((r) =>
    r.kind === 'onmogelijk' ? { ...r, maat: onmogelijk.maat, lengte: onmogelijk.lengte } : r,
  )
}

/** The points sklearn would actually be trained on at this step. */
export function pointsAtStep(step: number, onmogelijk: { maat: number; lengte: number }): Point[] {
  return rowsAtStep(step, onmogelijk)
    .filter((r) => r.lengte !== null)
    .map((r) => ({ x: r.maat, y: r.lengte as number }))
}

/** Line + how far it misses on the realistic rows, for one cleaning step. */
export function fitAtStep(
  step: number,
  onmogelijk: { maat: number; lengte: number },
): { line: Line; miss: number; points: Point[] } {
  const points = pointsAtStep(step, onmogelijk)
  const line = bestFit(points)
  return { line, miss: meanAbsError(OK_POINTS, line), points }
}

/* ------------------------------------------------------------------ *
 * Data-dokter (les 2, sandbox)
 *
 * Dezelfde vervuiling als hierboven, maar niet meer in vaste stappen. De
 * leerling gooit zelf rijen weg, dus het cijfer mag niet op de zichtbare
 * punten gemeten worden: dan lijkt elke verwijdering winst. Daarom een
 * CONTROLEGROEP van acht realistische mensen die niet op het bord staan
 * en die de leerling niet kan weggooien.
 *
 * De werkset is bewust KLEIN (tien echte metingen). Bij eenendertig rijen
 * verschoof één verwijdering de misser hooguit 0,22 cm en werd hij in de
 * helft van de gevallen zelfs beter - dan zegt het bord het omgekeerde van
 * wat de tekst beweert. Met tien rijen heeft elke rij gewicht. De seeds
 * hieronder zijn gekozen door alle combinaties door te rekenen:
 *
 *   schone werkset          misser 1,95 cm (het bord toont 1,9)
 *   1 echte rij weggegooid  altijd slechter, +0,07 tot +0,57 cm (10 van 10),
 *                           en op één decimaal altijd zichtbaar anders
 *                           (het slechtste geval gaat van 1,9 naar 2,0)
 *   elke deelverzameling    alle 1012 combinaties die minstens twee rijen
 *   van echte rijen weg     overlaten zijn slechter, geen enkele is beter
 *                           (kleinste verslechtering +0,0031 cm)
 *
 * Zolang er nog rommel in zit, is dat niet gegarandeerd (daar bepaalt de
 * rommel de lijn), dus de demo rekent die vergelijking live uit en beweert
 * niets wat het getal niet toont.
 *
 * De rijen dragen ook man/vrouw, want scheefgetrokken data is een
 * datakwaliteitsprobleem op zich. Mannen en vrouwen liggen op een eigen
 * hoogte, dus een model dat maar één groep ziet, gaat er bij de andere
 * groep echt naast zitten: train je alleen op de mannen, dan gaat de
 * misser bij de vrouwen in de controlegroep van 1,26 naar 4,63 cm. Ook dat
 * getal rekent het bord live uit, met controleMissPerGroep.
 * ------------------------------------------------------------------ */

export type Geslacht = 'man' | 'vrouw'

export type DokterRow = {
  id: number
  maat: number
  /** null voor een NA-rij: er staat geen getal in het bestand. */
  lengte: number | null
  geslacht: Geslacht
  kind: RowKind
}

/** Binnen één groep is het verband vlak; het verschil zit tussen de groepen. */
const HELLING = 1.9
const HOOGTE: Record<Geslacht, number> = { vrouw: 90, man: 97 }
const RUIS = 13

function trekRij(rnd: () => number, geslacht: Geslacht): { maat: number; lengte: number } {
  const maat = geslacht === 'vrouw' ? 35 + Math.round(rnd() * 6) : 41 + Math.round(rnd() * 6)
  return { maat, lengte: Math.round(HELLING * maat + HOOGTE[geslacht] + (rnd() - 0.5) * RUIS) }
}

/** Lengte per ongeluk in meter getypt, precies zoals in het echte bestand. */
const inMeter = (maat: number, geslacht: Geslacht) =>
  Math.round(HELLING * maat + HOOGTE[geslacht]) / 100

/**
 * Het bestand zoals de leerling het krijgt: tien echte metingen en vijf
 * kapotte rijen. Seed 494 is niet willekeurig gekozen maar nagerekend: het
 * is een set waarin elke echte meting het model meetbaar draagt.
 */
export const WERKSET: DokterRow[] = (() => {
  const rnd = seeded(494)
  const rows: DokterRow[] = []
  let id = 0
  for (let i = 0; i < 5; i++) rows.push({ id: id++, ...trekRij(rnd, 'vrouw'), geslacht: 'vrouw', kind: 'ok' })
  for (let i = 0; i < 5; i++) rows.push({ id: id++, ...trekRij(rnd, 'man'), geslacht: 'man', kind: 'ok' })
  for (const [maat, geslacht] of [
    [37, 'vrouw'],
    [45, 'man'],
  ] as const)
    rows.push({ id: id++, maat, lengte: null, geslacht, kind: 'na' })
  // 43 en 44 zijn doorgerekend: met dit paar maakt ELKE kapotte rij die je
  // weghaalt de misser kleiner, in welke volgorde je ook opruimt (in het
  // krapste van die twaalf gevallen scheelt het nog altijd 1,75 cm).
  for (const [maat, geslacht] of [
    [43, 'man'],
    [44, 'man'],
  ] as const)
    rows.push({ id: id++, maat, lengte: inMeter(maat, geslacht), geslacht, kind: 'meter' })
  rows.push({ id: id++, ...ONMOGELIJK_START, geslacht: 'man', kind: 'onmogelijk' })
  return rows
})()

/** De rijen die echt van een mens komen: het materiaal waar het model op steunt. */
export const WERKSET_ECHT: DokterRow[] = WERKSET.filter((r) => r.kind === 'ok')

/** NA, meter en de onmogelijke persoon: de rijen die er horen uit te gaan. */
export const WERKSET_KAPOT: DokterRow[] = WERKSET.filter((r) => r.kind !== 'ok')

/** De rijen zonder getal. Die kan je niet tekenen en float() struikelt erover. */
export const NA_IDS: number[] = WERKSET.filter((r) => r.kind === 'na').map((r) => r.id)

/**
 * De controlegroep: acht realistische mensen die niet op het bord staan.
 * Het model wordt hier nooit op getraind, dus dit cijfer kan je niet
 * mooier maken door punten weg te klikken. Seed 112169 hoort bij werkset-
 * seed 494: samen geven ze de nagerekende eigenschappen hierboven, en er
 * valt geen enkele controlerij samen met een rij op het bord. Seed 52 deed
 * dat wel (man, maat 46, 188 cm stond in allebei), waardoor de zin op het
 * bord over "acht mensen die je niet kan weggooien" niet klopte.
 */
export const CONTROLE_ROWS: { maat: number; lengte: number; geslacht: Geslacht }[] = (() => {
  const rnd = seeded(112169)
  const rows: { maat: number; lengte: number; geslacht: Geslacht }[] = []
  for (let i = 0; i < 4; i++) rows.push({ ...trekRij(rnd, 'vrouw'), geslacht: 'vrouw' })
  for (let i = 0; i < 4; i++) rows.push({ ...trekRij(rnd, 'man'), geslacht: 'man' })
  return rows
})()

export const CONTROLEGROEP: Point[] = CONTROLE_ROWS.map((r) => ({ x: r.maat, y: r.lengte }))

/**
 * De belofte die letterlijk op het bord staat, hier bewaakt in plaats van
 * gehoopt: geen enkele controlerij mag samenvallen met een rij die de
 * leerling ziet en kan weggooien. Er wordt streng vergeleken, op (maat,
 * lengte) én op de volledige rij, want twee gelijke punten zijn hetzelfde
 * bolletje op het bord, ook als er een ander geslacht bij hoort.
 *
 * Het is geen theoretische controle: met de vorige seed sloeg ze aan.
 * In dev knalt de demo hierop, in de klas blijft ze draaien en schreeuwt
 * de console, want een leeg scherm helpt daar niemand.
 */
const CONTROLE_OP_HET_BORD: string[] = (() => {
  const punt = new Set(WERKSET.map((r) => `${r.maat}|${r.lengte}`))
  const rij = new Set(WERKSET.map((r) => `${r.geslacht}|${r.maat}|${r.lengte}`))
  return CONTROLE_ROWS.filter(
    (r) => punt.has(`${r.maat}|${r.lengte}`) || rij.has(`${r.geslacht}|${r.maat}|${r.lengte}`),
  ).map((r) => `${r.geslacht} maat ${r.maat} ${r.lengte} cm`)
})()

if (CONTROLE_OP_HET_BORD.length > 0 || WERKSET.length !== 15 || CONTROLE_ROWS.length !== 8) {
  const klacht =
    `datasets: het bord zou een onwaarheid tonen. ` +
    `${WERKSET.length} werkrijen (verwacht 15), ${CONTROLE_ROWS.length} controlerijen (verwacht 8)` +
    (CONTROLE_OP_HET_BORD.length
      ? `, en deze controlerijen staan wél op het bord: ${CONTROLE_OP_HET_BORD.join('; ')}`
      : '')
  if (import.meta.env.DEV) throw new Error(klacht)
  console.error(klacht)
}

/**
 * Hoe ver een lijn die op `punten` getraind is naast de controlegroep zit,
 * of null als er te weinig punten zijn om op te trainen. De demo vergelijkt
 * hiermee twee toestanden met elkaar in plaats van iets te beweren.
 */
export function controleMiss(punten: readonly Point[]): number | null {
  if (punten.length < 2) return null
  return meanAbsError(CONTROLEGROEP, bestFit([...punten]))
}

/**
 * Dezelfde meting, maar apart voor de vier vrouwen en de vier mannen in de
 * controlegroep. Zo kan het bord over scheefgetrokken data een gemeten
 * getal tonen in plaats van een belofte.
 */
export function controleMissPerGroep(
  punten: readonly Point[],
): Record<Geslacht, number> | null {
  if (punten.length < 2) return null
  const lijn = bestFit([...punten])
  const groep = (g: Geslacht) =>
    meanAbsError(
      CONTROLE_ROWS.filter((r) => r.geslacht === g).map((r) => ({ x: r.maat, y: r.lengte })),
      lijn,
    )
  return { man: groep('man'), vrouw: groep('vrouw') }
}

/** De rijen die je kan tekenen, en waar het model dus op traint. */
export function dokterPunten(rows: readonly DokterRow[]): Point[] {
  return rows.filter((r) => r.lengte !== null).map((r) => ({ x: r.maat, y: r.lengte as number }))
}
