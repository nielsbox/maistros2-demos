import { useEffect, useRef, useState, type MouseEvent } from 'react'
import Canvas, { type Scales, type View } from '../components/Canvas'
import { Brief, Btn, Divider, Note, Panel, PyChip } from '../components/Overlay'
import Vaststelling, { getal, meervoud } from '../components/Vaststelling'
import { FOUT_INK, INK, MODEL, MUTED, NAVY } from '../lib/palette'
import {
  GOED,
  K_MAX,
  K_MIN,
  K_START,
  START,
  VOORBEELDEN,
  aanpassing,
  einde,
  fouten,
  groottes,
  isExact,
  leersnelheid,
  samen,
  steedsGroter,
  telSprongen,
  volgende,
  type Einde,
} from '../lib/leersnelheid'

/* ------------------------------------------------------------------ *
 * Les 10: kies de leersnelheid.
 *
 * WAT DIT BORD LEERT is de machine, niet een getraind model. Er is geen model
 * dat klaarstaat: de leerling draait zelf de trainingslus van les 9, één
 * aanpassing per klik. Uitvoer (pond x gewicht), de fout per voorbeeld, de
 * fouten samen, dan aanpassing = leersnelheid x fouten samen, dan het nieuwe
 * gewicht. Wie het bord gebruikt heeft, kan zeggen hoe het netwerk zijn gewicht
 * verandert, en waarom het bij een grote leersnelheid voorbij het goede gewicht
 * springt: één aanpassing is dan groter dan de afstand tot daar.
 *
 * Het onderscheid parameter/hyperparameter van 2156004 en 2156003 wordt iets
 * wat je ZIET: het gewicht beweegt vanzelf, de leersnelheid kies jij voor het
 * trainen begint en ze verandert nooit.
 *
 * DE DOELZIN ZEGT DE REGEL, niet "ze bepaalt hoe groot elke aanpassing is"
 * (2156007). Op dit bord blijft de leersnelheid vast terwijl elke aanpassing
 * krimpt - bij 0,05 gaan ze 0,0732, 0,0366, 0,0183 - omdat de grootte
 * leersnelheid x fouten samen is. Een leerling die de doelzin leest en dan de
 * bogen ziet krimpen, zou het bord zichzelf zien tegenspreken.
 *
 * HET BORD GEEFT GEEN OORDEEL. 0,05 en 0,15 hebben allebei 12 aanpassingen
 * nodig, 0,02 en 0,18 allebei 36 (exact symmetrisch rond 0,10). Dus nergens
 * staat dat voorbij springen erger is dan kruipen, of welke leersnelheid de
 * beste is. Het bord telt, de leerling vergelijkt. Dat 0,10 in één aanpassing
 * aankomt, is een eigenschap van een netwerk met één gewicht; de zin "Welke
 * waarde goed is, verschilt per netwerk" in het rechterpaneel kadert dat, en
 * het bord licht het niet uit.
 *
 * WAT DE LEERLING NIET MEENEEMT is een getal. Zijn netwerk in stap 4 gebruikt
 * adam, en de stap van adam is ongeveer de leersnelheid zelf; hier groeit de
 * aanpassing met de fout. Daarom start de schuif op 0,02: geen van de waarden
 * van de les (0.0001, 0.001, 0.01) staat erop, en het bord noemt geen solver.
 *
 * WOORDEN, uit de slides en niet verzonnen (5238 = les 10, 5206 = les 9):
 *   leersnelheid        2156003, 2156007, 2156754, 2156755
 *   gewicht             2156004, 2156007, 2156755; les 9 2155701
 *   getal               les 9 2155521-2155531, het woord van les 9 voor het
 *                       gewicht, één keer gebruikt als brug in de Brief
 *   aanpassing          2156007, 2156755; les 9 2155531
 *   fout, te veel, te weinig, pond, kilogram, voorbeeld, uitvoer: les 9
 *   het simpelste neurale netwerk: de titel van 2155236
 * Niet op het bord: "stap" (dat zijn de oefeningen: Stap 1 tot 5), "iteratie",
 * "de computer" (de acteur is hier het netwerk), "neuron" als acteur, en een
 * fout met een teken: les 9 draait het teken zelf om tussen 2155522 en 2155529.
 * ------------------------------------------------------------------ */

/**
 * Het venster waarop het bord opent: het stopbereik 0,25 tot 0,65 met wat
 * lucht. Het verste waar een training stopt is 0,6679 (bij 0,21), dus ook dat
 * staat bij het openen nog in beeld. Canvas kadert dit in het vlak dat de
 * panelen vrijlaten.
 */
const VENSTER: View = { x0: 0.24, x1: 0.68, y0: -1, y1: 1 }

