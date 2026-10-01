import { useEffect, useState } from 'react'
import AantalKiezer from '../components/AantalKiezer'
import Canvas, { type Scales, type View } from '../components/Canvas'
import { INKT, Tekst, Vorm, bovenkant, eenSchaal } from '../components/ClusterVorm'
import { Brief, Divider, Panel, PyChip, Sec, SegBtn } from '../components/Overlay'
import { useTweedeKlik } from '../components/tweedeKlik'
import { getal } from '../components/Vaststelling'
import {
  DRIE_GROEPJES,
  PUNTEN_VAN,
  bandZinDrie,
  toestandenVan,
  wijzerDrie,
  type SetId,
  type Toestand,
} from '../lib/clusterdata'
import type { Aantal, Punt } from '../lib/kmeans'
import { INK, MUTED } from '../lib/palette'

/* ------------------------------------------------------------------ *
 * mAIstros 2 - les 7 - Hoeveel clusters?
 *
 * EEN DOEL: k-means maakt zoveel clusters als jij vraagt, en kijkt niet na of
 * er zoveel groepjes zijn. Het aantal legt vast hoeveel centroids er zijn, en
 * geen enkele stap van de lus toetst dat aan de data. Vraag je er te weinig,
 * dan wordt één centroid het gemiddelde van twee groepjes en belandt hij
 * ertussen, waar geen punten liggen. Vraag je er te veel, dan delen twee
 * centroids één groepje en knippen het in twee.
 *   Na dit bord kan een vijftienjarige zeggen: "k-means start met zoveel
 * centroids als ik vraag, dus er komen zoveel clusters. Vraag ik er te weinig,
 * dan zet het twee groepjes samen en ligt de centroid ertussen. Vraag ik er te
 * veel, dan knipt het een groepje in stukken. Bij de klanten liggen de
 * clusters dicht bij elkaar, dus daar kies ik zelf."
 *   Het doel verschilt van dat van bord 1 ("K-means herhaalt twee stappen tot
 * er niks meer verandert"): dat bord toont de lus, dit bord het aantal. De
 * iteraties worden hier dus NIET afgespeeld, en de punten bewegen nooit. Het
 * loopt ook niet vooruit op les 8: geen maat, geen score, geen berekend
 * "beste" aantal en geen telling van hoe stabiel een uitkomst is.
 *
 * DRIE DATA SETS (src/lib/clusterdata.ts). Drie groepjes, waar je het juiste
 * aantal ziet en een verkeerd aantal dus zichtbaar samenzet of knipt. Geen
 * groepjes, waar k-means toch zijn clusters maakt. En de klanten van de
 * oefening, waar geen aantal eruit springt: de vier prenten zijn die van de
 * slides van Stap 6 (2129382, 2129381, 2129383, 2129384).
 *
 * ZEVEN KNOPPEN, drie data sets en vier aantallen, en verder niets. (De spec
 * zei "zes", maar telde zelf drie en vier.) Geen "Trainen", geen "Opnieuw",
 * geen stappen en geen "andere start". Die laatste is gemeten afgewezen: het
 * juiste aantal is niet stabiel (Drie groepjes met 3 komt maar in ongeveer 89%
 * van de willekeurige starts precies uit: 88,9% en 89,4% in twee metingen van
 * 5 000 starts), en stabiel is niet passend (Klanten met 2 is de meest
 * stabiele toestand van allemaal: twee starts na elkaar verschillen daar maar
 * in 0,5 tot 0,7% van de keren in 5% van de punten of meer, tegen 20 tot 21%
 * bij Drie groepjes met 3). Een klik op een aantal draait k-means (de
 * lus van src/lib/kmeans.ts, die van bord 1) vanaf een vaste start tot het
 * einde en toont meteen het resultaat. Het bord zegt nergens "altijd" of "elke
 * start": de getoonde uitkomsten zijn gekozen (zie clusterdata.ts).
 *   Een andere data set zet alles terug: geen aantal, geen chip, geen
 * centroids, geen zin. Niets van de ene set blijft op de andere staan.
 * Dezelfde knop nog eens doet niets, en de tweede klik van een dubbelklik telt
 * niet (het paneel verandert van hoogte als je klikt, zie tweedeKlik.ts).
 *
 * DE WOORDEN. "Groepje" is wat je ZIET: punten die bij elkaar liggen.
 * "Cluster" is alleen wat k-means maakt ("de cluster", zoals de les "de oranje
 * cluster" zegt). Een cluster heet nooit een groepje. Slide 2129254 noemt de
 * groepen die het model maakt clusters, dus "Elk groepje is één cluster" is de
 * ene toestand waar de twee samenvallen. Verder van de les: punt, centroid,
 * het gemiddelde (2129258), niks meer verandert (2129261), herschaald (Stap
 * 4), data set, klanten, resultaat (hint 13281).
 *
 * DE ANNOTATIES. Op het bord staat hoogstens één zin (de band boven de punten)
 * en bij Drie groepjes met 2 clusters één wijzer: twee tegelijk, de grens is
 * vier. "leeftijd" en "jaarinkomen" bij de klanten zijn asnamen, geen uitleg.
 * De attributen data-punt, data-centroid, data-c, data-ann en data-as zijn er
 * voor de controle in de browser: merken onder een paneel, merken die elkaar
 * raken en annotaties per toestand.
 * ------------------------------------------------------------------ */

