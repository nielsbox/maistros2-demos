import { useMemo, useState } from 'react'
import Canvas, { DragDot, type Scales, type View } from '../components/Canvas'
import { Brief, Btn, Divider, Panel, PyChip } from '../components/Overlay'
import Vaststelling, { getal, meervoud } from '../components/Vaststelling'
import { clamp } from '../lib/regression'
import { DATA, DERDE, DERDE_INK, FOUT, FOUT_INK, INK, MUTED, NAVY } from '../lib/palette'
import {
  AANTAL_MIJNEN,
  AANTAL_ROTSBLOKKEN,
  GEVALLEN,
  grensZonderGemist,
  grensZonderGemistRotsblok,
  uitkomst,
  type Geval,
} from '../lib/sonar'

/* ------------------------------------------------------------------ *
 * Les 3: waar leg jij de grens?
 *
 * Waarom dit bord geen puntenwolk is. De sonardata heeft 60 waarden per rij,
 * en zestig assen kun je niet tekenen. Wat het model ervan overhoudt is
 * precies één getal per rij: de kans. Dus staat elke rij hier op die ene as,
 * en is de grens het enige dat de leerling nog verschuift.
 *
 * De vier uitkomsten staan alle vier tegelijk op het bord, en geen ervan
 * hangt aan kleur alleen:
 *
 *   VORM   zegt wat het in werkelijkheid is - driehoek is een mijn,
 *          vierkant is een rotsblok. Die vorm verandert nooit.
 *   KANT   zegt wat het model er nu van maakt. Links van de grens: rotsblok.
 *          Vanaf de grens: mijn.
 *   KLEUR  zegt of die twee bij elkaar passen. Navy klopt, oranje niet.
 *   WOORD  staat er in het paneel bij, met het getal ernaast, en dat getal
 *          wordt geteld uit de grens.
 *
 * Een leerling die geen kleurverschil ziet, leest de kwadranten nog steeds:
 * een driehoek links van de grens is een gemiste mijn, wat zijn kleur ook is.
 *
 * Het woord is ROTSBLOK en niet steen: zo staat het 22 keer in les 3, en
 * `steen` staat er nul keer. Zie de kop van src/lib/sonar.ts.
 *
 * DRIE WOORDEN, EN WAAR ZE VANDAAN KOMEN. Geteld over alle slides van les 3:
 *
 *   `grenzen`  2 keer, op slide 2128364, en in exact deze betekenis: de plek
 *              waar je besluit iets eetbaar of giftig te noemen. Het enkelvoud
 *              `grens` staat er niet, maar het begrip is dat van de les.
 *   `mist`     1 keer, op slide 2127771: "zo mist het meer rotsblokken". De les
 *              gebruikt missen dus voor BEIDE fouten, niet alleen voor mijnen.
 *              Daarom heet een rotsblok dat mijn gaat heten hier ook gemist, en
 *              staan de vier uitkomsten met twee werkwoorden op het bord:
 *              herkend en gemist.
 *   `kans`     0 keer. Dit is het enige woord dat het bord zelf toevoegt. De
 *              les zegt "een getal tussen 0 en 1" (slide 2128358), en zo wordt
 *              het in de Brief ook ingeleid voordat het `kans` gaat heten.
 *
 * "Vals alarm" stond hier eerst en is eruit: het is een letterlijke vertaling
 * van false positive, en als telbaar meervoud ("22 valse alarmen") zegt geen
 * Nederlandstalige het.
 *
 * Er staat NERGENS welke grens de beste is, en dat is opzettelijk. Alle 97
 * standen van de schuifknop nagerekend: het hoogste percentage juist staat op
 * 0,47 met 90,4 %, en niet op de 0,50 waarmee het model standaard beslist
 * (80,8 %). De minste gemiste mijnen, nul, haal je pas op 0,39 en lager, en
 * dan mist het model zeven rotsblokken. Er is dus geen grens die alles wint.
 * Zodra een bord er één aanwijst, is de afweging weg en is er niets meer te
 * kiezen. Het bord telt, de leerling kiest.
 * ------------------------------------------------------------------ */