/** Trainen: de eerste vijf aanpassingen traag genoeg om te volgen, daarna
 *  vlot. 100 aanpassingen duren zo 4 x 250 + 95 x 60 ms, ongeveer 7 s. */
const TRAAG_MS = 250
const VLOT_MS = 60
const TRAAG_AANTAL = 5

/** Onder deze lengte wordt een boog niet getekend: alleen het punt beweegt.
 *  Bij 0,02 is op een lijn van 420 px 23 van de 36 aanpassingen korter. */
const MIN_BOOG_PX = 2
/** Vanaf deze lengte krijgt de laatste boog zijn grootte erbij. Bij 0,02 haalt
 *  geen enkele boog dat (de eerste is 31 px op 420 px), en dan staat het getal
 *  alleen in de tabel. */
const LABEL_BOOG_PX = 40

const HALO = { stroke: '#fff', strokeWidth: 3.5, paintOrder: 'stroke' } as const

type Vorige = { k: number; einde: Einde; n: number }

export default function KiesDeLeersnelheid() {
  const [k, setK] = useState(K_START)
  /** Het pad van het gewicht: pad[0] is de start, elke volgende waarde komt na
   *  één aanpassing. Op volle precisie, zie de kop van lib/leersnelheid.ts. */
  const [pad, setPad] = useState<number[]>([START])
  const [bezig, setBezig] = useState(false)
  const [vorige, setVorige] = useState<Vorige | null>(null)

  const timer = useRef<number | null>(null)

  const stopTimer = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
  }
  // Een lopende training mag nooit een bord bijwerken dat al weg is.
  useEffect(() => stopTimer, [])

  const lr = leersnelheid(k)
  const n = pad.length - 1
  const eind = einde(pad)
  const sprongen = telSprongen(pad)

  /* De knoppen lezen `pad` uit de render waarin ze gemaakt zijn. Dat is altijd
     de laatste: elke aanpassing is een nieuwe render, ook tijdens het trainen. */
  function eenAanpassing() {
    if (bezig || einde(pad)) return
    setPad((p) => (einde(p) ? p : [...p, volgende(p[p.length - 1], lr)]))
  }

  function trainen() {
    if (bezig || einde(pad)) return
    stopTimer()
    let p = pad
    const verder = () => [...p, volgende(p[p.length - 1], lr)]

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true) {
      while (!einde(p)) p = verder()
      setPad(p)
      return
    }

    setBezig(true)
    let gedaan = 0
    const tik = () => {
      p = verder()
      gedaan++
      setPad(p)
      if (einde(p)) {
        timer.current = null
        setBezig(false)
        return
      }
      timer.current = window.setTimeout(tik, gedaan < TRAAG_AANTAL ? TRAAG_MS : VLOT_MS)
    }
    // De eerste aanpassing meteen: een knop die pas na een kwart seconde iets
    // doet, leest als een knop die het niet doet.
    tik()
  }

  /** Terug naar 0,6. Een afgelopen training wordt de "vorige training". */
  function wis(volgendeK = k) {
    stopTimer()
    setBezig(false)
    const e = einde(pad)
    if (e) setVorige({ k, einde: e, n: pad.length - 1 })
    setK(volgendeK)
    setPad([START])
  }

  const tweedeKlik = useTweedeKlikOpAndereKnop()

  return (
    <div className="relative h-full w-full">
      <Canvas defaultView={VENSTER} axes={false}>
        {(s) => <Getallenlijn s={s} pad={pad} lr={lr} />}
      </Canvas>

      {/*
        De eerste alinea is het DOEL en blijft altijd staan, ook op een beamer
        waar de rest inklapt. Wie hier vanaf slide 2156755 binnenvalt, ziet de
        portaalkaart nooit.
      */}
      <Brief eyebrow="mAIstros 2 - les 10" title="Kies de leersnelheid">
        <p>
          Het netwerk past zijn gewicht zelf aan. Elke aanpassing is de leersnelheid maal de fouten
          samen. De leersnelheid kies jij.
        </p>
        {/* De brug naar les 9: daar heet het gewicht nog "het getal"
            (2155521-2155531). "Gewicht" komt pas op 2155701.
              ÉÉN ALINEA, en dat is gemeten. Vanaf 1280 px staat dit deel open,
            en met een tweede alinea ("Kijk in de tabel ... train opnieuw")
            reikte de Brief tot 338 px, terwijl het paneel linksonder op
            1280x720 al op 317 px begint. Met één alinea reikt hij tot 261 px.
            De opdracht om een andere leersnelheid te kiezen staat nu bij de
            schuif zelf, waar ze op elk scherm zichtbaar is. Het goede gewicht
            staat hier ook niet: dat staat al op het bord, bij zijn streep, en
            de rekenregel staat bovenaan het rechterpaneel. */}
        <p>
          Dit is het simpelste neurale netwerk uit les 9: één neuron. Het rekent pond om naar
          kilogram: pond maal een getal. Dat getal is zijn gewicht. Het begint bij{' '}
          {getal(START, 1)}, net als in les 9.
        </p>
      </Brief>

      <Rekenpaneel pad={pad} k={k} klaar={eind !== null} />

      {/*
        LINKSONDER: de teller, de schuif en de knoppen.
        DE KNOPPEN STAAN ONDERAAN, en dat is de dubbelklikbeveiliging in de
        opmaak zelf. Het paneel hangt aan de onderrand, dus wat onderaan staat
        verschuift niet als de tekst erboven langer of korter wordt: de lege
        teller heeft twee regels, de bezige één, een afgelopen training drie,
        en "Vorige training" komt er pas na de eerste. Stond de tekst onder de
        knoppen, dan schoof een knop onder de muis weg tussen twee klikken.
        Daarbovenop telt de tweede klik van een dubbelklik niet als ze op een
        ANDERE knop valt (zie `useTweedeKlikOpAndereKnop`).
          z-[9] en niet z-10: onder 1280 px staat de Brief dicht, en wie hem met +
        opent, krijgt een Brief die tot 330 px reikt, terwijl dit paneel op
        900x700 al bij 203 px kan beginnen (na 0,21, met de vorige training
        erbij). Dat kan niet zonder overlap. Dan ligt de uitleg die de leerling
        net zelf opende BOVENOP - zijn onderste regels waren anders onleesbaar
        achter dit paneel - en blijven de knoppen toch zichtbaar: die beginnen
        op 900x700 pas bij 546 px. Dicht, zoals hij opent, reikt de Brief tot
        186 px: 17 px boven dit paneel in zijn hoogste stand.
      */}
      <Panel className="pointer-events-auto absolute bottom-4 left-4 z-[9] flex max-h-[calc(100%-12rem)] w-[16rem] flex-col overflow-y-auto px-4 py-3.5 xl:max-h-[calc(100%-18rem)] xl:w-[21rem]">
        <div
          className="contents"
          onClickCapture={(e) => {
            if (tweedeKlik(e)) {
              e.stopPropagation()
              e.preventDefault()
            }
          }}
        >
          <Vaststelling
            label="aanpassingen"
            value={n === 0 ? null : n}
            empty="Nog geen aanpassing gedaan. Druk op Eén aanpassing."
            detail={vaststelling(eind, pad, sprongen)}
          />
          {vorige && (
            <p className="mt-1.5 text-[12.5px] leading-snug" style={{ color: MUTED }}>
              {vorigeZin(vorige)}
            </p>
          )}

          <Divider />

          <Schuif k={k} onKies={(v) => v !== k && wis(v)} />

          {/* Onder elkaar in het smalle paneel: naast elkaar brak "Begin
              opnieuw" daar over twee regels. Vanaf 1280 px passen de twee
              laatste naast elkaar, en dan is de hoogte nodig voor de Brief. */}
          <div className="mt-3 flex flex-col gap-1.5">
            <Btn full onClick={eenAanpassing} disabled={bezig || eind !== null}>
              Eén aanpassing
            </Btn>
            <div className="flex flex-col gap-1.5 xl:flex-row">
              <Btn full variant="ghost" onClick={trainen} disabled={bezig || eind !== null}>
                Trainen
              </Btn>
              <Btn full variant="ghost" onClick={() => wis()} disabled={n === 0 && !bezig}>
                Begin opnieuw
              </Btn>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  )
}

