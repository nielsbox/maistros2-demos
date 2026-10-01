import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Canvas, { type Scales, type View } from '../components/Canvas'
import { Tekst, Vorm, eenSchaal } from '../components/ClusterVorm'
import InertiaGrafiek from '../components/InertiaGrafiek'
import { Brief, Btn, Divider, Panel, PyChip, Sec, SegBtn } from '../components/Overlay'
import { useTweedeKlik } from '../components/tweedeKlik'
import { getal, meervoud } from '../components/Vaststelling'
import { DRIE_GROEPJES, wijzerDrie } from '../lib/clusterdata'
import {
  MAX_AANTAL,
  PUNTEN_VAN,
  bandZin,
  inertias,
  staat,
  statusZinnen,
  type SetId,
  type Staat,
} from '../lib/elleboog'
import { DATA, MUTED } from '../lib/palette'

/* ------------------------------------------------------------------ *
 * mAIstros 2 - les 8 - Waar komt de knik vandaan?
 *
 * EEN DOEL, de woorden van 2130675: de inertia meet hoe ver de punten van hun
 * centroid liggen, en de knik is waar een extra cluster nog maar weinig
 * scheelt.
 *   Na dit bord kan een vijftienjarige zeggen: "Voor elk aantal clusters laat
 * je k-means opnieuw lopen, zoals in de lus van Stap 7. Van elke clustering
 * reken je de inertia uit: hoe ver alle punten samen van hun centroid liggen,
 * dat zijn die lijntjes. Met een cluster meer wordt de inertia kleiner. Bij de
 * drie groepjes scheelt 2 en 3 clusters veel, omdat elk groepje dan een eigen
 * cluster krijgt. Zolang twee groepjes één centroid delen, ligt die ertussen
 * en zijn hun lijntjes lang. Vanaf 4 knipt k-means alleen nog groepjes in
 * stukken, en die punten lagen al dicht bij hun centroid. Daar zit de knik.
 * Ook punten zonder groepjes geven een knik, bij 4. De knik helpt me kiezen,
 * kiezen doe ik zelf."
 *   Het doel verschilt van bord 1 van les 7 ("K-means herhaalt twee stappen
 * tot er niks meer verandert") en van bord 2 ("K-means maakt zoveel clusters
 * als jij vraagt"): dat bord mag geen inertia tonen, dit bord gaat erover.
 *
 * DE PROCEDURE IS DE LUS VAN STAP 7. Elke klik op "1 cluster meer" toont een
 * NIEUWE fit met een cluster meer (elleboog.ts), geen oude clustering met een
 * cluster erbij. Daarom spreekt geen enkele zin van "de nieuwe cluster", en
 * zegt het paneel op Geen groepjes waarom het hele beeld verschuift.
 *
 * VIER KNOPPEN: twee data sets, "1 cluster meer" en "Opnieuw". Geen Trainen,
 * geen "andere start", geen lat. Zestien vaste toestanden, S(set, k) voor
 * k = 1..8.
 *   - Het bord opent op Drie groepjes met 1 cluster.
 *   - "1 cluster meer" gaat naar k + 1. De lijntjes en de C's vervagen in
 *     250 ms naar de nieuwe (niet onder prefers-reduced-motion), en in de
 *     grafiek komt er een rondje en een trede bij. Uit bij 8.
 *   - "Opnieuw" gaat terug naar 1 en knipt de grafiek terug tot één rondje.
 *     Uit zolang de grafiek maar één rondje heeft.
 *   - Een bereikt rondje in de grafiek is een knop: het bord toont dan die
 *     toestand en zijn zin.
 *   - Een andere data set begint opnieuw bij 1, met een lege grafiek. Dezelfde
 *     knop nog eens doet niets. Niets blijft van de ene set op de andere
 *     staan, en er is geen localStorage.
 *   - De tweede klik van een dubbelklik telt niet (tweedeKlik.ts): het
 *     paneel verandert van hoogte met de zinnen eronder.
 *
 * DE MERKEN. De punten navy, met de straal van les 7b. De lijntjes van elk
 * punt naar zijn centroid in navy op 45%, 1,5 px. Elke centroid een witte
 * schijf met een navy ring, BOVEN de lijntjes en ONDER de punten, en de
 * letter C erbovenop, zoals op de twee borden van les 7 (daar gemeten: zo
 * blijft van elk punt het meeste zichtbaar). Geen clusterkleuren: het gaat
 * hier om hoe ver, niet om welke cluster. En geen oranje: er is geen fout.
 *
 * DE ANNOTATIES. Op het bord staat de ene zin boven de punten (elleboog.ts,
 * `bandZin`) en, bij Drie groepjes met 2 clusters, de wijzer van les 7b. Twee
 * tegelijk, de grens is vier. De grafiek staat in een paneel.
 *   De zin breekt waar hij niet past (`regels`). Dat is een vangnet: met het
 * kader hieronder past de breedste zin (458 px) op elk gemeten scherm op één
 * regel, ook op 900x700 (514 px vrij). Op een smaller scherm zou een zin die
 * overloopt anders onder de Brief of onder de grafiek schuiven.
 *
 * De attributen data-punt, data-centroid, data-lijntje, data-ann en
 * data-grafiekpunt zijn er voor de controle in de browser.
 * ------------------------------------------------------------------ */