/* --------------------------- de opstelling -------------------------- *
 * Twee banen: mijnen boven, rotsblokken onder. Binnen een baan schuift een geval
 * een rij omhoog zodra het te dicht op zijn linkerbuur staat, anders vallen
 * de zeventien gevallen tussen 0,4 en 0,6 op één hoop en zie je nooit hoeveel
 * er zijn. Het pakken gebeurt op de gesorteerde kansen, dus het plaatje is
 * voor elke leerling en elke beamer hetzelfde: er komt geen toeval bij kijken
 * en dus ook geen seeded() aan te pas.                                */

/** Hoe dicht twee gevallen in kans mogen liggen voordat de tweede een rij
 *  opschuift. Gemeten op 1024x768: de as van 0 tot 1 is daar 607 px, dus 0,035
 *  is 21 px, en de twee merken die het dichtst bij elkaar staan liggen 22 px
 *  uit elkaar. Merken zijn 12 tot 15 px breed, dus ze blijven los. */
const MIND = 0.035

/** Waar de eerste rij van een baan staat. De ruimte tussen -1,6 en 1,6 blijft
 *  vrij voor het handvat en de twee tellingen bij de grens. */
const BAAN = 1.6

/** Hoogte van één rij binnen een baan. */
const RIJ = 1

type Merk = Geval & { y: number }

function pak(gevallen: readonly Geval[], omhoog: boolean): Merk[] {
  const laatste: number[] = []
  return [...gevallen]
    .sort((a, b) => a.kans - b.kans)
    .map((g) => {
      let rij = laatste.findIndex((x) => g.kans - x >= MIND)
      if (rij === -1) {
        laatste.push(g.kans)
        rij = laatste.length - 1
      } else {
        laatste[rij] = g.kans
      }
      const y = BAAN + rij * RIJ
      return { ...g, y: omhoog ? y : -y }
    })
}

const MIJNEN = pak(
  GEVALLEN.filter((g) => g.mijn),
  true,
)
const ROTSBLOKKEN = pak(
  GEVALLEN.filter((g) => !g.mijn),
  false,
)

/** Hoe hoog de banen reiken, gemeten en niet geschat: de view moet daar
 *  boven uitkomen, anders staan de bovenste merken tegen de kopteksten aan. */
const TOP = Math.max(...MIJNEN.map((m) => m.y))

const DEFAULT_VIEW: View = { x0: -0.045, x1: 1.045, y0: -(TOP + 2), y1: TOP + 2 }

/** De schuifknop en het handvat lopen even ver, zodat de twee altijd hetzelfde
 *  zeggen. Niet tot 0 of 1: op een grens van 0 zegt het model over alles mijn
 *  en staat de lijn buiten de merken. */
const GRENS_MIN = 0.02
const GRENS_MAX = 0.98
const STAP = 0.01

/** Twee grenzen die uit de data komen, niet uit een tekst. */
const ZONDER_GEMIST = grensZonderGemist(GEVALLEN, STAP)
const ZONDER_GEMIST_ROTSBLOK = grensZonderGemistRotsblok(GEVALLEN, STAP)

/* Hoeveel ruimte een tekst naast de grenslijn nodig heeft voordat ze getekend
 * wordt. Onder die breedte loopt ze het vrije vlak uit, en dan komt ze op een
 * paneel terecht.
 *
 * GEMETEN in de browser met getBBox(), niet geschat. De vorige versie had één
 * constante van 120 px voor beide, en die was voor geen van de twee genoeg:
 *
 *   "het model zegt rotsblok"   153 px   (13 px, vet)  + 10 px van de lijn
 *   "het model zegt mijn"       127 px
 *   "22 rotsblokken gemist"     155 px   (14 px, vet)  + 34 px van de lijn
 *   "30 mijnen gemist"          115 px
 *
 * Dus 163 px voor de koptekst en 189 px voor de telling, naar boven afgerond
 * met wat marge voor een ander lettertype. Meet opnieuw zodra een van die
 * woorden verandert: een langer woord is precies hoe dit stuk kon gaan - de
 * telling rechts heette "22 valse alarmen" en was 117 px, en de Nederlandse
 * versie is 38 px breder. */
