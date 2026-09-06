import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import Canvas, { type Scales, type View } from '../components/Canvas'
import { Brief, Btn, Divider, Panel, Readout } from '../components/Overlay'
import { seeded } from '../lib/regression'
import {
  AANTAL_TOESTANDEN,
  ACTIENAAM,
  AFGROND,
  KOLOMMEN,
  LINKS,
  OMHOOG,
  OMLAAG,
  RECHTS,
  RIJEN,
  SCHAT,
  START,
  VAKJES_MET_EEN_WEG,
  besteActie,
  geleerdPad,
  kolomVan,
  leerStap,
  nieuweQTabel,
  nogNietsGeleerd,
  rijVan,
  vindtDeSchat,
  type Pad,
  type QTabel,
  type Update,
} from '../lib/cliffwalking'
import { DATA, DERDE, DERDE_INK, FOUT, FOUT_INK, INK, MODEL, MUTED, NAVY, RULE } from '../lib/palette'

/* ------------------------------------------------------------------ *
 * mAIstros 2 - les 12 - Kijk in de q-tabel.
 *
 * EEN DOEL: de agent leert eerst de vakjes bij de schat, en pas daarna
 * de vakjes bij de start. Alles op dit bord staat er om dat zichtbaar te
 * maken, en niets anders.
 *
 * Waarom dat het doel is, en niet "de drie parameters veranderen het
 * leren": op CliffWalking start de q-tabel op nul, en nul is HOGER dan
 * elke waarde die de agent ooit leert. Alle getallen zakken dus, overal,
 * van bij de eerste episode. Een zin als "de tabel vult zich vanaf de
 * schat" zou dus door de getallen van het bord zelf tegengesproken
 * worden. Wat WEL van de schat naar achter groeit, en nagemeten is over
 * 20 seeds, is de verzameling vakjes van waaruit de agent de schat al
 * vindt (`vindtDeSchat`): die volgorde is 20 keer op 20 monotoon en
 * bereikt de start rond episode 120 tot 170. Dat is het blauwe vlak op
 * het bord, en de teller linksonder telt het.
 *
 * De drie parameters staan er ook, op de waarden van de les, maar ze
 * zijn iets wat je KAN ZIEN, niet waar het bord over gaat.
 *
 * Gecontroleerd in node over de omgeving in src/lib/cliffwalking.ts, met
 * alpha 0,1 gamma 0,99 epsilon 0,1 en 500 episodes van hoogstens 100
 * stappen: 40 seeds op 40 eindigen met het optimale pad van 13 stappen
 * langs de rij boven de afgrond, totale beloning -13. Seed 12, de seed
 * van dit bord, haalt dat pad voor het eerst na 168 episodes en valt
 * tijdens het trainen 162 keer in de afgrond.
 *
 * WAT DIT BORD NIET DOET: de formule uit slide 2158188 nog eens
 * afdrukken. Die staat al op een slide. Het bord toont per stap WELKE
 * cel verandert, van welk getal naar welk getal, en waarom - in de
 * woorden van de les.
 * ------------------------------------------------------------------ */

/** De waarden van Stap 4 van de les. Hier begint elke schuif. */
const LES = { alpha: 0.1, gamma: 0.99, epsilon: 0.1, episodes: 500, maxStappen: 100 }

/**
 * Vaste seed, en dus overal hetzelfde bord. Q-learning is zelf toevallig,
 * dus zonder seed ziet elk scherm in de klas een andere episode en kan de
 * leerkracht nergens naar wijzen.
 */
const SEED = 12

/**
 * Het bord is een vierkant venster van 14 bij 14. Het raster is 12 bij 4 en
 * wordt met een GELIJKE schaal in x en y getekend, zodat een vakje ook echt
 * vierkant is. Canvas rekt x en y los van elkaar op tot het vrije vlak, dus
 * zonder die gelijke schaal wordt een vakje van 4 rijen hoog een strook.
 * De twee overtollige eenheden in de breedte zijn lucht rond het raster, zodat
 * "start" en "schat" onder de hoeken passen.
 */
const VENSTER: View = { x0: 0, x1: 14, y0: 0, y1: 14 }

/**
 * De verticale stapel op het bord, in pixels, van boven naar onder:
 * de kopregel, het raster, de uitleg eronder en de curve. Ze wordt als geheel
 * in het vrije vlak gecentreerd, want het raster alleen centreren laat op een
 * breed scherm honderden pixels leeg onder de curve en duwt de curve op een
 * smal scherm onder de vouw.
 */
const KOP = 22
/** Waar de uitleg begint, gemeten vanaf de onderkant van het raster. */
const UITLEG = 46
/**
 * Waar de curve begint, gemeten vanaf de onderkant van het raster. De uitleg
 * telt hoogstens zeven regels van ten hoogste 15,5 * 1,62 px, dus 46 + 6 * 26
 * = 202, plus wat lucht.
 */
const CURVE = 226
/** Ruimte onder de curve voor de twee astekstjes. */
const CURVE_VOET = 16

/** Het kortste pad: omhoog, elf keer rechts, omlaag. Nagerekend, 40 seeds op 40. */
const KORTSTE_PAD = -13

/**
 * De lettergrootte van de tekst onder het raster, uit de breedte van het vrije
 * vlak. Op 900x700 houden de twee panelen zoveel weg dat er nog 332 px
 * overblijft; een regel van 15 px liep daar dwars door de zoomknoppen van
 * Canvas. Ondergrens 13 px, want dat is de bodem voor tekst die je van
 * achteraan de klas moet lezen. Bovengrens 15,5 px, want groter voegt niets
 * toe en duwt de curve naar beneden.
 *
 * Elke regel hieronder blijft daarom onder de 42 tekens. Bij 13 px is dat
 * ongeveer 290 px, en dat past in het smalste vrije vlak dat we meten.
 */
const bordMaat = (vrijBreed: number) => Math.max(13, Math.min(15.5, vrijBreed / 26))

const komma = (v: number, cijfers = 1) => v.toFixed(cijfers).replace('.', ',')

/** Een schuifwaarde zoals de les ze schrijft: 0,1 en 0,99, niet 0,10. */
const parameterGetal = (v: number) => String(parseFloat(v.toFixed(2))).replace('.', ',')

/** Duizendtallen met een harde spatie: "-1.040" leest een leerling verkeerd. */
const NBSP = '\u00a0'
const heelGetal = (v: number) => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP)

type Parameters = { alpha: number; gamma: number; epsilon: number }

type Wereld = {
  q: QTabel
  toestand: number
  episode: number
  stapInEpisode: number
  beloningInEpisode: number
  /** De totale beloning per afgewerkte episode: precies wat Stap 7 afdrukt. */
  curve: number[]
  laatste: Update | null
}

