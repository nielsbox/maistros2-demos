import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import RegressieLab from './demos/RegressieLab'
import TekenDeLijn from './demos/TekenDeLijn'
import HoeGoedPastDeLijn from './demos/HoeGoedPastDeLijn'
import DataDokter from './demos/DataDokter'
import VanGetalNaarKans from './demos/VanGetalNaarKans'
import WaarLegJijDeGrens from './demos/WaarLegJijDeGrens'
/* Het bord heet "Wat telt elke pixel mee?" - zo staat het in de Brief, en
   `pixel` is het woord van les 4 zelf (slide 2128303). De bestandsnaam is
   ouder dan die titel. Een leerling leest de route en de titel, nooit de
   bestandsnaam, dus volgt de route de titel. */
import VakjePerVakje from './demos/VakjePerVakje'
/* Zelfde afspraak: het bord heet "Bouw de boom", het bestand KweekDeBoom.tsx. */
import KweekDeBoom from './demos/KweekDeBoom'
import KijkInDeQTabel from './demos/KijkInDeQTabel'
import StemmendBos from './demos/StemmendBos'
import KMeansStappen from './demos/KMeansStappen'
import HoeveelClusters from './demos/HoeveelClusters'
import WaarKomtDeKnikVandaan from './demos/WaarKomtDeKnikVandaan'
import EenNeuronZoektZijnGetal from './demos/EenNeuronZoektZijnGetal'
import KiesDeLeersnelheid from './demos/KiesDeLeersnelheid'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        {/* les 1: the simulator first, then the two single-idea boards */}
        <Route path="/les1/regressie-lab" element={<RegressieLab />} />
        <Route path="/les1/teken-de-lijn" element={<TekenDeLijn />} />
        <Route path="/les1/hoe-goed-past-de-lijn" element={<HoeGoedPastDeLijn />} />
        {/* les 2 */}
        <Route path="/les2/data-dokter" element={<DataDokter />} />
        {/* les 3: eerst hoe de kans gemaakt wordt, dan waar je hem doorknipt */}
        <Route path="/les3/van-getal-naar-kans" element={<VanGetalNaarKans />} />
        <Route path="/les3/waar-leg-jij-de-grens" element={<WaarLegJijDeGrens />} />
        {/* les 4 */}
        <Route path="/les4/wat-telt-elke-pixel-mee" element={<VakjePerVakje />} />
        {/* les 5 */}
        <Route path="/les5/bouw-de-boom" element={<KweekDeBoom />} />
        {/* les 6: de route volgt de titel op het bord (StemmendBos.tsx) */}
        <Route path="/les6/het-bos-stemt" element={<StemmendBos />} />
        {/* les 7: idem (KMeansStappen.tsx) */}
        <Route path="/les7/k-means-stap-voor-stap" element={<KMeansStappen />} />
        {/* les 7, het tweede bord: hoeveel clusters k-means maakt (HoeveelClusters.tsx) */}
        <Route path="/les7/hoeveel-clusters" element={<HoeveelClusters />} />
        {/* les 8: waar de knik in de grafiek van de inertia vandaan komt */}
        <Route path="/les8/waar-komt-de-knik-vandaan" element={<WaarKomtDeKnikVandaan />} />
        {/* les 9: idem (EenNeuronZoektZijnGetal.tsx) */}
        <Route path="/les9/een-neuron-zoekt-zijn-getal" element={<EenNeuronZoektZijnGetal />} />
        {/* les 10 */}
        <Route path="/les10/kies-de-leersnelheid" element={<KiesDeLeersnelheid />} />
        {/* les 12 */}
        <Route path="/les12/kijk-in-de-q-tabel" element={<KijkInDeQTabel />} />
        {/*
          Een ingetrokken bord laat een link achter op een slide of in een oude
          bookmark. Zonder vangnet geeft de host hier 200 met een lege pagina,
          en dat leest voor een leerling als "het is stuk". Stuur ze naar de
          overzichtspagina, waar alle borden staan. Deze route MOET de laatste
          blijven: hij vangt alles, dus elk bord eronder is onbereikbaar.

          Wat hij nu opvangt: /les4/pixel-per-pixel en
          /les5/waar-legt-de-boom-zijn-grens. Het eerste bord bestaat nog maar
          heet nu anders, het tweede is ingetrokken. Geen enkele slide linkt
          naar die twee paden - nagegaan over alle 78 slides van les 5 (4598).
        */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
