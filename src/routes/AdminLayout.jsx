import { useEffect, useState } from 'react'
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
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth >= 1024
  })

  useEffect(() => {
    const handleResize = () => {
      if (typeof window === 'undefined') return
      setSidebarOpen(window.innerWidth >= 1024)
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-sand">
      <header className="bg-white border-b border-[var(--border)]">
        <div className="container-1120 flex flex-wrap items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(prev => !prev)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#e4ddcc] bg-[#faf8f4] text-umber shadow-sm transition hover:bg-[#f1ede9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-umber/30 lg:hidden"
              aria-label={sidebarOpen ? 'Ocultar menú de navegación' : 'Mostrar menú de navegación'}
            >
              <span className="flex h-4 w-5 flex-col items-center justify-center gap-1">
                <span
                  className={`block h-[2px] w-full rounded-full bg-current transition-transform duration-200 ${
                    sidebarOpen ? 'translate-y-[6px] rotate-45' : ''
                  }`}
                />
                <span
                  className={`block h-[2px] w-full rounded-full bg-current transition-opacity duration-200 ${
                    sidebarOpen ? 'opacity-0' : 'opacity-100'
                  }`}
                />
                <span
                  className={`block h-[2px] w-full rounded-full bg-current transition-transform duration-200 ${
                    sidebarOpen ? '-translate-y-[6px] -rotate-45' : ''
                  }`}
                />
              </span>
            </button>
            <div>
              <Link to="/admin" className="text-2xl font-display text-umber">Panel administrativo</Link>
              <p className="muted text-sm">Gestiona toda la operación desde un solo lugar.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm md:text-base">
            <span className="muted">Conectado como <b>{user?.name}</b> ({user?.role})</span>
            <button type="button" onClick={handleLogout} className="btn btn-primary">Cerrar sesión</button>
          </div>
        </div>
      </header>
      <div className="container-1120 flex flex-col gap-6 py-6 lg:grid lg:grid-cols-[260px,1fr] lg:items-start">
        <div
          className={`overflow-hidden transition-all duration-300 ease-out lg:overflow-visible ${
            sidebarOpen
              ? 'max-h-[2000px] opacity-100 pointer-events-auto'
              : 'max-h-0 opacity-0 pointer-events-none lg:max-h-none lg:opacity-100 lg:pointer-events-auto'
          }`}
        >
          <aside className="card p-4 space-y-4 lg:sticky lg:top-6">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-umber">Navegación</h2>
              <nav className="mt-3 grid gap-2 text-sm">
                {NAV_ITEMS.map(item => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) => `btn ${isActive ? 'btn-primary' : 'btn-ghost'} justify-start`}
                    onClick={() => {
                      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                        setSidebarOpen(false)
                      }
                    }}
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
        </div>
        <section className="space-y-6 pb-12">
          <Outlet />
        </section>
      </div>
    </div>
  )
}
