import { useRef } from 'react'

/* ------------------------------------------------------------------ *
 * DE TWEEDE KLIK VAN EEN DUBBELKLIK TELT NIET. Op een paneel dat van hoogte
 * verandert als je klikt, valt die tweede klik anders op een knop die net
 * onder de muis kwam te staan. "K-means stap voor stap" is waar dat gemeten
 * werd (zie daar), "Hoeveel clusters?" gebruikt dezelfde regel.
 *
 * TWEE TOETSEN, want niet elk scherm telt mee. `detail` is 2 bij de tweede
 * klik van een dubbelklik met de muis. Maar een aanraakscherm, zoals een
 * digibord, kan elke tik detail 1 geven. Dus telt ook een klik niet die binnen
 * 400 ms na de vorige valt, minder dan 10 px ernaast. Een snelle klik op een
 * ANDERE knop telt wel. Met het toetsenbord is `detail` 0, dus Enter en spatie
 * tellen altijd.
 * ------------------------------------------------------------------ */

/** Wat `useTweedeKlik` van een klik nodig heeft. */
export type Klik = { detail: number; timeStamp: number; clientX: number; clientY: number }

/** Geeft een functie die zegt of een klik de tweede van een dubbelklik is.
 *  Roep ze bij ELKE klik aan: ook een klik die niet doorgaat, is "de vorige". */
export function useTweedeKlik() {
  const vorige = useRef<{ t: number; x: number; y: number } | null>(null)
  return (e: Klik) => {
    if (e.detail === 0) return false
    const v = vorige.current
    vorige.current = { t: e.timeStamp, x: e.clientX, y: e.clientY }
    if (e.detail > 1) return true
    return v !== null && e.timeStamp - v.t < 400 && Math.hypot(e.clientX - v.x, e.clientY - v.y) < 10
  }
}
