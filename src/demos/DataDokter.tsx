import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import Canvas, { LineShape, fitView, type CanvasApi, type Scales, type View } from '../components/Canvas'
import { Btn, Divider, Panel, Readout, Traceback } from '../components/Overlay'
import {
  CONTROLEGROEP,
  NA_IDS,
  WERKSET,
  controleMiss,
  controleMissPerGroep,
  type DokterRow,
  type Geslacht,
} from '../lib/datasets'
import { bestFit, clamp, missLabel, type Line, type Point } from '../lib/regression'
import { DATA, DERDE, FOUT, INK, MODEL } from '../lib/palette'

/* ------------------------------------------------------------------ *
 * Les 2 - Data-dokter. Eén doel: de leerling beslist welke rijen het
 * model mag gebruiken.
 *
 * DE TABEL IS HET BESTAND. HET BORD IS DE FOTO VAN HET BESTAND.
 *
 * Dat is geen decoratie maar de hele reden dat dit scherm gesplitst is.
 * De vorige versie had alleen het bord, en daar kan een rij zonder
 * lengte niet op staan. De leerling drukte op "gooi de NA-rijen weg",
 * er bewoog niets, en de knop leek stuk. Geen enkele zin repareert dat.
 * Nu staat diezelfde rij rechts in de tabel, met NA in de kolom lengte
 * en zonder punt op het bord. Dat verschil hoeft niemand uit te leggen.
 *
 * Drie dingen dragen de les, en die drie moeten van achter in de klas
 * te lezen zijn:
 *
 * 1. Wat zit in het model en wat niet. Er zijn drie toestanden - in het
 *    model, weggegooid, geen lengte - en ze verschillen van VORM en niet
 *    alleen van kleur: gevulde bol, open ring met een kruis, vierkant met
 *    een streep. Diezelfde drie vormen staan in de tabel, in de legende
 *    en op het bord, en ze komen alle drie uit één component (Vorm).
 * 2. Tabel en bord wijzen naar elkaar. Zweef over een rij en haar punt
 *    licht op; zweef over een punt en haar rij licht op. Klik en de rij
 *    verhuist naar het blok "weggegooid", en de tabel scrolt mee zodat je
 *    ziet waar ze belandt. Dat verband tussen een rij in een bestand en
 *    een punt op een grafiek is zelf een leerdoel van les 2.
 * 3. Het cijfer wordt NIET op de zichtbare punten gemeten maar op een
 *    controlegroep die niet op het bord staat. Anders zou elke
 *    verwijdering winst lijken en leert de demo precies het verkeerde:
 *    weggooien wat lastig is. Dat "niet op het bord" is geen manier van
 *    spreken: datasets.ts laat de bouw mislukken zodra één controlerij
 *    samenvalt met een rij die je hier kan aanklikken.
 *
 * Nagerekend met node (zie datasets.ts): 15 rijen, 13 met een lengte,
 * 2 met NA, 8 mensen in de controlegroep (4 vrouwen, 4 mannen). Het
 * model heeft bij de start een fout van 30,3 cm, en van 1,9 cm als alleen
 * de tien echte rijen overblijven. Elke echte rij die je daarna weggooit
 * maakt die fout groter, in 10 van de 10 gevallen. Train je alleen op de
 * mannen, dan is de fout bij de vrouwen 4,6 cm.
 *
 * Wat op het paneel staat over die verwijderingen wordt live uitgerekend
 * en niet beweerd: het bord kan de tekst dus niet tegenspreken. Het
 * paneel telt ook alleen wat de leerling zelf weggooide, nooit hoeveel
 * kapotte rijen er nog te vinden zijn.
 *
 * Gemeten geometrie, in de browser opgemeten en niet uitgerekend. Per
 * scherm: paneel links, paneel rechts, gevraagde insets, en wat Canvas er
 * na zijn afknijpgrens (KEEP) van overhoudt.
 *
 *    900x700  208 en 284 px  ->  288 + 316 = 604 gevraagd, 594 toegelaten
 *                                afgeknepen tot 283 + 311, vrij bord 306 px
 *   1024x768  208 en 284 px  ->  288 + 316 = 604 van 676, niet afgeknepen
 *                                vrij bord 420 px
 *   1280x800  256 en 336 px  ->  336 + 368 = 704 van 845, niet afgeknepen
 *                                vrij bord 576 px
 *   1440x900  256 en 336 px  ->  704 van 950, vrij bord 736 px
 *
 * Waarom die breedtes vastliggen: knijpt Canvas de insets af, dan schuift
 * het vrije vlak ONDER het paneel en staan de tick-labels achter glas. Op
 * 900 px is dat net niet zo: het vrije vlak stopt 11 px voor het
 * rechterpaneel. Wie een paneel breder maakt, rekent dit opnieuw na en
 * meet het na op 900 px breed.
 *
 * De hoogte is krapper dan de breedte. Het bestandspaneel loopt van boven
 * naar onder en houdt kop, legende, kolomkoppen en het NA-blok vast;
 * alleen de rijen zelf scrollen, dus de knop blijft altijd in beeld. Op
 * 768 px hoog passen alle vijftien rijen; op 700 px staan de laatste twee
 * (waaronder die van 364 cm) onder de vouw en moet je scrollen. Het
 * randmerk "1 rij buiten beeld" op het bord verklapt dat die rij bestaat.
 * ------------------------------------------------------------------ */

/** Rijen met een getal in de kolom lengte: alleen die kan je tekenen. */
const PLOTBAAR: DokterRow[] = WERKSET.filter((r) => r.lengte !== null)

/** De rijen die echt van een mens komen: daar opent het bord op. */
const ECHTE_PUNTEN: Point[] = WERKSET.filter((r) => r.kind === 'ok').map((r) => ({
  x: r.maat,
  y: r.lengte as number,
}))

