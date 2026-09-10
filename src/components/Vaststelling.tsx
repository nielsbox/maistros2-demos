import { MUTED, NAVY } from '../lib/palette'

/* ------------------------------------------------------------------ *
 * De vaststelling: één regel die zegt wat de leerling NU waar gemaakt
 * heeft. "1 van de 30 mijnen gemist." Niets meer.
 *
 * Waarom dit een eigen component is en geen tweede Readout:
 *
 * 1. Het getal komt uit de toestand van het bord, nooit uit de tekst.
 *    Een hardgecodeerd getal in een zin is de fout die dit project al een
 *    keer gemaakt heeft ("weggooien maakt het slechter", terwijl één rij
 *    weggooien het in 15 van de 31 gevallen beter maakte). Daarom neemt dit
 *    component alleen al berekende waarden aan: het rekent zelf niets uit en
 *    weet niets over regressie of bomen. Wat er staat, staat er omdat het
 *    bord het gemeten heeft.
 *
 * 2. Nederlandse getallen op één plaats. `11.288` leest een Nederlandstalige
 *    als elf-komma-iets, en daardoor leek een totale fout ooit te STIJGEN
 *    terwijl ze daalde. Vier borden hadden hun eigen `.replace('.', ',')`,
 *    en niet alle vier deden de duizendtallen en de "-0,00" van toFixed.
 *    `getal()` hieronder is de enige versie; roep die aan, schrijf geen vijfde.
 *
 * 3. Het geeft geen oordeel. De scorelabels gaven ooit groen, oranje en rood
 *    terug: dat zakte door de kleurenblindheidscheck (rood tegen groen haalt
 *    het nooit) en het velde het oordeel dat de leerling zelf moest lezen.
 *    Een vaststelling beschrijft wat er is. Ze prijst niet en ze straft niet.
 *
 * Het is geen paneel. Zet het IN het paneel dat je bord altijd al toont, want
 * een paneel dat pas opduikt na een klik herkadert het bord midden in een
 * beweging (gemeten: 1,45x op 1024 px). Is er nog niets gemeten, geef dan
 * `value={null}` en zeg met `empty` waarom - het bord toont dan lege assen en
 * dit blok zegt dat er nog niets te zien is.
 * ------------------------------------------------------------------ */

/** Harde spatie, als escape. Een gewone spatie kan over twee regels breken,
 *  en dan staat "11 288" als "11" op de ene en "288" op de volgende regel. */
export const NBSP = '\u00a0'

/**
 * Eén getal, Nederlands opgeschreven: komma als decimaalteken, harde spatie
 * bij de duizendtallen.
 *
 * Dit is de enige getalopmaak die een bord mag gebruiken. `decimals` staat op
 * 0, want een teller ("1 van de 30") is het gewone geval.
 *
 * Details die de losse varianten misten:
 * - er wordt eerst afgerond en dan pas naar het teken gekeken, dus een piep-
 *   klein negatief getal wordt "0,00" en niet "-0,00";
 * - een oneindig getal of NaN wordt "-", zodat een bord nooit "NaN" projecteert.
 */
export function getal(v: number, decimals = 0): string {
  if (!Number.isFinite(v)) return '-'
  const d = Math.max(0, Math.min(6, Math.trunc(decimals)))
  const afgerond = Number(v.toFixed(d))
  const negatief = afgerond < 0
  const [heel, deel] = Math.abs(afgerond).toFixed(d).split('.')
  const groepen = heel.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP)
  return (negatief ? '-' : '') + groepen + (deel ? `,${deel}` : '')
}

/** Enkelvoud of meervoud bij een teller: `meervoud(n, 'mijn', 'mijnen')`. */
export function meervoud(n: number, ev: string, mv: string): string {
  return Math.abs(n) === 1 ? ev : mv
}

export type VaststellingProps = {
  /** Wat er geteld wordt, in twee of drie woorden. Geen zin, geen werkwoord. */
  label: string
  /** Het getal dat de leerling net veranderd heeft. `null` = nog niets gemeten. */
  value: number | null
  /** Decimalen voor `value`. Standaard 0: een teller is het gewone geval. */
  decimals?: number
  /** Woord tegen het getal aan: 'cm', '%', of `meervoud(n, 'mijn', 'mijnen')`. */
  unit?: string
  /** Waar het getal er een van is. Wordt "van de 30 mijnen". */
  outOf?: { total: number; noun: string }
  /** Eén regel die zegt wat er nu waar is. Beschrijft, prijst niet, straft niet. */
  detail?: string
  /** Staat er IN PLAATS VAN het getal zolang `value` null is: waarom er nog geen is. */
  empty?: string
  /** Alleen een token uit src/lib/palette.ts. Nooit een hex van het bord zelf. */
  color?: string
}

