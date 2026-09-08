import { useMemo, useRef, useState } from 'react'
import Canvas, { type Scales, type View } from '../components/Canvas'
import { Brief, Btn, Divider, Note, Panel, PyChip } from '../components/Overlay'
import Vaststelling, { getal } from '../components/Vaststelling'
import { clamp } from '../lib/regression'
import { DATA, DERDE, DERDE_INK, FOUT, FOUT_INK, INK, MODEL, MUTED, NAVY } from '../lib/palette'
import {
  BAND,
  RIJEN,
  VENSTER,
  boomGrens,
  boomVerschuiving,
  naastDeGrens,
  opKenmerk,
  regressieGrens,
  regressieVerschuiving,
  regressieX,
  strook,
  type Grens,
  type Klasse,
  type RegGrens,
  type Rij,
} from '../lib/tree'

/* ------------------------------------------------------------------ *
 * mAIstros 2 - les 5 - Waar legt de boom zijn grens?
 *
 * EEN DOEL: de boom trekt zijn grens op één plek en negeert de rest,
 * regressie past zich aan bij elk punt. Beide modellen staan daarom
 * TEGELIJK op het bord. Anders is het verschil een bewering en niet een
 * bord: je moet de blauwe lijn zien meeschuiven terwijl de groene blijft
 * staan, in dezelfde sleepbeweging.
 *
 * DE OORSPRONKELIJKE CLAIM IS GEMETEN EN GESNEUVELD. "Sleep een punt ver
 * weg en er beweegt NIETS" is niet waar voor een boom met de standaard-
 * instellingen: die verschoof in 100% van 900 sleepbewegingen, mediaan 15%
 * van het bord. De metingen en de drie voorwaarden waaronder de claim wél
 * standhoudt staan in src/lib/tree.ts, bij de data set waar ze op gedaan
 * zijn. Twee daarvan dwingt dit bord af in de DATA en in het MODEL:
 * scheidbaar op één kenmerk, en een boom van één vraag.
 *
 * DE DERDE VOORWAARDE DWINGT DIT BORD NIET AF, EN DAT IS OPZET. Ze zegt dat
 * het punt buiten de strook moet blijven. Dat kun je op twee manieren doen:
 * de leerling tegenhouden, of het hem laten zien. Tegenhouden zou precies de
 * scherpste helft van de les wegnemen - dat de boom naar één plek kijkt - en
 * zou een bord maken dat alleen klopt zolang niemand het uitprobeert. Dus
 * staat de strook op het bord, mag de leerling erin neerleggen, en zegt het
 * bord dan gewoon hoeveel de grens verschoof.
 *
 * WAAROM KLEINSTE KWADRATEN EN GEEN LOGISTISCHE REGRESSIE: gemeten beweegt de
 * logistische grens bij zo'n sleepbeweging 0,09% van het bord. Dan lijken
 * beide modellen bevroren en is er geen les. Zie tree.ts.
 *
 * ELK GETAL OP DIT BORD WORDT GEREKEND uit de stand van de punten. Er staat
 * nergens een getal in een zin, ook niet "0 px" - juist dat getal moet uit de
 * meting komen, anders belooft het bord iets wat het niet nakijkt.
 * ------------------------------------------------------------------ */

const DEFAULT_VIEW: View = VENSTER

/** De boom en de regressiegrens van de ONGEWIJZIGDE data set. Alles wat het
 *  bord "verschoven" noemt, is gemeten tegen deze twee. */
const GRENS_BEGIN = boomGrens(RIJEN)
const REG_BEGIN = regressieGrens(RIJEN)

/** Halve hoogte van de meetband: daar lezen we de plaats van een grens af. */
const MIDDEN_BAND = (BAND.y0 + BAND.y1) / 2

/** Waar de twee soortlabels op het bord staan. Vast, uit de begintoestand
 *  gerekend: een label dat met het gemiddelde meeschuift, danst bij elke
 *  sleepbeweging heen en weer en is dan geen label meer maar beweging. */
function middenVan(klasse: Klasse) {
  const groep = RIJEN.filter((r) => r.klasse === klasse)
  return groep.reduce((s, r) => s + r.x, 0) / groep.length
}
const MIDDEN_SOORT_1 = middenVan(0)
const MIDDEN_SOORT_2 = middenVan(1)

