/**
 * De data van les 11 (CartPole), en de rekenkunde om ze in de browser te tellen.
 * Niets in dit bestand kiest of gokt iets en niets traint: alles wat het bord
 * toont, is opgenomen in public/les11-cartpole.json en hier alleen geteld.
 *
 * WAAR HET BESTAND VANDAAN KOMT. Het is gemaakt door maak_les11_cartpole.py,
 * met Python 3.11, gymnasium 1.0.0, scikit-learn 1.6.1 en numpy 2.2.2, en met
 * de standaardwaarden van de les: CartPole-v1, 10 spelletjes met willekeurige
 * acties (stap 1, 2157952), 50 spelletjes waarvan alleen de goede in X en y
 * gaan, goed = meer dan 25 punten (stap 2, 2199218), train_test_split met
 * train_size 0.8 (stap 3, 2157954) en LogisticRegression() (stap 4, 2157957).
 * Het script leest het ontwerpbestand ship_22279.json niet: het rekent alles
 * opnieuw uit gymnasium en vergelijkt pas daarna. Het bestand in het veld `over`
 * zegt hetzelfde. Nooit met de hand aanpassen, altijd opnieuw maken.
 *
 * WAAROM SEED 22279. Gekozen over 2500 seeds op typische getallen (de goede
 * spelletjes, het aantal voorbeelden, de accuracy, hoeveel beter het model
 * speelt), en ook typisch ZONDER het filter. Een critic heeft de seed
 * onafhankelijk opnieuw gemaakt uit gymnasium: het bestand klopt exact.
 *
 * HET BORDMODEL ZIET TWEE GETALLEN, de hoek en de hoeksnelheid, en niet vier.
 * Dat is de enige afwijking van de les, en het bord zegt het in stap 3. Het
 * kan niet anders: een vlak heeft twee assen. Op deze seed kiezen het bordmodel
 * en het model van de les (vier getallen) hetzelfde op 91 van de 99 pijltjes
 * van de test set, en ze hebben dezelfde accuracy, 55 van de 99. Over 2000
 * andere seeds is de mediaan 0,93 van de test set. Tijdens het SPELEN
 * verschillen ze meer (ongeveer 0,75 van de acties), en daarom zegt het bord
 * bij het afspelen dat het DIT bordmodel is dat speelt.
 *
 * AFRONDING. Hoek, hoeksnelheid, positie en snelheid staan op 4 beduidende
 * cijfers, de drie coefficienten van het model onafgerond. Nagemeten bij het
 * maken: geen enkele telling op het scherm en geen enkele actie van het
 * afgespeelde spelletje verandert, ook niet bij 3 cijfers. 31 kB, 10 kB gezipt.
 */

/** Een actie zoals CartPole ze nummert: 0 is naar links duwen, 1 naar rechts. */
export type Actie = 0 | 1
export const LINKS: Actie = 0
export const RECHTS: Actie = 1

export type Waarneming = {
  /** Welk van de 50 spelletjes, 0 tot 49. */
  spelletje: number
  hoek: number
  hoeksnelheid: number
  /** De actie die op deze waarneming volgde. */
  actie: Actie
  /** 0: niet in X (geen goed spelletje), 1: train set, 2: test set. */
  deel: 0 | 1 | 2
}

export type Stand = {
  /** Positie van de kar. */
  x: number
  hoek: number
  hoeksnelheid: number
  /** De actie die volgde, of null: dan is het spelletje hier afgelopen. */
  actie: Actie | null
}

export type Afgespeeld = { punten: number; standen: Stand[] }

/** De drie getallen van het bordmodel: score = hoek * a + hoeksnelheid * b + c. */
export type Model = { hoek: number; hoeksnelheid: number; intercept: number }

export type CartPole = {
  over: string
  drempel: number
  /** De punten van elk van de 50 spelletjes. */
  punten: number[]
  waarnemingen: Waarneming[]
  model: Model
  /** Het bordmodel speelt: spelletje 4 van 10, de mediaan (64 punten). */
  modelSpeelt: Afgespeeld
  /** De computer speelt met willekeurige acties: spelletje 1 van stap 1 (16 punten). */
  willekeurigSpeelt: Afgespeeld
}

type Bestand = {
  over: string
  seed: number
  drempel: number
  punten: number[]
  waarnemingen: [number, number, number, number, number][]
  model: Model
  model_speelt: { punten: number; stappen: [number, number, number, number, number | null][] }
  willekeurig_speelt: { punten: number; stappen: [number, number, number, number, number | null][] }
}

/** Het bestand naast index.html. Een functie en geen constante, zodat node dit
 *  bestand kan inladen om de tellingen na te rekenen (daar is er geen
 *  import.meta.env). */
export const cartpoleUrl = () => `${import.meta.env.BASE_URL}les11-cartpole.json`

const alsActie = (a: number | null): Actie | null => (a === null ? null : a === 1 ? RECHTS : LINKS)

