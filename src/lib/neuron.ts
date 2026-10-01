/* ------------------------------------------------------------------ *
 * mAIstros 2 - les 9 - het rekenwerk van "Eén neuron zoekt zijn getal".
 *
 * Eén neuron met één verbinding, de voorbeelden van de les (tabel 2155519):
 * 0 pond is 0 kg, 3 pond is 1,3608 kg, 7 pond is 3,1752 kg. Het neuron zoekt
 * het getal waarmee het de invoer vermenigvuldigt. Per voorbeeld:
 *
 *   uitvoer    = invoer * getal
 *   fout       = uitvoer - juist           (> 0 te veel, < 0 te weinig)
 *   aanpassing = 0,01 * fout * invoer
 *   getal      = getal - aanpassing        (te veel: kleiner, te weinig: groter)
 *
 * Dat is precies wat sklearn doet: SGDRegressor(squared_error, penalty=None,
 * fit_intercept=False, constant eta0=0.01, shuffle=False) volgt deze regel over
 * 30 keer overlopen met een verschil van 0,000e+00, vanaf 0,6 en vanaf 0,3
 * (design-boards/les9/critic/c3.out). Het spoor dat dit bord WERKELIJK toont,
 * met afronden op vier cijfers, is ook nagemeten tegen SGDRegressor (sklearn
 * 1.6.1, Python 3.11): over alle 21 aanpassingen hoogstens 0,00007 ernaast
 * vanaf 0,6 en 0,00005 vanaf 0,3, en 21 van de 21 keer dezelfde richting. De
 * 0,01 is de learning_rate_init=0.01 van Stap 2 (2228146).
 *
 * ALLES IN GEHELE TIENDUIZENDSTEN. 0,6000 is 6000, 1,3608 is 13608. Dan klopt
 * elke som die op het scherm staat tot op het laatste cijfer. Met gewone
 * kommagetallen klopte gemeten 2767 van de 8080 sommen op het scherm niet
 * (design-boards/les9/m3.out): "7 * 0,5868 = 4,1078" in plaats van 4,1076.
 * Het bord rekent dus nooit met een kommagetal; het deelt pas door 10 000 op
 * het moment dat het een getal opschrijft.
 *
 *   U  = x * G
 *   F  = U - J
 *   A  = afgerond(F * x / 100)      een half gaat weg van nul
 *   G' = G - A
 *
 * DE STOPREGEL VAN DE LES. Het neuron stopt na de eerste keer overlopen waarin
 * ELKE fout kleiner is dan 0,01: "we stoppen hier, dit is dicht genoeg"
 * (2155527), "tot de fout zo klein is dat we kunnen stoppen" (2155701). Vanaf
 * 0,6 is dat na 7 keer, op 0,4543. Vanaf 0,3 ook na 7 keer, op 0,4529.
 *
 * WAAROM NIET DOORGAAN TOT ER NIETS MEER VERANDERT. Dat was het eerste ontwerp,
 * en het toonde in keer 9 en 10 "fout: 0,0009 te veel" naast een aanpassing
 * van 0,0000, recht onder de regel "Te veel: het getal wordt kleiner". Gemeten
 * 4 van de 60 getoonde toestanden vanaf 0,6 en 0,3 (critic/c2.out). Met deze
 * stopregel zijn dat er 0 van de 42, en `controleer()` hieronder houdt dat zo.
 *
 * WAAROM ER GEEN HANDVAT IS VOOR HET BEGINGETAL. Met dezelfde stopregel geven
 * 12 van de 101 begingetallen 0,00 tot 1,00 wel zo'n tegenspraak (c4.out). De
 * twee getallen van de les, 0,6 (2155523) en 0,3 (2155524), geven er geen.
 * ------------------------------------------------------------------ */

export type Pond = 0 | 3 | 7

/** Eén voorbeeld uit de tabel van 2155519. `juist` in tienduizendsten kg. */
export type Voorbeeld = { pond: Pond; juist: number }

/** In de volgorde van de tabel: 0, 3, 7 pond. */
export const VOORBEELDEN: readonly Voorbeeld[] = [
  { pond: 0, juist: 0 },
  { pond: 3, juist: 13608 },
  { pond: 7, juist: 31752 },
]

