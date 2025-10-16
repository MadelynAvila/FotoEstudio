import { Navigate, Outlet, useLocation } from 'react-router-dom'
import useAuth from '../lib/useAuth'

export default function ProtectedRoute({ roles, redirectTo = '/login' }) {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) {
    return <Navigate to={redirectTo} replace state={{ from: location.pathname }} />
  }

  if (Array.isArray(roles) && roles.length > 0 && !roles.includes(user.rol)) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
