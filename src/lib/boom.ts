/**
 * Hoe een beslissingsboom GEBOUWD wordt: de wezens van les 5, de condities die
 * je erop kan zetten, en de boom die sklearn er zelf van maakt.
 *
 * Dit bestand is de rekenkant van het bord "Bouw de boom". Het weet niets over
 * pixels, panelen of kleuren - alleen over groepen voorbeelden, condities en
 * fout. De meetkunde staat in src/demos/KweekDeBoom.tsx.
 *
 * ------------------------------------------------------------------------
 * WAAROM DIT BESTAND BESTAAT, EN WAT HET VORIGE BORD ONS KOSTTE
 * ------------------------------------------------------------------------
 *
 * Het vorige bord van les 5 ("Waar legt de boom zijn grens?") is afgekeurd, en
 * de reden staat in CLAUDE.md: het leerde iets OVER een getrainde boom - dat
 * zijn grens amper beweegt - in plaats van hoe het algoritme werkt. Wat daar
 * gemeten is, blijft hier staan omdat het geld gekost heeft en omdat de eerste
 * claim eraan sneuvelde:
 *
 * - "Sleep een punt ver weg en er beweegt NIETS" is FOUT voor een
 *   `DecisionTreeClassifier` met standaardinstellingen: de grens verschoof in
 *   100% van 900 sleepbewegingen, mediaan 15,0% van het bord.
 * - Het wordt pas waar onder drie afgedwongen voorwaarden - data die op één
 *   kenmerk scheidbaar is, `max_depth=1`, en een punt dat de grens niet
 *   vasthoudt. Dan: 5 933 van 5 933 sleepbewegingen exact 0 px, tegen 54 700
 *   van 54 700 voor kleinste kwadraten. Een claim die drie voorwaarden nodig
 *   heeft, is meestal de verkeerde claim.
 * - `min_samples_leaf=2` is SLECHTER dan 1, niet stabieler: bimodaal,
 *   onveranderd in 47,7% van de sleepbewegingen en mediaan 14,7% als ze wel
 *   beweegt.
 * - Vergelijk voor gevoeligheid nooit met logistische regressie: haar verlies
 *   verzadigt voor een punt dat al juist staat, dus ze beweegt maar 0,09% van
 *   het bord en het contrast dat je wil tonen valt weg.
 *
 * De splitsingszoeker hieronder is de opvolger van `boomGrens` uit tree.ts, die
 * tot 1e-6 gekruiscontroleerd was tegen `DecisionTreeClassifier(max_depth=1)`.
 * Deze versie doet drie klassen en vier kenmerken en is opnieuw nagemeten,
 * hieronder.
 *
 * ------------------------------------------------------------------------
 * DE DATA: DE WEZENS VAN DE LES ZELF, n=20, seed 1
 * ------------------------------------------------------------------------
 *
 * Bit voor bit gegenereerd door de code van de les (slides 2132213, 2224343,
 * 2224344 en 2224345) met `aantal_voorbeelden = 20` - de eerste waarde die de
 * les zelf voorstelt - en `random.seed(1)`. Dat geeft 4 Blahaj, 4 Albert en 12
 * Onbekend wezen.
 *
 * De twintig voorbeelden staan hier als tabel en niet als generator. De
 * generator van de les is Python's Mersenne Twister; die in JS naschrijven zou
 * hetzelfde beeld op een omweg opleveren en bij één afrondingsfout een ANDER
 * bord geven dan het meetscript. Een tabel kan niet uit de pas lopen: elke
 * beamer toont deze twintig voorbeelden.
 *
 * De vier kenmerken en hun codering zijn die van slide 2132210:
 *   Kleur      0.0 blauw   1.0 oranje
 *   Materiaal  0.0 plush   1.0 metaal
 *   Lengte     een float tussen 25.0 en 140.0
 *   Soort      0.0 haai    1.0 robot
 *
 * ------------------------------------------------------------------------
 * WAT ER GEMETEN IS, MET sklearn 1.6.1 OP PYTHON 3.11
 * ------------------------------------------------------------------------
 *
 * Op deze twintig voorbeelden, en elk getal nagerekend voor er een zin over
 * geschreven is:
 *
 *   0 condities                      8 fout van 20   (alles Onbekend wezen)
 *   beste met 1 conditie             6 fout
 *   beste met 2 condities            3 fout
 *   beste met 3 condities            0 fout, 4 bladeren
 *   de boom van sklearn              0 fout, maar 4 condities en 5 bladeren
 *   sklearn op diepte 2              1 fout, terwijl 0 haalbaar is
 *
 * Er zijn 22 mogelijke eerste condities (Kleur 1, Materiaal 1, Soort 1, Lengte
 * 19). Precies TWEE ervan laten 0 fout toe binnen drie condities: `Materiaal
 * <= 0.50` en `Soort <= 0.50`. De eerste keuze van sklearn, `Lengte <= 53.04`,
 * is de beste eerste conditie op gini (1 van de 22) en komt daarna niet lager
 * dan 1 fout binnen het budget van drie. Dat is greedy zoeken in gehele
 * getallen: na één conditie staat de computer voor (6 tegen 7 voor de route
 * via Materiaal) en toch heeft hij er één meer nodig.
 *
 * De route van een leerling die met Materiaal begint: 8 -> 7 -> 3 -> 0.
 * De route van sklearn, in zijn eigen bouworde (diepte-eerst, links eerst):
 * 8 -> 6 -> 4 -> 1 -> 0. Laat je hem in plaats daarvan telkens het vakje
 * uitbreiden dat op dat moment het meest oplevert (`max_leaf_nodes`), dan is
 * het 8 -> 6 -> 3 -> 1 -> 0. Beide zijn gemeten; het eindpunt is hetzelfde en
 * de tussenstanden hangen dus af van de orde waarin je hem laat groeien. Het
 * bord toont daarom alleen de eindgetallen van zijn boom, geen route.
 *
 * DE VIER GETALLEN VAN DE COMPUTERBOOM ZIJN STABIEL, DE TEKST NIET. Over 300
 * runs zonder `random_state` - en de les geeft er zelf geen mee - komt er altijd
 * 4 condities, 5 bladeren, diepte 3, 0 fout uit. Maar `export_text` gaf in 20
 * runs VIJF verschillende teksten, want op twee vakjes zijn meerdere condities
 * exact even goed (gini gelijk tot op de laatste bit): in de linkergroep zijn
 * `Materiaal <= 0.50` en `Soort <= 0.50` gelijk, en diep rechts zijn `Kleur <=
 * 0.50`, `Lengte <= 132.28` en `Soort <= 0.50` alle drie gelijk. sklearn kiest
 * daar willekeurig. Daarom telt `gelijkspelVakjes()` die vakjes: het bord mag
 * zijn eigen tekst tonen, maar moet erbij zeggen dat een notebook daar iets
 * anders kan printen. Zie ook CLAUDE.md, gotcha 9 en 14.
 *
 * `besteConditie` breekt gelijkspel VAST: laagste kenmerknummer, dan laagste
 * drempel. Dat moet, want een bord moet op elke beamer hetzelfde beeld geven.
 * De boom die daaruit komt is één van de vijf echte uitkomsten van sklearn,
 * niet een vijfde eigen variant - nagerekend.
 *
 * GEEN GINI OP HET SCHERM. De les zet in beide `plot_tree`-aanroepen (2132150
 * en 2132415) zelf `impurity=False`: ze heeft gini uit haar eigen prent
 * gehaald. Gini rekent hier dus wel, maar staat nergens. En een eigen
 * fout-maat per splitsing zou over het algoritme liegen: argmin fout en argmin
 * gini kozen een ANDERE wortelconditie in 8 van 50 seeds bij n=20 en in 26 van
 * 50 bij n=1000. Fout hoort bij de hele boom, zoals de les het zelf afdrukt.
 *
 * Meetscripts: scratchpad/m/gen.py en v_bouw*.py van deze sessie.
 */

