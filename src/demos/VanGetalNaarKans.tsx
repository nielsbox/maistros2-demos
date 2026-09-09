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
 *           handvatten, en een naam bij het langste stokje: de fout.
 *   stap 3  Trainen. De eigen curve blijft als stippellijn staan, met "hier
 *           begon jij" erbij, zodat het zoeken zichtbaar bij de leerling begint.
 *
 * Elke stap is één klik vooruit, en een gezette stap blijft aanklikbaar. Er
 * wordt niets afgeschermd: de knop van de volgende stap staat er altijd en
 * doet altijd iets.
 *
 * WAT ER OP HET BORD STAAT, en waarom precies dit.
 *
 *   de x-as   de groenwaarde van één rij. Eén kenmerk, want alleen dan is de
 *             S-curve te tekenen. Wat dat kost staat in stap 3 op het bord: de
 *             les gebruikt r, g en b samen en haalt daarmee bijna alles juist,
 *             met alleen groen blijven er rijen over die niet passen.
 *   de y-as   het antwoord, gecodeerd zoals de les het codeert (slide
 *             2128358): Albert is 1 en staat bovenaan, Blahaj is 0 en staat
 *             onderaan. Vanaf stap 2 is dezelfde as ook de kans, en dat is
 *             precies het punt: de curve loopt van het ene antwoord naar het
 *             andere. De asnaam zegt daarom in stap 1 iets anders dan later.
 *   de curve  op elke groenwaarde geeft ze de kans op Albert.
 *   twee
 *   streepjes de grenzen 0,20 en 0,80. Niet van dit bord maar van de les zelf
 *             (slide 2128364).
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
 * DE WOORDEN, en waar ze vandaan komen. Geteld over alle 77 slides van les 3:
 *
 *   `kleurwaarde`  36 keer, `groen` NUL keer. Vandaar dat stap 1 de x-as één
 *                  keer uitlegt als "de g van (r,g,b)": zo heet het op slide
 *                  2127647. Daarna heet het overal `groenwaarde`, één woord.
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
 * plotvlak. Met dit venster wordt dat 719,6 px per eenheid groen en 588,1 px
 * per eenheid kans, en dan:
 *
 *   de S stijgt van kans 0,01 naar 0,99 over 0,2649 groen = 191 px, dus ze
 *     leest als een curve en nooit als een trap;
 *   de stapel op groen 0,0000 staat op x = 379 px, 54 px vrij van het paneel
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

  /** Twee rijen zijn dezelfde rij als groenwaarde en antwoord kloppen. In de
   *  strook is elke groenwaarde uniek - de enige dubbele groep in het bestand
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
    beginCurve !== null &&
    (Math.abs(beginCurve.m - curve.m) > 0.004 ||
      Math.abs(kansVanHandvat(beginCurve) - hoogte) > 0.01)

  return (
    <div className="relative h-full w-full">
      <Canvas
        defaultView={DEFAULT_VIEW}
        xLabel="groenwaarde van de rij"
        /* In stap 1 staat er nog geen curve, dus is deze as alleen het
           antwoord. Een as die dan al "kans" heet, belooft iets wat er niet
           staat. */
        yLabel={heeftCurve ? 'kans op Albert' : 'het antwoord: 1 of 0'}
      >
        {(s) => (
          <>
            {/* De strook staat er in elke stap, want ze is de reden dat dit
                bord bestaat. Onderaan de tekenlaag, zodat elk merk erover ligt. */}
            <Strook scales={s} />

            {heeftCurve && (
              <>
                {/* De grenzen van de les: 0,20 en 0,80. */}
                <Bandlijn kans={BAND_HOOG} woorden="zeker Albert vanaf" scales={s} />
                <Bandlijn kans={BAND_LAAG} woorden="zeker Blahaj tot" scales={s} />
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

            <Stapelnaam curve={heeftCurve ? curve : null} scales={s} />
            <Rijnamen scales={s} />

            {heeftCurve && (
              <>
                {/* Wat een stokje IS, bij het langste stokje van het moment.
                    Zonder deze naam staan er 96 oranje streepjes op het bord
                    die niets zeggen. */}
                <Foutnaam rij={slechtste} curve={curve} scales={s} />

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

                <Handvatnamen curve={curve} hoogte={hoogte} scales={s} />
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

        Het doel zegt nu wat de LES zegt: logistische regressie maakt van elke
        rij een getal tussen 0 en 1. De vorige versie opende met "deze curve
        zet de groenwaarde om in een kans", en dat zijn drie woorden die in les
        3 geen van de drie voorkomen.

        WAT ER NIET IN STAAT: de uitleg per stap. Onder 1280 px klapt alles na
        de eerste alinea weg, en op de beamervloer is dat precies waar een
        leerling zonder leerkracht zit. De uitleg staat daarom in het paneel
        eronder, dat nooit inklapt.
      */}
      <Brief eyebrow="mAIstros 2 - les 3, oefening 1" title="Van getal naar kans">
        {/* EEN ZIN, en dat is gemeten: met een tweede zin erbij werd deze Brief
            164 px hoog en schoof hij 4 px over het paneel eronder. Wat je moet
            DOEN staat in dat paneel, in de stap die open staat, en dat paneel
            klapt nooit in. */}
        <p>Logistische regressie maakt van elke rij een getal tussen 0 en 1.</p>
        <p>Dat getal is de kans dat de rij bij Albert hoort. Hier maak je die kans zelf.</p>
        <p>Volg de drie stappen in het paneel linksonder.</p>
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
              <p>Elke rij staat op haar groenwaarde: de g van (r,g,b).</p>
            </>
          )}
          {stap === 1 && (
            <>
              <p>De curve geeft elke rij een getal tussen 0 en 1: de kans op Albert.</p>
              <p>Een stokje is de fout van een rij: zoveel zit de curve ernaast.</p>
              <p>Sleep de twee handvatten tot de stokjes kort zijn.</p>
            </>
          )}
          {stap === 2 && (
            <>
              <p>De computer begint bij jouw curve en zoekt verder.</p>
              <p>Kijk mee: de zekerheid zakt onderweg nooit.</p>
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
          {stap === 1 && <Btn onClick={() => kiesStap(2)}>Nu de computer</Btn>}
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
            stapel op groen 0,0000, en die staat op het bord met zijn telling
            erbij. Zonder deze kop zou een leerling de merken kunnen tellen en
            uitkomen op iets anders dan waar de zekerheid over rekent. */}
        {heeftCurve && (
          <>
            <div className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-ink/75">
              {`De ${getal(RIJEN.length)} rijen`}
            </div>
            <ul className="mt-1 space-y-0.5">
              <Bandregel band="zekerJuist" woord="zeker en juist" aantal={b.zekerJuist} />
              <Bandregel band="twijfel" woord="twijfel" aantal={b.twijfel} />
              <Bandregel band="zekerFout" woord="zeker en fout" aantal={b.zekerFout} />
            </ul>
          </>
        )}

        {/*
          DE TABEL: de tabel is het bestand, de grafiek is het plaatje van het
          bestand. Dit zijn exact de zes rijen uit de strook op het bord, en wie
          op een groenwaarde klikt, ziet welk merk erbij hoort.

          ZE STAAT IN STAP 1, want daar doet ze het werk: op het bord liggen de
          twee Blahaj op 0,2753 en 0,2756 anderhalve pixel van elkaar en tussen
          vier Alberts, en dat is de reden dat er een curve nodig is. In stap 2
          en 3 zou ze 162 px kosten die er niet zijn - gemeten - en dan zakt de
          uitleg van de stap zelf onder de rand van het paneel. Wat ze daar zou
          toevoegen, de kans per rij, staat er dan al als stokje op het bord.
        */}
        {!heeftCurve && (
          <>
            <div className="mt-3 text-[11.5px] font-bold uppercase tracking-[0.09em] text-ink/75">
              De rijen uit de strook
            </div>
            <table className="mt-1 w-full text-[12.5px] tabular-nums">
              <thead>
                <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                  <th className="py-0.5 font-semibold">groen</th>
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
          <div className="mt-2.5 space-y-1.5 text-[11.5px] leading-relaxed text-muted">
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
          ? `groen ${getal(rij.groen, 4)}, ${rij.albert ? 'Albert' : 'Blahaj'} - de curve geeft deze rij ${getal(kansOpEigenAntwoord(rij, curve), 2)} kans op haar eigen antwoord`
          : `groen ${getal(rij.groen, 4)}, ${rij.albert ? 'Albert' : 'Blahaj'}`}
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

/** De curve zelf, over de hele zichtbare breedte van het bord. `begin` tekent
 *  de curve waar de leerling de zoektocht mee begon: gestippeld, in de
 *  bijschriftkleur, dus ze kan nooit voor de curve van nu doorgaan. */
function Kromme({
  curve,
  scales: s,
  begin = false,
}: {
  curve: Curve
  scales: Scales
  begin?: boolean
}) {
  const { x0, x1 } = s.view
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
 * Een van de twee grenzen van de les, met zijn woorden erbij.
 *
 * Het getal in het label komt uit BAND_HOOG en BAND_LAAG en staat niet in de
 * tekst. Dat is geen kleinigheid: die twee grenzen zijn van de les (slide
 * 2128364), en zodra ze in het label ook nog eens ingetypt staan, kan het bord
 * iets anders tellen dan het zegt.
 */
function Bandlijn({
  kans,
  woorden,
  scales: s,
}: {
  kans: number
  woorden: string
  scales: Scales
}) {
  const y = s.sy(kans)
  return (
    <g pointerEvents="none">
      <line
        x1={s.area.left}
        y1={y}
        x2={s.area.right}
        y2={y}
        stroke={MUTED}
        strokeWidth={1.25}
        strokeDasharray="5 5"
        opacity={0.75}
      />
      <text
        x={s.safe.right - 14}
        y={y - 7}
        textAnchor="end"
        fontSize={13}
        fontWeight={700}
        fill={MUTED}
        {...HALO}
      >
        {`${woorden} ${getal(kans, 2)}`}
      </text>
    </g>
  )
}

/**
 * Welke rij welke is. Zonder deze twee regels moet een leerling de klasse uit
 * de hoogte raden, en dan draagt de y-as betekenis die nergens staat.
 */
function Rijnamen({ scales: s }: { scales: Scales }) {
  return (
    <g pointerEvents="none">
      <text
        x={s.safe.left + 8}
        y={s.sy(1) - 14}
        fontSize={13.5}
        fontWeight={700}
        fill={INK}
        {...HALO}
      >
        {`Albert, antwoord 1 (${getal(AANTAL_ALBERT)} rijen)`}
      </text>
      <text
        x={s.safe.left + 8}
        y={s.sy(0) + 30}
        fontSize={13.5}
        fontWeight={700}
        fill={INK}
        {...HALO}
      >
        {`Blahaj, antwoord 0 (${getal(AANTAL_BLAHAJ)} rijen)`}
      </text>
    </g>
  )
}

/**
 * DE STAPEL. 27 van de 96 rijen hebben groenwaarde 0,0000 en vallen dus op één
 * merk. Zonder dit label tekent het bord 70 merken terwijl het paneel over 96
 * rijen rekent, en dat is precies het soort stille tegenspraak dat een leerling
 * ziet zonder het te kunnen benoemen. Niet op te lossen met een spatje toeval
 * en niet door ze op te stapelen: de hoogte draagt het antwoord.
 *
 * Het label staat BOVEN zijn eigen merk en niet ernaast. Ernaast lag het op zes
 * andere merken: op 1024 px staan de rijen 0,0095 tot 0,1013 binnen 73 px van
 * groen 0, en de tekst is 72 px breed. Boven het merk loopt alleen zijn eigen
 * stokje, en dat is precies het merk waar het label bij hoort.
 *
 * En het WIJKT, net als de namen van de handvatten hieronder, in plaats van te
 * verdwijnen. Gemeten: gecentreerd op zijn merk viel dit label op 900x700 weg,
 * want daar staat de stapel op x = 371 px en begint het vrije vlak op 336 - 5 px
 * te weinig voor de oude grens van 40. Precies op de beamervloer tekende het
 * bord dan 70 merken zonder ergens te zeggen dat er 27 op elkaar liggen. Nu
 * hangt de tekst rechts van zijn merk zodra ze links niet meer past, en links
 * ervan aan de andere rand.
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

/**
 * Wat de twee handvatten NU zeggen. Geen opdracht - dat staat in het paneel -
 * maar de stand zelf, en die is uit de curve gerekend.
 *
 * Het eerste handvat leest als de plek waar de kans door 0,50 gaat, en dat is
 * ook de grens tussen de twee antwoorden. Het tweede leest als de kans een klein
 * eindje verder, en dat IS de steilheid, zonder er een formule bij te halen.
 */
function Handvatnamen({
  curve,
  hoogte,
  scales: s,
}: {
  curve: Curve
  hoogte: number
  scales: Scales
}) {
  const mx = s.sx(curve.m)
  const hx = s.sx(curve.m + OFFSET)
  // Naar links wijken zodra de tekst het vrije vlak uit zou lopen.
  const rechtsRuimte = s.safe.right - (hx + 14) > 190
  /*
   * De tekst van het eerste handvat is 190 px breed en staat gecentreerd, dus
   * ze zou vanaf 95 px van de rand het vrije vlak uit lopen en op een paneel
   * belanden. Ze WIJKT dan naar de rand in plaats van te verdwijnen: waar de
   * curve door 0,50 gaat, is de toestand van dit bord, en toestand hoort te
   * blijven staan. Verdwijnen deed ze wel in de eerste versie, en dat viel op
   * bij het slepen naar links: dan zag een leerling het getal weggaan precies
   * op het moment dat hij het veranderde.
   */
  const mAnker = mx < s.safe.left + 95 ? 'start' : mx > s.safe.right - 95 ? 'end' : 'middle'
  const mx2 = mAnker === 'start' ? s.safe.left + 8 : mAnker === 'end' ? s.safe.right - 8 : mx
  return (
    <g pointerEvents="none">
      <text
        x={mx2}
        y={s.sy(0.5) + 30}
        textAnchor={mAnker}
        fontSize={13.5}
        fontWeight={700}
        fill={MODEL}
        {...HALO}
      >
        {`kans 0,50 bij groen ${getal(curve.m, 2)}`}
      </text>
      <text
        x={rechtsRuimte ? hx + 14 : hx - 14}
        y={s.sy(hoogte) - 16}
        textAnchor={rechtsRuimte ? 'start' : 'end'}
        fontSize={13.5}
        fontWeight={700}
        fill={MODEL}
        {...HALO}
      >
        {`hier is de kans al ${getal(hoogte, 2)}`}
      </text>
    </g>
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

/** Eén rij van de tabel: haar groenwaarde en haar echte antwoord. Een knop en
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
