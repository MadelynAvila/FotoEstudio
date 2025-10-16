import useAuth from '../lib/useAuth'

export default function ClienteDashboard() {
  const { user } = useAuth()

  return (
    <div className="container-1120 py-10 space-y-4">
      <h1 className="text-3xl font-display text-umber">Hola, {user?.username ?? 'cliente'}</h1>
      <p className="muted">
        Desde aquí podrás revisar tus reservas, tus paquetes fotográficos y tus próximas sesiones.
      </p>
      <div className="card p-6 space-y-3">
        <h2 className="text-xl font-semibold">Resumen rápido</h2>
        <p className="muted text-sm">
          Este panel está listo para conectarse con los módulos de reservas y pagos.
        </p>
      </div>
    </div>
  )
}
