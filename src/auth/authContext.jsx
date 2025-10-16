import { createContext, useContext, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)
const STORAGE_KEY = 'fotoestudio.auth.user'

const getStoredUser = () => {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (error) {
    console.error('Auth: no se pudo leer el usuario almacenado', error)
    return null
  }
}

const verifyPassword = async (storedHash, password) => {
  if (!storedHash) return false
  if (storedHash.startsWith('$2')) {
    console.warn('Auth: se detectó un hash bcrypt, agrega una librería de verificación para soportarlo')
    return false
  }
  return storedHash === password
}

export function AuthProvider({ children }){
  const [user, setUser] = useState(() => getStoredUser())

  const login = async (identifier, password) => {
    const trimmedIdentifier = identifier.trim()
    if (!trimmedIdentifier || !password) {
      return { ok: false, error: 'Ingresa tu usuario y contraseña.' }
    }

    const isEmail = trimmedIdentifier.includes('@')
    const normalizedIdentifier = trimmedIdentifier

    const { data, error } = await supabase
      .from('usuario')
      .select(`
        id,
        username,
        correo,
        contrasena_hash,
        estado,
        rol:rol(nombre)
      `)
      .eq(isEmail ? 'correo' : 'username', normalizedIdentifier)
      .maybeSingle()

    if (error) {
      console.error('Auth: error al buscar el usuario', error)
      return { ok: false, error: 'No se pudo iniciar sesión. Intenta nuevamente.' }
    }

    if (!data) {
      return { ok: false, error: 'Usuario no encontrado.' }
    }

    if (data.estado && data.estado !== 'activo') {
      return { ok: false, error: 'Tu cuenta está inactiva. Contacta al administrador.' }
    }

    const passwordIsValid = await verifyPassword(data.contrasena_hash, password)
    if (!passwordIsValid) {
      return { ok: false, error: 'Contraseña incorrecta.' }
    }

    const sessionUser = {
      id: data.id,
      username: data.username,
      email: data.correo,
      role: data.rol?.nombre || 'usuario',
      name: data.username || data.correo
    }

    setUser(sessionUser)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionUser))
    } catch (storageError) {
      console.error('Auth: no se pudo guardar la sesión', storageError)
    }

    return { ok: true }
  }

  const logout = () => {
    setUser(null)
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(STORAGE_KEY)
      } catch (error) {
        console.error('Auth: no se pudo limpiar la sesión', error)
      }
    }
  }

  const value = useMemo(() => ({ user, login, logout }), [user])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(){ return useContext(AuthContext) }
