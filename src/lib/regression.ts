// Minimal ordinary-least-squares linear regression (y = a*x + b), mirroring
// what sklearn's LinearRegression gives the students in their notebook.
// Everything here stays deliberately formula-free at the surface: the demos
// show behaviour (a line that moves, a miss that shrinks), never derivations.

export type Point = { x: number; y: number }
export type Line = { a: number; b: number } // y = a*x + b

/** Least-squares best-fit line. Returns a=slope, b=intercept. */
export function bestFit(points: Point[]): Line {
  const n = points.length
  if (n < 2) return { a: 0, b: n === 1 ? points[0].y : 0 }
  let sx = 0,
    sy = 0,
    sxx = 0,
    sxy = 0
  for (const p of points) {
    sx += p.x
    sy += p.y
    sxx += p.x * p.x
    sxy += p.x * p.y
  }
  const denom = n * sxx - sx * sx
  if (Math.abs(denom) < 1e-9) return { a: 0, b: sy / n }
  const a = (n * sxy - sx * sy) / denom
  const b = (sy - a * sx) / n
  return { a, b }
}

export function predict(line: Line, x: number): number {
  return line.a * x + line.b
}

/** Sum of squared residuals: the "totale fout" the students drag down by hand. */
export function sumSquaredError(points: Point[], line: Line): number {
  let e = 0
  for (const p of points) {
    const d = p.y - predict(line, p.x)
    e += d * d
  }
  return e
}

/**
 * Average miss in real units ("de lijn zit er gemiddeld X cm naast").
 * Used instead of R2 wherever a dataset changes size, because R2 on the
 * *visible* points can go UP when you add a far-away outlier - it would
 * reward keeping the garbage. An average miss measured on the realistic
 * rows always gets better as you clean. Same reason it needs no formula
 * on screen: "hoeveel zit de voorspelling ernaast" explains itself.
 */
export function meanAbsError(points: Point[], line: Line): number {
  if (points.length === 0) return 0
  let e = 0
  for (const p of points) e += Math.abs(p.y - predict(line, p.x))
  return e / points.length
}

/**
 * R2-style score, exactly the number sklearn's regr.score() prints:
 * 1.0 = perfect, 0 = no better than always guessing the average,
 * negative = worse than the average. Shown as intuition, never as a formula.
 */
export function r2(points: Point[], line: Line): number {
  const n = points.length
  if (n === 0) return 0
  const meanY = points.reduce((s, p) => s + p.y, 0) / n
  let ssRes = 0,
    ssTot = 0
  for (const p of points) {
    const d = p.y - predict(line, p.x)
    ssRes += d * d
    ssTot += (p.y - meanY) * (p.y - meanY)
  }
  if (ssTot < 1e-9) return 0
  return 1 - ssRes / ssTot
}

/** Qualitative label for a score, so we never lean on the number alone. */
export function scoreLabel(score: number): { label: string; color: string; face: string } {
  if (score >= 0.9) return { label: 'bijna door elk punt', color: '#16a34a', face: '' }
  if (score >= 0.7) return { label: 'dicht bij de punten', color: '#16a34a', face: '' }
  if (score >= 0.4) return { label: 'beter dan het gemiddelde', color: '#d97706', face: '' }
  if (score >= 0) return { label: 'amper beter dan het gemiddelde', color: '#dc2626', face: '' }
  return { label: 'slechter dan het gemiddelde raden', color: '#dc2626', face: '' }
}

/** Qualitative label for an average miss in centimetres. */
export function missLabel(cm: number): { label: string; color: string; face: string } {
  if (cm <= 3) return { label: 'heel goed', color: '#16a34a', face: '' }
  if (cm <= 6) return { label: 'bruikbaar', color: '#16a34a', face: '' }
  if (cm <= 12) return { label: 'zit ernaast', color: '#d97706', face: '' }
  return { label: 'zit ver ernaast', color: '#dc2626', face: '' }
}

/** Deterministic pseudo-random so every student sees the exact same data. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
