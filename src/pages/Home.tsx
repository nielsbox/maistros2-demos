import { Link } from 'react-router-dom'

type Demo = {
  to: string
  title: string
  /** The one thing this board teaches. No two boards may share one. */
  doel: string
  /** What the student actually does. */
  doen: string
  soort: 'simulator' | 'mini-demo'
}
type Lesson = { les: string; titel: string; tint: string; demos: Demo[] }

const LESSONS: Lesson[] = [
  {
    les: 'Les 1',
    titel: 'Lineaire regressie',
    tint: 'var(--color-lime)',
    demos: [
      {
        to: '/les1/regressie-lab',
        title: 'Regressie-lab',
        soort: 'simulator',
        doel: 'Jouw data bepaalt het model',
        doen: 'Kies een data set of klik zelf punten op het bord. Train het model en doe er een voorspelling mee. Verander daarna de data en train opnieuw. De lijn verandert mee.',
      },
      {
        to: '/les1/teken-de-lijn',
        title: 'Teken de lijn',
        soort: 'mini-demo',
        doel: 'Trainen is zoeken',
        doen: 'Zoek zelf de lijn met de kleinste fout. Laat daarna de computer dezelfde zoektocht doen.',
      },
      {
        to: '/les1/hoe-goed-past-de-lijn',
        title: 'Hoe goed past de lijn?',
        soort: 'mini-demo',
        doel: 'Wat de score betekent',
        doen: 'Kantel de lijn en lees de score. Zo zie je wat 1,00 en 0,00 betekenen, en wanneer een score onder nul zakt.',
      },
    ],
  },
  {
    les: 'Les 2',
    titel: 'Data cleaning en preprocessing',
    tint: 'var(--color-peri)',
    demos: [
      {
        to: '/les2/data-dokter',
        title: 'Data-dokter',
        soort: 'simulator',
        doel: 'Jij beslist welke rijen het model mag gebruiken',
        doen: 'Klik de rijen weg die je niet vertrouwt. De fout wordt gemeten bij mensen die niet op het bord staan, dus een goede rij weggooien maakt je model slechter.',
      },
    ],
  },
  {
    les: 'Les 3',
    titel: 'Classificatie en logistische regressie',
    tint: 'var(--color-mint)',
    /* Twee borden in deze les, en ze staan in deze volgorde omdat de tweede
       verder bouwt op de eerste: eerst zie je waar een kans vandaan komt,
       daarna knip je die kans door. De doelen mogen dus niet op elkaar lijken -
       "hoe wordt de kans gemaakt" tegen "wat kost een grens".

       BEIDE DOELEN BEGINNEN MET "JIJ", en dat is het onderscheid dat een
       leerkracht van deze kaarten af moet kunnen lezen: wat doe JIJ op dat
       bord. Bouwen tegen leggen. Dat is hetzelfde werkwoord als in de eerste
       regel van de Brief op het bord zelf ("Jij bouwt zelf de curve ..." en
       "Sleep de grens tussen rotsblok en mijn ..."), alleen korter, want een
       kaart is geen opdracht. Wie het werkwoord op een van de twee plekken
       verandert, verandert het op de andere mee. */
    demos: [
      {
        to: '/les3/van-getal-naar-kans',
        title: 'Van getal naar kans',
        soort: 'mini-demo',
        doel: 'Jij bouwt de curve die van een getal een kans maakt',
        doen: 'De curve zet de groenwaarde van een rij om in een kans. Sleep haar naar de beste plek en lees de zekerheid af. Laat daarna de computer dezelfde zoektocht doen.',
      },
      {
        to: '/les3/waar-leg-jij-de-grens',
        title: 'Waar leg jij de grens?',
        soort: 'mini-demo',
        doel: 'Jij legt de grens en kiest zo welke fout het model maakt',
        doen: 'Elke rij van de sonardata staat op één as, bij de kans die het model eraan geeft. Sleep de grens en lees af hoeveel mijnen en hoeveel rotsblokken het model mist. Er is geen grens die alles wint.',
      },
    ],
  },
  {
    les: 'Les 4',
    titel: 'Cijfers herkennen met MNIST',
    tint: 'var(--color-peach)',
    demos: [
      {
        /* De route volgt de titel op het bord, niet de bestandsnaam
           (VakjePerVakje.tsx): `pixel` is het woord van les 4 zelf. */
        to: '/les4/wat-telt-elke-pixel-mee',
        title: 'Wat telt elke pixel mee?',
        soort: 'mini-demo',
        doel: 'Het model gaf elke pixel een getal en telt die op',
        doen: 'Elke pixel met inkt krijgt een kleur: telt hij voor of tegen het cijfer dat je koos? Tel de rijtjes op en kijk welk cijfer het hoogste totaal haalt. Verschuif het beeldje daarna één pixel en tel opnieuw.',
      },
    ],
  },
  {
    les: 'Les 5',
    titel: 'Beslissingsbomen',
    tint: 'var(--color-lime-deep)',
    demos: [
      {
        /* Zelfde afspraak als bij les 4: de route volgt de titel op het bord,
           niet de bestandsnaam (KweekDeBoom.tsx). */
        to: '/les5/bouw-de-boom',
        title: 'Bouw de boom',
        soort: 'mini-demo',
        doel: 'De boom splitst door tot elke groep één klasse is',
        doen: 'Kies een vakje, kies een kenmerk en sleep de drempel. Splits de groep en lees af hoeveel voorbeelden nog fout staan. Vraag daarna wat de computer op dat vakje zou kiezen.',
      },
    ],
  },
  {
    les: 'Les 12',
    titel: 'Q-learning',
    tint: 'var(--color-sky)',
    demos: [
      {
        to: '/les12/kijk-in-de-q-tabel',
        title: 'Kijk in de q-tabel',
        soort: 'simulator',
        doel: 'De agent leert eerst bij de schat',
        doen: 'Zet één stap en kijk welk getal in de q-tabel verandert. Train daarna 500 episodes. De vakjes bij de schat kennen de weg als eerste, de start als laatste. Test op het einde wat de agent geleerd heeft.',
      },
    ],
  },
]