/* ------------------------------ de zinnen ----------------------------- *
 * Elk getal komt uit het pad, niets is ingetypt. De zinnen die een getal
 * noemen, zijn bij het laden nagerekend voor elke stand van de schuif (zie
 * VERWACHT in lib/leersnelheid.ts).                                       */

function vaststelling(eind: Einde | null, pad: readonly number[], sprongen: number): string {
  const w = pad[pad.length - 1]
  const erover =
    sprongen === 0
      ? 'Het sprong er nooit over.'
      : `Het sprong ${getal(sprongen)} keer over het goede gewicht.`
  if (eind === 'aangekomen') {
    // "afgerond": ook hier blijft er in de tabel 0,0001 tot 0,0005 fout over,
    // net als in les 9, waar 0.454 "een goed genoeg getal" is (2155530).
    return `Het gewicht staat op ${getal(w, 4)}: het goede gewicht, afgerond. ${erover}`
  }
  if (eind === 'grens') return `Nog niet op het goede gewicht. ${erover}`
  if (eind === 'buiten') {
    // Geen "uit beeld": wat in beeld is hangt van het zoomen af, dit niet.
    // 0,6679 en 0,6644 liggen allebei verder van 0,4536 dan de start 0,6.
    const verder = `Het gewicht staat op ${getal(w, 4)}, verder van het goede gewicht dan bij de start.`
    return steedsGroter(groottes(pad)) ? `${verder} Elke aanpassing was groter dan de vorige.` : verder
  }
  return 'Nog niet op het goede gewicht.'
}

