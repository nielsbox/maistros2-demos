/* ------------------------------------------------------------------ *
 * De 52 testgevallen van les 3, met de kans die het model ze geeft.
 *
 * WAAR DIT VANDAAN KOMT, en waarom het hier hardgecodeerd staat.
 *
 * Gemeten op sonar-data.txt, de data set van de les zelf: 208 rijen, 60
 * waarden per rij, 111 mijnen en 97 rotsblokken. Daarna, met precies het model
 * dat de leerling in oefening 2 bouwt (slide 2127763 en 2127765):
 *
 *   x_train, x_test, y_train, y_test = train_test_split(invoer, antwoorden,
 *                                                       test_size=0.25)
 *   lr_model = linear_model.LogisticRegression()
 *   lr_model.fit(x_train, y_train)
 *
 * plus twee dingen die de les zelf niet doet: `random_state=42` op de split,
 * en `predict_proba(x_test)[:, 0]` in plaats van `predict`. Kolom 0 is 'M',
 * want `classes_` staat alfabetisch: 'M' voor 'R'.
 *
 * Geen `max_iter` erbij, want de les zet die ook niet: dit model convergeert
 * hier in 19 iteraties en geeft dus geen ConvergenceWarning. Nagerekend met
 * `max_iter=5000` ernaast: exact dezelfde 52 kansen. Dat is anders dan bij het
 * MNIST-model van les 4, dat wél tegen de grens van 100 aanloopt.
 *
 * Dat geeft 52 testrijen: 30 mijnen en 22 rotsblokken, met kansen van 0,0685
 * tot 0,9634 - op het bord afgerond 0,07 en 0,96. Zeventien ervan liggen
 * tussen 0,4 en 0,6, en dat is precies waarom dit bord bestaat: daar beslist
 * de grens, en niet meer het model.
 *
 * ROTSBLOK, NIET STEEN. Geteld over alle slides van les 3 (lesson 4496):
 * `rotsblok` 22 keer in de slide-inhoud (plus 2x in de begeleidersinfo en 2x in de hints),
 * `steen` 0 keer. Let op: de les zelf zegt daarnaast nog 5 keer `rots` of `rotsen`, dus zij
 * houdt haar eigen eenwoordregel niet aan - het bord wel. Eén begrip krijgt in dit project één
 * woord over de slides, de hints en de borden heen, dus heet het hier ook
 * rotsblok - ook al is dat een langer woord op een smal bord.
 *
 * `random_state=42` staat er niet voor de sier. Zonder die waarde is de
 * splitsing willekeurig en zou elke leerling en elke beamer een ander bord
 * zien - en dan mag je ook geen enkel getal meer op een slide zetten, want
 * het verandert per run. Met deze waarde is het bord voor iedereen gelijk,
 * en klopt het met de tabel in de les.
 *
 * Wat hier NIET staat, staat er bewust niet: de 60 waarden per rij. Zestig
 * assen kun je niet tekenen. Dit bord zet elke rij daarom op de enige as die
 * het model overhoudt, zijn kans, en laat de leerling de grens kiezen.
 *
 * De uitkomsten worden altijd GEREKEND uit de grens, nooit opgeschreven.
 * Een getal in een zin is de fout die dit project al eens gemaakt heeft.
 * ------------------------------------------------------------------ */

/** Eén testrij: de kans die het model geeft, en wat het in werkelijkheid is. */
export type Geval = {
  /** De kans op een mijn volgens het model, tussen 0 en 1. */
  kans: number
  /** Waar het echt om gaat: true is een mijn, false een rotsblok. */
  mijn: boolean
}