const beginWereld = (): Wereld => ({
  q: nieuweQTabel(),
  toestand: START,
  episode: 0,
  stapInEpisode: 0,
  beloningInEpisode: 0,
  curve: [],
  laatste: null,
})

const kopieQ = (q: QTabel): QTabel => q.map((rij) => rij.slice())

/** Eén leerstap, en zo nodig het einde van de episode. */
function eenStap(w: Wereld, p: Parameters, toeval: () => number): Wereld {
  const q = kopieQ(w.q)
  const u = leerStap(w.toestand, q, p.alpha, p.gamma, p.epsilon, toeval)
  const beloning = w.beloningInEpisode + u.beloning
  const stappen = w.stapInEpisode + 1
  const einde = u.klaar || stappen >= LES.maxStappen
  return {
    q,
    toestand: einde ? START : u.nieuweToestand,
    episode: einde ? w.episode + 1 : w.episode,
    stapInEpisode: einde ? 0 : stappen,
    beloningInEpisode: einde ? 0 : beloning,
    curve: einde ? [...w.curve, beloning] : w.curve,
    laatste: u,
  }
}

/**
 * n hele episodes na elkaar. Een halve episode die nog liep, wordt niet
 * meegeteld: de agent gaat gewoon terug naar de start, net zoals
 * `omgeving.reset()` bij het begin van elke episode in Stap 7.
 */
function veelEpisodes(w: Wereld, n: number, p: Parameters, toeval: () => number): Wereld {
  const q = kopieQ(w.q)
  const curve = w.curve.slice()
  let laatste = w.laatste
  for (let i = 0; i < n; i++) {
    let toestand = START
    let beloning = 0
    for (let s = 0; s < LES.maxStappen; s++) {
      const u = leerStap(toestand, q, p.alpha, p.gamma, p.epsilon, toeval)
      laatste = u
      beloning += u.beloning
      toestand = u.nieuweToestand
      if (u.klaar) break
    }
    curve.push(beloning)
  }
  return {
    q,
    toestand: START,
    episode: w.episode + n,
    stapInEpisode: 0,
    beloningInEpisode: 0,
    curve,
    laatste,
  }
}

type Modus = 'stil' | 'episode' | 'trainen' | 'test'
type Test = { pad: Pad; tot: number }

/** Twee vakjes naast elkaar? Zo niet, dan viel de agent in de afgrond. */
const naastElkaar = (a: number, b: number) =>
  Math.abs(rijVan(a) - rijVan(b)) + Math.abs(kolomVan(a) - kolomVan(b)) <= 1