type SetInfo = { id: SetId; naam: string; zin: string }

const SETS: readonly SetInfo[] = [
  { id: 'drie', naam: 'Drie groepjes', zin: 'Hier liggen de punten in drie groepjes.' },
  { id: 'geen', naam: 'Geen groepjes', zin: 'Hier liggen de punten overal even dicht bij elkaar.' },
]

/* ------------------------------ de meetkunde ------------------------ *
 * Het vaste venster van "Hoeveel clusters?": het eenheidsvierkant met een
 * rand van 0,08 en bovenaan een extra strook voor de zin. Beide sets liggen
 * in dat vierkant, dus een andere set herkadert het bord nooit. Een schaal
 * voor beide assen (eenSchaal): een lijntje dat langer lijkt, IS langer.     */

const RAND = 0.08
const BAND = 0.07
const VENSTER: View = { x0: -RAND, x1: 1 + RAND, y0: -RAND, y1: 1 + RAND + BAND }
const MX = (VENSTER.x0 + VENSTER.x1) / 2
const MY = (VENSTER.y0 + VENSTER.y1) / 2

/* ------------------------------ het kader --------------------------- *
 * DRIE PANELEN, en dan is de vrije ruimte het probleem. Canvas houdt elk
 * paneel vrij als een volle KOLOM: links de Brief en het paneel, rechts de
 * grafiek. Maar de grafiek staat alleen rechtsBOVEN. Op een smal scherm
 * blijft er dan een strook van zo'n 300 px over voor de punten, terwijl
 * rechtsonder alles leeg is.
 *   Daarom rekent het bord twee kaders uit en neemt het grootste:
 *     kolom    de rechterkolom vrij, zoals Canvas zelf doet;
 *     strook   alleen de strook BOVEN, tot onder de grafiek, en rechts tot
 *              tegen de rand.
 * De linkerkolom blijft in beide vrij. Gemeten (pixels per eenheid, hoe
 * groter hoe leesbaarder), met de panelen van dit bord:
 *     1440x900   kolom 579   strook 477   -> kolom
 *     1280x800   kolom 441   strook 396   -> kolom
 *     1280x720   kolom 441   strook 331   -> kolom
 *     1024x768   kolom 359   strook 411   -> strook
 *      900x700   kolom 264   strook 355   -> strook
 * Op 900x700 raakten in de kolom 12 paren punten van Drie groepjes elkaar.
 * De rekensom is die van Canvas (rand, zoomrail, KEEP), zodat het bord ook
 * echt zo groot wordt als hier berekend.                                    */

type Kader = { top: number; right: number; bottom: number; left: number }

/** Uit Canvas: de minimale rand, de breedte van de zoomrail, en hoeveel van
 *  een as de panelen samen mogen innemen. */
const RANDJE = { top: 26, right: 26, bottom: 48, left: 58 }
const RAIL = 48
const KEEP = 0.66

function vrijeRuimte(a: number, b: number, totaal: number) {
  return totaal - Math.min(a + b, totaal * KEEP)
}

function schaalVan(W: number, H: number, k: Kader) {
  const w = vrijeRuimte(Math.max(RANDJE.left, RAIL + k.left), Math.max(RANDJE.right, k.right), W)
  const h = vrijeRuimte(Math.max(RANDJE.top, k.top), Math.max(RANDJE.bottom, k.bottom), H)
  return Math.min(w / (VENSTER.x1 - VENSTER.x0), h / (VENSTER.y1 - VENSTER.y0))
}

