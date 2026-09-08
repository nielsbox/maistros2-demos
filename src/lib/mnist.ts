/**
 * Het getrainde model van les 4, en de rekenkunde om het in de browser te
 * gebruiken. Niets in dit bestand kiest of gokt iets: de gewichten komen uit
 * precies de code die op slide 2128389 / 2128434 staat.
 *
 * WAAROM DIT MAG. Logistische regressie is lineair. Voor één cijfer is de
 * uitkomst dus niets meer dan `gewichten . pixels + constante`, en daarvan
 * neemt `predict()` het hoogste. Dat getal heet op dit bord het TOTAAL, en het
 * is precies wat `totalen()` hieronder teruggeeft.
 *
 * WAAROM ER GEEN SOFTMAX MEER IN STAAT. Een eerdere versie van dit bestand
 * rekende de tien totalen om naar percentages met softmax, en die percentages
 * waren nagerekend tegen `predict_proba` van sklearn: over de 120 beeldjes in
 * negen verschuivingen 0 afwijkende keuzes van 1080 en grootste verschil in
 * kans 0. Softmax is strikt stijgend, dus het hoogste totaal is altijd ook het
 * hoogste percentage: de keuze van het model verandert er niet van. Wat wél
 * verandert is wat een leerling ziet. Het bord telt getallen op, en dan hoort
 * er ook een getal te staan dat je zelf kan optellen - geen percentage dat via
 * een tweede formule uit die som komt. Zet het niet terug.
 *
 * DAT HET HET MODEL VAN DE LES IS, is aan de gewichten zelf te zien. De les
 * gebruikt `LogisticRegression()` met alle standaardwaarden, dus `max_iter=100`,
 * en toont de ConvergenceWarning die daaruit volgt op slide 2128390. Zo'n model
 * stopt vroeg en blijft daardoor klein. Gemeten op dezelfde data, split
 * `test_size=0.1`:
 *
 *   max_iter=100   grootste |gewicht| 1,07e-02   L2 0,108   30,0% onder 1e-04
 *   max_iter=1000  grootste |gewicht| 4,71e-02   L2 0,484   19,1% onder 1e-04
 *   dit bestand    grootste |gewicht| 9,61e-03   L2 0,100   30,1% onder 1e-04
 *
 * Het bestand hoort dus bij de eerste regel. Een bord dat die waarschuwing
 * stilletjes wegneemt, legt een model uit dat de leerling niet heeft.
 *
 * WAAROM DE PIXELS ONBEWERKT ZIJN. De les schaalt de data niet: ze geeft
 * `LogisticRegression()` de ruwe waarden 0 tot 255. Daardoor is de grootste
 * |gewicht| 9,61e-03 en staat 30,09% van de gewichten onder 1e-04 (nagemeten
 * op het bestand zelf). Het exportbestand rondt daarom af op 4 BEDUIDENDE
 * cijfers en nooit op 4 decimalen - dat laatste zou een derde van het model op
 * nul zetten.
 *
 * WAAROM ER GEEN GEQUANTISEERDE PIXELS IN HET BESTAND ZITTEN. Gemeten op de
 * 120 beeldjes: de pixels terugbrengen tot 6 bits scheelt 3,1 kB gezipt in
 * base64, of 6,9 kB als één teken per pixel, maar verandert 2 van de 1080
 * voorspellingen. Een bord dat een ander cijfer kiest dan het notebook van de
 * leerling is een bord dat liegt, dus de bytes gaan onbewerkt mee. Base64 is
 * hier trouwens ook de kleinste vorm: dezelfde beeldjes als JSON-lijsten van
 * gehele getallen zijn 25.276 B gezipt tegen 22.523 B.
 *
 * HET BESTAND IS NIET GEGROEID voor het bord dat de optelling uitlegt. De
 * 10 x 784 gewichten waar die hele uitleg op rust, zaten er al in en werden
 * door de eerdere versie van het bord niet gebruikt: die vroeg alleen de tien
 * uitkomsten op. Nagemeten: 202.494 B ruw en 46.037 B met `gzip -9`.
 */

