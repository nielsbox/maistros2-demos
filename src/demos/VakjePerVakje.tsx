import { useEffect, useMemo, useState } from 'react'
import Canvas, { type Scales, type View } from '../components/Canvas'
import { Brief, Btn, Divider, Note, Panel, PyChip } from '../components/Overlay'
import Vaststelling, { getal } from '../components/Vaststelling'
import { clamp } from '../lib/regression'
import {
  AANTAL_PIXELS,
  ZIJDE,
  keuze,
  keuzes,
  laadPixelModel,
  tel,
  verschuif,
  zekerheden,
  type PixelModel,
} from '../lib/mnist'
import { DATA, FOUT, FOUT_INK, INK, MODEL, MUTED, NAVY, RULE } from '../lib/palette'

/* ------------------------------------------------------------------ *
 * mAIstros 2 - les 4 - Pixel per pixel.
 *
 * EEN DOEL: dit model kijkt naar vaste pixels, dus één pixel verschuiven
 * maakt het slechter. Alles op dit bord staat er om dat te laten zien,
 * en niets anders.
 *
 * WAAROM DE TITEL "PIXEL PER PIXEL" IS EN NIET "VAKJE PER VAKJE".
 * De les zegt het zelf, op slide 2128303: "de beeldjes zijn 28x28 pixels".
 * Het woord van de leerling is dus `pixel`, en één begrip krijgt in dit
 * project één woord over de slides, de hints en de borden heen. De
 * bestandsnaam van dit bord staat vast (VakjePerVakje.tsx), maar die leest
 * geen leerling; de titel op het bord leest hij wel. Ook `beeldje`,
 * `cijfer`, `juist` en `fout` zijn de woorden van deze les zelf, en
 * `test set` staat in de woordenlijst van het project.
 *
 * ALLE GETALLEN OP DIT BORD WORDEN LIVE GEREKEND, met de gewichten van het
 * model uit de les. Er staat nergens een getal in de tekst, ook niet het
 * aantal beeldjes: dat komt uit het exportbestand. Nagerekend met sklearn en
 * daarna met deze TypeScript zelf, identiek in beide:
 *
 *   stand                juist van 120     ander antwoord dan in het midden
 *   in het midden          111   92,5 %                                   0
 *   1 pixel omhoog         103   85,8 %                                  14
 *   1 pixel omlaag         100   83,3 %                                  20
 *   1 pixel naar links     103   85,8 %                                  18
 *   1 pixel naar rechts    102   85,0 %                                  16
 *   omhoog en links         87   72,5 %                                  32
 *   omhoog en rechts        97   80,8 %                                  21
 *   omlaag en links         94   78,3 %                                  26
 *   omlaag en rechts        86   71,7 %                                  36
 *
 * Het openingsbeeldje (MNIST 16084, een echte 5) gaat van 90% zeker een 5
 * naar 97% zeker een 3 bij één pixel omhoog.
 *
 * WAAROM ER EEN TELLER OP STAAT, EN WAAROM OVER 120 BEELDJES. Een
 * willekeurige 5 kantelt NIET bij één pixel: dat doet ongeveer 4% per
 * richting. Het openingsbeeldje is dus met opzet gekozen, en dan mag het bord
 * niet suggereren dat elk beeldje zo reageert. De verdedigbare zin daarvoor is
 * niet een tweede anekdote maar de teller.
 *
 * Die teller moet dan wel groot genoeg zijn, en dat is GEMETEN, niet gekozen.
 * Over 2000 steekproeven uit de 300 beeldjes van het eerste exportbestand,
 * hoe vaak minstens één van de acht richtingen NIET zakt:
 *
 *   60 beeldjes   249 van 2000  12,4 %
 *   80 beeldjes    72 van 2000   3,6 %
 *  100 beeldjes    16 van 2000   0,8 %
 *  120 beeldjes     9 van 2000   0,5 %
 *  150 beeldjes     1 van 2000   0,1 %
 *
 * Bij een handvol beeldjes spreekt de teller het doel van dit bord dus tegen:
 * op de eerste 30 was "omlaag" en "naar rechts" exact even juist als het
 * midden, en op de eerste 40 was "omlaag" zelfs béter. Vandaar 120: klein
 * genoeg om het bestand te halveren, groot genoeg dat alle acht de richtingen
 * zakken, met de kleinste marge op 6,7 procentpunt. Zet dit nooit lager
 * zonder die tabel opnieuw te maken.
 *
 * WAAROM ER NOOIT INKT AFVALT. Het exportbestand bevat alleen beeldjes met
 * minstens één lege pixel langs alle vier de randen, en het bord schuift
 * hoogstens één pixel per as. Nagerekend over 9 standen x 120 beeldjes: de
 * som van de pixelwaarden blijft exact gelijk. Zonder die grens zou het
 * bord twee lessen door elkaar halen - "verschuiven verwart het model" en
 * "het cijfer is afgesneden". Naar beneden schuiven is de smerigste richting
 * (over alle 70.000 MNIST-beeldjes verliest 1 pixel omlaag bij 813 beeldjes
 * inkt, dus ongeveer 81 van de 7000 van een test set, tegen 2 bij omhoog), en
 * precies daarom staat die grens er. Op deze 120 verliest geen enkele
 * richting inkt, en daarom mag het bord ze alle vier aanbieden.
 * ------------------------------------------------------------------ */

