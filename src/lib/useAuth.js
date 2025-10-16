import { useCallback, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'fotoestudio.session'

const readSession = () => {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (error) {
    console.error('useAuth: no se pudo leer la sesión almacenada', error)
    return null
  }
}

const writeSession = (value) => {
  if (typeof window === 'undefined') return
  if (value) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } else {
    window.localStorage.removeItem(STORAGE_KEY)
  }
  const eventName = 'auth-session-changed'
  if (typeof window.CustomEvent === 'function') {
    window.dispatchEvent(new CustomEvent(eventName))
  } else {
    window.dispatchEvent(new Event(eventName))
  }
}

export default function useAuth() {
  const [session, setSession] = useState(() => readSession())

  useEffect(() => {
    if (typeof window === 'undefined') return () => {}
    const handleStorage = (event) => {
      if (event.key && event.key !== STORAGE_KEY) return
      setSession(readSession())
    }
    const handleCustom = () => setSession(readSession())
    window.addEventListener('storage', handleStorage)
    window.addEventListener('auth-session-changed', handleCustom)
    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('auth-session-changed', handleCustom)
    }
  }, [])

  const saveSession = useCallback((value) => {
    setSession(value)
    writeSession(value)
  }, [])

  const clearSession = useCallback(() => {
    setSession(null)
    writeSession(null)
  }, [])

  return useMemo(
    () => ({
      user: session,
      isAuthenticated: Boolean(session),
      saveSession,
      clearSession,
    }),
    [session, saveSession, clearSession]
  )
}
