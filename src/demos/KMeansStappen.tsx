import { useEffect, useRef, useState } from 'react'
import AantalKiezer from '../components/AantalKiezer'
import Canvas, { type Scales, type View } from '../components/Canvas'
import { INKT, KLEUR, Tekst, Vorm, eenSchaal, reik } from '../components/ClusterVorm'
import { Brief, Btn, Panel } from '../components/Overlay'
import { useTweedeKlik, type Klik } from '../components/tweedeKlik'
import Vaststelling, { getal, meervoud } from '../components/Vaststelling'
import {
  PUNTEN,
  START_SLIDES,
  aantalWissels,
  kiesDichtste,
  schuifNaarGemiddelde,
  sleutel,
  uitkomsten,
  willekeurigeStart,
  type Aantal,
  type Punt,
} from '../lib/kmeans'
import { seeded } from '../lib/regression'
import { DATA, MUTED, NAVY } from '../lib/palette'

/* ------------------------------------------------------------------ *
 * mAIstros 2 - les 7 - K-means stap voor stap.
 *
 * EEN DOEL: k-means herhaalt twee stappen tot er niks meer verandert. Elk punt
 * kiest de dichtste centroid, en elke centroid schuift naar het gemiddelde van
 * zijn punten. Dit bord gaat dus over hoe het ALGORITME te werk gaat. Er is
 * geen getraind model om aan te prutsen: de leerling zet elke stap zelf.
 *
 * HET IS DE WALKTHROUGH VAN DE LES, INTERACTIEF. Slides 2129255-2129261
 * tonen dit op 18 zwarte punten in zeven prenten. Het bord gebruikt DIE punten
 * (zie src/lib/kmeans.ts), en "Start zoals op de slides" speelt precies die
 * zeven prenten na: 5 blauw en 13 oranje, dan wisselen er 3, dan niks meer.
 * Die knop zet het aantal dus ook terug op 2: de slides tonen 2 clusters. Hij
 * heette eerst "Start van de slides", en dat leest als "het begin van de
 * slides", een knop die terug naar de eerste slide gaat.
 *
 * HET BORD OPENT ZOALS SLIDE 2129255: 18 zwarte punten, geen centroid, niets
 * klaar. Het onderwerp - de punten die in clusters moeten - staat er in de
 * eerste tel, en de enige zet is de eerste zet van het algoritme zelf: kies
 * punten als centroid. De les doet dat ook zo ("kiezen we willekeurig 2
 * elementen in de data"), en daarom kan je alleen op een PUNT klikken en niet
 * vrij op het bord: een vrij geplaatste centroid kan een lege cluster geven.
 *
 * DE VOLGORDE IS WAT JE LEERT. Er zijn twee knoppen, en alleen de volgende zet
 * staat aan. Zo herhaalt de leerling met zijn eigen klikken 1, 2, 1, 2 tot
 * knop 1 geen enkel punt meer van cluster doet wisselen.
 *
 * DE TELLER die beweegt is "Punten die van kleur veranderden": 18, 3, 0 vanaf
 * de start van de slides. Kleur en niet cluster, omdat de punten bij de eerste
 * keer nog GEEN cluster hadden - ze waren zwart. "18 punten wisselden van
 * cluster" zou dus niet kloppen, "18 punten veranderden van kleur" wel. Nul is
 * de stopregel van de les zelf: "We zien dat er niks meer verandert."
 *
 * GEMETEN EN DAAROM NIET GEZEGD: "elke keer wisselen er minder punten". Dat
 * aantal stijgt eens in 26 van de 153 starts met 2 clusters, en in 11, 47 en
 * 146 van de starts met 3, 4 en 5 (tabel in src/lib/kmeans.ts). Het bord zegt
 * nergens iets over hoe de teller daalt, alleen wanneer hij nul is.
 *
 * DE WOORDEN KOMEN VAN DE LES:
 *   centroid, centroids, cluster(s)         2129254, 2129256
 *   dichtste centroid                       2129257, 2129259
 *   het gemiddelde van alle punten          2129258
 *   willekeurig                             2129256
 *   niks meer verandert, definitieve        2129261
 *   zwart, blauw, oranje                    2129259, 2129261
 *   punt (nooit element of bol)             2129258, 2129259
 * Twee woorden staan niet in de les: `schuift` (een centroid die naar het
 * gemiddelde gaat) en `knop`. Allebei gewoon Nederlands voor wat er op het
 * scherm gebeurt.
 *
 * HET AANTAL CLUSTERS KIES JIJ. Dat is het tweede dat dit bord leert, en het
 * komt van de les zelf: "Bij deze methode om aan clustering te doen moet je
 * zelf op voorhand opgeven hoeveel clusters het model moet maken" (2129254),
 * en Stap 6 (2129379) laat de leerling 2, 3, 4 en 5 clusters maken en
 * visualiseren. Dus een kiezer met precies die vier, die op 2 opent: zo ziet
 * het bord er eerst uit als 2129255. Op het scherm staat "kiezen" en niet het
 * "opgeven" van de les: een vijftienjarige leest "dat geef jij op" als "dat
 * laat jij vallen".
 *   Het bord rekent GEEN beste aantal uit en toont geen maat. De les oordeelt
 * door te kijken ("komt mooi overeen met wat je wellicht verwachtte toen je
 * naar de zwarte punten keek", 2129261), en of die clusters iets betekenen is
 * voor de volgende les (2129385). Na een volle run geeft het bord dus DAT
 * criterium, en niets meer: denk terug aan de zwarte punten, lijken deze
 * clusters op de groepjes die je toen zag, en kies dan een ander aantal. Tot
 * 2026-09-30 vroeg het "welk aantal past het best bij de punten?", en dat gaf
 * geen criterium dat een vijftienjarige kan nagaan (review): een aantal past
 * niet bij punten, een verdeling wel. De vraag welk aantal het best past, is
 * voor het tweede bord, "Hoeveel clusters?" (/les7/hoeveel-clusters,
 * HoeveelClusters.tsx, gebouwd 2026-10-01). Ook dat bord rekent geen beste
 * aantal uit: het toont dat k-means zoveel clusters maakt als je vraagt.
 *   Een ander aantal kiezen wist de hele run: centroids, clusters, ringen,
 * stippelvormen, de teller en een schuivende centroid die nog onderweg is.
 * Niets van een run met 5 clusters mag blijven hangen op een bord met 2.
 * Gemeten in de browser: een ander aantal kiezen 150 ms na knop 2, midden in
 * het schuiven, laat 0 centroids, 0 lijntjes en een lege teller achter, ook
 * 900 ms later. Hetzelfde aantal nog eens kiezen doet niets, zodat een
 * misklik op de gekozen knop geen run wist.
 *   "Kies willekeurig" heeft per aantal een eigen seeded() reeks: de eerste
 * keer bij 4 clusters geeft op elke beamer dezelfde punten, wat je daarvoor
 * bij 2 of 3 ook deed. 2 houdt de seed die het bord altijd had. De seeds
 * liggen ver uit elkaar, en dat is gemeten nodig (zie `reeksVoor`): met seeds
 * naast elkaar begon de blauwe centroid bij elk aantal op punt 8.
 *   Het bord zegt nergens "k-means maakt altijd precies zoveel clusters als jij
 * vraagt". Aan het einde klopt dat voor elke start, maar onderweg raakt er één
 * keer een cluster leeg (1 van de 8 568 starts met 5, zie kmeans.ts). In die
 * ene toestand zegt het paneel dat die centroid blijft staan.
 *   Om dezelfde reden staat er na knop 2 niet "de centroids zijn verschoven".
 * Een centroid die al op het gemiddelde van zijn punten stond, blijft staan,
 * en dat gebeurt vaak: bij 3 clusters in 606 van de 1 796 keer knop 2, bij 4
 * in 3 268 van de 6 417, bij 5 in 11 399 van de 17 703 (en bij 2 één keer, in
 * 1 van de 153 starts). Het paneel zegt dus wat ALTIJD klopt: elke centroid
 * staat nu op het gemiddelde van zijn punten.
 *
 * DE BETALING komt na een volle run: hoeveel van alle starts bij DEZE clusters
 * uitkomen. Met 2 clusters alle 153, met 3, 4 en 5 niet (39, 251 en 748
 * verschillende uitkomsten). "Dat is geen fout" is de zin van de Codi-hints
 * 13281 en 13282 voor precies dit effect. Elk getal komt uit `uitkomsten`,
 * niet uit de tekst. Het is ook waarom de plaatjes van Stap 6 bij elke
 * leerling anders zijn: KMeans kiest zijn start willekeurig, net zoals hier.
 *   De betaling gaat over de START en is GEEN maat voor het aantal. Daarom
 * staat het vergelijken met de zwarte punten ERNA, als laatste zinnen van het
 * paneel. Stond een vraag over het aantal erboven (review 2026-09-30), dan was
 * het getal eronder het enige dat verandert als je een ander aantal kiest, en
 * las een leerling "Alle 153" tegen "maar 2" als het antwoord: stabiliteit in
 * plaats van hoe goed de clusters bij de groepjes passen, en dat eerste
 * criterium gebruikt de les nergens. Om dezelfde reden eindigt de betaling
 * niet meer op "Druk op Opnieuw en kies andere punten": het paneel geeft na de
 * run één opdracht, vergelijken en dan een ander aantal proberen.
 *
 * DE ANNOTATIES. Er is precies EEN tekstplek op het bord, de band boven de
 * punten, en die zegt per toestand hoogstens één zin. Verder staan er alleen
 * merken: de lijntjes van elk punt naar zijn centroid, een ring om de punten
 * die net wisselden (weg zodra de centroids schuiven), en een stippelvorm waar
 * een centroid stond (weg zodra de punten opnieuw kiezen). Nooit meer dan vier
 * dingen die iets uitleggen op één moment. De kiezer voor het aantal staat in
 * het paneel, niet op het bord, en telt dus niet mee. Geteld in de browser over
 * elke toestand, bij elk aantal en op vier schermen: hoogstens DRIE tegelijk
 * (de zin, de lijntjes en de ringen na knop 1, of de zin, de lijntjes en de
 * stippelvormen na de eerste knop 2). Daarvoor dienen de attributen data-punt,
 * data-centroid en data-ann: een controle in de browser telt ermee hoeveel
 * merken onder een paneel liggen en welke annotaties er tegelijk staan.
 * ------------------------------------------------------------------ */