/**
 * Het venster is 30 bij 48 eenheden. Canvas kadert dat venster precies in wat
 * de panelen vrij laten, dus één eenheid wordt `min(vrijBreed/30,
 * vrijHoog/48)` pixels, en dat is de zijde van één pixel van het beeldje.
 *
 * Die 48 is GEMETEN, niet gekozen. De stapel is 28 eenheden beeldje plus een
 * vaste voet in pixels (de kop, tien balken en twee antwoordregels), en die
 * voet krimpt niet mee op een smal scherm. Opnieuw nagemeten in de browser,
 * met de bovenrand van het kader en de onderrand van de laatste antwoordregel,
 * allebei ten opzichte van de bovenkant van het bord:
 *
 *              k      stapel   van boven   tot onder   bord hoog
 *   1440x900   17,2     767         37         804        900
 *   1366x768   14,5     690         33         723        768
 *   1280x800   15,1     709         35         744        800
 *   1280x720   13,5     662         19         681        720
 *   1024x768   14,5     690         29         719        768
 *    900x700   13,0     649         15         664        700
 *
 * De stapel staat gecentreerd, en op de twee laagste schermen is hij 16 en
 * 23 px hoger dan het vlak dat de panelen strikt vrij laten (646 en 626 px).
 * Dat mag: die 26 px boven en 48 px onder zijn de marge voor astekst, geen
 * harde rand. Wat WEL hard is, is de laatste kolom - de onderste
 * antwoordregel eindigt op elk formaat minstens 36 px boven de onderkant van
 * het bord, en er staat op geen enkel formaat bordtekst op een paneel.
 *
 * Bij 44 liep 1024x768 er 24 px over, en dan verdwijnt de onderste balk of
 * de antwoordregel onder de rand: op een beamer leest dat als een bord dat
 * stuk is. Verlaag dit nooit zonder die zes sommen opnieuw te maken.
 */
const VENSTER: View = { x0: 0, x1: 30, y0: 0, y1: 48 }

/** Ruimte tussen het beeldje en de kop boven de balken, met de regel over de
 *  stippellijn ertussen. */
const NA_BEELD = 34
/** De kopregel boven de balken. */
const KOP = 20
/** Tussen de laatste balk en de twee antwoordregels. */
const NA_BALKEN = 8

const NUL = new Uint8Array(AANTAL_PIXELS)

/** 0,904 -> "90%", en alles onder een half procent -> "<1%". */
function procent(p: number): string {
  return p < 0.005 ? '<1%' : `${Math.round(p * 100)}%`
}

