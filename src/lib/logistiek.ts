/* ------------------------------------------------------------------ *
 * De 96 rijen van oefening 1 van les 3, en de curve die van één getal
 * een kans maakt.
 *
 * WAAR DE DATA VANDAAN KOMT.
 *
 * Het bestand van de les zelf, te downloaden op slide 2127651:
 * https://codefeverpublic.blob.core.windows.net/public-content/unknown/e4ec2895d1124085b1ddf496b2f6f5cb.txt
 * (HTTP 200, 5014 B). Let op het pad-segment `/unknown/`: met `/documents/`
 * antwoordt de blob BlobNotFound, en dat leest als een dode link op een
 * bestand dat prima in orde is.
 *
 * Elke regel ziet eruit als `<0.198…, 0.0, 0.955…>;Blahaj`: drie kleurwaarden
 * tussen 0 en 1, en het personage. Het bestand heeft 100 regels.
 *
 * OPGEKUIST MET DE REGELS VAN STAP 2 (slides 2224257 en 2128356): r, g en b
 * moeten getallen tussen 0,0 en 1,0 zijn, en het personage moet Albert of
 * Blahaj zijn. Dat gooit VIER regels weg, en niet drie:
 *
 *   1. `<1.0, 12.79…, 0.0027…>;Albert`      groen ligt buiten 0-1
 *   2. `<0.856…, 0.789…, -0.158…>;Albert`   blauw is negatief
 *   3. `<0.0, 0.200…, 0.892…>;Blahbert`     geen Albert en geen Blahaj
 *   4. `<0.0, kip, 0.854…>;Blahaj`          groen is geen getal
 *
 * Wie er drie verwacht, is de eerste vergeten: die regel valt niet op omdat ze
 * verder een geldige Albert is. Er blijven 96 rijen over: 52 Albert en 44
 * Blahaj. Dat sluit aan op de frequentietabel die de les zelf afdrukt op slide
 * 2127693 - {'Blahaj': 44, 'Albert': 52, 'Blahbert': 1} - want die wordt
 * geteld nadat de vier getalregels eruit zijn en voordat Blahbert eruit gaat.
 *
 * HET KENMERK IS DE GROENWAARDE, afgerond op 4 decimalen. Nagerekend: op 4 of
 * op 3 decimalen afronden laat het getrainde antwoord en alle drie de
 * tellingen ongemoeid; op 2 decimalen schuift de steilheid van 34,70 naar
 * 33,19. Dus 4.
 *
 * WAAROM GROEN EN NIET ROOD OF BLAUW. Nagerekend over alle drempels: rood en
 * blauw scheiden de twee personages PERFECT (96 van de 96 met één grens). Dan
 * loopt de steilheid van de curve naar oneindig en verandert de S in een trap,
 * en dan valt er niets meer te zien. Groen scheidt 94 van de 96 met een echte
 * overlap - Albert begint op 0,2178, Blahaj loopt door tot 0,2756 - en heeft
 * daardoor als enige kleurwaarde een eindig optimum: steilheid 34,70.
 *
 * GEEN seeded() HIER. Dit is echte data uit de les en geen gegenereerde
 * puntenwolk, dus er komt geen toeval aan te pas: elke leerling en elke beamer
 * ziet exact hetzelfde bord.
 * ------------------------------------------------------------------ */

/** Eén rij uit het bestand: haar groenwaarde en haar echte antwoord. */
export type Rij = { groen: number; albert: boolean }

/**
 * De curve. `m` is waar ze door kans 0,50 gaat, `k` is hoe steil ze staat.
 *
 * Twee letters en geen namen, want ze staan nergens op het bord: de leerling
 * ziet een plek en een steilheid, niet een parameter. Les 3 legt de vorm van
 * de logistische functie uit (slide 2128365, Verhulst) maar geen formule, en
 * dit bord houdt zich daaraan.
 */
export type Curve = { k: number; m: number }

/** De 44 groenwaarden van Blahaj. Antwoord 0, zoals de les codeert (2128358). */
const BLAHAJ_GROEN = [
  0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
  0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0095, 0.0274, 0.0342, 0.0467, 0.0952, 0.1013, 0.1099,
  0.1169, 0.1254, 0.1438, 0.1572, 0.1586, 0.1729, 0.1923, 0.2082, 0.2753, 0.2756,
] as const