/* --------------------------- de klassen -------------------------------- *
 * In de volgorde waarin de les ze zet: `soorten = ['Albert','Blahaj',
 * 'Onbekend wezen']` op slide 2132326, want een DecisionTreeClassifier
 * sorteert de klassen die hij tegenkomt. Diezelfde volgorde is de volgorde
 * van `value = [a, b, c]` in een vakje, dus ze mag hier niet wijzigen.
 *
 * `klasse` en niet `soort`: in deze data IS `Soort` een kenmerk (haai of
 * robot), en één woord voor twee begrippen is precies de verwarring die de
 * woordenlijst moet tegenhouden. De les geeft het woord zelf aan op 2224342:
 * de voorbeelden onderaan "krijgen dan de klasse die bij class staat".      */
export const KLASSEN = ['Albert', 'Blahaj', 'Onbekend wezen'] as const

export type Klasse = (typeof KLASSEN)[number]

/** De kenmerknamen zoals `export_text` ze afdrukt, met hoofdletter (2132327). */
export const KENMERKEN = ['Kleur', 'Materiaal', 'Lengte', 'Soort'] as const

export type KenmerkNr = 0 | 1 | 2 | 3

/**
 * Wat de getallen van een kenmerk betekenen, in de volgorde van `KENMERKEN`.
 *
 * Dit staat hier omdat een conditie zonder deze regel onleesbaar is. Slide
 * 2224341 stelt die vraag zelf, over de uitvoer van `export_text`: "Snap je
 * wat hier staat?" Een leerling die `Kleur <= 0.50` leest, kan die vraag pas
 * met ja beantwoorden als hij weet dat 0 blauw is. De les zegt het op 2132210
 * en daar komen deze woorden vandaan; het bord herhaalt ze waar de conditie
 * staat, want dertien slides verder is niemand het nog aan het opzoeken.
 *
 * HIER WORDT OOK DE WOORDBOTSING BESLECHT. `Soort` is in deze data een
 * KENMERK (haai of robot), terwijl deck 4598 in zijn eerste voorbeeld "Soort
 * 1", "Soort 2" en "Soort 3" als KLASSEN gebruikt. Eén woord voor twee
 * begrippen is precies wat de woordenlijst tegenhoudt. Het bord noemt de
 * uitkomst daarom altijd `klasse` (het woord van de les zelf op 2224342), en
 * laat `Soort` nooit los staan: waar het kenmerk opduikt, staat "0 haai, 1
 * robot" ernaast. Dan kan het niet gelezen worden als de uitkomst.
 *
 * Elke tekst is kort genoeg om achter een conditie te passen: de bordkolom is
 * 520 px en `Kleur <= 0.50 · 0 blauw, 1 oranje` is 33 tekens.
 */