/** Een beeldje is 28 bij 28. De les rekent dat zelf voor op slide 2128303. */
export const ZIJDE = 28
export const AANTAL_PIXELS = ZIJDE * ZIJDE

export type PixelModel = {
  /** 10 x 784, uitgerold: gewichten[cijfer * 784 + pixel]. */
  gewichten: Float64Array
  /** Eén per cijfer. */
  constanten: Float64Array
  /** De beeldjes uit de test set, onbewerkte waarden 0 tot 255. */
  beelden: Uint8Array[]
  /** Het echte cijfer bij elk beeldje. */
  echt: number[]
  /** Waar de gewichten vandaan komen. Staat in het bestand zelf. */
  over: string
}

type Bestand = {
  over: string
  coef: number[][]
  intercept: number[]
  beelden: string[]
  echt: number[]
}

/** Het exportbestand naast index.html. Zie public/les4-pixelmodel.json. */
export const PIXELMODEL_URL = `${import.meta.env.BASE_URL}les4-pixelmodel.json`

export async function laadPixelModel(url = PIXELMODEL_URL): Promise<PixelModel> {
  const antwoord = await fetch(url)
  if (!antwoord.ok) throw new Error(`${url} gaf ${antwoord.status}`)
  const b = (await antwoord.json()) as Bestand
  const aantalCijfers = b.intercept.length
  const gewichten = new Float64Array(aantalCijfers * AANTAL_PIXELS)
  for (let c = 0; c < aantalCijfers; c++) {
    const rij = b.coef[c]
    for (let i = 0; i < AANTAL_PIXELS; i++) gewichten[c * AANTAL_PIXELS + i] = rij[i]
  }
  return {
    gewichten,
    constanten: Float64Array.from(b.intercept),
    beelden: b.beelden.map(vanBase64),
    echt: b.echt.slice(),
    over: b.over,
  }
}

function vanBase64(s: string): Uint8Array {
  const ruw = atob(s)
  const uit = new Uint8Array(ruw.length)
  for (let i = 0; i < ruw.length; i++) uit[i] = ruw.charCodeAt(i)
  return uit
}

/**
 * Schuif een beeldje op. `dy` groter dan nul is naar beneden, `dx` groter dan
 * nul is naar rechts, en wat wegvalt wordt zwart (0), net als de achtergrond
 * van MNIST.
 *
 * Het exportbestand bevat alleen beeldjes met minstens één lege pixel langs
 * alle vier de randen, en het bord schuift nooit verder dan één pixel per as.
 * Daardoor kan er nooit inkt buiten het beeld vallen - nagerekend over 9 x 120
 * standen: de som van de pixelwaarden blijft exact gelijk. Dat is belangrijk
 * voor de les: anders zou het bord twee dingen tegelijk laten zien, "het model
 * kan niet tegen verschuiven" en "het cijfer is afgesneden", en dat zijn twee
 * verschillende verhalen.
 *
 * Op de volle test set zou dat wel gebeuren, en vooral naar beneden. Gemeten
 * over alle 70.000 MNIST-beeldjes, hoeveel er inkt verliezen bij 1 pixel
 * verschuiven: omlaag 813 (1,16%, dus ongeveer 81 van 7000), naar rechts 92,
 * naar links 16, omhoog 2. Daarom staat de grens er, en daarom mag dit bord
 * wel alle vier de richtingen aanbieden: op zijn eigen 120 beeldjes verliest
 * geen enkele richting inkt.
 */
export function verschuif(beeld: Uint8Array, dy: number, dx: number): Uint8Array {
  if (dy === 0 && dx === 0) return beeld
  const uit = new Uint8Array(AANTAL_PIXELS)
  for (let r = 0; r < ZIJDE; r++) {
    const nr = r + dy
    if (nr < 0 || nr >= ZIJDE) continue
    for (let k = 0; k < ZIJDE; k++) {
      const nk = k + dx
      if (nk < 0 || nk >= ZIJDE) continue
      uit[nr * ZIJDE + nk] = beeld[r * ZIJDE + k]
    }
  }
  return uit
}

