import { useEffect, useMemo, useRef, useState } from 'react'
import Canvas, { DragDot, type Scales, type View } from '../components/Canvas'
import { Brief, Btn, Divider, Panel, PyChip, Steps } from '../components/Overlay'
import Vaststelling, { getal } from '../components/Vaststelling'
import { clamp } from '../lib/regression'
import { DATA, DERDE, DERDE_INK, FOUT, FOUT_INK, INK, MODEL, MUTED, NAVY } from '../lib/palette'
import {
  AANTAL_ALBERT,
  AANTAL_BLAHAJ,
  BAND_HOOG,
  BAND_LAAG,
  type Band,
  bandVan,
  type Curve,
  KANS_MAX,
  KANS_MIN,
  kansOpAlbert,
  kansOpEigenAntwoord,
  kansVanHandvat,
  laagsteKans,
  M_MAX,
  M_MIN,
  OFFSET,
  RIJEN,
  type Rij,
  STAPEL,
  START,
  steilheidUitKans,
  banden,
  trainStappen,
  zekerheid,
} from '../lib/logistiek'

/* ------------------------------------------------------------------ *
 * Les 3, oefening 1: van getal naar kans.
 *
 * WAT DIT BORD ANDERS DOET DAN "WAAR LEG JIJ DE GRENS?". Dat bord begint bij
 * een model dat al getraind is en laat je aan de uitkomst draaien. Dit bord
 * heeft aan het begin geen getraind model: de leerling bouwt zelf het ding dat
 * van een getal een kans maakt, en kijkt daarna toe hoe de computer ernaar
 * zoekt. Er staat hier dus niets over een drempel, niets over hoe stevig een
 * model is en niets over hoe je het beoordeelt.
 *
 * ER STAAT GEEN LEERKRACHT BIJ. Les 3 wordt alleen doorgenomen, dus alles wat
 * een leerling nodig heeft, staat op dit bord of het bestaat niet. De toets is
 * letterlijk: kom koud binnen, en weet binnen vijf tellen wat je ziet, wat je
 * eerst doet en waar je op moet letten. Daar zakte de vorige versie op:
 *
 *   1. ze OPENDE MET DE CURVE ER AL OP, met twee handvatten eronder. Wie niet
 *      weet wat een S-curve is, ziet dan een getekend antwoord en geen opdracht.
 *   2. de twee rijen merken op hoogte 1 en 0 stonden er zonder dat iets zei
 *      DAT dat het antwoord is. Dat de les Albert 1 maakt en Blahaj 0, stond
 *      alleen in een broncommentaar.
 *   3. niets zei wat een stokje is.
 *   4. niets zei dat Trainen begint bij de curve van de LEERLING. Na het
 *      trainen was de eigen curve weg, dus was er ook niets meer te vergelijken.
 *
 * Vandaar DRIE STAPPEN in het paneel, en per stap één ding op het bord erbij:
 *
 *   stap 1  alleen de 96 rijen, op twee hoogten, met de twee antwoorden erbij
 *           in woorden. Plus de strook waar Albert en Blahaj door elkaar lopen,
 *           want dat is de reden dat er straks een curve nodig is.
 *   stap 2  de curve in een bewust slechte stand, de stokjes, de twee
 *           handvatten, en een naam bij het langste stokje: de fout. De twee
 *           rijnamen worden hier kort, want de codering is in stap 1 uitgelegd.
 *   stap 3  Trainen. De eigen curve blijft als stippellijn staan, met "hier
 *           begon jij" erbij, zodat het zoeken zichtbaar bij de leerling begint.
 *
 * Elke stap is één klik vooruit, en een gezette stap blijft aanklikbaar. Er
 * wordt niets afgeschermd: de knop van de volgende stap staat er altijd en
 * doet altijd iets.
 *
 * EEN BIJSCHRIFT HEEFT WERK, EN GAAT WEG ZODRA DAT WERK KLAAR IS.
 *
 * Dit is de les van deze ronde, en ze is duur betaald. De stappen boven zetten
 * er elk iets bij, maar er ging nooit iets af: het bord telde één bijschrift in
 * stap 1, en `heeftCurve` zette daar in stap 2 vijf bijschriften bovenop en
 * liet ze in stap 3 alle vijf staan met de zesde erbij. Geteld in de browser op
 * 1024x768, asnamen en asgetallen niet meegerekend: 4 in stap 1, 9 in stap 2,
 * 10 in stap 3. Niels keek naar stap 3 en zei: "This looks cluttered and waaaay
 * too hard to interpret for a 15 year old". Dat is geen woordkeuze-probleem.
 *
 * Er staan er nu 4, 4 en 4, en dat is een budget en geen streefdoel. Wat er per
 * stap wegging en waarom:
 *
 *   stap 1  niets. 4 bijschriften, en elk ervan doet hier zijn werk: de strook
 *           stelt de vraag, de stapel telt de merken die op elkaar liggen, en
 *           de twee rijnamen leggen de codering uit.
 *   stap 2  de strook gaat weg, tint en al: haar vraag is beantwoord op het
 *           moment dat de curve op het bord ligt. De twee namen bij de grenzen
 *           gaan weg. De rijnamen worden kort. Beide handvatnamen gaan weg.
 *           Blijft: de stapel, twee korte rijnamen, de naam van het stokje.
 *   stap 3  het stokje heeft zijn naam niet meer nodig - hij wees er één van 96
 *           aan alsof die bijzonder was. Blijft: de stapel, twee korte rijnamen
 *           en, na Trainen, "hier begon jij". De stippellijn erbij is niet
 *           langer een streep van rand tot rand: die las als een tweede,
 *           rechter model.
 *
 * WAT ER MET DE WEGGEHAALDE GETALLEN GEBEURDE, want een getal weghalen is niet
 * hetzelfde als een bijschrift weghalen.
 *
 *   0,20 en 0,80  blijven op het bord, maar als ASGETAL. De twee streepjeslijnen
 *                 liggen precies op de y-tikken 0,2 en 0,8, die Canvas elke
 *                 tiende tekent, dus wie het getal wil, leest het van de as. Een
 *                 bijschrift dat een asgetal herhaalt, is een bijschrift te veel.
 *   27 en 0,0000  blijven staan waar ze naar wijzen. Een tussenversie zette ze
 *                 in het paneel, onder de legenda; op 900x700 is dat paneel maar
 *                 518 px hoog en viel die regel er 14 px onder. Een gerekend
 *                 getal onder de rand is hetzelfde defect als geen getal.
 *
 * EN HET PANEEL WERD ER KORTER VAN, niet langer, want tien bijschriften naar een
 * paneel verhuizen is hetzelfde probleem met een ander adres. Gemeten scrollH op
 * 1024x768, voor tegen na: stap 1 480 - 480, stap 2 502 - 502, stap 3 566 - 549.
 *
 * WAT ER OP HET BORD STAAT, en waarom precies dit.
 *
 *   de x-as   de kleurwaarde g van één rij. Eén kenmerk, want alleen dan is de
 *             S-curve te tekenen. Wat dat kost staat in stap 3 op het bord: de
 *             les gebruikt r, g en b samen en haalt daarmee bijna alles juist,
 *             met alleen de g blijven er rijen over die niet passen.
 *   de y-as   het antwoord, gecodeerd zoals de les het codeert (slide
 *             2128358): Albert is 1 en staat bovenaan, Blahaj is 0 en staat
 *             onderaan. Vanaf stap 2 is dezelfde as ook de kans, en dat is
 *             precies het punt: de curve loopt van het ene antwoord naar het
 *             andere. De asnaam zegt daarom in stap 1 iets anders dan later.
 *   de curve  op elke kleurwaarde g geeft ze de kans op Albert.
 *   twee
 *   streepjes de grenzen 0,20 en 0,80. Niet van dit bord maar van de les zelf
 *             (slide 2128364). Zonder bijschrift: ze liggen op de y-tikken 0,2
 *             en 0,8, dus het getal staat er al langs de as.
 *   stokjes   van elke rij naar de curve. De lengte is hoever het model bij
 *             die rij vandaan zit - hetzelfde plaatje als "Teken de lijn" van
 *             les 1, zodat les 3 daarop voortbouwt.
 *   de strook waar de laagste Albert en de hoogste Blahaj elkaar overlappen.
 *             Uit de data gerekend, niet ingetypt.
 *
 * KLEUR DRAAGT DE KLASSE NIET, en dat is een bewuste afwijking van de les. In
 * de les is Albert oranje en Blahaj blauw, en dat is precies de valkuil: in het
 * huispalet betekent oranje een MISSER en blauw de LIJN VAN HET MODEL. Twee
 * betekenissen voor één kleur op één bord. De klasse hangt hier dus aan de
 * y-positie plus het woord langs de as, nooit aan kleur. Kleur is alleen voor
 * de drie banden, en die hebben elk ook hun eigen vorm en hun eigen telling.
 *
 * DE WOORDEN, en waar ze vandaan komen. Geteld over alle 78 slides van les 3
 * (lesson 4496, geteld op 2026-09-09):
 *
 *   `kleurwaarde`  37 keer, `groen` NUL keer. Het bord zei eerst
 *                  `groenwaarde`, en dat was één begrip met twee woorden: het
 *                  ene op het bord, het andere op elke slide. Het heet hier nu
 *                  overal `kleurwaarde g`. `kleurwaarde` is het woord van de
 *                  les - de slide die naar dit bord linkt (2127699) zegt zelf
 *                  "van één kleurwaarde" - en de losse `g` komt van slide
 *                  2127647, waar de les (r,g,b) uitlegt en haar eigen code
 *                  `g = float(rgb[1])` schrijft. Die g moet erbij: de les
 *                  gebruikt `kleurwaarden` 36 van de 37 keer over alle drie
 *                  tegelijk, en dit bord tekent er één. In de code heet het
 *                  veld nog `rij.groen`; dat staat in logistiek.ts, ziet geen
 *                  enkele leerling, en gaat mee zodra dat bestand aan de beurt
 *                  is.
 *   `twijfel`      1 keer, slide 2127771 ("Twijfelt het, dan kiest het vaker
 *                  voor een mijn"), en in exact deze betekenis.
 *   `zeker`        slide 2127649: "het model is niet zeker genoeg". Vandaar
 *                  `zeker en juist` en `zeker en fout` bij de twee grenzen.
 *   `curve`        0 keer. De les zegt `de logistische functie` (slide 2128365,
 *                  en die slide is expliciet overslaanbaar). `lijn` is in dit
 *                  project bezet door de RECHTE lijn van les 1 en 2, dus twee
 *                  vormen, twee woorden: een lijn is recht, een curve is de S.
 *   `kans`         0 keer. De les zegt "een getal tussen 0 en 1" (slide
 *                  2128358), en zo wordt het hier in stap 2 ook ingeleid
 *                  voordat het `kans` gaat heten - dezelfde brug als op "Waar
 *                  leg jij de grens?", zodat de twee borden hetzelfde zeggen.
 *   `fout`         de huisnaam voor hoever het model ernaast zit, sinds les 1.
 *                  De les gebruikt het woord alleen voor een foutmelding, dus
 *                  staat er op het bord altijd `de fout van deze rij` bij.
 * ------------------------------------------------------------------ */

