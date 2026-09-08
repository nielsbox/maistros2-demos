import { useEffect, useMemo, useRef, useState } from 'react'
import Canvas, { DragDot, type Scales, type View } from '../components/Canvas'
import { Brief, Btn, Divider, Panel, PyChip } from '../components/Overlay'
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
  TRANSITIE,
  banden,
  trainStappen,
  zekerheid,
} from '../lib/logistiek'

/* ------------------------------------------------------------------ *
 * Les 3: van getal naar kans.
 *
 * WAT DIT BORD ANDERS DOET DAN "WAAR LEG JIJ DE GRENS?". Dat bord begint bij
 * een model dat al getraind is en laat je aan de uitkomst draaien. Dit bord
 * heeft aan het begin geen getraind model: de leerling bouwt zelf het ding dat
 * van een getal een kans maakt, en kijkt daarna toe hoe de computer ernaar
 * zoekt. Er staat hier dus niets over een drempel, niets over hoe stevig een
 * model is en niets over hoe je het beoordeelt.
 *
 * WAT ER OP HET BORD STAAT, en waarom precies dit.
 *
 *   de x-as   de groenwaarde van één rij. Eén kenmerk, want alleen dan is de
 *             S-curve te tekenen. Wat dat kost staat op het bord: met alle drie
 *             de kleurwaarden haalt het model van de les 100 % juist, met
 *             alleen groen 91 van de 96.
 *   de y-as   het antwoord, gecodeerd zoals de les het codeert (slide
 *             2128358): Albert is 1 en staat bovenaan, Blahaj is 0 en staat
 *             onderaan. Dezelfde as is ook de kans, en dat is precies het punt:
 *             de curve loopt van het ene antwoord naar het andere.
 *   de curve  op elke groenwaarde geeft ze de kans op Albert.
 *   twee
 *   streepjes de grenzen 0,20 en 0,80. Niet van dit bord maar van de les zelf
 *             (slide 2128364).
 *   stokjes   van elke rij naar de curve. De lengte is hoever het model bij
 *             die rij vandaan zit - hetzelfde plaatje als "Teken de lijn" van
 *             les 1, zodat les 3 daarop voortbouwt.
 *
 * KLEUR DRAAGT DE KLASSE NIET, en dat is een bewuste afwijking van de les. In
 * de les is Albert oranje en Blahaj blauw, en dat is precies de valkuil: in het
 * huispalet betekent oranje een MISSER en blauw de LIJN VAN HET MODEL. Twee
 * betekenissen voor één kleur op één bord. De klasse hangt hier dus aan de
 * y-positie plus het woord langs de as, nooit aan kleur. Kleur is alleen voor
 * de drie banden, en die hebben elk ook hun eigen vorm en hun eigen telling.
 *
 * "CURVE" IS EEN NIEUW WOORD in dit project en het moet in de woordenlijst van
 * CLAUDE.md. De woordenlijst heeft `lijn` voor de lijn van het model, maar dat
 * is de RECHTE lijn van les 1 en 2. Twee vormen, twee woorden: een lijn is
 * recht, een curve is de S. Dit bord zegt daarom nergens `lijn`. De les zelf
 * zegt `de logistische functie` en gebruikt `curve` en `kromme` nul keer.
 * `kans` voegt het bord toe (de les zegt "een getal tussen 0 en 1" op 2128358),
 * maar dat deed "Waar leg jij de grens?" al, dus de twee borden zeggen
 * hetzelfde. `zeker` is van de les: "het model is niet zeker genoeg" (2127649).
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

export default function VanGetalNaarKans() {
  const [curve, setCurve] = useState<Curve>(START)
  /** Of de computer al gezocht heeft. Verandert alleen de vaststelling. */
  const [getraind, setGetraind] = useState(false)
  /** Welke rij uit de tabel de leerling aanwijst, of geen. */
  const [gekozen, setGekozen] = useState<number | null>(null)

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
   *  dezelfde curve trekken, is een bord dat om de haverklap terugspringt. */
  const zetCurve = (c: Curve) => {
    stopZoeken()
    setGetraind(false)
    setCurve(c)
  }

  const teZoeken = useMemo(() => trainStappen(curve).length > 0, [curve])

  /** Twee rijen zijn dezelfde rij als groenwaarde en antwoord kloppen. In het
   *  venster van de tabel is elke groenwaarde uniek - de enige dubbele groep in
   *  het bestand staat op 0,0000 - dus dit wijst altijd precies één merk aan. */
  const zelfdeRij = (a: Rij, b: Rij) => a.groen === b.groen && a.albert === b.albert

  /* --------------------------- alles geteld ------------------------- */

  const z = zekerheid(curve)
  const b = banden(curve)
  const laagste = laagsteKans(curve)
  const hoogte = kansVanHandvat(curve)
  const opStart = curve.k === START.k && curve.m === START.m

  return (
    <div className="relative h-full w-full">
      <Canvas defaultView={DEFAULT_VIEW} xLabel="groenwaarde van de rij" yLabel="kans op Albert">
        {(s) => (
          <>
            {/* De grenzen van de les: 0,20 en 0,80. */}
            <Bandlijn kans={BAND_HOOG} woorden="zeker Albert vanaf" scales={s} />
            <Bandlijn kans={BAND_LAAG} woorden="zeker Blahaj tot" scales={s} />

            <Stokjes curve={curve} scales={s} />
            <Kromme curve={curve} scales={s} />

            {RIJEN.map((rij, i) => (
              <Merk
                key={i}
                rij={rij}
                curve={curve}
                scales={s}
                aangewezen={gekozen !== null && zelfdeRij(TRANSITIE[gekozen], rij)}
              />
            ))}

            <Stapelnaam curve={curve} scales={s} />
            <Rijnamen scales={s} />

            {/* Het tweede handvat eerst, zodat het eerste bovenaan ligt: dat is
                het handvat dat een leerling het eerst pakt. */}
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
      </Canvas>

      {/*
        De eerste alinea is het DOEL en blijft op elk formaat staan; Brief klapt
        alleen alles daarna in. Wie hier vanaf een slide binnenvalt, ziet het
        portaal nooit, dus staat het doel niet op het bord, dan staat het
        nergens.
      */}
      <Brief eyebrow="mAIstros 2 - les 3" title="Van getal naar kans">
        <p>Deze curve zet de groenwaarde om in een kans. Sleep haar naar de beste plek.</p>
        <p>Het linkse handvat schuift de curve, het rechtse maakt haar steiler.</p>
        <p>Zakt één rij naar een lage kans, dan zakt de zekerheid mee.</p>
      </Brief>

      {/*
        Eén paneel, en het staat er altijd - ook voordat er iets versleept is.
        Canvas meet elke .panel ernaast en houdt die breedte vrij, dus een
        paneel dat pas opduikt herkadert het bord midden in een beweging
        (gemeten: 1,45x op 1024 px).

        De maten en de twee hoogtegrenzen komen van "Waar leg jij de grens?".
        Zelf nagemeten op zes formaten, met dit bord erin:

          venster     Brief   Brief x paneel   merken in een paneel   scrollt
          1440x900     230          0                   0                0
          1366x768     230          0                   0               24
          1280x800     230          0                   0                0
          1280x720     230          0                   0               72
          1024x768     146          0                   0                0
           900x700     146          0                   0               49

        Op geen enkel formaat valt een merk of een bordtekst onder een paneel,
        en op alle zes staan beide knoppen binnen het paneel. De Brief is 230 px
        uitgeklapt, en dat is geen toeval maar een grens: op 1366x768 en
        1280x800 begint dit paneel op 258 px, dus vanaf 242 px schuift de Brief
        eroverheen. De eerste versie was 253 px en deed dat ook echt, 13 px op
        twee formaten. Een alinea eruit en het klopt weer - wie hier een zin
        bijzet, moet dit opnieuw meten.

        DE VOLGORDE IS VAST, want op 1280x720 en 900x700 scrollt de onderkant:
        eerst de vaststelling, dan de drie tellingen, dan de twee knoppen, dan
        de tabel en de notebookregel. Op 1280x720 valt daarvan de laatste
        tabelrij en de notebookregel weg, nooit een knop. En de vaststelling na
        het trainen staat in de detailregel van de vaststelling zelf, niet in
        een nieuw blok onderaan - daar zou de conclusie onder de rand staan op
        precies het formaat waar het uitmaakt.
      */}
      <Panel className="pointer-events-auto absolute bottom-4 left-4 z-10 max-h-[calc(100%-12rem)] w-[16rem] overflow-y-auto px-4 py-3 xl:max-h-[calc(100%-17rem)] xl:w-[21rem]">
        {/*
          ZEKERHEID is het meetkundig gemiddelde van de 96 kansen op hun eigen
          antwoord, en dat is geen willekeurige keuze: het is de enige maatstaf
          hier die niet te bespelen is. Vier voor de hand liggende alternatieven
          zijn alle vier gemeten en alle vier bespeelbaar - zie logistiek.ts.

          De detailregel is de enige plek waar de vaststelling van dit bord
          staat, en ze is te controleren op het bord zelf: zak één rij naar 0 en
          de zekerheid zakt mee.
        */}
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

        <Divider />

        {/* De drie banden van de les, elk met zijn eigen vorm, zijn eigen woord
            en zijn eigen getal, dus geen ervan hangt aan kleur alleen. */}
        {/* De kop zegt 96, en het bord tekent 70 merken: dat verschil is de
            stapel op groen 0,0000, en die staat op het bord met zijn telling
            erbij. Zonder deze kop zou een leerling de merken kunnen tellen en
            uitkomen op iets anders dan waar de zekerheid over rekent. */}
        <div className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-ink/75">
          {`De ${getal(RIJEN.length)} rijen`}
        </div>
        <ul className="mt-1 space-y-0.5">
          <Bandregel band="zekerJuist" woord="zeker en juist" aantal={b.zekerJuist} />
          <Bandregel band="twijfel" woord="twijfel" aantal={b.twijfel} />
          <Bandregel band="zekerFout" woord="zeker en fout" aantal={b.zekerFout} />
        </ul>

        {/* Twee knoppen, en elke knop verandert zichtbaar iets - of hij staat
            uit. Trainen staat uit zodra er geen zichtbare stap meer te zetten
            is, en dat gebeurt echt: de top is vlak, dus een leerling die met de
            hand goed zoekt komt op dezelfde 92,2 % als de computer. Dat is geen
            gebrek van het bord maar de vaststelling zelf - die gaat over wáár de
            zoektocht eindigt, niet over wie er wint. */}
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <Btn onClick={train} disabled={zoekt || !teZoeken}>
            Trainen
          </Btn>
          <Btn variant="ghost" onClick={() => zetCurve(START)} disabled={zoekt || opStart}>
            Zet terug
          </Btn>
        </div>

        {/*
          DE TABEL, want een plaatje kan niet tonen wat het niet kan tekenen.
          Dit zijn de acht rijen met een groenwaarde tussen 0,20 en 0,29: het
          venster waar Albert en Blahaj door elkaar lopen. Daar wonen de twee
          rijen die geen enkele curve juist krijgt, twee keer Blahaj op 0,2753 en
          0,2756, tussen vier Alberts in. De tabel is het bestand, de grafiek is
          het plaatje van het bestand - en wie op een rij klikt, ziet welk merk
          op het bord bij die rij hoort.
        */}
        <div className="mt-3 text-[11.5px] font-bold uppercase tracking-[0.09em] text-ink/75">
          De rijen die door elkaar lopen
        </div>
        <table className="mt-1 w-full text-[12.5px] tabular-nums">
          <thead>
            <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
              <th className="py-0.5 font-semibold">groen</th>
              <th className="py-0.5 font-semibold">antwoord</th>
              <th className="py-0.5 text-right font-semibold">kans</th>
            </tr>
          </thead>
          <tbody>
            {TRANSITIE.map((rij, i) => (
              <Tabelrij
                key={i}
                rij={rij}
                curve={curve}
                aangewezen={gekozen === i}
                onKies={() => setGekozen(gekozen === i ? null : i)}
              />
            ))}
          </tbody>
        </table>

        {/*
          De regel die het bord aan de les en aan het notebook knoopt. De slide
          waar dit bord op hoort te staan (2127698) zegt alleen dat het model nu
          LogisticRegression() heet en legt niet uit wat dat doet, en dit is de
          enige plek waar het bord de naam noemt die de les gebruikt.

          HIJ STAAT ONDERAAN, en dat is gemeten. Op 1024x768 - de beamervloer,
          en dus het formaat dat telt - is de inhoud 555 px in 555 px en scrollt
          er niets, dus deze regel staat er gewoon. Op 1366x768, 1280x720 en
          900x700 scrollt de staart van het paneel wel, en dan verdwijnt eerst
          deze regel en daarna de laatste tabelrij. Andersom kan niet: zet je
          deze regel boven de tabel, dan scrollen juist de twee rijen op 0,2753
          en 0,2756 weg, en dat zijn precies de rijen waarvoor die tabel er
          staat.
        */}
        <div className="mt-2.5 text-[11.5px] leading-relaxed text-muted">
          In je notebook zoekt <PyChip>LogisticRegression()</PyChip> deze curve voor jou. De les
          noemt haar de logistische functie.
        </div>
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

function Merk({
  rij,
  curve,
  scales,
  aangewezen,
}: {
  rij: Rij
  curve: Curve
  scales: Scales
  aangewezen: boolean
}) {
  const band = bandVan(rij, curve)
  const { kleur } = BANDEN[band]
  const cx = scales.sx(rij.groen)
  const cy = scales.sy(rij.albert ? 1 : 0)
  const kans = kansOpEigenAntwoord(rij, curve)
  return (
    <g pointerEvents="none">
      {aangewezen && <circle cx={cx} cy={cy} r={R + 8} fill="none" stroke={kleur} strokeWidth={2.5} />}
      {band === 'zekerJuist' && <circle cx={cx} cy={cy} r={R} fill={kleur} />}
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
        {`groen ${getal(rij.groen, 4)}, ${rij.albert ? 'Albert' : 'Blahaj'} - de curve geeft deze rij ${getal(kans, 2)} kans op haar eigen antwoord`}
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

/** De curve zelf, over de hele zichtbare breedte van het bord. */
function Kromme({ curve, scales: s }: { curve: Curve; scales: Scales }) {
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
    <path d={d} fill="none" stroke={MODEL} strokeWidth={2.5} strokeLinecap="round" pointerEvents="none" />
  )
}

/* ---------------------------- bordteksten --------------------------- *
 * Alles op het bord is minstens 13 px, vet, en met een witte rand eromheen,
 * zodat het over een rasterlijn, een stokje of een merk heen leesbaar blijft. */

const HALO = { stroke: '#fff', strokeWidth: 3.5, paintOrder: 'stroke' } as const

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
 */
function Stapelnaam({ curve, scales: s }: { curve: Curve; scales: Scales }) {
  const cx = s.sx(STAPEL.groen)
  if (cx < s.safe.left + 40 || cx > s.safe.right - 40) return null
  return (
    <text
      x={cx}
      y={s.sy(0) - 16}
      textAnchor="middle"
      fontSize={13}
      fontWeight={700}
      fill={BANDEN[bandVan({ groen: STAPEL.groen, albert: false }, curve)].inkt}
      pointerEvents="none"
      {...HALO}
    >
      {`${getal(STAPEL.aantal)} rijen`}
    </text>
  )
}

/**
 * Wat de twee handvatten NU zeggen. Geen opdracht - dat staat in de Brief -
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
  const mx2 =
    mAnker === 'start' ? s.safe.left + 8 : mAnker === 'end' ? s.safe.right - 8 : mx
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

/** Eén rij van de tabel: haar groenwaarde, haar echte antwoord, en de kans die
 *  de curve haar NU op dat antwoord geeft. Een knop en geen sleepbaar merk, dus
 *  er is hier geen verwarring tussen klikken en slepen mogelijk. */
function Tabelrij({
  rij,
  curve,
  aangewezen,
  onKies,
}: {
  rij: Rij
  curve: Curve
  aangewezen: boolean
  onKies: () => void
}) {
  const kans = kansOpEigenAntwoord(rij, curve)
  const band = bandVan(rij, curve)
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
      <td className="py-px text-right font-semibold tabular-nums" style={{ color: BANDEN[band].inkt }}>
        {getal(kans, 2)}
      </td>
    </tr>
  )
}