/** De 52 groenwaarden van Albert. Antwoord 1. */
const ALBERT_GROEN = [
  0.2178, 0.2233, 0.2317, 0.2501, 0.279, 0.3044, 0.3211, 0.3272, 0.3278, 0.3582, 0.3584, 0.3727,
  0.3784, 0.3856, 0.4214, 0.4245, 0.4356, 0.4466, 0.4545, 0.4738, 0.4788, 0.4929, 0.493, 0.5116,
  0.521, 0.5285, 0.5428, 0.5457, 0.5678, 0.5746, 0.5755, 0.5774, 0.5856, 0.5923, 0.6055, 0.612,
  0.6146, 0.6205, 0.6317, 0.6517, 0.6719, 0.6756, 0.6765, 0.6908, 0.6953, 0.7036, 0.7187, 0.737,
  0.7438, 0.76, 0.7877, 0.791,
] as const

export const RIJEN: readonly Rij[] = [
  ...BLAHAJ_GROEN.map((groen) => ({ groen, albert: false })),
  ...ALBERT_GROEN.map((groen) => ({ groen, albert: true })),
]

export const AANTAL_ALBERT = ALBERT_GROEN.length
export const AANTAL_BLAHAJ = BLAHAJ_GROEN.length

/**
 * DE STAPEL. 27 van de 96 rijen hebben groenwaarde exact 0,0000, en het zijn
 * alle 27 Blahaj. Het is de enige dubbele groep in het bestand: 70 unieke
 * groenwaarden, één groep van 27, de andere 69 waarden komen elk precies één
 * keer voor.
 *
 * Die 27 vallen op het bord op één merk, en dan tekent het bord ~70 merken
 * terwijl het paneel 96 rijen zegt. Niet op te lossen met een spatje toeval
 * (dan is het bord niet meer voor elke leerling hetzelfde) en niet door ze op
 * te stapelen (de y-as draagt het antwoord, dus dan liegt de lengte van het
 * stokje). Dus: één merk, met de telling er in woorden bij.
 */
export const STAPEL = {
  groen: 0,
  aantal: BLAHAJ_GROEN.filter((g) => g === 0).length,
}

/* --------------------------- de banden ---------------------------- *
 * Niet van dit bord maar van de les: slide 2128364 zet zelf de grenzen op
 * 0,2 en 0,8 (eetbaar vanaf 0,8, giftig tot 0,2, ertussen weten we het
 * niet). Het bord neemt ze over in plaats van er eigen te verzinnen.     */

export const BAND_LAAG = 0.2
export const BAND_HOOG = 0.8

/* ------------------------- de twee handvatten ---------------------- */

/** Hoe ver `m` mag schuiven. Iets ruimer dan de data, zodat een leerling de
 *  curve ook naast de punten kan zetten en ziet wat dat kost. */
export const M_MIN = -0.06
export const M_MAX = 0.86

/**
 * Waar het tweede handvat staat: een VASTE afstand rechts van het eerste. Het
 * beweegt alleen verticaal, en die hoogte is de steilheid.
 *
 * Waarom het niet op de curve zit, want dat is het idee dat je als eerste
 * krijgt. Het voor de hand liggende punt is waar de kans 0,80 is, en dat staat
 * op m + ln(4)/k. Bij het getrainde antwoord is dat 0,040 van het eerste
 * handvat - 29 px op 1024 - en bij de steilste stand nog 0,018, dus 13 px.
 * Dan raken de twee handvatten elkaar en is de steile helft niet meer te
 * pakken. Op een vaste afstand van 0,060 verticaal slepen geeft over het hele
 * bereik 276 px sleepruimte.
 */
export const OFFSET = 0.06

/**
 * Hoe hoog het tweede handvat mag komen. Niet tot 0,50, want dan is de curve
 * vlak en is er geen steilheid meer, en niet tot 1, want dan is ze een trap.
 *
 * BOVEN STOPT HET OP 0,99 EN NIET OP 0,995, en dat is een leesbaarheidsfout die
 * pas in de browser opviel: het bord zet de hoogte van dit handvat met twee
 * decimalen naast het handvat, en `0,995` staat er dan als "kans 1,00". Een
 * leerling leest daar zekerheid die de curve nooit haalt. Het kost bijna niets:
 * de sleepruimte gaat van 279 naar 276 px en de steilste stand van 88,2 naar
 * 76,6, en op 76,6 zakken de twee rijen die er niet in passen nog altijd tot
 * onder 0,05.
 */