/**
 * GEMETEN op 1024x768, uit de eigen constanten van Canvas (PAD 26/26/42/58,
 * RAIL_W 48, KEEP 0,66) met twee panelen links: ins.left 288, dus safe.left
 * 336, safe.right 26, safe.top 26, safe.bottom 48. Dat laat 662 bij 694 px
 * plotvlak. Met dit venster wordt dat 719,6 px per eenheid kleurwaarde g en 588,1 px
 * per eenheid kans, en dan:
 *
 *   de S stijgt van kans 0,01 naar 0,99 over 0,2649 kleurwaarde g = 191 px, dus ze
 *     leest als een curve en nooit als een trap;
 *   de stapel op kleurwaarde g 0,0000 staat op x = 379 px, 54 px vrij van het paneel
 *     en van de zoomknoppen ernaast;
 *   de twee rijen merken liggen 588 px uit elkaar, de twee streepjeslijnen 353.
 *
 * Alle drie in de browser nagemeten en niet alleen gerekend: het meest linkse
 * merk staat daar op 379 px, en dat is exact wat deze constanten voorspellen.
 */
const DEFAULT_VIEW: View = { x0: -0.06, x1: 0.86, y0: -0.09, y1: 1.09 }

/** Hoe lang één stap van de zoektocht op het bord staat. Tien stappen vanaf de
 *  startstand is dan 1,1 seconde, de langste zoektocht 3,3 seconde. */
const STAP_MS = 110

/**
 * DE STROOK WAAR ZE DOOR ELKAAR LOPEN, uit de data gerekend en niet ingetypt:
 * van de laagste Albert tot de hoogste Blahaj. Dat is 0,2178 tot 0,2756, en er
 * liggen zes rijen in - vier Albert met twee Blahaj erboven.
 *
 * Dit is het antwoord op "waarom is hier een curve voor nodig". Links van de
 * strook is alles Blahaj, rechts is alles Albert, en binnen de strook kan geen
 * enkele curve het goed krijgen. De tabel in het paneel toont exact deze zes
 * rijen, dus zeggen de strook, het getal erboven en de tabel altijd hetzelfde.
 * Een venster op ronde getallen (0,20 tot 0,30) leverde er acht, en dan telde
 * de tabel twee rijen mee die netjes aan de goede kant liggen.
 */
const OVERLAP_VAN = Math.min(...RIJEN.filter((r) => r.albert).map((r) => r.groen))
const OVERLAP_TOT = Math.max(...RIJEN.filter((r) => !r.albert).map((r) => r.groen))
const OVERLAP: readonly Rij[] = RIJEN.filter(
  (r) => r.groen >= OVERLAP_VAN && r.groen <= OVERLAP_TOT,
).sort((a, b) => a.groen - b.groen)

/** De drie stappen van het bord. Kort, met een werkwoord waar er iets te doen
 *  is, want dit lijstje is het eerste wat een leerling leest. */
const STAPPEN = ['Kijk naar de rijen', 'Maak zelf de curve', 'Laat de computer zoeken'] as const