/** De twee begingetallen van de les: 0,6 (2155523) en 0,3 (2155524). */
export type Start = 6000 | 3000

/** "Dicht genoeg": elke fout kleiner dan 0,01, in tienduizendsten. */
export const DICHT_GENOEG = 100

/** Het getal waar de les op uitkomt: 0,454 (2155529, 2155530). */
export const LES_GETAL = 4540

/** Waar elke keer overlopen naartoe gaat: 1,3608 / 3 = 3,1752 / 7 = 0,4536. */
export const DOEL = 4536

export type Richting = 'kleiner' | 'blijft' | 'groter'

/** Wat het neuron bij één voorbeeld doet. Alles in tienduizendsten. */
export type Aanpassing = {
  /** De hoeveelste keer overlopen, vanaf 1. */
  keer: number
  /** Het hoeveelste voorbeeld in die keer: 0, 1 of 2. */
  plaats: number
  pond: Pond
  juist: number
  /** Het getal VOOR de aanpassing. Dat staat ook in het neuron. */
  getal: number
  uitvoer: number
  /** uitvoer - juist, met teken. */
  fout: number
  /** afgerond(fout * pond / 100), met teken. */
  aanpassing: number
  /** Het getal NA de aanpassing. */
  nieuw: number
  /** 0,01 * fout * invoer is exact, zonder afronden: dan "=", anders "ongeveer". */
  exact: boolean
}

/** Het gehele getal dichtst bij teller / noemer, een half weg van nul. */
export function afgerond(teller: number, noemer: number): number {
  const q = Math.floor(Math.abs(teller) / noemer)
  const r = Math.abs(teller) - q * noemer
  const n = 2 * r >= noemer ? q + 1 : q
  return teller < 0 ? -n : n
}

function stap(getal: number, v: Voorbeeld, keer: number, plaats: number): Aanpassing {
  const uitvoer = v.pond * getal
  const fout = uitvoer - v.juist
  const teller = fout * v.pond
  const aanpassing = afgerond(teller, 100)
  return {
    keer,
    plaats,
    pond: v.pond,
    juist: v.juist,
    getal,
    uitvoer,
    fout,
    aanpassing,
    nieuw: getal - aanpassing,
    exact: teller % 100 === 0,
  }
}

export type Spoor = {
  start: Start
  /** Elke aanpassing tot en met de stop, drie per keer overlopen. */
  stappen: readonly Aanpassing[]
  /** Na hoeveel keer overlopen het neuron stopt. */
  keren: number
}

/** Alle aanpassingen vanaf `start`, tot na de eerste keer overlopen waarin
 *  elke fout kleiner is dan 0,01. */
export function spoor(start: Start): Spoor {
  const stappen: Aanpassing[] = []
  let g: number = start
  for (let keer = 1; keer <= 200; keer++) {
    const deze = VOORBEELDEN.map((v, i) => {
      const a = stap(g, v, keer, i)
      g = a.nieuw
      return a
    })
    stappen.push(...deze)
    if (deze.every((a) => Math.abs(a.fout) < DICHT_GENOEG)) return { start, stappen, keren: keer }
  }
  throw new Error('Het neuron stopt niet binnen 200 keer overlopen.')
}

export const SPOREN: Readonly<Record<Start, Spoor>> = {
  6000: spoor(6000),
  3000: spoor(3000),
}

export function richting(a: Aanpassing): Richting {
  return a.fout > 0 ? 'kleiner' : a.fout < 0 ? 'groter' : 'blijft'
}

/** Tienduizendsten als tekst, zonder ooit een kommagetal te maken: 6000 wordt
 *  "0,6000". Alleen voor de controle hieronder; het bord schrijft met getal(). */
export function tienduizendsten(v: number): string {
  const s = v < 0 ? '-' : ''
  const a = Math.abs(v)
  return `${s}${Math.floor(a / 10000)},${String(a % 10000).padStart(4, '0')}`
}

