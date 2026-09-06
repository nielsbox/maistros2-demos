/**
 * CliffWalking-v0, precies de omgeving uit les 12.
 *
 * Dit bestand is met opzet een KOPIE van wat de leerlingen in hun notebook
 * bouwen, niet een handiger variant ervan. Wie het bord speelt en daarna
 * `gym.make("CliffWalking-v0")` draait, moet dezelfde wereld terugvinden:
 * 48 toestanden, 4 acties, dezelfde beloningen, dezelfde q-learning-update.
 *
 * Er staat hier geen enkele import in. Node kan dit bestand dan rechtstreeks
 * draaien met --experimental-strip-types, en zo is het gecontroleerd: de
 * getallen die het bord toont, komen uit de code hieronder en zijn niet
 * overgeschreven uit een slide. Zie het verslag bij dit bord.
 *
 * De regels van gymnasium, nagekeken tegen de slides:
 *  - elke stap kost -1
 *  - in de afgrond stappen kost -100 en zet de agent terug op de start,
 *    de episode loopt gewoon door
 *  - tegen een muur stappen laat je staan waar je stond, en kost ook -1
 *  - de episode is klaar zodra de agent op de schat staat
 */

export const RIJEN = 4
export const KOLOMMEN = 12

/** 4 x 12 = 48 toestanden, precies wat Stap 2 van de les afdrukt. */
export const AANTAL_TOESTANDEN = RIJEN * KOLOMMEN

/**
 * De vier acties in de volgorde van gymnasium. Die volgorde staat vast: ze is
 * ook de kolomvolgorde van de q-tabel, en Stap 1 van de les koppelt precies
 * deze nummers aan de pijltjestoetsen.
 */
export const OMHOOG = 0
export const RECHTS = 1
export const OMLAAG = 2
export const LINKS = 3

export const AANTAL_ACTIES = 4

/** Wat er in de kolomkop van de q-tabel staat, in de woorden van de les. */
export const ACTIENAAM = ['omhoog', 'rechts', 'omlaag', 'links'] as const

/** Linksonder: het vakje met gras waar de agent altijd vertrekt. */
export const START = 36

/** Rechtsonder: de schat. */
export const SCHAT = 47

/** Elk vakje van de onderste rij tussen de start en de schat is afgrond. */
export const AFGROND: ReadonlySet<number> = new Set(
  Array.from({ length: 10 }, (_, i) => 37 + i),
)

export const rijVan = (toestand: number) => Math.floor(toestand / KOLOMMEN)
export const kolomVan = (toestand: number) => toestand % KOLOMMEN

export type QTabel = number[][]

/** Stap 5 van de les: een tabel met allemaal nullen. */
export function nieuweQTabel(): QTabel {
  const tabel: QTabel = []
  for (let i = 0; i < AANTAL_TOESTANDEN; i++) tabel.push(new Array(AANTAL_ACTIES).fill(0))
  return tabel
}

/**
 * De index van de grootste waarde in een rij.
 *
 * Bij gelijkspel wint de eerste, want dat doet `lijst.index(max(lijst))` in
 * Python ook. Dat is geen detail: zolang een rij nog helemaal uit nullen
 * bestaat is "omhoog" de beste actie die de agent kent, en daarom loopt hij
 * in het begin tegen het plafond. Dat hoort een leerling te zien.
 */
export function besteActie(rij: readonly number[]): number {
  let beste = 0
  for (let a = 1; a < rij.length; a++) if (rij[a] > rij[beste]) beste = a
  return beste
}

/** Waar of een rij nog nergens iets geleerd heeft: alle vier de getallen gelijk. */
export function nogNietsGeleerd(rij: readonly number[]): boolean {
  return rij.every((v) => v === rij[0])
}

export type StapResultaat = {
  nieuweToestand: number
  beloning: number
  klaar: boolean
  /** Waar of de agent tegen de rand botste en dus bleef staan. */
  tegenDeMuur: boolean
  /** Waar of de agent in de afgrond stapte en terug op de start gezet werd. */
  inDeAfgrond: boolean
}