export default function VanGetalNaarKans() {
  /** Welke van de drie stappen open staat. 0 is er nog geen curve. */
  const [stap, setStap] = useState(0)
  const [curve, setCurve] = useState<Curve>(START)
  /** Of de computer al gezocht heeft. Verandert alleen de vaststelling. */
  const [getraind, setGetraind] = useState(false)
  /** De curve waar de leerling de zoektocht mee begon. Blijft als stippellijn
   *  staan, zodat "de computer begint bij jouw curve" te zien is en niet
   *  alleen te lezen. Null zodra de leerling weer zelf sleept. */
  const [beginCurve, setBeginCurve] = useState<Curve | null>(null)
  /** Welke rij uit de tabel de leerling aanwijst, of geen. */
  const [gekozen, setGekozen] = useState<number | null>(null)

  const heeftCurve = stap >= 1

  /* --------------------------- de zoektocht ------------------------- *
   * Elke stand in `pad` is een echte stap van de zoektocht, en er wordt niet
   * tussen twee stappen getweend: een rechte tussenstand is geen stand van de
   * zoektocht, en gemeten schoot zo'n tussenbeeld tot 24,4 procentpunt boven
   * de stap waar het naartoe onderweg was. Zie de kop van logistiek.ts.       */

  const [zoekt, setZoekt] = useState(false)
  const timer = useRef<number | null>(null)

  // Een lopende zoektocht wordt afgebroken zodra het bord verdwijnt, anders
  // schrijft de laatste tik in een component die er niet meer is.
  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    }
  }, [])

  const stopZoeken = () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
    setZoekt(false)
  }

  const train = () => {
    const pad = trainStappen(curve)
    if (pad.length === 0) return
    setBeginCurve(curve)
    setZoekt(true)
    let i = 0
    const tik = () => {
      setCurve(pad[i])
      i++
      if (i < pad.length) {
        timer.current = window.setTimeout(tik, STAP_MS)
        return
      }
      timer.current = null
      setZoekt(false)
      setGetraind(true)
    }
    timer.current = window.setTimeout(tik, STAP_MS)
  }

  /** Slepen breekt een lopende zoektocht af: twee dingen die tegelijk aan
   *  dezelfde curve trekken, is een bord dat om de haverklap terugspringt. En
   *  de stippellijn van de vorige zoektocht gaat weg, want die hoort dan bij
   *  een curve die er niet meer is. */
  const zetCurve = (c: Curve) => {
    stopZoeken()
    setGetraind(false)
    setBeginCurve(null)
    setCurve(c)
  }

  /** Een stap kiezen. Terug naar stap 1 haalt alleen de curve van het bord;
   *  de stand van de handvatten blijft, dus een leerling die heen en weer
   *  klikt, verliest zijn eigen curve niet. */
  const kiesStap = (i: number) => {
    stopZoeken()
    // De tabel staat alleen in stap 1. Zonder tabel is de ring om een merk een
    // markering waar niets meer bij hoort, dus die gaat mee weg.
    if (i !== 0) setGekozen(null)
    setStap(i)
  }

  const teZoeken = useMemo(() => trainStappen(curve).length > 0, [curve])

  /** Twee rijen zijn dezelfde rij als kleurwaarde g en antwoord kloppen. In de
   *  strook is elke kleurwaarde g uniek - de enige dubbele groep in het bestand
   *  staat op 0,0000 - dus dit wijst altijd precies één merk aan. */
  const zelfdeRij = (a: Rij, b: Rij) => a.groen === b.groen && a.albert === b.albert

  /* --------------------------- alles geteld ------------------------- */

  const z = zekerheid(curve)
  const b = banden(curve)
  const laagste = laagsteKans(curve)
  const hoogte = kansVanHandvat(curve)
  const opStart = curve.k === START.k && curve.m === START.m
  const slechtste = slechtsteRij(curve)
  /** De stippellijn staat er alleen als er iets te vergelijken valt. Traint een
   *  leerling twee keer op rij, dan beweegt de curve niet meer en zou de
   *  stippellijn precies onder de curve liggen. */
  const toonBegin =
    stap === 2 &&
    beginCurve !== null &&
    (Math.abs(beginCurve.m - curve.m) > 0.004 ||
      Math.abs(kansVanHandvat(beginCurve) - hoogte) > 0.01)

  return (
    <div className="relative h-full w-full">
      <Canvas
        defaultView={DEFAULT_VIEW}
        xLabel="kleurwaarde g van de rij"
        /* In stap 1 staat er nog geen curve, dus is deze as alleen het
           antwoord. Een as die dan al "kans" heet, belooft iets wat er niet
           staat. */
        yLabel={heeftCurve ? 'kans op Albert' : 'het antwoord: 1 of 0'}
      >
        {(s) => (
          <>
            {/* DE STROOK GAAT WEG ZODRA DE CURVE ER STAAT. Ze bestaat om één
                vraag te stellen - waarom is hier een curve voor nodig - en die
                vraag is beantwoord op het moment dat het antwoord op het bord
                ligt. Vanaf stap 2 staat hetzelfde feit er beter: die zes rijen
                zijn dan precies de ringen en de vierkantjes, en die worden in
                het paneel geteld. Een getinte strook zonder naam is erger dan
                geen strook, dus gaat de tint mee weg en niet alleen de tekst. */}
            {!heeftCurve && <Strook scales={s} />}

            {heeftCurve && (
              <>
                {/* De grenzen van de les: 0,20 en 0,80. De twee streepjeslijnen
                    zijn de zichtbare oorzaak van de drie vormen, dus blijven ze
                    staan. Hun NAMEN niet: die gaan over grenzen leggen, en dat
                    is de vraag van het andere bord van deze les.

                    WAAR DE TWEE GETALLEN GEBLEVEN ZIJN: op de y-as, en nergens
                    anders. Niet in het paneel - dat telt de drie vormen met hun
                    woord erbij en noemt geen enkele grens. De gemeten pixels
                    staan bij Bandlijn hieronder, samen met het geval waarin het
                    asgetal wél wegvalt. Wat een leerling daarmee NIET meer op
                    het bord krijgt, is de zin die de lijn aan het woord "zeker"
                    knoopt. Dat de ringen tussen de lijnen liggen en de
                    vierkantjes erbuiten, moet hij nu zelf zien. Dat is de prijs
                    van het budget van vier, en ze is bewust betaald - niet
                    vergeten. */}
                <Bandlijn kans={BAND_HOOG} scales={s} />
                <Bandlijn kans={BAND_LAAG} scales={s} />
                <Stokjes curve={curve} scales={s} />
              </>
            )}

            {toonBegin && beginCurve && <Kromme curve={beginCurve} scales={s} begin />}
            {heeftCurve && <Kromme curve={curve} scales={s} />}

            {RIJEN.map((rij, i) => (
              <Merk
                key={i}
                rij={rij}
                curve={heeftCurve ? curve : null}
                scales={s}
                aangewezen={gekozen !== null && zelfdeRij(OVERLAP[gekozen], rij)}
              />
            ))}

            {/* De stapel blijft in elke stap staan. Ze past binnen het budget
                van vier, en ze hoort bij haar eigen merk: het bord tekent 70
                merken en het paneel rekent over 96, en dit label is het enige
                dat dat verschil verklaart. Naar het paneel verhuizen kostte daar
                een regel die op 900x700 juist onder de rand van het paneel viel,
                dus dan was het getal nergens meer te lezen. */}
            <Stapelnaam curve={heeftCurve ? curve : null} scales={s} />
            <Rijnamen kort={heeftCurve} scales={s} />

            {heeftCurve && (
              <>
                {/* Wat een stokje IS, bij het langste stokje van het moment.
                    Zonder deze naam staan er 96 oranje streepjes op het bord
                    die niets zeggen. Alleen in stap 2: dat is de stap waarin een
                    stokje wordt uitgelegd. In stap 3 kijkt de leerling naar de
                    zoektocht, en dan wijst deze naam één van de 96 stokjes aan
                    alsof dat er een is die het meer doet dan de rest. */}
                {stap === 1 && <Foutnaam rij={slechtste} curve={curve} scales={s} />}

                {/* Het tweede handvat eerst, zodat het eerste bovenaan ligt: dat
                    is het handvat dat een leerling het eerst pakt. */}
                <DragDot
                  point={{ x: curve.m + OFFSET, y: hoogte }}
                  scales={s}
                  color={MODEL}
                  r={9}
                  cursor="ns-resize"
                  ariaLabel="handvat: maak de curve steiler of vlakker"
                  bounds={{ x: [curve.m + OFFSET, curve.m + OFFSET], y: [KANS_MIN, KANS_MAX] }}
                  step={{ x: 0, y: 0.01 }}
                  onMove={(p) =>
                    zetCurve({ ...curve, k: steilheidUitKans(clamp(p.y, KANS_MIN, KANS_MAX)) })
                  }
                />
                <DragDot
                  point={{ x: curve.m, y: 0.5 }}
                  scales={s}
                  color={MODEL}
                  r={9}
                  cursor="ew-resize"
                  ariaLabel="handvat: schuif de curve naar links of rechts"
                  bounds={{ x: [M_MIN, M_MAX], y: [0.5, 0.5] }}
                  step={{ x: 0.005, y: 0 }}
                  onMove={(p) => zetCurve({ ...curve, m: clamp(p.x, M_MIN, M_MAX) })}
                />

                {/*
                  GEEN NAAM MEER BIJ DE HANDVATTEN. Er stonden er twee - "kans
                  0,50 bij groen 0,45" en "hier is de kans al 0,54" - en die
                  deden hetzelfde werk: een punt van de curve voorlezen. Twee
                  labels voor één taak zijn twee labels, dus moest er één weg.
                  De tweede ging daarna ook weg, en dat is de scherpere keuze:
                  wat 0,50 betekent, is waar het antwoord omslaat, en omslagpunt
                  kiezen is de vraag van het ANDERE bord van les 3. Op dit bord
                  bouw je de curve, je knipt hem niet door.

                  Slepen blijft zichtbaar iets doen zonder die labels: de curve
                  beweegt, alle 96 stokjes veranderen van lengte, de drie
                  tellingen in het paneel lopen mee en de zekerheid erboven ook.
                  Dat is vier zichtbare gevolgen per sleep, allemaal gerekend.
                */}
              </>
            )}

            {toonBegin && beginCurve && <Beginnaam curve={beginCurve} scales={s} />}
          </>
        )}
      </Canvas>

      {/*
        De eerste alinea is het DOEL en blijft op elk formaat staan; Brief klapt
        alleen alles daarna in. Wie hier vanaf een slide binnenvalt, ziet het
        portaal nooit, dus staat het doel niet op het bord, dan staat het
        nergens.

        HET DOEL ZEGT WAT DIT BORD JE LAAT DOEN, en dat is nodig omdat er twee
        borden bij les 3 horen. Het zei eerder "logistische regressie maakt van
        elke rij een getal tussen 0 en 1", en dat is dezelfde bewering als op
        "Waar leg jij de grens?" ("het model geeft per rij een getal tussen 0 en
        1"). Twee borden, één zin: een leerling die alleen zit, weet dan niet
        welk bord hij open heeft. De taakverdeling: hier MAAK je de kans, op het
        andere bord KNIP je hem door. Vandaar dat de eerste woorden hier het
        bouwen noemen, en daar het slepen van de grens.

        `curve` en niet `lijn`: een lijn is in dit project recht (les 1 en 2),
        een curve is de S. `zelf` staat er om het verschil met het andere bord
        vast te houden: daar is het model al getraind.

        WAT ER NIET IN STAAT: de uitleg per stap. Onder 1280 px klapt alles na
        de eerste alinea weg, en op de beamervloer is dat precies waar een
        leerling zonder leerkracht zit. De uitleg staat daarom in het paneel
        eronder, dat nooit inklapt.

        EN DAAROM STAAT ER OOK GEEN OPDRACHT MEER IN. Er stond een derde alinea,
        "Volg de drie stappen in het paneel linksonder." - de enige zin die zei
        wat je eerst doet, en precies onder 1280 px staat die niet in de DOM.
        Ze is niet naar boven gehaald maar geschrapt, want ze zegt wat er al te
        zien is: het paneel opent met de drie stappen als genummerde lijst, met
        stap 1 gevuld en vet en de twee volgende grijs, daaronder de uitleg van
        stap 1 en de knop "Zet de curve erbij". Dat lijstje staat er op elk
        formaat, want het paneel klapt nooit in. Een zin die een zichtbare lijst
        navertelt, is geen instructie maar ruis - en hier stond ze bovendien op
        de beamer nergens.
      */}
      <Brief eyebrow="mAIstros 2 - les 3, oefening 1" title="Van getal naar kans">
        {/* EEN ZIN, en dat is gemeten: met een tweede zin erbij werd deze Brief
            164 px hoog en schoof hij 4 px over het paneel eronder. Wat je moet
            DOEN staat in dat paneel, in de stap die open staat, en dat paneel
            klapt nooit in.

            De eerste alinea is twee regels van samen 47,1 px, de tweede 45,5
            px. Alles hieronder is opnieuw gemeten NA het schrappen van de derde
            alinea, en per formaat, want onder 1280 px is de Brief 16rem breed
            en daarboven 22rem:

              onder 1280 px staat ze ingeklapt, dus met alleen de eerste alinea:
                140,1 px, exact zoals ervoor. Schrappen verandert daar niets,
                want die zin stond er toch al niet in de DOM. De ruimte tot het
                paneel eronder blijft 113,9 px op 1024x768, en op 900x700 45,9
                px in stap 1, 24,0 px in stap 2 en 7,9 px in stap 3. Geen
                overlap, op geen van de drie stappen.
              klapt een leerling ze op 900x700 zelf uit, dan is ze nu 216,4 px
                in plaats van 269,9 px, en legt ze in stap 1 30,4 px over het
                paneel in plaats van 83,9 px (dat tweede getal gerekend uit
                dezelfde twee gemeten hoogtes). Dat is dus geen 0 - en het was
                het ook nooit: de oude regel hier zei "0 px op 900x700", en dat
                gold voor de INGEKLAPTE stand, de enige die je daar zonder
                klikken krijgt.
              vanaf 1280 px staat ze uitgeklapt: 176,4 px met 47,5 px ruimte tot
                het paneel, tegen 207,1 px en 16,8 px met de geschrapte zin
                erbij. Op 1440x900 is die ruimte 227,5 px. */}
        <p>Jij bouwt zelf de curve die van een getal een kans maakt.</p>
        {/* "Die kans" en niet "Dat getal". De regel erboven noemt TWEE getallen -
            het getal dat erin gaat en de kans die eruit komt - dus "dat getal"
            wees naar het verkeerde van de twee. En het woord `antwoord` staat op
            de y-as van stap 1, dus een leerling die deze regel leest, ziet het
            woord op het bord staan. */}
        <p>Die kans hoort bij het antwoord Albert. Dit heet logistische regressie.</p>
      </Brief>

      {/*
        Eén paneel, en het staat er altijd - ook voordat er iets versleept is.
        Canvas meet elke .panel ernaast en houdt die breedte vrij, dus een
        paneel dat pas opduikt herkadert het bord midden in een beweging
        (gemeten: 1,45x op 1024 px). De inhoud wisselt wel per stap; dat
        verandert alleen de HOOGTE, en die meet Canvas niet.

        DE VOLGORDE IS VAST, en ze is gekozen op wat er als eerste wegvalt
        zodra de staart scrollt: eerst de drie stappen, dan de uitleg van de
        stap die open staat, dan de vaststelling, dan de knoppen. Alles wat
        daarna komt (de drie tellingen, de tabel, de twee regels over het
        notebook) is naslag. Zo staat er nooit een knop of een gerekend getal
        onder de rand, ook niet op 900x700.
      */}
      <Panel className="pointer-events-auto absolute bottom-4 left-4 z-10 max-h-[calc(100%-11.25rem)] w-[16rem] overflow-y-auto px-4 py-3 xl:max-h-[calc(100%-15.5rem)] xl:w-[21rem]">
        <Steps steps={STAPPEN} current={stap} onSelect={kiesStap} />

        <div className="mt-2 space-y-1 text-[13px] leading-snug text-ink/85">
          {stap === 0 && (
            <>
              {/* De codering van de les, in de woorden van de les: slide 2128358
                  doet het met eetbaar 1 en giftig 0. */}
              <p>De les maakt van het antwoord een getal: Albert wordt 1, Blahaj wordt 0.</p>
              <p>Elke rij staat op haar kleurwaarde g: de g uit (r,g,b).</p>
            </>
          )}
          {stap === 1 && (
            <>
              <p>De curve geeft elke rij een getal tussen 0 en 1: de kans op Albert.</p>
              <p>Een stokje is de fout van een rij: zoveel zit de curve ernaast.</p>
              {/* ÉÉN REGEL, en het bleef er één toen de tweede handvatnaam van
                  het bord ging. "De twee handvatten" zegt al dat er twee zijn,
                  en welke kant ze op gaan hoeft er niet bij: elk handvat is op
                  één as vastgezet en de curve verandert bij de eerste beweging,
                  dus de leerling weet het na één sleep. Twee extra regels hier
                  kostten 34 px, en dat was precies de ruimte waardoor de drie
                  tellingen op 900x700 onder de rand van het paneel zakten. */}
              <p>Sleep de twee handvatten tot de stokjes kort zijn.</p>
            </>
          )}
          {stap === 2 && (
            <>
              <p>De computer begint bij jouw curve en zoekt verder.</p>
              {/* "Kijk mee:" stond hiervoor, en het was twee regels waard voor
                  niets: de knop heet Trainen en de zekerheid staat eronder, dus
                  meekijken is niet iets wat een leerling moet worden gezegd. */}
              <p>De zekerheid zakt onderweg nooit.</p>
              {/*
                GEEN TELLING VAN DE JUISTE RIJEN, en dat is geen plaatsgebrek.
                Hoeveel rijen juist staan, hangt alleen van de PLEK van de curve
                af en niet van haar steilheid: gemeten 91 van de 96 voor elke
                steilheid van 1 tot 200, en 94 van de 96 bij een bijna vlakke
                curve. Een leerling die dat getal op het bord ziet, kan het dus
                hoger krijgen met een curve die duidelijk slechter past, en zou
                daarna zien dat de computer het "verlaagt". Zonder leerkracht is
                dat een tegenspraak die niemand oplost. Hoeveel rijen juist
                staan, is trouwens de vraag van het andere bord van deze les.
              */}
            </>
          )}
        </div>

        {/*
          ZEKERHEID is het meetkundig gemiddelde van de 96 kansen op hun eigen
          antwoord, en dat is geen willekeurige keuze: het is de enige maatstaf
          hier die niet te bespelen is. Vier voor de hand liggende alternatieven
          zijn alle vier gemeten en alle vier bespeelbaar - zie logistiek.ts.

          IN STAP 1 STAAT ER IETS ANDERS, want zonder curve is er geen kans en
          dus geen zekerheid. Dan staat er het getal dat stap 1 wél maakt: hoe
          veel rijen door elkaar lopen. Een leeg vak met een streepje leest als
          een bord dat stuk is.
        */}
        {heeftCurve ? (
          <Vaststelling
            label="Zekerheid"
            value={z * 100}
            decimals={1}
            unit="%"
            detail={
              getraind
                ? 'Waar je ook begint, de computer komt op deze curve uit.'
                : `De laagste kans op het bord is ${getal(laagste, 2)}.`
            }
          />
        ) : (
          /* Geen detailregel: de twee grenswaarden van de strook staan al als
             eerste en laatste rij in de tabel eronder, en de regel kostte 36 px
             die er op 1280x720 niet zijn. */
          <Vaststelling
            label="Rijen die door elkaar lopen"
            value={OVERLAP.length}
            outOf={{ total: RIJEN.length, noun: 'rijen' }}
            color={DERDE_INK}
          />
        )}

        {/* Elke knop verandert zichtbaar iets, of hij staat uit. De knop van de
            volgende stap staat er altijd: hij zet het volgende ding op het
            bord, en dat is precies de reden dat hij er staat. */}
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {stap === 0 && <Btn onClick={() => kiesStap(1)}>Zet de curve erbij</Btn>}
          {stap === 1 && <Btn onClick={() => kiesStap(2)}>Laat de computer zoeken</Btn>}
          {stap === 2 && (
            /* Trainen staat uit zodra er geen zichtbare stap meer te zetten is,
               en dat gebeurt echt: de top is vlak, dus een leerling die met de
               hand goed zoekt komt op dezelfde zekerheid als de computer. Dat
               is geen gebrek van het bord maar de vaststelling zelf - die gaat
               over wáár de zoektocht eindigt, niet over wie er wint. */
            <Btn onClick={train} disabled={zoekt || !teZoeken}>
              Trainen
            </Btn>
          )}
          {heeftCurve && (
            <Btn variant="ghost" onClick={() => zetCurve(START)} disabled={zoekt || opStart}>
              Zet terug
            </Btn>
          )}
        </div>

        <Divider />

        {/* De drie banden van de les, elk met zijn eigen vorm, zijn eigen woord
            en zijn eigen getal, dus geen ervan hangt aan kleur alleen. Dit
            lijstje is ook de LEGENDA van de drie merken op het bord: een volle
            stip, een open ring en een vierkantje. Daarom staat het er vanaf
            stap 2 altijd, en in stap 1 niet - daar is er geen curve, dus ook
            geen band, en zijn alle merken hetzelfde.

            De kop zegt 96, en het bord tekent 70 merken: dat verschil is de
            stapel op kleurwaarde g 0,0000, en die staat op het bord met zijn telling
            erbij. Zonder deze kop zou een leerling de merken kunnen tellen en
            uitkomen op iets anders dan waar de zekerheid over rekent. */}
        {heeftCurve && (
          <>
            <div className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-ink/75">
              {`De ${getal(RIJEN.length)} rijen`}
            </div>
            <ul className="mt-1 space-y-0.5">
              <Bandregel band="zekerJuist" woord="zeker en juist" aantal={b.zekerJuist} />
              <Bandregel band="twijfel" woord="niet zeker" aantal={b.twijfel} />
              <Bandregel band="zekerFout" woord="zeker en fout" aantal={b.zekerFout} />
            </ul>
          </>
        )}

        {/*
          DE TABEL: de tabel is het bestand, de grafiek is het plaatje van het
          bestand. Dit zijn exact de zes rijen uit de strook op het bord, en wie
          op een kleurwaarde g klikt, ziet welk merk erbij hoort.

          ZE STAAT IN STAP 1, want daar doet ze het werk: op het bord liggen de
          twee Blahaj op 0,2753 en 0,2756 anderhalve pixel van elkaar en tussen
          vier Alberts, en dat is de reden dat er een curve nodig is. In stap 2
          en 3 zou ze 162 px kosten die er niet zijn - gemeten - en dan zakt de
          uitleg van de stap zelf onder de rand van het paneel. Wat ze daar zou
          toevoegen, de kans per rij, staat er dan al als stokje op het bord.
        */}
        {!heeftCurve && (
          <>
            {/* "De rijen die door elkaar lopen" en niet "De rijen uit de strook".
                Het woord `strook` stond nergens anders op dit scherm, dus een
                leerling moest zelf raden welk stuk bord ermee bedoeld was. Op het
                bord zelf staat "hier lopen 6 rijen door elkaar" en de
                vaststelling erboven heet "Rijen die door elkaar lopen": dat is
                het woord dat deze zes rijen al hebben. */}
            <div className="mt-3 text-[11.5px] font-bold uppercase tracking-[0.09em] text-ink/75">
              De rijen die door elkaar lopen
            </div>
            <table className="mt-1 w-full text-[12.5px] tabular-nums">
              <thead>
                <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                  <th className="py-0.5 font-semibold">kleurwaarde g</th>
                  <th className="py-0.5 font-semibold">antwoord</th>
                </tr>
              </thead>
              <tbody>
                {OVERLAP.map((rij, i) => (
                  <Tabelrij
                    key={i}
                    rij={rij}
                    aangewezen={gekozen === i}
                    onKies={() => setGekozen(gekozen === i ? null : i)}
                  />
                ))}
              </tbody>
            </table>
          </>
        )}

        {/*
          De twee regels die het bord aan de les en aan het notebook knopen, en
          ze staan in stap 3 omdat het daar over trainen gaat. De slide waar dit
          bord op hoort te staan zegt alleen dat het model nu
          LogisticRegression() heet en legt niet uit wat dat doet.

          De tweede regel is er omdat het bord anders de les tegenspreekt: hier
          blijven er rijen over die niet passen, en in het notebook haalt het
          model bijna alles juist. Dat verschil is niet de curve maar het aantal
          kleurwaarden, en zonder leerkracht moet dat op het bord staan.

          ZE STAAN ONDERAAN, en dat is gemeten. Scrollt de staart van het paneel
          op een klein venster, dan verdwijnt eerst deze uitleg en daarna een
          tabelrij, nooit een knop en nooit de vaststelling.
        */}
        {stap === 2 && (
          <div className="mt-2 space-y-1 text-[11.5px] leading-relaxed text-muted">
            <p>
              In je notebook zoekt <PyChip>LogisticRegression()</PyChip> deze curve voor jou. De les
              noemt haar de logistische functie.
            </p>
            {/* Waarom dit bord met minder rijen juist eindigt dan het notebook:
                niet door de curve maar door het aantal kleurwaarden. Zonder
                deze regel spreekt het bord de les tegen, en er is niemand om
                dat uit te leggen. Ze staat hier en niet hogerop omdat er geen
                getal in staat: scrollt de staart van dit paneel weg op een kort
                venster, dan gaat er geen gerekend getal mee. */}
            <p>In je notebook gebruikt het model r, g en b samen. Dan passen er nog meer rijen.</p>
          </div>
        )}
      </Panel>
    </div>
  )
}