export const CODERING: readonly string[] = [
  '0 blauw, 1 oranje',
  '0 plush, 1 metaal',
  '25 tot 140 cm',
  '0 haai, 1 robot',
]

/** Het enige kenmerk met meer dan één mogelijke drempel, dus het enige waar
 *  een leerling iets te slepen heeft. */
export const LENGTE: KenmerkNr = 2

/** De as waarop de lengte staat: exact de grenzen van de generator van de les
 *  (`random.uniform(25.0, 140.0)`), niet de kleinste en grootste lengte in de
 *  data. Anders zou de as van de gekozen groep afhangen en zou hetzelfde
 *  handvat op elk vakje een andere plaats hebben. */
export const LENGTE_AS = { van: 25, tot: 140 } as const

/** Hoeveel condities een leerling mag zetten. Niet gekozen maar afgedwongen:
 *  vier vakjes naast elkaar zijn 520 px en dat is wat er op een beamer van
 *  900 px naast de panelen vrij is. Drie condities is ook precies wat een
 *  foutloze boom hier nodig heeft, en één minder dan sklearn gebruikt. */
export const BUDGET = 3

/** Zo diep mag de boom. Binnen een budget van drie condities kan het niet
 *  dieper, dus dit is een tweede slot op dezelfde deur - en het houdt de
 *  vakjes binnen de vier rijen die het bord tekent. */
export const MAX_DIEPTE = 3

