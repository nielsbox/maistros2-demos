/* ------------------------------------------------------------------ *
 * Les 10: het simpelste neurale netwerk uit les 9, en zijn leersnelheid.
 *
 * DE WERELD IS DIE VAN LES 9, en niets anders. Eén neuron rekent pond om naar
 * kilogram: uitvoer = pond x gewicht. De drie voorbeelden staan in de tabel
 * op slide 2155519 (kolommen Voorbeeld / Pond / Kilogram, rijen 0, 1 en 2), de
 * start 0,6 op 2155523. Het goede gewicht is 1,3608 / 3 = 3,1752 / 7 = 0,4536.
 *
 * DE REGEL. Per aanpassing tellen alle drie de voorbeelden mee:
 *
 *   fout          = pond x gewicht - kilogram      (per voorbeeld)
 *   fouten samen  = de drie fouten opgeteld, van links naar rechts vanaf 0
 *   aanpassing    = leersnelheid x fouten samen
 *   nieuw gewicht = gewicht - aanpassing
 *
 * Dat is de regel van les 9 zelf, "hoe verder je ernaast zit, hoe meer je je
 * getal moet aanpassen" (2155531), met de knop die dat "hoe meer" bepaalt in
 * beeld. Voor een volle batch is het exact het pad van de echte gradiënt met
 * leersnelheid x 30/58 (58/3 tegen 10), dus er valt niets weg behalve een
 * constante die de leersnelheid opslokt.
 *
 * DE TOESTAND BLIJFT OP VOLLE PRECISIE. Afronden op 4 cijfers na elke
 * aanpassing lijkt eerlijker - dan klopt elke hand-controle op het scherm -
 * maar het breekt het leren zelf (exact nagerekend met Decimal): 0,02 tot 0,04
 * blijven dan voor altijd op 0,4537 of 0,4538 staan met aanpassing 0,0000, en
 * 0,15 tot 0,20 draaien in een kringetje en komen nooit aan. Het bord rekent
 * dus met gewone doubles en zegt op het scherm dat het afrondt.
 *
 * Er zit geen toeval in: geen seed, geen Math.random. Elke leerling en elke
 * beamer ziet bij dezelfde leersnelheid exact hetzelfde pad.
 * ------------------------------------------------------------------ */

export type Voorbeeld = { readonly pond: number; readonly kilogram: number }

/** De tabel van slide 2155519, in die volgorde. */
export const VOORBEELDEN: readonly Voorbeeld[] = [
  { pond: 0, kilogram: 0 },
  { pond: 3, kilogram: 1.3608 },
  { pond: 7, kilogram: 3.1752 },
]

/** Het gewicht waar les 9 mee begint (2155523). */
export const START = 0.6

/** Het goede gewicht: 1,3608 / 3 = 3,1752 / 7. */
export const GOED = 0.4536

/**
 * Buiten dit bereik stopt het trainen. Het is een VASTE afspraak en geen
 * venster: inzoomen of pannen mag nooit veranderen wanneer het trainen stopt.
 * Het bord opent wel met dit bereik in beeld, met wat lucht erom.
 */
export const BEREIK: readonly [number, number] = [0.25, 0.65]

/**
 * Aangekomen is: minder dan een halve eenheid van het 4de cijfer na de komma
 * van het goede gewicht af. Dan staat het gewicht met 4 cijfers precies als
 * 0,4536 op het scherm, en omgekeerd: staat er 0,4536, dan is het aangekomen.
 */
export const TOL = 0.00005

/** Na zoveel aanpassingen stopt het trainen hoe dan ook. */
export const CAP = 100

/** De schuif loopt van 0,02 tot 0,22 in stappen van 0,01, als k/100. */
export const K_MIN = 2
export const K_MAX = 22
export const K_START = 5

/**
 * De leersnelheid bij stand k. Altijd k/100, nooit 0,02 + n x 0,01: die som
 * geeft 0,19999999999999998 in plaats van 0,2, en die leersnelheid springt
 * NIET eindeloos heen en weer maar zakt heel traag uit. Een leerling die de
 * schuif op "0,20" zet, moet het bord krijgen dat bij 0,20 hoort.
 */
export const leersnelheid = (k: number) => k / 100

export function fouten(w: number): number[] {
  return VOORBEELDEN.map((v) => v.pond * w - v.kilogram)
}

/** De drie fouten opgeteld, van links naar rechts vanaf 0. */
export function samen(w: number): number {
  return fouten(w).reduce((s, f) => s + f, 0)
}

