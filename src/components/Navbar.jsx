import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../auth/authContext'

export default function Navbar(){
  const { user, logout } = useAuth()

  const tabs = [
    { to:'/', label:'Inicio' },
    { to:'/portafolio', label:'Portafolio' },
    { to:'/servicios', label:'Servicios' },
    { to:'/paquetes', label:'Paquetes' },
    { to:'/resenas', label:'Reseñas' },
    { to:'/reservar', label:'Reservar' },
  ]

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[var(--border)]">
      <div className="container-1120 py-2 flex flex-col gap-2 md:flex-row md:items-center md:gap-6">
        <Link to="/" className="flex items-center gap-3 font-bold">
          <img src="/logo192.png" alt="Logo" className="h-10 w-10 rounded-full object-cover"/>
          <span>Aguín Fotografía</span>
        </Link>
        <nav className="flex-1">
          <ul className="flex flex-wrap gap-2 justify-end">
            {tabs.map(t => (
              <li key={t.to}>
                <NavLink
                  to={t.to}
                  className={({isActive})=>`px-3 py-2 font-semibold rounded-t-xl border border-[var(--border)] ${isActive?'bg-white border-b-4 border-b-umber':'bg-[rgba(246,242,234,0.25)] hover:bg-white'}`}
                >{t.label}</NavLink>
              </li>
            ))}
            {!user && (
              <li><NavLink to="/login" className="btn btn-ghost">Iniciar sesión</NavLink></li>
            )}
            {user && (
              <>
                <li><NavLink to={user.role==='admin' ? '/admin' : '/'} className="btn btn-primary">{user.role==='admin'?'Administración':'Mi cuenta'}</NavLink></li>
                <li><button className="btn btn-ghost" onClick={logout}>Salir</button></li>
              </>
            )}
          </ul>
        </nav>
      </div>
    </header>
  )
}
