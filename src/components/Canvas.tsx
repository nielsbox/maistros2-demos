import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { clamp, type Line, type Point } from '../lib/regression'
import { DATA, FOUT, FOUT_INK, INK, MODEL } from '../lib/palette'

/* ------------------------------------------------------------------ *
 * A pannable / zoomable 2D board - the shared primitive for every
 * graph in these demos. Drag the background to pan, wheel or pinch to
 * zoom (around the cursor), "Alles" to frame the data again. Axes keep a
 * fixed gutter so the tick labels stay readable at any zoom, while the
 * grid itself moves with the view.
 * ------------------------------------------------------------------ */

export type View = { x0: number; x1: number; y0: number; y1: number }

export type Scales = {
  sx: (x: number) => number
  sy: (y: number) => number
  ix: (px: number) => number
  iy: (py: number) => number
  toWorld: (e: { clientX: number; clientY: number }) => Point
  /** Current visible world window - useful for clipping labels. */
  view: View
  /** World units per pixel, per axis. Lets marks stay a constant size. */
  unitPerPx: { x: number; y: number }
  area: { left: number; top: number; right: number; bottom: number; w: number; h: number }
  /** The part of the board the overlays leave free. Put any label inside this. */
  safe: { left: number; top: number; right: number; bottom: number }
}

export type FitOpts = { padFrac?: number; includeY0?: boolean }

export type CanvasApi = {
  setView: (v: View) => void
  fit: (points: Point[], opts?: FitOpts) => void
  reset: () => void
  /** Zoom about the middle of the board. Below 1 zooms in, above 1 zooms out. */
  zoomBy: (factor: number) => void
}

const PAD = { top: 26, right: 26, bottom: 42, left: 58 }
/** Width reserved for the left control rail. The plot starts to the RIGHT of it,
 *  so the rail can never sit on top of the y tick labels the way the old
 *  bottom-right cluster sat on top of the x tick labels. */
const RAIL_W = 48
const MIN_SPAN = 1e-6
const MAX_SPAN = 1e9

/**
 * De getallen langs de assen. Elk bord leest van achter in de klas mee, en de
 * huisvloer voor tekst op het bord is 13 px, vet, met een witte rand eromheen.
 * Deze getallen stonden op 12,5 px met gewicht 600 en een rand van 3 px: onder
 * de vloer, op elk bord dat assen laat zien. Op "Van getal naar kans" waren dat
 * twintig getallen op 1024x768.
 *
 * WAAROM 13 EN NIET 13,5. De twee asnamen staan op 13,5 px, vet, in de
 * inktkleur. Zetten we deze getallen ook op 13,5, dan is de naam van de as niet
 * meer groter dan de getallen erlangs en valt de rangorde weg. 13 haalt de
 * vloer en houdt het verschil. Het is bovendien de kleinste stap, en dus de
 * kleinste kans dat een breder getal tegen zijn buur of tegen een paneel loopt.
 * Gemeten na de wijziging op alle negen borden, op 1024x768 en 900x700: geen
 * enkel paar asgetallen raakt elkaar, en geen merk of label ligt onder een
 * paneel. De ruimte tussen twee asgetallen komt uit `ticks()` hieronder en is
 * ongeveer 120 px in x en 90 px in y, dus een half punt breder getal past er
 * ruim in.
 */
const TICK_PX = 13

/**
 * How much of an axis the two floating panels may claim between them. What is
 * left over is the free band the data is framed into, so this is also the
 * promise "the data keeps at least a third of each axis".
 *
 * Measured, not picked: on a 900 px wide beamer Data-dokter's two panels ask
 * for 288 + 316 = 604 px. At 0.6 that was cut back to 540, which slid the free
 * band 17 px UNDER the right panel and put the last x tick label and the
 * "schoenmaat" axis label behind glass. At 0.66 the same pair is cut back to
 * 594 - 283 left and 311 right - so the band stops 11 px short of the panel
 * and the board still keeps 306 px of free width. Never widen a panel without
 * redoing this sum.
 */
const KEEP = 0.66