export default function KijkInDeQTabel() {
  const wereld = useRef<Wereld>(beginWereld())
  const [, hertekenen] = useReducer((n: number) => n + 1, 0)
  const toeval = useRef(seeded(SEED))

  const [alpha, setAlpha] = useState(LES.alpha)
  const [gamma, setGamma] = useState(LES.gamma)
  const [epsilon, setEpsilon] = useState(LES.epsilon)

  const [modus, setModus] = useState<Modus>('stil')
  const [test, setTest] = useState<Test | null>(null)
  const [gewezen, setGewezen] = useState<number | null>(null)
  const [vast, setVast] = useState<number | null>(null)
  /**
   * Waar of er net getraind is. Zonder dit blijft na 500 episodes de laatste
   * losse leerstap staan, en die leest als iets wat de leerling zelf deed.
   */
  const [netGetraind, setNetGetraind] = useState(false)

  const tik = useRef<number | null>(null)
  const beeld = useRef<number | null>(null)

  /** Een lopende animatie mag nooit een verdwenen bord blijven bijwerken. */
  useEffect(
    () => () => {
      if (tik.current !== null) window.clearTimeout(tik.current)
      if (beeld.current !== null) window.cancelAnimationFrame(beeld.current)
    },
    [],
  )

  function stop() {
    if (tik.current !== null) {
      window.clearTimeout(tik.current)
      tik.current = null
    }
    if (beeld.current !== null) {
      window.cancelAnimationFrame(beeld.current)
      beeld.current = null
    }
    setModus('stil')
  }

  const w = wereld.current
  const parameters: Parameters = { alpha, gamma, epsilon }

  /* ---------------------------- knoppen ---------------------------- */

  function doeEenStap() {
    stop()
    setTest(null)
    setNetGetraind(false)
    wereld.current = eenStap(wereld.current, parameters, toeval.current)
    hertekenen()
  }

  function doeEenEpisode() {
    stop()
    setTest(null)
    setNetGetraind(false)
    setModus('episode')
    const p = parameters
    const loop = () => {
      const voor = wereld.current.episode
      wereld.current = eenStap(wereld.current, p, toeval.current)
      hertekenen()
      if (wereld.current.episode !== voor) {
        tik.current = null
        setModus('stil')
        return
      }
      tik.current = window.setTimeout(loop, 40)
    }
    tik.current = window.setTimeout(loop, 40)
  }

  function doeTrainen() {
    stop()
    setTest(null)
    setNetGetraind(false)
    setModus('trainen')
    const p = parameters
    // Drie episodes per beeld: 500 episodes duren zo bijna drie seconden, en
    // elk beeld toont een nieuwe q-tabel, een nieuwe teller en een nieuw stuk
    // curve. Alles in één keer uitrekenen zou het bord seconden bevriezen en
    // net het groeien verbergen dat dit bord moet tonen.
    let over = LES.episodes
    const loop = () => {
      const n = Math.min(3, over)
      wereld.current = veelEpisodes(wereld.current, n, p, toeval.current)
      over -= n
      hertekenen()
      if (over <= 0) {
        beeld.current = null
        setNetGetraind(true)
        setModus('stil')
        return
      }
      beeld.current = window.requestAnimationFrame(loop)
    }
    beeld.current = window.requestAnimationFrame(loop)
  }

  function doeTest() {
    stop()
    setNetGetraind(false)
    // Stap 8 van de les: epsilon 0, dus geen exploratie, en de agent leert
    // hier niets bij. De q-tabel blijft onaangeroerd.
    const pad = geleerdPad(wereld.current.q, LES.maxStappen)
    setTest({ pad, tot: 0 })
    setModus('test')
    const wacht = Math.min(210, Math.max(45, Math.round(3000 / pad.acties.length)))
    let i = 0
    const loop = () => {
      i += 1
      setTest({ pad, tot: i })
      if (i < pad.acties.length) {
        tik.current = window.setTimeout(loop, wacht)
      } else {
        tik.current = null
        setModus('stil')
      }
    }
    tik.current = window.setTimeout(loop, wacht)
  }

  function opnieuw() {
    stop()
    setTest(null)
    setVast(null)
    setGewezen(null)
    setNetGetraind(false)
    toeval.current = seeded(SEED)
    wereld.current = beginWereld()
    hertekenen()
  }

  /** Een schuif verzetten breekt een lopende animatie af, maar laat de q-tabel staan. */
  function verzet(zet: (v: number) => void, v: number) {
    stop()
    setTest(null)
    setNetGetraind(false)
    zet(v)
  }

  function zetLesWaarden() {
    stop()
    setTest(null)
    setNetGetraind(false)
    setAlpha(LES.alpha)
    setGamma(LES.gamma)
    setEpsilon(LES.epsilon)
  }

  /* --------------------------- afgeleiden -------------------------- */

  const bereikt = useMemo(() => vindtDeSchat(w.q), [w.q])
  const aantalBereikt = useMemo(() => bereikt.filter(Boolean).length, [bereikt])

  const agent = test ? test.pad.toestanden[test.tot] : w.toestand
  const bezig = modus !== 'stil'

  /** Welke rij van de q-tabel uitgelicht staat: vastgeklikt, aangewezen, of de agent. */
  const actieveRij = vast ?? gewezen ?? agent

  /** De cel die net veranderde. Tijdens het trainen springt die te snel om te tonen. */
  const veranderd = modus === 'trainen' || modus === 'test' ? null : w.laatste

  const opLesWaarden =
    alpha === LES.alpha && gamma === LES.gamma && epsilon === LES.epsilon

  return (
    <div className="relative h-full w-full">
      {/*
        Geen astekst: het vlak is hier een raster van vakjes met namen, geen
        grafiek. "2 4 6 8 10 12" langs de onderrand zegt een leerling niets,
        en op 900x700 liepen net die getallen tegen de zoomknoppen aan.
      */}
      <Canvas defaultView={VENSTER} axes={false}>
        {(s) => (
          <Bord
            s={s}
            q={w.q}
            bereikt={bereikt}
            agent={agent}
            actieveRij={actieveRij}
            vast={vast}
            test={test}
            modus={modus}
            episode={w.episode}
            stapInEpisode={w.stapInEpisode}
            beloningInEpisode={w.beloningInEpisode}
            netGetraind={netGetraind}
            curve={w.curve}
            laatste={w.laatste}
            aantalBereikt={aantalBereikt}
            onWijs={setGewezen}
            onKlik={(t) => setVast((v) => (v === t ? null : t))}
          />
        )}
      </Canvas>

      {/*
        De eerste alinea is het DOEL. Brief toont die altijd en klapt alleen
        alles daarna in, dus op een beamer is dit de enige zin die een leerling
        zeker leest. Wie hier vanaf een slide binnenvalt, ziet de portaalkaart
        nooit: staat het doel niet op het bord, dan staat het nergens.
      */}
      <Brief eyebrow="mAIstros 2 - les 12" title="Kijk in de q-tabel">
        <p>De agent leert eerst de vakjes bij de schat, en pas daarna die bij de start.</p>
        <p>In de q-tabel staat per toestand hoe goed elke actie is. Elke stap past één getal aan.</p>
        <p>
          Een driehoek is de beste actie die de agent daar al kent. Blauw: van hieruit vindt hij de
          schat.
        </p>
      </Brief>

      {/*
        LINKSONDER: de teller die het doel meet, de knoppen en de drie
        parameters. Dit paneel staat er van bij het begin en verandert nooit
        van breedte: Canvas meet elk paneel naast het bord en zou anders
        halverwege opnieuw kaderen.
      */}
      {/*
        De hoogte is hier het krappe: op 1280x800 stond de Brief uitgeklapt
        (230 px) samen met dit paneel 11 px te hoog en overlapten ze elkaar.
        17rem houdt bovenaan plaats vrij voor de Brief in zijn hoogste stand,
        en binnenin scrollen ALLEEN de parameters. Kop, teller en knoppen staan
        vast, dus een knop kan nooit onder de vouw verdwijnen - dat leest voor
        een leerling als een knop die er niet is.
      */}
      <Panel className="pointer-events-auto absolute bottom-4 left-4 z-10 flex max-h-[calc(100%-12rem)] w-[15rem] flex-col xl:max-h-[calc(100%-17rem)] px-3.5 py-3 xl:w-[19rem]">
        {/*
          Opnieuw staat NAAST de teller en niet op een eigen kopregel: die
          kopregel kostte 24 px, en op 900x700 was dat precies het verschil
          tussen de zin over epsilon in beeld en onder de vouw.
        */}
        <div className="flex shrink-0 items-start justify-between gap-2">
          <Readout
            label="Kent de weg vanaf"
            value={String(aantalBereikt)}
            unit={`van de ${VAKJES_MET_EEN_WEG} vakjes`}
            color={MODEL}
          />
          <button
            type="button"
            onClick={opnieuw}
            className="mt-px shrink-0 text-[12px] font-semibold text-model underline-offset-2 hover:underline"
          >
            Opnieuw
          </button>
        </div>
        {!opLesWaarden && (
          <button
            type="button"
            onClick={zetLesWaarden}
            className="mt-0.5 shrink-0 self-start text-[12px] font-semibold text-model underline-offset-2 hover:underline"
          >
            Zet alpha, gamma en epsilon terug op de waarden van de les
          </button>
        )}

        <p className="mt-1 shrink-0 text-[12.5px] leading-snug text-ink/80">
          episode {heelGetal(w.episode)}
          {w.stapInEpisode > 0 ? ` · stap ${w.stapInEpisode}` : ''}
        </p>

        <div className="shrink-0">
          <Divider />
        </div>

        <div className="flex shrink-0 flex-col gap-1">
          <div className="flex gap-1">
            <Btn onClick={doeEenStap} variant="ghost" disabled={bezig} full>
              Eén stap
            </Btn>
            <Btn
              onClick={modus === 'episode' ? stop : doeEenEpisode}
              variant="ghost"
              disabled={bezig && modus !== 'episode'}
              full
            >
              {modus === 'episode' ? 'Stop' : 'Eén episode'}
            </Btn>
          </div>
          <Btn
            onClick={modus === 'trainen' ? stop : doeTrainen}
            disabled={bezig && modus !== 'trainen'}
            full
          >
            {modus === 'trainen' ? 'Stop' : `Train ${LES.episodes} episodes`}
          </Btn>
          <Btn
            onClick={modus === 'test' ? stop : doeTest}
            variant="ghost"
            disabled={bezig && modus !== 'test'}
            full
          >
            {modus === 'test' ? 'Stop' : 'Test de agent'}
          </Btn>
        </div>

        <div className="shrink-0">
          <Divider />
        </div>

        {/* Alleen dit blok scrollt, en alleen als het scherm echt te laag is. */}
        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain">
          <Schuif
            naam="learning rate alpha"
            waarde={alpha}
            min={0}
            max={1}
            stap={0.05}
            uitleg="groter: verandert het getal meer"
            onChange={(v) => verzet(setAlpha, v)}
          />
          <Schuif
            naam="discount rate gamma"
            waarde={gamma}
            min={0}
            max={1}
            stap={0.01}
            uitleg="groter: latere beloningen wegen meer"
            onChange={(v) => verzet(setGamma, v)}
          />
          <Schuif
            naam="exploration rate epsilon"
            waarde={epsilon}
            min={0}
            max={1}
            stap={0.05}
            uitleg="groter: vaker een willekeurige actie"
            extra="0,1 is laag: de agent moet vlak langs de afgrond stappen"
            onChange={(v) => verzet(setEpsilon, v)}
          />
        </div>
      </Panel>

      {/* RECHTS: de q-tabel zelf, van boven tot onder, alle 48 rijen. */}
      <QTabelPaneel
        q={w.q}
        actieveRij={actieveRij}
        vast={vast}
        agent={agent}
        veranderd={veranderd}
        volgAgent={modus !== 'trainen'}
        onWijs={setGewezen}
        onKlik={(t) => setVast((v) => (v === t ? null : t))}
      />
    </div>
  )
}