type SetInfo = {
  id: SetId
  naam: string
  /** De zin onder de knoppen: wat voor data dit is. */
  zin: string
  /** Wat een punt hier is, voor de schermlezer. */
  ding: string
}

const SETS: readonly SetInfo[] = [
  { id: 'drie', naam: 'Drie groepjes', zin: 'Hier zie je meteen hoeveel groepjes er zijn.', ding: 'punten' },
  {
    id: 'geen',
    naam: 'Geen groepjes',
    zin: 'Deze punten liggen overal even dicht bij elkaar.',
    ding: 'punten',
  },
  {
    id: 'klanten',
    naam: 'Klanten',
    zin: `De ${getal(PUNTEN_VAN.klanten.length)} klanten uit de oefening, herschaald zoals in Stap\u00a04.`,
    ding: 'klanten',
  },
]

/** De vraag onderaan het paneel, zodra er een aantal gekozen is. */
const VRAAG: Record<SetId, string> = {
  drie: 'Welk aantal past bij de groepjes die jij ziet?',
  geen: 'Vergelijk met de drie groepjes. Wat is hier anders?',
  klanten: 'Geen enkel aantal springt eruit. Dan kies jij.',
}

/* ------------------------------ de meetkunde ------------------------ *
 * Alle drie de sets liggen in het eenheidsvierkant, dus een vast venster
 * toont ze alle drie en een andere set herkadert het bord nooit: wie
 * inzoomde, blijft ingezoomd. Een rand van 0,08 rondom, en BOVENAAN een extra
 * strook voor de ene zin van het bord, zodat die boven de punten staat en
 * nooit erop. Pannen, zoomen en "Alles" werken zoals op elk bord.
 *
 * EEN SCHAAL VOOR BEIDE ASSEN (eenSchaal): de dichtste centroid moet er ook
 * het dichtst uitzien. Bij de klanten rekent k-means met de twee herschaalde
 * waarden, die elk van 0 tot 1 lopen, dus die tekenen we even groot.       */

const RAND = 0.08
const BAND = 0.07
const VENSTER: View = { x0: -RAND, x1: 1 + RAND, y0: -RAND, y1: 1 + RAND + BAND }
const MX = (VENSTER.x0 + VENSTER.x1) / 2
const MY = (VENSTER.y0 + VENSTER.y1) / 2

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

/**
 * De straal van een punt. Zo groot als kan zonder dat twee punten van Drie
 * groepjes elkaar raken: twee driehoeken reiken elk 1,55 r ver, plus 1 px witte
 * rand elk. Nooit onder 4 px (dan zie je de vorm niet meer) en nooit boven 6
 * (dan wordt de kern van de klanten één vlek). Dezelfde straal voor alle drie
 * de sets, zodat de punten niet verspringen als je van set wisselt.
 */
function straal(schaal: number) {
  return Math.max(4, Math.min(6, (KLEINSTE * schaal - 2) / 3.1))
}

/* ------------------------------ de tekening -------------------------- */

type Laag = { set: SetId; t: Toestand | null }

function Punten({
  laag,
  X,
  Y,
  r,
  className,
  telt,
}: {
  laag: Laag
  X: (x: number) => number
  Y: (y: number) => number
  r: number
  className?: string
  /** Alleen de laag die blijft staan, telt mee in de controle. */
  telt: boolean
}) {
  const punten = PUNTEN_VAN[laag.set]
  const t = laag.t
  return (
    <g className={className} pointerEvents="none">
      {punten.map((p, i) => (
        <g key={i} data-punt={telt ? i : undefined}>
          <Vorm cluster={t ? t.kleur[t.clusters[i]] : -1} x={X(p.x)} y={Y(p.y)} r={r} halo={1} />
        </g>
      ))}
    </g>
  )
}