export type Voorbeeld = {
  /** Kleur, Materiaal, Lengte, Soort - in de volgorde van `KENMERKEN`. */
  waarden: readonly [number, number, number, number]
  klasse: Klasse
}

/** De twintig wezens. Zie de kop van dit bestand: gegenereerd door de code van
 *  de les met `aantal_voorbeelden = 20` en `random.seed(1)`. */
export const VOORBEELDEN: readonly Voorbeeld[] = [
  { waarden: [0.0, 0.0, 28.35910610281003, 0.0], klasse: 'Blahaj' },
  { waarden: [0.0, 0.0, 46.18584342343082, 0.0], klasse: 'Blahaj' },
  { waarden: [0.0, 0.0, 44.094365474415355, 0.0], klasse: 'Blahaj' },
  { waarden: [0.0, 0.0, 31.376725643485543, 0.0], klasse: 'Blahaj' },
  { waarden: [1.0, 1.0, 119.81740348367764, 1.0], klasse: 'Albert' },
  { waarden: [1.0, 1.0, 117.97964259154952, 1.0], klasse: 'Albert' },
  { waarden: [1.0, 1.0, 126.06371890891052, 1.0], klasse: 'Albert' },
  { waarden: [1.0, 1.0, 131.54893404542054, 1.0], klasse: 'Albert' },
  { waarden: [0.0, 1.0, 28.259959800030725, 1.0], klasse: 'Onbekend wezen' },
  { waarden: [1.0, 0.0, 105.020779678371, 1.0], klasse: 'Onbekend wezen' },
  { waarden: [0.0, 0.0, 128.66415762532063, 0.0], klasse: 'Onbekend wezen' },
  { waarden: [0.0, 0.0, 99.6978055854323, 0.0], klasse: 'Onbekend wezen' },
  { waarden: [1.0, 0.0, 136.43967478382143, 0.0], klasse: 'Onbekend wezen' },
  { waarden: [0.0, 1.0, 133.00420717908747, 0.0], klasse: 'Onbekend wezen' },
  { waarden: [1.0, 0.0, 102.83758208274706, 1.0], klasse: 'Onbekend wezen' },
  { waarden: [1.0, 0.0, 72.8606929728498, 0.0], klasse: 'Onbekend wezen' },
  { waarden: [0.0, 1.0, 38.902345377667736, 1.0], klasse: 'Onbekend wezen' },
  { waarden: [1.0, 0.0, 59.887378757285525, 1.0], klasse: 'Onbekend wezen' },
  { waarden: [1.0, 0.0, 80.22610189702434, 1.0], klasse: 'Onbekend wezen' },
  { waarden: [1.0, 0.0, 67.21924061411512, 1.0], klasse: 'Onbekend wezen' },
]

/** Alle twintig, als de groep waarmee het bord opent. */
export const ALLE_IDS: readonly number[] = VOORBEELDEN.map((_, i) => i)

/** De waarde van één voorbeeld op één kenmerk. */
export const waarde = (id: number, k: KenmerkNr): number => VOORBEELDEN[id].waarden[k]

/* ------------------------------ groepen -------------------------------- */

/** `value = [a, b, c]`: hoeveel voorbeelden van elke klasse in deze groep
 *  zitten, in de volgorde van `KLASSEN`. */
export function tel(ids: readonly number[]): [number, number, number] {
  const uit: [number, number, number] = [0, 0, 0]
  for (const id of ids) uit[KLASSEN.indexOf(VOORBEELDEN[id].klasse)]++
  return uit
}

/**
 * De klasse die het vakje voorspelt: de grootste van de drie.
 *
 * Gelijkspel gaat naar de eerste in `KLASSEN`, want dat doet numpy's argmax in
 * sklearn ook. Zonder die afspraak zou hetzelfde vakje op twee beamers een
 * andere klasse kunnen tonen.
 */
export function grootste(ids: readonly number[]): Klasse {
  const c = tel(ids)
  let beste = 0
  for (let i = 1; i < c.length; i++) if (c[i] > c[beste]) beste = i
  return KLASSEN[beste]
}