/** Kiezen is vergelijken, en "Begin opnieuw" wist het spoor. Dus blijft de
 *  uitkomst van de vorige afgelopen training staan, in de woorden van de
 *  vaststelling zelf. */
function vorigeZin(v: Vorige): string {
  const lr = getal(leersnelheid(v.k), 2)
  const aantal = `${getal(v.n)} ${meervoud(v.n, 'aanpassing', 'aanpassingen')}`
  const begin = `Vorige training: leersnelheid ${lr},`
  if (v.einde === 'aangekomen') return `${begin} op het goede gewicht na ${aantal}.`
  if (v.einde === 'grens') return `${begin} na ${aantal} nog niet op het goede gewicht.`
  return `${begin} na ${aantal} verder weg dan bij de start.`
}

/* ---------------------------- het rekenpaneel ---------------------------- */

/**
 * Rechts: de tabel van les 9 (2155519) met de uitvoer en de fout erbij, en de
 * aanpassing die de VOLGENDE klik doet. De getallen gaan op 4 cijfers na de
 * komma, maar het bord rekent op volle precisie, dus een hand-controle kan
 * in het 4de cijfer 1 verschillen (bij 0,02 al bij de tweede aanpassing:
 * 3 x 0,5707 = 1,7121, de tabel toont 1,7122). Vandaar de Note, en "≈" waar
 * het product afgerond is.
 *
 * DE RICHTING STAAT BIJ ELKE FOUT, net als in les 9 ("0.4392 te veel"). In het
 * smalle paneel (onder 1280 px) op een eigen regel onder het getal, anders
 * past "1,0752 te weinig" niet naast drie kolommen. Het teken van de fout
 * toont het bord nooit: les 9 draait het zelf om tussen 2155522 en 2155529.
 */