function afgespeeld(b: Bestand['model_speelt']): Afgespeeld {
  return {
    punten: b.punten,
    standen: b.stappen.map(([x, , hoek, hoeksnelheid, a]) => ({
      x,
      hoek,
      hoeksnelheid,
      actie: alsActie(a),
    })),
  }
}

export async function laadCartPole(url = cartpoleUrl()): Promise<CartPole> {
  const antwoord = await fetch(url)
  if (!antwoord.ok) throw new Error(`${url} gaf ${antwoord.status}`)
  const b = (await antwoord.json()) as Bestand
  return {
    over: b.over,
    drempel: b.drempel,
    punten: b.punten.slice(),
    waarnemingen: b.waarnemingen.map(([spelletje, hoek, hoeksnelheid, a, deel]) => ({
      spelletje,
      hoek,
      hoeksnelheid,
      actie: a === 1 ? RECHTS : LINKS,
      deel: deel === 2 ? 2 : deel === 1 ? 1 : 0,
    })),
    model: { ...b.model },
    modelSpeelt: afgespeeld(b.model_speelt),
    willekeurigSpeelt: afgespeeld(b.willekeurig_speelt),
  }
}

/* ------------------------------ het model ------------------------------ */

/** De score van het bordmodel. Boven nul is de kans op rechts boven 0,50. */
export const score = (m: Model, hoek: number, hoeksnelheid: number) =>
  m.hoek * hoek + m.hoeksnelheid * hoeksnelheid + m.intercept

/**
 * De kans op rechts, zoals `predict_proba` ze geeft. Het bord toont dit getal
 * nergens: alleen of het boven of onder 0,50 ligt. Het staat hier omdat de zin
 * in stap 3 erover gaat, en omdat `kiest` hieronder precies die grens is.
 */
export const kansOpRechts = (m: Model, hoek: number, hoeksnelheid: number) =>
  1 / (1 + Math.exp(-score(m, hoek, hoeksnelheid)))

/** Wat het model kiest: rechts als de kans op rechts boven 0,50 ligt. Dat is
 *  wat `predict()` doet, en het is nagerekend op alle 494 pijltjes in X en op
 *  elke actie van het afgespeelde spelletje: 0 verschillen. */
export const kiest = (m: Model, hoek: number, hoeksnelheid: number): Actie =>
  score(m, hoek, hoeksnelheid) > 0 ? RECHTS : LINKS

/** Waar de lijn de hoogte `hoek` kruist: daar is de kans precies 0,50. */
export const lijnBij = (m: Model, hoek: number) => -(m.intercept + m.hoek * hoek) / m.hoeksnelheid

/* ------------------------------ de tellingen ----------------------------- */

export type Kant = { juist: number; van: number }
export type Telling = { rechts: Kant; links: Kant }

/**
 * Per HELFT van het vlak: rechts is hoeksnelheid boven nul (de stok beweegt
 * naar rechts), links de rest. `juist` telt rechts de acties naar rechts en
 * links de acties naar links: hoe vaak de kar duwde naar waar de stok bewoog.
 */
export function perHelft(W: readonly Waarneming[]): Telling {
  const t: Telling = { rechts: { juist: 0, van: 0 }, links: { juist: 0, van: 0 } }
  for (const w of W) {
    if (w.hoeksnelheid > 0) {
      t.rechts.van++
      if (w.actie === RECHTS) t.rechts.juist++
    } else {
      t.links.van++
      if (w.actie === LINKS) t.links.juist++
    }
  }
  return t
}

/**
 * Per KANT VAN DE LIJN: rechts is waar het model rechts kiest. `juist` telt
 * daar de acties die het model juist raadt. Dat zijn andere groepen dan de
 * helften: de pijltjes tussen de as en de lijn wisselen van kant (57 op 494).
 */
export function perKantVanDeLijn(m: Model, W: readonly Waarneming[]): Telling {
  const t: Telling = { rechts: { juist: 0, van: 0 }, links: { juist: 0, van: 0 } }
  for (const w of W) {
    if (kiest(m, w.hoek, w.hoeksnelheid) === RECHTS) {
      t.rechts.van++
      if (w.actie === RECHTS) t.rechts.juist++
    } else {
      t.links.van++
      if (w.actie === LINKS) t.links.juist++
    }
  }
  return t
}

/** Wat `score()` in stap 4 van de les doet: het deel van de test set dat het
 *  model juist raadt. */
export function accuracy(m: Model, W: readonly Waarneming[]): Kant {
  const test = W.filter((w) => w.deel === 2)
  return { juist: test.filter((w) => kiest(m, w.hoek, w.hoeksnelheid) === w.actie).length, van: test.length }
}

/** "hier 51 van de 100 keer": een aandeel als heel getal van de 100. */
export const vanDe100 = (k: Kant) => Math.round((100 * k.juist) / Math.max(1, k.van))