/** Meet de panelen naast het bord en kiest het kader met de grootste schaal. */
function useKader() {
  const ref = useRef<HTMLDivElement>(null)
  const [kader, setKader] = useState<Kader | undefined>(undefined)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const meet = () => {
      const box = el.getBoundingClientRect()
      if (!box.width) return
      let links = 0
      let rechts = 0
      let boven = 0
      el.querySelectorAll<HTMLElement>(':scope > .panel').forEach((p) => {
        const q = p.getBoundingClientRect()
        if (!q.width) return
        if ((q.left + q.right) / 2 < box.left + box.width / 2) links = Math.max(links, q.right - box.left + 16)
        else {
          rechts = Math.max(rechts, box.right - q.left + 16)
          boven = Math.max(boven, q.bottom - box.top + 16)
        }
      })
      const L = Math.ceil(links)
      const kolom: Kader = { top: 0, right: Math.ceil(rechts), bottom: RANDJE.bottom, left: L }
      const strook: Kader = { top: Math.ceil(boven), right: 0, bottom: RANDJE.bottom, left: L }
      const beste = schaalVan(box.width, box.height, strook) > schaalVan(box.width, box.height, kolom) ? strook : kolom
      setKader((vorig) =>
        vorig &&
        vorig.top === beste.top &&
        vorig.right === beste.right &&
        vorig.bottom === beste.bottom &&
        vorig.left === beste.left
          ? vorig
          : beste,
      )
    }
    meet()
    const ro = new ResizeObserver(meet)
    ro.observe(el)
    el.querySelectorAll(':scope > .panel').forEach((p) => ro.observe(p))
    return () => ro.disconnect()
  }, [])
  return [ref, kader] as const
}

/** De kleinste afstand tussen twee punten van Drie groepjes (0,0326). */
const KLEINSTE = (() => {
  let m = Infinity
  DRIE_GROEPJES.forEach((p, i) =>
    DRIE_GROEPJES.forEach((q, j) => {
      if (j > i) m = Math.min(m, Math.hypot(p.x - q.x, p.y - q.y))
    }),
  )
  return m
})()

/** De straal van een punt, de formule van "Hoeveel clusters?": zo groot als
 *  kan zonder dat twee punten van Drie groepjes elkaar raken, tussen 4 en 6 px. */
function straal(schaal: number) {
  return Math.max(4, Math.min(6, (KLEINSTE * schaal - 2) / 3.1))
}

/* ------------------------------ de zin breken ------------------------ */

const ZIN_PX = 15
const REGEL_PX = 19

let meet: CanvasRenderingContext2D | null | undefined
/** Hoe breed een tekst op het bord wordt: 15 px vet, het lettertype van de pagina. */
function breedte(tekst: string): number {
  if (meet === undefined) meet = document.createElement('canvas').getContext('2d')
  if (!meet) return tekst.length * ZIN_PX * 0.56
  meet.font = `700 ${ZIN_PX}px ${getComputedStyle(document.body).fontFamily}`
  return meet.measureText(tekst).width
}

/** Een zin die niet op één regel past, in zo weinig mogelijk regels. Bij twee
 *  regels de breuk waarbij de langste regel het kortst is, zodat er geen
 *  los woord onderaan blijft hangen ("nog maar / weinig"). */
function breekZin(zin: string, max: number): string[] {
  const woorden = zin.split(' ')
  let beste: string[] | null = null
  let besteB = Infinity
  for (let i = 1; i < woorden.length; i++) {
    const twee = [woorden.slice(0, i).join(' '), woorden.slice(i).join(' ')]
    const b = Math.max(...twee.map(breedte))
    if (b <= max && b < besteB) {
      besteB = b
      beste = twee
    }
  }
  if (beste) return beste
  // Zelfs in twee past het niet: gewoon vullen, regel na regel.
  const uit: string[] = []
  let regel = ''
  for (const woord of woorden) {
    const langer = regel ? `${regel} ${woord}` : woord
    if (regel && breedte(langer) > max) {
      uit.push(regel)
      regel = woord
    } else regel = langer
  }
  if (regel) uit.push(regel)
  return uit
}