/* ------------------------------ merken ------------------------------ *
 * Vaste pixelmaten en geen wereldmaten: bij inzoomen moet een merk even groot
 * blijven, anders wordt een rij een vlek.                               */

const R = 5.5

/** Kleur, vorm en woord van de drie banden, op één plaats. Wie hier een kleur
 *  wijzigt, wijzigt ook de legenda in het paneel, en dat is de bedoeling. */
const BANDEN: Record<Band, { kleur: string; inkt: string }> = {
  zekerJuist: { kleur: DATA, inkt: NAVY },
  twijfel: { kleur: DERDE, inkt: DERDE_INK },
  zekerFout: { kleur: FOUT, inkt: FOUT_INK },
}

/** De rij waar de curve op dit moment het verst naast zit. Ties gaan naar de
 *  eerste, dus het is voor elke leerling dezelfde rij. */
function slechtsteRij(c: Curve): Rij {
  let uit = RIJEN[0]
  let laagste = 2
  for (const rij of RIJEN) {
    const p = kansOpEigenAntwoord(rij, c)
    if (p < laagste) {
      laagste = p
      uit = rij
    }
  }
  return uit
}

function Merk({
  rij,
  curve,
  scales,
  aangewezen,
}: {
  rij: Rij
  /** Null in stap 1: dan is er geen curve, dus ook geen band en geen kans. */
  curve: Curve | null
  scales: Scales
  aangewezen: boolean
}) {
  const band = curve ? bandVan(rij, curve) : null
  const kleur = band ? BANDEN[band].kleur : DATA
  const cx = scales.sx(rij.groen)
  const cy = scales.sy(rij.albert ? 1 : 0)
  return (
    <g pointerEvents="none">
      {aangewezen && (
        <circle cx={cx} cy={cy} r={R + 8} fill="none" stroke={kleur} strokeWidth={2.5} />
      )}
      {(band === null || band === 'zekerJuist') && <circle cx={cx} cy={cy} r={R} fill={kleur} />}
      {/* Twijfel is een open ring: van achter in de klas leesbaar als "niet
          vol", ook voor wie het kleurverschil niet ziet. */}
      {band === 'twijfel' && (
        <circle cx={cx} cy={cy} r={R} fill="#fff" stroke={kleur} strokeWidth={2.5} />
      )}
      {band === 'zekerFout' && (
        <rect
          x={cx - R}
          y={cy - R}
          width={R * 2}
          height={R * 2}
          rx={1}
          fill={kleur}
          stroke="#fff"
          strokeWidth={1.5}
        />
      )}
      <title>
        {curve
          ? `kleurwaarde g ${getal(rij.groen, 4)}, ${rij.albert ? 'Albert' : 'Blahaj'} - de curve geeft deze rij ${getal(kansOpEigenAntwoord(rij, curve), 2)} kans op haar eigen antwoord`
          : `kleurwaarde g ${getal(rij.groen, 4)}, ${rij.albert ? 'Albert' : 'Blahaj'}`}
      </title>
    </g>
  )
}