/**
 * Het totaal per cijfer: de constante plus, voor elke pixel met inkt, het
 * gewicht van die pixel maal de pixelwaarde. Tien getallen, met een teken.
 * Dit is wat `predict()` vergelijkt.
 *
 * De nulpixels worden overgeslagen. Dat is geen benadering maar dezelfde som:
 * een pixel van 0 draagt 0 bij. Het scheelt wel een factor 5, en dat is wat de
 * teller over alle beeldjes bij elke klik betaalbaar houdt.
 */
export function totalen(model: PixelModel, beeld: Uint8Array): Float64Array {
  const n = model.constanten.length
  const uit = new Float64Array(n)
  for (let c = 0; c < n; c++) {
    const basis = c * AANTAL_PIXELS
    let som = model.constanten[c]
    for (let i = 0; i < AANTAL_PIXELS; i++) {
      const v = beeld[i]
      if (v !== 0) som += model.gewichten[basis + i] * v
    }
    uit[c] = som
  }
  return uit
}

/**
 * Dezelfde som, maar onderbroken na elk rijtje: `uit[r * 10 + c]` is het
 * totaal voor cijfer `c` als je de eerste `r` rijtjes van het beeldje hebt
 * opgeteld. `r` loopt van 0 (alleen de constanten) tot 28 (het volle totaal),
 * dus dit zijn 29 tussenstanden.
 *
 * Waarom per rijtje en niet per pixel: 784 stappen van 90 ms duren 70 seconden
 * en 28 stappen 2,5. En een rijtje is op het bord te zien - de leerling ziet
 * een strook van het beeldje vol worden - waar één pixel van de 784 dat niet
 * is.
 *
 * WAAROM DE TUSSENSTANDEN ERTOE DOEN. De optelling is een wedloop, geen klim.
 * Nagemeten over de 120 beeldjes, in de platte volgorde van de 784 pixels: de
 * kop wisselt mediaan 8 keer van cijfer (max 25), en bij slechts 2 van de 120
 * staat de winnaar de hele optelling op kop. Bij het openingsbeeldje leidt de
 * 7 van rijtje 6 tot rijtje 21 en neemt de 5 pas op rijtje 22 over. Een bord
 * dat halverwege een winnaar noemt, leert dus het tegendeel van wat het
 * bedoelt.
 */
export function totalenPerRijtje(model: PixelModel, beeld: Uint8Array): Float64Array {
  const n = model.constanten.length
  const uit = new Float64Array((ZIJDE + 1) * n)
  const loop = new Float64Array(n)
  for (let c = 0; c < n; c++) {
    loop[c] = model.constanten[c]
    uit[c] = loop[c]
  }
  for (let r = 0; r < ZIJDE; r++) {
    for (let k = 0; k < ZIJDE; k++) {
      const i = r * ZIJDE + k
      const v = beeld[i]
      if (v === 0) continue
      for (let c = 0; c < n; c++) loop[c] += model.gewichten[c * AANTAL_PIXELS + i] * v
    }
    for (let c = 0; c < n; c++) uit[(r + 1) * n + c] = loop[c]
  }
  return uit
}

/**
 * Wat elke pixel bijdraagt aan één cijfer: pixelwaarde maal gewicht, 784
 * getallen met een teken. Een pixel zonder inkt staat op 0, want die draagt
 * ook niets bij - dat is geen keuze van het bord maar wat de som doet.
 *
 * BANDEN OP DEZE GETALLEN, gemeten over 120 beeldjes x 10 cijfers, dus 181.960
 * bijdragen van pixels met inkt: p01 -0,770, p25 -0,109, p50 +0,003,
 * p75 +0,126, p99 +0,650, kleinste -1,598, grootste +2,288. Bij drempels 0,10
 * en 0,30 valt 45,5% in de laagste band, 34,4% in de middelste en 20,1% in de
 * hoogste. Die verdeling is de reden dat het bord met drie banden werkt en
 * niet met zeven: bij zeven staat de helft van de inkt in twee stappen die van
 * achter in de klas niet te scheiden zijn.
 */