/** Waar het bestand mee binnenkomt: 30,3 cm, live uitgerekend. */
const START_MISS = controleMiss(PLOTBAAR.map((r) => ({ x: r.maat, y: r.lengte as number })))

const FALLBACK_VIEW: View = { x0: 33, x1: 50, y0: 145, y1: 195 }

/**
 * Het openingsbeeld ligt vast en beweegt nooit meer. Een rij weggooien
 * herkadert het bord dus niet, ook de rij van 364 cm niet: die staat er
 * bij het openen al buiten. Zo brengt "Alles" je altijd hierheen terug.
 *
 * Kaderen op alle dertien plotbare punten rekt de y-as tot 364 cm op, en
 * dan liggen de tien echte rijen samengeperst in een handvol pixels: de
 * twee mannen van maat 46 zijn dan niet meer uit elkaar te klikken.
 */
const OPENING_VIEW: View = fitView(ECHTE_PUNTEN, { padFrac: 0.12 }) ?? FALLBACK_VIEW

/* ---- Alleen deze vier merken, niets ernaast. Ze komen uit lib/palette,
       want een bord hoort geen eigen kopie van een kleur te bewaren:
         MODEL  de lijn van het model
         DATA   rijen die in het model zitten
         FOUT   wat kapot is: een rij zonder lengte
         DERDE  door de leerling weggegooid
       INK is tekst en de aanwijzer, en dus geen merk. ---- */

/**
 * Drie toestanden, en elke rij zit in precies één ervan. Samen tellen ze
 * dus altijd op tot de vijftien rijen van het bestand.
 */
type Staat = 'in' | 'weg' | 'geen'

/** Eén woord per toestand, overal hetzelfde. */
const WOORD: Record<Staat, string> = {
  in: 'in het model',
  weg: 'weggegooid',
  geen: 'geen lengte',
}

const KLEUR: Record<Staat, string> = { in: DATA, weg: DERDE, geen: FOUT }

const staatVan = (r: DokterRow, weg: ReadonlySet<number>): Staat =>
  weg.has(r.id) ? 'weg' : r.lengte === null ? 'geen' : 'in'

/** Straal van het onzichtbare trefvlak rond een punt. */
const TREFVLAK = 17

/**
 * Hoever een randmerk van de rand van het VRIJE vlak blijft. Het vrije
 * vlak (scales.safe) is wat de panelen overlaten, dus dit hoeft niet meer
 * per paneel nagemeten te worden zoals in de vorige versie. Onderaan meer
 * ruimte, want daar staan de tick-labels en het x-as-label.
 */
const RANDMARGE = { top: 26, right: 22, bottom: 44, left: 22 }

/**
 * Randmerken die dichter dan dit bij elkaar landen, worden één merk. Breed
 * en laag, want het label staat 16 px naast het driehoekje en is zelf zo'n
 * 120 px lang: twee merken op dezelfde hoogte schrijven anders over elkaar.
 */
const SAMEN = { x: 150, y: 24 }

/** Scheef model: van de andere groep blijven er hoogstens zoveel over. */
const SCHEEF = 1

/** En pas de moeite waard om te zeggen vanaf zoveel rijen in het model. */
const GENOEG = 4

/** Nederlandse komma, zoals de leerlingen het in hun schrift schrijven. */
const cm = (v: number) => v.toFixed(1).replace('.', ',')

/** 1,79 blijft 1,79 - dat absurde getal is net wat de rij verraadt. */
const lengteCel = (v: number | null) =>
  v === null ? 'NA' : v < 10 ? v.toFixed(2).replace('.', ',') : String(Math.round(v))

const rijWoord = (n: number) => (n === 1 ? 'rij' : 'rijen')

/**
 * Eén regel, want dit is de regel die telt. Op de smalste stand loopt ze
 * over twee regels; een tweede regel code erbij maakte er vijf van en dan
 * viel de knop eronder buiten beeld.
 */
const CRASH = ["ValueError: could not convert string to float: 'NA'"]

/**
 * missLabel geeft het oordeel over de afstand; de kleur halen we uit ons
 * eigen palet en niet uit die functie, want die geeft nog de oude hexen.
 * Verandert daar een label, dan valt dit terug op rustig ink in plaats van
 * op een kleur die niets betekent.
 */
const OORDEEL: Record<string, string> = {
  'heel goed': DERDE,
  bruikbaar: DERDE,
  'zit ernaast': FOUT,
  'zit ver ernaast': FOUT,
}

