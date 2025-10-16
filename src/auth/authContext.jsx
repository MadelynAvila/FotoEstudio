import { createContext, useContext, useMemo, useState } from 'react'

const USERS = [
  { email: 'admin@aguin.com', password: 'admin123', role: 'admin', name: 'Administrador' },
  { email: 'user@aguin.com',  password: 'user123',  role: 'viewer', name: 'Usuario' }
]

const AuthContext = createContext(null)

export function AuthProvider({ children }){
  const [user, setUser] = useState(null)

  const login = (email, password) => {
    const found = USERS.find(u => u.email === email && u.password === password)
    if(found){ setUser({ email: found.email, role: found.role, name: found.name }); return { ok:true } }
    return { ok:false, error:'Credenciales inválidas' }
  }

  const logout = () => setUser(null)

  const value = useMemo(() => ({ user, login, logout }), [user])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(){ return useContext(AuthContext) }
