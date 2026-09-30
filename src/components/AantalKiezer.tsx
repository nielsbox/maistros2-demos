import type { ReactNode } from 'react'
import { AANTALLEN, type Aantal } from '../lib/kmeans'
import { NAVY } from '../lib/palette'
import { Sec } from './Overlay'

/* ------------------------------ de kiezer --------------------------- *
 * Vier knoppen, 2 tot 5: het bereik van Stap 6 (2129379). Op beide borden van
 * les 7 dezelfde, zodat het aantal kiezen er op beide hetzelfde uitziet.
 *
 * De gekozen knop is navy en niet blauw: blauw is op deze borden de kleur van
 * cluster 1, en een blauwe "4" zou lezen alsof die knop iets met de blauwe
 * cluster te maken heeft. Navy is de kleur van alle knoptekst op het bord, dus
 * de gekozen knop is gewoon een omgekeerde knop. De rand blijft ook bij de
 * gekozen knop staan, anders verspringt het raster een pixel bij elke keuze.
 *
 * `aantal` mag null zijn: op "Hoeveel clusters?" staat er eerst geen enkele
 * knop aan, want daar is nog niets geclusterd tot jij een aantal kiest.
 * `meta` komt rechts naast het kopje (de PyChip op dat bord). Zonder `meta`
 * is het kopje precies wat het op "K-means stap voor stap" altijd was.     */

export default function AantalKiezer({
  aantal,
  onKies,
  id = 'kmeans-aantal',
  meta,
}: {
  aantal: Aantal | null
  onKies: (k: Aantal) => void
  id?: string
  meta?: ReactNode
}) {
  return (
    <div>
      {meta === undefined ? (
        <div id={id} className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-ink/75">
          Aantal clusters
        </div>
      ) : (
        <Sec id={id} label="Aantal clusters" meta={meta} tone="ink" breek />
      )}
      <div role="group" aria-labelledby={id} className="mt-1.5 grid grid-cols-4 gap-1.5">
        {AANTALLEN.map((k) => {
          const aan = k === aantal
          return (
            <button
              key={k}
              type="button"
              onClick={() => onKies(k)}
              aria-pressed={aan}
              className={`h-8 rounded-full font-display text-[15px] font-extrabold tabular-nums transition ${
                aan ? 'bg-navy text-white' : 'bg-white text-navy hover:bg-navy/5'
              }`}
              style={{ boxShadow: `inset 0 0 0 1.5px ${aan ? NAVY : 'color-mix(in srgb, var(--color-navy) 22%, white)'}` }}
            >
              {k}
            </button>
          )
        })}
      </div>
    </div>
  )
}