export default function Vaststelling({
  label,
  value,
  decimals = 0,
  unit,
  outOf,
  detail,
  empty = 'Nog niets gemeten.',
  color = NAVY,
}: VaststellingProps) {
  if (import.meta.env.DEV) keurTekst({ label, unit, detail, empty })

  const leeg = value === null
  const staat = leeg ? '-' : getal(value, decimals)

  return (
    /* HET KOPJE HEEFT LUCHT BOVEN ZICH NODIG, en die stond hier niet: dit component
       had geen eigen marge, dus de afstand was per bord toevallig wat er boven
       stond. Gemeten over alle acht de borden liep die van 0 tot 23 px, en op
       /les3/van-getal-naar-kans plakte "ZEKERHEID" met 0 px tegen de regel erboven
       terwijl "DE 96 RIJEN" in hetzelfde paneel 10 px had. 20 px (mt-5) is de
       waarde die de meeste borden al hadden (21 px op data-dokter, waar-leg-jij-de-
       grens en het regressie-lab), dus dit trekt de uitzonderingen recht in plaats
       van iedereen te verzetten.
       `first:mt-0` omdat dit blok op sommige borden het EERSTE in het paneel is
       (WaarLegJijDeGrens); daar zou een marge het paneel vanboven laten uitzakken. */
    <div className="mt-5 first:mt-0">
      <div className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-ink/75">{label}</div>

      {/*
        Het getal is het enige dat verandert, dus het is ook het enige dat
        groot staat: 30 px tegen 13,5 voor de woorden eromheen. `tabular-nums`
        houdt de cijfers even breed, zodat een teller die van 9 naar 10 gaat
        niet zichtbaar verschuift. `flex-wrap` is er voor het smalste paneel
        (16 rem): daar zakt "van de 30 mijnen" netjes onder het getal in plaats
        van de regel uit het paneel te duwen.
      */}
      <div className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5">
        <span
          className="cf-display text-[30px] leading-none tabular-nums transition-colors duration-200"
          style={{ color: leeg ? MUTED : color }}
        >
          {staat}
        </span>
        {!leeg && unit && (
          <span className="text-[13.5px] font-semibold" style={{ color }}>
            {unit}
          </span>
        )}
        {!leeg && outOf && (
          <span className="text-[13.5px] font-medium text-ink/80">
            van de {getal(outOf.total)} {outOf.noun}
          </span>
        )}
      </div>

      {/* Leeg bord: geen getal, wel een reden. Anders leest een streepje als
          een bord dat stuk is. */}
      {leeg ? (
        <p className="mt-1.5 text-[13px] leading-snug text-ink/80">{empty}</p>
      ) : (
        detail && <p className="mt-1.5 text-[13px] leading-snug text-ink/80">{detail}</p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Een controle in dev, geen opmaak.
 *
 * Twee dingen zijn hier eerder echt fout gegaan en beide zijn goedkoop te
 * betrappen: een emoji op een leerlingenbord, en een woord dat een oordeel
 * geeft in plaats van te beschrijven. De controle draait alleen in dev en
 * schreeuwt in de console; in de klas blijft het bord gewoon draaien, want
 * een leeg scherm helpt daar niemand.
 * ------------------------------------------------------------------ */

const EMOJI = /\p{Extended_Pictographic}/u

/** Woorden die een oordeel geven. Ze zeggen niets wat een leerling van het
 *  bord kan aflezen, en dat is precies het bezwaar: "matig" is geen
 *  vaststelling. `fout` staat er bewust NIET in - dat is in dit project de
 *  huisnaam voor hoever het model ernaast zit, en dus een meetbaar getal. */
const OORDEEL = [
  'perfect',
  'uitstekend',
  'geweldig',
  'prima',
  'bravo',
  'knap',
  'goed gedaan',
  'heel goed',
  'goed bezig',
  'slecht',
  'zwak',
  'matig',
  'jammer',
  'helaas',
  'top',
  'super',
]

function keurTekst(velden: Record<string, string | undefined>) {
  for (const [naam, tekst] of Object.entries(velden)) {
    if (!tekst) continue
    if (EMOJI.test(tekst)) {
      console.error(`Vaststelling: emoji in "${naam}". Geen emoji op een bord: ${tekst}`)
    }
    const laag = ` ${tekst.toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, ' ')} `
    const gevonden = OORDEEL.filter((w) => laag.includes(` ${w} `))
    if (gevonden.length > 0) {
      console.error(
        `Vaststelling: "${naam}" geeft een oordeel (${gevonden.join(', ')}). ` +
          `Beschrijf wat er is, prijs niet en straf niet: ${tekst}`,
      )
    }
  }
}