/* Het aantal clusters, 2 tot 5 (het bereik van Stap 6, 2129379), staat in
   src/lib/kmeans.ts: "Hoeveel clusters?" kiest uit dezelfde vier. */

/* ----------------------------- de merken ---------------------------- *
 * Vorm, kleur en inkt van elke cluster staan in src/components/ClusterVorm.tsx,
 * samen met de uitleg waarom het deze vijf zijn: "Hoeveel clusters?" tekent
 * dezelfde clusters, en een cluster moet er op beide borden hetzelfde uitzien.
 *
 * EEN CENTROID OP EEN PUNT leek op het teken ©: een gekleurde rand, een vol
 * navy punt erin, en daarop een gekleurde C met een witte rand. Dat stond er
 * bij elke gekozen centroid (bij 5 clusters vijf keer op de beamer, voor knop
 * 1) en bij elke cluster van één punt (review 2026-09-30). Nu DRAAIT DE C OM
 * zolang hij op een punt staat: wit, met een rand in de inkt van dat punt
 * (navy zolang het punt zwart is, daarna de inkt van zijn cluster). Zo leest
 * hij als een letter die OP het punt gedrukt staat. Dat verbergt niets en
 * kleurt niets. Wit tegen die rand: 17,73:1 op navy, 4,51 tot 6,95:1 op de
 * vijf inkten. Staat de centroid naast de punten, dan is de C wat hij was: in
 * de inkt van zijn cluster, met een witte rand. "Op een punt" is: minder dan
 * een halve puntstraal ervan, op het scherm gemeten, want een centroid die 2
 * eenheden naast een punt staat (dat gebeurt, zie `opPunt`), ziet er net zo
 * uit als een die er precies op staat. Gemeten over alle starts met 2 tot 5
 * clusters, met die drempel op elk van de vier schermen: staat een centroid
 * na knop 2 op een punt, dan is dat altijd een punt van zijn EIGEN cluster
 * (0 keer een ander). De rand van de omgedraaide C heeft dus altijd de inkt
 * van zijn eigen cluster, of navy zolang er nog geen clusters zijn.
 *   Twee andere oplossingen, afgewezen. Een witte schijf achter de C verbergt
 * het punt, en een verborgen punt deed de teller al eens liegen ("18 van de
 * 18" met 16 zichtbare kleuren, zie 2b hieronder). Het gekozen punt al in de
 * clusterkleur zetten maakt "Alle punten waren zwart" vals.
 *                                                                    */

