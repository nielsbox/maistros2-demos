import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Canvas, { type Scales, type View } from '../components/Canvas'
import { Brief, Btn, Panel } from '../components/Overlay'
import Vaststelling, { getal } from '../components/Vaststelling'
import {
  LINKS,
  RECHTS,
  accuracy,
  controleer,
  laadCartPole,
  lijnBij,
  perHelft,
  perKantVanDeLijn,
  vanDe100,
  type Actie,
  type Afgespeeld,
  type CartPole,
  type Stand,
  type Telling,
  type Waarneming,
} from '../lib/les11'
import { DATA, DERDE, DERDE_INK, INK, MODEL, MUTED, NAVY, RULE } from '../lib/palette'

/* ------------------------------------------------------------------ *
 * mAIstros 2 - les 11 - Wat doet het model na?
 *
 * EEN DOEL: in de goede spelletjes duwde de kar net iets vaker naar waar de
 * stok bewoog, en het model maakt van dat kleine verschil een vaste regel.
 * Dat is het mechanisme van imitation learning zoals de les het doet, in drie
 * schakels die de leerling een voor een zet:
 *   1. het filter maakt de scheefheid: voor het filter duwde de kar aan elke
 *      kant ongeveer de helft naar waar de stok bewoog, erna iets vaker;
 *   2. de classifier maakt van een kans net boven 0,50 een "altijd";
 *   3. altijd de meerderheid kiezen is maar zo vaak juist als die meerderheid
 *      voorkomt: daarom is de accuracy laag, terwijl het model wel langer speelt.
 * Het bord beantwoordt dus de vraag van slide 2228132 ("waarom speelt het model
 * beter?") en staat daar ook: na de puzzel van 2199222 (accuracy 0,55) en
 * 2199223 (het model speelt toch langer).
 *
 * DE WOORDEN KOMEN VAN DE LES:
 *   spelletje, goede spelletjes, meer dan 25 punten    2199218, 2157946
 *   punten (de score, dus nooit een merk op het bord)  2157951, 2199219
 *   willekeurige acties, de computer                   2157946, 2199222
 *   waarneming, 4 getallen                             2157950, 2157951
 *   voorbeelden, X en y                                2199218, 2199221
 *   pijltje                                            2228128
 *   hoek, helt                                         2157943, 2157944
 *   hoeksnelheid, beweegt ("hoe snel beweegt hij")     2157945
 *   kar, stok, duwen, langer staan                     2157945, 2228132
 *   trainen, train set, test set, accuracy             2157953, 2157956
 *   muntje                                             2199222
 *   afgelopen                                          2157952
 * Niet uit de les: `lijn` en `regel` (de woordenlijst van de cursus), `kans`
 * en 0,50 (les 3 en zijn bord "Van getal naar kans"), en `ring`, alleen voor
 * de waarneming van nu bij het afspelen.
 *
 * "BEWOOG" EN NIET "VIEL". Slide 2228132 zei "naar de kant waar de stok naartoe
 * viel". Op dit bord is dat vals voor 39 van de 100 goede pijltjes: daar helt de
 * stok de ene kant op en beweegt hij de andere, dus hij komt terug recht (0,393
 * op deze seed, mediaan 0,345 over 2000 seeds). De x-as is de hoeksnelheid, en
 * 2157945 noemt die "hoe snel beweegt hij in die richting". Het bord zegt dus
 * "beweegt", en de slide moet in dezelfde schrijfbeurt als de link mee.
 *
 * DE ASSEN: x is de hoeksnelheid, y de hoek. Het model volgt de hoeksnelheid:
 * zijn keuze valt op 0,885 van de goede pijltjes samen met het teken van de
 * hoeksnelheid en maar op 0,609 met dat van de hoek. Zo staat de lijn bijna
 * rechtop (hoeksnelheid 0,247 bij hoek -0,21, 0,097 bij +0,21), en valt de kant
 * van het scherm samen met de kant waarop het model duwt. De "helft" van stap 1
 * en 2 is dan gewoon de verticale as.
 *
 * WAT ER BEWUST NIET OP STAAT, allemaal gemeten en telkens met een toestand die
 * de tekst tegenspreekt: een handvat voor de drempel, een knop "trainen zonder
 * filter", en de slechte spelletjes als tegenvoorbeeld. Dat laatste speelt wel
 * slechter dan willekeurig (1978 van 2000 seeds), maar op deze seed ligt zijn
 * lijn op hoeksnelheid 1,27 en zegt de kleine kant 23 van de 47: dan klopt
 * "aan elke kant de meerderheid" niet meer. Geen kansgetal, geen S-curve, geen
 * vragen, geen score.
 *
 * DE KLEUREN. Pijltjes in navy, en de VORM draagt de actie, nooit de kleur. De
 * lijn en het afgespeelde model in MODEL, de willekeurige computer in DERDE.
 * Weggegooide pijltjes worden MUTED en lichter: dat is een toestand, geen
 * klasse. De driehoekjes zijn getekend en geen tekens: U+25B6 en U+25C0 zijn
 * emoji-tekens (Extended_Pictographic) en kunnen als emoji verschijnen.
 *
 * DE ZINNEN OP HET BORD, per fase, nooit meer dan vier tegelijk (de woorden bij
 * de assen niet meegeteld): de twee helften met hun balkje (fase 1 en 2), de
 * twee kanten van de lijn op twee regels (fase 3), en bij het spelen "altijd"
 * aan elke kant plus "nu" of "hier is het spelletje afgelopen" (fase 4). Elk
 * getal komt uit de tellingen in lib/les11.ts, en `controleer` daar rekent in
 * dev na of de woorden eromheen nog kloppen.
 *
 * GEMETEN OP DIT BORD (headless Chromium, 1440x900, 1280x800, 1024x768 en
 * 900x700, in tien toestanden van begin tot einde): geen enkel pijltje onder
 * een paneel, geen paneel dat scrolt, geen zin onder een paneel of tegen een
 * andere zin, geen fout in de console. De ring staat bij het model gemiddeld
 * 0,15 hoeksnelheid van de lijn: 17 px op 1024x768 en 14 px op 900x700, waar
 * het vrije vlak 662 en 538 px breed is. Bij 11 van de 65 standen is dat op
 * 1024x768 minder dan 6 px; zo dicht speelt het model, en daarom is de ring
 * half doorzichtig.
 * ------------------------------------------------------------------ */