/* --------------------------- het bord ---------------------------- */

type BordProps = {
  s: Scales
  q: QTabel
  bereikt: boolean[]
  agent: number
  actieveRij: number
  vast: number | null
  test: Test | null
  modus: Modus
  episode: number
  stapInEpisode: number
  beloningInEpisode: number
  netGetraind: boolean
  curve: number[]
  laatste: Update | null
  aantalBereikt: number
  onWijs: (t: number | null) => void
  onKlik: (t: number) => void
}

function Bord({
  s,
  q,
  bereikt,
  agent,
  actieveRij,
  vast,
  test,
  modus,
  episode,
  stapInEpisode,
  beloningInEpisode,
  netGetraind,
  curve,
  laatste,
  aantalBereikt,
  onWijs,
  onKlik,
}: BordProps) {
  /**
   * Eén schaal voor x en y, zodat een vakje vierkant is. Canvas rekt beide
   * assen los van elkaar tot het vrije vlak; de kleinste van de twee schalen
   * nemen houdt het raster in verhouding, ook als de leerling maar één as
   * uitzoomt.
   */
  const k = Math.min(1 / s.unitPerPx.x, 1 / s.unitPerPx.y)
  const breedte = KOLOMMEN * k
  const hoogte = RIJEN * k
  const maat = bordMaat(s.safe.right - s.safe.left)
  const curveHoogte = Math.max(60, Math.min(104, k * 1.7))
  const stapel = KOP + hoogte + CURVE + curveHoogte + CURVE_VOET
  const links = s.sx(7) - breedte / 2
  // s.sy(7) is het midden van het vrije vlak: het venster is 14 bij 14 en
  // Canvas kadert dat venster precies in wat de panelen vrij laten.
  const boven = s.sy(7) - stapel / 2 + KOP

  const vakX = (t: number) => links + kolomVan(t) * k
  const vakY = (t: number) => boven + rijVan(t) * k
  const midX = (t: number) => vakX(t) + k / 2
  const midY = (t: number) => vakY(t) + k / 2

  const neer = useRef<{ x: number; y: number; toestand: number } | null>(null)

  const klikEinde = (e: React.PointerEvent, toestand: number | null) => {
    const d = neer.current
    neer.current = null
    if (!d) return
    // Een sleep is geen klik: wie in een raster begint te pannen, mag niet
    // per ongeluk een vakje vastzetten. En e.detail 2 is de tweede klik van
    // een dubbelklik, waarmee Canvas het beeld terugzet.
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) return
    if (e.detail >= 2) return
    if (toestand !== null && d.toestand === toestand) onKlik(toestand)
  }

  const alleVakjes = Array.from({ length: AANTAL_TOESTANDEN }, (_, i) => i)

  return (
    <>
      <defs>
        <pattern
          id="les12-afgrond"
          width={9}
          height={9}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width={9} height={9} fill={FOUT} fillOpacity={0.1} />
          <line x1={0} y1={0} x2={0} y2={9} stroke={FOUT} strokeWidth={3} strokeOpacity={0.42} />
        </pattern>
      </defs>

      {/* Klikken naast het raster laat een vastgezet vakje weer los. */}
      <rect
        x={s.area.left}
        y={s.area.top}
        width={s.area.w}
        height={s.area.h}
        fill="none"
        pointerEvents="all"
        onPointerDown={(e) => {
          neer.current = { x: e.clientX, y: e.clientY, toestand: -1 }
        }}
        onPointerUp={(e) => {
          const d = neer.current
          neer.current = null
          if (!d || d.toestand !== -1) return
          if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) return
          if (e.detail >= 2) return
          if (vast !== null) onKlik(vast)
        }}
        onPointerMove={(e) => {
          if (e.buttons === 0) onWijs(null)
        }}
      />

      {/* data-raster maakt het bord meetbaar: de QA telt hoeveel merken onder
          een paneel vallen, en dat moet nul zijn op elk schermformaat. */}
      <g data-raster="" onPointerLeave={() => onWijs(null)}>
        {alleVakjes.map((t) => {
          const isAfgrond = AFGROND.has(t)
          const isSchat = t === SCHAT
          const kentDeWeg = bereikt[t]
          return (
            <g key={t}>
              <rect
                x={vakX(t)}
                y={vakY(t)}
                width={k}
                height={k}
                fill={isAfgrond ? 'url(#les12-afgrond)' : '#fff'}
              />
              {!isAfgrond && kentDeWeg && (
                <rect
                  x={vakX(t)}
                  y={vakY(t)}
                  width={k}
                  height={k}
                  fill={MODEL}
                  fillOpacity={0.16}
                />
              )}
              {isSchat && (
                <>
                  <rect
                    x={vakX(t)}
                    y={vakY(t)}
                    width={k}
                    height={k}
                    fill={DERDE}
                    fillOpacity={0.2}
                  />
                  {/* Een ruit: de schat is ook zonder kleur te herkennen. */}
                  <path
                    d={`M ${midX(t)} ${midY(t) - k * 0.28} L ${midX(t) + k * 0.28} ${midY(t)} L ${midX(t)} ${midY(t) + k * 0.28} L ${midX(t) - k * 0.28} ${midY(t)} Z`}
                    fill="none"
                    stroke={DERDE_INK}
                    strokeWidth={2.2}
                  />
                </>
              )}
              {t === START && (
                <rect
                  x={vakX(t)}
                  y={vakY(t)}
                  width={k}
                  height={k}
                  fill={DATA}
                  fillOpacity={0.09}
                />
              )}
              {/* De rasterlijn moet op een beamer te zien zijn. RULE alleen
                  verdween tussen de eigen rasterlijnen van Canvas, waardoor de
                  48 vakjes niet meer als 48 vakjes te lezen waren. */}
              <rect
                x={vakX(t)}
                y={vakY(t)}
                width={k}
                height={k}
                fill="none"
                stroke={MUTED}
                strokeOpacity={0.42}
                strokeWidth={1}
              />
            </g>
          )
        })}

        <rect
          x={links}
          y={boven}
          width={breedte}
          height={hoogte}
          fill="none"
          stroke={MUTED}
          strokeOpacity={0.6}
          strokeWidth={1.8}
          pointerEvents="none"
        />

        {/* De driehoek: de beste actie die de agent in dit vakje al kent. */}
        {alleVakjes.map((t) => {
          if (AFGROND.has(t) || t === SCHAT) return null
          if (nogNietsGeleerd(q[t])) return null
          return (
            <Driehoek
              key={`p${t}`}
              cx={midX(t)}
              cy={midY(t)}
              actie={besteActie(q[t])}
              maat={k * 0.24}
              kleur={bereikt[t] ? MODEL : MUTED}
              sterk={bereikt[t]}
            />
          )
        })}

        {/* Het spoor van Test de agent. */}
        {test && test.tot > 0 && (
          <g>
            {test.pad.toestanden.slice(0, test.tot + 1).map((t, i, rij) => {
              if (i === 0) return null
              const vorige = rij[i - 1]
              if (!naastElkaar(vorige, t)) return null
              return (
                <line
                  key={`sp${i}`}
                  x1={midX(vorige)}
                  y1={midY(vorige)}
                  x2={midX(t)}
                  y2={midY(t)}
                  stroke={MODEL}
                  strokeWidth={Math.max(3, k * 0.11)}
                  strokeLinecap="round"
                  opacity={0.55}
                />
              )
            })}
          </g>
        )}

        {/* De uitgelichte rij van de q-tabel, als een kader op het bord. */}
        <rect
          x={vakX(actieveRij)}
          y={vakY(actieveRij)}
          width={k}
          height={k}
          fill="none"
          stroke={NAVY}
          strokeWidth={2.4}
          strokeDasharray={vast === actieveRij ? undefined : '5 4'}
          pointerEvents="none"
        />

        {/* De agent. */}
        <circle
          cx={midX(agent)}
          cy={midY(agent)}
          r={Math.max(5, k * 0.2)}
          fill={DATA}
          stroke="#fff"
          strokeWidth={2.5}
          pointerEvents="none"
        />

        {/* De vangrasters voor aanwijzen en klikken staan bovenop. */}
        {alleVakjes.map((t) => (
          <rect
            key={`r${t}`}
            x={vakX(t)}
            y={vakY(t)}
            width={k}
            height={k}
            fill="none"
            pointerEvents="all"
            style={{ cursor: 'pointer' }}
            onPointerMove={(e) => {
              if (e.buttons === 0) onWijs(t)
            }}
            onPointerDown={(e) => {
              neer.current = { x: e.clientX, y: e.clientY, toestand: t }
            }}
            onPointerUp={(e) => klikEinde(e, t)}
          />
        ))}
      </g>

      {/* De woorden bij de wereld. Ze staan buiten het raster, want een vakje
          is op een beamer te klein voor een woord van 13 px. */}
      <BordTekst x={links} y={boven - 9} anker="start" maat={Math.min(maat, 13.5)}>
        48 vakjes = 48 rijen in de q-tabel
      </BordTekst>
      <BordTekst
        x={links + 5.5 * k}
        y={boven + hoogte - k / 2 + 5}
        anker="middle"
        maat={Math.max(13, Math.min(15, k * 0.42))}
        kleur={FOUT_INK}
      >
        afgrond
      </BordTekst>
      <BordTekst x={links} y={boven + hoogte + 17} anker="start" kleur={INK}>
        start
      </BordTekst>
      <BordTekst x={links + breedte} y={boven + hoogte + 17} anker="end" kleur={DERDE_INK}>
        schat
      </BordTekst>

      <Uitleg
        x={links + breedte / 2}
        y={boven + hoogte + UITLEG}
        maat={maat}
        modus={modus}
        laatste={laatste}
        test={test}
        episode={episode}
        stapInEpisode={stapInEpisode}
        beloningInEpisode={beloningInEpisode}
        netGetraind={netGetraind}
        aantalBereikt={aantalBereikt}
      />

      <BeloningCurve
        x={links}
        y={boven + hoogte + CURVE}
        breedte={breedte}
        hoogte={curveHoogte}
        waarden={curve}
      />
    </>
  )
}