function Rekenpaneel({ pad, k, klaar }: { pad: readonly number[]; k: number; klaar: boolean }) {
  const w = pad[pad.length - 1]
  const lr = leersnelheid(k)
  const f = fouten(w)
  const S = samen(w)
  const a = aanpassing(w, lr)
  const exact = isExact(k, S)
  const teVeel = S > 0
  const nul = (v: number) => getal(Math.abs(v), 4) === '0,0000'

  // Op een eindtoestand staat de knop uit: dan zegt de zin dat, niet wat een
  // volgende klik zou doen. En wat op 4 cijfers 0,0000 is, is "minder dan
  // 0,0001": "0,0000 kleiner" leest als "niet kleiner". Dat komt voor, bij 0,02
  // zeven keer voor het einde.
  const richting = teVeel ? 'Te veel' : 'Te weinig'
  const wordt = teVeel ? 'kleiner' : 'groter'
  let zin: string
  if (klaar) zin = 'Het trainen is gestopt.'
  else if (nul(a)) zin = `${richting}, dus het gewicht wordt minder dan 0,0001 ${wordt}.`
  else zin = `${richting}, dus het gewicht wordt ${getal(Math.abs(a), 4)} ${wordt}.`

  return (
    <Panel className="pointer-events-auto absolute right-4 top-4 z-10 flex max-h-[calc(100%-2rem)] w-[16rem] flex-col px-3.5 py-3 xl:w-[21rem]">
      <div className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-ink/75">
        Zo rekent het netwerk
      </div>
      {/* De regel van de eerste kolommen, in woorden. Ze stond eerst alleen in
          de Brief, en die is onder 1280 px ingeklapt. */}
      <p className="mt-1 text-[13px] text-ink">uitvoer = pond × gewicht</p>
      <p className="text-[13px] text-ink">
        bij gewicht{' '}
        <span className="font-bold tabular-nums" style={{ color: MODEL }}>
          {getal(w, 4)}
        </span>
      </p>

      <table className="mt-1.5 w-full border-collapse text-[12.5px] tabular-nums text-ink">
        <thead>
          <tr className="text-[11.5px] font-semibold text-ink/75">
            <th className="py-1 pr-1 text-left font-semibold">pond</th>
            <th className="px-1 py-1 text-right font-semibold">kilogram</th>
            <th className="px-1 py-1 text-right font-semibold">uitvoer</th>
            <th className="py-1 pl-1 text-right font-semibold">fout</th>
          </tr>
        </thead>
        <tbody>
          {VOORBEELDEN.map((v, i) => {
            // Het voorbeeld met 0 pond is altijd exact 0: toon het zoals les 9.
            const uitvoer = v.pond * w
            return (
              <tr key={v.pond} className="border-t border-black/[0.06] align-top">
                <td className="py-1 pr-1">{getal(v.pond)}</td>
                <td className="px-1 py-1 text-right">
                  {v.pond === 0 ? '0' : getal(v.kilogram, 4)}
                </td>
                <td className="px-1 py-1 text-right">
                  {v.pond === 0 ? '0' : getal(uitvoer, 4)}
                </td>
                <td className="py-1 pl-1 text-right" style={{ color: FOUT_INK }}>
                  <Fout v={f[i]} exactNul={v.pond === 0} />
                </td>
              </tr>
            )
          })}
          <tr className="border-t-2 border-black/[0.12] align-top font-semibold">
            <td colSpan={3} className="py-1 pr-1 text-right">
              fouten samen
            </td>
            <td className="py-1 pl-1 text-right" style={{ color: FOUT_INK }}>
              <Fout v={S} />
            </td>
          </tr>
        </tbody>
      </table>

      <div className="mt-2">
        <Note>Afgerond op 4 cijfers na de komma.</Note>
      </div>

      <div className="mt-2.5 space-y-0.5 text-[13px] leading-snug text-ink">
        {/* Harde spatie: "fouten samen" is één begrip en breekt niet over twee
            regels, zoals het in het smalle paneel eerst deed. */}
        <p>aanpassing = leersnelheid × fouten{'\u00a0'}samen</p>
        <p className="font-semibold tabular-nums">
          = {getal(lr, 2)} × {getal(Math.abs(S), 4)} {exact ? '=' : '≈'} {getal(Math.abs(a), 4)}
        </p>
        <p>{zin}</p>
      </div>

      <Divider />

      {/* De les-waarden staan alleen HIER, als tekst uit de slides: 0.001 op
          2228124 en "10 keer groter en 10 keer kleiner" op 2156754. Niet in
          de Brief, want die klapt in onder 1280 px, en "verschilt per netwerk"
          is net de zin die de leerling moet lezen voor hij een getal van dit
          bord meeneemt naar zijn eigen netwerk. */}
      <p className="text-[13px] font-semibold text-navy">En je netwerk van stap 4?</p>
      <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink/80">
        Daar staat de leersnelheid in je code: <PyChip>learning_rate_init=0.001</PyChip>. Welke
        waarde goed is, verschilt per netwerk. In stap 5 probeer je 10 keer groter en 10 keer
        kleiner.
      </p>
    </Panel>
  )
}

/** Een fout zonder teken, met de richting erbij. Wat op 4 cijfers 0,0000 is,
 *  krijgt geen "te veel" of "te weinig": "0,0000 te veel" is geen zin. */
function Fout({ v, exactNul = false }: { v: number; exactNul?: boolean }) {
  if (exactNul) return <>0</>
  const tekst = getal(Math.abs(v), 4)
  if (tekst === '0,0000') return <>{tekst}</>
  return (
    <>
      {tekst}
      <span className="block text-[11px] font-medium leading-tight xl:ml-1 xl:inline xl:text-[12px]">
        {v > 0 ? 'te veel' : 'te weinig'}
      </span>
    </>
  )
}

/* ------------------------------ de schuif ------------------------------ */

/**
 * Dezelfde schuif als op "Kijk in de q-tabel" (les 12, learning rate alpha,
 * "groter: verandert het getal meer"), hier als eigen kopie zodat dit bord
 * geen gedeeld component of ander bord aanraakt. Hij loopt in GEHELE stappen,
 * 2 tot 22, en de leersnelheid is k/100: zo kan er nooit 0,19999999999999998
 * uit komen.
 */
function Schuif({ k, onKies }: { k: number; onKies: (k: number) => void }) {
  const tekst = getal(leersnelheid(k), 2)
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12.5px] font-semibold leading-tight text-navy">leersnelheid</span>
        <span className="shrink-0 font-mono text-[12.5px] tabular-nums text-model">{tekst}</span>
      </div>
      <input
        type="range"
        min={K_MIN}
        max={K_MAX}
        step={1}
        value={k}
        aria-label="leersnelheid"
        aria-valuetext={tekst}
        onChange={(e) => onKies(Math.round(Number(e.target.value)))}
        className="w-full"
      />
      {/* NIET "groter: elke aanpassing is groter". Dat klopt alleen voor de
          eerste aanpassing vanaf 0,6. Gemeten over alle buren op de schuif:
          in 64 van de 272 paren is een latere aanpassing bij de grotere
          leersnelheid juist KLEINER (de 5de: 0,0120 bij 0,02, 0,0105 bij 0,03),
          omdat het gewicht dan al dichter bij het goede gewicht staat. Wat
          altijd klopt, is de regel zelf: bij dezelfde fouten. */}
      <p className="text-[11.5px] leading-snug text-ink/70">
        groter: dezelfde fouten geven een grotere aanpassing
      </p>
      <p className="mt-0.5 text-[11.5px] leading-snug text-ink/70">
        Kies een andere leersnelheid en train opnieuw. Het gewicht begint dan weer bij
        {'\u00a0'}
        {getal(START, 1)}.
      </p>
    </div>
  )
}