const soortNaam = (k: Klasse) => (k === 0 ? 'Soort 1' : 'Soort 2')
const kenmerkNaam = (k: 0 | 1) => (k === 0 ? 'kenmerk 1' : 'kenmerk 2')

/**
 * De zin onder een verschuiving. Ze BESCHRIJFT, ze prijst niet en ze straft
 * niet, en ze mag het grote getal nooit tegenspreken.
 *
 * Dat laatste is de reden dat er drie gevallen zijn en niet één. Op twee
 * decimalen wordt een verschuiving van 0,001 als "0,00" afgedrukt, en dan zou
 * "de grens staat nu op 68,20 en begon op 68,20" een verschuiving beweren die
 * je nergens ziet, of erger: een echte verschuiving als nul verkopen. Exact
 * nul krijgt dus zijn eigen zin, en te klein om te tonen ook.
 *
 * En alle drie beginnen met "de grens", niet met "ze". Het onderwerp van deze
 * zinnen staat nergens op het scherm: het label erboven zegt "Grens van de
 * boom", en een leerling die met de zin begint weet bij "Ze staat nu op..."
 * niet waarover het gaat.
 */
function verschuivingZin(verschuiving: number, nu: number, begin: number): string {
  if (verschuiving === 0) return `De grens staat nog exact op ${getal(begin, 2)}, waar ze begon.`
  if (verschuiving < 0.005) return 'De grens verschoof, maar minder dan een honderdste.'
  return `De grens staat nu op ${getal(nu, 2)} en begon op ${getal(begin, 2)}.`
}

