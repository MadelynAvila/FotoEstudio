import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/authContext'

export default function Login(){
  const [email, setEmail] = useState('admin@aguin.com')
  const [password, setPassword] = useState('admin123')
  const [error, setError] = useState('')
  const { login } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()

  const onSubmit = (e) => {
    e.preventDefault()
    const res = login(email, password)
    if(res.ok){
      const to = (loc.state && loc.state.from) || '/admin'
      nav(to, { replace:true })
    }else{
      setError(res.error)
    }
  }

  return (
    <div className="container-1120 py-10 grid place-items-center">
      <form onSubmit={onSubmit} className="card p-6 w-full max-w-md grid gap-3">
        <h1 className="text-2xl font-display">Iniciar sesión</h1>
        <label className="grid gap-1">
          <span className="text-sm font-semibold">Correo</span>
          <input className="w-full border rounded-xl2 px-3 py-2" value={email} onChange={e=>setEmail(e.target.value)} />
        </label>
        <label className="grid gap-1">
          <span className="text-sm font-semibold">Contraseña</span>
          <input type="password" className="w-full border rounded-xl2 px-3 py-2" value={password} onChange={e=>setPassword(e.target.value)} />
        </label>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button className="btn btn-primary">Ingresar</button>
        <p className="text-xs muted">Usuarios de prueba: admin@aguin.com/admin123 · user@aguin.com/user123</p>
      </form>
    </div>
  )
}