/* --------------------------- de tweede klik --------------------------- *
 * De tweede klik van een dubbelklik mag nooit een ANDERE knop indrukken dan
 * de eerste. Hetzelfde patroon als op "K-means stap voor stap" (les 7): een
 * klik telt als tweede als `detail` > 1 is, of als ze binnen 400 ms en minder
 * dan 10 px naast de vorige valt (een digibord kan elke tik detail 1 geven).
 * Met het toetsenbord is `detail` 0, en dan telt ze altijd.
 *
 * ANDERS DAN OP LES 7 telt een snelle tweede klik op DEZELFDE knop wel. Wie
 * vlug op "Eén aanpassing" klikt, wil elke klik zien: bij 0,02 zijn er 36
 * nodig. Een klik die zomaar niets doet, leest als een bord dat hapert. Op dit
 * bord verschuift geen knop tussen twee klikken (ze staan onderaan een paneel
 * dat aan de onderrand hangt), dus dezelfde plek is dezelfde knop.
 * ------------------------------------------------------------------ */

type Vorig = { t: number; x: number; y: number; doel: Element | null }

function useTweedeKlikOpAndereKnop() {
  const vorig = useRef<Vorig | null>(null)
  return (e: MouseEvent) => {
    if (e.detail === 0) return false
    const doel = (e.target as Element | null)?.closest('button, input') ?? null
    const v = vorig.current
    const snel =
      v !== null &&
      (e.detail > 1 || (e.timeStamp - v.t < 400 && Math.hypot(e.clientX - v.x, e.clientY - v.y) < 10))
    if (snel && doel !== v.doel) return true
    vorig.current = { t: e.timeStamp, x: e.clientX, y: e.clientY, doel }
    return false
  }
}

/* ---------------------------- de getallenlijn --------------------------- */

/** Breedte van een stuk bordtekst, gemeten met het echte lettertype. Valt
 *  terug op een ruime schatting als er (nog) geen canvas is. */
let meetCtx: CanvasRenderingContext2D | null | undefined
function breedte(tekst: string, px: number): number {
  if (meetCtx === undefined) meetCtx = document.createElement('canvas').getContext('2d')
  if (!meetCtx) return tekst.length * px * 0.6
  meetCtx.font = `700 ${px}px "Hanken Grotesk", ui-sans-serif, system-ui, sans-serif`
  return meetCtx.measureText(tekst).width
}

/** De stap tussen twee getallen op de lijn: de kleinste mooie stap met
 *  minstens 64 px ertussen. Op 900 px breed is dat 0,1, op 1440 0,05. */
function asStap(pxPerEenheid: number): number {
  const stappen = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5]
  return stappen.find((st) => st * pxPerEenheid >= 64) ?? 10
}