/** Bordtekst: minstens 13 px, vet, met een witte rand tegen de rasterlijnen. */
function BordTekst({
  x,
  y,
  anker,
  maat = 13.5,
  kleur = INK,
  children,
}: {
  x: number
  y: number
  anker: 'start' | 'middle' | 'end'
  maat?: number
  kleur?: string
  children: React.ReactNode
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anker}
      fontSize={maat}
      fontWeight={700}
      fill={kleur}
      stroke="#fff"
      strokeWidth={3.5}
      paintOrder="stroke"
      pointerEvents="none"
    >
      {children}
    </text>
  )
}

const RICHTING: Record<number, [number, number]> = {
  [OMHOOG]: [0, -1],
  [RECHTS]: [1, 0],
  [OMLAAG]: [0, 1],
  [LINKS]: [-1, 0],
}

/** De beste actie als een driehoek: een vorm, niet alleen een kleur. */
function Driehoek({
  cx,
  cy,
  actie,
  maat,
  kleur,
  sterk,
}: {
  cx: number
  cy: number
  actie: number
  maat: number
  kleur: string
  sterk: boolean
}) {
  const [dx, dy] = RICHTING[actie]
  const m = Math.max(4.5, maat)
  // Punt vooraan, twee hoeken achteraan, loodrecht op de richting.
  const px = cx + dx * m
  const py = cy + dy * m
  const ax = cx - dx * m * 0.7 + dy * m * 0.72
  const ay = cy - dy * m * 0.7 - dx * m * 0.72
  const bx = cx - dx * m * 0.7 - dy * m * 0.72
  const by = cy - dy * m * 0.7 + dx * m * 0.72
  return (
    <path
      d={`M ${px} ${py} L ${ax} ${ay} L ${bx} ${by} Z`}
      fill={kleur}
      fillOpacity={sterk ? 0.9 : 0.34}
      pointerEvents="none"
    />
  )
}

