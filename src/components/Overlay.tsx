import { Children, useEffect, useRef, useState, type ReactNode } from 'react'
import { NAVY } from '../lib/palette'

/* ------------------------------------------------------------------ *
 * Floating overlays that sit on top of the board. Deliberately quiet:
 * thin borders, one accent colour, no decoration that competes with
 * the graph underneath.
 * ------------------------------------------------------------------ */

export function Panel({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={`panel rounded-xl ${className}`}>{children}</div>
}

/**
 * The width at which the Brief unfolds its DETAIL. It is Tailwind's `xl`, and
 * it has to stay Tailwind's `xl`, because that is the same breakpoint where the
 * side panels widen (`xl:w-[21rem]`, `xl:max-w-[22rem]`).
 *
 * The two used to disagree: the Brief opened at 1100 while the panels only grew
 * at 1280. In that 180 px band the Brief was expanded AND still narrow, so its
 * text wrapped over extra lines and its bottom edge ran into the control panel.
 * Measured on "Hoe goed past de lijn?": exactly one panel-on-panel overlap at
 * 1100, 1150, 1200, 1250 and 1279, and none at 900, 1024, 1280 or 1440.
 *
 * Written in rem and not in px on purpose: Tailwind emits `xl:` as
 * `@media (width >= 80rem)`, so a px query here would drift away from the
 * panels again on a browser whose default font size is not 16px. 80rem is
 * 1280 px at that default. Move this only together with every `xl:` on a panel.
 */
const WIDE = '(min-width: 80rem)'

/** Top-left: what this board is and what to do. Collapses to its title. */
export function Brief({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string
  title: string
  children?: ReactNode
}) {
  // On a beamer the panels crowd the board, so the DETAIL folds away. The
  // first line is the board's goal and must always be readable: at 1024x768
  // the old behaviour collapsed the whole Brief, so the one sentence saying
  // what the board is for was never shown on the screen it matters most.
  const [open, setOpen] = useState(
    () => typeof window === 'undefined' || window.matchMedia(WIDE).matches,
  )
  // Plugging a laptop into a beamer resizes the window, it does not reload the
  // page, so follow the query instead of only reading it once. A student who
  // folded the Brief by hand keeps that choice at every width.
  const manual = useRef(false)
  useEffect(() => {
    const mq = window.matchMedia(WIDE)
    const sync = () => {
      if (!manual.current) setOpen(mq.matches)
    }
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  const kids = Children.toArray(children)
  const doel = kids[0]
  const detail = kids.slice(1)
  return (
    <Panel className="pointer-events-auto absolute left-4 top-4 z-10 max-w-[16rem] px-4 py-3 xl:max-w-[22rem]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-ink/75">
            {eyebrow}
          </div>
          <h1 className="cf-display mt-0.5 text-[18px] leading-tight">{title}</h1>
        </div>
        {detail.length > 0 && (
          <button
            type="button"
            onClick={() => {
              manual.current = true
              setOpen((v) => !v)
            }}
            aria-label={open ? 'Uitleg inklappen' : 'Uitleg uitklappen'}
            className="-mr-1 -mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md text-[15px] leading-none text-muted transition hover:bg-model/8"
          >
            {open ? '−' : '+'}
          </button>
        )}
      </div>
      {doel && (
        <div className="mt-2 text-[14.5px] font-medium leading-relaxed text-ink">{doel}</div>
      )}
      {open && detail.length > 0 && (
        <div className="mt-2 space-y-2 text-[14px] leading-relaxed text-ink">{detail}</div>
      )}
    </Panel>
  )
}

/** One number that matters, shown large. */
export function Readout({
  label,
  value,
  unit,
  sub,
  color = NAVY,
}: {
  label: string
  value: string
  unit?: string
  sub?: string
  color?: string
}) {
  return (
    <div>
      <div className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-ink/75">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span
          className="cf-display text-[27px] leading-none tabular-nums transition-colors duration-200"
          style={{ color }}
        >
          {value}
        </span>
        {unit && (
          <span className="text-[12.5px] font-medium" style={{ color }}>
            {unit}
          </span>
        )}
      </div>
      {sub && <div className="mt-1 text-[13px] leading-snug text-ink/80">{sub}</div>}
    </div>
  )
}

export function Btn({
  onClick,
  children,
  variant = 'primary',
  disabled,
  full,
}: {
  onClick: () => void
  children: ReactNode
  variant?: 'primary' | 'ghost'
  disabled?: boolean
  full?: boolean
}) {
  // CodeFever buttons: pill, uppercase, weight 800, navy on lime.
  const look = variant === 'primary' ? 'cf-btn-primary' : 'cf-btn-ghost'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`cf-btn ${look} ${full ? 'w-full' : ''}`}
    >
      {children}
    </button>
  )
}

export function Check({
  checked,
  onChange,
  children,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  children: ReactNode
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-[13px] leading-snug text-ink">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-[2px] size-3.5 accent-model"
      />
      <span>{children}</span>
    </label>
  )
}

/** A numbered rail of steps; past steps stay clickable. */
export function Steps({
  steps,
  current,
  onSelect,
}: {
  steps: readonly string[]
  current: number
  onSelect?: (i: number) => void
}) {
  return (
    <ol className="space-y-0.5">
      {steps.map((s, i) => {
        const state = i === current ? 'now' : i < current ? 'past' : 'next'
        const clickable = onSelect && i <= current
        return (
          <li key={s}>
            <button
              type="button"
              disabled={!clickable}
              onClick={() => onSelect?.(i)}
              className={`flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-[13px] outline-none transition focus-visible:ring-2 focus-visible:ring-model/35 ${
                state === 'now'
                  ? 'font-semibold text-navy'
                  : state === 'past'
                    ? 'text-muted hover:bg-model/6'
                    : 'text-muted/55'
              } ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <span
                className={`flex size-[18px] shrink-0 items-center justify-center rounded-full text-[10.5px] font-semibold ${
                  state === 'now'
                    ? 'bg-model text-white'
                    : state === 'past'
                      ? 'bg-model/14 text-model'
                      : 'bg-black/[0.05] text-muted'
                }`}
              >
                {i + 1}
              </span>
              {s}
            </button>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * Een stukje Python zoals in de notebook. `tone="navy"` op een bord waar blauw
 * al iets betekent: op "Hoeveel clusters?" is blauw de eerste cluster, en een
 * blauwe `n_clusters=3` leest dan alsof hij bij die cluster hoort.
 */
export function PyChip({
  children,
  tone = 'model',
  klein = false,
}: {
  children: ReactNode
  tone?: 'model' | 'navy'
  /** 11 px in plaats van 12, voor een chip naast een lang kopje in een paneel
   *  van 16rem (zie `Sec`). */
  klein?: boolean
}) {
  const maat = klein ? 'text-[11px]' : 'text-[12px]'
  return (
    <code
      className={
        tone === 'navy'
          ? `rounded bg-navy/8 px-1.5 py-px font-mono ${maat} text-navy`
          : `rounded bg-model/10 px-1.5 py-px font-mono ${maat} text-model`
      }
    >
      {children}
    </code>
  )
}

/**
 * Kopje van een blok in het paneel, met eventueel een kort stukje rechts.
 * `tone="muted"` is het kopje van Regressie-lab, waar dit vandaan komt.
 * `tone="ink"` is het kopje van de andere borden (zoals Vaststelling en de
 * Brief), voor een bord dat dit kopje naast die kopjes zet.
 */
export function Sec({
  label,
  meta,
  id,
  tone = 'muted',
  breek = false,
}: {
  label: string
  meta?: ReactNode
  id?: string
  tone?: 'muted' | 'ink'
  /** Past het kopje niet naast `meta`, zet `meta` dan als geheel op een
   *  eigen regel, rechts, in plaats van het kopje over twee regels te breken.
   *  Gemeten op "Hoeveel clusters?" bij een paneel van 16rem: "AANTAL
   *  CLUSTERS" (116 px) plus `n_clusters=5` in 12 px (100 px) plus de
   *  tussenruimte is 224 px, in een rij van 222, en dan stond er "AANTAL" met
   *  daaronder "CLUSTERS". Dat bord zet de chip nu in 11 px (`klein`), zodat
   *  hij ernaast past; deze regel is het vangnet als een ander lettertype
   *  toch breder uitvalt. */
  breek?: boolean
}) {
  const kop =
    tone === 'ink'
      ? 'text-[11.5px] font-bold uppercase tracking-[0.09em] text-ink/75'
      : 'text-[11px] font-semibold uppercase tracking-[0.11em] text-muted'
  return (
    <div
      className={
        breek
          ? 'flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1'
          : 'flex items-baseline justify-between gap-2'
      }
    >
      <span id={id} className={breek ? `${kop} whitespace-nowrap` : kop}>
        {label}
      </span>
      {meta && (
        /* Twee VOLLEDIGE klassenlijsten, geen `text-muted/80${...}`. Tailwind
           zoekt klassen als losse woorden in de broncode, en "text-muted/80"
           plakte daar aan `${`: dan kwam de klasse niet in de css, en werd het
           cijfer van Regressie-lab ("24 punten") inktkleur in plaats van grijs.
           Gevonden met een pixelvergelijking tegen de versie van voor deze
           verhuizing. */
        <span
          className={
            breek
              ? 'ml-auto text-[11.5px] leading-none text-muted/80'
              : 'text-[11.5px] leading-none text-muted/80'
          }
        >
          {meta}
        </span>
      )}
    </div>
  )
}

/**
 * Eén keuze uit de kiezer van de data set. De rand blijft staan als hij actief
 * is, anders verspringt het raster een pixel bij elke wissel.
 * `tone="navy"` op een bord waar blauw een cluster is (les 7): een blauwe
 * actieve knop zou lezen alsof hij bij de blauwe cluster hoort.
 */
export function SegBtn({
  active,
  onClick,
  label,
  tone = 'model',
}: {
  active: boolean
  onClick: () => void
  label: string
  tone?: 'model' | 'navy'
}) {
  const kleur =
    tone === 'navy'
      ? active
        ? 'border-navy bg-navy text-white'
        : 'border-navy/20 text-navy hover:bg-navy/5'
      : active
        ? 'border-model bg-model text-white'
        : 'border-model/20 text-model hover:bg-model/6'
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-lg border px-2 py-1.5 text-[12.5px] font-semibold transition ${kleur}`}
    >
      {label}
    </button>
  )
}

const TONES = {
  info: 'bg-derde/8 text-navy',
  win: 'bg-emerald-50 text-emerald-900',
  warn: 'bg-amber-50 text-amber-900',
  err: 'bg-rose-50 text-rose-900',
} as const

export function Note({
  tone = 'info',
  children,
}: {
  tone?: keyof typeof TONES
  children: ReactNode
}) {
  return (
    <div className={`rounded-lg px-3 py-2 text-[13.5px] leading-relaxed ${TONES[tone]}`}>
      {children}
    </div>
  )
}

/** The real Python error les 2 runs into, verbatim in shape. */
export function Traceback({ lines }: { lines: string[] }) {
  return (
    <pre className="overflow-hidden whitespace-pre-wrap break-words rounded-lg bg-navy px-3 py-2.5 font-mono text-[12px] leading-relaxed text-rose-100">
      {lines.map((l, i) => (
        <div key={i} className={i === lines.length - 1 ? 'font-semibold text-rose-300' : 'opacity-70'}>
          {l}
        </div>
      ))}
    </pre>
  )
}

/** Tiny colour key for the marks on the board. */
export function Legend({ items }: { items: { color: string; label: string; ring?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5 text-[12.5px] text-ink/75">
          <span
            className="inline-block size-2.5 rounded-full"
            style={
              it.ring
                ? { border: `2px solid ${it.color}`, background: '#fff' }
                : { background: it.color }
            }
          />
          {it.label}
        </li>
      ))}
    </ul>
  )
}

export function Divider() {
  return <div className="my-2.5 h-px bg-black/[0.07]" />
}