/**
 * Het venster. De grootste |hoeksnelheid| in de data is 2,774 en de grootste
 * |hoek| 0,2089; de willekeurige computer eindigt op 2,553 en 0,2282. De hoek
 * krijgt dus wat lucht (0,25 en niet 0,23), zodat die laatste ring niet tegen
 * de bovenrand van het vrije vlak plakt.
 */
const VENSTER: View = { x0: -2.8, x1: 2.8, y0: -0.25, y1: 0.25 }

/**
 * Vier standen per seconde. CartPole zelf speelt 50 standen per seconde; aan
 * die snelheid is er niets te zien. Vier keer trager (12 per seconde) is met
 * 56 wissels in 64 acties een flikkering. Het paneel zegt daarom alleen
 * "vertraagd" en noemt geen factor.
 */
const MS_PER_STAND = 250

/** Zoveel standen blijven achter de ring zichtbaar: genoeg om het wisselen
 *  van kant te zien, niet zoveel dat het een kluwen wordt. Met 15 en een
 *  lijntje ertussen was het op 1024x768 een krabbel. */
const SPOOR = 10

/** De vier fasen. De les heeft zes stappen; het bord nummert niet, zodat
 *  "stap 3" op het bord nooit iets anders is dan stap 3 van de les. */
type Fase = 'alle' | 'goede' | 'getraind' | 'speelt'
type Speler = 'model' | 'willekeurig'

/* ----------------------------- tekst meten ----------------------------- */

const BORD_PX = 13.5
let meetDoek: CanvasRenderingContext2D | null | undefined
/** Breedte van bordtekst in px. Nodig om een getekend pijltje net achter een
 *  zin te zetten, want een SVG-<text> kan geen SVG in zich dragen. */
function breedte(t: string, px = BORD_PX, gewicht = 700): number {
  if (meetDoek === undefined) meetDoek = document.createElement('canvas').getContext('2d')
  if (!meetDoek) return t.length * px * 0.56
  meetDoek.font = `${gewicht} ${px}px 'Hanken Grotesk', ui-sans-serif, system-ui, sans-serif`
  return meetDoek.measureText(t).width
}

/* ------------------------------ tekenwerk ------------------------------ */

/** Het driehoekje van een actie, rond (cx, cy). */
function pijlPad(cx: number, cy: number, actie: Actie, r = 4.3): string {
  const d = actie === RECHTS ? 1 : -1
  return `M${cx - d * r * 0.9} ${cy - r}L${cx + d * r * 1.1} ${cy}L${cx - d * r * 0.9} ${cy + r}Z`
}

/** Hetzelfde driehoekje in lopende tekst, zodat de legende en de zinnen exact
 *  het merk op het bord tonen. */
function Pijl({ actie, kleur = DATA }: { actie: Actie; kleur?: string }) {
  return (
    <svg
      viewBox="-6 -6 12 12"
      className="inline-block size-[0.8em] align-[-0.05em]"
      role="img"
      aria-label={actie === RECHTS ? 'naar rechts' : 'naar links'}
    >
      <path d={pijlPad(0, 0, actie, 4.6)} fill={kleur} />
    </svg>
  )
}

/** Een stokje dat helt, voor de woorden op de hoek-as: "rechts" bovenaan het
 *  scherm moet lezen als hellen, niet als een richting op het scherm. */
function HeltTeken({ x, y, rechts }: { x: number; y: number; rechts: boolean }) {
  const d = rechts ? 1 : -1
  return (
    <g pointerEvents="none">
      <line x1={x - 6} y1={y} x2={x + 6} y2={y} stroke={INK} strokeWidth={2} strokeLinecap="round" />
      <line
        x1={x}
        y1={y}
        x2={x + d * 6}
        y2={y - 12}
        stroke={INK}
        strokeWidth={2.4}
        strokeLinecap="round"
      />
    </g>
  )
}