export const KANS_MIN = 0.52
export const KANS_MAX = 0.99

/** De steilheid die bij een hoogte van het tweede handvat hoort. */
export function steilheidUitKans(kans: number): number {
  const p = Math.min(Math.max(kans, KANS_MIN), KANS_MAX)
  return Math.log(p / (1 - p)) / OFFSET
}

/** En terug: waar het tweede handvat staat bij deze curve. */
export function kansVanHandvat(c: Curve): number {
  return kansOpAlbert(c.m + OFFSET, c)
}

export const K_MIN = steilheidUitKans(KANS_MIN)
export const K_MAX = steilheidUitKans(KANS_MAX)

/** De stand waar het bord op opent en waar "Zet terug" naar terugkeert.
 *  Bewust een slechte curve: te vlak en te ver naar rechts. */
export const START: Curve = { k: 3, m: 0.45 }

/* ---------------------------- de curve ---------------------------- */

/** Numeriek veilige logistische functie: `Math.exp(800)` is Infinity, en dan
 *  wordt de kans NaN in plaats van 1. */
function logistiek(z: number): number {
  if (z >= 0) return 1 / (1 + Math.exp(-Math.min(z, 700)))
  const e = Math.exp(Math.max(z, -700))
  return e / (1 + e)
}

/** De kans op Albert bij deze groenwaarde. */
export function kansOpAlbert(groen: number, c: Curve): number {
  return logistiek(c.k * (groen - c.m))
}

/** De kans die de curve deze rij geeft op HAAR EIGEN antwoord. Dat is het
 *  getal waar de zekerheid van gemaakt wordt, en het enige dat een stokje op
 *  het bord kort of lang maakt. */
export function kansOpEigenAntwoord(rij: Rij, c: Curve): number {
  const p = kansOpAlbert(rij.groen, c)
  return rij.albert ? p : 1 - p
}

/**
 * DE ZEKERHEID: het meetkundig gemiddelde van de 96 kansen op hun eigen
 * antwoord.
 *
 * Waarom niet gewoon een gemiddelde, en waarom niet een van de tellingen. Vier
 * voor de hand liggende maatstaven zijn alle vier te bespelen, en alle vier
 * zijn ze nagerekend op deze data:
 *
 *   juist (kans >= 0,50)    hangt ALLEEN van m af en helemaal niet van de
 *                           steilheid: 91 van de 96 voor elke k van 1 tot 200
 *                           bij m = 0,2330. Maximaal bij een bijna vlakke
 *                           curve: 94 van de 96 bij k = 1.
 *   zeker en juist          maximaal bij k = 63 met 92 rijen, tegen 89 voor de
 *                           getrainde curve. Steiler wint dus.
 *   de som van de kansen    maximaal bij een trap: 93,98 bij k = 1000.
 *   de laagste kans         maximaal bij een vlakke curve: 0,4964 bij k = 0,5.
 *                           Dat leert "kies nooit".
 *   de fout in het kwadraat, precies het getal van les 1: 18,75 bij k = 1,
 *                           2,55 bij k = 30, 2,00 bij k = 1000. Blijft dalen.
 *
 * Alleen het PRODUCT van de kansen heeft een optimum binnenin, en dat is
 * precies waarom logistische regressie dat gebruikt. Het meetkundig gemiddelde
 * is monotoon in dat product, dus zijn maximum is EXACT de getrainde curve.
 * Onbespeelbaar door hoe het gebouwd is, niet door een meting die goed uitviel.
 *
 * Noem het daarom nooit "het gemiddelde van de kansen": bij het antwoord is
 * het rekenkundig gemiddelde 0,948 en de zekerheid 0,922, en een leerling die
 * het natelt vindt dat verschil.
 */
export function zekerheid(c: Curve): number {
  let som = 0
  for (const rij of RIJEN) som += Math.log(Math.max(kansOpEigenAntwoord(rij, c), 1e-300))
  return Math.exp(som / RIJEN.length)
}

export type Banden = { zekerJuist: number; twijfel: number; zekerFout: number }