/** A padded view that frames the given points. */
export function fitView(
  points: Point[],
  opts: { padFrac?: number; includeY0?: boolean } = {},
): View | null {
  if (points.length === 0) return null
  const { padFrac = 0.09, includeY0 = false } = opts
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  let xmin = Math.min(...xs),
    xmax = Math.max(...xs)
  let ymin = Math.min(...ys),
    ymax = Math.max(...ys)
  if (includeY0) ymin = Math.min(0, ymin)
  const xspan = xmax - xmin || Math.abs(xmax) * 0.2 || 1
  const yspan = ymax - ymin || Math.abs(ymax) * 0.2 || 1
  return {
    x0: xmin - xspan * padFrac,
    x1: xmax + xspan * padFrac,
    y0: ymin - yspan * padFrac,
    y1: ymax + yspan * padFrac,
  }
}

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize({ w: Math.round(width), h: Math.round(height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, size] as const
}

export default function Canvas({
  defaultView,
  xLabel,
  yLabel,
  children,
  apiRef,
  controls = true,
  pad = PAD,
  onViewChange,
  insets,
  onBoardClick,
  axes = true,
}: {
  defaultView: View
  xLabel?: string
  yLabel?: string
  /**
   * De astekst: de getallen langs de assen en de twee asnamen. Standaard aan,
   * want elk bord met een grafiek heeft ze nodig.
   *
   * Uit voor een bord waar de coördinaten niets betekenen. Op "Kijk in de
   * q-tabel" is het vlak een raster van 4 bij 12 vakjes met namen, en dan
   * zegt "2 4 6 8 10 12" langs de onderrand een leerling niets - het waren
   * bovendien net die getallen die op 900x700 tegen de zoomknoppen aanliepen.
   * De rasterlijnen, het pannen, het zoomen en het kaderen blijven zoals ze
   * zijn: dit zet alleen de tekst uit.
   */
  axes?: boolean
  children: (s: Scales) => ReactNode
  /**
   * Fires when the student CLICKS empty board rather than dragging it, so a
   * simulator can let them place their own data points. A drag still pans.
   */
  onBoardClick?: (world: Point) => void
  /** Gives the demo programmatic control: apiRef.current?.fit(points) */
  apiRef?: { current: CanvasApi | null }
  controls?: boolean
  pad?: typeof PAD
  onViewChange?: (v: View) => void
  /**
   * Screen space the floating overlay panels cover, in pixels per side. The
   * opening view and fit() frame the data into what is left over, so a panel
   * never ends up parked on top of the points.
   */
  insets?: { top?: number; right?: number; bottom?: number; left?: number }
}) {
  const [wrapRef, { w, h }] = useSize<HTMLDivElement>()
  const svgRef = useRef<SVGSVGElement>(null)
  const [panning, setPanning] = useState(false)

  const railW = controls ? RAIL_W : 0

  /**
   * Measure the floating panels that sit next to this board and reserve the
   * space they cover, so the opening view frames the data into what is left at
   * ANY screen size. An explicit `insets` prop overrides the measurement.
   */
  const [autoIns, setAutoIns] = useState({ top: 0, right: 0, bottom: 48, left: 0 })
  useEffect(() => {
    if (insets) return
    const el = wrapRef.current
    const parent = el?.parentElement
    if (!el || !parent) return
    const measure = () => {
      const box = el.getBoundingClientRect()
      if (!box.width) return
      const mid = box.left + box.width / 2
      let left = 0
      let right = 0
      // Every overlay panel anywhere beside the board counts, however the demo
      // nests it. Only this board's own controls are skipped, because they live
      // INSIDE the wrapper. `:scope > .panel` used to be the rule and it missed
      // a panel a demo had wrapped in a positioning div, so the axis labels were
      // drawn underneath it.
      parent.querySelectorAll('.panel').forEach((node) => {
        if (el.contains(node)) return
        const q = (node as HTMLElement).getBoundingClientRect()
        if (!q.width) return
        if ((q.left + q.right) / 2 < mid) left = Math.max(left, q.right - box.left + 16)
        else right = Math.max(right, box.right - q.left + 16)
      })
      setAutoIns((prev) =>
        prev.left === left && prev.right === right ? prev : { top: 0, right, bottom: 48, left },
      )
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(parent)
    ro.observe(el)
    const mo = new MutationObserver(measure)
    mo.observe(parent, { childList: true, subtree: true, attributes: true })
    return () => {
      ro.disconnect()
      mo.disconnect()
    }
  }, [insets, wrapRef])

  const insTop = insets?.top
  const insRight = insets?.right
  const insBottom = insets?.bottom
  const insLeft = insets?.left
  const ins = useMemo(
    () =>
      insets
        ? {
            top: insTop ?? 0,
            right: insRight ?? 0,
            bottom: insBottom ?? 0,
            left: insLeft ?? 0,
          }
        : autoIns,
    [insets, insTop, insRight, insBottom, insLeft, autoIns],
  )

  /**
   * The plot rectangle itself is inset by the overlays, so the AXES move with
   * the data. Insetting only the view (the old behaviour) left the y tick
   * numbers sitting behind the bottom-left panel.
   */
  /**
   * The board is full bleed: the grid and the data run edge to edge, because a
   * boxed-in plot loses the whiteboard feel. What the overlays claim is tracked
   * separately as the SAFE rect, and only two things respect it: where the axis
   * labels are drawn, and how the opening view frames the data. The labels then
   * float on top of the grid rather than living in a gutter.
   */
  const safe = useMemo(() => {
    // `pad` is the minimum breathing room, so a label is never flush to the edge
    // even when no overlay claims that side.
    const [l, r] = fitInsets(
      Math.max(pad.left, railW + ins.left),
      Math.max(pad.right, ins.right),
      Math.max(0, w * KEEP),
    )
    const [t, b] = fitInsets(
      Math.max(pad.top, ins.top),
      Math.max(pad.bottom, ins.bottom),
      Math.max(0, h * KEEP),
    )
    return { left: l, right: r, top: t, bottom: b }
  }, [ins, w, h, railW, pad.left, pad.right, pad.top, pad.bottom])

  // Full bleed: the plot rectangle IS the board.
  const padLeft = 0
  const padTop = 0
  const padRight = 0
  const padBottom = 0
  const iw = Math.max(10, w)
  const ih = Math.max(10, h)

  /** What the board opens on, and returns to on Fit: data inside the safe rect. */
  const openingView = useMemo(
    () => expandForInsets(defaultView, iw, ih, safe),
    [defaultView, iw, ih, safe],
  )

  // null means "still framed the way the board opened", so a resize reframes.
  const [userView, setUserView] = useState<View | null>(null)
  const view = userView ?? openingView

  // Live refs so the native wheel/pointer handlers never read a stale view.
  const viewRef = useRef(view)
  viewRef.current = view
  const sizeRef = useRef({ w, h })
  sizeRef.current = { w, h }

  const setView = useCallback(
    (v: View) => {
      const xs = clamp(v.x1 - v.x0, MIN_SPAN, MAX_SPAN)
      const ys = clamp(v.y1 - v.y0, MIN_SPAN, MAX_SPAN)
      const next = { x0: v.x0, x1: v.x0 + xs, y0: v.y0, y1: v.y0 + ys }
      setUserView(next)
      onViewChange?.(next)
    },
    [onViewChange],
  )

  const scales = useMemo<Scales>(() => {
    const { x0, x1, y0, y1 } = view
    const sx = (x: number) => padLeft + ((x - x0) / (x1 - x0)) * iw
    const sy = (y: number) => padTop + (1 - (y - y0) / (y1 - y0)) * ih
    const ix = (px: number) => x0 + ((px - padLeft) / iw) * (x1 - x0)
    const iy = (py: number) => y0 + (1 - (py - padTop) / ih) * (y1 - y0)
    return {
      sx,
      sy,
      ix,
      iy,
      toWorld: (e) => {
        const el = svgRef.current
        if (!el) return { x: x0, y: y0 }
        const r = el.getBoundingClientRect()
        return { x: ix(e.clientX - r.left), y: iy(e.clientY - r.top) }
      },
      view,
      unitPerPx: { x: (x1 - x0) / iw, y: (y1 - y0) / ih },
      safe: { left: safe.left, top: safe.top, right: iw - safe.right, bottom: ih - safe.bottom },
      area: {
        left: padLeft,
        top: padTop,
        right: padLeft + iw,
        bottom: padTop + ih,
        w: iw,
        h: ih,
      },
    }
  }, [view, iw, ih, padLeft, padTop, safe])

  const toWorld = scales.toWorld

  /* ---------------------- zoom (wheel + pinch) ---------------------- */

  const zoomAt = useCallback(
    (px: number, py: number, fx: number, fy: number) => {
      const v = viewRef.current
      const { w: cw, h: ch } = sizeRef.current
      const aw = Math.max(10, cw - padLeft - padRight)
      const ah = Math.max(10, ch - padTop - padBottom)
      // world point under the cursor stays put
      const wx = v.x0 + ((px - padLeft) / aw) * (v.x1 - v.x0)
      const wy = v.y0 + (1 - (py - padTop) / ah) * (v.y1 - v.y0)
      const nx = (v.x1 - v.x0) * fx
      const ny = (v.y1 - v.y0) * fy
      const tx = (wx - v.x0) / (v.x1 - v.x0)
      const ty = (wy - v.y0) / (v.y1 - v.y0)
      setView({ x0: wx - tx * nx, x1: wx + (1 - tx) * nx, y0: wy - ty * ny, y1: wy + (1 - ty) * ny })
    },
    [padLeft, padTop, padRight, padBottom, setView],
  )

  /** Shift the view by a pixel offset, used by two-finger trackpad scrolling. */
  const panByPixels = useCallback(
    (dxPx: number, dyPx: number) => {
      const v = viewRef.current
      const { w: cw, h: ch } = sizeRef.current
      const aw = Math.max(10, cw - padLeft - padRight)
      const ah = Math.max(10, ch - padTop - padBottom)
      const dx = (dxPx / aw) * (v.x1 - v.x0)
      const dy = (dyPx / ah) * (v.y1 - v.y0)
      setView({ x0: v.x0 + dx, x1: v.x1 + dx, y0: v.y0 - dy, y1: v.y1 - dy })
    },
    [padLeft, padRight, padTop, padBottom, setView],
  )

  /**
   * Wheel handling, on a native non-passive listener so we can preventDefault.
   * It is bound to the WRAPPER, not the svg: the svg only exists once the
   * element has been measured, and this effect does not re-run, so binding to
   * the svg meant the listener was never attached at all.
   *
   * Three gestures, deliberately the ones a board is expected to have:
   * - trackpad pinch (reaches the browser as ctrl+wheel with small deltas): zoom
   * - mouse wheel (big, quantised, purely vertical steps): zoom
   * - two-finger trackpad scroll: pan, like dragging the board
   */
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      const px = e.clientX - r.left
      const py = e.clientY - r.top

      // deltaMode 1 is lines, 2 is pages; normalise both to pixels.
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1
      const dy = e.deltaY * unit
      const dx = e.deltaX * unit

      if (e.ctrlKey || e.metaKey) {
        // Pinch deltas are tiny, so they need their own coefficient.
        const f = Math.exp(clamp(dy, -60, 60) * 0.01)
        zoomAt(px, py, f, f)
        return
      }

      const mouseWheel = dx === 0 && Math.abs(dy) >= 30
      if (mouseWheel) {
        const f = Math.exp(clamp(dy, -120, 120) * 0.0022)
        zoomAt(px, py, e.altKey ? 1 : f, e.shiftKey ? 1 : f)
        return
      }

      panByPixels(dx, dy)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAt, panByPixels, wrapRef])

  /* ------------------------- pan (drag) ---------------------------- */

  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const panStart = useRef<{ x: number; y: number; view: View } | null>(null)
  const pinchStart = useRef<{ dist: number; view: View; cx: number; cy: number } | null>(null)

  // Distinguishes a click (place a point) from a drag (pan the board).
  const downAt = useRef<{ x: number; y: number; moved: boolean } | null>(null)

  const onPointerDown = (e: React.PointerEvent) => {
    // Marks (handles, draggable dots) stop propagation, so reaching here
    // means the student grabbed empty board: that is a pan, or a click.
    downAt.current = { x: e.clientX, y: e.clientY, moved: false }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    if (pointers.current.size === 1) {
      panStart.current = { x: e.clientX, y: e.clientY, view: viewRef.current }
      setPanning(true)
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinchStart.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        view: viewRef.current,
        cx: (a.x + b.x) / 2,
        cy: (a.y + b.y) / 2,
      }
      panStart.current = null
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return
    const d = downAt.current
    if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) d.moved = true
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size >= 2 && pinchStart.current) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1
      const s = pinchStart.current
      const f = s.dist / dist
      const el = svgRef.current!
      const r = el.getBoundingClientRect()
      const v = s.view
      const wx = v.x0 + ((s.cx - r.left - padLeft) / iw) * (v.x1 - v.x0)
      const wy = v.y0 + (1 - (s.cy - r.top - padTop) / ih) * (v.y1 - v.y0)
      const nx = (v.x1 - v.x0) * f
      const ny = (v.y1 - v.y0) * f
      const tx = (wx - v.x0) / (v.x1 - v.x0)
      const ty = (wy - v.y0) / (v.y1 - v.y0)
      setView({ x0: wx - tx * nx, x1: wx + (1 - tx) * nx, y0: wy - ty * ny, y1: wy + (1 - ty) * ny })
      return
    }

    const s = panStart.current
    if (!s) return
    const dxPx = e.clientX - s.x
    const dyPx = e.clientY - s.y
    const dx = (dxPx / iw) * (s.view.x1 - s.view.x0)
    const dy = (dyPx / ih) * (s.view.y1 - s.view.y0)
    setView({
      x0: s.view.x0 - dx,
      x1: s.view.x1 - dx,
      y0: s.view.y0 + dy,
      y1: s.view.y1 + dy,
    })
  }

  const endPointer = (e: React.PointerEvent) => {
    const d = downAt.current
    // e.detail >= 2 is the second click of a double-click, which the board
    // uses to reset the view. Without this guard a student who double-clicks
    // to reframe plants two stray points first.
    if (d && !d.moved && onBoardClick && pointers.current.size === 1 && e.detail < 2) {
      onBoardClick(toWorld(e))
    }
    if (pointers.current.size <= 1) downAt.current = null
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinchStart.current = null
    if (pointers.current.size === 0) {
      panStart.current = null
      setPanning(false)
    }
  }

  /* --------------------------- api / keys --------------------------- */

  const ready = w > 0 && h > 0
  /** A fit asked for before the first measurement, replayed once we have a size. */
  const pendingFit = useRef<{ points: Point[]; opts?: FitOpts } | null>(null)

  const applyFit = useCallback(
    (points: Point[], opts?: FitOpts) => {
      const v = fitView(points, opts)
      if (v) setView(expandForInsets(v, iw, ih, safe))
    },
    // `safe`, niet `ins`: dit rekent met het vrije vlak, en dat is wat er in de
    // functie staat. Met `ins` in de lijst kaderde een fit() na een wissel van
    // paneelbreedte nog op de vorige vrije ruimte.
    [setView, iw, ih, safe],
  )

  const fit = useCallback(
    (points: Point[], opts?: FitOpts) => {
      // Framing against an unmeasured board clamps every inset to nothing, and
      // the resulting userView would then shadow openingView for good.
      if (!ready) {
        pendingFit.current = { points, opts }
        return
      }
      applyFit(points, opts)
    },
    [ready, applyFit],
  )

  useEffect(() => {
    if (!ready) return
    const queued = pendingFit.current
    if (!queued) return
    pendingFit.current = null
    applyFit(queued.points, queued.opts)
  }, [ready, applyFit])

  const reset = useCallback(() => {
    pendingFit.current = null
    setUserView(null)
  }, [])

  const zoomButton = useCallback(
    (f: number) => zoomAt(padLeft + iw / 2, padTop + ih / 2, f, f),
    [zoomAt, padLeft, iw, padTop, ih],
  )

  useEffect(() => {
    if (!apiRef) return
    apiRef.current = { setView, fit, reset, zoomBy: zoomButton }
    return () => {
      apiRef.current = null
    }
  }, [apiRef, setView, fit, reset, zoomButton])


  /* ---------------------------- render ----------------------------- */

  const majorX = ticks(view.x0, view.x1, Math.max(2, Math.round(iw / 120)))
  const majorY = ticks(view.y0, view.y1, Math.max(2, Math.round(ih / 90)))
  const minorX = subTicks(majorX)
  const minorY = subTicks(majorY)

  return (
    <div ref={wrapRef} className="absolute inset-0 bg-paper">
      {w > 0 && h > 0 && (
        <svg
          ref={svgRef}
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          className={`absolute inset-0 touch-none no-select ${panning ? 'cursor-grabbing' : 'cursor-grab'}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          onDoubleClick={reset}
        >
          <defs>
            <clipPath id="board-clip">
              <rect x={padLeft} y={padTop} width={iw} height={ih} />
            </clipPath>
          </defs>

          {/* grid + data live inside the board, so they pan and zoom */}
          <g clipPath="url(#board-clip)">
            <rect x={padLeft} y={padTop} width={iw} height={ih} fill="#fff" />
            {minorX.map((t) => (
              <line
                key={`mx${t}`}
                x1={scales.sx(t)}
                y1={padTop}
                x2={scales.sx(t)}
                y2={padTop + ih}
                stroke="#f4f2f9"
              />
            ))}
            {minorY.map((t) => (
              <line
                key={`my${t}`}
                x1={padLeft}
                y1={scales.sy(t)}
                x2={padLeft + iw}
                y2={scales.sy(t)}
                stroke="#f4f2f9"
              />
            ))}
            {majorX.map((t) => (
              <line
                key={`gx${t}`}
                x1={scales.sx(t)}
                y1={padTop}
                x2={scales.sx(t)}
                y2={padTop + ih}
                stroke="#ebe8f3"
              />
            ))}
            {majorY.map((t) => (
              <line
                key={`gy${t}`}
                x1={padLeft}
                y1={scales.sy(t)}
                x2={padLeft + iw}
                y2={scales.sy(t)}
                stroke="#ebe8f3"
              />
            ))}
            {children(scales)}
          </g>

          {/* fixed gutter: axis lines + tick labels stay readable */}
          <line x1={padLeft} y1={padTop + ih} x2={padLeft + iw} y2={padTop + ih} stroke="#d5d1e2" />
          <line x1={padLeft} y1={padTop} x2={padLeft} y2={padTop + ih} stroke="#d5d1e2" />
          {axes &&
            majorX
            .filter((t) => scales.sx(t) >= safe.left + 4 && scales.sx(t) <= iw - safe.right - 4)
            .map((t) => (
              <text
                key={`tx${t}`}
                x={scales.sx(t)}
                y={ih - safe.bottom - 10}
                textAnchor="middle"
                fontSize={TICK_PX}
                fontWeight={700}
                fill="#6b6d88"
                stroke="#fff"
                strokeWidth={3.5}
                paintOrder="stroke"
              >
                {fmt(t)}
              </text>
            ))}
          {axes &&
            majorY
            /*
             * De onderste grens houdt het laatste y-getal weg uit de hoek waar
             * de x-getallen staan. Ze stond op 22 px en dat was te krap: een
             * x-getal heeft zijn basislijn op ih - safe.bottom - 10 en loopt
             * dus van -23 tot -6, terwijl een y-getal op sy + 4 staat en tot
             * sy + 8 doorloopt. Alles boven -31 kan elkaar dus raken. Gemeten
             * op Data-dokter, 900x700: "35" langs de onderrand en "155" langs
             * de linkerrand overlapten 6,4 bij 2,5 px op 12,5 px tekst en 7,5
             * bij 3,0 px op 13. Het is een hoekbotsing, dus ze hangt aan de
             * data: ze verschijnt zodra het linkse x-getal in de eerste 30 px
             * van de vrije band valt. 32 haalt ze weg voor elke data set en
             * kost hoogstens één y-getal onderaan.
             */
            .filter((t) => scales.sy(t) >= safe.top + 10 && scales.sy(t) <= ih - safe.bottom - 32)
            .map((t) => (
              <text
                key={`ty${t}`}
                x={safe.left + 8}
                y={scales.sy(t) + 4}
                textAnchor="start"
                fontSize={TICK_PX}
                fontWeight={700}
                fill="#6b6d88"
                stroke="#fff"
                strokeWidth={3.5}
                paintOrder="stroke"
              >
                {fmt(t)}
              </text>
            ))}
          {axes && xLabel && (
            <text
              x={iw - safe.right - 14}
              y={ih - safe.bottom - 30}
              textAnchor="end"
              fontSize={13.5}
              fill={INK}
              fontWeight={700}
              stroke="#fff"
              strokeWidth={3.5}
              paintOrder="stroke"
            >
              {xLabel}
            </text>
          )}
          {/* Rotated along the axis: the top-left corner belongs to the Brief panel. */}
          {axes && yLabel && (
            <text
              x={iw - safe.right - 8}
              y={safe.top + 16}
              textAnchor="end"
              fontSize={13.5}
              fill={INK}
              fontWeight={700}
              stroke="#fff"
              strokeWidth={3.5}
              paintOrder="stroke"
            >
              {yLabel}
            </text>
          )}
        </svg>
      )}

      {/*
        De zoomknoppen staan NAAST het linkerpaneel, niet erachter. safe.left
        rekent al met railW + ins.left, dus de rail hoort ook echt rechts van
        dat paneel te staan. Op x=8 deed ze dat niet: een paneel linksonder is
        breder dan de rail en begint op x=16, en op 900x700 lagen alle drie de
        knoppen van Regressie-lab en Hoe goed past de lijn volledig onder dat
        paneel - onzichtbaar en onklikbaar. Zonder linkerpaneel is ins.left 0 en
        staat de rail gewoon weer tegen de rand.
      */}
      {controls && (
        <div
          className="panel absolute bottom-1/2 flex translate-y-1/2 flex-col items-center overflow-hidden rounded-full"
          style={{ left: Math.max(8, ins.left - 8) }}
        >
          <ViewBtn onClick={() => zoomButton(1 / 1.3)} label="Zoom in">
            +
          </ViewBtn>
          <span className="h-px w-5 bg-black/8" />
          <ViewBtn onClick={() => zoomButton(1.3)} label="Zoom uit">
            &minus;
          </ViewBtn>
          <span className="h-px w-5 bg-black/8" />
          {/* Eén woord voor één knop: wat je leest is ook wat een schermlezer
              voorleest. "Fit" was Engels en stond bovendien naast het label
              "Terug naar het begin", dus twee namen voor dezelfde knop. */}
          <ViewBtn onClick={reset} label="Toon alles">
            <span className="px-0.5 text-[12px] font-semibold">Alles</span>
          </ViewBtn>
        </div>
      )}
    </div>
  )
}

function ViewBtn({
  onClick,
  children,
  label,
}: {
  onClick: () => void
  children: ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-8 min-w-8 items-center justify-center px-1.5 text-[15px] leading-none text-ink transition hover:bg-model/8 active:bg-model/14"
    >
      {children}
    </button>
  )
}

/* ----------------------------- marks ----------------------------- */

/** Eén decimaal, met een komma: ook een schermlezer hoort Nederlandse getallen. */
const komma = (v: number) => v.toFixed(1).replace('.', ',')

/** A line y=a*x+b, drawn right across the visible board. */
export function LineShape({
  line,
  scales,
  color = MODEL,
  width = 2.5,
  dashed = false,
  opacity = 1,
}: {
  line: Line
  scales: Scales
  color?: string
  width?: number
  dashed?: boolean
  opacity?: number
}) {
  const { x0, x1 } = scales.view
  return (
    <line
      x1={scales.sx(x0)}
      y1={scales.sy(line.a * x0 + line.b)}
      x2={scales.sx(x1)}
      y2={scales.sy(line.a * x1 + line.b)}
      stroke={color}
      strokeWidth={width}
      strokeDasharray={dashed ? '6 6' : undefined}
      strokeLinecap="round"
      opacity={opacity}
    />
  )
}

export function Residuals({
  points,
  line,
  scales,
  color = FOUT,
  width = 1.25,
  opacity = 0.45,
}: {
  points: Point[]
  line: Line
  scales: Scales
  color?: string
  width?: number
  opacity?: number
}) {
  return (
    <g>
      {points.map((p, i) => (
        <line
          key={i}
          x1={scales.sx(p.x)}
          y1={scales.sy(p.y)}
          x2={scales.sx(p.x)}
          y2={scales.sy(line.a * p.x + line.b)}
          stroke={color}
          strokeWidth={width}
          opacity={opacity}
        />
      ))}
    </g>
  )
}

export function Dots({
  points,
  scales,
  color = DATA,
  r = 4.5,
  opacity = 0.9,
  onPointClick,
  markedColor = FOUT,
  isMarked,
  title,
}: {
  points: Point[]
  scales: Scales
  color?: string
  r?: number
  opacity?: number
  /** Makes each dot clickable, e.g. to flag a row as suspect. */
  onPointClick?: (index: number) => void
  markedColor?: string
  isMarked?: (index: number) => boolean
  title?: (index: number) => string
}) {
  const dotDown = useRef<{ x: number; y: number; i: number } | null>(null)
  return (
    <g>
      {points.map((p, i) => {
        const marked = isMarked ? isMarked(i) : false
        const cx = scales.sx(p.x)
        const cy = scales.sy(p.y)
        return (
          <g
            key={i}
            onPointerDown={
              onPointClick
                ? (e) => {
                    e.stopPropagation()
                    dotDown.current = { x: e.clientX, y: e.clientY, i }
                  }
                : undefined
            }
            onPointerUp={
              onPointClick
                ? (e) => {
                    const d = dotDown.current
                    dotDown.current = null
                    if (!d || d.i !== i) return
                    // a drag that started on a dot is a pan, not a click
                    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) return
                    e.stopPropagation()
                    onPointClick(i)
                  }
                : undefined
            }
            style={onPointClick ? { cursor: 'pointer' } : undefined}
          >
            {/* generous invisible hit area: these dots are small on a beamer */}
            {onPointClick && <circle cx={cx} cy={cy} r={r + 9} fill="transparent" />}
            {marked && <circle cx={cx} cy={cy} r={r + 5} fill={markedColor} opacity={0.2} />}
            <circle
              cx={cx}
              cy={cy}
              r={marked ? r + 1 : r}
              fill={marked ? markedColor : color}
              opacity={marked ? 1 : opacity}
              stroke={marked ? '#fff' : undefined}
              strokeWidth={marked ? 1.5 : undefined}
            />
            {title && <title>{title(i)}</title>}
          </g>
        )
      })}
    </g>
  )
}

/**
 * Anything the student can drag on the board. Stops propagation so the
 * board does not pan underneath, and supports arrow-key nudging.
 */
export function DragDot({
  point,
  scales,
  onMove,
  color = FOUT,
  r = 8,
  step,
  snap = false,
  label,
  bounds,
  cursor = 'grab',
  // Wat je op een bord vastpakt heet een handvat. "Punt" is het woord voor een
  // bolletje data, en dat pak je nooit vast: wie denkt van wel, sleept eraan.
  ariaLabel = 'sleep dit handvat',
}: {
  point: Point
  scales: Scales
  onMove: (p: Point) => void
  color?: string
  r?: number
  /** Arrow-key step in world units; defaults to ~2% of the visible span. */
  step?: { x: number; y: number }
  snap?: boolean
  label?: string
  bounds?: { x?: [number, number]; y?: [number, number] }
  cursor?: string
  ariaLabel?: string
}) {
  const dragging = useRef(false)
  const cx = scales.sx(point.x)
  const cy = scales.sy(point.y)
  const { x0, x1, y0, y1 } = scales.view
  const stp = step ?? { x: (x1 - x0) * 0.02, y: (y1 - y0) * 0.02 }

  const commit = (p: Point) => {
    let x = bounds?.x ? clamp(p.x, bounds.x[0], bounds.x[1]) : p.x
    let y = bounds?.y ? clamp(p.y, bounds.y[0], bounds.y[1]) : p.y
    if (snap) {
      // Snap to the caller's grid, so step={{x:1,y:5}} really means 5 cm in y.
      x = Math.round(x / stp.x) * stp.x
      y = Math.round(y / stp.y) * stp.y
    }
    onMove({ x, y })
  }

  return (
    <g
      tabIndex={0}
      role="slider"
      aria-label={ariaLabel}
      aria-valuetext={`x ${komma(point.x)}, y ${komma(point.y)}`}
      style={{ cursor }}
      className="outline-none"
      onPointerDown={(e) => {
        dragging.current = true
        ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
        e.stopPropagation()
      }}
      onPointerMove={(e) => {
        if (!dragging.current) return
        e.stopPropagation()
        commit(scales.toWorld(e))
      }}
      onPointerUp={(e) => {
        dragging.current = false
        e.stopPropagation()
      }}
      onPointerCancel={() => (dragging.current = false)}
      onKeyDown={(e) => {
        const d: Record<string, Point> = {
          ArrowLeft: { x: -stp.x, y: 0 },
          ArrowRight: { x: stp.x, y: 0 },
          ArrowUp: { x: 0, y: stp.y },
          ArrowDown: { x: 0, y: -stp.y },
        }
        const m = d[e.key]
        if (!m) return
        e.preventDefault()
        e.stopPropagation()
        commit({ x: point.x + m.x, y: point.y + m.y })
      }}
    >
      <circle cx={cx} cy={cy} r={r + 10} fill={color} opacity={0.12} />
      <circle cx={cx} cy={cy} r={r} fill={color} stroke="#fff" strokeWidth={2.5} />
      {/* Zelfde vloer als de asgetallen: 13 px, vet, met een witte rand. Dit
          woord staat boven de rasterlijnen en soms boven de punten, en het had
          als enige tekst op het bord geen rand. */}
      {label && (
        <text
          x={cx}
          y={cy - r - 11}
          textAnchor="middle"
          fontSize={TICK_PX}
          fontWeight={700}
          fill={color}
          stroke="#fff"
          strokeWidth={3.5}
          paintOrder="stroke"
          pointerEvents="none"
        >
          {label}
        </text>
      )}
    </g>
  )
}

/** One named row, and the gap between its real value and the prediction. */
export function MissMarker({
  x,
  actual,
  predicted,
  scales,
  name,
  unit = 'cm',
}: {
  x: number
  actual: number
  predicted: number
  scales: Scales
  name: string
  unit?: string
}) {
  const px = scales.sx(x)
  const ay = scales.sy(actual)
  const py = scales.sy(predicted)
  const gap = Math.abs(actual - predicted)
  return (
    <g pointerEvents="none">
      <line x1={px} y1={ay} x2={px} y2={py} stroke={FOUT} strokeWidth={2.5} strokeLinecap="round" />
      <circle cx={px} cy={ay} r={5.5} fill={FOUT} stroke="#fff" strokeWidth={2} />
      <circle cx={px} cy={py} r={4.5} fill="#fff" stroke={FOUT} strokeWidth={2.5} />
      <text
        x={px + 10}
        y={(ay + py) / 2 + 4}
        fontSize={13.5}
        fontWeight={700}
        fill={FOUT_INK}
        stroke="#fff"
        strokeWidth={3.5}
        paintOrder="stroke"
      >
        {name} &middot; {gap.toFixed(0)} {unit} fout
      </text>
    </g>
  )
}

/* ----------------------------- helpers ----------------------------- */

/**
 * Widen `target` so the data lands inside the rectangle the overlays leave free,
 * while the grid itself still fills the whole board.
 */
function expandForInsets(
  target: View,
  iw: number,
  ih: number,
  ins: { top: number; right: number; bottom: number; left: number },
): View {
  const fL = ins.left / iw
  const fR = 1 - ins.right / iw
  const gT = ins.top / ih
  const gB = 1 - ins.bottom / ih
  if (fR - fL < 0.2 || gB - gT < 0.2) return target
  const spanX = (target.x1 - target.x0) / (fR - fL)
  const x0 = target.x0 - fL * spanX
  const spanY = (target.y1 - target.y0) / (gB - gT)
  const y0 = target.y0 - (1 - gB) * spanY
  return { x0, x1: x0 + spanX, y0, y1: y0 + spanY }
}

/**
 * Shrink a pair of opposing insets so they never claim more than `cap` pixels
 * between them. The plot rectangle is inset by the overlays, so without this a
 * greedy panel could squeeze the board to nothing on a small screen.
 */
function fitInsets(a: number, b: number, cap: number, _minBand = 0): [number, number] {
  const lo = Math.max(0, a)
  const hi = Math.max(0, b)
  const total = lo + hi
  if (total <= cap || total === 0) return [lo, hi]
  const k = cap / total
  return [lo * k, hi * k]
}

function ticks(a: number, b: number, n: number): number[] {
  const step = niceStep((b - a) / Math.max(1, n))
  const start = Math.ceil(a / step) * step
  const out: number[] = []
  for (let v = start; v <= b + 1e-9 && out.length < 60; v += step) out.push(round(v, step))
  return out
}

/** Four extra lines between each pair of major ticks. */
function subTicks(major: number[]): number[] {
  if (major.length < 2) return []
  const step = (major[1] - major[0]) / 5
  const out: number[] = []
  for (let i = -1; i < major.length && out.length < 300; i++) {
    const base = major[0] + i * step * 5
    for (let k = 1; k < 5; k++) out.push(round(base + k * step, step))
  }
  return out
}

function round(v: number, step: number): number {
  const d = Math.max(0, -Math.floor(Math.log10(Math.abs(step))) + 2)
  return parseFloat(v.toFixed(d))
}

function niceStep(raw: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(Math.abs(raw) || 1)))
  const n = raw / p
  if (n < 1.5) return p
  if (n < 3) return 2 * p
  if (n < 7) return 5 * p
  return 10 * p
}

/**
 * Een asgetal zoals de leerlingen het schrijven: komma als decimaalteken en
 * een harde spatie bij de duizendtallen. "1.500" leest een Nederlandstalige
 * als anderhalf, en met een gewone spatie kan het getal over twee regels
 * breken. De harde spatie staat er als escape en niet als los teken: zo'n
 * teken is in een eerdere build stilletjes een gewone spatie geworden.
 */
const NBSP = '\u00a0'
function fmt(v: number): string {
  if (Math.abs(v) >= 10000) return `${Math.round(v / 1000)}k`
  const r = Math.round(v * 1000) / 1000
  const [heel, deel] = Math.abs(r).toString().split('.')
  const groep = heel.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP)
  return (r < 0 ? '-' : '') + groep + (deel ? `,${deel}` : '')
}