/* -------------------------- de uitleg ---------------------------- */

function Uitleg({
  x,
  y,
  maat,
  modus,
  laatste,
  test,
  episode,
  stapInEpisode,
  beloningInEpisode,
  netGetraind,
  aantalBereikt,
}: {
  x: number
  y: number
  maat: number
  modus: Modus
  laatste: Update | null
  test: Test | null
  episode: number
  stapInEpisode: number
  beloningInEpisode: number
  netGetraind: boolean
  aantalBereikt: number
}) {
  const regel = (i: number) => y + i * Math.round(maat * 1.62)
  const groot = Math.round(maat * 1.28)

  if (modus === 'trainen') {
    return (
      <>
        <BordTekst x={x} y={regel(0)} anker="middle" maat={maat}>
          Trainen: episode {heelGetal(episode)}
        </BordTekst>
        <BordTekst x={x} y={regel(1)} anker="middle" maat={maat} kleur={MUTED}>
          Kent de weg vanaf {aantalBereikt} vakjes.
        </BordTekst>
        {/*
          De RICHTING, niet de omvang. Het aantal vakjes met een weg naar de
          schat zakt onderweg vaak: bij deze seed 127 keer op 500 episodes,
          één keer met 23 vakjes tegelijk, en het eindigt op 28 na een piek
          van 34. "Het blauw groeit" werd dus door de teller ernaast
          tegengesproken. Wat wel klopt is de volgorde: gemeten over 40 seeds
          ligt het eerste-bekend van de schat naar de start 39 keer op 40
          oplopend, en bij deze seed is dat 17 17 49 54 54 76 82 82 82 154 160
          168, met de start op 168 als laatste.
        */}
        <BordTekst x={x} y={regel(2)} anker="middle" maat={maat} kleur={MUTED}>
          De schat eerst, de start het laatst.
        </BordTekst>
      </>
    )
  }

  if (test) {
    const klaar = test.tot >= test.pad.acties.length
    return (
      <>
        <BordTekst x={x} y={regel(0)} anker="middle" maat={maat}>
          Test: hij kiest altijd zijn beste actie.
        </BordTekst>
        {!klaar && (
          <BordTekst x={x} y={regel(1)} anker="middle" maat={maat} kleur={MUTED}>
            stap {test.tot}
          </BordTekst>
        )}
        {klaar && test.pad.klaar && (
          <>
            <BordTekst x={x} y={regel(1)} anker="middle" maat={groot} kleur={MODEL}>
              {test.pad.acties.length} stappen, totale beloning {test.pad.totaleBeloning}
            </BordTekst>
            <BordTekst x={x} y={regel(2)} anker="middle" maat={maat} kleur={MUTED}>
              {test.pad.totaleBeloning === KORTSTE_PAD
                ? 'Dat is het kortste pad naar de schat.'
                : 'Het kortste pad haalt -13.'}
            </BordTekst>
          </>
        )}
        {klaar && !test.pad.klaar && (
          <>
            <BordTekst x={x} y={regel(1)} anker="middle" maat={groot} kleur={FOUT_INK}>
              Hij haalt de schat niet.
            </BordTekst>
            <BordTekst x={x} y={regel(2)} anker="middle" maat={maat} kleur={MUTED}>
              Niet binnen {LES.maxStappen} stappen.
            </BordTekst>
            <BordTekst x={x} y={regel(3)} anker="middle" maat={maat} kleur={MUTED}>
              Zijn q-tabel weet nog te weinig.
            </BordTekst>
          </>
        )}
      </>
    )
  }

  if (netGetraind) {
    return (
      <>
        {/*
          De teller van het bord, niet het vaste getal 500. Wie twee keer op
          Train drukt, staat op episode 1 000, en dan sprak "500 episodes
          getraind" het paneel linksonder tegen.
        */}
        <BordTekst x={x} y={regel(0)} anker="middle" maat={maat}>
          {heelGetal(episode)} episodes getraind.
        </BordTekst>
        <BordTekst x={x} y={regel(1)} anker="middle" maat={maat}>
          De agent kent de weg
        </BordTekst>
        <BordTekst x={x} y={regel(2)} anker="middle" maat={groot} kleur={MODEL}>
          vanaf {aantalBereikt} van de {VAKJES_MET_EEN_WEG} vakjes.
        </BordTekst>
        <BordTekst x={x} y={regel(3)} anker="middle" maat={maat} kleur={MUTED}>
          Druk op Test de agent.
        </BordTekst>
      </>
    )
  }

  if (!laatste) {
    return (
      <>
        <BordTekst x={x} y={regel(0)} anker="middle" maat={maat}>
          De q-tabel staat nog vol nullen.
        </BordTekst>
        <BordTekst x={x} y={regel(1)} anker="middle" maat={maat} kleur={MUTED}>
          Druk op Eén stap.
        </BordTekst>
        <BordTekst x={x} y={regel(2)} anker="middle" maat={maat} kleur={MUTED}>
          Kijk welk getal verandert.
        </BordTekst>
      </>
    )
  }

  const u = laatste

  if (modus === 'episode') {
    return (
      <>
        <BordTekst x={x} y={regel(0)} anker="middle" maat={maat}>
          Eén episode: stap {stapInEpisode}
        </BordTekst>
        <BordTekst x={x} y={regel(1)} anker="middle" maat={maat} kleur={MUTED}>
          totale beloning {beloningInEpisode}
        </BordTekst>
        <BordTekst x={x} y={regel(2)} anker="middle" maat={maat} kleur={MUTED}>
          toestand {u.toestand} &middot; actie {ACTIENAAM[u.actie]}
        </BordTekst>
        <BordTekst x={x} y={regel(3)} anker="middle" maat={groot} kleur={MODEL}>
          {komma(u.oudeWaarde, 2)} {'→'} {komma(u.nieuweWaarde, 2)}
        </BordTekst>
      </>
    )
  }

  const verschil = u.nieuweWaarde - u.oudeWaarde
  const omhoog = verschil > 1e-9
  const omlaag = verschil < -1e-9
  const reden = omlaag
    ? 'Slechter dan de agent dacht.'
    : omhoog
      ? 'Beter dan de agent dacht.'
      : 'Even goed als de agent dacht.'
  const gevolg = omlaag
    ? 'We verlagen dit getal.'
    : omhoog
      ? 'We verhogen dit getal.'
      : 'Dit getal blijft gelijk.'
  const keuze = u.willekeurig
    ? 'Willekeurig gekozen, door epsilon.'
    : u.rijWasGelijk
      ? // Niet "stonden op 0": een rij kan ook op vier gelijke NIET-nulwaarden
        // staan, en dan liegt dat woord tegen de tabel ernaast. Bij deze seed
        // gebeurt dat 21 keer in 500 episodes, voor het eerst al in episode 1
        // op toestand 4, met de rij [-0,1 -0,1 -0,1 -0,1].
        'Alle vier de getallen waren gelijk.'
      : 'De beste actie die hij al kende.'

  return (
    <>
      <BordTekst x={x} y={regel(0)} anker="middle" maat={maat}>
        toestand {u.toestand} &middot; actie {ACTIENAAM[u.actie]}
      </BordTekst>
      <BordTekst x={x} y={regel(1)} anker="middle" maat={maat} kleur={MUTED}>
        beloning {u.beloning} &middot; q_tabel[{u.toestand}][{u.actie}]
      </BordTekst>
      <BordTekst x={x} y={regel(2)} anker="middle" maat={groot} kleur={MODEL}>
        {komma(u.oudeWaarde, 2)} {'→'} {komma(u.nieuweWaarde, 2)}
      </BordTekst>
      <BordTekst x={x} y={regel(3)} anker="middle" maat={maat}>
        {reden}
      </BordTekst>
      <BordTekst x={x} y={regel(4)} anker="middle" maat={maat}>
        {gevolg}
      </BordTekst>
      <BordTekst x={x} y={regel(5)} anker="middle" maat={maat} kleur={MUTED}>
        {keuze}
      </BordTekst>
      {u.inDeAfgrond && (
        <BordTekst x={x} y={regel(6)} anker="middle" maat={maat} kleur={FOUT_INK}>
          Hij viel in de afgrond.
        </BordTekst>
      )}
    </>
  )
}