export default function DataDokter() {
  const [weg, setWeg] = useState<ReadonlySet<number>>(() => new Set<number>())
  const [gekozen, setGekozen] = useState<number | null>(null)
  const [pythonOpen, setPythonOpen] = useState(false)
  /** Zweeft de muis boven de NA-knop? Dan lichten juist die rijen op. */
  const [naWijzer, setNaWijzer] = useState(false)

  const { inBestand, uitBestand, inModel } = useMemo(() => {
    const inB = WERKSET.filter((r) => !weg.has(r.id))
    return {
      inBestand: inB,
      uitBestand: WERKSET.filter((r) => weg.has(r.id)),
      inModel: inB.filter((r) => r.lengte !== null),
    }
  }, [weg])

  const punten = useMemo<Point[]>(
    () => inModel.map((r) => ({ x: r.maat, y: r.lengte as number })),
    [inModel],
  )

  const lijn = useMemo<Line | null>(
    () => (punten.length >= 2 ? bestFit(punten) : null),
    [punten],
  )
  const miss = useMemo(() => controleMiss(punten), [punten])
  const perGroep = useMemo(() => controleMissPerGroep(punten), [punten])

  /** Echte rijen die de leerling zelf weggooide. */
  const echtWeg = useMemo(() => uitBestand.filter((r) => r.kind === 'ok'), [uitBestand])

  /**
   * Wat het cijfer zou zijn met die rijen er weer bij, alles verder
   * zoals het nu staat. Zo hoeft de tekst niets te beweren: er staan twee
   * gemeten getallen naast elkaar.
   */
  const terug = useMemo(() => {
    if (echtWeg.length === 0) return null
    const extra = echtWeg.map((r) => ({ x: r.maat, y: r.lengte as number }))
    return controleMiss([...punten, ...extra])
  }, [punten, echtWeg])

  const balans = useMemo(() => tel(inModel), [inModel])
  const geenLengte = useMemo(() => inBestand.filter((r) => r.lengte === null).length, [inBestand])

  /**
   * Zolang er niets weg is, staat het cijfer er rustig bij. Rood bij het
   * openen leest als een fout die zij gemaakt hebben, terwijl dit gewoon de
   * rommel is waar ze mee beginnen.
   */
  const onbewerkt = uitBestand.length === 0
  const kleur =
    onbewerkt || miss === null ? INK : (OORDEEL[missLabel(miss).label] ?? INK)

  /**
   * Eén regel status, nooit twee. De vergelijking met de start is de zwakste
   * en staat daarom onderaan: zodra er iets sterkers te melden valt, gaat die
   * voor. Zo blijft dit blok altijd hoogstens drie regels hoog.
   */
  const status = useMemo(() => {
    const zin = advies({ miss, terug, echtWeg: echtWeg.length, balans, perGroep })
    if (zin) return zin
    if (onbewerkt || START_MISS === null || miss === null) return null
    // Twee keer hetzelfde getal onder elkaar leest als een fout in het bord.
    // Gooi je alleen de NA-rijen weg, dan blijft de fout exact 30,3 cm, en dan
    // zegt het rechterpaneel dat al met zoveel woorden.
    if (cm(START_MISS) === cm(miss)) return null
    return `Bij de start was de fout ${cm(START_MISS)} cm.`
  }, [miss, terug, echtWeg, balans, perGroep, onbewerkt])

  /* ---------------- tabel en bord wijzen naar elkaar ---------------- */

  const rijRefs = useRef(new Map<number, HTMLButtonElement | null>())
  const tikker = useRef(0)
  const [naarRij, setNaarRij] = useState<{ id: number; n: number } | null>(null)

  useEffect(() => {
    if (!naarRij) return
    rijRefs.current.get(naarRij.id)?.scrollIntoView({ block: 'nearest' })
  }, [naarRij])

  const toonRij = (id: number) => setNaarRij({ id, n: ++tikker.current })

  const toggle = (id: number) => {
    setWeg((prev) => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })
    setGekozen(id)
    toonRij(id)
  }

  const zetNa = (eruit: boolean) => {
    setWeg((prev) => {
      const next = new Set(prev)
      for (const id of NA_IDS) {
        if (eruit) next.add(id)
        else next.delete(id)
      }
      return next
    })
    setGekozen(null)
    toonRij(NA_IDS[0])
  }

  const api = useRef<CanvasApi | null>(null)

  /** Alles terug naar het begin, ook het beeld: anders blijft het bord
   *  uitgezoomd staan nadat de leerling een randmerk heeft aangeklikt. */
  function opnieuw() {
    setWeg(new Set<number>())
    setGekozen(null)
    setPythonOpen(false)
    setNaWijzer(false)
    api.current?.reset()
  }

  /** Kadert een groep rijen buiten beeld in, samen met de echte rijen. */
  const toonGroep = (g: RandGroep) =>
    api.current?.fit(
      [...g.rijen.map((r) => ({ x: r.maat, y: r.lengte as number })), ...ECHTE_PUNTEN],
      { padFrac: 0.12 },
    )

  /**
   * Onderscheidt een klik van een sleep over het bord. Deze refs worden enkel
   * in een event aangeraakt, nooit tijdens het renderen.
   */
  const merkDown = useRef<{ x: number; y: number; id: number } | null>(null)
  const randDown = useRef<{ x: number; y: number; i: number } | null>(null)

  const rij = gekozen === null ? null : (WERKSET.find((r) => r.id === gekozen) ?? null)

  return (
    <div className="relative h-full w-full">
      <Canvas
        defaultView={OPENING_VIEW}
        apiRef={api}
        xLabel="schoenmaat"
        yLabel="lengte (cm)"
      >
        {(s) => {
          const randen = randGroepen(inModel, s)
          return (
            <>
              {lijn && <LineShape line={lijn} scales={s} color={MODEL} />}
              {/*
                Aanwijzen en klikken lezen allebei uit dichtsteRij, dus de
                tabel en de klik gaan altijd over dezelfde rij. De rij wordt
                bij het indrukken vastgelegd en niet bij het loslaten: tussen
                die twee mag de muis nog een paar px schuiven.
              */}
              <g
                style={{ cursor: 'pointer' }}
                onPointerMove={(e) => {
                  // Zolang de knop ingedrukt staat blijft de keuze op de rij
                  // van bij het indrukken. Laat de leerling los buiten een
                  // punt, dan komt de eerstvolgende beweging zonder ingedrukte
                  // knop hier langs en gaat het aanwijzen gewoon verder.
                  if (merkDown.current) {
                    if (e.buttons !== 0) return
                    merkDown.current = null
                  }
                  setGekozen(dichtsteRij(e, s))
                }}
                onPointerDown={(e) => {
                  const id = dichtsteRij(e, s)
                  if (id === null) return
                  e.stopPropagation()
                  merkDown.current = { x: e.clientX, y: e.clientY, id }
                  setGekozen(id)
                }}
                onPointerUp={(e) => {
                  const d = merkDown.current
                  merkDown.current = null
                  if (!d) return
                  // Een sleep die op een punt begon is geen klik.
                  if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) return
                  e.stopPropagation()
                  toggle(d.id)
                }}
                onPointerCancel={() => (merkDown.current = null)}
                onPointerLeave={(e) => {
                  // merkDown blijft hier bewust staan: een klik die net over de
                  // rand van een trefvlak wiebelt mag niet verloren gaan.
                  // Op een touchscreen bestaat zweven niet, dus daar blijft de
                  // aangetikte rij staan: daar is ze net voor bedoeld.
                  if (e.pointerType === 'mouse') setGekozen(null)
                }}
              >
                {/* Eerst de weggegooide rijen, zodat ze achter de rest liggen. */}
                {uitBestand
                  .filter((r) => r.lengte !== null)
                  .map((r) => (
                    <Merk key={r.id} rij={r} staat="weg" scales={s} />
                  ))}
                {inModel.map((r) => (
                  <Merk key={r.id} rij={r} staat="in" scales={s} />
                ))}
              </g>
              {randen.map((g, i) => (
                <Randmerk
                  key={g.rijen.map((r) => r.id).join('-')}
                  groep={g}
                  scales={s}
                  // Wijs je in de tabel de rij van 364 cm aan, dan moet er
                  // iets oplichten. Haar punt ligt buiten beeld, dus licht
                  // het randmerk op dat haar kant op wijst.
                  gekozen={gekozen !== null && g.rijen.some((r) => r.id === gekozen)}
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    randDown.current = { x: e.clientX, y: e.clientY, i }
                  }}
                  onPointerUp={(e) => {
                    const d = randDown.current
                    randDown.current = null
                    if (!d || d.i !== i) return
                    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) return
                    e.stopPropagation()
                    toonGroep(g)
                  }}
                />
              ))}
              {rij && rij.lengte !== null && zichtbaar(rij, s) && (
                <Aanwijzer rij={rij} scales={s} />
              )}
              {/*
                DE KERN VAN DEZE DEMO. Wijs een rij zonder lengte aan en het
                bord zegt zelf waarom er niets oplicht. Dit hangt aan de
                lengte en niet aan weggegooid-zijn, dus de uitleg blijft ook
                staan nadat de rij eruit gegooid is.
              */}
              {rij && rij.lengte === null && <GeenPunt scales={s} />}
            </>
          )
        }}
      </Canvas>

      {/*
        LINKSBOVEN: het model. Bewust smal en kort. Canvas meet dit paneel
        en houdt die breedte vrij van punten, dus elke centimeter hier is
        bordruimte minder, en het paneel mag ook niet zo hoog worden dat het
        over de zoomknoppen van Canvas valt (die staan halverwege links).
      */}
      <Panel className="pointer-events-auto absolute left-4 top-4 z-10 w-[13rem] px-3.5 py-3.5 xl:w-[16rem]">
        <div className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-ink/75">
          mAIstros 2 - les 2
        </div>
        <h1 className="cf-display mt-0.5 text-[18px] leading-tight">Data-dokter</h1>
        {/*
          Het doel van dit bord, en de enige zin die altijd zichtbaar moet
          blijven. Zonder deze regel weet niemand achteraan in de klas waar dit
          scherm over gaat, en dan moet de leerkracht het toch uitleggen.
        */}
        <p className="mt-1.5 text-[13px] font-medium leading-snug text-ink">
          Jij beslist welke rijen het model mag gebruiken.
        </p>

        <Divider />

        <Readout
          label="Fout van het model"
          value={miss === null ? '-' : cm(miss)}
          unit={miss === null ? undefined : 'cm'}
          color={kleur}
          sub={`Gemiddeld, bij ${CONTROLEGROEP.length} mensen die niet op het bord staan.`}
        />

        {status && (
          <p className="mt-1.5 text-[12.5px] leading-snug text-ink/85">{status}</p>
        )}
      </Panel>

      {/*
        RECHTS: het bestand zelf, van boven tot onder. Kop, legende,
        kolomkoppen en het NA-blok staan vast; alleen de rijen scrollen. Zo
        blijft de knop altijd in beeld, ook met de foutmelding open.
      */}
      <Panel className="pointer-events-auto absolute bottom-4 right-4 top-4 z-10 flex w-[17.75rem] flex-col px-3.5 py-3.5 xl:w-[21rem]">
        <div className="flex shrink-0 items-baseline justify-between gap-2">
          <Kop>Je bestand</Kop>
          <button
            type="button"
            onClick={opnieuw}
            className="shrink-0 text-[12px] font-semibold text-model underline-offset-2 hover:underline"
          >
            Begin opnieuw
          </button>
        </div>
        {/*
          Deze zin stond er als "Elke rij is een stip op het bord", en dat is
          precies niet waar: twee rijen hebben geen lengte en kunnen dus nooit
          op het bord staan. Dat is de hele les van dit scherm, dus de kopregel
          mag ze niet tegenspreken.
        */}
        <p className="mt-1.5 shrink-0 text-[13px] font-medium leading-snug text-ink">
          Een rij met een lengte wordt een punt op het bord.
        </p>
        <p className="mt-1 shrink-0 text-[12.5px] leading-snug text-ink/85">
          Klik een rij weg. Klik ze terug.
        </p>

        <Regel />

        {/*
          Deze drie getallen zijn een verdeling van het hele bestand: elke rij
          zit in precies één hokje, dus ze tellen altijd op tot WERKSET.length.
          Ze zijn tegelijk de legende: dezelfde vorm als in de tabel en op het
          bord, met het woord ernaast. Wat er nog te vinden valt, staat er
          bewust niet bij.
        */}
        <ul className="shrink-0 space-y-1">
          <Telling staat="in" aantal={inModel.length} />
          {/* Man/vrouw hangt onder "in het model", want het gaat over die rijen. */}
          <li className="pl-[19px]">
            <div className="text-[12px] leading-snug tabular-nums text-muted">
              man {balans.man} &middot; vrouw {balans.vrouw}
            </div>
            <Balk man={balans.man} vrouw={balans.vrouw} />
          </li>
          <Telling staat="geen" aantal={geenLengte} />
          <Telling staat="weg" aantal={uitBestand.length} />
        </ul>

        <Regel />

        {/* De koppen van het bestand, in schrijfmachineletter: dit is de file. */}
        <div className="grid shrink-0 grid-cols-[14px_3rem_2.25rem_3.9rem_1fr] items-baseline gap-x-1 px-1 pb-1 font-mono text-[10px] text-muted">
          <span />
          <span>geslacht</span>
          <span className="text-right">lengte</span>
          <span className="text-right">schoenmaat</span>
          <span className="font-sans">status</span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {inBestand.map((r) => (
            <TabelRij
              key={r.id}
              rij={r}
              staat={staatVan(r, weg)}
              gekozen={gekozen === r.id}
              gewezen={naWijzer && r.kind === 'na'}
              onWijs={setGekozen}
              onKlik={toggle}
              refCb={(el) => {
                if (el) rijRefs.current.set(r.id, el)
              }}
            />
          ))}

          {uitBestand.length > 0 && (
            <>
              <div className="mt-2 flex items-baseline justify-between gap-2 px-1">
                <Kop>Weggegooid</Kop>
                <span className="shrink-0 text-[11.5px] text-muted">klik om terug te zetten</span>
              </div>
              {uitBestand.map((r) => (
                <TabelRij
                  key={r.id}
                  rij={r}
                  staat="weg"
                  gekozen={gekozen === r.id}
                  gewezen={false}
                  onWijs={setGekozen}
                  onKlik={toggle}
                  refCb={(el) => {
                    if (el) rijRefs.current.set(r.id, el)
                  }}
                />
              ))}
            </>
          )}
        </div>

        <Regel />

        {geenLengte > 0 ? (
          <div
            className="shrink-0"
            onPointerEnter={() => setNaWijzer(true)}
            onPointerLeave={() => setNaWijzer(false)}
          >
            {/*
              De foutmelding komt IN DE PLAATS van de zin, niet eronder. Ze
              loopt ook over de binnenrand van het paneel (-mx-2), want anders
              wordt ze drie regels en zakt de knop onder de vouw.
            */}
            {pythonOpen ? (
              <div className="-mx-2">
                <Traceback lines={CRASH} />
              </div>
            ) : (
              <p className="text-[12.5px] leading-snug text-ink/85">
                Bij {geenLengte} {rijWoord(geenLengte)} staat NA in plaats van een lengte. Je
                code crasht erop.
              </p>
            )}
            <div className="mt-2">
              <Btn variant="ghost" onClick={() => zetNa(true)} full>
                {`Gooi deze ${geenLengte} ${rijWoord(geenLengte)} weg`}
              </Btn>
            </div>
            <button
              type="button"
              onClick={() => setPythonOpen((v) => !v)}
              className="mt-1.5 text-[12px] font-semibold text-model underline-offset-2 hover:underline"
            >
              {pythonOpen ? 'Verberg wat Python zegt' : 'Toon wat Python zegt'}
            </button>
          </div>
        ) : (
          <div className="shrink-0">
            {/*
              De knop verzet twee tellingen hierboven, maar niet het getal
              links. Zonder deze twee zinnen leest dat als een knop die niets
              deed. Ze spreken over déze rijen en niet over "sinds de start",
              want intussen kan de leerling ook echte rijen hebben
              weggegooid.
            */}
            <p className="text-[12.5px] leading-snug text-ink/85">
              Geen enkele rij heeft nog NA. Je code crasht niet meer.
            </p>
            <p className="mt-1.5 text-[12.5px] leading-snug text-ink/85">
              De fout is niet veranderd. Die rijen zaten nooit in het model.
            </p>
            <button
              type="button"
              onClick={() => zetNa(false)}
              className="mt-1.5 text-[12px] font-semibold text-model underline-offset-2 hover:underline"
            >
              Zet ze terug
            </button>
          </div>
        )}
      </Panel>
    </div>
  )
}