function BordTekst({
  x,
  y,
  children,
  anker = 'start',
  px = BORD_PX,
  gewicht = 700,
  kleur = NAVY,
}: {
  x: number
  y: number
  children: ReactNode
  anker?: 'start' | 'end' | 'middle'
  px?: number
  gewicht?: number
  kleur?: string
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anker}
      fontSize={px}
      fontWeight={gewicht}
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

/**
 * Een regel bordtekst met het getekende pijltje erachter. Bij `anker="end"`
 * eindigt het pijltje op x.
 */
function TekstMetPijl({
  x,
  y,
  tekst,
  actie,
  anker = 'start',
  kleur = NAVY,
  pijlKleur = DATA,
}: {
  x: number
  y: number
  tekst: string
  actie: Actie
  anker?: 'start' | 'end'
  kleur?: string
  pijlKleur?: string
}) {
  const b = breedte(tekst)
  const start = anker === 'start' ? x : x - b - 14
  return (
    <g pointerEvents="none">
      <BordTekst x={start} y={y} kleur={kleur}>
        {tekst}
      </BordTekst>
      <path
        d={pijlPad(start + b + 8, y - 4.5, actie, 4.6)}
        fill={pijlKleur}
        stroke="#fff"
        strokeWidth={2}
        paintOrder="stroke"
      />
    </g>
  )
}

/** Een 100%-balkje met een streepje op de helft. */
function Balkje({ x, y, aandeel, breed = 128 }: { x: number; y: number; aandeel: number; breed?: number }) {
  return (
    <g pointerEvents="none">
      <rect x={x - 2} y={y - 2} width={breed + 4} height={12} rx={4} fill="#fff" opacity={0.9} />
      <rect x={x} y={y} width={breed} height={8} rx={2.5} fill={RULE} />
      <rect
        x={x}
        y={y}
        height={8}
        rx={2.5}
        fill={NAVY}
        style={{ width: Math.max(0, Math.min(1, aandeel)) * breed, transition: 'width 600ms ease' }}
      />
      <line x1={x + breed / 2} y1={y - 4} x2={x + breed / 2} y2={y + 12} stroke={INK} strokeWidth={1.6} />
    </g>
  )
}

/* -------------------------------- de pijltjes -------------------------------- */

/**
 * Alle 1125 pijltjes, als vier paden: in of uit X, naar rechts of naar links.
 * Vier elementen en niet 1125, want bij het afspelen tekent het bord vier keer
 * per seconde opnieuw, en bij elke sleep of zoom ook.
 */
const Pijltjes = memo(function Pijltjes({
  s,
  W,
  fase,
}: {
  s: Scales
  W: readonly Waarneming[]
  fase: Fase
}) {
  const paden = useMemo(() => {
    const p = { inR: '', inL: '', uitR: '', uitL: '' }
    for (const w of W) {
      const d = pijlPad(s.sx(w.hoeksnelheid), s.sy(w.hoek), w.actie)
      if (w.deel > 0) {
        if (w.actie === RECHTS) p.inR += d
        else p.inL += d
      } else if (w.actie === RECHTS) p.uitR += d
      else p.uitL += d
    }
    return p
  }, [s, W])
  const gefilterd = fase !== 'alle'
  /* Bij het afspelen zijn de pijltjes achtergrond, en grijs: het spoor van het
     model is blauw, en vervaagd navy is ook blauwig. Zo viel het spoor op
     1024x768 weg tussen de pijltjes. */
  const speelt = fase === 'speelt'
  const uit = { fill: gefilterd ? MUTED : DATA, opacity: speelt ? 0.12 : gefilterd ? 0.22 : 0.62 }
  const inX = { fill: speelt ? MUTED : DATA, opacity: speelt ? 0.3 : 0.62 }
  const t = { transition: 'opacity 500ms ease, fill 500ms ease' }
  return (
    <g pointerEvents="none">
      <path d={p(paden.uitR + paden.uitL)} fill={uit.fill} opacity={uit.opacity} style={t} />
      <path d={p(paden.inR + paden.inL)} fill={inX.fill} opacity={inX.opacity} style={t} />
    </g>
  )
})
const p = (d: string) => d || 'M0 0'

/* ------------------------------ kar en stok ------------------------------ */

/** Het spelletje zelf, klein, uit de opgenomen positie van de kar en de hoek. */
function KarEnStok({ stand, kleur }: { stand: Stand | null; kleur: string }) {
  const B = 150
  const H = 72
  const grond = 64
  /* De kar mag tot 2,4 van het midden; daar is het spelletje ook afgelopen. */
  const schaal = (B / 2 - 18) / 2.4
  const x = stand?.x ?? 0
  const hoek = stand?.hoek ?? 0
  const kx = B / 2 + x * schaal
  const top = grond - 13
  const L = 50
  return (
    <svg width={B} height={H} viewBox={`0 0 ${B} ${H}`} className="shrink-0" aria-hidden="true">
      <line x1={4} y1={grond} x2={B - 4} y2={grond} stroke={RULE} strokeWidth={2} />
      <line x1={B / 2 - 2.4 * schaal} y1={grond - 4} x2={B / 2 - 2.4 * schaal} y2={grond + 4} stroke={MUTED} />
      <line x1={B / 2 + 2.4 * schaal} y1={grond - 4} x2={B / 2 + 2.4 * schaal} y2={grond + 4} stroke={MUTED} />
      <line
        x1={kx}
        y1={top}
        x2={kx + L * Math.sin(hoek)}
        y2={top - L * Math.cos(hoek)}
        stroke={NAVY}
        strokeWidth={4.5}
        strokeLinecap="round"
      />
      <rect x={kx - 16} y={top} width={32} height={13} rx={3} fill={NAVY} />
      {stand?.actie != null && (
        <path d={pijlPad(kx + (stand.actie === RECHTS ? 27 : -27), top + 6.5, stand.actie, 5.5)} fill={kleur} />
      )}
    </svg>
  )
}

/* ------------------------------ het vrije vlak ------------------------------ */

/**
 * Waar de panelen liggen, zodat het bord de pijltjes in de vrije ruimte kadert.
 * Canvas meet zelf alleen links en rechts, en telt een paneel rechtsboven als
 * een paneel RECHTS: dan zou het de hele rechterkant opeisen, terwijl het maar
 * een strook bovenaan beslaat. Het bord heeft die breedte nodig - de ring blijft
 * ongeveer 0,15 hoeksnelheid van de lijn - dus meet dit bord zelf. Een paneel
 * in de linkerhelft duwt de linkerrand op, een paneel in de rechterhelft de
 * bovenrand. Het rechterpaneel heeft een vaste hoogte, zodat het bord niet
 * herkadert als de strook plaats maakt voor de kar.
 */
function useVrijVlak() {
  const wortel = useRef<HTMLDivElement>(null)
  const [vlak, setVlak] = useState({ left: 0, top: 0 })
  useEffect(() => {
    const el = wortel.current
    if (!el) return
    const meet = () => {
      const box = el.getBoundingClientRect()
      if (!box.width) return
      // De eerste div is die van Canvas: zijn zoomknoppen zijn ook een .panel.
      const bord = el.firstElementChild
      const mid = box.left + box.width / 2
      let left = 0
      let top = 0
      el.querySelectorAll<HTMLElement>('.panel').forEach((n) => {
        if (bord?.contains(n)) return
        const r = n.getBoundingClientRect()
        if (!r.width) return
        if ((r.left + r.right) / 2 < mid) left = Math.max(left, r.right - box.left + 16)
        else top = Math.max(top, r.bottom - box.top + 16)
      })
      setVlak((v) => (v.left === left && v.top === top ? v : { left, top }))
    }
    meet()
    const ro = new ResizeObserver(meet)
    ro.observe(el)
    const mo = new MutationObserver(() => {
      el.querySelectorAll('.panel').forEach((n) => ro.observe(n))
      meet()
    })
    mo.observe(el, { childList: true, subtree: true })
    el.querySelectorAll('.panel').forEach((n) => ro.observe(n))
    return () => {
      ro.disconnect()
      mo.disconnect()
    }
  }, [])
  return [wortel, vlak] as const
}

/* ------------------------------ de tweede klik ------------------------------ */

/**
 * De tweede klik van een dubbelklik telt niet, op het hele paneel. Elke knop
 * hier verandert de fase, en in de volgende fase staat op dezelfde plaats de
 * volgende knop: "Houd enkel de goede spelletjes", dan "Trainen", dan "Laat het
 * model spelen". Een dubbelklik zou dus twee stappen zetten. Hetzelfde als in
 * KMeansStappen.tsx: `detail` 2 bij de muis, en op een aanraakscherm (digibord)
 * een tweede tik binnen 400 ms en 10 px. Met het toetsenbord is `detail` 0,
 * dus Enter en spatie tellen altijd.
 */
type Klik = { detail: number; timeStamp: number; clientX: number; clientY: number }
function useTweedeKlik() {
  const vorige = useRef<{ t: number; x: number; y: number } | null>(null)
  return useCallback((e: Klik) => {
    if (e.detail === 0) return false
    const v = vorige.current
    vorige.current = { t: e.timeStamp, x: e.clientX, y: e.clientY }
    if (e.detail > 1) return true
    return v !== null && e.timeStamp - v.t < 400 && Math.hypot(e.clientX - v.x, e.clientY - v.y) < 10
  }, [])
}

/* ------------------------------ de tellingen ------------------------------ */

type Tellingen = {
  alle: Telling
  goede: Telling
  lijn: Telling
  acc: { juist: number; van: number }
  goedeSpelletjes: number
  inX: number
}

function telAlles(d: CartPole): Tellingen {
  const X = d.waarnemingen.filter((w) => w.deel > 0)
  return {
    alle: perHelft(d.waarnemingen),
    goede: perHelft(X),
    lijn: perKantVanDeLijn(d.model, X),
    acc: accuracy(d.model, d.waarnemingen),
    goedeSpelletjes: d.punten.filter((p) => p > d.drempel).length,
    inX: X.length,
  }
}

/* ================================ het bord ================================ */

/** Waar de twee zinnen per kant staan, in bordgetallen. Gekozen op de lege
 *  hoeken van de data: rechtsonder (stok beweegt naar rechts, helt naar links)
 *  en linksboven liggen bijna geen pijltjes, want een stok die ver helt,
 *  beweegt meestal ook die kant op. Beide liggen ruim aan hun kant van de lijn
 *  (de lijn ligt daar op 0,22 en 0,11). */
const ZIN_RECHTS = { hoeksnelheid: 0.8, hoek: -0.125 }
const ZIN_LINKS = { hoeksnelheid: -0.75, hoek: 0.17 }

function Bord({
  s,
  d,
  t,
  fase,
  spel,
  speler,
  tel: i,
}: {
  s: Scales
  d: CartPole
  t: Tellingen
  fase: Fase
  spel: Afgespeeld | null
  speler: Speler | null
  tel: number
}) {
  const x0 = s.sx(0)
  const y0 = s.sy(0)
  const { safe, area } = s
  const helften = fase === 'alle' || fase === 'goede'
  const metLijn = fase === 'getraind' || fase === 'speelt'
  const h = fase === 'alle' ? t.alle : t.goede

  /* De lijn: waar de kans op rechts precies 0,50 is. */
  const lijn = metLijn
    ? {
        x1: s.sx(lijnBij(d.model, s.view.y0)),
        y1: s.sy(s.view.y0),
        x2: s.sx(lijnBij(d.model, s.view.y1)),
        y2: s.sy(s.view.y1),
      }
    : null

  const rx = s.sx(ZIN_RECHTS.hoeksnelheid)
  const ry = s.sy(ZIN_RECHTS.hoek)
  const lx = s.sx(ZIN_LINKS.hoeksnelheid)
  const ly = s.sy(ZIN_LINKS.hoek)

  const kleur = speler === 'willekeurig' ? DERDE : MODEL
  const inkt = speler === 'willekeurig' ? DERDE_INK : NAVY
  const nu = spel ? spel.standen[Math.min(i, spel.standen.length - 1)] : null
  const spoor = spel ? spel.standen.slice(Math.max(0, i - SPOOR), i + 1) : []
  const afgelopen = spel !== null && nu !== null && nu.actie === null

  return (
    <g>
      {/* De twee assen door nul. De verticale is in de eerste twee fasen ook de
          grens tussen de twee helften, dus daar iets donkerder. */}
      <line x1={area.left} y1={y0} x2={area.right} y2={y0} stroke="#cdc9dc" strokeWidth={1.25} />
      <line
        x1={x0}
        y1={area.top}
        x2={x0}
        y2={area.bottom}
        stroke={helften ? '#aaa5bf' : '#cdc9dc'}
        strokeWidth={helften ? 1.6 : 1.25}
        style={{ transition: 'stroke 400ms ease' }}
      />

      <Pijltjes s={s} W={d.waarnemingen} fase={fase} />

      {lijn && (
        <line {...lijn} stroke={MODEL} strokeWidth={2.5} strokeLinecap="round" pointerEvents="none" />
      )}

      {/* ----- de woorden bij de assen ----- */}
      {/* Rechts ONDER de as en links ERBOVEN: daar zijn de lege hoeken van de
          data. Boven de as rechts lagen op 900x700 zes pijltjes onder de tekst. */}
      <BordTekst x={safe.right - 6} y={y0 + 19} anker="end">
        stok beweegt naar rechts &rarr;
      </BordTekst>
      <BordTekst x={safe.right - 6} y={y0 + 36} anker="end" px={12.5} gewicht={600} kleur={MUTED}>
        hoeksnelheid
      </BordTekst>
      <BordTekst x={safe.left + 6} y={y0 - 8}>
        &larr; stok beweegt naar links
      </BordTekst>
      <BordTekst x={x0 - 26} y={safe.top + 16} anker="end">
        stok helt naar rechts
      </BordTekst>
      <HeltTeken x={x0 - 13} y={safe.top + 17} rechts />
      <BordTekst x={x0 - 26} y={safe.top + 33} anker="end" px={12.5} gewicht={600} kleur={MUTED}>
        hoek
      </BordTekst>
      <BordTekst x={x0 - 26} y={safe.bottom - 8} anker="end">
        stok helt naar links
      </BordTekst>
      <HeltTeken x={x0 - 13} y={safe.bottom - 7} rechts={false} />

      {/* ----- per helft: hoe vaak duwde de kar naar waar de stok bewoog ----- */}
      {helften && (
        <>
          <TekstMetPijl
            x={rx}
            y={ry}
            tekst={`hier ${getal(vanDe100(h.rechts))} van de 100 keer`}
            actie={RECHTS}
          />
          <Balkje x={rx} y={ry + 9} aandeel={h.rechts.juist / h.rechts.van} />
          <TekstMetPijl
            x={lx}
            y={ly}
            anker="end"
            tekst={`hier ${getal(vanDe100(h.links))} van de 100 keer`}
            actie={LINKS}
          />
          <Balkje x={lx - 128} y={ly + 9} aandeel={h.links.juist / h.links.van} />
        </>
      )}

      {/* ----- per kant van de lijn ----- */}
      {fase === 'getraind' && (
        <>
          <TekstMetPijl
            x={rx}
            y={ry}
            tekst={`hier ${getal(vanDe100(t.lijn.rechts))} van de 100 keer`}
            actie={RECHTS}
          />
          <TekstMetPijl x={rx} y={ry + 19} tekst="model: altijd" actie={RECHTS} kleur={NAVY} pijlKleur={MODEL} />
          <TekstMetPijl
            x={lx}
            y={ly}
            anker="end"
            tekst={`hier ${getal(vanDe100(t.lijn.links))} van de 100 keer`}
            actie={LINKS}
          />
          <TekstMetPijl
            x={lx}
            y={ly + 19}
            anker="end"
            tekst="model: altijd"
            actie={LINKS}
            pijlKleur={MODEL}
          />
        </>
      )}
      {fase === 'speelt' && (
        <>
          <TekstMetPijl x={rx} y={ry} tekst="altijd" actie={RECHTS} pijlKleur={MODEL} />
          <TekstMetPijl x={lx} y={ly} anker="end" tekst="altijd" actie={LINKS} pijlKleur={MODEL} />
        </>
      )}

      {/* ----- het afspelen: de ring en zijn spoor ----- */}
      {fase === 'speelt' && spel && nu && (
        <Spoor s={s} spoor={spoor} nu={nu} kleur={kleur} inkt={inkt} afgelopen={afgelopen} />
      )}
    </g>
  )
}

function Spoor({
  s,
  spoor,
  nu,
  kleur,
  inkt,
  afgelopen,
}: {
  s: Scales
  spoor: Stand[]
  nu: Stand
  kleur: string
  inkt: string
  afgelopen: boolean
}) {
  const cx = s.sx(nu.hoeksnelheid)
  const cy = s.sy(nu.hoek)
  const vorige = spoor.slice(0, -1)
  /* "hier is het spelletje afgelopen": rechts van de ring als het past, anders
     links ervan. Op één regel als het past, anders op twee. */
  const zin = 'hier is het spelletje afgelopen'
  const ruimRechts = s.safe.right - (cx + 16)
  const ruimLinks = cx - 16 - s.safe.left
  const eenRegel = breedte(zin)
  const regels = eenRegel <= Math.max(ruimRechts, ruimLinks) ? [zin] : ['hier is het spelletje', 'afgelopen']
  const nodig = Math.max(...regels.map((r) => breedte(r)))
  const rechts = ruimRechts >= nodig || ruimRechts >= ruimLinks
  return (
    <g pointerEvents="none">
      {/* Het spoor zijn de vorige standen, elk met de actie die volgde, en
          zonder lijntje ertussen. Met een lijntje werd het model een krabbel:
          het wisselt bijna elke stand van kant terwijl de hoek amper verandert,
          dus vijftien bijna horizontale streepjes over elkaar. Zonder lijntje
          vormen de pijltjes twee kolommen, rechts van de lijn allemaal naar
          rechts en links allemaal naar links. Dat is de vaste regel. */}
      {vorige.map((st, k) =>
        st.actie === null ? null : (
          <path
            key={k}
            d={pijlPad(s.sx(st.hoeksnelheid), s.sy(st.hoek), st.actie, 5)}
            fill={kleur}
            stroke="#fff"
            strokeWidth={1}
            paintOrder="stroke"
            opacity={0.4 + (0.5 * (k + 1)) / Math.max(1, vorige.length)}
          />
        ),
      )}
      {/* Half doorzichtig: de ring staat vaak vlak bij de lijn (bij 11 van de 65
          standen minder dan 6 px op 1024x768), en dan moet de lijn door de ring
          heen te zien blijven. Het pijltje in de ring zegt naar waar het duwt. */}
      <circle cx={cx} cy={cy} r={10} fill="#fff" fillOpacity={0.7} stroke={kleur} strokeWidth={2.6} />
      {nu.actie !== null && <path d={pijlPad(cx, cy, nu.actie, 4.6)} fill={kleur} />}
      {afgelopen ? (
        regels.map((r, k) => (
          <BordTekst
            key={r}
            x={rechts ? cx + 16 : cx - 16}
            y={cy + 5 + (k - (regels.length - 1) / 2) * 17}
            anker={rechts ? 'start' : 'end'}
            kleur={inkt}
          >
            {r}
          </BordTekst>
        ))
      ) : (
        /* Boven de ring en niet ernaast: naast de ring staat het spoor, en de
           ring klimt, dus erboven is het nog leeg. */
        <BordTekst x={cx} y={cy - 16} anker="middle" kleur={inkt}>
          nu
        </BordTekst>
      )}
    </g>
  )
}

/* ------------------------------- de strook ------------------------------- */

/** De 50 spelletjes, elk een balkje zo hoog als zijn punten, met de drempel. */
function Strook({ punten, drempel, gefilterd }: { punten: number[]; drempel: number; gefilterd: boolean }) {
  const B = 288
  const H = 60
  const n = punten.length
  const tussen = 1.5
  const bb = (B - tussen * (n - 1)) / n
  const max = Math.max(...punten, drempel)
  const y = (v: number) => H - (v / max) * (H - 3)
  return (
    <svg viewBox={`0 0 ${B} ${H}`} className="block h-[60px] w-full" preserveAspectRatio="none" aria-hidden="true">
      {punten.map((v, k) => {
        const goed = v > drempel
        return (
          <rect
            key={k}
            x={k * (bb + tussen)}
            y={y(v)}
            width={bb}
            height={H - y(v)}
            fill={gefilterd && !goed ? MUTED : NAVY}
            opacity={gefilterd && !goed ? 0.3 : 0.9}
            style={{ transition: 'opacity 500ms ease, fill 500ms ease' }}
          />
        )
      })}
      <line x1={0} y1={y(drempel)} x2={B} y2={y(drempel)} stroke={INK} strokeWidth={1.3} strokeDasharray="4 3" />
    </svg>
  )
}

/* ================================ de pagina ================================ */

export default function WatDoetHetModelNa() {
  const [d, setD] = useState<CartPole | null>(null)
  const [laadfout, setLaadfout] = useState(false)
  const [fase, setFase] = useState<Fase>('alle')
  const [speler, setSpeler] = useState<Speler | null>(null)
  const [tel, setTel] = useState(0)
  const [loopt, setLoopt] = useState(false)
  const [uitslag, setUitslag] = useState<{ model: number | null; willekeurig: number | null }>({
    model: null,
    willekeurig: null,
  })
  /* Een tweede teken als de letters binnen zijn: de breedte van bordtekst hangt
     ervan af, en dus ook waar een getekend pijltje achter een zin staat. */
  const [, setLetters] = useState(0)
  useEffect(() => {
    let levend = true
    document.fonts?.ready.then(() => levend && setLetters((v) => v + 1))
    return () => {
      levend = false
    }
  }, [])

  useEffect(() => {
    let levend = true
    laadCartPole()
      .then((b) => levend && setD(b))
      .catch(() => levend && setLaadfout(true))
    return () => {
      levend = false
    }
  }, [])

  const t = useMemo(() => (d ? telAlles(d) : null), [d])
  /* In dev: klopt elke zin nog met de data? Zie `controleer` in lib/les11.ts. */
  useEffect(() => {
    if (!import.meta.env.DEV || !d) return
    for (const f of controleer(d)) console.error(`Wat doet het model na?: ${f}`)
  }, [d])
  const spel = d && speler ? (speler === 'model' ? d.modelSpeelt : d.willekeurigSpeelt) : null

  /* Het afspelen: vier standen per seconde, tot de laatste stand, waar het
     spelletje afgelopen is. Dan staat de uitslag vast. */
  useEffect(() => {
    if (!loopt || !spel || !speler) return
    const laatste = spel.standen.length - 1
    const k = window.setTimeout(() => {
      const volgende = Math.min(laatste, tel + 1)
      setTel(volgende)
      if (volgende >= laatste) {
        setLoopt(false)
        setUitslag((u) => ({ ...u, [speler]: spel.punten }))
      }
    }, MS_PER_STAND)
    return () => window.clearTimeout(k)
  }, [loopt, spel, speler, tel])

  const speel = (wie: Speler) => {
    setSpeler(wie)
    setTel(0)
    setLoopt(true)
  }
  const opnieuw = () => {
    setFase('alle')
    setSpeler(null)
    setTel(0)
    setLoopt(false)
    setUitslag({ model: null, willekeurig: null })
  }

  const tweedeKlik = useTweedeKlik()
  const [wortel, vlak] = useVrijVlak()
  const insets = useMemo(() => ({ left: vlak.left, top: vlak.top, right: 0, bottom: 48 }), [vlak.left, vlak.top])

  const klaar = spel !== null && tel >= spel.standen.length - 1
  const punten = (wie: Speler) =>
    speler === wie && spel && !klaar ? tel : uitslag[wie]

  return (
    <div ref={wortel} className="relative h-full w-full">
      <Canvas defaultView={VENSTER} axes={false} insets={insets}>
        {(s) =>
          d && t ? <Bord s={s} d={d} t={t} fase={fase} spel={spel} speler={speler} tel={tel} /> : null
        }
      </Canvas>

      <Brief eyebrow="mAIstros 2 - les 11" title="Wat doet het model na?">
        <p>
          In de goede spelletjes duwde de kar net iets vaker naar waar de stok bewoog. Het model
          maakt van dat kleine verschil een vaste regel.
        </p>
      </Brief>

      {/* ------------------------- rechtsboven: het bestand ------------------------- */}
      <Panel className="pointer-events-auto absolute right-4 top-4 z-10 flex h-[8.5rem] w-[20rem] flex-col px-4 py-3">
          {fase !== 'speelt' ? (
            <>
              <div className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-ink/75">
                De {d ? getal(d.punten.length) : 50} spelletjes, hoog als hun punten
              </div>
              <div className="mt-2">
                {d && <Strook punten={d.punten} drempel={d.drempel} gefilterd={fase !== 'alle'} />}
              </div>
              <div className="mt-1.5 flex items-center gap-2 text-[13px] font-semibold text-navy">
                <span className="inline-block w-5 border-t-[1.5px] border-dashed border-ink" />
                {fase === 'alle' || !t
                  ? `meer dan ${d ? d.drempel : 25} punten: goed`
                  : `${getal(t.goedeSpelletjes)} van de ${getal(d!.punten.length)} spelletjes: goed`}
              </div>
            </>
          ) : (
            <>
              <div className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-ink/75">
                {speler === 'willekeurig' ? 'De computer speelt willekeurig' : 'Het model speelt'}
              </div>
              <div className="mt-1 flex items-end gap-3">
                <div className="flex flex-col">
                  <KarEnStok
                    stand={spel ? spel.standen[Math.min(tel, spel.standen.length - 1)] : null}
                    kleur={speler === 'willekeurig' ? DERDE : MODEL}
                  />
                  {/* Geen factor: vier standen per seconde, CartPole zelf doet er 50. */}
                  <span className="text-[11.5px] font-semibold text-muted">vertraagd afgespeeld</span>
                </div>
                <div className="flex flex-col gap-1.5 pb-1">
                  <Uitslag naam="het model" punten={punten('model')} actief={speler === 'model'} kleur={MODEL} />
                  <Uitslag
                    naam="willekeurig"
                    punten={punten('willekeurig')}
                    actief={speler === 'willekeurig'}
                    kleur={DERDE_INK}
                  />
                </div>
              </div>
            </>
          )}
      </Panel>

      {/* ------------------------- linksonder: wat je doet ------------------------- */}
      <Panel className="pointer-events-auto absolute bottom-4 left-4 z-10 flex max-h-[calc(100%-16rem)] w-[16rem] flex-col overflow-y-auto px-4 py-3.5 xl:max-h-[calc(100%-15rem)] xl:w-[21rem]">
          <div
            className="contents"
            onClickCapture={(e) => {
              if (tweedeKlik(e)) e.stopPropagation()
            }}
          >
            <Paneel
              d={d}
              t={t}
              laadfout={laadfout}
              fase={fase}
              speler={speler}
              loopt={loopt}
              klaar={klaar}
              beide={uitslag.model !== null && uitslag.willekeurig !== null}
              onFase={setFase}
              onSpeel={speel}
              onPauze={() => setLoopt((v) => !v)}
              onOpnieuw={opnieuw}
            />
          </div>
      </Panel>
    </div>
  )
}

function Uitslag({
  naam,
  punten,
  actief,
  kleur,
}: {
  naam: string
  punten: number | null
  actief: boolean
  kleur: string
}) {
  return (
    <div className={actief ? '' : 'opacity-70'}>
      <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink/75">{naam}</div>
      <div className="flex items-baseline gap-1">
        <span className="cf-display text-[21px] leading-none tabular-nums" style={{ color: punten === null ? MUTED : kleur }}>
          {punten === null ? '-' : getal(punten)}
        </span>
        {punten !== null && <span className="text-[12.5px] font-semibold text-ink">punten</span>}
      </div>
    </div>
  )
}

function Paneel({
  d,
  t,
  laadfout,
  fase,
  speler,
  loopt,
  klaar,
  beide,
  onFase,
  onSpeel,
  onPauze,
  onOpnieuw,
}: {
  d: CartPole | null
  t: Tellingen | null
  laadfout: boolean
  fase: Fase
  speler: Speler | null
  loopt: boolean
  klaar: boolean
  /** Hebben het model en de computer allebei een spelletje uitgespeeld? */
  beide: boolean
  onFase: (f: Fase) => void
  onSpeel: (wie: Speler) => void
  onPauze: () => void
  onOpnieuw: () => void
}) {
  const kop = 'text-[11.5px] font-bold uppercase tracking-[0.09em] text-ink/75'
  const zin = 'mt-2 text-[13.5px] leading-snug text-ink'
  const knoppen = useRef<HTMLDivElement>(null)

  /* Is de focus kwijt (de knop waarop je drukte is weg, zoals "Opnieuw"), dan
     gaat ze naar de eerste knop: dat is altijd de volgende zet. Wie ergens
     anders staat, wordt niet verplaatst. */
  useEffect(() => {
    const nu = document.activeElement
    if (nu && nu !== document.body && nu.isConnected) return
    knoppen.current?.querySelector('button')?.focus({ preventScroll: true })
  }, [fase])

  if (!d || !t) {
    return (
      <p className="text-[13.5px] leading-snug text-ink">
        {laadfout ? 'De spelletjes laden niet. Herlaad de pagina.' : 'De spelletjes worden geladen.'}
      </p>
    )
  }
  const acc = t.acc.juist / t.acc.van

  /* EEN EERSTE KNOP, altijd hetzelfde element op dezelfde plaats. Zijn woord
     verandert met de fase, het element niet, zodat de focus van wie met het
     toetsenbord werkt blijft staan. Een dubbelklik zou hier twee fasen zetten,
     en dat houdt `useTweedeKlik` tegen. */
  const eerste =
    fase === 'alle'
      ? { woord: 'Houd enkel de goede spelletjes', doe: () => onFase('goede') }
      : fase === 'goede'
        ? { woord: 'Trainen', doe: () => onFase('getraind') }
        : fase === 'getraind'
          ? {
              woord: 'Laat het model spelen',
              doe: () => {
                onFase('speelt')
                onSpeel('model')
              },
            }
          : { woord: 'Laat het model spelen', doe: () => onSpeel('model') }

  return (
    <>
      <div className={kop}>
        {fase === 'alle'
          ? `${getal(d.punten.length)} spelletjes`
          : fase === 'goede'
            ? 'Enkel de goede spelletjes'
            : fase === 'getraind'
              ? 'Trainen'
              : speler === 'willekeurig'
                ? 'De computer speelt willekeurig'
                : 'Het model speelt'}
      </div>
      {/* De legende staat er altijd: elk merk op het bord is een pijltje. */}
      <ul className="mt-1.5 space-y-0.5 text-[13px] leading-snug text-ink">
        <li>
          <Pijl actie={RECHTS} /> daarna naar rechts geduwd
        </li>
        <li>
          <Pijl actie={LINKS} /> daarna naar links geduwd
        </li>
      </ul>

      {fase === 'alle' && (
        <>
          <p className={zin}>
            De computer speelde {getal(d.punten.length)} spelletjes met willekeurige acties. Elk
            pijltje is een waarneming, met de actie die erop volgde.
          </p>
          <p className={zin}>
            Het bord toont twee van de vier getallen: de hoek en de hoeksnelheid.
          </p>
          <p className={zin}>Kijk naar de twee balkjes: aan elke kant is het ongeveer de helft.</p>
          <p className={zin}>
            Dit bord speelde één keer {getal(d.punten.length)} spelletjes. Jouw getallen zijn anders.
          </p>
        </>
      )}
      {fase === 'goede' && (
        <>
          <p className={zin}>
            Er blijven {getal(t.goedeSpelletjes)} goede spelletjes over. Hun {getal(t.inX)} pijltjes
            zijn de voorbeelden in X en y.
          </p>
          <p className={zin}>
            Bewoog de stok naar rechts, dan duwde de kar nu vaker naar rechts. En omgekeerd.
          </p>
          <p className={zin}>Daardoor duurden die spelletjes net langer.</p>
        </>
      )}
      {fase === 'getraind' && (
        <>
          <p className={zin}>
            Rechts van de lijn schat het model de kans op <Pijl actie={RECHTS} /> boven 0,50.
            Daarom kiest het daar{' '}
            <span className="whitespace-nowrap">
              altijd <Pijl actie={RECHTS} />,
            </span>{' '}
            en links{' '}
            <span className="whitespace-nowrap">
              altijd <Pijl actie={LINKS} />.
            </span>
          </p>
          <Vaststelling
            label="Accuracy op de test set"
            value={acc}
            decimals={2}
            detail={`${getal(t.acc.juist)} van de ${getal(t.acc.van)} juist. Een muntje haalt ongeveer 0,50.`}
          />
          {/* Het bordmodel ziet twee getallen, dat van de leerling vier. Op deze
              seed kiezen ze hetzelfde op 91 van de 99 pijltjes van de test set
              (mediaan 0,93 over 2000 seeds): "meestal". */}
          <p className={zin}>
            Dit model kijkt naar twee getallen, jouw model naar alle vier. Ze kiezen meestal
            hetzelfde.
          </p>
        </>
      )}
      {fase === 'speelt' && (
        <>
          <p className={zin}>
            De ring is de waarneming van nu. Gaat de ring over de lijn, dan duwt het model de andere
            kant op.
          </p>
          {speler === 'willekeurig' ? (
            /* Gemeten op dit spelletje: de ring staat gemiddeld 0,23 van de lijn
               in het eerste kwart en 1,77 in het laatste, tegen 0,14 tot 0,15
               bij het model, in elk kwart. Zijn acties vallen maar 6 van de 16
               keer samen met de kant van de lijn. */
            <p className={zin}>
              De computer kijkt niet naar de lijn. De ring loopt weg, en de stok valt snel.
            </p>
          ) : (
            <p className={zin}>Zo blijft de ring dicht bij de lijn, en blijft de stok langer staan.</p>
          )}
          {/* De slotsom van slide 2228132, pas als beide gespeeld hebben: beide
              getallen komen uit het bestand, de zin alleen als ze kloppen. */}
          {beide && d.modelSpeelt.punten > d.willekeurigSpeelt.punten ? (
            <p className={zin}>
              Het model raadt maar {getal(vanDe100(t.acc))} van de 100 acties juist, en speelt toch
              langer.
            </p>
          ) : (
            <p className={zin}>Vergelijk daarna met de computer, die willekeurig speelt.</p>
          )}
        </>
      )}

      <div ref={knoppen} className="mt-3 flex flex-wrap items-start gap-1.5">
        <Btn key="eerste" onClick={eerste.doe}>
          {eerste.woord}
        </Btn>
        {fase === 'speelt' && (
          <Btn key="willekeurig" onClick={() => onSpeel('willekeurig')}>
            Laat de computer willekeurig spelen
          </Btn>
        )}
        {fase === 'speelt' && (
          /* Na het einde staat er "Pauze", uitgeschakeld: een grijze "Verder"
             las als "hier kan nog iets verder". */
          <Btn key="pauze" variant="ghost" onClick={onPauze} disabled={klaar || speler === null}>
            {loopt || klaar ? 'Pauze' : 'Verder'}
          </Btn>
        )}
        {fase !== 'alle' && (
          <Btn key="opnieuw" variant="ghost" onClick={onOpnieuw}>
            Opnieuw
          </Btn>
        )}
      </div>
    </>
  )
}