/* --------------------------- de curve ---------------------------- */

/** Een ronde ondergrens die alleen groeit, zodat de curve niet herschaalt. */
function ondergrens(waarden: number[]): number {
  const laagste = waarden.length > 0 ? Math.min(...waarden) : -50
  const m = Math.max(50, Math.abs(laagste))
  const p = Math.pow(10, Math.floor(Math.log10(m)))
  return -Math.ceil(m / p) * p
}

function BeloningCurve({
  x,
  y,
  breedte,
  hoogte,
  waarden,
}: {
  x: number
  y: number
  breedte: number
  hoogte: number
  waarden: number[]
}) {
  const onder = ondergrens(waarden)
  const n = Math.max(waarden.length, 2)
  const px = (i: number) => x + (i / (n - 1)) * breedte
  const py = (v: number) => y + (Math.min(0, Math.max(onder, v)) / onder) * hoogte
  const pad = waarden.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ')

  /**
   * De stippellijn van het kortste pad, en haar label ONDER de lijn, links.
   *
   * Ze stond eerst boven de lijn en rechts, en dat botste. Zodra de curve
   * dieper zakt, groeit de onderkant van de grafiek mee en kruipt de lijn van
   * -13 naar de bovenrand: na 500 episodes staat ze op 400 diep, dus nog geen
   * 2 px onder de rand. Op 900x700 is het kader maar 262 px breed, en de twee
   * bijschriften zijn samen 284 px, dus ze passen daar niet naast elkaar.
   * Gemeten overlapten ze 21,6 bij 13,1 px en waren allebei onleesbaar.
   *
   * Onder de lijn is er altijd plaats: de kopregel eindigt 4 px boven het
   * kader en dit label begint minstens 2 px eronder. Links, want daar ligt de
   * curve in het begin diep en dus nooit onder de stippellijn.
   *
   * De lijn zelf verschijnt pas na de eerste episode. Zonder curve valt er
   * niets mee te vergelijken, en de plaats waar ze dan zou staan is precies
   * de plaats van de zin "nog geen episode gespeeld".
   */
  const yLijn = py(KORTSTE_PAD)

  return (
    <g pointerEvents="none">
      <BordTekst x={x} y={y - 8} anker="start" maat={13} kleur={MUTED}>
        totale beloning per episode
      </BordTekst>
      <line x1={x} y1={y} x2={x + breedte} y2={y} stroke={RULE} strokeWidth={1} />
      <line x1={x} y1={y} x2={x} y2={y + hoogte} stroke={RULE} strokeWidth={1} />
      {waarden.length > 0 && (
        <>
          <line
            x1={x}
            y1={yLijn}
            x2={x + breedte}
            y2={yLijn}
            stroke={DERDE}
            strokeWidth={1.5}
            strokeDasharray="5 4"
          />
          <BordTekst x={x + 4} y={yLijn + 15} anker="start" maat={13} kleur={DERDE_INK}>
            -13 = het kortste pad
          </BordTekst>
        </>
      )}
      {waarden.length === 0 ? (
        <BordTekst x={x + breedte / 2} y={y + hoogte / 2} anker="middle" maat={13} kleur={MUTED}>
          nog geen episode gespeeld
        </BordTekst>
      ) : (
        <>
          <polyline
            points={pad}
            fill="none"
            stroke={MODEL}
            strokeWidth={1.6}
            strokeLinejoin="round"
          />
          {/* Met één episode heeft een polyline geen lengte en zie je niets. */}
          <circle
            cx={px(waarden.length - 1)}
            cy={py(waarden[waarden.length - 1])}
            r={2.6}
            fill={MODEL}
            stroke="#fff"
            strokeWidth={1.4}
          />
          <BordTekst x={x} y={y + hoogte + 16} anker="start" maat={13} kleur={MUTED}>
            {heelGetal(onder)}
          </BordTekst>
          <BordTekst x={x + breedte} y={y + hoogte + 16} anker="end" maat={13} kleur={MUTED}>
            episode {heelGetal(waarden.length)}
          </BordTekst>
        </>
      )}
    </g>
  )
}

/* -------------------------- de q-tabel --------------------------- */

/** Wat er in de wereld op dit vakje staat, in de woorden van de les. */
function terreinVan(t: number): string {
  if (t === START) return 'start'
  if (t === SCHAT) return 'schat'
  if (AFGROND.has(t)) return 'afgrond'
  return 'gras'
}