/** Eén actie in de omgeving: `omgeving.step(actie)`. */
export function stap(toestand: number, actie: number): StapResultaat {
  let rij = rijVan(toestand)
  let kolom = kolomVan(toestand)
  if (actie === OMHOOG) rij -= 1
  else if (actie === OMLAAG) rij += 1
  else if (actie === RECHTS) kolom += 1
  else if (actie === LINKS) kolom -= 1

  const geklemdeRij = Math.min(RIJEN - 1, Math.max(0, rij))
  const geklemdeKolom = Math.min(KOLOMMEN - 1, Math.max(0, kolom))
  const tegenDeMuur = geklemdeRij !== rij || geklemdeKolom !== kolom

  const volgende = geklemdeRij * KOLOMMEN + geklemdeKolom
  if (AFGROND.has(volgende)) {
    return {
      nieuweToestand: START,
      beloning: -100,
      klaar: false,
      tegenDeMuur: false,
      inDeAfgrond: true,
    }
  }
  return {
    nieuweToestand: volgende,
    beloning: -1,
    klaar: volgende === SCHAT,
    tegenDeMuur,
    inDeAfgrond: false,
  }
}

/**
 * Stap 6 van de les: `kies_actie(toestand, q_tabel, epsilon)`.
 *
 * De toevalsgenerator komt van buiten binnen, zodat elk scherm in de klas
 * exact dezelfde episodes ziet. Een bord dat `Math.random` gebruikt, laat de
 * leerkracht naar iets wijzen dat bij de leerlingen anders staat.
 */
export function kiesActie(
  toestand: number,
  qTabel: QTabel,
  epsilon: number,
  toeval: () => number,
): { actie: number; willekeurig: boolean } {
  if (toeval() < epsilon) {
    return { actie: Math.min(AANTAL_ACTIES - 1, Math.floor(toeval() * AANTAL_ACTIES)), willekeurig: true }
  }
  return { actie: besteActie(qTabel[toestand]), willekeurig: false }
}

export type Update = {
  toestand: number
  actie: number
  willekeurig: boolean
  beloning: number
  nieuweToestand: number
  klaar: boolean
  inDeAfgrond: boolean
  tegenDeMuur: boolean
  oudeWaarde: number
  nieuweWaarde: number
  /** De beste waarde die de agent al kent voor de volgende toestand. */
  toekomstigeWaarde: number
  besteVolgendeActie: number
  /**
   * Stonden de vier getallen van deze rij vóór de update nog allemaal gelijk?
   * Dan was er geen beste actie en koos `index(max(...))` gewoon de eerste.
   * Daarom loopt de agent in het begin recht tegen het plafond, en dat mag
   * een bord niet wegmoffelen achter "de beste actie die hij al kende".
   */
  rijWasGelijk: boolean
}

/**
 * Eén volledige leerstap: kies een actie, doe ze, en pas dat ene getal aan.
 *
 * De update is letterlijk de regel van slide 2158188/2158189:
 *   nieuwe waarde = oude waarde
 *                 + learning_rate * [beloning + gamma * grootst mogelijke
 *                   waarde voor de volgende toestand - oude waarde]
 *
 * De les geeft in haar voorbeeldoplossing per ongeluk `epsilon` mee aan de
 * tweede `kies_actie`, terwijl haar eigen TODO ("geen exploratie!") en haar
 * eigen formule ("grootst_mogelijke_beloning") om het grootste getal vragen.
 * Dit bord volgt de formule, want dat is wat op de slide staat die iedereen
 * ziet.
 *
 * De tabel wordt ter plekke aangepast, net zoals `q_tabel[toestand][actie] =
 * nieuwe_waarde` in het notebook.
 */
export function leerStap(
  toestand: number,
  qTabel: QTabel,
  alpha: number,
  gamma: number,
  epsilon: number,
  toeval: () => number,
): Update {
  const rijWasGelijk = nogNietsGeleerd(qTabel[toestand])
  const { actie, willekeurig } = kiesActie(toestand, qTabel, epsilon, toeval)
  const uit = stap(toestand, actie)

  const besteVolgendeActie = besteActie(qTabel[uit.nieuweToestand])
  const oudeWaarde = qTabel[toestand][actie]
  const toekomstigeWaarde = qTabel[uit.nieuweToestand][besteVolgendeActie]
  const nieuweWaarde =
    oudeWaarde + alpha * (uit.beloning + gamma * toekomstigeWaarde - oudeWaarde)
  qTabel[toestand][actie] = nieuweWaarde

  return {
    toestand,
    actie,
    willekeurig,
    beloning: uit.beloning,
    nieuweToestand: uit.nieuweToestand,
    klaar: uit.klaar,
    inDeAfgrond: uit.inDeAfgrond,
    tegenDeMuur: uit.tegenDeMuur,
    oudeWaarde,
    nieuweWaarde,
    toekomstigeWaarde,
    besteVolgendeActie,
    rijWasGelijk,
  }
}