/** De verschuiving in woorden. Dit is de enige plaats waar ze beschreven staat. */
function standInWoorden(dy: number, dx: number): string {
  const delen: string[] = []
  if (dy === -1) delen.push('1 pixel omhoog')
  if (dy === 1) delen.push('1 pixel omlaag')
  if (dx === -1) delen.push('1 pixel naar links')
  if (dx === 1) delen.push('1 pixel naar rechts')
  return delen.length === 0 ? 'in het midden' : delen.join(' en ')
}

export default function VakjePerVakje() {
  const [model, setModel] = useState<PixelModel | null>(null)
  const [laadfout, setLaadfout] = useState<string | null>(null)
  useEffect(() => {
    let levend = true
    laadPixelModel()
      .then((m) => {
        if (levend) setModel(m)
      })
      .catch((e: unknown) => {
        /* De technische reden gaat naar de console en niet naar het bord. Een
           leerling kan niets met "Unexpected token '<'" - dat is wat een
           ontbrekend bestand hier oplevert, want de host stuurt dan index.html
           terug in plaats van een 404. Op het bord staat wat hij wel kan doen. */
        console.error('les4: het pixelmodel laadt niet', e)
        if (levend) setLaadfout('Herlaad de pagina.')
      })
    return () => {
      levend = false
    }
  }, [])

  /** Welk beeldje groot op het bord staat. 0 is de 5 die naar een 3 kantelt. */
  const [nr, setNr] = useState(0)
  const [dy, setDy] = useState(0)
  const [dx, setDx] = useState(0)

  /* Eén modulo voor het beeldje EN voor zijn cijfer, want twee losse modulo's
     op twee lijsten kunnen uit de pas gaan lopen en dan staat er een ring bij
     het cijfer van een ander beeldje. */
  const aantal = model ? model.beelden.length : 0
  const plek = aantal === 0 ? 0 : nr % aantal
  const beeld = model ? model.beelden[plek] : NUL
  const echt = model ? model.echt[plek] : -1
  const geschoven = useMemo(() => verschuif(beeld, dy, dx), [beeld, dy, dx])
  const zeker = useMemo(
    () => (model ? zekerheden(model, geschoven) : new Float64Array(10)),
    [model, geschoven],
  )
  const gekozen = model ? keuze(zeker) : -1

  /* De teller. `midden` is de keuze zonder verschuiving en verandert dus nooit;
     hij wordt één keer per model gerekend. `nu` verandert alleen als de stand
     verandert, niet als de leerling een ander beeldje kiest. */
  const midden = useMemo(() => (model ? keuzes(model, 0, 0) : new Int8Array(0)), [model])
  const nu = useMemo(() => (model ? keuzes(model, dy, dx) : new Int8Array(0)), [model, dy, dx])
  const teller = useMemo(
    () => (model ? tel(model, nu, midden) : null),
    [model, nu, midden],
  )

  const stand = standInWoorden(dy, dx)

  return (
    <div className="relative h-full w-full">
      {/*
        Geen astekst: het vlak is hier een beeldje van 28 bij 28 pixels met
        balken eronder, geen grafiek. Getallen langs de randen zouden zeggen
        dat de plaats op het bord een waarde heeft, en dat is hier niet zo.
      */}
      <Canvas defaultView={VENSTER} axes={false}>
        {(s) =>
          model && teller ? (
            <Bord
              s={s}
              beeld={geschoven}
              midden={beeld}
              zeker={zeker}
              gekozen={gekozen}
              echt={echt}
            />
          ) : (
            /* Een paneel dat nog niets te tonen heeft, tekent het lege kader en
               zegt dat. Het kader staat er dus van de eerste tel. */
            <Leeg
              s={s}
              melding={laadfout ? `Het model laadt niet. ${laadfout}` : 'Het model wordt geladen.'}
            />
          )
        }
      </Canvas>

      {/*
        De eerste alinea is het DOEL. Brief toont die altijd en klapt alleen
        alles daarna in, dus op een beamer is dit de enige zin die een leerling
        zeker leest. Wie hier vanaf een slide binnenvalt, ziet de portaalkaart
        nooit: staat het doel niet op het bord, dan staat het nergens.
      */}
      <Brief eyebrow="mAIstros 2 - les 4" title="Pixel per pixel">
        {/* Twee zinnen, en "het model" voluit. In "maakt het slechter" had `het`
            geen antecedent op het scherm: er staat geen zelfstandig naamwoord
            voor waar het naar terugwijst. De woorden zijn verder exact die van
            de portaalkaart op de overzichtspagina, want dat is dezelfde belofte
            en die mag niet in twee talen staan. */}
        <p>Dit model kijkt naar vaste pixels. Eén pixel verschuiven maakt het model slechter.</p>
        <p>Verschuif het beeldje één pixel. Kijk wat de balken doen.</p>
        {/* Het aantal komt uit het exportbestand, niet uit deze zin. Zolang
            het model laadt staat er "alle", want dan is er nog niets geteld. */}
        <p>
          De teller doet hetzelfde met {aantal > 0 ? getal(aantal) : 'alle'} beeldjes uit de test
          set.
        </p>
      </Brief>

      {/*
        LINKSONDER: de teller die het doel meet, en de knoppen. Dit paneel
        staat er van bij het begin en verandert nooit van breedte. Canvas meet
        elk paneel naast het bord en reserveert die breedte, dus een paneel dat
        pas na een klik verschijnt zou het hele bord opnieuw kaderen terwijl de
        leerling ernaar kijkt.

        De hoogte is begrensd zoals op de andere borden, zodat de Brief
        bovenaan altijd vrij blijft. Alleen de uitleg onderin scrollt: de kop,
        de teller en de knoppen staan vast, want een knop onder de vouw leest
        als een knop die er niet is.
      */}
      <Panel className="pointer-events-auto absolute bottom-4 left-4 z-10 flex max-h-[calc(100%-12rem)] w-[16rem] flex-col px-4 py-3.5 xl:max-h-[calc(100%-15rem)] xl:w-[21rem]">
        <div className="shrink-0">
          {/* De vaststelling, en niet een tweede getal ernaast: één regel die
              zegt wat de leerling nu waar gemaakt heeft. Alles erin wordt
              geteld uit de stand van het bord, en de getallen gaan door
              `getal()` uit Vaststelling, zodat de duizendtallen en het
              decimaalteken op elk bord hetzelfde zijn.

              Vaste hoogte, ook als de detailregel er één nodig heeft. Anders
              schuift alles eronder op zodra die regel omslaat, en dan valt de
              laatste regel van dit paneel bij 1024x768 net onder de rand.
              4,7rem is de gemeten hoogte van de hoogste stand, niet een ronde
              marge: 6,6rem duwde 15 px van de uitleg onder de rand.

              De detailregel staat er als label en getal en niet als zin, want
              in het smalste paneel is 222 px tekstbreedte en dan past geen
              enkele zin met "beeldjes" erin op één regel - gemeten met de
              echte letter: "0 beeldjes krijgen een ander antwoord." is 235 px
              en slaat dus om.

              Het label noemt wél waar het getal over gaat. "Anders dan in het
              midden: 14" opende met een kaal bijwoord: een leerling leest 14
              en weet niet wat er anders is. "Ander antwoord" noemt het ding
              zelf, en is met 118 px ook smaller dan de 177 px van daarvoor. */}
          <div className="min-h-[4.7rem]">
            <Vaststelling
              label="Juist"
              value={teller ? teller.juist : null}
              outOf={teller ? { total: teller.totaal, noun: 'beeldjes' } : undefined}
              detail={teller ? `Ander antwoord: ${getal(teller.anders)}.` : undefined}
              empty="Het model wordt geladen."
              color={NAVY}
            />
          </div>

          <Divider />

          {/* "Stand" en niet "Verschoven": in de begintoestand las dat als
              "Verschoven: in het midden", en dat spreekt zichzelf tegen. Alle
              andere kopjes op de borden zijn korte zelfstandige naamwoorden
              ("Grens", "Juist", "Het handvat"), een voltooid deelwoord niet. */}
          <div className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-ink/75">
            Stand
          </div>
          <div className="mt-0.5 text-[14.5px] font-semibold leading-snug text-ink">{stand}</div>

          {/* Elke knop die niets meer kan doen, staat uit. Een knop die je kan
              indrukken en waar niets van verandert, leest als een bord dat
              stuk is. Verder dan één pixel per as gaat het niet: zie de kop
              van dit bestand. */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Btn variant="ghost" disabled={!model || dy === -1} onClick={() => setDy(dy - 1)}>
              Omhoog
            </Btn>
            <Btn variant="ghost" disabled={!model || dy === 1} onClick={() => setDy(dy + 1)}>
              Omlaag
            </Btn>
            <Btn variant="ghost" disabled={!model || dx === -1} onClick={() => setDx(dx - 1)}>
              Links
            </Btn>
            <Btn variant="ghost" disabled={!model || dx === 1} onClick={() => setDx(dx + 1)}>
              Rechts
            </Btn>
            <Btn
              disabled={!model || (dy === 0 && dx === 0)}
              onClick={() => {
                setDy(0)
                setDx(0)
              }}
            >
              In het midden
            </Btn>
          </div>

          {/* Geen streepje boven deze knop meer: dat kostte 21 px die de
              uitleg onderin nodig had. De knop hoort ook bij dezelfde groep -
              alle vijf hierboven veranderen de stand, deze verandert het
              beeldje, en de eigen regel eronder zegt welk beeldje dat is.

              De verschuiving blijft staan als je een ander beeldje neemt: dat
              is één stand voor het hele bord, en ze staat in woorden boven de
              knoppen. Ze stil terugzetten zou de klik van de leerling
              ongedaan maken zonder dat hij het ziet. */}
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1.5">
            <Btn variant="ghost" disabled={!model} onClick={() => setNr(nr + 1)}>
              Ander beeldje
            </Btn>
            {/* Waar de leerling in de rij zit. Zonder dit is "Ander beeldje"
                een knop zonder bodem: de teller gaat over een set die je niet
                kan overzien. Met het nummer erbij is het dezelfde set die je
                zelf kan doorlopen. Beide getallen komen uit de toestand. */}
            {aantal > 0 && (
              <span className="text-[13px] tabular-nums text-ink/80">
                beeldje {getal(plek + 1)} van de {getal(aantal)}
              </span>
            )}
          </div>
        </div>

        <div className="mt-2.5 min-h-0 overflow-y-auto">
          {/* Twee alinea's, niet drie: bij 900x700 en 1024x768 viel de derde
              onder de rand van dit paneel. De weggelaten derde zei dat het
              model de test set niet zag tijdens het trainen, en dat is precies
              wat de les zelf al uitlegt bij Stap 5. */}
          <Note>
            {/* Deze zin staat eerst omdat ze de eerlijkheid van dit bord
                draagt: het openingsbeeldje is met opzet gekozen en ongeveer
                4% van de beeldjes kantelt per richting, dus het bord mag niet
                suggereren dat elk beeldje zo reageert. Als er iets onder de
                rand valt, moet het deze zin niet zijn. */}
            <p>Niet elk beeldje verandert van antwoord. De teller zegt bij hoeveel wel.</p>
            {/* De tweede zin van deze alinea ("dezelfde vorm één pixel
                verderop is dus iets anders") stond hier ook, en die zegt in
                andere woorden wat de doelzin van de Brief al zegt. */}
            <p className="mt-1.5">Het model leerde per pixel welk cijfer daar hoort.</p>
          </Note>

          <div className="mt-2 text-[11.5px] leading-relaxed text-muted">
            In je notebook: <PyChip>lrmodel.predict(x_test)</PyChip>
          </div>
        </div>
      </Panel>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * De meetkunde van de stapel. Beeldje boven, balken onder, samen
 * gecentreerd in het vlak dat de panelen vrij laten.
 * ------------------------------------------------------------------ */

type Maten = {
  /** De zijde van één pixel van het beeldje, in schermpixels. */
  k: number
  /** De breedte van de stapel: het beeldje EN de balken zijn even breed. */
  breed: number
  /** Hoogte van één balkregel. */
  regel: number
  /** Lettergrootte van de twee antwoordregels. */
  maat: number
  links: number
  boven: number
  hoogte: number
}

function meet(s: Scales): Maten {
  /* Eén schaal voor x en y, zodat een pixel van het beeldje vierkant is.
     Canvas rekt beide assen los van elkaar tot het vrije vlak, dus zonder die
     gelijke schaal wordt een vierkant beeldje een liggende strook. */
  const k = Math.min(1 / s.unitPerPx.x, 1 / s.unitPerPx.y)
  const breed = ZIJDE * k
  /* Ondergrens 17,5 px, want daaronder past de 13 px tekst in een balkregel
     niet meer, en 13 px is de bodem voor tekst die je van achter in de klas
     moet lezen. Bovengrens 26 px: groter voegt niets toe en duwt de
     antwoordregels naar beneden. */
  const regel = clamp(k, 17.5, 26)
  const maat = clamp(breed / 24, 13, 15.5)
  const hoogte = breed + NA_BEELD + KOP + 10 * regel + NA_BALKEN + 2 * (maat * 1.5)
  return {
    k,
    breed,
    regel,
    maat,
    links: s.sx(15) - breed / 2,
    boven: s.sy(24) - hoogte / 2,
    hoogte,
  }
}

/** Het kader van 28 bij 28 met de rasterlijnen. De pixels komen erbovenop. */
function Kader({ m }: { m: Maten }) {
  const lijnen: number[] = []
  for (let i = 1; i < ZIJDE; i++) lijnen.push(i)
  return (
    <>
      <rect x={m.links} y={m.boven} width={m.breed} height={m.breed} fill="#fff" />
      {/* De rasterlijnen maken zichtbaar dat het beeldje uit pixels bestaat.
          Zonder die lijnen is "één pixel opschuiven" een sprong van niets. */}
      {lijnen.map((i) => (
        <line
          key={`v${i}`}
          x1={m.links + i * m.k}
          y1={m.boven}
          x2={m.links + i * m.k}
          y2={m.boven + m.breed}
          stroke={RULE}
        />
      ))}
      {lijnen.map((i) => (
        <line
          key={`h${i}`}
          x1={m.links}
          y1={m.boven + i * m.k}
          x2={m.links + m.breed}
          y2={m.boven + i * m.k}
          stroke={RULE}
        />
      ))}
      <rect
        x={m.links}
        y={m.boven}
        width={m.breed}
        height={m.breed}
        fill="none"
        stroke={MUTED}
        strokeWidth={1.5}
      />
    </>
  )
}

function Leeg({ s, melding }: { s: Scales; melding: string }) {
  const m = meet(s)
  return (
    <>
      <Kader m={m} />
      <text
        x={m.links}
        y={m.boven + m.breed + NA_BEELD + 14}
        fontSize={m.maat}
        fontWeight={700}
        fill={INK}
        stroke="#fff"
        strokeWidth={3.5}
        paintOrder="stroke"
      >
        {melding}
      </text>
    </>
  )
}

/** Het kleinste rechthoekje dat alle pixels met inkt bevat. */
function omtrek(beeld: Uint8Array) {
  let r0 = ZIJDE
  let r1 = -1
  let k0 = ZIJDE
  let k1 = -1
  for (let i = 0; i < AANTAL_PIXELS; i++) {
    if (beeld[i] === 0) continue
    const r = Math.floor(i / ZIJDE)
    const k = i % ZIJDE
    if (r < r0) r0 = r
    if (r > r1) r1 = r
    if (k < k0) k0 = k
    if (k > k1) k1 = k
  }
  return { r0, r1, k0, k1 }
}

function Bord({
  s,
  beeld,
  midden,
  zeker,
  gekozen,
  echt,
}: {
  s: Scales
  beeld: Uint8Array
  /** Hetzelfde beeldje zonder verschuiving. Alleen voor de stippellijn. */
  midden: Uint8Array
  zeker: Float64Array
  gekozen: number
  echt: number
}) {
  const m = meet(s)
  const juist = gekozen === echt

  /* Alleen de pixels met inkt worden getekend. De rest is de witte
     achtergrond van MNIST, en 630 lege rechthoeken tekenen kost alleen tijd. */
  const inkt: { i: number; v: number }[] = []
  for (let i = 0; i < AANTAL_PIXELS; i++) if (beeld[i] > 0) inkt.push({ i, v: beeld[i] })

  /* De stippellijn: waar het beeldje staat als je het niet verschuift. Eén
     pixel opschuiven is 1/28 van het kader, en dat ziet een leerling die naar
     twee beeldjes na elkaar kijkt niet. Tegen deze lijn is het wel te meten. */
  const o = omtrek(midden)

  const balkenBoven = m.boven + m.breed + NA_BEELD + KOP
  const antwoordBoven = balkenBoven + 10 * m.regel + NA_BALKEN + m.maat
  /* De vaste stroken in een balkregel, van links naar rechts: twee merken, het
     cijfer, de balk, het percentage. In pixels en niet in eenheden, want het
     is tekst en die krimpt niet mee. */
  const merkA = m.links + 9
  const merkB = m.links + 26
  const cijferX = m.links + 46
  const balkX = m.links + 54
  const balkBreed = Math.max(40, m.breed - 54 - 48)

  return (
    <>
      <Kader m={m} />
      {o.r1 >= 0 && (
        <rect
          x={m.links + o.k0 * m.k}
          y={m.boven + o.r0 * m.k}
          width={(o.k1 - o.k0 + 1) * m.k}
          height={(o.r1 - o.r0 + 1) * m.k}
          fill="none"
          stroke={MUTED}
          strokeWidth={1.25}
          strokeDasharray="4 3"
        />
      )}
      {inkt.map(({ i, v }) => (
        <rect
          key={i}
          x={m.links + (i % ZIJDE) * m.k}
          y={m.boven + Math.floor(i / ZIJDE) * m.k}
          width={m.k}
          height={m.k}
          fill={DATA}
          fillOpacity={v / 255}
        />
      ))}

      {/* 13 px en niet 12,5: dat is de ondergrens voor tekst die van achter in
          de klas gelezen wordt, en deze twee bijschriften stonden eronder. Ze
          zijn geen astekst - dat is het enige wat in dit project 12,5 mag zijn
          - maar de twee regels die zeggen wat de stippellijn en de balken
          betekenen. Gemeten op 900x700, het smalste bord: deze regel loopt tot
          x 625 in een kader dat tot 788 reikt, dus er is 162 px over en de
          halve pixel extra breedte raakt niets.

          Beide regels hebben dezelfde vorm, "ding: wat het is". De tweede was
          "Hoe zeker is het model, per cijfer": een vraag zonder vraagteken,
          met een komma die er een brokstuk van maakte. */}
      <text
        x={m.links}
        y={m.boven + m.breed + 16}
        fontSize={13}
        fontWeight={600}
        fill={MUTED}
        stroke="#fff"
        strokeWidth={3.5}
        paintOrder="stroke"
      >
        stippellijn: het beeldje in het midden
      </text>

      <text
        x={m.links}
        y={balkenBoven - 7}
        fontSize={13}
        fontWeight={600}
        fill={MUTED}
        stroke="#fff"
        strokeWidth={3.5}
        paintOrder="stroke"
      >
        balken: hoe zeker het model is per cijfer
      </text>

      {Array.from({ length: 10 }, (_, c) => {
        const y = balkenBoven + c * m.regel
        const mid = y + m.regel / 2
        const hoog = Math.max(9, m.regel * 0.56)
        const p = zeker[c]
        return (
          <g key={c}>
            <rect
              x={balkX}
              y={mid - hoog / 2}
              width={balkBreed}
              height={hoog}
              fill={RULE}
              fillOpacity={0.85}
              rx={2}
            />
            <rect
              x={balkX}
              y={mid - hoog / 2}
              width={Math.max(0, p * balkBreed)}
              height={hoog}
              fill={c === gekozen && !juist ? FOUT : MODEL}
              rx={2}
            />
            {/* De keuze van het model: een driehoek, niet alleen een kleur. */}
            {c === gekozen && (
              <path
                d={`M ${merkA - 4} ${mid - 6} L ${merkA + 5} ${mid} L ${merkA - 4} ${mid + 6} Z`}
                fill={juist ? MODEL : FOUT}
              />
            )}
            {/* Het echte cijfer: een ring. Die is met opzet in de neutrale
                tekstkleur en niet in een derde merkkleur: de derde merkkleur is
                groen, en groen naast het gebrande oranje van FOUT valt onder
                protanopie samen (dE 4,0). De betekenis hangt hier aan de VORM
                en aan het woord op de antwoordregel, niet aan de kleur. */}
            {c === echt && (
              <circle cx={merkB} cy={mid} r={4.5} fill="#fff" stroke={INK} strokeWidth={2} />
            )}
            <text
              x={cijferX}
              y={mid + 5.5}
              textAnchor="end"
              fontSize={15.5}
              fontWeight={800}
              fill={INK}
              stroke="#fff"
              strokeWidth={3.5}
              paintOrder="stroke"
            >
              {c}
            </text>
            <text
              x={m.links + m.breed}
              y={mid + 4.5}
              textAnchor="end"
              fontSize={13}
              fontWeight={700}
              fill={c === gekozen ? (juist ? MODEL : FOUT_INK) : MUTED}
              stroke="#fff"
              strokeWidth={3.5}
              paintOrder="stroke"
            >
              {procent(p)}
            </text>
          </g>
        )
      })}

      {/* De twee antwoordregels. Elke toestand heeft zijn eigen vorm, zijn
          eigen getal en zijn eigen woord, dus niets hangt aan kleur alleen. */}
      <path
        d={`M ${m.links + 4} ${antwoordBoven - 5} L ${m.links + 13} ${antwoordBoven + 1} L ${m.links + 4} ${antwoordBoven + 7} Z`}
        fill={juist ? MODEL : FOUT}
      />
      <text
        x={m.links + 20}
        y={antwoordBoven + 6}
        fontSize={m.maat}
        fontWeight={700}
        fill={juist ? INK : FOUT_INK}
        stroke="#fff"
        strokeWidth={3.5}
        paintOrder="stroke"
      >
        {`de keuze van het model: ${gekozen} - ${juist ? 'juist' : 'fout'}`}
      </text>
      <circle
        cx={m.links + 8.5}
        cy={antwoordBoven + m.maat * 1.5 + 1}
        r={4.5}
        fill="#fff"
        stroke={INK}
        strokeWidth={2}
      />
      <text
        x={m.links + 20}
        y={antwoordBoven + m.maat * 1.5 + 6}
        fontSize={m.maat}
        fontWeight={700}
        fill={INK}
        stroke="#fff"
        strokeWidth={3.5}
        paintOrder="stroke"
      >
        {`het echte cijfer: ${echt}`}
      </text>
    </>
  )
}
