import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './auth/authContext'
import PublicLayout from './routes/PublicLayout'
import AdminLayout from './routes/AdminLayout'
import ProtectedRoute from './routes/ProtectedRoute'

import Home from './pages/Home'
import Portfolio from './pages/Portfolio'
import Services from './pages/Services'
import Packages from './pages/Packages'
import Booking from './pages/Booking'
import Login from './pages/Login'
import Register from './pages/Register'
import Reviews from './pages/Reviews'
import MiCuenta from './pages/MiCuenta'
import AdminDashboard from './pages/AdminDashboard'
import AdminReservations from './pages/AdminReservations'
import AdminGallery from './pages/AdminGallery'
import AdminPackages from './pages/AdminPackages'
import AdminClients from './pages/AdminClients'
import AdminPhotographers from './pages/AdminPhotographers'
import AdminServices from './pages/AdminServices'
import AdminPayments from './pages/AdminPayments'
import AdminReviews from './pages/AdminReviews'

export default function App(){
  return (
    <AuthProvider>
      <Routes>
        {/* Sitio público */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/portafolio" element={<Portfolio />} />
          <Route path="/servicios" element={<Services />} />
          <Route path="/paquetes" element={<Packages />} />
          <Route path="/resenas" element={<Reviews />} />
          <Route path="/reservar" element={<Booking />} />
          <Route path="/login" element={<Login />} />
          <Route path="/registrarse" element={<Register />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/mi-cuenta" element={<MiCuenta />} />
          </Route>
        </Route>

        {/* Panel admin (protegido, solo admin) */}
        <Route element={<ProtectedRoute roles={["admin", "administrador", "fotografo", "fotógrafo", "photographer"]} />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/reservas" element={<AdminReservations />} />
            <Route path="/admin/clientes" element={<AdminClients />} />
            <Route path="/admin/fotografos" element={<AdminPhotographers />} />
            <Route path="/admin/servicios" element={<AdminServices />} />
            <Route path="/admin/paquetes" element={<AdminPackages />} />
            <Route path="/admin/galeria" element={<AdminGallery />} />
            <Route path="/admin/pagos" element={<AdminPayments />} />
            <Route path="/admin/resenas" element={<AdminReviews />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  )
}