/* ---------------------------- de meetkunde --------------------------- *
 * De punten staan in de pixels van de slide (1212 x 662, y omgedraaid). Het
 * venster is het kader van de punten plus een rand, en BOVENAAN een extra band
 * van 130 eenheden: daar staat de ene zin van het bord, boven de punten en dus
 * nooit erop.
 *
 * EEN SCHAAL VOOR BEIDE ASSEN, en dat is hier geen smaak. "Dichtste centroid"
 * moet op het scherm ook de dichtste ZIJN. Canvas schaalt x en y apart om de
 * vrije ruimte te vullen, en dan ligt een punt dat op het scherm dichter bij
 * blauw lijkt soms echt dichter bij oranje. Dus: de kleinste van de twee
 * schalen, en het kader in het midden van het vrije vlak.                  */

const XS = PUNTEN.map((p) => p.x)
const YS = PUNTEN.map((p) => p.y)
const MIN_X = Math.min(...XS)
const MAX_X = Math.max(...XS)
const MIN_Y = Math.min(...YS)
const MAX_Y = Math.max(...YS)
const RAND = 50
const BAND = 130
const VENSTER: View = { x0: MIN_X - RAND, x1: MAX_X + RAND, y0: MIN_Y - RAND, y1: MAX_Y + BAND }
const MX = (VENSTER.x0 + VENSTER.x1) / 2
const MY = (VENSTER.y0 + VENSTER.y1) / 2

const DUUR = 700

type Fase = 'kiezen' | 'stap1' | 'stap2' | 'klaar'

/* --------------------------- de tweede klik -------------------------- *
 * DE TWEEDE KLIK VAN EEN DUBBELKLIK TELT NIET, op het hele paneel en op de
 * punten. Elke klik op dit bord verandert de fase, en met de fase verandert
 * wat er in het paneel staat en waar. Gemeten (review 2026-09-30, en opnieuw
 * voor deze fix met een dubbelklik op elke knop in elke fase): een dubbelklik
 * op "Opnieuw" wiste de run, en de tweede klik viel dan op "Start zoals op de
 * slides". Dat zette het aantal zonder een woord op 2 en startte de run van
 * de slides, in elke fase en op alle vier de schermen. Een dubbelklik op de
 * linkerkant van "Start zoals op de slides" startte een run en wiste hem
 * meteen, want daar kwam "Opnieuw" te staan.
 *   TWEE TOETSEN, want niet elk scherm telt mee. `detail` is 2 bij de tweede
 * klik van een dubbelklik met de muis. Maar een aanraakscherm, zoals een
 * digibord, kan elke tik detail 1 geven. Dus telt ook een klik niet die
 * binnen 400 ms na de vorige valt, minder dan 10 px ernaast. Een snelle klik
 * op een ANDERE knop telt wel: de middens van knop 1 en knop 2 liggen 52 tot
 * 62 px uit elkaar, en gemeten telt knop 2 ook 150 ms na knop 1. Met het
 * toetsenbord is `detail` 0, dus Enter en spatie tellen altijd.
 *   EN DE STARTKNOPPEN STAAN WAAR ZE HOREN: "Kies willekeurig" en "Opnieuw"
 * delen weer één plaats, met "Start zoals op de slides" erboven (zie DE
 * KNOPPEN VOOR DE START, onderaan). Alles op een vaste plaats houden kan
 * niet: "Start" ook tijdens de run laten staan kost 42 px, en op 900x700
 * gebruikt de run al 453 tot 472 van de 506 px. Dan scrolt het paneel weer.
 * De kiezer en de knoppen van het algoritme schuiven dus nog mee met de
 * hoogte van het paneel, en daarvoor is deze toets er ook.               */

/* `useTweedeKlik` zelf staat in src/components/tweedeKlik.ts, zodat "Hoeveel
   clusters?" dezelfde regel gebruikt. */

/* ------------------------------ de tekening -------------------------- */

/**
 * Het punt waar een centroid op staat, of -1. "Op" is: minder dan `binnen`
 * pixels ervan, op het scherm. Niet "precies op": over alle starts staat een
 * centroid na knop 2 soms maar 2,26 eenheden naast een punt (bij 4 en 5
 * clusters), op het scherm 1 tot 2 px, en dat ziet er net zo uit als erop.
 */
function opPunt(
  cx: number,
  cy: number,
  X: (x: number) => number,
  Y: (y: number) => number,
  binnen: number,
): number {
  let beste = -1
  let besteD = binnen
  PUNTEN.forEach((p, i) => {
    const d = Math.hypot(X(p.x) - cx, Y(p.y) - cy)
    if (d < besteD) {
      beste = i
      besteD = d
    }
  })
  return beste
}