function QTabelPaneel({
  q,
  actieveRij,
  vast,
  agent,
  veranderd,
  volgAgent,
  onWijs,
  onKlik,
}: {
  q: QTabel
  actieveRij: number
  vast: number | null
  agent: number
  veranderd: Update | null
  /**
   * Mag de rij van de agent zichzelf in beeld halen? Tijdens het trainen niet:
   * de agent springt dan tientallen keren per beeld en het paneel zou razen.
   * Een rij die de leerling zelf aanwijst of vastzet, volgt altijd.
   */
  volgAgent: boolean
  onWijs: (t: number | null) => void
  onKlik: (t: number) => void
}) {
  const lijst = useRef<HTMLDivElement>(null)
  const rijen = useRef(new Map<number, HTMLDivElement>())

  /**
   * De UITGELICHTE rij in beeld houden, en alleen als ze eruit loopt. Zelf
   * rekenen in plaats van scrollIntoView: die laatste kan een ouderelement
   * meescrollen, en op dit bord mag niets buiten dit paneel bewegen.
   *
   * Dit volgde vroeger alleen de agent, en dus juist NIET de rij die de
   * leerling aanwees of vastklikte. Van de 48 rijen staan er ongeveer 22 in
   * beeld, dus voor meer dan de helft van het bord deed een klik zichtbaar
   * niets, terwijl dit paneel eronder zegt dat je een vakje moet aanwijzen om
   * zijn rij te zien.
   */
  const volgen = volgAgent || actieveRij !== agent ? actieveRij : null
  useEffect(() => {
    if (volgen === null) return
    const c = lijst.current
    const el = rijen.current.get(volgen)
    if (!c || !el) return
    const boven = el.offsetTop
    const onder = boven + el.offsetHeight
    if (boven < c.scrollTop) c.scrollTop = boven
    else if (onder > c.scrollTop + c.clientHeight) c.scrollTop = onder - c.clientHeight
  }, [volgen])

  return (
    <Panel className="pointer-events-auto absolute bottom-4 right-4 top-4 z-10 flex w-[17rem] flex-col px-3.5 py-3 xl:w-[21rem]">
      <div className="shrink-0">
        <span className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-ink/75">
          De q-tabel
        </span>
        <p className="mt-1 text-[13px] font-medium leading-snug text-ink">
          48 rijen: één per toestand. 4 kolommen: één per actie.
        </p>
        <p className="mt-1 text-[12.5px] leading-snug text-ink/80">
          Elk getal zegt hoe goed het is om die actie in die toestand te kiezen. Het kadertje staat
          rond het hoogste getal van de rij. Staan de vier getallen gelijk, dan is er geen kadertje.
        </p>
      </div>

      <div className="mt-2 grid shrink-0 grid-cols-[2.9rem_1fr_1fr_1fr_1fr] items-end gap-x-1 border-b border-black/[0.07] px-1 pb-1 text-[10px] text-muted">
        <span className="font-mono text-[9.5px]">toestand</span>
        {ACTIENAAM.map((naam, a) => (
          <span key={naam} className="text-right leading-tight">
            <span className="block font-mono">{a}</span>
            {naam}
          </span>
        ))}
      </div>

      <div
        ref={lijst}
        className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain"
        onPointerLeave={() => onWijs(null)}
      >
        {Array.from({ length: AANTAL_TOESTANDEN }, (_, t) => (
          <TabelRij
            key={t}
            toestand={t}
            waarden={q[t]}
            uitgelicht={actieveRij === t}
            vastgezet={vast === t}
            erAgent={agent === t}
            veranderdeActie={veranderd && veranderd.toestand === t ? veranderd.actie : null}
            onWijs={onWijs}
            onKlik={onKlik}
            refCb={(el) => {
              if (el) rijen.current.set(t, el)
            }}
          />
        ))}
      </div>

      <p className="mt-2 shrink-0 text-[11.5px] leading-snug text-ink/70">
        Wijs een vakje op het bord aan om zijn rij te zien. Klik om ze vast te zetten.
      </p>
    </Panel>
  )
}

function TabelRij({
  toestand,
  waarden,
  uitgelicht,
  vastgezet,
  erAgent,
  veranderdeActie,
  onWijs,
  onKlik,
  refCb,
}: {
  toestand: number
  waarden: number[]
  uitgelicht: boolean
  vastgezet: boolean
  erAgent: boolean
  veranderdeActie: number | null
  onWijs: (t: number | null) => void
  onKlik: (t: number) => void
  refCb: (el: HTMLDivElement | null) => void
}) {
  const leeg = nogNietsGeleerd(waarden)
  const beste = besteActie(waarden)
  const hoog = Math.max(...waarden)
  const laag = Math.min(...waarden)
  const terrein = terreinVan(toestand)

  return (
    <div
      ref={refCb}
      onPointerEnter={() => onWijs(toestand)}
      onClick={() => onKlik(toestand)}
      className={`grid cursor-pointer grid-cols-[2.9rem_1fr_1fr_1fr_1fr] items-center gap-x-1 rounded-md px-1 py-[3px] ${
        uitgelicht ? 'bg-model/12' : 'hover:bg-model/6'
      }`}
    >
      <div className="leading-none">
        <div
          className={`font-mono text-[11px] tabular-nums ${
            uitgelicht ? 'font-bold text-navy' : 'text-ink'
          }`}
        >
          {erAgent && (
            <span
              className="mr-1 inline-block size-[6px] rounded-full align-middle"
              style={{ background: DATA }}
              aria-label="de agent staat hier"
            />
          )}
          {toestand}
          {vastgezet && <span className="ml-0.5 text-model">&bull;</span>}
        </div>
        <div className="mt-[2px] text-[9.5px] leading-none text-muted">{terrein}</div>
      </div>
      {waarden.map((v, a) => {
        const isBeste = !leeg && a === beste
        const deel = leeg || hoog === laag ? 0 : (v - laag) / (hoog - laag)
        return (
          <div
            key={a}
            className={`rounded-[3px] px-0.5 py-[1px] text-right font-mono text-[10.5px] tabular-nums ${
              isBeste ? 'font-bold text-navy' : 'text-ink/75'
            }`}
            style={{
              background: deel > 0 ? `color-mix(in srgb, ${MODEL} ${(deel * 22).toFixed(0)}%, transparent)` : undefined,
              boxShadow: isBeste ? `inset 0 0 0 1.5px ${MODEL}` : undefined,
              outline: veranderdeActie === a ? `2px solid ${NAVY}` : undefined,
            }}
          >
            {komma(v, 1)}
          </div>
        )
      })}
    </div>
  )
}

/* --------------------------- de schuif --------------------------- */

function Schuif({
  naam,
  waarde,
  min,
  max,
  stap,
  uitleg,
  extra,
  onChange,
}: {
  naam: string
  waarde: number
  min: number
  max: number
  stap: number
  uitleg: string
  /** Een tweede regel, alleen waar de les er iets over te zeggen heeft. */
  extra?: string
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12.5px] font-semibold leading-tight text-navy">{naam}</span>
        <span className="shrink-0 font-mono text-[12.5px] tabular-nums text-model">
          {parameterGetal(waarde)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={stap}
        value={waarde}
        aria-label={naam}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full"
      />
      <p className="text-[11.5px] leading-snug text-ink/70">{uitleg}</p>
      {extra && <p className="mt-0.5 text-[11.5px] leading-snug text-ink/70">{extra}</p>}
    </div>
  )
}