/* ------------------------------ vormen ------------------------------ */

/**
 * De vorm van één toestand, en de enige plek waar die vorm staat. De tabel,
 * de legende en het bord tekenen alle drie hiermee, dus ze kunnen niet uit
 * elkaar groeien. De toestanden verschillen van VORM en niet alleen van
 * kleur: gevulde bol, open ring met een kruis, vierkant met een streep.
 */
function Vorm({ staat, cx, cy, r = 6 }: { staat: Staat; cx: number; cy: number; r?: number }) {
  if (staat === 'in') {
    return <circle cx={cx} cy={cy} r={r} fill={DATA} stroke="#fff" strokeWidth={1.5} />
  }
  if (staat === 'weg') {
    const k = r * 0.62
    return (
      <g>
        <circle cx={cx} cy={cy} r={r + 1} fill="#fff" stroke={DERDE} strokeWidth={2.2} />
        <path
          d={`M${cx - k} ${cy - k}L${cx + k} ${cy + k}M${cx - k} ${cy + k}L${cx + k} ${cy - k}`}
          fill="none"
          stroke={DERDE}
          strokeWidth={2}
          strokeLinecap="round"
        />
      </g>
    )
  }
  // Geen lengte: een vierkant met een streep waar het getal hoort. Deze
  // vorm staat nooit op het bord, en dat is precies wat ze moet zeggen.
  const s = r + 0.5
  return (
    <g>
      <rect
        x={cx - s}
        y={cy - s}
        width={s * 2}
        height={s * 2}
        rx={2}
        fill="#fff"
        stroke={FOUT}
        strokeWidth={2.2}
      />
      <path
        d={`M${cx - s * 0.45} ${cy}L${cx + s * 0.45} ${cy}`}
        fill="none"
        stroke={FOUT}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </g>
  )
}