function Bord({
  s,
  aantal,
  fase,
  gekozen,
  clusters,
  centroids,
  spoken,
  gewisseld,
  bandZin,
  onKlik,
  tweedeKlik,
}: {
  s: Scales
  aantal: number
  fase: Fase
  gekozen: readonly number[]
  clusters: readonly number[] | null
  centroids: readonly Punt[]
  spoken: readonly Punt[] | null
  gewisseld: ReadonlySet<number>
  bandZin: string | null
  onKlik: (i: number) => void
  tweedeKlik: (e: Klik) => boolean
}) {
  const { schaal, X, Y } = eenSchaal(s, MX, MY)
  /* De maat van een punt volgt de schaal, zodat de prent op elke beamer op de
     slide lijkt, maar nooit onder 10 px: op 900x700 is de schaal 0,47 en de
     kleinste afstand tussen twee punten dan 51 px, dus ook een centroid van
     16 px raakt geen buur. */
  const r = Math.max(10, Math.min(16, 20 * schaal))
  const R = r + 6
  const kiest = fase === 'kiezen'
  const neer = useRef<{ x: number; y: number; i: number } | null>(null)

  return (
    <g>
      {/* 1. De lijntjes van elk punt naar zijn centroid. Onderaan, zodat geen
             lijn over een merk loopt. Ze tonen wat knop 1 doet (elk punt hangt
             aan de dichtste) en wat knop 2 doet (de centroid schuift tot hij in
             het midden van zijn lijntjes staat). */}
      {clusters &&
        PUNTEN.map((p, i) => {
          const c = centroids[clusters[i]]
          return (
            <line
              key={`l${i}`}
              data-ann="lijntje"
              x1={X(p.x)}
              y1={Y(p.y)}
              x2={X(c.x)}
              y2={Y(c.y)}
              stroke={KLEUR[clusters[i]]}
              strokeWidth={1.5}
              opacity={0.45}
              pointerEvents="none"
            />
          )
        })}

      {/* 2. Waar de centroids stonden: een stippelvorm en een lijntje naar
             waar ze nu staan. Weg zodra de punten opnieuw kiezen. */}
      {spoken &&
        spoken.map((g, j) => (
          <g key={`g${j}`} data-ann="spook" pointerEvents="none">
            <line
              x1={X(g.x)}
              y1={Y(g.y)}
              x2={X(centroids[j].x)}
              y2={Y(centroids[j].y)}
              stroke={MUTED}
              strokeWidth={1.5}
              strokeDasharray="3 4"
            />
            <Vorm cluster={j} x={X(g.x)} y={Y(g.y)} r={R} streep dik={2} opacity={0.7} />
          </g>
        ))}

      {/* 2b. De vorm van elke centroid: wit, met een dikke rand, zoals de
             C-merken op de slides. ONDER de punten, en dat is gemeten (audit
             2026-09-30). Bovenop verborg de witte vorm het punt waar hij op
             begint helemaal: na knop 1 zei de teller "18 van de 18 punten" en
             stonden er 16 gekleurde punten op het bord. In de eindstand verborg
             de oranje centroid ook 35 tot 45% van een buurpunt. Nu blijft elk
             punt heel zichtbaar, en de letter C staat nog bovenop (stap 4).
             Tijdens het kiezen staan alleen de al gekozen centroids er. */}
      {centroids.slice(0, kiest ? gekozen.length : aantal).map((c, j) => (
        <g key={`cv${j}`} data-centroid={j} pointerEvents="none">
          <Vorm cluster={j} x={X(c.x)} y={Y(c.y)} r={R} vol={false} dik={4} />
        </g>
      ))}

      {/* 3. De punten. Klikken kan alleen in de eerste fase, en alleen op een
             punt: een centroid begint altijd op een punt, zoals in de les. */}
      {PUNTEN.map((p, i) => {
        const cx = X(p.x)
        const cy = Y(p.y)
        const c = clusters ? clusters[i] : -1
        return (
          <g
            key={`p${i}`}
            data-punt={i}
            role={kiest ? 'button' : undefined}
            tabIndex={kiest ? 0 : undefined}
            aria-label={
              kiest ? `punt ${i + 1}${gekozen.includes(i) ? ', gekozen als centroid' : ''}` : undefined
            }
            className={kiest ? 'group outline-none' : undefined}
            style={kiest ? { cursor: 'pointer' } : undefined}
            /* Klikken is geen slepen. Pointerdown MOET hier tegengehouden
               worden: Canvas neemt anders de pointer over, en dan komt de click
               op de svg aan in plaats van op dit punt (gemeten op les 5). Een
               gebaar dat meer dan 4 px verschoof was een pan, en de tweede klik
               van een dubbelklik telt niet, ook niet als tweede tik op een
               aanraakscherm (zie `useTweedeKlik`): anders kiest een dubbeltik
               een punt en zet hij het meteen weer terug. */
            onPointerDown={
              kiest
                ? (e) => {
                    e.stopPropagation()
                    neer.current = { x: e.clientX, y: e.clientY, i }
                  }
                : undefined
            }
            onClick={
              kiest
                ? (e) => {
                    const d = neer.current
                    neer.current = null
                    // Eerst tellen: ook een klik die niet doorgaat, is "de vorige klik".
                    const tweede = tweedeKlik(e)
                    if (!d || d.i !== i || tweede) return
                    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) return
                    onKlik(i)
                  }
                : undefined
            }
            onKeyDown={
              kiest
                ? (e) => {
                    if (e.key !== 'Enter' && e.key !== ' ') return
                    e.preventDefault()
                    onKlik(i)
                  }
                : undefined
            }
          >
            {kiest && <circle cx={cx} cy={cy} r={r + 10} fill="transparent" />}
            {kiest && (
              <circle
                cx={cx}
                cy={cy}
                r={r + 6}
                fill="none"
                stroke={NAVY}
                strokeWidth={2}
                className="opacity-0 transition-opacity group-hover:opacity-40 group-focus-visible:opacity-60"
              />
            )}
            {gewisseld.has(i) && c >= 0 && (
              <circle
                data-ann="ring"
                cx={cx}
                cy={cy}
                r={Math.max(r + 6, reik(c, r) + 4)}
                fill="none"
                stroke={KLEUR[c]}
                strokeWidth={2.5}
              />
            )}
            <Vorm cluster={c} x={cx} y={cy} r={r} />
          </g>
        )
      })}

      {/* 4. De letter C van elke centroid, helemaal bovenop. Naast de punten
             in de inkt van zijn cluster met een witte rand. Op een punt draait
             hij om: wit, met een rand in de inkt van dat punt, zodat hij als
             een letter op het punt leest en niet als het teken © (zie EEN
             CENTROID OP EEN PUNT bovenaan). */}
      {centroids.slice(0, kiest ? gekozen.length : aantal).map((c, j) => {
        const cx = X(c.x)
        const cy = Y(c.y)
        const onder = opPunt(cx, cy, X, Y, r / 2)
        const rand = onder < 0 ? null : clusters ? INKT[clusters[onder]] : DATA
        return (
          <text
            key={`c${j}`}
            data-c={rand ? 'op-punt' : 'vrij'}
            x={cx}
            y={cy + 5}
            textAnchor="middle"
            fontSize={15}
            fontWeight={800}
            fill={rand ? '#fff' : INKT[j]}
            stroke={rand ?? '#fff'}
            strokeWidth={3.5}
            paintOrder="stroke"
            pointerEvents="none"
          >
            C
          </text>
        )
      })}

      {/* 5. De ene zin van het bord, in de band boven de punten. */}
      {bandZin && (
        <g data-ann="band">
          <Tekst x={X((MIN_X + MAX_X) / 2)} y={Y(MAX_Y) - R - 18}>
            {bandZin}
          </Tekst>
        </g>
      )}
    </g>
  )
}

/* De kiezer (2 tot 5) staat in src/components/AantalKiezer.tsx: "Hoeveel
   clusters?" gebruikt dezelfde vier knoppen. */

/* ------------------------------- het bord --------------------------- */

/** De seed van "Kies willekeurig" bij 2 clusters. Elk aantal heeft zijn eigen
 *  reeks (zie `reeksVoor`), en 2 houdt de seed die het bord altijd had. */
const SEED = 20260930

/**
 * De reeks van "Kies willekeurig" voor een aantal clusters.
 *
 * NIET gewoon SEED + aantal - 2, en dat is gemeten. seeded() is een LCG, en
 * zijn EERSTE getal hangt lineair af van de seed: vier seeds naast elkaar
 * gaven 0,4087, 0,4091, 0,4094 en 0,4098, dus bij elk aantal punt 8 als
 * eerste (blauwe) centroid. Juist wie "Probeer 2, 3, 4 en 5" volgt, zag blauw
 * dan vier keer op hetzelfde punt beginnen. Nu liggen de seeds 7 919 uit
 * elkaar en valt het eerste getal vanaf 3 weg. De eerste druk per aantal:
 *   2: punt 8, 17               (zoals altijd: seed en reeks ongewijzigd)
 *   3: punt 4, 8, 15
 *   4: punt 9, 11, 17, 2
 *   5: punt 14, 15, 2, 10, 12
 * Het blauwe punt staat dan op x 508, 292, 656 en 860: vier plaatsen.
 */