/**
 * Van elke rij een stokje naar de curve. De lengte is hoever het model bij die
 * rij vandaan zit, en het is exact het plaatje van "Teken de lijn" uit les 1 -
 * zelfde kleur, zelfde breedte, zelfde doorzichtigheid. Residuals uit Canvas
 * kon niet hergebruikt worden: dat rekent met een rechte `Line`, en dit is een
 * curve.
 */
function Stokjes({ curve, scales: s }: { curve: Curve; scales: Scales }) {
  return (
    <g pointerEvents="none">
      {RIJEN.map((rij, i) => (
        <line
          key={i}
          x1={s.sx(rij.groen)}
          y1={s.sy(rij.albert ? 1 : 0)}
          x2={s.sx(rij.groen)}
          y2={s.sy(kansOpAlbert(rij.groen, curve))}
          stroke={FOUT}
          strokeWidth={1.25}
          opacity={0.45}
        />
      ))}
    </g>
  )
}

/**
 * HOE BREED DE STIPPELLIJN VAN DE BEGINSTAND WORDT GETEKEND.
 *
 * Ze liep eerst van rand tot rand, en dat was het probleem: de startcurve is
 * bewust flauw (steilheid 3), dus over de 0,92 kleurwaarde g die in beeld staat klimt
 * ze van kans 0,25 naar 0,76 in een bijna rechte schuine streep. Naast de
 * getrainde S leest zo'n streep als een TWEEDE model, en op het bord van les 1
 * en les 2 is een rechte lijn ook echt een model. Ze wordt daarom een stukje:
 * een kort stuk curve rond haar eigen 0,50, want dat is precies waar "hier
 * begon jij" boven hangt en het enige dat deze stippellijn hoeft te zeggen.
 *
 * De halve breedte is het kleinste van twee dingen. Het stuk tussen de twee
 * grenzen van de les (kans 0,20 tot 0,80, dus ln(4)/steilheid), zodat een
 * steile beginstand een smal stukje krijgt en niet een streep. En 0,09
 * kleurwaarde g, zodat een flauwe beginstand niet alsnog het halve bord vult.
 * Een ondergrens hoort er ook bij, anders wordt een zeer steile beginstand een
 * punt.
 */