/** Dezelfde vorm, klein, voor in de tabel en de legende. */
function Icoon({ staat }: { staat: Staat }) {
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" className="shrink-0" aria-hidden="true">
      <Vorm staat={staat} cx={7} cy={7} r={4.6} />
    </svg>
  )
}

/* ------------------------------ bord ------------------------------ */

/**
 * Eén rij op het bord. Een weggegooide rij blijft zichtbaar en klikbaar,
 * want ze moet terug kunnen.
 *
 * Geen eigen klikafhandeling: de groep eromheen kiest de dichtste rij. Bij
 * overlappende trefvlakken ving het bovenste merk anders de klik, ook als
 * de tabel een andere rij aanwees.
 */
function Merk({ rij, staat, scales }: { rij: DokterRow; staat: Staat; scales: Scales }) {
  const cx = scales.sx(rij.maat)
  const cy = scales.sy(rij.lengte as number)
  return (
    <g>
      {/* Ruim onzichtbaar trefvlak: deze merken zijn klein op een beamer. */}
      <circle cx={cx} cy={cy} r={TREFVLAK} fill="transparent" />
      <Vorm staat={staat} cx={cx} cy={cy} />
      <title>{`${rijTekst(rij)} - ${WOORD[staat]}`}</title>
    </g>
  )
}