export type EpisodeResultaat = {
  totaleBeloning: number
  stappen: number
  klaar: boolean
  keerInDeAfgrond: number
}

/** Eén volledige episode, zoals de binnenste lus van Stap 7. */
export function speelEpisode(
  qTabel: QTabel,
  alpha: number,
  gamma: number,
  epsilon: number,
  maxAantalStappen: number,
  toeval: () => number,
): EpisodeResultaat {
  let toestand = START
  let totaleBeloning = 0
  let keerInDeAfgrond = 0
  for (let i = 0; i < maxAantalStappen; i++) {
    const u = leerStap(toestand, qTabel, alpha, gamma, epsilon, toeval)
    totaleBeloning += u.beloning
    if (u.inDeAfgrond) keerInDeAfgrond += 1
    toestand = u.nieuweToestand
    if (u.klaar) return { totaleBeloning, stappen: i + 1, klaar: true, keerInDeAfgrond }
  }
  return { totaleBeloning, stappen: maxAantalStappen, klaar: false, keerInDeAfgrond }
}

export type Pad = {
  toestanden: number[]
  acties: number[]
  totaleBeloning: number
  klaar: boolean
  keerInDeAfgrond: number
}

/**
 * Stap 8 van de les: de agent speelt met epsilon 0, dus zonder exploratie.
 * Hij leert hier niets bij; de q-tabel blijft ongemoeid.
 */
export function geleerdPad(qTabel: QTabel, maxAantalStappen: number): Pad {
  let toestand = START
  const toestanden = [toestand]
  const acties: number[] = []
  let totaleBeloning = 0
  let keerInDeAfgrond = 0
  for (let i = 0; i < maxAantalStappen; i++) {
    const actie = besteActie(qTabel[toestand])
    const uit = stap(toestand, actie)
    acties.push(actie)
    totaleBeloning += uit.beloning
    if (uit.inDeAfgrond) keerInDeAfgrond += 1
    toestand = uit.nieuweToestand
    toestanden.push(toestand)
    if (uit.klaar) return { toestanden, acties, totaleBeloning, klaar: true, keerInDeAfgrond }
  }
  return { toestanden, acties, totaleBeloning, klaar: false, keerInDeAfgrond }
}

/**
 * Voor elk vakje: vindt de agent van daaruit de schat als hij telkens de
 * beste actie volgt die hij al kent?
 *
 * Dit is het merk waarmee het bord laat zien dat de q-tabel zich vanaf de
 * schat naar achter invult. Gemeten over 20 seeds: die verzameling groeit
 * altijd van de schat naar de start, nooit omgekeerd, en ze bereikt de start
 * ergens tussen episode 120 en 170.
 *
 * Een vakje waar de rij nog helemaal uit nullen bestaat, telt niet mee: daar
 * heeft de agent nog niets geleerd en wijst "de beste actie" alleen maar naar
 * de eerste kolom.
 */
export function vindtDeSchat(qTabel: QTabel): boolean[] {
  const uit = new Array<boolean>(AANTAL_TOESTANDEN).fill(false)
  for (let begin = 0; begin < AANTAL_TOESTANDEN; begin++) {
    if (AFGROND.has(begin) || begin === SCHAT) continue
    let toestand = begin
    const gezien = new Set<number>()
    for (let i = 0; i < AANTAL_TOESTANDEN; i++) {
      if (nogNietsGeleerd(qTabel[toestand])) break
      if (gezien.has(toestand)) break
      gezien.add(toestand)
      const uitkomst = stap(toestand, besteActie(qTabel[toestand]))
      if (uitkomst.klaar) {
        uit[begin] = true
        break
      }
      if (uitkomst.inDeAfgrond) break
      toestand = uitkomst.nieuweToestand
    }
  }
  return uit
}

/**
 * De vakjes waar `vindtDeSchat` iets over kan zeggen: alle vakjes waar de
 * agent kan staan, min de schat zelf, want daar is hij al aangekomen. 48 - 10
 * - 1 = 37.
 */
export const VAKJES_MET_EEN_WEG = AANTAL_TOESTANDEN - AFGROND.size - 1