export function bijdragen(model: PixelModel, beeld: Uint8Array, cijfer: number): Float64Array {
  const basis = cijfer * AANTAL_PIXELS
  const uit = new Float64Array(AANTAL_PIXELS)
  for (let i = 0; i < AANTAL_PIXELS; i++) {
    const v = beeld[i]
    if (v !== 0) uit[i] = model.gewichten[basis + i] * v
  }
  return uit
}

/**
 * De halve balkas voor één beeldje: het grootste totaal dat op dit beeldje
 * ergens voorkomt, over alle negen standen en alle 29 tussenstanden, naar
 * boven op een veelvoud van 5.
 *
 * WAAROM PER BEELDJE, EN WAAROM OVER ALLE STANDEN TEGELIJK. Eén vaste as voor
 * alle beeldjes moet +/-35 zijn, en dan is de langste balk mediaan 36% van de
 * halve as en in het slechtste geval 16% - onleesbaar aan de onderkant.
 * Per beeldje is dat mediaan 64%. Gemeten verdeling over de 120: +/-10 bij 4
 * beeldjes, +/-15 bij 30, +/-20 bij 57, +/-25 bij 21, +/-30 bij 5, +/-35 bij 3.
 *
 * Maar de as mag dan NIET meebewegen met de optelling of met het verschuiven,
 * anders herkadert het bord midden in een beweging en is voor en na niet meer
 * te vergelijken. Daarom rekent deze functie hem één keer over alles wat de
 * leerling op dit beeldje kan bereiken, en ligt hij daarna vast tot de
 * leerling een ander beeldje neemt. Dat is het enige moment waarop het
 * onderwerp verandert, en dus het enige moment waarop herschalen eerlijk is.
 */
export function balkas(model: PixelModel, beeld: Uint8Array): number {
  let top = 0
  for (const dy of [-1, 0, 1]) {
    for (const dx of [-1, 0, 1]) {
      const perRijtje = totalenPerRijtje(model, verschuif(beeld, dy, dx))
      for (let j = 0; j < perRijtje.length; j++) {
        const a = Math.abs(perRijtje[j])
        if (a > top) top = a
      }
    }
  }
  /* Ondergrens 5: een beeldje waar niets boven 5 uitkomt, bestaat in deze 120
     niet (de kleinste as is 10), maar een as van 0 zou delen door nul. */
  return Math.max(5, Math.ceil(top / 5) * 5)
}

/** Het cijfer met het hoogste totaal. Dit is wat `predict()` teruggeeft. */
export function keuze(totaal: Float64Array): number {
  let beste = 0
  for (let c = 1; c < totaal.length; c++) if (totaal[c] > totaal[beste]) beste = c
  return beste
}

/** De keuze van het model voor elk beeldje in het bestand, bij één stand. */
export function keuzes(model: PixelModel, dy: number, dx: number): Int8Array {
  const uit = new Int8Array(model.beelden.length)
  for (let i = 0; i < model.beelden.length; i++) {
    uit[i] = keuze(totalen(model, verschuif(model.beelden[i], dy, dx)))
  }
  return uit
}

export type Teller = {
  /** Beeldjes waar de keuze van het model het echte cijfer is. */
  juist: number
  /** Beeldjes waar de keuze verschilt van de keuze zonder verschuiving. */
  anders: number
  totaal: number
}

export function tel(model: PixelModel, nu: Int8Array, midden: Int8Array): Teller {
  let juist = 0
  let anders = 0
  for (let i = 0; i < nu.length; i++) {
    if (nu[i] === model.echt[i]) juist++
    if (nu[i] !== midden[i]) anders++
  }
  return { juist, anders, totaal: nu.length }
}
