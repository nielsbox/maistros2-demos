import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import RegressieLab from './demos/RegressieLab'
import TekenDeLijn from './demos/TekenDeLijn'
import HoeGoedPastDeLijn from './demos/HoeGoedPastDeLijn'
import DataDokter from './demos/DataDokter'

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
        {/*
          Een ingetrokken bord laat een link achter op een slide of in een oude
          bookmark. Zonder vangnet geeft Netlify hier 200 met een lege pagina,
          en dat leest voor een leerling als "het is stuk". Stuur ze naar de
          overzichtspagina, waar de vier borden staan.
        */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