/**
 * De witte rand rond de letter C. Smaller dan de 3,5 px van de zinnen op het
 * bord, en dat is gemeten. De C staat in het witte binnenste van zijn eigen
 * centroid, dus daar heeft hij geen rand nodig. Die rand telt alleen waar een
 * punt tot in dat binnenste komt, en dan snijdt hij een stuk uit dat punt: bij
 * Drie groepjes ligt het dichtste punt 0,22 keer de mediaanafstand tot een buur
 * van een centroid, op 900x700 zo'n 4 px van het midden van de C. Gemeten als
 * pixels van een punt die anders geverfd zijn dan zonder centroids en letters
 * (scratchpad les7b-verify/cover.py), het ergste punt over alle twaalf
 * toestanden:
 *   rand 3,5 px   69% van dat punt weg op 900x700, 36% op 1440x900
 *   rand 1,5 px   39% op 900x700, 24% op 1024x768, 27% op 1280x720,
 *                 22% op 1280x800, 16% op 1440x900
 * Met 1,5 blijft de C leesbaar, ook waar een punt ertegen ligt.
 */
const LETTERRAND = 1.5

function Centroids({
  t,
  X,
  Y,
  R,
  deel,
  className,
  telt,
}: {
  t: Toestand
  X: (x: number) => number
  Y: (y: number) => number
  R: number
  /** De vorm (onder de punten) of de letter C (erboven). */
  deel: 'vorm' | 'letter'
  className?: string
  telt: boolean
}) {
  return (
    <g className={className} pointerEvents="none">
      {t.centroids.map((c, j) => {
        const kleur = t.kleur[j]
        return deel === 'vorm' ? (
          <g key={j} data-centroid={telt ? kleur : undefined}>
            <Vorm cluster={kleur} x={X(c.x)} y={Y(c.y)} r={R} vol={false} dik={3} />
          </g>
        ) : (
          <text
            key={j}
            data-c={telt ? kleur : undefined}
            x={X(c.x)}
            y={Y(c.y) + 4.6}
            textAnchor="middle"
            fontSize={13}
            fontWeight={800}
            fill={INKT[kleur]}
            stroke="#fff"
            strokeWidth={LETTERRAND}
            paintOrder="stroke"
          >
            C
          </text>
        )
      })}
    </g>
  )
}