/**
 * De zin in regels die elk in `max` px passen. Past alles op één regel, dan
 * één regel. Anders elke zin op een eigen regel, en een zin die dan nog niet
 * past, breekt tussen twee woorden (`breekZin`).
 */
function regels(tekst: string, max: number): string[] {
  if (breedte(tekst) <= max) return [tekst]
  const zinnen = tekst.match(/[^.?!]+[.?!]+/g)?.map((z) => z.trim()) ?? [tekst]
  return zinnen.flatMap((zin) => (breedte(zin) <= max ? [zin] : breekZin(zin, max)))
}

/* ------------------------------ de tekening -------------------------- */

/** De witte rand rond de letter C, zoals op "Hoeveel clusters?" (daar gemeten). */
const LETTERRAND = 1.5

function Lijntjes({
  set,
  t,
  X,
  Y,
  className,
  telt,
}: {
  set: SetId
  t: Staat
  X: (x: number) => number
  Y: (y: number) => number
  className?: string
  telt: boolean
}) {
  return (
    <g className={className} pointerEvents="none">
      {PUNTEN_VAN[set].map((p, i) => {
        const c = t.centroids[t.clusters[i]]
        return (
          <line
            key={i}
            data-lijntje={telt ? i : undefined}
            x1={X(p.x)}
            y1={Y(p.y)}
            x2={X(c.x)}
            y2={Y(c.y)}
            stroke={DATA}
            strokeOpacity={0.45}
            strokeWidth={1.5}
          />
        )
      })}
    </g>
  )
}

function Centroids({
  t,
  X,
  Y,
  R,
  deel,
  className,
  telt,
}: {
  t: Staat
  X: (x: number) => number
  Y: (y: number) => number
  R: number
  /** De schijf (onder de punten) of de letter C (erboven). */
  deel: 'schijf' | 'letter'
  className?: string
  telt: boolean
}) {
  return (
    <g className={className} pointerEvents="none">
      {t.centroids.map((c, j) =>
        deel === 'schijf' ? (
          <circle
            key={j}
            data-centroid={telt ? j : undefined}
            cx={X(c.x)}
            cy={Y(c.y)}
            r={R}
            fill="#fff"
            stroke={DATA}
            strokeWidth={3}
          />
        ) : (
          <text
            key={j}
            x={X(c.x)}
            y={Y(c.y) + 4.6}
            textAnchor="middle"
            fontSize={13}
            fontWeight={800}
            fill={DATA}
            stroke="#fff"
            strokeWidth={LETTERRAND}
            paintOrder="stroke"
          >
            C
          </text>
        ),
      )}
    </g>
  )
}

