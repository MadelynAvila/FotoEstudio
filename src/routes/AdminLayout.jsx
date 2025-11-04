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
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth >= 1024
  })
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth >= 1024
  })

  useEffect(() => {
    const handleResize = () => {
      if (typeof window === 'undefined') return
      const desktop = window.innerWidth >= 1024
      setIsDesktop(desktop)
      setSidebarOpen(desktop)
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
      <button
        type="button"
        onClick={() => setSidebarOpen(prev => (isDesktop ? prev : !prev))}
        className={`admin-mobile-toggle lg:hidden ${sidebarOpen && !isDesktop ? 'is-open' : ''}`}
        aria-label={sidebarOpen ? 'Ocultar menú de navegación' : 'Mostrar menú de navegación'}
        aria-expanded={sidebarOpen}
      >
        <span aria-hidden="true">☰</span>
      </button>

      {sidebarOpen && !isDesktop && (
        <button
          type="button"
          aria-label="Cerrar menú de navegación"
          className="admin-mobile-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <header className="admin-topbar">
        <div className="container-1120 admin-topbar__content">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
            <Link to="/admin" className="admin-topbar__title">Panel administrativo</Link>
            <p className="admin-topbar__subtitle">Gestiona toda la operación desde un solo lugar.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm md:text-base">
            <span className="muted">Conectado como <b>{user?.name}</b> ({user?.role})</span>
            <button type="button" onClick={handleLogout} className="btn btn-primary">Cerrar sesión</button>
          </div>
        </div>
      </header>

      <div className="container-1120 admin-shell">
        <aside className={`admin-sidebar ${sidebarOpen ? 'is-open' : ''}`}>
          <div className="card p-4 space-y-4 lg:sticky lg:top-24">
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
                      if (!isDesktop) {
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
          </div>
        </aside>

        <section className="space-y-6 pb-12">
          <Outlet />
        </section>
      </div>
    </div>
  )
}