const BEGIN_HALF_MAX = 0.09
const BEGIN_HALF_MIN = 0.035

/** De curve zelf, over de hele zichtbare breedte van het bord. `begin` tekent
 *  de curve waar de leerling de zoektocht mee begon: gestippeld, in de
 *  bijschriftkleur en als kort stukje, dus ze kan nooit voor de curve van nu
 *  doorgaan. */
function Kromme({
  curve,
  scales: s,
  begin = false,
}: {
  curve: Curve
  scales: Scales
  begin?: boolean
}) {
  let x0 = s.view.x0
  let x1 = s.view.x1
  if (begin) {
    const half = Math.min(
      BEGIN_HALF_MAX,
      Math.max(BEGIN_HALF_MIN, Math.log(4) / Math.max(curve.k, 1e-6)),
    )
    x0 = Math.max(x0, curve.m - half)
    x1 = Math.min(x1, curve.m + half)
    if (x1 <= x0) return null
  }
  // Eén punt per twee pixels. Bij de steilste stand die een handvat kan halen
  // stijgt de S van kans 0,01 naar 0,99 over 86 px, dus staan daar nog 43
  // punten in: rond genoeg, en het kost niets.
  const n = Math.max(60, Math.round(s.area.w / 2))
  const d = Array.from({ length: n + 1 }, (_, i) => {
    const x = x0 + ((x1 - x0) * i) / n
    return `${i === 0 ? 'M' : 'L'}${s.sx(x).toFixed(1)},${s.sy(kansOpAlbert(x, curve)).toFixed(1)}`
  }).join(' ')
  return (
    <path
      d={d}
      fill="none"
      stroke={begin ? MUTED : MODEL}
      strokeWidth={begin ? 1.75 : 2.5}
      strokeDasharray={begin ? '6 6' : undefined}
      strokeLinecap="round"
      pointerEvents="none"
    />
  )
}

/* ---------------------------- bordteksten --------------------------- *
 * Alles op het bord is minstens 13 px, vet, en met een witte rand eromheen,
 * zodat het over een rasterlijn, een stokje of een merk heen leesbaar blijft. */

const HALO = { stroke: '#fff', strokeWidth: 3.5, paintOrder: 'stroke' } as const

/**
 * DE STROOK waar Albert en Blahaj door elkaar lopen, met haar telling erboven.
 *
 * Dit is het enige wat in stap 1 iets uitlegt, en het legt het belangrijkste
 * uit: links ervan is alles Blahaj, rechts alles Albert, en binnen deze zes
 * rijen kan geen enkele curve het goed krijgen. Zonder de strook is stap 1 een
 * bord met 70 stippen en geen vraag.
 *
 * De tekst staat BOVENAAN in het vrije vlak, niet in de strook: de strook is op
 * 1024 px 42 px breed en de tekst is 150 px, dus binnen de strook zou ze er aan
 * beide kanten uit lopen. En ze wijkt naar de kant waar ze past, in plaats van
 * te verdwijnen, want een leerling die inzoomt op de strook heeft die tekst
 * juist dan nodig.
 */
