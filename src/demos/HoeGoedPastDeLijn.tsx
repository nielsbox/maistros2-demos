import { useMemo, useState } from 'react'
import Canvas, { Dots, DragDot, LineShape, Residuals, type View } from '../components/Canvas'
import { Brief, Btn, Divider, Note, Panel, PyChip, Readout } from '../components/Overlay'
import { bestFit, clamp, r2, scoreLabel, seeded, type Line, type Point } from '../lib/regression'
import { MODEL } from '../lib/palette'

/* ------------------------------------------------------------------ *
 * Les 1: wat regr.score() eigenlijk zegt.
 *
 * De lijn draait altijd om het midden van de data, en de student regelt
 * alleen de helling. Daardoor is een platte lijn letterlijk "altijd het
 * gemiddelde gokken" en leest de score daar exact 0.00. Steiler of de
 * verkeerde kant op duwt de score onder nul, net zoals bij het model dat ze
 * in les 2 op de mannelijke rijen trainen.
 * ------------------------------------------------------------------ */

const DEFAULT_VIEW: View = { x0: 0, x1: 11, y0: 0, y1: 110 }

const POINTS: Point[] = (() => {
  const rnd = seeded(13)
  const pts: Point[] = []
  for (let x = 1; x <= 10; x++) pts.push({ x, y: 6.5 * x + 20 + (rnd() - 0.5) * 34 })
  return pts
})()

/** Het draaipunt: het midden van de puntenwolk. */
const CX = POINTS.reduce((s, p) => s + p.x, 0) / POINTS.length
const CY = POINTS.reduce((s, p) => s + p.y, 0) / POINTS.length

const FIT = bestFit(POINTS)
const MEAN_LINE: Line = { a: 0, b: CY }

const SLOPE_MIN = -1.4 * FIT.a
const SLOPE_MAX = 2.6 * FIT.a

/** x van de sleepgreep: rechts van het midden, maar zo dat hij bij elke
 *  toegestane helling nog binnen het startbeeld valt. */
const HANDLE_X = 8
const HANDLE_Y_MIN = CY + SLOPE_MIN * (HANDLE_X - CX)
const HANDLE_Y_MAX = CY + SLOPE_MAX * (HANDLE_X - CX)

/* De streepjeslijn "altijd het gemiddelde" is geen merk maar een ijkpunt: ze
 * moet duidelijk ACHTER de lijn van het model liggen. Daarom staan deze twee
 * grijzen bewust lichter dan --color-muted, en horen ze niet in het palet. */
const GEMIDDELDE = '#9b98a8'
const GEMIDDELDE_TEKST = '#8b8797'

