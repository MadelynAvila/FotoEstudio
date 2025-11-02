import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/authContext'

const normalizeRole = role => {
  if(!role) return ''
  return role
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

const isAdminRole = role => {
  const normalized = normalizeRole(role)
  return ['admin', 'fotografo', 'photographer'].includes(normalized)
}

export default function Navbar(){
  const { user, logout } = useAuth()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  const tabs = [
    { to:'/', label:'Inicio' },
    { to:'/portafolio', label:'Portafolio' },
    { to:'/servicios', label:'Servicios' },
    { to:'/paquetes', label:'Paquetes' },
    { to:'/reservar', label:'Reservar', cta:true },
  ]

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  const buildNavClass = (isActive, isCta = false) => {
    const base = 'my-1 block rounded-[30px] px-4 py-2 text-[0.95rem] font-medium text-center transition-colors duration-200 md:my-0 md:inline-flex md:items-center md:justify-center'
    if (isCta) {
      return `${base} bg-[#3b302a] text-white shadow-md hover:bg-[#5a463c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5a463c]/40`
    }
    if (isActive) {
      return `${base} bg-white text-umber shadow-sm`
    }
    return `${base} bg-white/70 text-slate-700 hover:bg-white hover:text-umber`
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-white/90 backdrop-blur-xl">
      <div className="container-1120 flex flex-col gap-4 py-4 md:flex-row md:items-center md:justify-between">
        <div className="flex w-full items-center justify-between gap-4 md:w-auto">
          <Link to="/" className="mx-auto flex flex-col items-center text-center md:mx-0">
            <span className="block text-xs uppercase tracking-[0.35em] text-slate-500">Estudio</span>
            <span className="block text-3xl font-display text-umber leading-tight md:text-[2rem]">Aguín Fotografía</span>
          </Link>
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--border)] bg-white text-umber transition duration-200 hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5a463c]/40 md:hidden"
            aria-label={menuOpen ? 'Cerrar menú de navegación' : 'Abrir menú de navegación'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(prev => !prev)}
          >
            <span className="sr-only">{menuOpen ? 'Cerrar menú' : 'Abrir menú'}</span>
            <svg
              aria-hidden="true"
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {menuOpen ? (
                <path d="M6 18L18 6M6 6l12 12" />
              ) : (
                <>
                  <path d="M4 7h16" />
                  <path d="M4 12h16" />
                  <path d="M4 17h16" />
                </>
              )}
            </svg>
          </button>
        </div>
        <nav className={`mobile-nav ${menuOpen ? 'mobile-nav-open' : ''} md:w-auto`}>
          <ul className="flex flex-col items-center gap-2 py-2 md:flex-row md:flex-wrap md:justify-end md:gap-2 md:py-0">
            {tabs.map(t => (
              <li key={t.to}>
                <NavLink
                  to={t.to}
                  className={({isActive}) => buildNavClass(isActive, Boolean(t.cta))}
                  onClick={() => setMenuOpen(false)}
                >
                  {t.label}
                </NavLink>
              </li>
            ))}
            {!user && (
              <li>
                <NavLink
                  to="/login"
                  className={({isActive}) => buildNavClass(isActive)}
                  onClick={() => setMenuOpen(false)}
                >
                  Iniciar sesión
                </NavLink>
              </li>
            )}
            {user && (
              <>
                <li>
                  <NavLink
                    to={isAdminRole(user.role) ? '/admin' : '/mi-cuenta'}
                    className={({isActive}) => buildNavClass(isActive)}
                    onClick={() => setMenuOpen(false)}
                  >
                    {isAdminRole(user.role) ? 'Administración' : 'Mi cuenta'}
                  </NavLink>
                </li>
                <li>
                  <button
                    type="button"
                    className={buildNavClass(false)}
                    onClick={() => {
                      logout()
                      setMenuOpen(false)
                    }}
                  >
                    Salir
                  </button>
                </li>
              </>
            )}
          </ul>
        </nav>
      </div>
    </header>
  )
}