function Getallenlijn({ s, pad, lr }: { s: Scales; pad: readonly number[]; lr: number }) {
  const Y = s.sy(0)
  const n = pad.length - 1
  const w = pad[n]
  // 6 px binnen de linkerrand van het vrije vlak. Op 900x700 vraagt Canvas
  // meer ruimte voor de panelen dan het mag geven (KEEP), knijpt het vrije vlak
  // in, en dan staan de zoomknoppen er 4,7 px in - precies op de hoogte van
  // deze lijn. Gemeten na inzoomen: een boog liep daar onder de knoppen door.
  const L = s.safe.left + 6
  const R = s.safe.right
  const ppu = s.area.w / (s.view.x1 - s.view.x0)

  /* -------- de getallen onder de lijn: rij 1 -------- */
  const stap = asStap(ppu)
  const decimalen = Math.max(1, Math.round(-Math.log10(stap) + 0.49))
  const eerste = Math.ceil(s.view.x0 / stap)
  const laatste = Math.floor(s.view.x1 / stap)
  const getallen: number[] = []
  for (let i = eerste; i <= laatste && getallen.length < 200; i++) getallen.push(i * stap)

  const RIJ1 = Y + 27
  const RIJ2 = Y + 51

  // Het gewicht: zijn waarde op rij 1, of een merk aan de rand als het buiten
  // het vrije vlak staat (na zoomen of pannen).
  const wx = s.sx(w)
  // Met de straal van het punt (7) erbij, anders knipt de rand het half weg.
  const inBeeld = wx >= L + 8 && wx <= R - 8
  const wTekst = inBeeld ? getal(w, 4) : `uit beeld: ${getal(w, 4)}`
  const wBreed = breedte(wTekst, 14)
  const wLabelX = inBeeld
    ? Math.min(R - wBreed / 2 - 4, Math.max(L + wBreed / 2 + 4, wx))
    : wx < L
      ? L + 8 + wBreed / 2
      : R - 8 - wBreed / 2

  // Het goede gewicht: een navy streep op de lijn, de naam op rij 2.
  const gx = s.sx(GOED)
  const goedInBeeld = gx >= L + 4 && gx <= R - 4
  const asNaam = 'gewicht'
  const asBreed = breedte(asNaam, 13.5)
  const asLinks = R - 6 - asBreed
  const goedTekst = `het goede gewicht: ${getal(GOED, 4)}`
  const goedBreed = breedte(goedTekst, 13.5)
  const goedLinks = Math.max(L + 6, Math.min(gx - goedBreed / 2, asLinks - 14 - goedBreed))

  const getalBreed = (t: number) => breedte(getal(t, decimalen), 13)
  const zichtbareGetallen = getallen.filter((t) => {
    const x = s.sx(t)
    const b = getalBreed(t)
    if (x - b / 2 < L + 2 || x + b / 2 > R - 2) return false
    // Niet onder het label van het gewicht, en niet vlak naast de streep van
    // het goede gewicht: daar staat "0,45" anders boven "0,4536".
    if (Math.abs(x - wLabelX) < wBreed / 2 + b / 2 + 8) return false
    if (goedInBeeld && Math.abs(x - gx) < b / 2 + 14) return false
    return true
  })

  /* -------- de bogen -------- */
  const bogen: { x1: number; x2: number; laatste: boolean }[] = []
  for (let i = 1; i <= n; i++) {
    const x1 = s.sx(pad[i - 1])
    const x2 = s.sx(pad[i])
    if (Math.abs(x2 - x1) < MIN_BOOG_PX) continue
    bogen.push({ x1, x2, laatste: i === n })
  }
  const slot = bogen[bogen.length - 1]
  const laatsteBoog = slot?.laatste ? slot : null

  // De grootte bij de laatste boog, alleen als die lang genoeg is. Het getal
  // is dat van de aanpassing zelf, zoals de tabel het net aankondigde.
  let boogLabel: { x: number; y: number; tekst: string } | null = null
  if (laatsteBoog && Math.abs(laatsteBoog.x2 - laatsteBoog.x1) >= LABEL_BOOG_PX) {
    const a = aanpassing(pad[n - 1], lr)
    const tekst = `${getal(Math.abs(a), 4)} ${a > 0 ? 'kleiner' : 'groter'}`
    const b = breedte(tekst, 13.5)
    const mid = (laatsteBoog.x1 + laatsteBoog.x2) / 2
    boogLabel = {
      x: Math.min(R - b / 2 - 4, Math.max(L + b / 2 + 4, mid)),
      y: Y - boogHoogte(Math.abs(laatsteBoog.x2 - laatsteBoog.x1)) - 9,
      tekst,
    }
  }

  return (
    <g pointerEvents="none">
      {/* Alles wat met de lijn meeschuift, blijft in het vrije vlak. Na inzoomen
          liepen de bogen anders onder de panelen door, en die zijn half
          doorzichtig: dan zie je een boog achter het glas. */}
      <defs>
        <clipPath id="les10-vrij">
          <rect x={L} y={s.area.top} width={Math.max(0, R - L)} height={s.area.h} />
        </clipPath>
      </defs>

      {/* De lijn zelf, alleen in het vrije vlak. Over het hele bord liep ze
          onder de zoomknoppen en de panelen door, met streepjes zonder getal
          in de spleet tussen de twee panelen links. */}
      <g clipPath="url(#les10-vrij)">
        <line x1={L} x2={R} y1={Y} y2={Y} stroke={MUTED} strokeOpacity={0.55} strokeWidth={1.75} />
        {getallen.map((t) => (
          <line
            key={`t${t}`}
            x1={s.sx(t)}
            x2={s.sx(t)}
            y1={Y - 5}
            y2={Y + 5}
            stroke={MUTED}
            strokeOpacity={0.7}
            strokeWidth={1.5}
          />
        ))}
      </g>
      {zichtbareGetallen.map((t) => (
        <text
          key={`g${t}`}
          data-rol="asgetal"
          x={s.sx(t)}
          y={RIJ1}
          textAnchor="middle"
          fontSize={13}
          fontWeight={700}
          fill={MUTED}
          {...HALO}
        >
          {getal(t, decimalen)}
        </text>
      ))}

      {/* het goede gewicht */}
      {goedInBeeld && (
        <>
          <line
            data-merk="goed"
            x1={gx}
            x2={gx}
            y1={Y - 16}
            y2={Y + 9}
            stroke={NAVY}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
          <text
            data-rol="label"
            data-naam="goed"
            x={goedLinks}
            y={RIJ2}
            textAnchor="start"
            fontSize={13.5}
            fontWeight={700}
            fill={NAVY}
            {...HALO}
          >
            {goedTekst}
          </text>
        </>
      )}
      <text
        data-rol="asnaam"
        x={R - 6}
        y={RIJ2}
        textAnchor="end"
        fontSize={13.5}
        fontWeight={700}
        fill={INK}
        {...HALO}
      >
        {asNaam}
      </text>

      {/* het spoor: eerdere aanpassingen grijs en zonder getal, de laatste blauw */}
      <g clipPath="url(#les10-vrij)">
        {bogen.map((b, i) => (
          <Boog key={i} x1={b.x1} x2={b.x2} Y={Y} laatste={b.laatste} />
        ))}
      </g>

      {/* het gewicht */}
      {inBeeld ? (
        <circle data-merk="gewicht" cx={wx} cy={Y} r={7} fill={MODEL} stroke="#fff" strokeWidth={2.5}>
          <title>{`gewicht ${getal(w, 4)}`}</title>
        </circle>
      ) : (
        <RandPijl x={wx < L ? L + 2 : R - 2} Y={Y} links={wx < L} />
      )}
      <text
        data-rol="label"
        data-naam="gewicht"
        x={wLabelX}
        y={RIJ1 + 1}
        textAnchor="middle"
        fontSize={14}
        fontWeight={700}
        fill={MODEL}
        {...HALO}
      >
        {wTekst}
      </text>

      {boogLabel && (
        <text
          data-rol="label"
          data-naam="boog"
          x={boogLabel.x}
          y={boogLabel.y}
          textAnchor="middle"
          fontSize={13.5}
          fontWeight={700}
          fill={MODEL}
          {...HALO}
        >
          {boogLabel.tekst}
        </text>
      )}
    </g>
  )
}

