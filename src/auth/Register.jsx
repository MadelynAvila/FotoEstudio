import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import bcrypt from 'bcryptjs'
import { supabase } from '../lib/supabaseClient'

export default function Register() {
  const [form, setForm] = useState({ username: '', correo: '', password: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const updateField = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    const username = form.username.trim()
    const correo = form.correo.trim().toLowerCase()
    const password = form.password

    if (!username || !correo || !password) {
      setError('Todos los campos son obligatorios.')
      return
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    setLoading(true)
    try {
      const hash = await bcrypt.hash(password, 10)

      const { data: user, error: userError } = await supabase
        .from('usuario')
        .insert([{ username, correo, contrasena_hash: hash, rol: 'cliente' }])
        .select('id, username, correo, rol')
        .single()

      if (userError) throw userError

      const { error: clientError } = await supabase.from('cliente').insert([
        {
          nombrecompleto: username,
          correo,
          idusuario: user.id,
        },
      ])

      if (clientError) throw clientError

      setSuccess('Cuenta creada correctamente. Te redirigiremos al inicio de sesión.')
      setTimeout(() => navigate('/login'), 1600)
    } catch (err) {
      const message = err?.message || 'No se pudo completar el registro.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container-1120 py-10 grid place-items-center">
      <form onSubmit={handleSubmit} className="card p-6 w-full max-w-md grid gap-4">
        <h1 className="text-2xl font-display">Crear cuenta</h1>
        <p className="text-sm muted">
          Regístrate para reservar sesiones y gestionar tus servicios personalizados.
        </p>
        <label className="grid gap-1">
          <span className="text-sm font-semibold">Nombre de usuario</span>
          <input
            type="text"
            className="w-full border rounded-xl2 px-3 py-2"
            value={form.username}
            onChange={updateField('username')}
            autoComplete="username"
            required
          />
        </label>
        <label className="grid gap-1">
          <span className="text-sm font-semibold">Correo</span>
          <input
            type="email"
            className="w-full border rounded-xl2 px-3 py-2"
            value={form.correo}
            onChange={updateField('correo')}
            autoComplete="email"
            required
          />
        </label>
        <label className="grid gap-1">
          <span className="text-sm font-semibold">Contraseña</span>
          <input
            type="password"
            className="w-full border rounded-xl2 px-3 py-2"
            value={form.password}
            onChange={updateField('password')}
            autoComplete="new-password"
            required
          />
        </label>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {success && <p className="text-emerald-600 text-sm">{success}</p>}
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Creando cuenta…' : 'Registrarme'}
        </button>
        <p className="text-xs muted text-center">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="font-semibold text-umber">
            Inicia sesión
          </Link>
        </p>
      </form>
    </div>
  )
}