/** De drie tellingen van de les: zeker en juist, twijfel, zeker en fout. */
export function banden(c: Curve): Banden {
  let zekerJuist = 0
  let twijfel = 0
  let zekerFout = 0
  for (const rij of RIJEN) {
    const p = kansOpEigenAntwoord(rij, c)
    if (p >= BAND_HOOG) zekerJuist++
    else if (p <= BAND_LAAG) zekerFout++
    else twijfel++
  }
  return { zekerJuist, twijfel, zekerFout }
}

/** In welke band een rij nu valt. Elke band heeft op het bord ook zijn eigen
 *  vorm en zijn eigen telling, dus dit hangt nergens aan kleur alleen. */
export type Band = 'zekerJuist' | 'twijfel' | 'zekerFout'

export function bandVan(rij: Rij, c: Curve): Band {
  const p = kansOpEigenAntwoord(rij, c)
  if (p >= BAND_HOOG) return 'zekerJuist'
  if (p <= BAND_LAAG) return 'zekerFout'
  return 'twijfel'
}

/** De laagste kans die op het bord staat. Dit is het getal waarmee een
 *  leerling kan controleren wat de zekerheid doet: zakt deze naar 0, dan zakt
 *  de zekerheid mee. */
export function laagsteKans(c: Curve): number {
  let laagste = 1
  for (const rij of RIJEN) laagste = Math.min(laagste, kansOpEigenAntwoord(rij, c))
  return laagste
}

/** Hoeveel rijen de curve juist zet als je bij 0,50 afkapt. Staat NIET groot
 *  op het bord: het is de vraag van "Waar leg jij de grens?", niet van dit
 *  bord, en het hangt niet van de steilheid af. */
export function juist(c: Curve): number {
  let n = 0
  for (const rij of RIJEN) {
    const zegtAlbert = kansOpAlbert(rij.groen, c) >= 0.5
    if (zegtAlbert === rij.albert) n++
  }
  return n
}

/* ---------------------------- trainen ----------------------------- *
 * Newton met backtracking, en dat is een meting en geen voorkeur.
 *
 * Gewone gradient ascent haalt deze curve ook, maar niet in een aantal stappen
 * dat je kunt animeren. Zelf nagerekend vanaf de startstand, tot de steilheid
 * op 34,70 staat:
 *
 *   stapgrootte 0,05   23 172 stappen, de zekerheid zakt nooit
 *   stapgrootte 0,1    11 583 stappen, de zekerheid zakt nooit
 *   stapgrootte 0,2     5 773 stappen, de zekerheid zakt 4 keer
 *   stapgrootte 0,5     1 476 stappen, de zekerheid zakt 3 keer
 *
 * Dus: klein genoeg om nooit te zakken kost duizenden stappen, en groot genoeg
 * om snel te zijn zakt onderweg. En afbreken helpt niet: met stapgrootte 0,1
 * staat de steilheid na 90 stappen nog op 15,5, dus zou een tweede keer
 * Trainen de curve nog verder verschuiven - en dan is juist de vaststelling
 * van dit bord weg.
 *
 * Newton rekent binnen in a en b (met z = a * groen + b) in plaats van in k en
 * m. Daar is de functie die we zoeken bol, dus wijst de stap altijd de goede
 * kant op en is halveren genoeg om nooit te zakken.
 *
 * DE VASTSTELLING VAN DIT BORD, gemeten op een raster van 51 bij 51
 * startcurves over het hele bereikbare vlak: alle 2601 komen uit op
 * k = 34,696113 en m = 0,233044, in 1 tot 30 stappen. In 0 van de 2601 zakt de
 * zekerheid onderweg ook maar één stap, en in 0 van de 2601 gaat een stap
 * buiten het bereik van de handvatten. Los nagerekend met 2000 willekeurige
 * startcurves in een rekenscript: zelfde uitkomst, 2000 van de 2000.
 *
 * Geen strafterm, en dus niet wat sklearn standaard doet. Nagerekend op de
 * doelfunctie van `LogisticRegression()` zelf (een halve w-kwadraat plus C keer
 * de log-loss, met C = 1,0): op één kenmerk komt daar een veel vlakkere curve
 * uit, steilheid 4,63 op plek 0,2490, met 72 van de 96 rijen in twijfel en de
 * zekerheid op 72,4 %. Dan verliest de computer van een leerling die met de
 * hand behoorlijk zoekt. De les legt regularisatie ook nergens uit (0 treffers
 * op 'regularis', 'penalty' en 'C=' over alle slides van les 3), dus zou de
 * vorm van de curve daar bepaald worden door iets dat de leerlingen niet
 * hebben gezien.
 */