/** Hoe hoog een boog boven de lijn komt: een derde van zijn lengte, hoogstens
 *  96 px, zodat de sprongen van 0,20 (307 px op 420) niet tegen de Brief lopen. */
const boogHoogte = (len: number) => Math.min(96, Math.max(3, len * 0.34))

function Boog({ x1, x2, Y, laatste }: { x1: number; x2: number; Y: number; laatste: boolean }) {
  const len = Math.abs(x2 - x1)
  const h = boogHoogte(len)
  const xm = (x1 + x2) / 2
  const cy = Y - 2 * h // controlepunt: dan ligt de top op Y - h
  // De pijlpunt volgt de richting waarin de boog landt.
  const dx = x2 - xm
  const dy = Y - cy
  const norm = Math.hypot(dx, dy) || 1
  const ux = dx / norm
  const uy = dy / norm
  const maat = Math.min(laatste ? 8 : 6, Math.max(3, len * 0.35))
  // De laatste boog landt op het punt van het gewicht (straal 7): de punt staat
  // tegen de rand ervan, niet eronder.
  const terug = laatste ? 8.5 : 0.5
  const tx = x2 - ux * terug
  const ty = Y - uy * terug
  const bx = tx - ux * maat
  const by = ty - uy * maat
  const px = -uy * maat * 0.55
  const py = ux * maat * 0.55
  const kleur = laatste ? MODEL : MUTED
  return (
    <g data-merk="boog" opacity={laatste ? 1 : 0.45}>
      <path
        d={`M ${x1} ${Y} Q ${xm} ${cy} ${x2} ${Y}`}
        fill="none"
        stroke={kleur}
        strokeWidth={laatste ? 2.5 : 1.5}
        strokeLinecap="round"
      />
      <polygon points={`${tx},${ty} ${bx + px},${by + py} ${bx - px},${by - py}`} fill={kleur} />
    </g>
  )
}

/** Het gewicht staat buiten het vrije vlak: een pijl op de lijn, aan de rand. */
function RandPijl({ x, Y, links }: { x: number; Y: number; links: boolean }) {
  const r = links ? 1 : -1
  return (
    <polygon
      data-merk="rand"
      points={`${x},${Y} ${x + r * 11},${Y - 7} ${x + r * 11},${Y + 7}`}
      fill={MODEL}
    />
  )
}