/**
 * De rij die je aanwijst: een ring plus wat er in die rij staat, groot
 * genoeg voor achter in de klas. De ring is inkt en geen merkkleur, want
 * aanwijzen is geen toestand van de data. Het label klapt naar links zodra
 * het anders onder een paneel zou eindigen.
 */
function Aanwijzer({ rij, scales }: { rij: DokterRow; scales: Scales }) {
  const cx = scales.sx(rij.maat)
  const cy = scales.sy(rij.lengte as number)
  const tekst = rijTekst(rij)
  // 14 px vetgedrukt is gemeten 6,7 px per teken; 7,3 houdt marge. De muur
  // is de rand van het VRIJE vlak, dus van wat de panelen overlaten.
  const past = cx + 20 + tekst.length * 7.3 < scales.safe.right
  return (
    <g pointerEvents="none">
      <circle cx={cx} cy={cy} r={14} fill={INK} opacity={0.09} />
      <circle cx={cx} cy={cy} r={14} fill="none" stroke="#fff" strokeWidth={4} />
      <circle cx={cx} cy={cy} r={14} fill="none" stroke={INK} strokeWidth={2} />
      <text
        x={past ? cx + 21 : cx - 21}
        y={cy + 5}
        textAnchor={past ? 'start' : 'end'}
        fontSize={14}
        fontWeight={700}
        fill={INK}
        stroke="#fff"
        strokeWidth={3.5}
        paintOrder="stroke"
      >
        {tekst}
      </text>
    </g>
  )
}

/**
 * Wat er gebeurt als je een rij zonder lengte aanwijst: niets, en dat is de
 * les. Het bord zegt het zelf, midden in het vrije vlak, in plaats van dat
 * de leerkracht het moet uitleggen.
 */
function GeenPunt({ scales }: { scales: Scales }) {
  const x = (scales.safe.left + scales.safe.right) / 2
  const y = scales.safe.top + 30
  return (
    <g pointerEvents="none">
      <Vorm staat="geen" cx={x} cy={y} r={7} />
      <text
        x={x}
        y={y + 30}
        textAnchor="middle"
        fontSize={14}
        fontWeight={700}
        fill={INK}
        stroke="#fff"
        strokeWidth={4}
        paintOrder="stroke"
      >
        Deze rij heeft geen lengte, dus geen punt.
      </text>
    </g>
  )
}

/**
 * Rijen die in het model zitten maar buiten het vrije vlak liggen. Zonder
 * dit merk kan de leerling niet weten dat het model nog op een mens van
 * 364 cm traint. Het driehoekje wijst hun kant op; de klik kadert ze in
 * samen met de echte rijen, zodat de afstand meteen te zien is.
 */