function reeksVoor(aantal: Aantal): () => number {
  if (aantal === 2) return seeded(SEED)
  const r = seeded(SEED + (aantal - 2) * 7919)
  r()
  return r
}

export default function KMeansStappen() {
  const [aantal, setAantal] = useState<Aantal>(2)
  /** De punten die de leerling als centroid koos, in volgorde: cluster 1, 2, ... */
  const [gekozen, setGekozen] = useState<number[]>([])
  const [centroids, setCentroids] = useState<Punt[]>([])
  const [clusters, setClusters] = useState<number[] | null>(null)
  /** Hoeveel punten bij de laatste keer kiezen van kleur veranderden. */
  const [wissels, setWissels] = useState<number | null>(null)
  const [gewisseld, setGewisseld] = useState<Set<number>>(new Set())
  const [spoken, setSpoken] = useState<Punt[] | null>(null)
  const [fase, setFase] = useState<Fase>('kiezen')
  /** Hoeveel keer de centroids in deze run al schoven. De zin over de
   *  stippelvorm staat er alleen de eerste keer: daarna kent de leerling ze. */
  const [geschoven, setGeschoven] = useState(0)

  /* Het schuiven, beeld per beeld. `beeld` is wat er getekend wordt terwijl de
     centroids onderweg zijn; daarna is het null en telt `centroids`. */
  const [anim, setAnim] = useState<{ van: Punt[]; naar: Punt[] } | null>(null)
  const [beeld, setBeeld] = useState<Punt[] | null>(null)
  useEffect(() => {
    if (!anim) return
    const stil = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    const t0 = performance.now()
    const tik = (t: number) => {
      const u = stil ? 1 : Math.min(1, (t - t0) / DUUR)
      const e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2
      setBeeld(
        anim.van.map((p, j) => ({
          x: p.x + (anim.naar[j].x - p.x) * e,
          y: p.y + (anim.naar[j].y - p.y) * e,
        })),
      )
      if (u < 1) raf = requestAnimationFrame(tik)
      else {
        setBeeld(null)
        setAnim(null)
      }
    }
    raf = requestAnimationFrame(tik)
    /* EEN VANGNET, en het is gemeten nodig. Een browser laat requestAnimation-
       Frame stilvallen in een tabblad of iframe dat niet zichtbaar is. Dan
       kwam `tik` nooit aan zijn laatste beeld, bleef `anim` staan en stonden
       BEIDE knoppen voorgoed uit: in een verborgen paneel stonden ze na 900 ms
       nog allebei grijs. Na de duur plus wat marge zet deze timer de centroids
       dus hoe dan ook op hun plaats. */
    const vangnet = window.setTimeout(() => {
      setBeeld(null)
      setAnim(null)
    }, DUUR + 150)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(vangnet)
    }
  }, [anim])
  const bezig = anim !== null

  /* DE FOCUS VOLGT DE VOLGENDE ZET, voor wie met het toetsenbord werkt. Bij
     elke zet verdwijnt of dooft wat de focus had: een gekozen punt is geen
     knop meer zodra het laatste punt gekozen is, knop 1 staat uit na knop 1,
     en na de laatste knop 1 zijn beide knoppen weg. Gemeten (audit
     2026-09-30): na het vijfde punt met Enter stond de focus op <body>, en
     moest je van bovenaan de pagina opnieuw naar knop 1 tabben. Dus: is de
     focus kwijt, dan gaat ze naar de ene knop die nu aan staat, en na het
     einde naar het gekozen aantal in de kiezer, want dat is de opdracht. Wie
     ergens anders staat, wordt niet verplaatst. Gemeten met Enter door een
     hele run met 5 clusters: vijfde punt -> knop 1 -> knop 2 -> knop 1 ... ->
     de 5 in de kiezer. Alleen terwijl de centroids schuiven (700 ms) staan
     beide knoppen uit en is de focus even weg; daarna staat ze op knop 1. Met
     de muis verschijnt er geen focusring (:focus-visible blijft uit). */
  const wortel = useRef<HTMLDivElement>(null)
  const knoppen = useRef<HTMLDivElement>(null)
  const tweedeKlik = useTweedeKlik()
  useEffect(() => {
    const nu = document.activeElement
    const kwijt =
      !nu ||
      nu === document.body ||
      !nu.isConnected ||
      (nu instanceof HTMLButtonElement && nu.disabled)
    if (!kwijt) return
    const doel =
      fase === 'stap1' && !bezig
        ? knoppen.current?.querySelectorAll('button')[0]
        : fase === 'stap2'
          ? knoppen.current?.querySelectorAll('button')[1]
          : fase === 'klaar'
            ? wortel.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
            : null
    doel?.focus({ preventScroll: true })
  }, [fase, bezig])

  /** Elke leerling en elke beamer krijgt dezelfde "willekeurige" reeks, en
   *  dat per aantal: de eerste keer "Kies willekeurig" bij 4 clusters geeft
   *  overal dezelfde punten, wat je daarvoor bij 2 of 3 ook deed. */
  const toeval = useRef(new Map<Aantal, () => number>())

  /* De betaling telt alle starts voor dit aantal. Bij 5 zijn dat 8 568 runs:
     gemeten 40 ms in node en 48 ms in Chromium. Het bord rekent ze pas uit als
     een run klaar is, en warmt ze 400 ms nadat het aantal gekozen is al op,
     zodat de klik op het aantal zelf niet hapert. `uitkomsten` onthoudt elk
     aantal maar één keer. */
  useEffect(() => {
    const t = window.setTimeout(() => uitkomsten(aantal), 400)
    return () => window.clearTimeout(t)
  }, [aantal])
  const alle = fase === 'klaar' ? uitkomsten(aantal) : null

  const getoond: Punt[] =
    beeld ?? (fase === 'kiezen' ? gekozen.map((i) => PUNTEN[i]) : centroids)

  /* ------------------------------ de zetten ----------------------------- */

  /** Alles van een run weg, ook een centroid die nog onderweg is. */
  const wis = () => {
    setGekozen([])
    setCentroids([])
    setClusters(null)
    setWissels(null)
    setGewisseld(new Set())
    setSpoken(null)
    setGeschoven(0)
    setFase('kiezen')
    setAnim(null)
    setBeeld(null)
  }

  const zetStart = (start: number[]) => {
    setGekozen(start)
    setCentroids(start.map((i) => PUNTEN[i]))
    setClusters(null)
    setWissels(null)
    setGewisseld(new Set())
    setSpoken(null)
    setGeschoven(0)
    setFase('stap1')
    // Niets van een vorige run blijft hangen, ook geen centroid die nog schuift.
    setAnim(null)
    setBeeld(null)
  }

  /** Een punt aanklikken: het wordt de volgende centroid, of klik je een
   *  gekozen punt opnieuw aan, dan is het weer gewoon een punt. */
  const klikPunt = (i: number) => {
    if (fase !== 'kiezen') return
    if (gekozen.includes(i)) {
      setGekozen(gekozen.filter((g) => g !== i))
      return
    }
    const nieuw = [...gekozen, i]
    if (nieuw.length === aantal) zetStart(nieuw)
    else setGekozen(nieuw)
  }

  /** Knop 1: elk punt kiest de dichtste centroid. */
  const stap1 = () => {
    if (fase !== 'stap1' || bezig) return
    const nieuw = kiesDichtste(centroids, clusters)
    const eerste = clusters === null
    const n = eerste ? nieuw.length : aantalWissels(clusters, nieuw)
    setGewisseld(
      eerste ? new Set() : new Set(nieuw.flatMap((c, i) => (c !== clusters[i] ? [i] : []))),
    )
    setClusters(nieuw)
    setWissels(n)
    setSpoken(null)
    setFase(!eerste && n === 0 ? 'klaar' : 'stap2')
  }

  /** Knop 2: elke centroid schuift naar het gemiddelde van zijn punten. */
  const stap2 = () => {
    if (fase !== 'stap2' || !clusters || bezig) return
    const naar = schuifNaarGemiddelde(centroids, clusters)
    setSpoken(centroids)
    setAnim({ van: centroids, naar })
    setCentroids(naar)
    setGewisseld(new Set())
    setGeschoven(geschoven + 1)
    setFase('stap1')
  }

  const willekeurig = () => {
    if (fase !== 'kiezen') return
    let r = toeval.current.get(aantal)
    if (!r) {
      r = reeksVoor(aantal)
      toeval.current.set(aantal, r)
    }
    zetStart(willekeurigeStart(aantal, r))
  }

  /** Een ander aantal wist de hele run. Hetzelfde aantal nog eens kiezen doet
   *  niets: wie per ongeluk op de gekozen knop drukt, verliest zijn run niet. */
  const kiesAantal = (k: Aantal) => {
    if (k === aantal) return
    setAantal(k)
    wis()
  }

  /** De start van de slides is een start met 2 clusters, dus het aantal gaat
   *  mee naar 2. De kiezer springt zichtbaar mee. */
  const startSlides = () => {
    setAantal(2)
    zetStart([...START_SLIDES])
  }

  /* ------------------------------ de zinnen ----------------------------- */

  const nogTeKiezen = aantal - gekozen.length
  /** Met 2 centroids is er maar één andere: "de". Vanaf 3 zijn er meer: "een". */
  const andere = aantal === 2 ? 'de andere centroid' : 'een andere centroid'
  /** Gemeten: één start op 8 568, bij 5 clusters (zie kmeans.ts). */
  const legeCluster = clusters !== null && new Set(clusters).size < aantal

  /** De ene zin op het bord. Elke zin doet één ding en verdwijnt als dat
   *  gedaan is. */
  const bandZin =
    fase === 'kiezen'
      ? gekozen.length === 0
        ? `Klik op ${getal(aantal)} punten.`
        : `Klik nog op ${getal(nogTeKiezen)} ${meervoud(nogTeKiezen, 'punt', 'punten')}.`
      : fase === 'klaar'
        ? 'Er verandert niks meer. Dit zijn de definitieve clusters.'
        : fase === 'stap2' && wissels !== null && clusters && gewisseld.size > 0
          ? `${getal(wissels)} ${meervoud(wissels, 'punt koos', 'punten kozen')} ${andere}.`
          : fase === 'stap1' && spoken && geschoven === 1
            ? 'De gestippelde vormen tonen waar de centroids eerst stonden.'
            : null

  /** Wat de leerling nu doet, in het paneel dat nooit inklapt. */
  const stand =
    fase === 'kiezen'
      ? gekozen.length === 0
        ? `Klik op ${getal(aantal)} punten. Dat worden de centroids, één voor elke cluster.`
        : `Klik nog op ${getal(nogTeKiezen)} ${meervoud(nogTeKiezen, 'punt', 'punten')}. Klik je een centroid nog eens aan, dan is hij weer een gewoon punt.`
      : fase === 'stap1' && clusters === null
        ? 'De centroids staan klaar. Druk op knop 1: elk punt kiest de dichtste centroid.'
        : fase === 'stap2'
          ? /* Met een lege cluster eerst de uitzondering, dan de opdracht:
               "elke centroid schuift" en daarna "die blijft staan" sprak
               zichzelf tegen. */
            legeCluster
            ? 'Eén centroid heeft geen punten meer. Die blijft staan. Druk op knop 2: de andere schuiven naar het gemiddelde van hun punten.'
            : 'Druk op knop 2: elke centroid schuift naar het gemiddelde van zijn punten.'
          : fase === 'stap1'
            ? /* NIET "de centroids zijn verschoven": gemeten over alle starts
                 blijft bij knop 2 vaak een centroid staan, omdat hij al op het
                 gemiddelde van zijn punten stond. Bij 3 clusters in 606 van de
                 1 796 keer knop 2, bij 4 in 3 268 van de 6 417, bij 5 in
                 11 399 van de 17 703, en bij 2 één keer. Wat altijd klopt, is
                 waar ze nu staan.
                   Met een lege cluster valt de vraag "Kiest elk punt nog altijd
                 dezelfde centroid?" weg. Die toestand komt pas na de tweede
                 knop 2, dus de leerling las de vraag in deze run al. Met de
                 vraag erbij was dit de hoogste toestand van het paneel (490 px
                 op 900x700), en een open uitleg raakte het paneel dan net. */
              legeCluster
              ? 'De centroid zonder punten bleef staan. De andere staan nu op het gemiddelde van hun punten. Druk op knop 1.'
              : 'Elke centroid staat nu op het gemiddelde van zijn punten. Kiest elk punt nog altijd dezelfde centroid? Druk op knop 1.'
            : null

  /** De vaststelling: de teller en de ene regel eronder.
   *  IN DE VERLEDEN TIJD, want de regel blijft na knop 2 staan. "Die punten
   *  liggen NU dichter bij een andere centroid" was na knop 2 soms vals: de
   *  centroids zijn dan verschoven, en een punt dat net wisselde ligt soms weer
   *  het dichtst bij zijn vorige. Gemeten over alle starts (review 2026-09-30,
   *  en opnieuw): nooit bij 2 clusters, bij 3, 4 en 5 in 13, 38 en 76 keer
   *  knop 1. De verleden tijd gaat over het moment van knop 1, en toen lag elk
   *  punt dat wisselde STRIKT dichter bij zijn nieuwe centroid dan bij zijn
   *  vorige: 0 uitzonderingen op 489, 1 785, 5 355 en 13 604 wissels. */
  const detail =
    wissels === null
      ? undefined
      : clusters && wissels === PUNTEN.length && fase !== 'klaar' && gewisseld.size === 0
        ? 'Alle punten waren zwart. Nu heeft elk punt de kleur van zijn cluster.'
        : wissels === 0
          ? 'Hier stopt k-means.'
          : wissels === 1
            ? `Dat punt lag dichter bij ${andere}.`
            : `Die punten lagen dichter bij ${andere}.`

  /* De betaling: pas na een volle run, en elk getal komt uit `uitkomsten`. */
  const dezeUitkomst = alle && clusters ? (alle.telling.get(sleutel(clusters)) ?? 0) : 0
  const eenUitkomst = alle !== null && alle.telling.size === 1

  return (
    <div ref={wortel} className="relative h-full w-full">
      {/* Geen astekst: de voorbeelden op de slides hebben geen assen, en de
          plaats van een punt is hier geen waarde die je moet aflezen. */}
      <Canvas defaultView={VENSTER} axes={false}>
        {(s) => (
          <Bord
            s={s}
            aantal={aantal}
            fase={fase}
            gekozen={gekozen}
            clusters={clusters}
            centroids={getoond}
            spoken={spoken}
            gewisseld={gewisseld}
            bandZin={bandZin}
            onKlik={klikPunt}
            tweedeKlik={tweedeKlik}
          />
        )}
      </Canvas>

      {/* DE EERSTE ALINEA IS HET DOEL. Onder 1280 px klapt de rest in, dus hier
          staat geen opdracht: wat je doet staat in het paneel eronder, dat
          nooit inklapt, en in de band op het bord. De harde spatie in de titel
          houdt "voor stap" bij elkaar: op 1024x768 brak hij als "K-means stap
          voor / stap", met één los woord op de tweede regel. Ze staat er als
          escape en niet als los teken, zoals in Vaststelling.tsx: een los
          teken is in dit project al eens stil een gewone spatie geworden.
            De tweede alinea zei eerst ook "Jij kiest in hoeveel clusters
          k-means ze opdeelt". Vanaf 1280 px stond dat dan twee keer op het
          scherm, want het paneel zegt het ook, en op 900x700 maakte die regel
          de open uitleg 46 px langer (onderkant 238 in plaats van 192), zodat
          het paneel erover schoof. Het paneel is de ene plek waar het staat. */}
      <Brief eyebrow="mAIstros 2 - les 7" title={'K-means stap voor\u00a0stap'}>
        <p>K-means herhaalt twee stappen tot er niks meer verandert.</p>
        <p>Dit zijn de {getal(PUNTEN.length)} punten van de slides.</p>
      </Brief>

      {/* Het paneel staat er van de eerste tel af en verandert nooit van
          breedte: Canvas houdt die breedte vrij, dus een paneel dat later
          opduikt zou het bord herkaderen. Alleen de hoogte verandert.

          DE VOLGORDE IS VAST en volgt het algoritme: eerst het aantal clusters,
          dan wat je nu doet, dan de twee knoppen van het algoritme, dan de
          teller, en onderaan de knoppen voor de start. Na het einde staat op
          de plaats van "wat je nu doet" de betaling, met het vergelijken met
          de zwarte punten als laatste zinnen (zie DE BETALING bovenaan).

          WAT ER STAAT HANGT AF VAN DE FASE, en dat is gemeten. Met de kiezer
          erbij scrolde het paneel op 900x700 in ELKE toestand (535 tot 592 px
          inhoud in 506 px), en op 1024x768 na elke volle run met 3 of meer
          clusters. Wat er nu wegvalt, heeft in die fase geen werk:
            - de twee knoppen van het algoritme staan er alleen tijdens de run.
              Bij het kiezen en na het einde staan ze allebei uit.
            - de zin onder de kiezer staat er alleen bij het kiezen. Midden in
              een run heeft hij zijn werk gedaan, en na het einde staat onder
              de betaling de opdracht om een ander aantal te kiezen.
            - "Start zoals op de slides" staat er alleen bij het kiezen en na
              het einde: dat zijn de twee momenten waarop je een start kiest.
              Midden in een run is "Opnieuw" de uitweg.
          Zo wisselen de knoppen van het algoritme en de betaling elkaar af, en
          blijft het paneel ongeveer even hoog. Gemeten op 900x700, waar het
          paneel 506 px heeft: kiezen 395-414, tijdens de run 453-472 (ook in
          de toestanden met een lege cluster), na het einde 452-470 (de drie
          korte zinnen over de zwarte punten kosten een regel meer dan de oude
          vraag). Op 1024x768 dezelfde getallen (574 px vrij), op 1280 en 1440
          360-417. Geen enkel paneel scrolt, bij geen enkel aantal.
            DE OPEN UITLEG. Onder 1280 px staat de uitleg linksboven dicht, en
          kan de leerling hem met + openen. Dan reikt hij op 900x700 tot 192 px,
          en het paneel begint nooit hoger dan 210 px: 18 px lucht, in elke
          toestand. Voor deze ronde schoof het paneel er tot 46 px over (op main
          24 px), en verborg het de tweede zin van de uitleg. Dat is opgelost
          met twee kortere teksten, niet met een lagere max-h: een lager
          paneel zou in de hoogste toestanden weer scrollen. */}
      <Panel className="pointer-events-auto absolute bottom-4 left-4 z-10 flex max-h-[calc(100%-12rem)] w-[16rem] flex-col overflow-y-auto px-4 py-3.5 xl:max-h-[calc(100%-15rem)] xl:w-[21rem]">
        {/* De tweede klik van een dubbelklik komt hier niet voorbij (zie
            `useTweedeKlik`). In de capture-fase, dus voor elke knop in het
            paneel, ook voor Btn uit Overlay, waarvan onClick geen klik
            meekrijgt.
            `contents`: deze div doet niets aan de opmaak, de flex van het
            paneel ziet meteen zijn kinderen. */}
        <div
          className="contents"
          onClickCapture={(e) => {
            if (tweedeKlik(e)) e.stopPropagation()
          }}
        >
          {/* HET AANTAL KIES JIJ. De zin eronder is de reden dat de kiezer er
              is. "Beslist" en niet "kiest": op dit bord kiest elk punt de
              dichtste centroid, en kiest de leerling punten en een aantal. Een
              derde die "kiest" is een woord voor twee dingen. Het bord rekent
              geen beste aantal uit: de les oordeelt door te kijken (2129261). */}
          <AantalKiezer aantal={aantal} onKies={kiesAantal} />
          {fase === 'kiezen' && (
            <p className="mt-2 text-[13.5px] leading-snug text-ink">
              K-means beslist niet hoeveel clusters er komen. Dat kies jij.
            </p>
          )}

          {stand && <p className="mt-3 text-[13.5px] leading-snug text-ink">{stand}</p>}
          {/* DE BETALING, zodra het algoritme stopt: dan is dit wat de leerling
              nu moet lezen. Elk getal komt uit `uitkomsten`, en de derde zin
              volgt uit die telling, niet uit deze tekst.
                DAARNA HET CRITERIUM VAN DE LES, als laatste zinnen: vergelijk met
              wat je zag toen alles nog zwart was ("komt mooi overeen met wat je
              wellicht verwachtte toen je naar de zwarte punten keek", 2129261).
              Dat kan een leerling nagaan, "welk aantal past het best bij de
              punten?" niet: een aantal past niet bij punten. Welk aantal het
              best past, is voor het tweede bord "Hoeveel clusters?". Drie
              korte zinnen en geen lange: "Vergelijk de clusters met de groepjes
              die je zag toen de punten nog zwart waren" heeft drie delen. En
              nergens "bij de start": op dit bord is de start de gekozen punten.
                Het criterium staat NA het getal. Stond er een vraag over het
              aantal boven, dan was het getal eronder het enige dat verandert als
              je een ander aantal kiest (bij 2 "Alle 153", bij 5 soms "maar 2"),
              en las een leerling dat getal als het antwoord. Dat getal zegt iets
              over de START, niet over het aantal. Daarom ook geen "Druk op
              Opnieuw" meer in de betaling: dan eindigde het paneel op twee
              opdrachten die elkaar tegenspraken, een ander aantal en hetzelfde
              aantal opnieuw. */}
          {alle && clusters && (
            <>
              <p className="mt-3 text-[13.5px] leading-snug text-ink">
                Er zijn {getal(alle.starts)} manieren om {getal(aantal)} punten als centroids te
                kiezen.{' '}
                {dezeUitkomst === alle.starts
                  ? `Alle ${getal(dezeUitkomst)} komen bij deze clusters uit.`
                  : `Daarvan ${meervoud(dezeUitkomst, 'komt', 'komen')} er maar ${getal(dezeUitkomst)} bij deze clusters uit.`}{' '}
                {eenUitkomst
                  ? 'De start maakt hier dus niet uit.'
                  : 'De uitkomst hangt dus af van waar je start. Dat is geen fout.'}
              </p>
              <p className="mt-2 text-[13.5px] leading-snug text-ink">
                Zag je groepjes toen alle punten nog zwart waren? Lijken deze clusters daarop? Kies
                daarna een ander aantal clusters en vergelijk opnieuw.
              </p>
            </>
          )}

          {/* De twee stappen van het algoritme, alleen tijdens de run. Alleen de
              volgende staat aan: de volgorde is wat je hier leert. */}
          {(fase === 'stap1' || fase === 'stap2') && (
            <div ref={knoppen} className="mt-2.5 flex flex-col gap-1.5">
              <Btn full disabled={fase !== 'stap1' || bezig} onClick={stap1}>
                1. Elk punt kiest de dichtste centroid
              </Btn>
              <Btn full disabled={fase !== 'stap2' || bezig} onClick={stap2}>
                2. Elke centroid schuift naar het gemiddelde
              </Btn>
            </div>
          )}

          <Vaststelling
            label="Punten die van kleur veranderden"
            value={wissels}
            outOf={{ total: PUNTEN.length, noun: 'punten' }}
            detail={detail}
            empty="Nog geen enkel punt hoort bij een cluster."
          />

          {/* DE KNOPPEN VOOR DE START. Er stonden er ooit vier in vier rijen plus
              een regel tekst, en na een run met 3 clusters zakte de laatste knop
              36 px onder de rand van het paneel, al op 1024x768. Daarom delen
              "Kies willekeurig" en "Opnieuw" één plaats, ONDERAAN LINKS: kiezen
              kan alleen zolang er nog geen centroids staan, en opnieuw beginnen
              heeft pas zin als ze er wel staan. "Start zoals op de slides" staat
              er alleen bij het kiezen en na het einde, en dan altijd ERBOVEN, op
              een eigen rij. Het aantal clusters staat bovenaan, in de kiezer.
                WAAROM ERBOVEN, gemeten (review 2026-09-30). "Start" stond eerst
              onder "Kies willekeurig", en dan kwam "Opnieuw" bij de run precies
              op de plaats van "Start". Een dubbelklik op "Opnieuw" wiste de run
              en viel dan op "Start": het aantal sprong zonder een woord op 2, en
              de run van de slides begon, op alle vier de schermen. Nu valt wat
              op "Opnieuw" volgt altijd op "Kies willekeurig", met hetzelfde
              aantal, zoals op main. En waar "Start" stond, staat tijdens de run
              de teller: tekst, geen knop. De tweede klik van een dubbelklik telt
              daarbovenop ook niet (zie `useTweedeKlik`).
                Onder elkaar en niet naast elkaar, ook waar ze naast elkaar
              passen: na het einde passen "Start" en "Opnieuw" vanaf 1280 px op
              één rij, en dan stond "Opnieuw" rechts, niet op zijn plaats. Dat
              kost daar 42 px, en daar is plaats genoeg. */}
          <div className="mt-2.5 flex flex-col items-start gap-1.5">
            {(fase === 'kiezen' || fase === 'klaar') && (
              <Btn variant="ghost" onClick={startSlides}>
                Start zoals op de slides
              </Btn>
            )}
            {fase === 'kiezen' ? (
              <Btn variant="ghost" onClick={willekeurig}>
                Kies willekeurig
              </Btn>
            ) : (
              <Btn variant="ghost" onClick={wis}>
                Opnieuw
              </Btn>
            )}
          </div>
        </div>
      </Panel>
    </div>
  )
}