export default function HoeGoedPastDeLijn() {
  // Niet op de platte lijn starten: die valt exact samen met de streepjeslijn,
  // en dan lijkt het bij het openen alsof er maar één lijn op het bord staat.
  const [slope, setSlope] = useState(FIT.a * 0.4)

  const line: Line = useMemo(() => ({ a: slope, b: CY - slope * CX }), [slope])
  const score = r2(POINTS, line)
  const badge = scoreLabel(score)

  return (
    <div className="relative h-full w-full">
      <Canvas
        defaultView={DEFAULT_VIEW}
        xLabel="x"
        yLabel="y"
      >
        {(s) => (
          <>
            {/* De referentie waar de score tegen afgemeten wordt. Staat er altijd. */}
            <LineShape line={MEAN_LINE} scales={s} color={GEMIDDELDE} width={1.75} dashed />
            <text
              x={s.safe.left + 12}
              y={s.sy(CY) - 9}
              fontSize={11}
              fontWeight={500}
              fill={GEMIDDELDE_TEKST}
              pointerEvents="none"
            >
              altijd het gemiddelde
            </text>

            {/* Zonder deze streepjes verandert er alleen een getal. */}
            <Residuals points={POINTS} line={line} scales={s} opacity={0.5} />
            <LineShape line={line} scales={s} color={MODEL} />
            <Dots points={POINTS} scales={s} />

            <DragDot
              point={{ x: HANDLE_X, y: line.a * HANDLE_X + line.b }}
              scales={s}
              color={MODEL}
              r={6}
              cursor="ns-resize"
              ariaLabel="handvat: kantel de lijn"
              bounds={{ x: [HANDLE_X, HANDLE_X], y: [HANDLE_Y_MIN, HANDLE_Y_MAX] }}
              onMove={(p) =>
                setSlope(clamp((p.y - CY) / (HANDLE_X - CX), SLOPE_MIN, SLOPE_MAX))
              }
            />
          </>
        )}
      </Canvas>

      {/*
        De eerste alinea is het DOEL van dit bord. Brief toont die altijd en
        klapt alleen alles daarna in, dus op een beamer is dit de enige zin
        die een leerling gegarandeerd leest. Een leerling die hier vanaf een
        slide binnenvalt, ziet de portaalkaart nooit: staat het doel niet op
        het bord, dan staat het nergens.
      */}
      <Brief eyebrow="mAIstros 2 - les 1" title="Hoe goed past de lijn?">
        <p>De score zegt hoe goed je lijn bij de punten past.</p>
        <p>
          Kantel de lijn met de schuifknop of sleep het handvat. Kijk wat de score doet.
        </p>
        {/*
          De grijze streepjeslijn stond hier ook nog eens uitgelegd. Die
          uitleg staat al twee keer op het scherm: het bord zet het label
          "altijd het gemiddelde" naast de lijn zelf, en het blokje uitleg
          onderaan vergelijkt jouw lijn ermee. Uitgeklapt maakte die derde
          plek de Brief zo hoog dat het scorepaneel er een stuk van afdekte:
          22 px op 1366x768, 93 px op 1100x700. Nu is deze Brief net als de
          andere borden één doelzin plus één instructie.
        */}
      </Brief>

      {/*
        Even hoog begrensd als op de twee andere borden. Zonder die grens was
        dit paneel 657 px hoog, en op 900x700 schoof het over de Brief heen:
        de enige zin die zegt waar dit bord voor dient stond dan volledig
        onder glas. 12rem laat de Brief altijd vrij, ook ingeklapt.
      */}
      <Panel className="pointer-events-auto absolute bottom-4 left-4 z-10 max-h-[calc(100%-12rem)] w-[16rem] overflow-y-auto px-4 py-3.5 xl:w-[21rem]">
        <Readout label="Score" value={score.toFixed(2).replace('.', ',')} sub={badge.label} color={badge.color} />

        <Divider />

        <input
          type="range"
          min={SLOPE_MIN}
          max={SLOPE_MAX}
          step={0.05}
          value={slope}
          onChange={(e) => setSlope(parseFloat(e.target.value))}
          className="w-full"
          aria-label="helling van de lijn"
        />
        <div className="flex justify-between text-[11px] text-muted">
          <span>verkeerde kant op</span>
          <span>te steil</span>
        </div>

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <Btn variant="ghost" onClick={() => setSlope(FIT.a)}>
            Beste lijn
          </Btn>
          <Btn variant="ghost" onClick={() => setSlope(0)}>
            Altijd het gemiddelde
          </Btn>
          <Btn variant="ghost" onClick={() => setSlope(-FIT.a)}>
            Slechter dan het gemiddelde
          </Btn>
        </div>

        <Divider />

        <Note>
          <p>De score vergelijkt jouw lijn met altijd het gemiddelde raden.</p>
          <ul className="mt-1.5 space-y-0.5">
            <li>1,00: je lijn gaat door elk punt.</li>
            <li>0,00: je lijn is even goed als altijd het gemiddelde raden.</li>
            <li>onder 0: je lijn maakt meer fout dan altijd het gemiddelde raden.</li>
          </ul>
          <p className="mt-1.5">
            Een score onder nul kan echt gebeuren met een model dat je zelf traint. Dan had je beter
            gewoon het gemiddelde geraden.
          </p>
        </Note>

        <div className="mt-2 text-[11.5px] leading-relaxed text-muted">
          In je notebook: <PyChip>regr.score(x, y)</PyChip>
        </div>
      </Panel>
    </div>
  )
}