function Randmerk({
  groep,
  scales,
  gekozen,
  onPointerDown,
  onPointerUp,
}: {
  groep: RandGroep
  scales: Scales
  /** Wijst de tabel een rij uit deze groep aan? Dan licht het merk op. */
  gekozen: boolean
  onPointerDown: (e: PointerEvent) => void
  onPointerUp: (e: PointerEvent) => void
}) {
  const { x, y } = groep
  const lengte = Math.hypot(groep.dx, groep.dy) || 1
  const dx = groep.dx / lengte
  const dy = groep.dy / lengte
  const n = groep.rijen.length
  const tekst = `${n} ${rijWoord(n)} buiten beeld`
  // 13,5 px vetgedrukt is gemeten 5,9 px per teken; 6,4 houdt marge.
  const naarLinks = x + 16 + tekst.length * 6.4 > scales.safe.right
  const punt = `${x + dx * 11},${y + dy * 11} ${x - dx * 5 - dy * 7},${y - dy * 5 + dx * 7} ${x - dx * 5 + dy * 7},${y - dy * 5 - dx * 7}`
  return (
    <g
      style={{ cursor: 'pointer' }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      <circle cx={x} cy={y} r={20} fill="transparent" />
      <circle cx={x} cy={y} r={11} fill="#fff" opacity={0.85} />
      {gekozen && (
        <>
          <circle cx={x} cy={y} r={15} fill="none" stroke="#fff" strokeWidth={4} />
          <circle cx={x} cy={y} r={15} fill="none" stroke={INK} strokeWidth={2} />
        </>
      )}
      <polygon points={punt} fill={DATA} stroke="#fff" strokeWidth={1.5} />
      <text
        x={naarLinks ? x - 16 : x + 16}
        y={y + 5}
        textAnchor={naarLinks ? 'end' : 'start'}
        fontSize={13.5}
        fontWeight={700}
        fill={INK}
        stroke="#fff"
        strokeWidth={3.5}
        paintOrder="stroke"
      >
        {tekst}
      </text>
      <title>{`Klik om deze rijen te tonen: ${groep.rijen.map(rijTekst).join(' / ')}`}</title>
    </g>
  )
}

/* ----------------------------- panelen ----------------------------- */

function Kop({ children }: { children: string }) {
  return (
    <div className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-ink/75">
      {children}
    </div>
  )
}

/** Eén hokje van de verdeling, met de vorm die op het bord staat. */
function Telling({ staat, aantal }: { staat: Staat; aantal: number }) {
  return (
    <li className="grid grid-cols-[14px_1fr_auto] items-center gap-x-[5px] text-[12.5px] leading-snug text-ink">
      <Icoon staat={staat} />
      <span>{WOORD[staat]}</span>
      <span
        className="shrink-0 text-[13px] font-semibold tabular-nums"
        style={{ color: KLEUR[staat] }}
      >
        {aantal}
      </span>
    </li>
  )
}

/** Man en vrouw in de rijen waar het model op traint. Eén accent, twee sterktes. */
function Balk({ man, vrouw }: { man: number; vrouw: number }) {
  const totaal = Math.max(1, man + vrouw)
  return (
    <div className="mt-1 flex h-[5px] w-full overflow-hidden rounded-full bg-black/[0.06]">
      <div className="h-full bg-model" style={{ width: `${(man / totaal) * 100}%` }} />
      <div className="h-full bg-model/25" style={{ width: `${(vrouw / totaal) * 100}%` }} />
    </div>
  )
}

/* --------------------------- kort scherm --------------------------- *
 * Op 900x700 is dit paneel 668 px hoog en paste het bestand er
 * niet meer in: 2 van de 15 rijen zakten onder de vouw, waaronder net die
 * van 364 cm, en dan moet een leerling een scrollbalk ontdekken om de rij te
 * vinden waar dit hele bord over gaat. De ruimte komt uit witruimte en
 * rijhoogte, nooit uit rijen: de tabel is het bestand, dus alle 15 rijen
 * blijven staan en in de volgorde van de csv.
 *
 * Gemeten op 900x700: drie scheidingen die 8 px krimpen geven 24 px, en
 * rijen van 21 naar 17 px geven 60 px. Samen zakt de tabel van 315 px in een
 * venster van 279 px naar 255 px in 303 px, met genoeg over voor de kop
 * "Weggegooid" die erbij komt zodra er een rij uit gaat. Boven 780 px hoogte
 * is er niets aan de hand, dus daar verandert er niets.
 *
 * De klassenaam staat hieronder en in TabelRij voluit: Tailwind leest de
 * broncode als tekst, dus een klasse die uit een variabele komt, wordt
 * nooit gegenereerd.
 * ------------------------------------------------------------------- */

/** De scheiding in het bestandspaneel, krapper op een kort scherm. */
function Regel() {
  return <div className="my-2.5 h-px shrink-0 bg-black/[0.07] [@media(max-height:780px)]:my-1.5" />
}

/**
 * Eén regel uit het bestand. De kolommen staan in de volgorde van de CSV,
 * en een rij zonder lengte toont gewoon NA. Zweven wijst het punt aan,
 * klikken verhuist de rij naar het blok weggegooid en terug.
 */
function TabelRij({
  rij,
  staat,
  gekozen,
  gewezen,
  onWijs,
  onKlik,
  refCb,
}: {
  rij: DokterRow
  staat: Staat
  gekozen: boolean
  /** De NA-knop wijst deze rij aan, nog voor er iemand op klikt. */
  gewezen: boolean
  onWijs: (id: number | null) => void
  onKlik: (id: number) => void
  refCb: (el: HTMLButtonElement | null) => void
}) {
  const uit = staat === 'weg'
  return (
    <button
      type="button"
      ref={refCb}
      onPointerEnter={() => onWijs(rij.id)}
      onPointerLeave={() => onWijs(null)}
      onFocus={() => onWijs(rij.id)}
      onBlur={() => onWijs(null)}
      onClick={() => onKlik(rij.id)}
      title={`${WOORD[staat]} - klik om ze ${uit ? 'terug te zetten' : 'weg te gooien'}`}
      className={`grid w-full grid-cols-[14px_3rem_2.25rem_3.9rem_1fr] items-center gap-x-1 rounded-md px-1 py-[2px] text-left text-[12.5px] leading-[17px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-model/35 [@media(max-height:780px)]:py-0 ${
        gekozen ? 'bg-ink/[0.07]' : gewezen ? 'bg-fout/10' : 'hover:bg-ink/[0.04]'
      }`}
      style={gekozen ? { boxShadow: `inset 2px 0 0 ${INK}` } : undefined}
    >
      <Icoon staat={staat} />
      <span className={uit ? 'text-muted line-through' : 'text-ink'}>{rij.geslacht}</span>
      <span
        className={`text-right tabular-nums ${uit ? 'text-muted line-through' : ''}`}
        style={!uit && rij.lengte === null ? { color: FOUT, fontWeight: 700 } : undefined}
      >
        {lengteCel(rij.lengte)}
      </span>
      <span className={`text-right tabular-nums ${uit ? 'text-muted line-through' : 'text-ink'}`}>
        {rij.maat}
      </span>
      <span className="min-w-0 truncate text-[11.5px]" style={{ color: KLEUR[staat] }}>
        {WOORD[staat]}
      </span>
    </button>
  )
}

/* ----------------------------- helpers ----------------------------- */

function tel(rows: readonly DokterRow[]): Record<Geslacht, number> {
  let man = 0
  let vrouw = 0
  for (const r of rows) {
    if (r.geslacht === 'man') man++
    else vrouw++
  }
  return { man, vrouw }
}

/**
 * Wat er in een rij staat, in de volgorde van de CSV en zonder te
 * verklappen wat eraan mankeert. Eén woord per kolom, hetzelfde woord als
 * boven de tabel en langs de assen.
 */
function rijTekst(r: DokterRow): string {
  const l = r.lengte === null ? 'NA' : `${lengteCel(r.lengte)} cm`
  return `${r.geslacht} · ${l} · schoenmaat ${r.maat}`
}

/**
 * Staat deze rij in het VRIJE vlak, dus in wat de panelen overlaten? Een
 * punt achter een paneel telt als buiten beeld en krijgt een randmerk.
 */
function zichtbaar(r: DokterRow, s: Scales): boolean {
  if (r.lengte === null) return false
  const x = s.sx(r.maat)
  const y = s.sy(r.lengte)
  return x >= s.safe.left && x <= s.safe.right && y >= s.safe.top && y <= s.safe.bottom
}

/**
 * De rij die het dichtst bij de muis ligt. Dit vuurt alleen als de pointer
 * al binnen het trefvlak van een merk zit, dus wat hier het dichtst blijkt
 * te liggen is per definitie dichtbij.
 */
function dichtsteRij(e: { clientX: number; clientY: number }, s: Scales): number | null {
  const w = s.toWorld(e)
  const px = s.sx(w.x)
  const py = s.sy(w.y)
  let dichtst: number | null = null
  let best = Infinity
  for (const r of PLOTBAAR) {
    const d = Math.hypot(s.sx(r.maat) - px, s.sy(r.lengte as number) - py)
    if (d < best) {
      best = d
      dichtst = r.id
    }
  }
  return dichtst
}

type RandGroep = {
  /** Waar het merk staat, al binnen het vrije vlak geduwd. */
  x: number
  y: number
  /** Richting waarin de rijen liggen, niet genormaliseerd. */
  dx: number
  dy: number
  rijen: DokterRow[]
}

/**
 * De rijen die buiten het vrije vlak vallen, geklemd op de rand en
 * samengenomen als ze toch op dezelfde plek zouden landen. Zo staan de twee
 * lengtes in meter onder één driehoekje in plaats van als twee merken over
 * elkaar.
 */
function randGroepen(rijen: readonly DokterRow[], s: Scales): RandGroep[] {
  const los: RandGroep[] = []
  for (const r of rijen) {
    if (r.lengte === null || zichtbaar(r, s)) continue
    const px = s.sx(r.maat)
    const py = s.sy(r.lengte)
    const x = inVak(px, s.safe.left + RANDMARGE.left, s.safe.right - RANDMARGE.right)
    const y = inVak(py, s.safe.top + RANDMARGE.top, s.safe.bottom - RANDMARGE.bottom)
    los.push({ x, y, dx: px - x, dy: py - y, rijen: [r] })
  }
  los.sort((a, b) => a.x - b.x || a.y - b.y)

  const groepen: RandGroep[] = []
  for (const m of los) {
    const vorige = groepen[groepen.length - 1]
    if (
      vorige &&
      Math.abs(vorige.x - m.x) <= SAMEN.x &&
      Math.abs(vorige.y - m.y) <= SAMEN.y
    ) {
      vorige.rijen.push(m.rijen[0])
      const n = vorige.rijen.length
      vorige.x += (m.x - vorige.x) / n
      vorige.y += (m.y - vorige.y) / n
      vorige.dx += (m.dx - vorige.dx) / n
      vorige.dy += (m.dy - vorige.dy) / n
    } else {
      groepen.push({ ...m, rijen: [...m.rijen] })
    }
  }
  return groepen
}

/** clamp, maar op een bord dat te smal is voor het vak valt hij in het midden. */
function inVak(v: number, lo: number, hi: number): number {
  return lo >= hi ? (lo + hi) / 2 : clamp(v, lo, hi)
}

/**
 * Hoogstens één zin, en alleen zinnen die uit gemeten getallen volgen. Met
 * een schone werkset is elke echte rij die je weggooit aantoonbaar
 * verlies (nagerekend: 10 van de 10), maar zolang er rommel in zit bepaalt
 * die rommel de lijn. Daarom wordt de zin uit de cijfers afgeleid en niet
 * vooraf vastgelegd. Er staat nooit in wat er nog fout is.
 */
function advies({
  miss,
  terug,
  echtWeg,
  balans,
  perGroep,
}: {
  miss: number | null
  terug: number | null
  echtWeg: number
  balans: Record<Geslacht, number>
  perGroep: Record<Geslacht, number> | null
}): string | null {
  if (miss === null) return 'Te weinig rijen over. Het model kan niet trainen.'
  const scheef = scheveGroep(balans)
  if (scheef && perGroep) {
    const andere: Geslacht = scheef === 'man' ? 'vrouw' : 'man'
    const groep = scheef === 'man' ? 'mannen' : 'vrouwen'
    const rest = andere === 'man' ? 'mannen' : 'vrouwen'
    return `Je traint bijna alleen op ${groep}. Bij de ${rest} is de fout ${cm(perGroep[andere])} cm.`
  }
  if (terug !== null && terug < miss && cm(terug) !== cm(miss)) {
    const woord = echtWeg === 1 ? 'die rij' : 'die rijen'
    return `Zet ${woord} terug. Dan is de fout nog maar ${cm(terug)} cm.`
  }
  return null
}

/**
 * Welke groep het model overheerst, of null zolang het in evenwicht is.
 * Bewust streng: pas als er hoogstens één van de andere groep overblijft.
 * Anders overstemt deze zin de belangrijkere ("zet die rij terug"), en bij
 * twee of drie punten zegt hij vooral iets over het te kleine model.
 */
function scheveGroep(balans: Record<Geslacht, number>): Geslacht | null {
  const totaal = balans.man + balans.vrouw
  if (totaal < GENOEG) return null
  if (balans.vrouw <= SCHEEF) return 'man'
  if (balans.man <= SCHEEF) return 'vrouw'
  return null
}