type AB = { a: number; b: number }

const naarAB = (c: Curve): AB => ({ a: c.k, b: -c.k * c.m })
const naarCurve = (p: AB): Curve => ({ k: p.a, m: -p.b / p.a })

/** De som van de logaritmes van de 96 kansen. Wat Newton omhoog duwt. */
function logKans({ a, b }: AB): number {
  let som = 0
  for (const rij of RIJEN) {
    const z = a * rij.groen + b
    const logKansOpAlbert = z > 0 ? -Math.log1p(Math.exp(-z)) : z - Math.log1p(Math.exp(z))
    som += rij.albert ? logKansOpAlbert : logKansOpAlbert - z
  }
  return som
}

/**
 * Blijft deze stand binnen het vlak dat de twee handvatten kunnen bereiken?
 *
 * DIT IS GEEN NETHEID MAAR EEN GEMETEN NOODZAAK. Newton zonder rem zet vanaf
 * een slechte startcurve eerst een stap naar een NEGATIEVE steilheid: gemeten
 * over een raster van 41 bij 41 startcurves gebeurt dat in 385 stappen, met
 * -46,9 als laagste. Een negatieve steilheid is een curve die de andere kant
 * op loopt (veel groen wordt dan Blahaj), het tweede handvat staat dan onder
 * 0,50 en dus buiten zijn eigen baan, en een leerling ziet de S omklappen. Van
 * één start zwaaide de zoektocht van -8,5 naar +36,6 naar -4,9 naar +32,5 voor
 * ze binnenkwam: eerlijk gerekend, maar op het bord chaos.
 *
 * Binnen dit vlak kan dat niet, en het kost niets: het vlak is bol in a en b
 * (a tussen twee getallen, en b tussen -M_MAX*a en -M_MIN*a, alle drie recht),
 * de uitkomst ligt er ruim binnenin (steilheid 34,7 van 1,33 tot 76,6, plek
 * 0,233 van -0,06 tot 0,86), en de functie die we zoeken is bol. Een kleinere
 * stap in dezelfde richting blijft dus binnen en gaat nog altijd omhoog.
 */
function inBereik({ a, b }: AB): AB {
  const na = Math.min(Math.max(a, K_MIN), K_MAX)
  const nm = Math.min(Math.max(-b / a, M_MIN), M_MAX)
  return { a: na, b: -na * nm }
}

/**
 * Hoeveel de curve in ÉÉN beeld mag bewegen, gemeten in de twee dingen die een
 * leerling ziet bewegen: de plek van het eerste handvat en de hoogte van het
 * tweede.
 *
 * WAAROM ER NIET TUSSEN DE STAPPEN GETWEEND WORDT, want dat was het eerste
 * plan en het is gemeten en verworpen. Een rechte tussenstand tussen twee
 * standen van de zoektocht is GEEN stand van de zoektocht: over 2601
 * startcurves schoot zo'n tussenbeeld tot 24,4 procentpunt boven de stap
 * waar het naartoe onderweg was, om daarna terug te zakken. Een leerling ziet
 * de zekerheid dan naar 92 springen en weer naar 68 vallen, en juist "de
 * zekerheid zakt nooit" is wat dit bord over trainen beweert.
 *
 * Dus komt elk beeld uit de zoektocht zelf: een kleinere stap in dezelfde
 * richting is nog altijd een echte stap, en gaat nog altijd omhoog. 0,05 in
 * plek is 36 px op 1024 en 0,08 in hoogte is 47 px, dus per beeld beweegt de
 * curve zichtbaar maar niet met een sprong.
 */
const STAP_PLEK = 0.05
const STAP_HOOGTE = 0.08

function kleineStap(van: AB, naar: AB): boolean {
  const a = naarCurve(van)
  const b = naarCurve(naar)
  if (Math.abs(a.m - b.m) > STAP_PLEK) return false
  return Math.abs(kansVanHandvat(a) - kansVanHandvat(b)) <= STAP_HOOGTE
}