const KOP_RUIMTE = 170
const TELLING_RUIMTE = 200

export default function WaarLegJijDeGrens() {
  // Op 0,50 beginnen: dat is de grens waarmee het model zelf beslist, en dus
  // de enige waarvan een leerling denkt dat ze vastligt. Vanaf daar is elke
  // beweging een ontdekking.
  const [grens, setGrens] = useState(0.5)

  const u = useMemo(() => uitkomst(GEVALLEN, grens), [grens])

  return (
    <div className="relative h-full w-full">
      {/* De y-as betekent hier niets: rijen zijn stapelruimte, geen waarde. De
          getallen langs die as staan daarom uit, en de kansen langs de onderrand
          tekent dit bord zelf. */}
      <Canvas defaultView={DEFAULT_VIEW} axes={false}>
        {(s) => {
          const gx = s.sx(grens)
          return (
            <>
              {/* Wat het model NU mijn noemt, als vlak. Heel licht: het moet van
                  achter in de klas te zien zijn zonder de merken te overstemmen. */}
              <rect
                x={gx}
                y={s.area.top}
                width={Math.max(0, s.area.right - gx)}
                height={s.area.h}
                fill={DERDE}
                opacity={0.075}
                pointerEvents="none"
              />

              <KansAs scales={s} />

              {/* De grens zelf. Niet de kleur van het model: het model geeft de
                  kans, de grens is wat de leerling erbij kiest. */}
              <line
                x1={gx}
                y1={s.area.top}
                x2={gx}
                y2={s.area.bottom}
                stroke={DERDE}
                strokeWidth={2.5}
                pointerEvents="none"
              />

              {ROTSBLOKKEN.map((m, i) => (
                <Rotsblok key={`r${i}`} merk={m} scales={s} grens={grens} />
              ))}
              {MIJNEN.map((m, i) => (
                <Mijn key={`m${i}`} merk={m} scales={s} grens={grens} />
              ))}

              <DragDot
                point={{ x: grens, y: 0 }}
                scales={s}
                color={DERDE}
                r={9}
                cursor="ew-resize"
                ariaLabel="handvat: verschuif de grens"
                bounds={{ x: [GRENS_MIN, GRENS_MAX], y: [0, 0] }}
                step={{ x: STAP, y: 0 }}
                onMove={(p) => setGrens(rond(clamp(p.x, GRENS_MIN, GRENS_MAX)))}
              />

              <Kopteksten scales={s} grens={grens} />

              {/* De tellingen staan bij de merken waar ze over gaan, niet alleen
                  in het paneel. Gemiste mijnen liggen altijd links van de grens
                  en gemiste rotsblokken altijd rechts, dus deze twee kunnen elkaar en
                  het handvat niet raken. */}
              {u.gemisteMijn > 0 && gx - TELLING_RUIMTE > s.safe.left && (
                <Telling
                  x={gx - 34}
                  y={(s.sy(BAAN) + s.sy(0)) / 2 + 5}
                  anker="end"
                  tekst={`${getal(u.gemisteMijn)} ${meervoud(u.gemisteMijn, 'mijn', 'mijnen')} gemist`}
                />
              )}
              {u.gemistRotsblok > 0 && gx + TELLING_RUIMTE < s.safe.right && (
                <Telling
                  x={gx + 34}
                  y={(s.sy(-BAAN) + s.sy(0)) / 2 + 5}
                  anker="start"
                  tekst={`${getal(u.gemistRotsblok)} ${meervoud(
                    u.gemistRotsblok,
                    'rotsblok',
                    'rotsblokken',
                  )} gemist`}
                />
              )}
            </>
          )
        }}
      </Canvas>

      {/*
        De eerste alinea is het DOEL. Brief laat die altijd staan en klapt
        alleen alles daarna in, dus op een beamer is dit de enige zin die een
        leerling gegarandeerd leest. Wie hier vanaf een slide binnenvalt, ziet
        de portaalkaart nooit: staat het doel niet op het bord, dan staat het
        nergens.
      */}
      {/* De les heeft TWEE borden, en er staat geen leerkracht bij om te zeggen
          welk wanneer. Het enige onderscheid dat een leerling meteen leest, is de
          oefening waar het bord bij hoort - en dat zijn de woorden van de les zelf
          ("Oefening 1", "Oefening 2"). Dit bord is de sonardata van oefening 2,
          "Van getal naar kans" de kleuren van oefening 1. */}
      <Brief eyebrow="mAIstros 2 - les 3, oefening 2" title="Waar leg jij de grens?">
        {/* Het doel zegt "een getal", want zo staat het in de les, en knoopt
            dat in dezelfde zin vast aan "kans", het woord dat het bord verder
            overal gebruikt. Dat stond eerst in een alinea apart, en die alinea
            was 44 px die dit bord niet had: uitgeklapt werd de Brief dan 283 px
            hoog en schoof het onderste paneel eroverheen - 10 px op 1366x768 en
            58 px op 1280x720. Nu is deze Brief net zo hoog als die van de
            andere borden. */}
        {/* DE OPDRACHT STAAT IN DEZE EERSTE ALINEA EN NIET IN EEN TWEEDE.
            Brief toont alleen zijn eerste kind altijd; al de rest is detail en
            staat dichtgeklapt tot 80rem (1280px). "Sleep de grens" stond daar,
            dus op 1024x768 en 900x700 - de formaten waarop een leerling die
            deze les alleen doorloopt zit - stond de enige instructie van dit
            bord niet in de DOM, achter een plusknop die hij moest vinden. Een
            opdracht mag nooit achter een uitklapper. Het is met opzet één
            alinea van twee zinnen en geen tweede alinea: een tweede alinea kost
            44px die dit bord niet heeft, en dat schoof het onderste paneel
            eerder al over de Brief (10px op 1366x768, 58px op 1280x720). */}
        <p>
          Het model geeft per rij een getal tussen 0 en 1: de kans op een mijn.
          Sleep de grens en kijk wat het model dan mist.
        </p>
        {/* De moraal van dit bord, en daarom staat ze in de Brief en niet in
            het paneel. Ze verandert nooit mee met de grens, dus het is kader
            en geen toestand - en in het paneel kostte ze 90 px die daar niet
            waren: op 1024x768 duwde ze de laatste regels 83 px onder de rand. */}
        <p>Een gemiste mijn en een gemist rotsblok zijn niet dezelfde soort fout.</p>
      </Brief>

      {/*
        Dit paneel staat er altijd, ook voordat er iets versleept is. Een paneel
        dat pas opduikt herkadert het bord midden in een beweging: Canvas meet
        elke .panel ernaast en houdt die breedte vrij (gemeten: 1,45x op 1024 px).

        Twee hoogtegrenzen, want de Brief is niet altijd even hoog. Onder 1280 px
        staat de Brief ingeklapt op 146 px en is 12rem genoeg, zoals op de andere
        borden. Vanaf 1280 klapt hij uit naar 230 px, en dan moet dit paneel 17rem
        vrijlaten. Gemeten na de wijziging, telkens de overlap tussen de twee
        panelen:

          1440x900  0 px      1366x768  0 px      1280x800  0 px
          1280x720  0 px      1024x768  0 px       900x700  0 px

        Zonder de xl-grens overlapten ze op 1280x720 nog 23 px. Op dat formaat
        en op 900x700 scrollt de onderkant van dit paneel wel (34 en 53 px);
        dat is de uitleg en de notebookregel, nooit een knop.
      */}
      <Panel className="pointer-events-auto absolute bottom-4 left-4 z-10 max-h-[calc(100%-13.75rem)] w-[16rem] overflow-y-auto px-4 py-3 xl:max-h-[calc(100%-17rem)] xl:w-[21rem]">
        {/* Het getal dat de leerling verschuift, en het enige dat groot staat.
            Alles hieronder wordt geteld uit de grens, niets is ingetypt. */}
        <Vaststelling
          label="Gemiste mijnen"
          value={u.gemisteMijn}
          outOf={{ total: AANTAL_MIJNEN, noun: 'mijnen' }}
          detail={`Het model mist ${getal(u.gemistRotsblok)} ${meervoud(
            u.gemistRotsblok,
            'rotsblok',
            'rotsblokken',
          )}.`}
          color={FOUT}
        />

        <Divider />

        {/*
          De grens staat hier klein en niet als tweede Readout, en dat is een
          hoogtebeslissing, geen smaak. Met een volwaardige Readout erbij was
          dit paneel op 1024x768 gemeten 772 px hoog tegen 574 px ruimte: de
          uitleg onderaan zat 198 px onder de rand en was alleen met scrollen
          te vinden. In de klas leest niemand die. Bovendien staat de waarde
          van de grens al op het bord, naast de lijn zelf.
        */}
        <div className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-ink/75">Grens</div>
        <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
          <span
            className="cf-display text-[22px] leading-none tabular-nums"
            style={{ color: DERDE_INK }}
          >
            {getal(grens, 2)}
          </span>
          <span className="text-[12.5px] text-ink/80">
            het model zegt {getal(u.zegtMijn)} keer mijn
          </span>
        </div>

        <input
          type="range"
          min={GRENS_MIN}
          max={GRENS_MAX}
          step={STAP}
          value={grens}
          onChange={(e) => setGrens(rond(parseFloat(e.target.value)))}
          className="mt-2 w-full"
          aria-label="de grens"
        />
        {/* Twee echte zinnetjes en geen telegramstijl: "bijna alles mijn" is
            geen Nederlandse woordgroep, en zonder lidwoord leest `mijn` als het
            bezittelijk voornaamwoord. Gemeten met de echte letter passen deze
            twee samen in het smalste paneel. */}
        <div className="flex justify-between text-[11px] text-muted">
          <span>alles wordt een mijn</span>
          <span>niets wordt een mijn</span>
        </div>

        {/* Twee van deze drie knoppen worden uit de data gerekend, want een knop
            die "Mis geen mijn" belooft en dat niet doet, leest als een stuk
            bord. 0,50 is het enige vaste getal hier, en dat is geen meting: het
            is de grens waarmee het model standaard beslist.

            Alle drie staan in de gebiedende wijs. Dat is geen smaak maar dezelfde
            regel als bij de vier uitkomsten: een setje knoppen naast elkaar leest
            als slordig zodra het twee vormen mengt, en "Geen mijn missen" was
            bovendien geen Nederlandse zin. "Mis geen mijn" wel: met `geen` is het
            enkelvoud hier de gewone vorm, zoals in "mis geen aflevering".

            DE LENGTE IS GEMETEN, want die duwt inhoud onder de rand. Het paneel
            is vanaf 1280 px 302 px breed binnenin. Deze drie knoppen zijn 126,
            126 en 159 px, dus de eerste twee staan samen op één regel met 44 px
            over. Met "Zet de grens op 0,50" (171) en "Mis geen rotsblokken" (184)
            werden dat drie regels, 43 px meer, en dan zakte "Juist: 80,8 %" op
            1280x720 19 px onder de rand van het paneel - een getal dat het bord
            juist rekent en dan niet toont.

            Een knop staat uit zodra de grens er al staat. Het bord OPENT op
            0,50, dus zonder dit is "Begin bij 0,50" de eerste knop die een
            leerling indrukt en er verandert niets - en een knop waar niets van
            verandert leest als een bord dat stuk is. */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Btn variant="ghost" disabled={grens === 0.5} onClick={() => setGrens(0.5)}>
            Begin bij 0,50
          </Btn>
          <Btn
            variant="ghost"
            disabled={grens === ZONDER_GEMIST}
            onClick={() => setGrens(ZONDER_GEMIST)}
          >
            Mis geen mijn
          </Btn>
          <Btn
            variant="ghost"
            disabled={grens === ZONDER_GEMIST_ROTSBLOK}
            onClick={() => setGrens(ZONDER_GEMIST_ROTSBLOK)}
          >
            Mis geen rotsblok
          </Btn>
        </div>

        <Divider />

        {/* De legenda is ook de telling. Vier uitkomsten, elk met zijn eigen
            vorm, zijn eigen woord en zijn eigen getal, dus geen enkele hangt
            aan kleur alleen.

            EEN VORM VOOR ALLE VIER: zelfstandig naamwoord + voltooid deelwoord.
            Eerder mengde dit setje drie deelwoorden met één woordgroep
            ("vals alarm"), en dat is precies de slordigheid die een leerling
            ziet zonder ze te kunnen benoemen.

            HET GETAL BEPAALT HET MEERVOUD, net als bij de tellingen op het bord
            zelf. Vast in het meervoud zetten haalt de dubbelzinnigheid uit
            `mijn` bij hogere getallen - "3 mijn gemist" leest als het
            bezittelijk voornaamwoord - maar dan staat er bij één "1 mijnen
            gemist", en dat is geen Nederlands. Alle vier de tellers KOMEN op 1
            uit, nagerekend over alle 97 standen van de schuifknop: mijnen
            gemist op 0,40 tot 0,44, rotsblokken gemist op 0,62 tot 0,67,
            rotsblokken herkend op 0,07 en mijnen herkend op 0,96. Gemeten op
            0,40 stond er dan tegelijk "1 mijn gemist" op het bord en "1 mijnen
            gemist" in dit lijstje: één begrip met twee woorden op één scherm.
            Dus gaat het meervoud hier door dezelfde `meervoud()` als daar, en
            zeggen de twee altijd hetzelfde. Het label wordt bij één alleen
            korter, nooit langer, dus het kan niets onder de rand duwen.

            EN TWEE WERKWOORDEN VOOR VIER REGELS: herkend als het klopt, gemist
            als het niet klopt. Niet drie, want dan zouden de twee juiste regels
            ("gevonden" en "herkend") twee woorden zijn voor één begrip. `gemist`
            geldt hier dus ook voor een rotsblok, en dat is niet verzonnen: les 3
            zegt het zelf op slide 2127771, "zo mist het meer rotsblokken". Het
            verschil tussen de twee fouten zit in het zelfstandig naamwoord, en
            dat is ook precies waar het in het echt in zit. */}
        <ul className="space-y-0.5">
          <Uitkomstregel
            vorm="driehoek"
            kleur={DATA}
            woord={`${meervoud(u.juisteMijn, 'mijn', 'mijnen')} herkend`}
            aantal={u.juisteMijn}
          />
          <Uitkomstregel
            vorm="driehoek"
            kleur={FOUT}
            waas
            woord={`${meervoud(u.gemisteMijn, 'mijn', 'mijnen')} gemist`}
            aantal={u.gemisteMijn}
          />
          <Uitkomstregel
            vorm="vierkant"
            kleur={DATA}
            woord={`${meervoud(u.juisteRotsblok, 'rotsblok', 'rotsblokken')} herkend`}
            aantal={u.juisteRotsblok}
          />
          <Uitkomstregel
            vorm="vierkant"
            kleur={FOUT}
            waas
            woord={`${meervoud(u.gemistRotsblok, 'rotsblok', 'rotsblokken')} gemist`}
            aantal={u.gemistRotsblok}
          />
        </ul>

        <div className="mt-2 text-[13px] text-ink/80">
          Juist: <span className="font-semibold tabular-nums">{getal(u.juistPct, 1)}%</span>{' '}
          <span className="text-muted">
            ({getal(u.juist)} van de {getal(GEVALLEN.length)})
          </span>
        </div>

        {/* De les typt `predict`, nooit `predict_proba`: geteld over alle
            slides van les 3 staat `predict_proba` er 0 keer. Verwijzen naar
            code die de leerling niet heeft, is hetzelfde soort fout als een
            bord op de verkeerde slide. En dit is ook precies wat dit bord
            toont: nagerekend op alle 52 testrijen is `predict` exact hetzelfde
            als de grens op 0,50 leggen. */}
        <div className="mt-2.5 text-[11.5px] leading-relaxed text-muted">
          In je notebook legt <PyChip>lr_model.predict(x_test)</PyChip> de grens altijd op 0,50.
        </div>
      </Panel>
    </div>
  )
}

/** Afronden op de stap van de schuifknop, zodat slepen en schuiven exact
 *  dezelfde grenzen opleveren en het getal in het paneel niet gaat trillen. */
const rond = (v: number) => Math.round(v / STAP) * STAP

/* ------------------------------ merken ------------------------------ *
 * Vaste pixelmaten, geen wereldmaten: bij inzoomen moet een merk even groot
 * blijven, anders wordt een geval een vlek. Missers staan groter en met een
 * waas eromheen, want daar gaat dit bord over.                          */

const R = 6
const R_FOUT = 7.5

function Mijn({ merk, scales, grens }: { merk: Merk; scales: Scales; grens: number }) {
  const zegtMijn = merk.kans >= grens
  const kleur = zegtMijn ? DATA : FOUT
  const r = zegtMijn ? R : R_FOUT
  const cx = scales.sx(merk.kans)
  const cy = scales.sy(merk.y)
  return (
    <g pointerEvents="none">
      {!zegtMijn && <circle cx={cx} cy={cy} r={r + 7} fill={FOUT} opacity={0.18} />}
      <polygon
        points={`${cx},${cy - r * 1.15} ${cx - r * 1.05},${cy + r * 0.8} ${cx + r * 1.05},${cy + r * 0.8}`}
        fill={kleur}
        stroke="#fff"
        strokeWidth={1.5}
      />
      <title>
        {`een mijn, kans ${getal(merk.kans, 2)} - het model zegt ${
          zegtMijn ? 'mijn' : 'rotsblok'
        }`}
      </title>
    </g>
  )
}

function Rotsblok({ merk, scales, grens }: { merk: Merk; scales: Scales; grens: number }) {
  const zegtMijn = merk.kans >= grens
  const kleur = zegtMijn ? FOUT : DATA
  const r = zegtMijn ? R_FOUT : R
  const cx = scales.sx(merk.kans)
  const cy = scales.sy(merk.y)
  return (
    <g pointerEvents="none">
      {zegtMijn && <circle cx={cx} cy={cy} r={r + 7} fill={FOUT} opacity={0.18} />}
      <rect
        x={cx - r * 0.88}
        y={cy - r * 0.88}
        width={r * 1.76}
        height={r * 1.76}
        rx={1}
        fill={kleur}
        stroke="#fff"
        strokeWidth={1.5}
      />
      <title>
        {`een rotsblok, kans ${getal(merk.kans, 2)} - het model zegt ${
          zegtMijn ? 'mijn' : 'rotsblok'
        }`}
      </title>
    </g>
  )
}

/* ---------------------------- bordteksten --------------------------- *
 * Alles op het bord is minstens 13 px, vet, en met een witte rand eromheen,
 * zodat het over een rasterlijn of een merk heen leesbaar blijft.          */

const HALO = { stroke: '#fff', strokeWidth: 3.5, paintOrder: 'stroke' } as const

function Telling({
  x,
  y,
  anker,
  tekst,
}: {
  x: number
  y: number
  anker: 'start' | 'end'
  tekst: string
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anker}
      fontSize={14}
      fontWeight={700}
      fill={FOUT_INK}
      pointerEvents="none"
      {...HALO}
    >
      {tekst}
    </text>
  )
}