/** De 52 testgevallen, in de volgorde waarin train_test_split ze teruggaf. */
export const GEVALLEN: readonly Geval[] = [
  { kans: 0.7073, mijn: true }, { kans: 0.2323, mijn: false },
  { kans: 0.3822, mijn: false }, { kans: 0.1552, mijn: false },
  { kans: 0.6367, mijn: true }, { kans: 0.4407, mijn: false },
  { kans: 0.4940, mijn: true }, { kans: 0.5484, mijn: true },
  { kans: 0.1797, mijn: false }, { kans: 0.6565, mijn: true },
  { kans: 0.8649, mijn: true }, { kans: 0.4609, mijn: false },
  { kans: 0.4709, mijn: true }, { kans: 0.9565, mijn: true },
  { kans: 0.7288, mijn: true }, { kans: 0.7931, mijn: true },
  { kans: 0.8063, mijn: true }, { kans: 0.5135, mijn: true },
  { kans: 0.6139, mijn: false }, { kans: 0.3770, mijn: false },
  { kans: 0.7404, mijn: true }, { kans: 0.5899, mijn: true },
  { kans: 0.5214, mijn: true }, { kans: 0.4820, mijn: true },
  { kans: 0.1486, mijn: false }, { kans: 0.4037, mijn: false },
  { kans: 0.0962, mijn: false }, { kans: 0.4231, mijn: false },
  { kans: 0.8892, mijn: true }, { kans: 0.9634, mijn: true },
  { kans: 0.6951, mijn: true }, { kans: 0.3744, mijn: false },
  { kans: 0.0940, mijn: false }, { kans: 0.6429, mijn: true },
  { kans: 0.9303, mijn: true }, { kans: 0.4873, mijn: true },
  { kans: 0.5476, mijn: true }, { kans: 0.4735, mijn: true },
  { kans: 0.5179, mijn: false }, { kans: 0.5954, mijn: true },
  { kans: 0.0685, mijn: false }, { kans: 0.3966, mijn: true },
  { kans: 0.2851, mijn: false }, { kans: 0.6173, mijn: true },
  { kans: 0.0966, mijn: false }, { kans: 0.6712, mijn: false },
  { kans: 0.4471, mijn: true }, { kans: 0.6576, mijn: true },
  { kans: 0.1652, mijn: false }, { kans: 0.0881, mijn: false },
  { kans: 0.2678, mijn: false }, { kans: 0.8405, mijn: true },]

/** Hoeveel mijnen er in de testgevallen zitten. Geteld, niet opgeschreven. */
export const AANTAL_MIJNEN = GEVALLEN.filter((g) => g.mijn).length

/** Hoeveel rotsblokken er in de testgevallen zitten. */
export const AANTAL_ROTSBLOKKEN = GEVALLEN.length - AANTAL_MIJNEN

/**
 * De vier uitkomsten bij één grens.
 *
 * De regel is die van het model zelf: vanaf de grens zegt het mijn, eronder
 * rotsblok. Dus `kans >= grens`. Met `>` zou een geval dat exact op de grens
 * ligt de andere kant op vallen, en dan klopt het bord niet meer met wat het
 * notebook printt.
 */
export type Uitkomst = {
  /** Mijn, en het model zegt mijn. */
  juisteMijn: number
  /** Mijn, en het model zegt rotsblok. Dit is waar dit bord over gaat. */
  gemisteMijn: number
  /** Rotsblok, en het model zegt rotsblok. */
  juisteRotsblok: number
  /** Rotsblok, en het model zegt mijn. Les 3 noemt dat ook missen: 'zo mist
   *  het meer rotsblokken' (slide 2127771). */
  gemistRotsblok: number
  /** Hoe vaak het model mijn zegt: juisteMijn + gemistRotsblok. */
  zegtMijn: number
  /** Hoe vaak het model het bij het rechte eind heeft. */
  juist: number
  /** Datzelfde, in procenten van alle gevallen. */
  juistPct: number
}

export function uitkomst(gevallen: readonly Geval[], grens: number): Uitkomst {
  let juisteMijn = 0
  let gemisteMijn = 0
  let juisteRotsblok = 0
  let gemistRotsblok = 0
  for (const g of gevallen) {
    const zegtMijn = g.kans >= grens
    if (g.mijn && zegtMijn) juisteMijn++
    else if (g.mijn) gemisteMijn++
    else if (zegtMijn) gemistRotsblok++
    else juisteRotsblok++
  }
  const juist = juisteMijn + juisteRotsblok
  const n = gevallen.length
  return {
    juisteMijn,
    gemisteMijn,
    juisteRotsblok,
    gemistRotsblok,
    zegtMijn: juisteMijn + gemistRotsblok,
    juist,
    juistPct: n === 0 ? 0 : (juist / n) * 100,
  }
}

/**
 * De hoogste grens waarbij het model geen enkele mijn mist, afgerond op de
 * stap van de schuifknop.
 *
 * Uit de data gerekend en niet ingetypt, want dit is exact het soort getal
 * dat verschuift zodra de data of de splitsing verandert. Een knop die
 * "Mis geen mijn" belooft en dat dan niet doet, leest als een stuk bord.
 */
export function grensZonderGemist(gevallen: readonly Geval[], stap = 0.01): number {
  const laagsteMijn = Math.min(...gevallen.filter((g) => g.mijn).map((g) => g.kans))
  return Math.floor(laagsteMijn / stap) * stap
}

/** De laagste grens waarbij het model geen enkel rotsblok mist. Ook gerekend. */
export function grensZonderGemistRotsblok(gevallen: readonly Geval[], stap = 0.01): number {
  const hoogsteRotsblok = Math.max(...gevallen.filter((g) => !g.mijn).map((g) => g.kans))
  return Math.floor(hoogsteRotsblok / stap) * stap + stap
}