/** Hoeveel voorbeelden in deze groep een andere klasse hebben dan wat het
 *  vakje voorspelt. Dit is het enige foutgetal op het bord, en het hoort bij
 *  een hele boom, nooit bij één conditie. */
export function foutIn(ids: readonly number[]): number {
  if (ids.length === 0) return 0
  const c = tel(ids)
  return ids.length - Math.max(...c)
}

/** Bestaat deze groep uit één klasse? Dan is er niets meer te splitsen. */
export function zuiver(ids: readonly number[]): boolean {
  const c = tel(ids)
  return c.filter((v) => v > 0).length <= 1
}

/** Gini van een groep. Rekent, en staat nergens op het scherm - zie de kop. */
function gini(ids: readonly number[]): number {
  const n = ids.length
  if (n === 0) return 0
  const c = tel(ids)
  return 1 - c.reduce((s, v) => s + (v / n) * (v / n), 0)
}

/* ------------------------------ condities ------------------------------ */

export type Conditie = { kenmerk: KenmerkNr; drempel: number }

/**
 * Elke drempel die een boom op dit kenmerk in deze groep zou overwegen: het
 * midden tussen twee opeenvolgende waarden die er echt voorkomen.
 *
 * Daarom snapt het handvat naar deze getallen en niet naar hele centimeters:
 * tussen twee voorbeelden liggen oneindig veel drempels die allemaal dezelfde
 * twee groepen geven, en de boom kiest er dan altijd het midden van.
 *
 * Een leeg antwoord betekent dat alle voorbeelden in deze groep dezelfde
 * waarde hebben. Dan kan je op dit kenmerk niet meer splitsen, en dat is geen
 * fout maar iets om te tonen: een kenmerk kan opgebruikt zijn.
 */
export function drempels(ids: readonly number[], k: KenmerkNr): number[] {
  const uniek = [...new Set(ids.map((id) => waarde(id, k)))].sort((a, b) => a - b)
  const uit: number[] = []
  for (let i = 0; i < uniek.length - 1; i++) uit.push((uniek[i] + uniek[i + 1]) / 2)
  return uit
}

/** De groep in twee: waar de conditie klopt, en waar ze niet klopt. De les
 *  zegt het zo op 2224342: de pijl naar links als de conditie waar is, naar
 *  rechts als ze vals is. */
export function splitsIds(
  ids: readonly number[],
  c: Conditie,
): { waar: number[]; vals: number[] } {
  const waarKant: number[] = []
  const valsKant: number[] = []
  for (const id of ids) {
    if (waarde(id, c.kenmerk) <= c.drempel) waarKant.push(id)
    else valsKant.push(id)
  }
  return { waar: waarKant, vals: valsKant }
}

/**
 * Wat de computer in deze groep zou kiezen: van alle mogelijke condities de
 * conditie die de twee groepen het meest uit één klasse maakt. Dat is precies
 * wat CART doet, met gini als maat.
 *
 * `evenGoed` zegt hoeveel condities exact even goed zijn. Dat is geen
 * curiositeit: op deze data zijn er twee vakjes met een gelijkspel, en sklearn
 * kiest daar willekeurig - vandaar vijf verschillende `export_text`-uitkomsten
 * in twintig runs. Het bord moet dus kunnen zeggen dat zijn eigen keuze daar
 * één van meerdere is.
 *
 * Gelijkspel wordt hier VAST beslecht: laagste kenmerknummer, dan laagste
 * drempel.
 */
export function besteConditie(
  ids: readonly number[],
): { conditie: Conditie; evenGoed: number } | null {
  const n = ids.length
  if (n < 2) return null
  let beste: Conditie | null = null
  let besteScore = Infinity
  let evenGoed = 0
  for (const k of [0, 1, 2, 3] as const) {
    for (const drempel of drempels(ids, k)) {
      const { waar, vals } = splitsIds(ids, { kenmerk: k, drempel })
      if (waar.length === 0 || vals.length === 0) continue
      const score = (waar.length * gini(waar) + vals.length * gini(vals)) / n
      if (score < besteScore - 1e-12) {
        besteScore = score
        beste = { kenmerk: k, drempel }
        evenGoed = 1
      } else if (Math.abs(score - besteScore) <= 1e-12) {
        evenGoed++
      }
    }
  }
  return beste === null ? null : { conditie: beste, evenGoed }
}

