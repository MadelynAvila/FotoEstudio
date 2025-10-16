import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/authContext'

export default function Login(){
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { login } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)
    const res = await login(identifier, password)
    setIsSubmitting(false)
    if(res.ok){
      const to = (loc.state && loc.state.from) || '/admin'
      nav(to, { replace:true })
      return
    }
    setError(res.error)
  }

  return (
    <div className="container-1120 py-10 grid place-items-center">
      <form onSubmit={onSubmit} className="card p-6 w-full max-w-md grid gap-3">
        <h1 className="text-2xl font-display">Iniciar sesión</h1>
        <label className="grid gap-1">
          <span className="text-sm font-semibold">Usuario o correo</span>
          <input
            className="w-full border rounded-xl2 px-3 py-2"
            value={identifier}
            onChange={e=>setIdentifier(e.target.value)}
            placeholder="Ingresa tu usuario o correo"
            autoComplete="username"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-sm font-semibold">Contraseña</span>
          <input
            type="password"
            className="w-full border rounded-xl2 px-3 py-2"
            value={password}
            onChange={e=>setPassword(e.target.value)}
            placeholder="Contraseña"
            autoComplete="current-password"
          />
        </label>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Ingresando...' : 'Ingresar'}
        </button>
        <p className="text-xs muted">
          Puedes usar tu <b>nombre de usuario</b> o tu <b>correo electrónico</b> para iniciar sesión.
        </p>
      </form>
    </div>
  )
}
