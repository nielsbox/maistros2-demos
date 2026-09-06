/**
 * De enige naam waarmee een bord een kleur mag opvragen.
 *
 * Elke waarde is een verwijzing naar de token in src/index.css, geen kopie van
 * de hex. Dat is het hele punt: zolang een bord zijn eigen `const MODEL =
 * '#4c6fe0'` bijhoudt, staat dezelfde beslissing op vijf plaatsen en loopt er
 * vroeg of laat één uit de pas. Er is nu precies één plaats waar een
 * merkkleur geschreven staat, en dat is het @theme-blok.
 *
 * De namen zeggen wat een kleur BETEKENT, nooit hoe ze eruitziet. Een token
 * die "purple" heet en blauw tekent, stuurt een leerling op zoek naar een
 * paars handvat dat er niet is - dat is precies wat hier ooit misging.
 *
 * `var()` werkt in een SVG-presentatieattribuut (`fill`, `stroke`) omdat de
 * browser dat attribuut als een CSS-waarde leest, en werkt vanzelf ook in een
 * style-object. Een tikfout in een tokennaam levert geen foutmelding op maar
 * een zwart merk, dus controleer na een wijziging de echte fill in de browser.
 */

/* ------------------------------ merken ----------------------------- *
 * Berekend en getoetst, niet gekozen. Zie het @theme-blok in index.css
 * en de tabel in CLAUDE.md.                                            */

/** De lijn van het model. */
export const MODEL = 'var(--color-model)'

/** Wat fout, kapot of verdacht is: missers, rijen zonder lengte. */
export const FOUT = 'var(--color-fout)'

/** De derde rol op een bord, naast de punten en de lijn. */
export const DERDE = 'var(--color-derde)'

/** De punten van de leerling. Dit is de huiskleur navy: een inkt, geen reeks,
 *  en daarom valt ze buiten de lichtheidsband van de merken. Ze mag dat zijn
 *  omdat ze nergens tegen een ander merk hoeft te concurreren op tint. */
export const DATA = 'var(--color-navy)'

/* ------------------------------- inkt ------------------------------ *
 * Tekst bij een merk, in dezelfde tint maar donkerder. Alleen voor
 * LABELS. Als paar zakken de twee inkten door de chroma-ondergrens en
 * door de ondergrens voor normaal zicht, dus teken er nooit mee.        */

/** Tekst bij een misser. */
export const FOUT_INK = 'var(--color-fout-ink)'

/** Tekst bij de derde rol. */
export const DERDE_INK = 'var(--color-derde-ink)'

/* --------------------------- vlak en tekst ------------------------- */

/** Gewone lopende tekst. */
export const INK = 'var(--color-ink)'

/** Bijschrift, astekst, alles wat mag wegvallen. */
export const MUTED = 'var(--color-muted)'

/** Haarlijn: een as, een rand. Niet de lijn van het model. */
export const RULE = 'var(--color-rule)'

/** De kop- en knoptekst van CodeFever. */
export const NAVY = 'var(--color-navy)'