/* -------------------------------- de boom ------------------------------- */

/**
 * Eén vakje van de boom, met de les zijn eigen woord (2224342, 2224364).
 *
 * `conditie` is null in een blad: een vakje van waaruit geen pijlen meer
 * vertrekken. `ids` zijn de voorbeelden die in dit vakje getest worden, dus
 * `ids.length` is `samples` en `tel(ids)` is `value`.
 */
export type Vakje = {
  ids: readonly number[]
  conditie: Conditie | null
  waar: Vakje | null
  vals: Vakje | null
}

/** Waar een vakje in de boom zit: het rijtje pijlen dat je volgt om er te
 *  komen. Het lege pad is de wortel. */
export type Pad = readonly ('waar' | 'vals')[]

/** Een vakje zonder conditie: een blad. */
export const maakBlad = (ids: readonly number[]): Vakje => ({
  ids,
  conditie: null,
  waar: null,
  vals: null,
})

/** Het bord opent hiermee: één vakje met alle twintig voorbeelden erin. */
export const maakWortel = (): Vakje => maakBlad(ALLE_IDS)

/** Zet een conditie op dit vakje. De twee nieuwe vakjes zijn bladeren. */
export function splitsVakje(v: Vakje, c: Conditie): Vakje {
  const { waar, vals } = splitsIds(v.ids, c)
  return { ids: v.ids, conditie: c, waar: maakBlad(waar), vals: maakBlad(vals) }
}

export const isBlad = (v: Vakje): boolean => v.conditie === null

/** Elk vakje van de boom, met zijn pad, van boven naar onder. */
export function alleVakjes(v: Vakje, pad: Pad = []): { pad: Pad; vakje: Vakje }[] {
  const uit = [{ pad, vakje: v }]
  if (v.waar) uit.push(...alleVakjes(v.waar, [...pad, 'waar']))
  if (v.vals) uit.push(...alleVakjes(v.vals, [...pad, 'vals']))
  return uit
}

export function zoekVakje(v: Vakje, pad: Pad): Vakje | null {
  let hier: Vakje | null = v
  for (const stap of pad) {
    if (!hier) return null
    hier = stap === 'waar' ? hier.waar : hier.vals
  }
  return hier
}

/** Een nieuwe boom met één vakje vervangen. De boom is onveranderlijk, zodat
 *  "laatste conditie weg" gewoon een oudere boom terugzet. */
export function vervangVakje(v: Vakje, pad: Pad, nieuw: Vakje): Vakje {
  if (pad.length === 0) return nieuw
  const [stap, ...rest] = pad
  const kind = stap === 'waar' ? v.waar : v.vals
  if (!kind) return v
  const vervangen = vervangVakje(kind, rest, nieuw)
  return stap === 'waar' ? { ...v, waar: vervangen } : { ...v, vals: vervangen }
}

export function aantalBladeren(v: Vakje): number {
  if (isBlad(v)) return 1
  return aantalBladeren(v.waar!) + aantalBladeren(v.vals!)
}

export function aantalCondities(v: Vakje): number {
  if (isBlad(v)) return 0
  return 1 + aantalCondities(v.waar!) + aantalCondities(v.vals!)
}

export function diepteVan(v: Vakje): number {
  if (isBlad(v)) return 0
  return 1 + Math.max(diepteVan(v.waar!), diepteVan(v.vals!))
}

/** Hoeveel van de voorbeelden deze boom fout voorspelt: per blad de
 *  voorbeelden die niet de klasse van dat blad hebben, bij elkaar. */
export function foutVanBoom(v: Vakje): number {
  if (isBlad(v)) return foutIn(v.ids)
  return foutVanBoom(v.waar!) + foutVanBoom(v.vals!)
}

