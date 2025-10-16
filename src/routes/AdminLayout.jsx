import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/authContext'

const NAV_ITEMS = [
  { to: '/admin', label: 'Inicio', end: true },
  { to: '/admin/reservas', label: 'Reservas' },
  { to: '/admin/clientes', label: 'Clientes' },
  { to: '/admin/fotografos', label: 'Fotógrafos' },
  { to: '/admin/servicios', label: 'Servicios' },
  { to: '/admin/paquetes', label: 'Paquetes' },
  { to: '/admin/galeria', label: 'Galería' },
  { to: '/admin/pagos', label: 'Pagos' },
  { to: '/admin/resenas', label: 'Reseñas' }
]

export default function AdminLayout(){
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-sand">
      <header className="bg-white border-b border-[var(--border)]">
        <div className="container-1120 flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Link to="/admin" className="text-2xl font-display text-umber">Panel administrativo</Link>
            <p className="muted text-sm">Gestiona toda la operación desde un solo lugar.</p>
          </div>
          <div className="flex items-center gap-3 text-sm md:text-base">
            <span className="muted">Conectado como <b>{user?.name}</b> ({user?.role})</span>
            <button type="button" onClick={handleLogout} className="btn btn-primary">Cerrar sesión</button>
          </div>
        </div>
      </header>
      <div className="container-1120 grid gap-6 py-6 lg:grid-cols-[260px,1fr]">
        <aside className="card p-4 h-fit top-4 space-y-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-umber">Navegación</h2>
            <nav className="mt-3 grid gap-2 text-sm">
              {NAV_ITEMS.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `btn ${isActive ? 'btn-primary' : 'btn-ghost'} justify-start`}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="rounded-xl2 border border-dashed border-umber/40 bg-white/70 p-3 text-xs text-slate-500">
            ¿Necesitas volver al sitio público? <Link to="/" className="font-semibold text-umber">Ir al inicio</Link>
          </div>
        </aside>
        <section className="pb-12 space-y-6">
          <Outlet />
        </section>
      </div>
    </div>
  )
}