export function aanpassing(w: number, lr: number): number {
  return lr * samen(w)
}

export function volgende(w: number, lr: number): number {
  return w - aanpassing(w, lr)
}

export const isAangekomen = (w: number) => Math.abs(w - GOED) < TOL
export const buitenBereik = (w: number) => w < BEREIK[0] || w > BEREIK[1]

/**
 * Sprong deze aanpassing OVER het goede gewicht? Alleen als beide kanten
 * verder dan de tolerantie van het goede gewicht liggen. Bij 0,10 landt de
 * eerste aanpassing 5,6e-17 ONDER 0,4536: een naïeve tekentest zou dan "het
 * sprong 1 keer over het goede gewicht" zeggen voor een aanpassing die er
 * precies op landde. Deze telling komt overeen met wat het scherm met 4
 * cijfers toont: bij 0,11 gaat het 0,6 - 0,4390 - 0,4551 - 0,4535 - 0,4536,
 * dus 3 keer, waar de naïeve telling 4 zegt.
 */
export function sprongErover(van: number, naar: number): boolean {
  const a = van - GOED
  const b = naar - GOED
  if (Math.abs(a) < TOL || Math.abs(b) < TOL) return false
  return a * b < 0
}

export type Einde = 'aangekomen' | 'grens' | 'buiten'

/** Hoe een pad eindigt, of null zolang het nog verder mag. De volgorde is die
 *  van de controle na elke aanpassing: eerst aangekomen, dan buiten het
 *  bereik, dan de grens van 100. */
export function einde(pad: readonly number[]): Einde | null {
  const n = pad.length - 1
  const w = pad[n]
  if (n === 0) return null
  if (isAangekomen(w)) return 'aangekomen'
  if (buitenBereik(w)) return 'buiten'
  if (n >= CAP) return 'grens'
  return null
}

export function telSprongen(pad: readonly number[]): number {
  let k = 0
  for (let i = 1; i < pad.length; i++) if (sprongErover(pad[i - 1], pad[i])) k++
  return k
}

/** De grootte van elke aanpassing op het pad, zonder teken. */
export function groottes(pad: readonly number[]): number[] {
  const out: number[] = []
  for (let i = 1; i < pad.length; i++) out.push(Math.abs(pad[i] - pad[i - 1]))
  return out
}

export const steedsGroter = (g: readonly number[]) => g.every((v, i) => i === 0 || v > g[i - 1])
export const steedsKleiner = (g: readonly number[]) => g.every((v, i) => i === 0 || v < g[i - 1])

/** Een volledige training vanaf START, precies zoals het bord ze doet. */
export function training(k: number): { einde: Einde; pad: number[] } {
  const lr = leersnelheid(k)
  const pad = [START]
  for (;;) {
    pad.push(volgende(pad[pad.length - 1], lr))
    const e = einde(pad)
    if (e) return { einde: e, pad }
  }
}

/**
 * Staat er "=" of "≈" tussen "leersnelheid x fouten samen" en de aanpassing?
 * "=" alleen als het product van de twee GETOONDE getallen exact 4 cijfers na
 * de komma heeft. In gehele getallen: lr = k/100 en de getoonde fouten samen
 * zijn R/10 000, dus het product is k x R / 1 000 000, en dat heeft 4 cijfers
 * als k x R deelbaar is door 100. Dan is de getoonde aanpassing ook precies
 * dat product: de echte aanpassing ligt hoogstens 0,22 x 0,00005 = 0,000011
 * ernaast, minder dan een halve eenheid van het 4de cijfer.
 *
 * Bij 0,05 x 1,4640 is dat 5 x 14 640 = 73 200: "=". Bij 0,02 x 0,5707 niet.
 */
export function isExact(k: number, s: number): boolean {
  const R = Math.round(Math.abs(s) * 10_000)
  return (k * R) % 100 === 0
}

/* ------------------------------------------------------------------ *
 * Controles bij het laden. Ze bewaken dat dit de wereld van les 9 is, en dat
 * de zinnen op het bord niet uit de pas lopen met wat de code doet. In dev
 * knalt het bord hierop, in de klas blijft het draaien en schreeuwt de
 * console, want een leeg scherm helpt daar niemand.
 * ------------------------------------------------------------------ */

