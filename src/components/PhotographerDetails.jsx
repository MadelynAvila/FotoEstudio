function formatDate(value) {
  if (!value) return 'Sin fecha'
  try {
    return new Date(value).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  } catch (error) {
    console.error('No se pudo formatear la fecha', error)
    return String(value)
  }
}

function formatTime(value) {
  if (!value) return '—'
  const [horas, minutos] = String(value).split(':')
  const h = Number(horas)
  const m = Number(minutos)
  if (Number.isNaN(h) || Number.isNaN(m)) {
    return String(value)
  }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function firstItem(value) {
  if (!value) return null
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

function formatHorario(fecha, inicio, fin) {
  if (!fecha && !inicio && !fin) return 'Horario sin definir'
  const fechaTexto = fecha ? formatDate(fecha) : ''
  const inicioTexto = formatTime(inicio)
  const finTexto = formatTime(fin)
  if (fechaTexto && inicioTexto && finTexto) {
    return `${fechaTexto} · ${inicioTexto} - ${finTexto}`
  }
  if (fechaTexto) return fechaTexto
  if (inicioTexto !== '—' || finTexto !== '—') {
    return `${inicioTexto}${finTexto !== '—' ? ` - ${finTexto}` : ''}`
  }
  return 'Horario sin definir'
}

export default function PhotographerDetails({
  fotografo,
  agenda,
  actividades,
  resenas,
  promedio,
  loading,
  error,
  onClose
}) {
  return (
    <div className="card p-5 space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-umber">Detalles del fotógrafo</h2>
          <p className="muted text-sm">
            {fotografo
              ? `Agenda, actividades y reseñas para ${fotografo.nombrecompleto}.`
              : 'Selecciona un fotógrafo para revisar su disponibilidad y desempeño.'}
          </p>
        </div>
        {fotografo ? (
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cerrar detalles
          </button>
        ) : null}
      </header>

      {!fotografo ? (
        <p className="muted text-sm">Elige un fotógrafo de la lista para ver su agenda, actividades y reseñas.</p>
      ) : loading ? (
        <p className="muted text-sm">Cargando detalles…</p>
      ) : (
        <div className="space-y-6">
          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <section className="grid gap-3 sm:grid-cols-2">
            <div>
              <span className="muted text-xs uppercase">Nombre</span>
              <p className="font-medium text-slate-700">{fotografo.nombrecompleto}</p>
            </div>
            <div>
              <span className="muted text-xs uppercase">Correo</span>
              <p className="font-medium text-slate-700">{fotografo.correo || '—'}</p>
            </div>
            <div>
              <span className="muted text-xs uppercase">Teléfono</span>
              <p className="font-medium text-slate-700">{fotografo.telefono || '—'}</p>
            </div>
            <div>
              <span className="muted text-xs uppercase">Estado</span>
              <p className="font-medium text-slate-700">{fotografo.estado === 'inactivo' ? 'Inactivo' : 'Activo'}</p>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold text-slate-700">Agenda</h3>
              <span className="text-xs text-slate-500">{agenda.length} {agenda.length === 1 ? 'registro' : 'registros'}</span>
            </div>
            {agenda.length ? (
              <ul className="space-y-2">
                {agenda.map(item => (
                  <li key={item.id} className="rounded-xl2 border px-4 py-3">
                    <p className="font-medium text-slate-700">{formatHorario(item.fecha, item.horainicio, item.horafin)}</p>
                    <p className="text-xs text-slate-500">
                      {item.disponible ? 'Disponible' : 'Reservado'}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted text-sm">No hay horarios registrados en la agenda.</p>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold text-slate-700">Actividades asignadas</h3>
              <span className="text-xs text-slate-500">{actividades.length} {actividades.length === 1 ? 'actividad' : 'actividades'}</span>
            </div>
            {actividades.length ? (
              <ul className="space-y-3">
                {actividades.map(item => {
                  const agendaInfo = firstItem(item.agenda)
                  const clienteInfo = firstItem(item.cliente)
                  const paqueteInfo = firstItem(item.paquete)
                  const titulo = item.nombre_actividad || paqueteInfo?.nombre_paquete || 'Actividad sin nombre'
                  const clienteNombre = clienteInfo?.username || 'Cliente reservado'
                  return (
                    <li key={item.id} className="rounded-xl2 border p-4 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium text-slate-700">{titulo}</p>
                        <span className="text-xs rounded-full bg-sand px-2 py-1 text-slate-600 capitalize">
                          {item.estado_pago?.toLowerCase?.() || 'pendiente'}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600">{formatHorario(agendaInfo?.fecha, agendaInfo?.horainicio, agendaInfo?.horafin)}</p>
                      <p className="text-xs text-slate-500">Cliente: {clienteNombre}</p>
                      {item.ubicacion ? <p className="text-xs text-slate-500">Ubicación: {item.ubicacion}</p> : null}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="muted text-sm">No hay actividades asignadas para este fotógrafo.</p>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold text-slate-700">Reseñas</h3>
              <span className="text-xs text-slate-500">
                {typeof promedio === 'number' ? `Promedio: ${promedio.toFixed(1)} / 5` : 'Sin reseñas'}
              </span>
            </div>
            {resenas.length ? (
              <ul className="space-y-3">
                {resenas.map(item => {
                  const autorInfo = firstItem(item.autor)
                  const actividadInfo = firstItem(item.actividad)
                  const agendaInfo = firstItem(actividadInfo?.agenda)
                  const paqueteInfo = firstItem(actividadInfo?.paquete)
                  const titulo = actividadInfo?.nombre_actividad || paqueteInfo?.nombre_paquete || 'Actividad'
                  return (
                    <li key={item.id} className="rounded-xl2 border p-4 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium text-slate-700">{titulo}</p>
                        <span className="text-xs rounded-full bg-sand px-2 py-1 text-slate-600">{item.calificacion} / 5</span>
                      </div>
                      <p className="text-xs text-slate-500">{formatHorario(agendaInfo?.fecha, agendaInfo?.horainicio, agendaInfo?.horafin)}</p>
                      <p className="text-xs text-slate-500">Autor: {autorInfo?.username || 'Cliente'}</p>
                      {item.comentario ? <p className="text-sm text-slate-600">“{item.comentario}”</p> : null}
                      <p className="text-xs text-slate-400">{formatDate(item.fecha_resena)}</p>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="muted text-sm">Todavía no hay reseñas para este fotógrafo.</p>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