/** De kans langs de onderrand, en de naam van de as. Dit bord tekent ze zelf,
 *  omdat de y-as uit staat en die twee in Canvas aan dezelfde schakelaar
 *  hangen. */
function KansAs({ scales: s }: { scales: Scales }) {
  const stappen = [0, 0.2, 0.4, 0.6, 0.8, 1]
  return (
    <g pointerEvents="none">
      {stappen
        .filter((t) => s.sx(t) >= s.safe.left + 4 && s.sx(t) <= s.safe.right - 4)
        .map((t) => (
          <text
            key={t}
            x={s.sx(t)}
            y={s.safe.bottom - 10}
            textAnchor="middle"
            fontSize={13}
            fontWeight={600}
            fill={MUTED}
            {...HALO}
          >
            {getal(t, 1)}
          </text>
        ))}
      <text
        x={s.safe.right - 14}
        y={s.safe.bottom - 32}
        textAnchor="end"
        fontSize={13.5}
        fontWeight={700}
        fill={INK}
        {...HALO}
      >
        kans op een mijn
      </text>
    </g>
  )
}

/**
 * De vier woorden die bij de kwadranten horen: welke baan is welke, en wat het
 * model links en rechts van de grens zegt. Zonder deze regels moet een
 * leerling de betekenis uit de kleuren halen, en dat is precies wat niet mag.
 */
