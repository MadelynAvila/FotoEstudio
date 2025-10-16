import useAuth from '../lib/useAuth'

export default function FotografoDashboard() {
  const { user } = useAuth()

  return (
    <div className="container-1120 py-10 space-y-4">
      <h1 className="text-3xl font-display text-umber">Bienvenido, {user?.username ?? 'fotógrafo'}</h1>
      <p className="muted">
        Gestiona tus sesiones asignadas, entrega de galerías y disponibilidad desde este panel.
      </p>
      <div className="card p-6 space-y-3">
        <h2 className="text-xl font-semibold">Próximos pasos</h2>
        <p className="muted text-sm">
          Integra tus calendarios y comparte avances con los clientes para ofrecer una experiencia impecable.
        </p>
      </div>
    </div>
  )
}