/* ------------------------------------------------------------------ *
 * DE CONTROLE. Het bord roept dit in dev aan en schreeuwt in de console als
 * er iets niet klopt. Twee delen:
 *
 * 1. Het rekenwerk reproduceert critic/c1.out regel voor regel, keer 1 tot 7,
 *    vanaf 0,6 en vanaf 0,3. Die tabel is onafhankelijk in Python gerekend.
 * 2. Geen enkele getoonde toestand spreekt een zin op het bord tegen. Dat zijn
 *    de controles van critic/c4_final.py, plus die voor de zinnen in het paneel.
 * ------------------------------------------------------------------ */

const C1: Record<Start, readonly string[]> = {
  6000: [
    'keer  1 0 pond: 0 * 0,6000 = 0,0000  fout 0,0000 0  aanp 0,0000  -> 0,6000',
    'keer  1 3 pond: 3 * 0,6000 = 1,8000  fout 0,4392 te veel  aanp 0,0132  -> 0,5868',
    'keer  1 7 pond: 7 * 0,5868 = 4,1076  fout 0,9324 te veel  aanp 0,0653  -> 0,5215',
    'keer  2 0 pond: 0 * 0,5215 = 0,0000  fout 0,0000 0  aanp 0,0000  -> 0,5215',
    'keer  2 3 pond: 3 * 0,5215 = 1,5645  fout 0,2037 te veel  aanp 0,0061  -> 0,5154',
    'keer  2 7 pond: 7 * 0,5154 = 3,6078  fout 0,4326 te veel  aanp 0,0303  -> 0,4851',
    'keer  3 0 pond: 0 * 0,4851 = 0,0000  fout 0,0000 0  aanp 0,0000  -> 0,4851',
    'keer  3 3 pond: 3 * 0,4851 = 1,4553  fout 0,0945 te veel  aanp 0,0028  -> 0,4823',
    'keer  3 7 pond: 7 * 0,4823 = 3,3761  fout 0,2009 te veel  aanp 0,0141  -> 0,4682',
    'keer  4 0 pond: 0 * 0,4682 = 0,0000  fout 0,0000 0  aanp 0,0000  -> 0,4682',
    'keer  4 3 pond: 3 * 0,4682 = 1,4046  fout 0,0438 te veel  aanp 0,0013  -> 0,4669',
    'keer  4 7 pond: 7 * 0,4669 = 3,2683  fout 0,0931 te veel  aanp 0,0065  -> 0,4604',
    'keer  5 0 pond: 0 * 0,4604 = 0,0000  fout 0,0000 0  aanp 0,0000  -> 0,4604',
    'keer  5 3 pond: 3 * 0,4604 = 1,3812  fout 0,0204 te veel  aanp 0,0006  -> 0,4598',
    'keer  5 7 pond: 7 * 0,4598 = 3,2186  fout 0,0434 te veel  aanp 0,0030  -> 0,4568',
    'keer  6 0 pond: 0 * 0,4568 = 0,0000  fout 0,0000 0  aanp 0,0000  -> 0,4568',
    'keer  6 3 pond: 3 * 0,4568 = 1,3704  fout 0,0096 te veel  aanp 0,0003  -> 0,4565',
    'keer  6 7 pond: 7 * 0,4565 = 3,1955  fout 0,0203 te veel  aanp 0,0014  -> 0,4551',
    'keer  7 0 pond: 0 * 0,4551 = 0,0000  fout 0,0000 0  aanp 0,0000  -> 0,4551',
    'keer  7 3 pond: 3 * 0,4551 = 1,3653  fout 0,0045 te veel  aanp 0,0001  -> 0,4550',
    'keer  7 7 pond: 7 * 0,4550 = 3,1850  fout 0,0098 te veel  aanp 0,0007  -> 0,4543',
  ],
  3000: [
    'keer  1 0 pond: 0 * 0,3000 = 0,0000  fout 0,0000 0  aanp 0,0000  -> 0,3000',
    'keer  1 3 pond: 3 * 0,3000 = 0,9000  fout 0,4608 te weinig  aanp 0,0138  -> 0,3138',
    'keer  1 7 pond: 7 * 0,3138 = 2,1966  fout 0,9786 te weinig  aanp 0,0685  -> 0,3823',
    'keer  2 0 pond: 0 * 0,3823 = 0,0000  fout 0,0000 0  aanp 0,0000  -> 0,3823',
    'keer  2 3 pond: 3 * 0,3823 = 1,1469  fout 0,2139 te weinig  aanp 0,0064  -> 0,3887',
    'keer  2 7 pond: 7 * 0,3887 = 2,7209  fout 0,4543 te weinig  aanp 0,0318  -> 0,4205',
    'keer  3 0 pond: 0 * 0,4205 = 0,0000  fout 0,0000 0  aanp 0,0000  -> 0,4205',
    'keer  3 3 pond: 3 * 0,4205 = 1,2615  fout 0,0993 te weinig  aanp 0,0030  -> 0,4235',
    'keer  3 7 pond: 7 * 0,4235 = 2,9645  fout 0,2107 te weinig  aanp 0,0147  -> 0,4382',
    'keer  4 0 pond: 0 * 0,4382 = 0,0000  fout 0,0000 0  aanp 0,0000  -> 0,4382',
    'keer  4 3 pond: 3 * 0,4382 = 1,3146  fout 0,0462 te weinig  aanp 0,0014  -> 0,4396',
    'keer  4 7 pond: 7 * 0,4396 = 3,0772  fout 0,0980 te weinig  aanp 0,0069  -> 0,4465',
    'keer  5 0 pond: 0 * 0,4465 = 0,0000  fout 0,0000 0  aanp 0,0000  -> 0,4465',
    'keer  5 3 pond: 3 * 0,4465 = 1,3395  fout 0,0213 te weinig  aanp 0,0006  -> 0,4471',
    'keer  5 7 pond: 7 * 0,4471 = 3,1297  fout 0,0455 te weinig  aanp 0,0032  -> 0,4503',
    'keer  6 0 pond: 0 * 0,4503 = 0,0000  fout 0,0000 0  aanp 0,0000  -> 0,4503',
    'keer  6 3 pond: 3 * 0,4503 = 1,3509  fout 0,0099 te weinig  aanp 0,0003  -> 0,4506',
    'keer  6 7 pond: 7 * 0,4506 = 3,1542  fout 0,0210 te weinig  aanp 0,0015  -> 0,4521',
    'keer  7 0 pond: 0 * 0,4521 = 0,0000  fout 0,0000 0  aanp 0,0000  -> 0,4521',
    'keer  7 3 pond: 3 * 0,4521 = 1,3563  fout 0,0045 te weinig  aanp 0,0001  -> 0,4522',
    'keer  7 7 pond: 7 * 0,4522 = 3,1654  fout 0,0098 te weinig  aanp 0,0007  -> 0,4529',
  ],
}