function Kopteksten({ scales: s, grens }: { scales: Scales; grens: number }) {
  const gx = s.sx(grens)
  const links = gx - 10 - s.safe.left > KOP_RUIMTE
  const rechts = s.safe.right - (gx + 10) > KOP_RUIMTE
  return (
    <g pointerEvents="none">
      {/* De banen. Het getal ernaast is geteld uit de data. */}
      <text
        x={s.safe.left + 8}
        y={s.sy(TOP) - 14}
        fontSize={13.5}
        fontWeight={700}
        fill={NAVY}
        {...HALO}
      >
        {`mijnen (${getal(AANTAL_MIJNEN)})`}
      </text>
      <text
        x={s.safe.left + 8}
        y={s.sy(-TOP) + 22}
        fontSize={13.5}
        fontWeight={700}
        fill={NAVY}
        {...HALO}
      >
        {`rotsblokken (${getal(AANTAL_ROTSBLOKKEN)})`}
      </text>

      {/* De grens, met zijn waarde erbij. Hij wijkt naar de andere kant zodra
          hij tegen de rand van het vrije vlak aan komt. */}
      <text
        x={rechts ? gx + 9 : gx - 9}
        y={s.safe.top + 15}
        textAnchor={rechts ? 'start' : 'end'}
        fontSize={14}
        fontWeight={700}
        fill={DERDE_INK}
        {...HALO}
      >
        {`grens ${getal(grens, 2)}`}
      </text>

      {links && (
        <text
          x={gx - 10}
          y={s.safe.top + 36}
          textAnchor="end"
          fontSize={13}
          fontWeight={700}
          fill={MUTED}
          {...HALO}
        >
          het model zegt rotsblok
        </text>
      )}
      {rechts && (
        <text
          x={gx + 10}
          y={s.safe.top + 36}
          textAnchor="start"
          fontSize={13}
          fontWeight={700}
          fill={MUTED}
          {...HALO}
        >
          het model zegt mijn
        </text>
      )}
    </g>
  )
}