function Bord({
  s,
  set,
  k,
  nu,
  van,
  overgang,
}: {
  s: Scales
  set: SetId
  k: number
  nu: Staat
  /** Wat er stond voor de laatste wissel van aantal, zolang het nog vervaagt. */
  van: Staat | null
  overgang: number
}) {
  const { schaal, X, Y } = eenSchaal(s, MX, MY)
  const r = straal(schaal)
  const R = r + 5
  const punten = PUNTEN_VAN[set]

  /* De zin, in regels die in de vrije strook passen. De laatste regel staat
     waar de zin van les 7b staat; de andere erboven. */
  const zin = bandZin(set, k)
  const vrij = s.safe.right - s.safe.left - 24
  const zinRegels = zin ? regels(zin, vrij) : []

  /* De wijzer, alleen bij Drie groepjes met 2 clusters: de meetkunde van les
     7b (wijzerDrie). Die partitie is hier dezelfde als daar. */
  const w = set === 'drie' && k === 2 ? wijzerDrie(nu) : null
  const wc = w ? nu.centroids[w.cluster] : null

  return (
    <g>
      {/* 1. De lijntjes, onderaan. */}
      {van && <Lijntjes key={`lvan${overgang}`} set={set} t={van} X={X} Y={Y} className="kc-uit" telt={false} />}
      <Lijntjes key={`lnu-${set}-${k}`} set={set} t={nu} X={X} Y={Y} className={van ? 'kc-in' : undefined} telt />

      {/* 2. De schijf van elke centroid, boven de lijntjes en onder de punten. */}
      {van && <Centroids key={`svan${overgang}`} t={van} X={X} Y={Y} R={R} deel="schijf" className="kc-uit" telt={false} />}
      <Centroids key={`snu-${set}-${k}`} t={nu} X={X} Y={Y} R={R} deel="schijf" className={van ? 'kc-in' : undefined} telt />

      {/* 3. De punten. Die staan stil en veranderen niet. */}
      <g pointerEvents="none">
        {punten.map((p, i) => (
          <g key={i} data-punt={i}>
            <Vorm cluster={-1} x={X(p.x)} y={Y(p.y)} r={r} halo={1} />
          </g>
        ))}
      </g>

      {/* 4. De letter C, bovenop. */}
      {van && <Centroids key={`cvan${overgang}`} t={van} X={X} Y={Y} R={R} deel="letter" className="kc-uit" telt={false} />}
      <Centroids key={`cnu-${set}-${k}`} t={nu} X={X} Y={Y} R={R} deel="letter" className={van ? 'kc-in' : undefined} telt />

      {/* 5. De wijzer naar de centroid tussen twee groepjes. */}
      {w && wc && (
        <g data-ann="wijzer" pointerEvents="none">
          <line
            x1={X(w.x)}
            y1={Y(w.y) + 10}
            x2={X(wc.x)}
            y2={Y(wc.y) - R - 1.5 - 4}
            stroke={MUTED}
            strokeWidth={1.5}
          />
          <Tekst x={X(w.x)} y={Y(w.y) + 5}>
            het gemiddelde van twee groepjes
          </Tekst>
        </g>
      )}

      {/* 6. De zin, in de strook boven de punten. */}
      {zinRegels.length > 0 && (
        <g data-ann="band">
          {zinRegels.map((regel, i) => (
            <Tekst key={i} x={X(0.5)} y={Y(1) - 22 - (zinRegels.length - 1 - i) * REGEL_PX} maat={ZIN_PX}>
              {regel}
            </Tekst>
          ))}
        </g>
      )}
    </g>
  )
}

/* ------------------------------ in het paneel ----------------------- */

/** Woordgroepen die in een paneel nooit over twee regels mogen breken. Op
 *  900x700 brak de browser "K-means" na het streepje ("K-" / "means"). */
const SAMEN = /(K-means|k-means|1 cluster meer|Stap 7)/

/** Een zin waarin die woordgroepen heel blijven. */
function Heel({ children }: { children: string }) {
  return (
    <>
      {children.split(SAMEN).map((deel, i) =>
        i % 2 === 1 ? (
          <span key={i} className="whitespace-nowrap">
            {deel}
          </span>
        ) : (
          deel
        ),
      )}
    </>
  )
}

/* ------------------------------- het bord --------------------------- */