/** Eén Newton-stap, of null als er niets meer te winnen is. */
function stap(p: AB): AB | null {
  let g0 = 0
  let g1 = 0
  let h00 = 0
  let h01 = 0
  let h11 = 0
  for (const rij of RIJEN) {
    const x = rij.groen
    const kans = logistiek(p.a * x + p.b)
    const fout = (rij.albert ? 1 : 0) - kans
    const w = kans * (1 - kans)
    g0 += fout * x
    g1 += fout
    h00 += w * x * x
    h01 += w * x
    h11 += w
  }
  const det = h00 * h11 - h01 * h01
  if (!(Math.abs(det) > 1e-18)) return null
  if (Math.abs(g0) < 1e-11 && Math.abs(g1) < 1e-11) return null
  const da = (h11 * g0 - h01 * g1) / det
  const db = (-h01 * g0 + h00 * g1) / det
  const nu = logKans(p)
  let t = 1
  for (let i = 0; i < 60; i++) {
    const kandidaat = inBereik({ a: p.a + t * da, b: p.b + t * db })
    if (kleineStap(p, kandidaat) && logKans(kandidaat) > nu) return kandidaat
    t /= 2
  }
  return null
}

/**
 * De hele zoektocht vanaf de curve van de leerling, als lijst standen.
 *
 * Elke stand in deze lijst is één beeld van de animatie, en elke stand is een
 * echte stap van de zoektocht.
 *
 * De stappen die je niet ZIET zijn eruit gehaald. Newton rekent aan het eind
 * nauwkeuriger dan het bord breed is: die laatste stappen verschuiven de curve
 * met minder dan een halve pixel en veranderen geen getoond cijfer meer. Een
 * animatie die daarna nog drie keer "een stap" zet, laat een leerling naar een
 * stilstaand bord kijken, en de huisregel is dat elke beweging op het bord ook
 * iets verandert. Dus blijven alleen de standen over die een halve pixel of
 * één getoond cijfer verschillen. Dat geeft 1 tot 30 beelden, en 10 vanaf de
 * startstand.
 *
 * Het LAATSTE beeld is daarna weer de exacte uitkomst, want dat is waar dit
 * bord zijn vaststelling op baseert: waar je ook begint, je eindigt hier.
 *
 * En een LEGE lijst betekent: hier valt niets zichtbaars meer te zoeken. Dat
 * gebeurt echt, en niet alleen na het trainen - de top is vlak, dus een
 * leerling die met de hand goed zoekt komt op dezelfde 92,2 % uit. De knop
 * staat dan uit, zoals een knop uit staat die niets zou veranderen.
 */
export function trainStappen(begin: Curve): Curve[] {
  let p = naarAB(begin)
  const ruw: Curve[] = []
  for (let i = 0; i < 200; i++) {
    const volgende = stap(p)
    if (!volgende) break
    p = volgende
    ruw.push(naarCurve(p))
  }
  const uit: Curve[] = []
  let vorige = begin
  for (const c of ruw) {
    if (!zichtbaarVerschil(vorige, c)) continue
    uit.push(c)
    vorige = c
  }
  if (uit.length === 0) return []
  uit[uit.length - 1] = ruw[ruw.length - 1]
  return uit
}

/**
 * Verschillen deze twee standen genoeg om het te zien?
 *
 * Gemeten op 1024x768: het bord tekent 719,6 px per eenheid groen en 588,1 px
 * per eenheid kans, dus een halve pixel is 0,0007 in m en 0,0009 in de hoogte
 * van het tweede handvat. De zekerheid staat met één decimaal in procent, dus
 * daar is 0,00005 de eerste stap die je ziet veranderen.
 */
function zichtbaarVerschil(a: Curve, b: Curve): boolean {
  if (Math.abs(a.m - b.m) >= 0.0007) return true
  if (Math.abs(kansVanHandvat(a) - kansVanHandvat(b)) >= 0.0009) return true
  return Math.abs(zekerheid(a) - zekerheid(b)) >= 0.00005
}

/**
 * DE UITKOMST, en de reden dat dit bord bestaat: waar je ook begint, de
 * computer komt hier uit. Gemeten, niet ingetypt - zie de dev-controle
 * onderaan dit bestand.
 */
export const ANTWOORD: Curve = { k: 34.696113, m: 0.233044 }