/** Wat elke stand van de schuif doet, vanaf 0,6: hoe het eindigt, na hoeveel
 *  aanpassingen, en hoe vaak het over het goede gewicht sprong. Nagerekend in
 *  een apart script met IEEE-doubles (dezelfde rekenkunde als hier) en
 *  opnieuw uit DEZE code, zie de commit. */
export const VERWACHT: Readonly<Record<number, readonly [Einde, number, number]>> = {
  2: ['aangekomen', 36, 0],
  3: ['aangekomen', 23, 0],
  4: ['aangekomen', 16, 0],
  5: ['aangekomen', 12, 0],
  6: ['aangekomen', 9, 0],
  7: ['aangekomen', 7, 0],
  8: ['aangekomen', 5, 0],
  9: ['aangekomen', 4, 0],
  10: ['aangekomen', 1, 0],
  11: ['aangekomen', 4, 3],
  12: ['aangekomen', 5, 4],
  13: ['aangekomen', 7, 6],
  14: ['aangekomen', 9, 8],
  15: ['aangekomen', 12, 11],
  16: ['aangekomen', 16, 15],
  17: ['aangekomen', 23, 22],
  18: ['aangekomen', 36, 35],
  19: ['aangekomen', 76, 75],
  20: ['grens', 100, 100],
  21: ['buiten', 4, 4],
  22: ['buiten', 2, 2],
}

function controleer(): string[] {
  const klachten: string[] = []
  const bijna = (a: number, b: number) => Math.abs(a - b) < 1e-9

  // De zes fouten die les 9 zelf uitrekent (2155522 tot 2155529). Slide
  // 2155529 drukt de laatste af als -0.0028: daar draait de les het teken om.
  // Het bord toont daarom nooit een teken, alleen "te veel" of "te weinig".
  const les9: [number, number, number][] = [
    [0.6, 1, 0.4392],
    [0.3, 1, -0.4608],
    [0.5, 1, 0.1392],
    [0.45, 1, -0.0108],
    [0.451, 1, -0.0078],
    [0.454, 2, 0.0028],
  ]
  for (const [w, i, f] of les9) {
    if (!bijna(fouten(w)[i], f)) {
      klachten.push(`fout bij gewicht ${w}, voorbeeld ${i}: ${fouten(w)[i]}, les 9 zegt ${f}`)
    }
  }
  if (Math.abs(GOED * 3 - 1.3608) > 1e-12 || Math.abs(GOED * 7 - 3.1752) > 1e-12) {
    klachten.push('het goede gewicht is niet 1,3608 / 3 en 3,1752 / 7')
  }

  // De openingstoestand zoals ze in het paneel staat.
  if (!bijna(samen(START), 1.464) || !bijna(aanpassing(START, leersnelheid(K_START)), 0.0732)) {
    klachten.push('de opening is niet 0,05 x 1,4640 = 0,0732')
  }

  for (let k = K_MIN; k <= K_MAX; k++) {
    // k/100 is exact het getal dat er staat: parseFloat("0.07") en 7/100 zijn
    // dezelfde double, voor alle 21 standen.
    const tekst = String(k).padStart(2, '0')
    if (leersnelheid(k) !== parseFloat(`0.${tekst}`)) {
      klachten.push(`leersnelheid ${k}/100 is niet parseFloat("0.${tekst}")`)
    }
    const { einde: e, pad } = training(k)
    const n = pad.length - 1
    const s = telSprongen(pad)
    const [ve, vn, vs] = VERWACHT[k]
    if (e !== ve || n !== vn || s !== vs) {
      klachten.push(
        `leersnelheid 0,${tekst}: ${e} na ${n}, ${s} keer erover; verwacht ${ve} na ${vn}, ${vs} keer`,
      )
    }
    // "Elke aanpassing was groter dan de vorige" staat op het bord bij buiten.
    if (e === 'buiten' && !steedsGroter(groottes(pad))) {
      klachten.push(`0,${tekst}: buiten maar niet steeds groter`)
    }
    // "verder van het goede gewicht dan bij de start" ook.
    if (e === 'buiten' && !(Math.abs(pad[n] - GOED) > Math.abs(START - GOED))) {
      klachten.push(`0,${tekst}: buiten maar niet verder dan bij de start`)
    }
  }
  return klachten
}

const KLACHTEN = controleer()
if (KLACHTEN.length > 0) {
  const klacht = `leersnelheid: het bord zou een onwaarheid tonen. ${KLACHTEN.join('; ')}`
  if (import.meta.env?.DEV) throw new Error(klacht)
  console.error(klacht)
}
