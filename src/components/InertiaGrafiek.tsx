import { useEffect, useRef, useState } from 'react'
import { getal } from './Vaststelling'
import { DATA, INK, MODEL, MUTED, RULE } from '../lib/palette'

/* ------------------------------------------------------------------ *
 * De grafiek van les 8: de inertia per aantal clusters, zoals
 * `visualiseer_inertia()` op 2130678 ze tekent ("Aantal clusters" op de
 * x-as, "Inertia" op de y-as), maar punt voor punt, telkens als de leerling
 * 1 cluster meer vraagt.
 *
 *   - x: 1 tot `max`, met hun getal.
 *   - y: van 0 tot de inertia bij 1 cluster, ZONDER getallen. Wat telt, is
 *     hoe ver een stap zakt tegen de vorige, niet de waarde zelf; die staat
 *     in het paneel.
 *   - Elk bereikt aantal is een navy rondje, verbonden door een lijn.
 *   - Het getoonde aantal krijgt een ring, en de trede ernaartoe: verticaal,
 *     in de kleur van het model, 2 px, van de hoogte van het vorige aantal tot
 *     dit. Een dunne grijze stippellijn verbindt het vorige rondje met de top
 *     van die trede, zodat je ziet waar hij begint. Dat is wat "hoeveel 1
 *     cluster meer scheelde" op het scherm IS.
 *   - Elk bereikt rondje is een knop: het bord toont dan dat aantal. Ook met
 *     het toetsenbord. Raakvlak met straal 12 px; in het smalste paneel
 *     (15rem) liggen de rondjes 25 px uit elkaar, dus twee raakvlakken
 *     overlappen niet. De tweede klik van een dubbelklik houdt het bord
 *     tegen, in de capture-fase rond deze grafiek (zie tweedeKlik.ts), net
 *     als in het paneel met de knoppen.
 *
 * Getekend in pixels, niet met een geschaalde viewBox: anders krimpt de tekst
 * mee met het paneel (15rem onder 1280 px, 19rem erboven).
 * ------------------------------------------------------------------ */

function useBreedte<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

const MARGE = { links: 10, rechts: 6, boven: 32, onder: 40 }
const HIT = 12

export default function InertiaGrafiek({
  inertias,
  bereikt,
  k,
  onKies,
}: {
  /** De inertia bij 1, 2, ... clusters. Bepaalt ook hoeveel aantallen de x-as telt. */
  inertias: readonly number[]
  /** Tot welk aantal de leerling al kwam: zoveel rondjes staan er. */
  bereikt: number
  /** Het aantal dat het bord nu toont. */
  k: number
  onKies: (k: number) => void
}) {
  const [ref, W] = useBreedte<HTMLDivElement>()
  const max = inertias.length
  const H = Math.round(W * 0.78)
  const pw = W - MARGE.links - MARGE.rechts
  const ph = H - MARGE.boven - MARGE.onder
  /* Elk aantal in het midden van zijn eigen vak, zodat 1 niet op de y-as
     staat en 8 niet tegen de rand. */
  const X = (j: number) => MARGE.links + ((j - 0.5) / max) * pw
  const Y = (v: number) => MARGE.boven + (1 - v / inertias[0]) * ph
  const y0 = MARGE.boven + ph

  const zichtbaar = inertias.slice(0, bereikt)
  return (
    <div ref={ref} className="w-full">
      {W > 0 && (
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          role="group"
          aria-label="Grafiek: de inertia per aantal clusters"
          className="block overflow-visible"
        >
          {/* De assen. */}
          <line x1={MARGE.links} y1={MARGE.boven - 6} x2={MARGE.links} y2={y0} stroke={MUTED} strokeOpacity={0.55} strokeWidth={1.25} />
          <line x1={MARGE.links} y1={y0} x2={W - MARGE.rechts} y2={y0} stroke={MUTED} strokeOpacity={0.55} strokeWidth={1.25} />
          {inertias.map((_, i) => (
            <g key={i}>
              <line x1={X(i + 1)} y1={y0} x2={X(i + 1)} y2={y0 + 4} stroke={MUTED} strokeOpacity={0.55} strokeWidth={1.25} />
              <line x1={X(i + 1)} y1={MARGE.boven} x2={X(i + 1)} y2={y0} stroke={RULE} strokeWidth={1} />
              <text x={X(i + 1)} y={y0 + 17} textAnchor="middle" fontSize={12.5} fontWeight={700} fill={MUTED}>
                {i + 1}
              </text>
            </g>
          ))}
          <text x={MARGE.links + pw / 2} y={H - 4} textAnchor="middle" fontSize={13} fontWeight={700} fill={INK}>
            aantal clusters
          </text>
          <text x={MARGE.links + 2} y={MARGE.boven - 13} textAnchor="start" fontSize={13} fontWeight={700} fill={INK}>
            inertia
          </text>

          {/* De lijn door de bereikte aantallen. */}
          {zichtbaar.length > 1 && (
            <polyline
              points={zichtbaar.map((v, i) => `${X(i + 1)},${Y(v)}`).join(' ')}
              fill="none"
              stroke={DATA}
              strokeWidth={1.5}
              strokeLinejoin="round"
            />
          )}

          {/* De trede naar het getoonde aantal. */}
          {k >= 2 && k <= bereikt && (
            <g data-trede={k} pointerEvents="none">
              <line
                x1={X(k - 1)}
                y1={Y(inertias[k - 2])}
                x2={X(k)}
                y2={Y(inertias[k - 2])}
                stroke={MUTED}
                strokeWidth={1}
                strokeDasharray="2 3"
              />
              <line
                x1={X(k)}
                y1={Y(inertias[k - 2])}
                x2={X(k)}
                y2={Y(inertias[k - 1])}
                stroke={MODEL}
                strokeWidth={2}
                strokeLinecap="round"
              />
            </g>
          )}

          {/* De rondjes. Elk is een knop. */}
          {zichtbaar.map((v, i) => {
            const j = i + 1
            const nu = j === k
            return (
              <g
                key={j}
                data-grafiekpunt={j}
                role="button"
                tabIndex={0}
                aria-label={`${j} ${j === 1 ? 'cluster' : 'clusters'}, inertia ${getal(v, 2)}`}
                aria-pressed={nu}
                className="group cursor-pointer outline-none"
                onClick={() => onKies(j)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' && e.key !== ' ') return
                  e.preventDefault()
                  onKies(j)
                }}
              >
                <circle cx={X(j)} cy={Y(v)} r={HIT} fill="transparent" />
                <circle
                  cx={X(j)}
                  cy={Y(v)}
                  r={10}
                  fill="none"
                  stroke={INK}
                  strokeWidth={1.5}
                  className="opacity-0 transition-opacity group-hover:opacity-30 group-focus-visible:opacity-70"
                />
                {nu && <circle cx={X(j)} cy={Y(v)} r={7} fill="#fff" stroke={MODEL} strokeWidth={2} />}
                <circle cx={X(j)} cy={Y(v)} r={4} fill={DATA} />
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}