/**
 * De boom die sklearn zelf bouwt: splits door tot elke groep uit één klasse
 * bestaat, en kies elke keer de beste conditie van dat moment.
 *
 * `maxDiepte` is er voor de vergelijking die de les zelf maakt (2224243 zet
 * `max_depth=3`); zonder waarde groeit de boom door zoals
 * `DecisionTreeClassifier()` in de les.
 *
 * Nagerekend tegen sklearn 1.6.1 op deze twintig voorbeelden: dezelfde
 * wortelconditie, dezelfde vier getallen (4 condities, 5 bladeren, diepte 3,
 * 0 fout), en een tekst die één van de vijf echte uitkomsten van sklearn is -
 * zie de kop over gelijkspel.
 */
export function cartBoom(ids: readonly number[], maxDiepte = Infinity): Vakje {
  if (maxDiepte <= 0 || zuiver(ids) || ids.length < 2) return maakBlad(ids)
  const keuze = besteConditie(ids)
  if (!keuze) return maakBlad(ids)
  const { waar, vals } = splitsIds(ids, keuze.conditie)
  return {
    ids,
    conditie: keuze.conditie,
    waar: cartBoom(waar, maxDiepte - 1),
    vals: cartBoom(vals, maxDiepte - 1),
  }
}

/** Hoeveel vakjes van deze boom een gelijkspel hadden: meer dan één conditie
 *  even goed. Op die vakjes kan een notebook een ander kenmerk kiezen dan het
 *  bord, en dat moet het bord kunnen zeggen. */
export function gelijkspelVakjes(v: Vakje): number {
  let n = 0
  for (const { vakje } of alleVakjes(v)) {
    if (isBlad(vakje)) continue
    const keuze = besteConditie(vakje.ids)
    if (keuze && keuze.evenGoed > 1) n++
  }
  return n
}

/* ------------------------------ als tekst ------------------------------- */

/**
 * Een conditie zoals Python haar afdrukt: `Lengte <= 53.04`.
 *
 * MET EEN PUNT, en dat is de enige plaats op dit bord waar dat mag. De regel
 * is: uitvoer van Python wordt geciteerd, nooit vertaald. Een vakje is de
 * prent van `export_text` en `plot_tree` - `samples = 20`, `value = [4, 4,
 * 12]`, `class: Blahaj` staan er even letterlijk in - dus een leerling ziet op
 * het bord karakter voor karakter wat zijn notebook afdrukt. Alles wat het
 * bord in zijn EIGEN woorden zegt (fout, condities, bladeren, diepte, samples)
 * is een heel getal en gaat door `getal()`, dus er staat nergens hetzelfde
 * getal twee keer anders opgeschreven.
 */
export const conditieTekst = (c: Conditie): string =>
  `${KENMERKEN[c.kenmerk]} <= ${c.drempel.toFixed(2)}`

/** Dezelfde conditie, maar de valse kant - zoals `export_text` die afdrukt,
 *  met twee spaties na de `>` zodat de getallen onder elkaar staan. */
export const conditieTekstVals = (c: Conditie): string =>
  `${KENMERKEN[c.kenmerk]} >  ${c.drempel.toFixed(2)}`

/**
 * De boom als de tekst die `export_text` afdrukt, regel per regel.
 *
 * Exact het formaat van slide 2132327: `|--- ` per niveau, `|   ` ervoor per
 * niveau erboven, `class: ` in een blad, twee decimalen. Nagerekend tegen
 * `export_text(clf, feature_names=..., decimals=2)`: karakter voor karakter
 * gelijk voor dezelfde boom.
 */
export function exportText(v: Vakje, diepte = 0): string[] {
  const voor = '|   '.repeat(diepte) + '|--- '
  if (isBlad(v)) return [voor + 'class: ' + grootste(v.ids)]
  return [
    voor + conditieTekst(v.conditie!),
    ...exportText(v.waar!, diepte + 1),
    '|   '.repeat(diepte) + '|--- ' + conditieTekstVals(v.conditie!),
    ...exportText(v.vals!, diepte + 1),
  ]
}