function Strook({ scales: s }: { scales: Scales }) {
  const x1 = s.sx(OVERLAP_VAN)
  const x2 = s.sx(OVERLAP_TOT)
  if (x2 < s.area.left || x1 > s.area.right) return null
  const midden = (x1 + x2) / 2
  const anker = midden < s.safe.left + 80 ? 'start' : midden > s.safe.right - 80 ? 'end' : 'middle'
  const tx = anker === 'start' ? s.safe.left + 8 : anker === 'end' ? s.safe.right - 8 : midden
  return (
    <g pointerEvents="none">
      <rect
        x={x1}
        y={s.area.top}
        width={Math.max(2, x2 - x1)}
        height={s.area.h}
        fill={DERDE}
        opacity={0.09}
      />
      <line x1={x1} y1={s.area.top} x2={x1} y2={s.area.bottom} stroke={DERDE} strokeWidth={1.25} strokeDasharray="4 4" />
      <line x1={x2} y1={s.area.top} x2={x2} y2={s.area.bottom} stroke={DERDE} strokeWidth={1.25} strokeDasharray="4 4" />
      <text
        x={tx}
        y={s.safe.top + 14}
        textAnchor={anker}
        fontSize={13}
        fontWeight={700}
        fill={DERDE_INK}
        {...HALO}
      >
        {`hier lopen ${getal(OVERLAP.length)} rijen door elkaar`}
      </text>
    </g>
  )
}

/**
 * Een van de twee grenzen van de les (slide 2128364), als streepjeslijn.
 *
 * ZONDER NAAM, en dat is de bewuste keuze van deze ronde. De lijn is de
 * zichtbare oorzaak van de drie vormen op het bord - volle stip, open ring,
 * vierkantje - en die vormen worden in het paneel geteld met hun woord erbij.
 * De namen die hier stonden ("zeker Albert vanaf 0,80", "zeker Blahaj tot
 * 0,20") legden uit hoe je een grens leest, en dat is de vraag van het andere
 * bord van les 3. Ze stonden dus in elke stap in beeld zonder er in één ervan
 * werk te doen.
 *
 * De twee getallen staan daarna op de Y-AS en niet in het paneel. Het paneel
 * noemt geen enkele grens: daar staan de drie vormen met hun woord en hun
 * telling, en verder niets. Dus wie het getal van een streepjeslijn wil, leest
 * het van de as, en NERGENS ANDERS. Als een commentaar hier ooit beweert dat de
 * grenzen "in het paneel, bij de legenda" staan, is dat commentaar fout en niet
 * de code: er is geen legendaregel met 0,20 of 0,80 in.
 *
 * HERMETEN op 2026-09-09, in de openingsstand, met canvas measureText door
 * getScreenCTM: de lijnen liggen op y 196,6 en 549,4 en het midden van de
 * asgetallen "0,8" en "0,2" op 196,9 en 549,8, dus 0,3 px ernaast. Op 900x700
 * de lijnen op 179,8 en 498,2 tegen asgetallen op 180,2 en 498,5. Op beide
 * beamerformaten staat de tikstap op 0,1 of 0,2, dus 0,2 en 0,8 zijn er echt.
 *
 * EEN PRIJS DIE ERBIJ HOORT: zoomt een leerling drie keer uit, dan wordt de
 * tikstap 0,5 en staan alleen 0,0, 0,5, 1,0 en 1,5 langs de as - gemeten. De
 * twee lijnen blijven dan staan zonder getal ernaast. "Alles" zet het beeld
 * terug en de getallen komen mee. Dat is de prijs van het budget van vier
 * bijschriften, en een vijfde bijschrift is ze niet waard.
 */
function Bandlijn({ kans, scales: s }: { kans: number; scales: Scales }) {
  const y = s.sy(kans)
  return (
    <line
      x1={s.area.left}
      y1={y}
      x2={s.area.right}
      y2={y}
      stroke={MUTED}
      strokeWidth={1.25}
      strokeDasharray="5 5"
      opacity={0.75}
      pointerEvents="none"
    />
  )
}

/**
 * Van waar tot waar de merken van één rij op de x-as liggen. Geteld uit de
 * data, want welk uiteinde van een rij leeg is, is een eigenschap van het
 * bestand en niet van het ontwerp: Albert loopt van 0,2178 tot 0,7910 en heeft
 * dus links ruimte over, Blahaj van 0 tot 0,2756 en dus rechts.
 */
const BEREIK = (() => {
  const uit = (albert: boolean) => {
    const g = RIJEN.filter((r) => r.albert === albert).map((r) => r.groen)
    return { eerste: Math.min(...g), laatste: Math.max(...g) }
  }
  return { albert: uit(true), blahaj: uit(false) }
})()

/**
 * Welke rij welke is. Zonder deze twee regels moet een leerling de klasse uit
 * de hoogte raden, en dan draagt de y-as betekenis die nergens staat.
 */
function Rijnamen({ kort, scales: s }: { kort: boolean; scales: Scales }) {
  return (
    <g pointerEvents="none">
      <Rijnaam albert kort={kort} scales={s} />
      <Rijnaam albert={false} kort={kort} scales={s} />
    </g>
  )
}

/**
 * EEN REGEL VOOR BEIDE NAMEN: de naam staat 14 px boven zijn eigen rij, aan het
 * uiteinde waar die rij geen merken heeft. Welk uiteinde dat is, wordt in
 * pixels van dit moment geteld, dus de keuze blijft kloppen als een leerling
 * pant of zoomt.
 *
 * WAAROM DE NAAM VAN BLAHAJ NIET MEER ONDER ZIJN RIJ STAAT. Daar staan de
 * asgetallen. Gemeten met getBBox door getScreenCTM, op de standaardstand:
 * het emvak van "Blahaj, antwoord 0 (44 rijen)" liep op 1024x768 7,3 bij 4,1 px
 * door dat van de "0" langs de onderrand en 0,9 bij 4,1 px door dat van "0,2",
 * en op 900x700 7,3 bij 9,3 px en 17,7 bij 9,3 px - daar raken de glyphs zelf
 * elkaar, 6,3 bij 4,3 px en 16,7 bij 4,3 px inkt.
 *
 * Optillen lost dat niet op, het verplaatst het alleen: op 900x700 is de band
 * tussen de "0" langs de linkerrand en de asgetallen onderaan 16,7 px, en het
 * emvak van de naam is 17,5 px hoog. Hij raakt boven dus wat hij onder
 * loslaat, en 5 px hoger zit hij bovendien op zijn eigen merken en op de naam
 * van de stapel, die 16 px boven datzelfde merk hangt.
 *
 * Er moest dus ruimte bij, en die is er naast de rij zelf. Gemeten van de rand
 * van het vrije vlak tot het eerste of laatste merk van die rij, met een naam
 * van 171 px ernaast gelegd:
 *
 *   Blahaj loopt tot kleurwaarde g 0,2756 en houdt RECHTS 420,5 px vrij op 1024x768 en
 *     341,7 px op 900x700;
 *   Albert loopt vanaf 0,2178 en houdt LINKS 199,9 px vrij op 1024x768 en
 *     162,5 px op 900x700, dus die naam blijft staan waar hij stond.
 *
 * Dat Albert op 900x700 8,5 px korter komt dan zijn eigen naam breed is, geeft
 * niets: de naam hangt boven de rij en niet ernaast, dus hij houdt daar 5,6 px
 * inkt over zijn eigen merken en raakt ze nooit. Het vrije uiteinde bepaalt
 * alleen aan welke kant de naam bij zijn rij hoort, en houdt hem weg van het
 * dichtste stuk ervan.
 *
 * VANAF STAP 2 KORT. Deze twee namen zijn de leessleutel van de y-as en horen
 * dus in elke stap op het bord. Maar hun werk in stap 1 is de CODERING
 * uitleggen, en dat is één keer nodig; de telling erbij (52 en 44) is naslag
 * die het paneel al met 96 dekt. Kort blijft de codering staan - "Albert is 1"
 * en "Blahaj is 0" - en dat is 171 px die 65 px wordt, precies in de hoek waar
 * in stap 2 de stokjes en de handvatnaam bij komen. Het is een inkorting en
 * geen ander woord: Albert blijft Albert en 1 blijft 1.
 */