/* De doelen moeten verschillen, want een leerkracht kiest een bord van deze
   pagina af. Twee borden met hetzelfde doel zijn niet te kiezen, en dan is er
   ook één te veel. Alleen in dev, zodat het opvalt zodra iemand een bord
   toevoegt - de type-annotatie hierboven belooft dit al, maar controleert het
   niet. Genormaliseerd, anders glipt een verschil in hoofdletter of punt erdoor. */
if (import.meta.env.DEV) {
  const doelen = LESSONS.flatMap((l) => l.demos).map((d) =>
    d.doel.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(),
  )
  const dubbel = doelen.filter((d, i) => doelen.indexOf(d) !== i)
  if (dubbel.length > 0) {
    console.error('Twee borden hebben hetzelfde doel op de overzichtspagina:', dubbel)
  }
}

export default function Home() {
  return (
    <div className="h-full overflow-auto bg-white">
      <div className="mx-auto max-w-4xl px-6 py-14 sm:py-20">
        <span className="cf-tag ring-1 ring-navy/10">mAIstros 2</span>

        <h1 className="cf-display mt-5 text-4xl leading-[1.05] sm:text-5xl">
          Interactieve borden
          <br />
          <span className="text-ink">voor machine learning</span>
        </h1>

        <p className="mt-5 max-w-xl text-[16.5px] leading-relaxed text-ink">
          Elk bord leert één ding. Speel er eerst mee, schrijf het daarna in code. Je kan overal
          in- en uitzoomen en rondslepen, zoals op een kaart.
        </p>

        {LESSONS.map((l) => (
          <section key={l.les} className="mt-14">
            <div className="flex items-baseline gap-3">
              <span
                className="cf-display rounded-full px-4 py-1.5 text-[13px] uppercase tracking-wide"
                style={{ background: l.tint }}
              >
                {l.les}
              </span>
              <span className="text-[15.5px] font-semibold text-ink">{l.titel}</span>
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              {l.demos.map((d) => (
                <Link
                  key={d.to}
                  to={d.to}
                  /* Een simulator krijgt de volle breedte omdat er meer in
                     staat. Een bord dat als enige in zijn les staat krijgt ze
                     ook, want anders blijft de halve rij ernaast leeg: op
                     1024 px is dat 434 px niets, drie lessen op een rij. Dit
                     is een keuze over breedte en niet over soort - het
                     simulator-label hangt nog steeds aan `soort`. */
                  className={`cf-card group flex flex-col ring-1 ring-navy/12 ${
                    d.soort === 'simulator' || l.demos.length === 1 ? 'sm:col-span-2' : ''
                  }`}
                >
                  <span className="h-2 shrink-0" style={{ background: l.tint }} />
                  <span className="flex flex-1 flex-col p-6">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[12px] font-black uppercase tracking-[0.09em] text-ink/75">
                        Doel: {d.doel}
                      </span>
                      {d.soort === 'simulator' && (
                        <span className="rounded-full bg-navy/10 px-2 py-0.5 text-[10.5px] font-black uppercase tracking-wider text-navy">
                          simulator
                        </span>
                      )}
                    </span>
                    <span className="cf-display mt-1.5 text-[22px] leading-tight">{d.title}</span>
                    <span className="mt-2 flex-1 text-[15px] leading-relaxed text-ink">{d.doen}</span>
                    <span className="mt-5">
                      <span className="cf-pill">Open bord</span>
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}

        <p className="mt-16 border-t border-navy/12 pt-6 text-[14px] leading-relaxed text-ink">
          Gemaakt voor mAIstros 2. Bekijk een bord samen op het scherm en probeer daarna hetzelfde in
          je notebook.
        </p>
      </div>
    </div>
  )
}