/* ------------------------- de acht tabelrijen ---------------------- *
 * Het venster waar de twee personages door elkaar lopen. Daar wonen de twee
 * rijen die geen enkele curve juist krijgt: twee Blahaj op 0,2753 en 0,2756,
 * tussen vier Alberts in. Een grafiek kan dat niet uitleggen, een tabel wel -
 * de tabel is het bestand, de grafiek is het plaatje van het bestand.        */

export const TRANSITIE: readonly Rij[] = RIJEN.filter(
  (r) => r.groen >= 0.2 && r.groen < 0.3,
).sort((a, b) => a.groen - b.groen)

/* ---------------------------- dev-controle ------------------------- *
 * De getallen in de koppen hierboven zijn beweringen, en een bewering die
 * niemand narekent, drijft weg. Dit rekent ze bij elke start in dev na en
 * schreeuwt in de console als er één niet meer klopt. In de klas gebeurt er
 * niets: een leeg scherm helpt daar niemand.                              */

if (import.meta.env?.DEV) {
  const zeg = (goed: boolean, wat: string) => {
    if (!goed) console.error(`logistiek.ts: ${wat}`)
  }

  zeg(RIJEN.length === 96, `96 rijen verwacht, ${RIJEN.length} geteld`)
  zeg(AANTAL_ALBERT === 52 && AANTAL_BLAHAJ === 44, `52 Albert en 44 Blahaj verwacht`)
  zeg(STAPEL.aantal === 27, `27 rijen op groen 0,0000 verwacht, ${STAPEL.aantal} geteld`)
  zeg(
    new Set(RIJEN.map((r) => r.groen)).size === 70,
    `70 unieke groenwaarden verwacht, ${new Set(RIJEN.map((r) => r.groen)).size} geteld`,
  )
  zeg(TRANSITIE.length === 8, `8 rijen tussen 0,20 en 0,30 verwacht, ${TRANSITIE.length} geteld`)

  // De zes getallen van de uitkomst.
  const eind = trainStappen(START).at(-1)!
  zeg(Math.abs(eind.k - ANTWOORD.k) < 5e-5, `steilheid ${eind.k.toFixed(6)} tegen 34,696113`)
  zeg(Math.abs(eind.m - ANTWOORD.m) < 5e-7, `plek ${eind.m.toFixed(6)} tegen 0,233044`)
  const z = zekerheid(ANTWOORD)
  zeg(Math.abs(z * 100 - 92.218) < 0.01, `zekerheid ${(z * 100).toFixed(3)} % tegen 92,218 %`)
  const b = banden(ANTWOORD)
  zeg(
    b.zekerJuist === 89 && b.twijfel === 5 && b.zekerFout === 2,
    `banden ${b.zekerJuist}/${b.twijfel}/${b.zekerFout} tegen 89/5/2`,
  )
  zeg(juist(ANTWOORD) === 91, `${juist(ANTWOORD)} juist tegen 91`)
  zeg(
    Math.abs(laagsteKans(ANTWOORD) - 0.186) < 5e-4,
    `laagste kans ${laagsteKans(ANTWOORD).toFixed(4)} tegen 0,1860`,
  )

  // En de vaststelling zelf: elke startcurve eindigt op dezelfde curve, en de
  // zekerheid zakt onderweg nooit. Een raster van 12 bij 12 in dev; de 2000
  // willekeurige startcurves stonden in het losse rekenscript.
  let mis = 0
  let zakt = 0
  let meest = 0
  for (let i = 0; i < 12; i++) {
    for (let j = 0; j < 12; j++) {
      const start = {
        k: K_MIN + ((K_MAX - K_MIN) * i) / 11,
        m: M_MIN + ((M_MAX - M_MIN) * j) / 11,
      }
      const pad = trainStappen(start)
      const uit = pad.at(-1) ?? start
      if (Math.abs(uit.k - ANTWOORD.k) > 5e-4 || Math.abs(uit.m - ANTWOORD.m) > 5e-6) mis++
      meest = Math.max(meest, pad.length)
      let vorige = zekerheid(start)
      for (const c of pad) {
        const nu = zekerheid(c)
        if (nu < vorige - 1e-12) zakt++
        vorige = nu
      }
    }
  }
  zeg(mis === 0, `${mis} van de 144 startcurves eindigt elders`)
  zeg(zakt === 0, `${zakt} keer zakt de zekerheid onderweg`)
  zeg(meest <= 30, `de langste zoektocht duurt ${meest} beelden, meer dan de gemeten 30`)
}