/** Hoe vaak het afgespeelde spelletje van actie wisselt. */
export function wissels(a: Afgespeeld): number {
  let n = 0
  for (let i = 1; i < a.standen.length; i++) {
    const vorige = a.standen[i - 1].actie
    const deze = a.standen[i].actie
    if (vorige !== null && deze !== null && vorige !== deze) n++
  }
  return n
}

/* ------------------------------ de controle ------------------------------ */

/** De afstand van een stand tot de lijn, in hoeksnelheid. */
const afstand = (m: Model, s: Stand) => Math.abs(s.hoeksnelheid - lijnBij(m, s.hoek))

/** Gemiddelde afstand tot de lijn in het eerste en het laatste kwart van een spelletje. */
export function wegVanDeLijn(m: Model, a: Afgespeeld): { eerste: number; laatste: number } {
  const n = a.standen.length
  const kwart = (i: number) => a.standen.slice(Math.floor((i * n) / 4), Math.floor(((i + 1) * n) / 4))
  const gem = (S: Stand[]) => S.reduce((t, s) => t + afstand(m, s), 0) / Math.max(1, S.length)
  return { eerste: gem(kwart(0)), laatste: gem(kwart(3)) }
}

/**
 * Wat het bord in woorden zegt, nagerekend op het bestand dat het laadt. Een
 * lege lijst betekent dat elke zin klopt. Het bord roept dit in dev op en
 * schreeuwt in de console als een zin niet meer klopt, bijvoorbeeld na een
 * nieuw bestand met een andere seed. De getallen zelf komen altijd uit de
 * tellingen; dit bewaakt de WOORDEN eromheen ("ongeveer de helft", "nu vaker",
 * "altijd", "de andere kant op", "loopt weg").
 *
 * Niet na te rekenen in de browser, en dus gemeten bij het maken van het
 * bestand: "jouw model kiest meestal hetzelfde" (91 van de 99 op de test set)
 * en "daardoor duurden ze net langer" (slide 2228132; over 19 937 spelletjes
 * is het verband tussen de punten en het duwen naar waar de stok beweegt 0,585,
 * ook zonder de laatste 5 standen van elk spelletje).
 */
export function controleer(d: CartPole): string[] {
  const fout: string[] = []
  const X = d.waarnemingen.filter((w) => w.deel > 0)
  const a = perHelft(d.waarnemingen)
  const g = perHelft(X)
  const l = perKantVanDeLijn(d.model, X)
  const deel = (k: Kant) => k.juist / Math.max(1, k.van)
  if ([a.rechts, a.links].some((k) => Math.abs(vanDe100(k) - 50) > 5))
    fout.push('stap 1 zegt "aan elke kant ongeveer de helft"')
  if (!(deel(g.rechts) > deel(a.rechts) && deel(g.links) > deel(a.links)))
    fout.push('stap 2 zegt "nu vaker", aan beide kanten')
  if (!(deel(g.rechts) > 0.5 && deel(g.links) > 0.5)) fout.push('stap 2: de goede helften liggen niet boven de helft')
  if (!(deel(l.rechts) > 0.5 && deel(l.links) > 0.5))
    fout.push('stap 3 zegt "altijd", maar aan een kant van de lijn is dat niet de meerderheid')
  for (const w of X) {
    if ((kansOpRechts(d.model, w.hoek, w.hoeksnelheid) > 0.5) !== (kiest(d.model, w.hoek, w.hoeksnelheid) === RECHTS)) {
      fout.push('stap 3: de kans boven 0,50 valt niet samen met de kant van de lijn')
      break
    }
  }
  const S = d.modelSpeelt.standen
  if (S.some((s) => s.actie !== null && s.actie !== kiest(d.model, s.hoek, s.hoeksnelheid)))
    fout.push('het afgespeelde model kiest niet wat de lijn zegt')
  for (let i = 1; i < S.length; i++) {
    const over = kiest(d.model, S[i].hoek, S[i].hoeksnelheid) !== kiest(d.model, S[i - 1].hoek, S[i - 1].hoeksnelheid)
    if (over && S[i].actie !== null && S[i].actie === S[i - 1].actie) {
      fout.push('stap 4 zegt "over de lijn, dan duwt het de andere kant op"')
      break
    }
  }
  if (!(d.modelSpeelt.punten > d.willekeurigSpeelt.punten)) fout.push('het model speelt niet langer dan willekeurig')
  const m = wegVanDeLijn(d.model, d.modelSpeelt)
  const r = wegVanDeLijn(d.model, d.willekeurigSpeelt)
  if (!(r.laatste > 2 * r.eerste && r.laatste > 2 * m.laatste)) fout.push('stap 4 zegt "de ring loopt weg"')
  if (S.at(-1)?.actie !== null || d.willekeurigSpeelt.standen.at(-1)?.actie !== null)
    fout.push('een afgespeeld spelletje mist zijn laatste stand ("hier is het spelletje afgelopen")')
  return fout
}