function Bord({
  s,
  set,
  aantal,
  nu,
  van,
  overgang,
}: {
  s: Scales
  set: SetId
  aantal: Aantal | null
  nu: Toestand | null
  /** Wat er stond voor de laatste klik op een aantal, zolang het nog vervaagt. */
  van: Laag | null
  overgang: number
}) {
  const { schaal, X, Y } = eenSchaal(s, MX, MY)
  const r = straal(schaal)
  const R = r + 5

  /* De ene zin van het bord. Bij Drie groepjes BEREKEND uit de clusters en de
     groepjes (bandZinDrie), bij Geen groepjes met het aantal clusters dat er
     echt uitkwam. */
  const bandZin = !nu
    ? 'Hoeveel groepjes zie jij?'
    : set === 'drie'
      ? bandZinDrie(nu.clusters)
      : set === 'geen'
        ? `Hier zijn geen groepjes. Toch maakt k-means er ${getal(new Set(nu.clusters).size)} clusters van.`
        : 'Hier liggen de clusters dicht bij elkaar.'

  /* De wijzer, alleen bij Drie groepjes met 2 clusters. Waar hij staat, komt
     uit de data (wijzerDrie), niet uit getypte pixels: tekst in de lege strook
     tussen de twee onderste groepjes en het bovenste, en een lijntje recht naar
     beneden tot boven op de centroid die ertussen ligt. */
  const w = nu && set === 'drie' && aantal === 2 ? wijzerDrie(nu) : null
  const wc = w && nu ? nu.centroids[w.cluster] : null
  const wKleur = w && nu ? nu.kleur[w.cluster] : 0

  return (
    <g>
      {/* 1. Bij de klanten: de twee assen als haarlijn, met hun naam. Geen
             getallen: na het herschalen van Stap 4 loopt alles van 0 tot 1, en
             dat is geen waarde die je hier moet aflezen.
               MUTED op 45% en niet RULE, zoals de spec vroeg: RULE (#e6e4ec) is
             bijna de kleur van de rasterlijnen van Canvas (#ebe8f3), en dan
             verdwijnen de twee assen in het raster. */}
      {set === 'klanten' && (
        <g data-as="" pointerEvents="none">
          <line x1={X(0)} y1={Y(0)} x2={X(1)} y2={Y(0)} stroke={MUTED} strokeOpacity={0.45} strokeWidth={1.5} />
          <line x1={X(0)} y1={Y(0)} x2={X(0)} y2={Y(1)} stroke={MUTED} strokeOpacity={0.45} strokeWidth={1.5} />
          <text
            x={X(1)}
            y={Y(0) + 20}
            textAnchor="end"
            fontSize={13.5}
            fontWeight={700}
            fill={INK}
            stroke="#fff"
            strokeWidth={3.5}
            paintOrder="stroke"
          >
            leeftijd
          </text>
          <text
            x={X(0) + 8}
            y={Y(1) + 5}
            textAnchor="start"
            fontSize={13.5}
            fontWeight={700}
            fill={INK}
            stroke="#fff"
            strokeWidth={3.5}
            paintOrder="stroke"
          >
            jaarinkomen
          </text>
        </g>
      )}

      {/* 2. De vorm van elke centroid, ONDER de punten, zoals op bord 1, en de
             letter C erboven (3b). Wit, met een dikke rand in de kleur van zijn
             cluster. Geen lijntjes van punt naar centroid: die horen bij de lus,
             en de lus is bord 1.
               De ontwerpspec zette de hele centroid BOVEN de punten, omdat een
             centroid onder de dichte kern van de klanten onzichtbaar zou zijn.
             Gemeten klopt dat niet, en het omgekeerde wel. Bovenop verborg de
             witte vorm punten: bij Drie groepjes met 4 of 5 clusters 82% van
             een punt op 1440x900 en 83% op 900x700, bij de klanten met 2
             clusters 79% op 900x700. Eronder blijft van elk punt minstens 61%
             zichtbaar (zie LETTERRAND), en bij de klanten staan alle vier de C's
             er nog duidelijk: de letter staat altijd bovenop. */}
      {van?.t && (
        <Centroids key={`vvan${overgang}`} t={van.t} X={X} Y={Y} R={R} deel="vorm" className="kc-uit" telt={false} />
      )}
      {nu && (
        <Centroids
          key={`vnu-${set}-${aantal}`}
          t={nu}
          X={X}
          Y={Y}
          R={R}
          deel="vorm"
          className={van ? 'kc-in' : undefined}
          telt
        />
      )}

      {/* 3. De punten. Wat er stond, vervaagt in 250 ms; de nieuwe kleuren
             komen erover. De punten zelf staan stil. */}
      {van && <Punten key={`van${overgang}`} laag={van} X={X} Y={Y} r={r} className="kc-uit" telt={false} />}
      <Punten
        key={`nu-${set}-${aantal ?? 0}`}
        laag={{ set, t: nu }}
        X={X}
        Y={Y}
        r={r}
        className={van ? 'kc-in' : undefined}
        telt
      />

      {/* 3b. De letter C van elke centroid, bovenop. */}
      {van?.t && (
        <Centroids key={`lvan${overgang}`} t={van.t} X={X} Y={Y} R={R} deel="letter" className="kc-uit" telt={false} />
      )}
      {nu && (
        <Centroids
          key={`lnu-${set}-${aantal}`}
          t={nu}
          X={X}
          Y={Y}
          R={R}
          deel="letter"
          className={van ? 'kc-in' : undefined}
          telt
        />
      )}

      {/* 4. De wijzer bij de centroid tussen twee groepjes. */}
      {w && wc && (
        <g data-ann="wijzer" pointerEvents="none">
          <line
            x1={X(w.x)}
            y1={Y(w.y) + 10}
            x2={X(wc.x)}
            y2={Y(wc.y) - bovenkant(wKleur, R) - 1.5 - 4}
            stroke={MUTED}
            strokeWidth={1.5}
          />
          <Tekst x={X(w.x)} y={Y(w.y) + 5}>
            het gemiddelde van twee groepjes
          </Tekst>
        </g>
      )}

      {/* 5. De ene zin, in de strook boven de punten. Voor alle drie de sets op
             dezelfde plaats. */}
      {bandZin && (
        <g data-ann="band">
          <Tekst x={X(0.5)} y={Y(1) - 22}>
            {bandZin}
          </Tekst>
        </g>
      )}
    </g>
  )
}

/* ------------------------------- het bord --------------------------- */

