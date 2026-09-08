import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import RegressieLab from './demos/RegressieLab'
import TekenDeLijn from './demos/TekenDeLijn'
import HoeGoedPastDeLijn from './demos/HoeGoedPastDeLijn'
import DataDokter from './demos/DataDokter'
import WaarLegJijDeGrens from './demos/WaarLegJijDeGrens'
/* Het bord heet "Pixel per pixel" - zo staat het in de Brief, en `pixel` is
   het woord van les 4 zelf (slide 2128303). De bestandsnaam is ouder dan die
   titel. Een leerling leest de route en de titel, nooit de bestandsnaam, dus
   volgt de route de titel. */
import VakjePerVakje from './demos/VakjePerVakje'
import WaarLegtDeBoomZijnGrens from './demos/WaarLegtDeBoomZijnGrens'
import KijkInDeQTabel from './demos/KijkInDeQTabel'

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
        {/* les 3 */}
        <Route path="/les3/waar-leg-jij-de-grens" element={<WaarLegJijDeGrens />} />
        {/* les 4 */}
        <Route path="/les4/pixel-per-pixel" element={<VakjePerVakje />} />
        {/* les 5 */}
        <Route path="/les5/waar-legt-de-boom-zijn-grens" element={<WaarLegtDeBoomZijnGrens />} />
        {/* les 12 */}
        <Route path="/les12/kijk-in-de-q-tabel" element={<KijkInDeQTabel />} />
        {/*
          Een ingetrokken bord laat een link achter op een slide of in een oude
          bookmark. Zonder vangnet geeft de host hier 200 met een lege pagina,
          en dat leest voor een leerling als "het is stuk". Stuur ze naar de
          overzichtspagina, waar alle borden staan. Deze route MOET de laatste
          blijven: hij vangt alles, dus elk bord eronder is onbereikbaar.
        */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