export default function WaarKomtDeKnikVandaan() {
  const [set, setSet] = useState<SetId>('drie')
  const [k, setK] = useState(1)
  /** Tot welk aantal de leerling kwam: zoveel rondjes staan er in de grafiek. */
  const [bereikt, setBereikt] = useState(1)
  /* De overgang na een wissel van aantal: wat er daarvoor stond, en een
     teller zodat twee snelle wissels elk hun eigen vervaging krijgen. Na
     260 ms is de oude laag weg. Onder prefers-reduced-motion komt er geen. */
  const [van, setVan] = useState<Staat | null>(null)
  const [overgang, setOvergang] = useState(0)
  useEffect(() => {
    if (!van) return
    const t = window.setTimeout(() => setVan(null), 260)
    return () => window.clearTimeout(t)
  }, [van, overgang])
  /* De zin breekt op de echte breedte van het lettertype. Dat staat er pas
     als het geladen is, dus dan nog eens tekenen. */
  const [, setLetters] = useState(0)
  useEffect(() => {
    let weg = false
    document.fonts?.ready.then(() => {
      if (!weg) setLetters((n) => n + 1)
    })
    return () => {
      weg = true
    }
  }, [])
  const tweedeKlik = useTweedeKlik()
  const [wrap, kader] = useKader()

  const info = SETS.find((x) => x.id === set)!
  const punten = PUNTEN_VAN[set]
  const nu = staat(set, k)
  const I = inertias(set)

  const naar = (volgende: number) => {
    if (volgende === k || volgende < 1 || volgende > MAX_AANTAL) return
    const stil = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!stil) {
      setVan(nu)
      setOvergang((n) => n + 1)
    }
    setK(volgende)
    setBereikt((b) => Math.max(b, volgende))
  }

  const opnieuw = () => {
    if (bereikt === 1) return
    if (k !== 1) naar(1)
    setBereikt(1)
  }

  const kiesSet = (id: SetId) => {
    if (id === set) return
    setSet(id)
    setK(1)
    setBereikt(1)
    setVan(null)
  }

  const clusters = meervoud(k, 'cluster', 'clusters')
  const beschrijving = `${getal(punten.length)} punten in ${getal(k)} ${clusters}. Inertia ${getal(nu.inertia, 2)}.`

  return (
    <div ref={wrap} className="relative h-full w-full">
      <Canvas defaultView={VENSTER} axes={false} label={beschrijving} insets={kader}>
        {(s) => <Bord s={s} set={set} k={k} nu={nu} van={van} overgang={overgang} />}
      </Canvas>

      {/* De eerste alinea is het doel en klapt nooit in. De tweede mag onder
          1280 px inklappen: wat je doet, staat ook in het paneel. */}
      <Brief eyebrow="mAIstros 2 - les 8" title="Waar komt de knik vandaan?">
        <p>
          De inertia meet hoe ver de punten van hun centroid liggen. De knik is waar een extra cluster nog maar
          weinig scheelt.
        </p>
        <p>
          <Heel>Druk telkens op 1 cluster meer. K-means begint dan opnieuw, zoals in de lus van Stap 7.</Heel>
        </p>
      </Brief>

      {/* De grafiek, rechtsboven. Het kader (useKader) houdt de kolom eronder
          of de strook ernaast vrij, wat het bord het grootst maakt. */}
      <Panel className="pointer-events-auto absolute right-4 top-4 z-10 w-[15rem] px-3 pb-1.5 pt-2 xl:w-[19rem]">
        <div
          onClickCapture={(e) => {
            if (tweedeKlik(e)) e.stopPropagation()
          }}
        >
          <InertiaGrafiek key={set} inertias={I} bereikt={bereikt} k={k} onKies={naar} />
        </div>
      </Panel>

      {/* Het paneel, linksonder, met een vaste breedte (het kader houdt die vrij).
          De volgorde ligt vast: de data set, het aantal, de inertia, wat je
          nu moet bekijken. */}
      <Panel className="pointer-events-auto absolute bottom-4 left-4 z-10 flex max-h-[calc(100%-12rem)] w-[16rem] flex-col overflow-y-auto px-4 py-3.5 xl:max-h-[calc(100%-15rem)] xl:w-[21rem]">
        <div
          className="contents"
          onClickCapture={(e) => {
            if (tweedeKlik(e)) e.stopPropagation()
          }}
        >
          <Sec label="Data set" meta={`${getal(punten.length)} punten`} tone="ink" />
          <div role="group" aria-label="Data set" className="mt-2 flex flex-wrap gap-1.5">
            {SETS.map((x) => (
              <SegBtn key={x.id} tone="navy" active={x.id === set} onClick={() => kiesSet(x.id)} label={x.naam} />
            ))}
          </div>
          <p className="mt-2 text-pretty text-[13.5px] leading-snug text-ink">{info.zin}</p>

          <Divider />

          {/* De chip is het argument van 2130677. Navy, zoals de knoppen. */}
          <Sec
            label="Aantal clusters"
            tone="ink"
            meta={
              <PyChip tone="navy" klein>
                n_clusters={k}
              </PyChip>
            }
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Btn onClick={() => naar(k + 1)} disabled={k >= MAX_AANTAL}>
              1 cluster meer
            </Btn>
            <Btn variant="ghost" onClick={opnieuw} disabled={bereikt === 1}>
              Opnieuw
            </Btn>
          </div>

          <p className="mt-2.5 text-[13.5px] leading-snug text-ink">
            Inertia bij {getal(k)} {clusters}: <span className="tabular-nums">{getal(nu.inertia, 2)}</span>
          </p>
          {statusZinnen(set, k).map((z) => (
            <p key={z} className="mt-2 text-pretty text-[13.5px] leading-snug text-ink">
              <Heel>{z}</Heel>
            </p>
          ))}
        </div>
      </Panel>
    </div>
  )
}
