import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import bcrypt from 'bcryptjs'
import { supabase } from '../lib/supabaseClient'
import useAuth from '../lib/useAuth'

const roleRedirectMap = {
  admin: '/admin',
  cliente: '/cliente',
  fotografo: '/fotografo',
}

export default function Login() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { saveSession } = useAuth()

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    const normalizedIdentifier = identifier.trim()

    if (!normalizedIdentifier || !password) {
      setError('Debes ingresar tu usuario/correo y contraseña.')
      return
    }

    setLoading(true)
    try {
      const { data: user, error: supabaseError } = await supabase
        .from('usuario')
        .select('id, username, correo, contrasena_hash, rol')
        .or(`username.eq.${normalizedIdentifier},correo.eq.${normalizedIdentifier}`)
        .single()

      if (supabaseError || !user) {
        throw new Error('Usuario no encontrado.')
      }

      const valid = await bcrypt.compare(password, user.contrasena_hash)
      if (!valid) {
        throw new Error('Contraseña incorrecta.')
      }

      const sessionUser = {
        id: user.id,
        username: user.username,
        correo: user.correo,
        rol: user.rol,
      }
      saveSession(sessionUser)

      const redirectFromState = location.state?.from
      const fallback = roleRedirectMap[user.rol] || '/'
      navigate(redirectFromState || fallback, { replace: true })
    } catch (err) {
      const message = err?.message || 'No se pudo iniciar sesión.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container-1120 py-10 grid place-items-center">
      <form onSubmit={handleSubmit} className="card p-6 w-full max-w-md grid gap-4">
        <h1 className="text-2xl font-display">Iniciar sesión</h1>
        <p className="text-sm muted">
          Usa tu nombre de usuario o correo electrónico para acceder.
        </p>
        <label className="grid gap-1">
          <span className="text-sm font-semibold">Usuario o correo</span>
          <input
            type="text"
            className="w-full border rounded-xl2 px-3 py-2"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label className="grid gap-1">
          <span className="text-sm font-semibold">Contraseña</span>
          <input
            type="password"
            className="w-full border rounded-xl2 px-3 py-2"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Ingresando…' : 'Ingresar'}
        </button>
        <p className="text-xs muted text-center">
          ¿Aún no tienes cuenta?{' '}
          <Link to="/register" className="font-semibold text-umber">
            Regístrate
          </Link>
        </p>
      </form>
    </div>
  )
}