function Rijnaam({
  albert,
  kort,
  scales: s,
}: {
  albert: boolean
  kort: boolean
  scales: Scales
}) {
  const { eerste, laatste } = albert ? BEREIK.albert : BEREIK.blahaj
  const naarLinks = s.sx(eerste) - s.safe.left >= s.safe.right - s.sx(laatste)
  return (
    <text
      x={naarLinks ? s.safe.left + 8 : s.safe.right - 14}
      y={s.sy(albert ? 1 : 0) - 14}
      textAnchor={naarLinks ? 'start' : 'end'}
      fontSize={13.5}
      fontWeight={700}
      fill={INK}
      {...HALO}
    >
      {kort
        ? albert
          ? 'Albert is 1'
          : 'Blahaj is 0'
        : albert
          ? `Albert, antwoord 1 (${getal(AANTAL_ALBERT)} rijen)`
          : `Blahaj, antwoord 0 (${getal(AANTAL_BLAHAJ)} rijen)`}
    </text>
  )
}

/**
 * DE STAPEL. 27 van de 96 rijen hebben kleurwaarde g 0,0000 en vallen dus op één
 * merk. Zonder dit label tekent het bord 70 merken terwijl het paneel over 96
 * rijen rekent, en dat is precies het soort stille tegenspraak dat een leerling
 * ziet zonder het te kunnen benoemen. Niet op te lossen met een spatje toeval
 * en niet door ze op te stapelen: de hoogte draagt het antwoord.
 *
 * Het label staat BOVEN zijn eigen merk en niet ernaast. Ernaast lag het op zes
 * andere merken: op 1024 px staan de rijen 0,0095 tot 0,1013 binnen 73 px van
 * kleurwaarde g 0, en de tekst is 72 px breed. Boven het merk loopt alleen zijn eigen
 * stokje, en dat is precies het merk waar het label bij hoort.
 *
 * En het WIJKT, net als de namen van de handvatten hieronder, in plaats van te
 * verdwijnen. Gemeten: gecentreerd op zijn merk viel dit label op 900x700 weg,
 * want daar staat de stapel op x = 371 px en begint het vrije vlak op 336 - 5 px
 * te weinig voor de oude grens van 40. Precies op de beamervloer tekende het
 * bord dan 70 merken zonder ergens te zeggen dat er 27 op elkaar liggen. Nu
 * hangt de tekst rechts van zijn merk zodra ze links niet meer past, en links
 * ervan aan de andere rand.
 *
 * IN ELKE STAP, en dat is gemeten en niet gevoeld. De verleiding was om dit
 * label ook op te ruimen en het getal in het paneel te zetten, onder de legenda
 * die over 96 rijen rekent. Op 1024x768 kon dat; op 900x700 is het paneel maar
 * 518 px hoog en viel die regel er 14 px onder, dus stond het getal daar nergens
 * meer. Het label kost hier 8 tekens naast zijn eigen merk en past ruim binnen
 * het budget van vier, dus blijft het staan waar het naar wijst.
 */
function Stapelnaam({ curve, scales: s }: { curve: Curve | null; scales: Scales }) {
  const cx = s.sx(STAPEL.groen)
  // Buiten het vrije vlak is er geen merk om bij te horen; daarbinnen wijkt de
  // tekst naar de kant waar ze wel past.
  if (cx < s.safe.left - 4 || cx > s.safe.right + 4) return null
  const anker = cx < s.safe.left + 40 ? 'start' : cx > s.safe.right - 40 ? 'end' : 'middle'
  const rij: Rij = { groen: STAPEL.groen, albert: false }
  return (
    <text
      x={cx}
      y={s.sy(0) - 16}
      textAnchor={anker}
      fontSize={13}
      fontWeight={700}
      fill={curve ? BANDEN[bandVan(rij, curve)].inkt : NAVY}
      pointerEvents="none"
      {...HALO}
    >
      {`${getal(STAPEL.aantal)} rijen`}
    </text>
  )
}

/**
 * WAT EEN STOKJE IS, gezegd bij het langste stokje van dit moment.
 *
 * Het staat bij de slechtste rij en niet bij een vaste, want daar is het stokje
 * altijd lang genoeg om de tekst naast te zetten. Het verspringt als je sleept,
 * en dat hoort: dan wijst het aan waar de curve nu het verst naast zit. De
 * tekst hangt aan het midden van het stokje en wijkt naar de kant waar ze past.
 */
function Foutnaam({ rij, curve, scales: s }: { rij: Rij; curve: Curve; scales: Scales }) {
  const cx = s.sx(rij.groen)
  if (cx < s.safe.left - 4 || cx > s.safe.right + 4) return null
  const y1 = s.sy(rij.albert ? 1 : 0)
  const y2 = s.sy(kansOpAlbert(rij.groen, curve))
  // Onder ongeveer 30 px is er geen stokje om iets bij te zetten, en dan zou de
  // tekst tussen de merken hangen zonder ergens bij te horen.
  if (Math.abs(y1 - y2) < 30) return null
  const rechts = s.safe.right - (cx + 12) > 170
  return (
    <text
      x={rechts ? cx + 12 : cx - 12}
      y={(y1 + y2) / 2}
      textAnchor={rechts ? 'start' : 'end'}
      dominantBaseline="middle"
      fontSize={13}
      fontWeight={700}
      fill={FOUT_INK}
      pointerEvents="none"
      {...HALO}
    >
      de fout van deze rij
    </text>
  )
}

/**
 * WAAR DE LEERLING BEGON. De stippellijn is de curve waarmee de zoektocht
 * startte, en deze tekst zegt dat het die van de leerling was.
 *
 * Dit is het antwoord op "begint de computer bij mijn curve of bij de zijne?".
 * Het staat er als plaatje en niet als zin, want een zin in het paneel
 * verdwijnt tussen de andere zinnen.
 */
function Beginnaam({ curve, scales: s }: { curve: Curve; scales: Scales }) {
  const cx = s.sx(curve.m)
  if (cx < s.safe.left - 4 || cx > s.safe.right + 4) return null
  const anker = cx < s.safe.left + 60 ? 'start' : cx > s.safe.right - 60 ? 'end' : 'middle'
  const tx = anker === 'start' ? s.safe.left + 8 : anker === 'end' ? s.safe.right - 8 : cx
  return (
    <text
      x={tx}
      y={s.sy(0.5) - 16}
      textAnchor={anker}
      fontSize={13}
      fontWeight={700}
      fill={MUTED}
      pointerEvents="none"
      {...HALO}
    >
      hier begon jij
    </text>
  )
}

/* ----------------------------- het paneel --------------------------- */

/** Eén band: zijn eigen vorm, zijn eigen kleur, zijn eigen woord, zijn eigen
 *  getal. Het blokje is exact het merk dat op het bord staat, want anders gaat
 *  een leerling iets anders zoeken dan er ligt. */
function Bandregel({ band, woord, aantal }: { band: Band; woord: string; aantal: number }) {
  const { kleur } = BANDEN[band]
  return (
    <li className="flex items-center gap-2 text-[13px] text-ink/85">
      <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden="true" className="shrink-0">
        {band === 'zekerJuist' && <circle cx={8} cy={8} r={5.5} fill={kleur} />}
        {band === 'twijfel' && (
          <circle cx={8} cy={8} r={5} fill="#fff" stroke={kleur} strokeWidth={2.5} />
        )}
        {band === 'zekerFout' && <rect x={2.5} y={2.5} width={11} height={11} rx={1} fill={kleur} />}
      </svg>
      <span className="tabular-nums font-semibold" style={{ minWidth: '1.6em' }}>
        {getal(aantal)}
      </span>
      <span>{woord}</span>
    </li>
  )
}

/** Eén rij van de tabel: haar kleurwaarde g en haar echte antwoord. Een knop en
 *  geen sleepbaar merk, dus er is hier geen verwarring tussen klikken en
 *  slepen mogelijk. */
function Tabelrij({
  rij,
  aangewezen,
  onKies,
}: {
  rij: Rij
  aangewezen: boolean
  onKies: () => void
}) {
  return (
    <tr className={aangewezen ? 'bg-model/10' : undefined}>
      <td className="py-px">
        <button
          type="button"
          onClick={onKies}
          className="text-left tabular-nums underline decoration-dotted underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-model/35"
          aria-pressed={aangewezen}
        >
          {getal(rij.groen, 4)}
        </button>
      </td>
      <td className="py-px">{rij.albert ? 'Albert' : 'Blahaj'}</td>
    </tr>
  )
}
