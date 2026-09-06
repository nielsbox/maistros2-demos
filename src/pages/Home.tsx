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
                  className={`cf-card group flex flex-col ring-1 ring-navy/12 ${
                    d.soort === 'simulator' ? 'sm:col-span-2' : ''
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
