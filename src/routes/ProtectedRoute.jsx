import { Navigate, Outlet } from 'react-router-dom'
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

export default function ProtectedRoute({ roles }){
  const { user } = useAuth()
  if(!user) return <Navigate to="/login" replace />

  if(roles?.length){
    const allowed = roles.map(normalizeRole)
    const userRole = normalizeRole(user.role)
    if(!allowed.includes(userRole)) return <Navigate to="/" replace />
  }

  return <Outlet />
}