/** Een regel in het formaat van critic/c1_engine.py. */
function c1Regel(a: Aanpassing): string {
  const t = tienduizendsten
  const kant = a.fout > 0 ? 'te veel' : a.fout < 0 ? 'te weinig' : '0'
  return (
    `keer ${String(a.keer).padStart(2)} ${a.pond} pond: ${a.pond} * ${t(a.getal)} = ${t(a.uitvoer)}` +
    `  fout ${t(Math.abs(a.fout))} ${kant}  aanp ${t(Math.abs(a.aanpassing))}  -> ${t(a.nieuw)}`
  )
}

/** Elke fout die het bord zou tonen. Leeg = alles klopt. */
export function controleer(): string[] {
  const fouten: string[] = []
  const meld = (s: Start, m: string) => fouten.push(`start ${tienduizendsten(s)}: ${m}`)

  for (const start of [6000, 3000] as const) {
    const { stappen, keren } = SPOREN[start]

    /* 1. Regel voor regel gelijk aan c1.out. */
    const regels = stappen.map(c1Regel)
    if (regels.length !== C1[start].length) {
      meld(start, `${regels.length} aanpassingen, c1.out heeft er ${C1[start].length}`)
    }
    C1[start].forEach((verwacht, i) => {
      if (regels[i] !== verwacht) meld(start, `regel ${i + 1} is "${regels[i]}", c1.out zegt "${verwacht}"`)
    })

    /* 2. De drie regels op het bord, en de sommen. */
    for (const a of stappen) {
      const waar = `keer ${a.keer}, ${a.pond} pond`
      if (a.pond === 0 && (a.fout !== 0 || a.aanpassing !== 0)) meld(start, `${waar}: 0 pond met een fout`)
      if (a.fout !== 0 && a.aanpassing === 0) meld(start, `${waar}: een fout, maar het getal blijft`)
      if (a.fout > 0 && !(a.nieuw < a.getal)) meld(start, `${waar}: te veel, maar niet kleiner`)
      if (a.fout < 0 && !(a.nieuw > a.getal)) meld(start, `${waar}: te weinig, maar niet groter`)
      if (a.fout === 0 && a.nieuw !== a.getal) meld(start, `${waar}: geen fout, maar het getal verandert`)
      if (a.uitvoer !== a.pond * a.getal) meld(start, `${waar}: uitvoer is niet invoer * getal`)
      if (a.fout !== a.uitvoer - a.juist) meld(start, `${waar}: fout is niet uitvoer - juist`)
      if (a.nieuw !== a.getal - a.aanpassing) meld(start, `${waar}: nieuw is niet getal - aanpassing`)
      if ((a.getal - DOEL) * (a.nieuw - DOEL) < 0) meld(start, `${waar}: het getal schiet voorbij 0,4536`)
    }

    /* 3. "Bij 3 pond en bij 7 pond wordt de fout telkens kleiner", en de
          aanpassing ook. */
    for (const pond of [3, 7] as const) {
      const bij = stappen.filter((a) => a.pond === pond)
      bij.slice(1).forEach((a, i) => {
        if (!(Math.abs(a.fout) < Math.abs(bij[i].fout))) meld(start, `${pond} pond: de fout werd niet kleiner in keer ${a.keer}`)
        if (!(Math.abs(a.aanpassing) < Math.abs(bij[i].aanpassing))) {
          meld(start, `${pond} pond: de aanpassing werd niet kleiner in keer ${a.keer}`)
        }
      })
    }

    /* 4. "Bij 7 pond is de aanpassing groter dan bij 3 pond. De fout is
          groter, en de invoer ook." Het paneel zegt dat in keer 1, en het
          geldt in elke keer. */
    for (let k = 1; k <= keren; k++) {
      const drie = stappen[(k - 1) * 3 + 1]
      const zeven = stappen[(k - 1) * 3 + 2]
      if (!(Math.abs(zeven.fout) > Math.abs(drie.fout) && Math.abs(zeven.aanpassing) > Math.abs(drie.aanpassing))) {
        meld(start, `keer ${k}: 7 pond heeft niet de grootste fout en aanpassing`)
      }
    }

    /* 5. De stopregel: pas in de laatste keer is elke fout kleiner dan 0,01. */
    for (let k = 1; k <= keren; k++) {
      const alle = stappen.slice((k - 1) * 3, k * 3).every((a) => Math.abs(a.fout) < DICHT_GENOEG)
      if (alle !== (k === keren)) meld(start, `keer ${k}: stopregel klopt niet`)
    }

    /* 6. De zinnen in het paneel die een vast feit noemen. */
    const eerste = stappen[0]
    if (eerste.pond !== 0 || eerste.uitvoer !== 0 || eerste.juist !== 0) {
      meld(start, '"Bij 0 pond was de uitvoer 0, en dat was juist" klopt niet')
    }
    // "Bij 3 pond is de fout nu kleiner dan de eerste keer": keer 2 tegen keer 1.
    if (!(Math.abs(stappen[4].fout) < Math.abs(stappen[1].fout))) meld(start, 'keer 2, 3 pond: fout niet kleiner')
    // "Nu is de uitvoer te weinig": het eerste voorbeeld met een fout, vanaf 0,3.
    if (start === 3000 && !(stappen[1].fout < 0)) meld(start, '"Nu is de uitvoer te weinig" klopt niet')
    // "Dat is bijna 0,454, het getal uit de les." Hoogstens 0,0011 ernaast.
    const eind = stappen[stappen.length - 1].nieuw
    if (Math.abs(eind - LES_GETAL) > 11) meld(start, `eindgetal ${tienduizendsten(eind)} is niet bijna 0,454`)
    // Deel 2 eindigt na keer 2, deel 3 heeft dus minstens één keer om te spelen.
    if (keren < 3) meld(start, `stopt al na ${keren} keer, deel 3 heeft niets te doen`)
  }
  return fouten
}