export default function WaarLegtDeBoomZijnGrens() {
  const [rijen, setRijen] = useState<Rij[]>(() => RIJEN.map((r) => ({ ...r })))

  /**
   * Welk punt de leerling vastheeft. Er is er precies één, en het heet een
   * handvat: `punt` is in deze reeks het woord voor data en data sleep je
   * niet. Zo staat er ook nooit meer dan één ding op het bord dat beweegt.
   *
   * Het bord opent op een punt ver van de strook, dus de eerste sleepbeweging
   * die een leerling maakt is meteen de sleepbeweging waar het om gaat.
   */
  const [handvat, setHandvat] = useState(() => verstePunt(RIJEN))

  const grens = useMemo(() => boomGrens(rijen), [rijen])
  const reg = useMemo(() => regressieGrens(rijen), [rijen])
  const naast = useMemo(() => (grens ? naastDeGrens(rijen, grens) : []), [rijen, grens])
  const band = useMemo(() => (grens ? strook(rijen, grens) : null), [rijen, grens])

  const verplaatst = rijen.some((r, i) => r.x !== RIJEN[i].x || r.y !== RIJEN[i].y)
  const houdtVast = naast.includes(handvat)
  /** Het punt dat nu het verst buiten de strook ligt. Eén keer gerekend: de
   *  knop en zijn eigen uit-stand moeten hetzelfde punt bedoelen. */
  const verst = useMemo(() => verstePunt(rijen), [rijen])

  /* --------------------------- de twee getallen ---------------------------
   * Dezelfde maat voor beide modellen: de zijwaartse afstand tot waar de
   * grens begon, in de eenheden van het kenmerk. Voor de verticale boomgrens
   * is dat het verschil van de drempels, voor de hellende regressiegrens het
   * gemiddelde over de vaste band - en dat is voor een verticale lijn exact
   * hetzelfde getal. Zie tree.ts. Zonder die gelijkheid zou het bord twee
   * getallen naast elkaar zetten die niet te vergelijken zijn.               */
  const boomShift = grens && GRENS_BEGIN ? boomVerschuiving(GRENS_BEGIN, grens) : null
  const regShift = reg && REG_BEGIN ? regressieVerschuiving(REG_BEGIN, reg) : null

  return (
    <div className="relative h-full w-full">
      <Canvas defaultView={DEFAULT_VIEW} xLabel="kenmerk 1" yLabel="kenmerk 2">
        {(s) => {
          /* De vijf tekstrijen van het bord, en waarom ze precies hier staan:
             kenmerk 2 loopt maar van 20 tot 90 in een venster tot 100, dus
             boven en onder de wolk is een strook vrij. Gemeten op 1024x768
             ligt de wolk tussen y 125 en y 581, staan de twee rijen bovenaan
             op 46 en 72, en de drie onderaan op 636, 662 en 688 - alle vijf
             buiten de wolk, en de onderste nog 10 px boven de astekst van
             Canvas. Een aanduiding die over een punt valt, kost een punt. */
          const rijA = s.safe.top + 20
          const rijB = s.safe.top + 46
          const onderC = s.safe.bottom - 84
          const onderD = s.safe.bottom - 58
          const onderE = s.safe.bottom - 32
          return (
            <>
              {/* De strook: de enige plek waar de boom naar kijkt. Heel licht,
                  want ze moet van achter in de klas te zien zijn zonder de
                  punten en de twee lijnen te overstemmen. */}
              {band && grens?.kenmerk === 0 && (
                <rect
                  x={s.sx(band.van)}
                  y={s.area.top}
                  width={Math.max(0, s.sx(band.tot) - s.sx(band.van))}
                  height={s.area.h}
                  fill={DERDE}
                  opacity={0.08}
                  pointerEvents="none"
                />
              )}
              {band && grens?.kenmerk === 1 && (
                <rect
                  x={s.area.left}
                  y={s.sy(band.tot)}
                  width={s.area.w}
                  height={Math.max(0, s.sy(band.van) - s.sy(band.tot))}
                  fill={DERDE}
                  opacity={0.08}
                  pointerEvents="none"
                />
              )}

              {/* Waar de twee grenzen begonnen. Zonder deze streepjeslijnen
                  verandert er alleen een getal in het paneel, en dan moet een
                  leerling het bord op zijn woord geloven. */}
              {GRENS_BEGIN && <BoomLijn grens={GRENS_BEGIN} scales={s} spook />}
              {REG_BEGIN && <RegLijn grens={REG_BEGIN} scales={s} spook />}

              {/* De twee levende grenzen. Regressie eerst: waar ze samenvallen,
                  hoort de boom bovenop te liggen, want die is het onderwerp. */}
              {reg && <RegLijn grens={reg} scales={s} />}
              {grens && <BoomLijn grens={grens} scales={s} />}

              {rijen.map((r, i) =>
                i === handvat ? null : (
                  <g key={i} pointerEvents="none">
                    {naast.includes(i) && (
                      <circle
                        cx={s.sx(r.x)}
                        cy={s.sy(r.y)}
                        r={11}
                        fill="none"
                        stroke={DERDE}
                        strokeWidth={2.5}
                      />
                    )}
                    <Merk rij={r} cx={s.sx(r.x)} cy={s.sy(r.y)} />
                  </g>
                ),
              )}

              <Handvat
                rij={rijen[handvat]}
                scales={s}
                houdtVast={houdtVast}
                onMove={(p) =>
                  setRijen((oud) =>
                    oud.map((r, i) =>
                      i === handvat
                        ? {
                            ...r,
                            x: clamp(p.x, VENSTER.x0, VENSTER.x1),
                            y: clamp(p.y, VENSTER.y0, VENSTER.y1),
                          }
                        : r,
                    ),
                  )
                }
              />

              {/* ------------------------- de tekst -------------------------
                  Vaste rijen, boven en onder de wolk. Onderaan staan de drie
                  aanduidingen die bij een lijn horen, en die schuiven mee met
                  hun lijn; bovenaan de twee groepen en de strook, die stil
                  staan. De astekst van Canvas zit 10 px boven de onderrand,
                  dus rij E blijft daar 26 px boven.                          */}
              <Aanduiding x={s.sx(MIDDEN_SOORT_1)} y={rijA} anker="middle" tekst="Soort 1" />
              <Aanduiding x={s.sx(MIDDEN_SOORT_2)} y={rijA} anker="middle" tekst="Soort 2" />
              {band && grens?.kenmerk === 0 && (
                <Aanduiding
                  x={(s.sx(band.van) + s.sx(band.tot)) / 2}
                  y={rijB}
                  anker="middle"
                  kleur={DERDE_INK}
                  tekst="de strook: hier kijkt de boom"
                />
              )}

              {grens?.kenmerk === 0 && (
                <NaastLijn
                  px={s.sx(grens.drempel)}
                  y={onderC}
                  scales={s}
                  kleur={DERDE_INK}
                  tekst="grens van de boom"
                />
              )}
              {reg && (
                <NaastLijn
                  px={s.sx(regressieX(reg, s.iy(onderD)))}
                  y={onderD}
                  scales={s}
                  kleur={MODEL}
                  tekst="grens van regressie"
                />
              )}
              {GRENS_BEGIN?.kenmerk === 0 && (
                <NaastLijn
                  px={s.sx(GRENS_BEGIN.drempel)}
                  y={onderE}
                  scales={s}
                  kleur={MUTED}
                  tekst="hier begonnen de twee grenzen"
                  gereserveerd={92}
                />
              )}
            </>
          )
        }}
      </Canvas>

      {/*
        De eerste alinea is het DOEL van dit bord. Brief toont die altijd en
        klapt alleen alles daarna in, dus op een beamer is dit de enige zin die
        een leerling gegarandeerd leest. Wie hier vanaf een slide binnenvalt,
        ziet de portaalkaart nooit: staat het doel niet op het bord, dan staat
        het nergens.
      */}
      <Brief eyebrow="mAIstros 2 - les 5" title="Waar legt de boom zijn grens?">
        <p>
          De boom trekt zijn grens op één plek en negeert de rest. Regressie past zich aan bij elk
          punt.
        </p>
        {/* De opdracht staat NIET hier maar op het bord, naast het handvat
            zelf: alles onder de doelzin klapt dicht onder 1280 px, en dan zou
            de enige zin die zegt wat je moet doen op een beamer wegvallen.
            Wat hier staat, is wat de twee lijnen ZIJN. */}
        <p>De grens van de boom komt van één vraag over één kenmerk.</p>
        <p>De grens van regressie komt van het model uit les 1. Dat rekent met elk punt.</p>
      </Brief>

      {/*
        TWEE hoogtegrenzen, want de Brief is niet altijd even hoog, en de
        tweede is duur betaald.

        Ingeklapt (onder 1280 px) is de Brief hier 169 px hoog en loopt hij tot
        y 185. Dat is één rem méér dan op de andere borden, en dat is gemeten:
        de doelzin hier is twee zinnen lang. Met de 12rem van de andere borden
        begint dit paneel op y 176 en ligt de doelzin 9 px onder glas -
        precies de zin die zegt waar het bord voor dient. Met 13rem begint het
        op 192 en blijft de Brief vrij: 1024x768 en 900x700, nul overlappingen.

        Vanaf 1280 px klapt de Brief UIT naar 230 px en loopt hij tot y 246, en
        dan is 13rem (208 px) te weinig. Gemeten zonder de xl-grens, de overlap
        tussen dit paneel en de Brief:

          1280x720  50,7 px      1366x768  2,7 px
          1280x800   0 px        1440x900  0 px

        Op 1280x720 verdween daarmee de hele derde alinea van de Brief achter
        dit paneel - de zin die zegt wat de blauwe lijn IS. Beide panelen staan
        op z-10 en dit paneel staat later in de boom, dus het wint. Precies
        hetzelfde ging op "Waar leg jij de grens?" mis, met dezelfde oplossing
        en dezelfde 17rem. Na de wijziging opnieuw gemeten:

          1440x900  0 px   1366x768  0 px   1280x800  0 px
          1280x720  0 px   1024x768  0 px    900x700  0 px

        Waarom 17rem en niet 16: 17rem laat op 1280x720 en 1366x768 precies
        10 px tussen de Brief en dit paneel, en op 1280x800 en 1440x900 is het
        paneel al korter dan de grens, dus daar verandert niets.
      */}
      <Panel className="pointer-events-auto absolute bottom-4 left-4 z-10 max-h-[calc(100%-13rem)] w-[16rem] overflow-y-auto px-4 py-3.5 xl:max-h-[calc(100%-17rem)] xl:w-[21rem]">
        <Vaststelling
          label="Grens van de boom"
          value={boomShift}
          decimals={2}
          unit="verschoven"
          color={NAVY}
          empty="De boom stelt zijn vraag nu over het andere kenmerk. Die grens is niet te vergelijken."
          detail={
            boomShift !== null && grens && GRENS_BEGIN
              ? verschuivingZin(boomShift, grens.drempel, GRENS_BEGIN.drempel)
              : undefined
          }
        />

        <Divider />

        <Vaststelling
          label="Grens van regressie"
          value={regShift}
          decimals={2}
          unit="verschoven"
          color={MODEL}
          empty="Zoals de punten nu liggen, vindt regressie geen grens."
          detail={
            regShift !== null && reg && REG_BEGIN
              ? verschuivingZin(
                  regShift,
                  regressieX(reg, MIDDEN_BAND),
                  regressieX(REG_BEGIN, MIDDEN_BAND),
                )
              : undefined
          }
        />

        <Divider />

        <div className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-ink/75">
          Het handvat
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {/* Elke knop verzet het handvat naar een ander punt, dus er beweegt
              altijd iets op het bord. Staat het handvat er al, dan is de knop
              uit: een knop die niets doet leest als een bord dat stuk is.

              Alle drie de knoppen van dit paneel staan in de gebiedende wijs,
              dus ook deze twee: "Begin opnieuw" was een zin en "Ver punt" was
              een woordgroep die in het Nederlands niet bestaat. */}
          <Btn
            variant="ghost"
            disabled={!houdtVast && handvat === verst}
            onClick={() => setHandvat(verst)}
          >
            Pak een ver punt
          </Btn>
          <Btn variant="ghost" disabled={houdtVast} onClick={() => setHandvat(naast[0] ?? handvat)}>
            Pak een punt bij de grens
          </Btn>
        </div>
        <p className="mt-1.5 text-[13px] leading-snug text-ink/80">
          {houdtVast
            ? 'Dit handvat houdt de grens van de boom vast.'
            : 'Dit handvat ligt buiten de strook.'}
        </p>

        <div className="mt-2.5">
          <Btn
            variant="ghost"
            disabled={!verplaatst}
            onClick={() => setRijen(RIJEN.map((r) => ({ ...r })))}
          >
            Begin opnieuw
          </Btn>
        </div>

        <Divider />

        <Note>
          {grens && (
            <p>
              {/* "Dan Soort 1, anders Soort 2." blijft staan. Het is samengetrokken,
                  maar het is de gewone Nederlandse vorm van een als-dan-regel en
                  een leerling leest hem in één keer. En hij is precies één regel
                  lang: zowel "Zo ja, dan ... Zo nee, dan ..." als "Dan is het
                  Soort 1, ..." meet 88 px tegen de 66 px van deze, en die 22 px
                  duwen op 1024x768 nog een stuk van dit blok onder de rand. */}
              De boom stelt één vraag: is {kenmerkNaam(grens.kenmerk)} kleiner dan{' '}
              {getal(grens.drempel, 2)}? Dan {soortNaam(grens.onder)}, anders{' '}
              {soortNaam(grens.boven)}.
            </p>
          )}
          {grens && (
            <p className="mt-1.5">
              Van de {getal(rijen.length)} punten houden er {getal(naast.length)} deze grens vast.
            </p>
          )}
        </Note>

        <div className="mt-2 text-[11.5px] leading-relaxed text-muted">
          In je notebook: <PyChip>DecisionTreeClassifier()</PyChip>
        </div>
      </Panel>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Welk punt is "ver"?
 *
 * Het punt dat het verst buiten de strook ligt. Gerekend en niet gekozen,
 * want na een paar sleepbewegingen ligt de data anders dan bij het openen en
 * moet de knop nog altijd het verste punt geven. De afstand tot een strook is
 * nul zolang je erin ligt, dus een punt dat de grens vasthoudt komt hier
 * nooit uit.
 * ------------------------------------------------------------------ */
function verstePunt(rijen: readonly Rij[]): number {
  const grens = boomGrens(rijen)
  if (!grens) return 0
  const band = strook(rijen, grens)
  if (!band) return 0
  let best = 0
  let verst = -1
  for (let i = 0; i < rijen.length; i++) {
    const v = opKenmerk(grens, rijen[i])
    const d = Math.max(band.van - v, v - band.tot, 0)
    if (d > verst) {
      verst = d
      best = i
    }
  }
  return best
}

/* ------------------------------- merken ---------------------------- */

/**
 * Eén rij als merk. De soort zit in de VORM, niet in de kleur: een vierkant
 * is Soort 1, een driehoek is Soort 2, en beide staan in de inktkleur van de
 * data. Wie geen kleurverschil ziet, leest het bord nog altijd - en de twee
 * woorden staan er bovendien bij op het bord.
 */
function Merk({ rij, cx, cy }: { rij: Rij; cx: number; cy: number }) {
  if (rij.klasse === 0) {
    return <rect x={cx - 5.5} y={cy - 5.5} width={11} height={11} fill={DATA} opacity={0.9} />
  }
  return (
    <polygon
      points={`${cx},${cy - 7} ${cx + 6.5},${cy + 5} ${cx - 6.5},${cy + 5}`}
      fill={DATA}
      opacity={0.9}
    />
  )
}

/**
 * Het handvat: het ene punt dat de leerling mag verplaatsen.
 *
 * Waarom dit niet `DragDot` uit Canvas is: die tekent een gevulde cirkel, en
 * die zou precies de vorm afdekken die op dit bord zegt welke soort het punt
 * is. Het handvat is hier dus een RING om het merk, niet een merk op zichzelf.
 * Het pannen en zoomen komt onverkort van Canvas; hier staan alleen de
 * gebeurtenissen van dit ene merk, met dezelfde afspraken als DragDot:
 * stopPropagation zodat het bord er niet onder wegschuift, pointer capture
 * zodat een snelle sleepbeweging niet halverwege loslaat, en de pijltjes-
 * toetsen voor wie niet sleept.
 */
function Handvat({
  rij,
  scales,
  houdtVast,
  onMove,
}: {
  rij: Rij
  scales: Scales
  houdtVast: boolean
  onMove: (p: { x: number; y: number }) => void
}) {
  /**
   * Waar de sleepbeweging begon, en of ze de drempel van 4 px al gehaald
   * heeft. Zonder die drempel is een KLIK op het handvat ook een verplaatsing:
   * een vinger of een muis beweegt altijd een pixel of twee, en dan verzet een
   * leerling die alleen even aanwijst de data zonder het te merken. Canvas
   * gebruikt dezelfde 4 px om een klik van een sleepbeweging te scheiden.
   */
  const sleep = useRef<{ x: number; y: number; echt: boolean } | null>(null)
  const cx = scales.sx(rij.x)
  const cy = scales.sy(rij.y)
  const { x0, x1, y0, y1 } = scales.view
  const stap = { x: (x1 - x0) * 0.02, y: (y1 - y0) * 0.02 }

  return (
    <g
      tabIndex={0}
      role="slider"
      aria-label="handvat: sleep dit punt over het bord"
      aria-valuetext={`kenmerk 1 ${getal(rij.x, 1)}, kenmerk 2 ${getal(rij.y, 1)}`}
      className="outline-none"
      style={{ cursor: 'grab' }}
      onPointerDown={(e) => {
        sleep.current = { x: e.clientX, y: e.clientY, echt: false }
        ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
        e.stopPropagation()
      }}
      onPointerMove={(e) => {
        const s = sleep.current
        if (!s) return
        e.stopPropagation()
        if (!s.echt && Math.hypot(e.clientX - s.x, e.clientY - s.y) <= 4) return
        s.echt = true
        onMove(scales.toWorld(e))
      }}
      onPointerUp={(e) => {
        sleep.current = null
        e.stopPropagation()
      }}
      onPointerCancel={() => {
        sleep.current = null
      }}
      onKeyDown={(e) => {
        const richting: Record<string, { x: number; y: number }> = {
          ArrowLeft: { x: -stap.x, y: 0 },
          ArrowRight: { x: stap.x, y: 0 },
          ArrowUp: { x: 0, y: stap.y },
          ArrowDown: { x: 0, y: -stap.y },
        }
        const m = richting[e.key]
        if (!m) return
        e.preventDefault()
        e.stopPropagation()
        onMove({ x: rij.x + m.x, y: rij.y + m.y })
      }}
    >
      {/* Ruim en onzichtbaar: op een beamer is een merk van 11 px klein. */}
      <circle cx={cx} cy={cy} r={22} fill={FOUT} opacity={0.12} />
      {/* Houdt dit punt de grens vast, dan staan er twee ringen om: de groene
          van de grens en de oranje van het handvat. Twee ringen, twee dingen. */}
      {houdtVast && <circle cx={cx} cy={cy} r={11} fill="none" stroke={DERDE} strokeWidth={2.5} />}
      <circle cx={cx} cy={cy} r={16} fill="none" stroke={FOUT} strokeWidth={3} />
      <Merk rij={rij} cx={cx} cy={cy} />
      {/* Boven het handvat, behalve als het tegen de bovenrand ligt: daar
          botste deze tekst op de asnaam die Canvas rechtsboven zet. Twee vette
          teksten met een witte rand over elkaar zijn onleesbaar, en het is nog
          net de tekst die zegt wat je moet doen. */}
      <text
        x={cx}
        y={cy - scales.safe.top > 46 ? cy - 24 : cy + 34}
        textAnchor="middle"
        fontSize={13.5}
        fontWeight={700}
        fill={FOUT_INK}
        stroke="#fff"
        strokeWidth={3.5}
        paintOrder="stroke"
        pointerEvents="none"
      >
        sleep dit handvat
      </text>
    </g>
  )
}

/** De grens van de boom: één rechte lijn, verticaal bij kenmerk 1 en
 *  horizontaal bij kenmerk 2. `spook` tekent waar ze begon. */
function BoomLijn({
  grens,
  scales,
  spook = false,
}: {
  grens: Grens
  scales: Scales
  spook?: boolean
}) {
  const gemeen = {
    stroke: spook ? MUTED : DERDE,
    strokeWidth: spook ? 1.5 : 3,
    strokeDasharray: spook ? '6 6' : undefined,
    opacity: spook ? 0.6 : 1,
    pointerEvents: 'none' as const,
  }
  if (grens.kenmerk === 0) {
    const px = scales.sx(grens.drempel)
    return <line x1={px} y1={scales.area.top} x2={px} y2={scales.area.bottom} {...gemeen} />
  }
  const py = scales.sy(grens.drempel)
  return <line x1={scales.area.left} y1={py} x2={scales.area.right} y2={py} {...gemeen} />
}

/** De grens van regressie: een lijn die mag hellen, dus getekend van de
 *  onderrand van het beeld naar de bovenrand. */
function RegLijn({
  grens,
  scales,
  spook = false,
}: {
  grens: RegGrens
  scales: Scales
  spook?: boolean
}) {
  const { y0, y1 } = scales.view
  return (
    <line
      x1={scales.sx(regressieX(grens, y0))}
      y1={scales.sy(y0)}
      x2={scales.sx(regressieX(grens, y1))}
      y2={scales.sy(y1)}
      stroke={spook ? MUTED : MODEL}
      strokeWidth={spook ? 1.5 : 2.5}
      strokeDasharray={spook ? '6 6' : undefined}
      opacity={spook ? 0.6 : 1}
      strokeLinecap="round"
      pointerEvents="none"
    />
  )
}

/* ------------------------------- tekst ----------------------------- */

/** Tekst op het bord: minstens 13 px, vet, met een witte rand eronder zodat
 *  ze over een rasterlijn, een merk of een lijn heen leesbaar blijft. */
function Aanduiding({
  x,
  y,
  tekst,
  kleur = INK,
  anker = 'start',
}: {
  x: number
  y: number
  tekst: string
  kleur?: string
  anker?: 'start' | 'middle' | 'end'
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anker}
      fontSize={13.5}
      fontWeight={700}
      fill={kleur}
      stroke="#fff"
      strokeWidth={3.5}
      paintOrder="stroke"
      pointerEvents="none"
    >
      {tekst}
    </text>
  )
}

/**
 * Een aanduiding naast een lijn, die aan de andere kant gaat staan zodra ze
 * anders buiten het vrije vlak valt. Zonder dat draait een aanduiding bij een
 * lijn tegen de rechterrand onder een paneel of van het bord af - en dan is
 * de lijn waar het bord over gaat de enige die geen naam heeft.
 */
function NaastLijn({
  px,
  y,
  scales,
  tekst,
  kleur,
  gereserveerd = 0,
}: {
  px: number
  y: number
  scales: Scales
  tekst: string
  kleur: string
  /**
   * Px rechts die al bezet zijn. Canvas zet de asnaam "kenmerk 1" op
   * safe.bottom - 30, en dat is dezelfde regel als de onderste aanduiding
   * hier. Op 900x700 schoof die aanduiding er precies over: gemeten botsing
   * tussen "hier begonnen de twee grenzen" en "kenmerk 1". Met de asnaam
   * gereserveerd klapt de tekst naar de andere kant van de lijn.
   */
  gereserveerd?: number
}) {
  // 7,4 px per teken bij 13,5 px vet: gemeten op de systeemletter van deze
  // borden, en alleen gebruikt om te kiezen aan welke kant de tekst staat.
  const breed = tekst.length * 7.4
  const rand = scales.safe.right - gereserveerd
  const rechts = px + 10 + breed > rand
  const x = rechts ? Math.max(scales.safe.left + breed, px - 10) : Math.min(px + 10, rand - breed)
  return <Aanduiding x={x} y={y} tekst={tekst} kleur={kleur} anker={rechts ? 'end' : 'start'} />
}
