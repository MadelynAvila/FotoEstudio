import { Link, NavLink } from 'react-router-dom'
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

  const tabs = [
    { to:'/', label:'Inicio' },
    { to:'/portafolio', label:'Portafolio' },
    { to:'/servicios', label:'Servicios' },
    { to:'/paquetes', label:'Paquetes' },
    { to:'/reservar', label:'Reservar', cta:true },
  ]

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-white/90 backdrop-blur-xl">
      <div className="container-1120 py-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <Link to="/" className="flex items-center gap-3">
          <img src="/img/logo-mark.svg" alt="Aguín Fotografía" className="h-12 w-12 rounded-2xl shadow-sm shadow-umber/15"/>
          <div className="flex flex-col leading-tight">
            <span className="text-base font-semibold uppercase tracking-[0.3em] text-slate-500">Aguín</span>
            <span className="text-2xl font-display text-umber -mt-1">Fotografía</span>
          </div>
        </Link>
        <nav className="w-full md:w-auto">
          <ul className="flex flex-wrap items-center gap-2 md:justify-end">
            {tabs.map(t => (
              <li key={t.to}>
                <NavLink
                  to={t.to}
                  className={({isActive}) => {
                    if (t.cta) {
                      return `btn ${isActive ? 'btn-primary' : 'btn-primary'}`
                    }
                    const base = 'px-4 py-2 rounded-full font-medium text-sm border border-transparent hover:border-[color:var(--border)] hover:bg-white'
                    return `${base} ${isActive ? 'bg-umber text-white shadow-md' : 'bg-white/60 text-slate-600 hover:text-umber backdrop-blur'} `
                  }}
                >{t.label}</NavLink>
              </li>
            ))}
            {!user && (
              <li>
                <NavLink to="/login" className="btn btn-ghost text-sm md:text-base">Iniciar sesión</NavLink>
              </li>
            )}
            {user && (
              <>
                <li>
                  <NavLink
                    to={isAdminRole(user.role) ? '/admin' : '/mi-cuenta'}
                    className="btn btn-ghost text-sm md:text-base border border-[color:var(--border)] bg-white/80 hover:bg-white"
                  >
                    {isAdminRole(user.role) ? 'Administración' : 'Mi cuenta'}
                  </NavLink>
                </li>
                <li>
                  <button className="btn btn-ghost text-sm md:text-base" onClick={logout}>Salir</button>
                </li>
              </>
            )}
          </ul>
        </nav>
      </div>
    </header>
  )
}