export default function HoeveelClusters() {
  const [set, setSet] = useState<SetId>('drie')
  const [aantal, setAantal] = useState<Aantal | null>(null)
  /* De overgang na een klik op een aantal: wat er daarvoor stond, en een
     teller zodat twee snelle klikken elk hun eigen vervaging krijgen. Na
     260 ms is de oude laag weg. Onder prefers-reduced-motion komt er geen. */
  const [van, setVan] = useState<Laag | null>(null)
  const [overgang, setOvergang] = useState(0)
  useEffect(() => {
    if (!van) return
    const t = window.setTimeout(() => setVan(null), 260)
    return () => window.clearTimeout(t)
  }, [van, overgang])
  const tweedeKlik = useTweedeKlik()

  const info = SETS.find((x) => x.id === set)!
  const punten: readonly Punt[] = PUNTEN_VAN[set]
  /* Een keer uitgerekend per set, en dan onthouden (toestandenVan). */
  const nu: Toestand | null = aantal ? toestandenVan(set)[aantal] : null

  const kiesSet = (id: SetId) => {
    if (id === set) return
    setSet(id)
    setAantal(null)
    setVan(null)
  }

  const kiesAantal = (k: Aantal) => {
    if (k === aantal) return
    const stil = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!stil) {
      setVan({ set, t: nu })
      setOvergang((n) => n + 1)
    }
    setAantal(k)
  }

  const aantalClusters = nu ? new Set(nu.clusters).size : 0
  const beschrijving = `${getal(punten.length)} ${info.ding}${
    nu ? ` in ${getal(aantalClusters)} clusters` : ', nog geen clusters'
  }`

  return (
    <div className="relative h-full w-full">
      <Canvas defaultView={VENSTER} axes={false} label={beschrijving}>
        {(s) => <Bord s={s} set={set} aantal={aantal} nu={nu} van={van} overgang={overgang} />}
      </Canvas>

      {/* De eerste alinea is het doel en klapt nooit in. De tweede mag onder
          1280 px inklappen: wat je doet, staat ook in het paneel. */}
      <Brief eyebrow="mAIstros 2 - les 7" title="Hoeveel clusters?">
        <p>K-means maakt zoveel clusters als jij vraagt. Het kijkt niet na of er zoveel groepjes zijn.</p>
        <p>Kies een data set en een aantal. K-means loopt meteen tot er niks meer verandert.</p>
      </Brief>

      {/* Het paneel heeft een vaste breedte (Canvas houdt die vrij, dus een
          breder paneel zou het bord herkaderen). De volgorde is vast: eerst de
          data set, dan het aantal, dan de vraag. */}
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
          <p className="mt-2 text-[13.5px] leading-snug text-ink">{info.zin}</p>

          <Divider />

          {/* De chip toont het argument van Stap 6 (2129380), en pas als er een
              aantal gekozen is: daarvoor is er geen n_clusters. Navy en niet
              blauw, zoals de knoppen: blauw is hier de eerste cluster. */}
          <AantalKiezer
            id="hoeveel-aantal"
            aantal={aantal}
            onKies={kiesAantal}
            meta={
              aantal ? (
                <PyChip tone="navy" klein>
                  n_clusters={aantal}
                </PyChip>
              ) : null
            }
          />

          <p className="mt-3 text-[13.5px] leading-snug text-ink">
            {aantal ? VRAAG[set] : 'Kies 2, 3, 4 of 5 clusters. Probeer daarna ook de andere.'}
          </p>
          {/* Gemeten met sklearn 1.6.1 op Python 3.11, KMeans(n_clusters=k)
              zoals in Stap 6, random_state 0 tot 499: bij 4 clusters wijkt 72,2%
              minstens 20 van de 200 punten af van dit bord (mediaan 77), bij 5
              clusters 75,0% (mediaan 27). Bij 2 is dat 0% en bij 3 0,2%, dus
              bij 2 en 3 staat deze zin er niet. De woorden zijn die van slide
              2129381 ("Bij 4 of 5 clusters verschillen ze vaak sterk") en de
              hints 13281 en 13282 ("Dat is geen fout"). Dit bord toont bij 4 en
              5 precies de prenten van die slides (0 punten verschil), dus
              "verschilt" vergelijkt met wat de leerling hier ziet. */}
          {set === 'klanten' && (aantal === 4 || aantal === 5) && (
            <p className="mt-2 text-[13.5px] leading-snug text-ink">
              Bij 4 of 5 clusters verschilt jouw resultaat uit Stap{'\u00a0'}6 vaak sterk van dit bord. Dat is geen fout.
            </p>
          )}
        </div>
      </Panel>
    </div>
  )
}