/* ---------------------------- de legenda ---------------------------- *
 * Geen Legend uit Overlay: die zet bij elk woord een rondje, en op dit bord
 * is de vorm de helft van de betekenis. Een rondje naast "mijn gemist" zou een
 * leerling naar een rondje op het bord laten zoeken dat er niet staat.      */

function Uitkomstregel({
  vorm,
  kleur,
  woord,
  aantal,
  waas = false,
}: {
  vorm: 'driehoek' | 'vierkant'
  kleur: string
  woord: string
  aantal: number
  /** De waas die een misser op het bord ook heeft. Het blokje in de legenda
   *  moet exact het merk zijn dat een leerling zoekt, anders zoekt hij iets
   *  anders dan er staat. */
  waas?: boolean
}) {
  return (
    <li className="flex items-center gap-2 text-[13px] text-ink/85">
      <svg width={18} height={18} viewBox="0 0 18 18" aria-hidden="true" className="shrink-0">
        {waas && <circle cx={9} cy={9} r={9} fill={kleur} opacity={0.18} />}
        {vorm === 'driehoek' ? (
          <polygon points="9,2.5 15.5,14 2.5,14" fill={kleur} />
        ) : (
          <rect x={3} y={3} width={12} height={12} rx={1} fill={kleur} />
        )}
      </svg>
      <span className="tabular-nums font-semibold" style={{ minWidth: '1.6em' }}>
        {getal(aantal)}
      </span>
      <span>{woord}</span>
    </li>
  )
}
