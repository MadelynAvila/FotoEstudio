import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/authContext'
import { supabase } from '../lib/supabaseClient'

const defaultReviewForm = { calificacion: '5', comentario: '' }

const ensureArray = (value) => {
  if (!value) return []
  if (Array.isArray(value)) return value
  return [value]
}

const normalizeSingle = (value) => {
  if (!value) return null
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

const parseDate = (dateString) => {
  if (!dateString) return null
  const value = typeof dateString === 'string' && dateString.includes('T')
    ? dateString
    : `${dateString}T00:00:00`
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date
}

const formatDate = (dateString, variant = 'long') => {
  const date = parseDate(dateString)
  if (!date) return 'Fecha por definir'
  const options = variant === 'short'
    ? { day: '2-digit', month: '2-digit', year: 'numeric' }
    : { day: '2-digit', month: 'long', year: 'numeric' }
  return new Intl.DateTimeFormat('es-ES', options).format(date)
}

const formatHour = (timeString) => {
  if (!timeString) return '--:--'
  const [hours, minutes] = timeString.split(':')
  if (!hours) return timeString
  return `${hours.padStart(2, '0')}:${(minutes ?? '00').padStart(2, '0')}`
}

const renderStars = (rating) => {
  const stars = Math.round(Number(rating) || 0)
  if (stars <= 0) return '—'
  const clamped = Math.min(Math.max(stars, 0), 5)
  const empty = Math.max(5 - clamped, 0)
  return `${'⭐'.repeat(clamped)}${'☆'.repeat(empty)}`
}

const isPagoCompletado = (estado) => {
  const normalized = (estado || '').toString().trim().toLowerCase()
  return ['completada', 'pagado', 'finalizada'].includes(normalized)
}

export default function MiCuenta () {
  const { user } = useAuth()
  const [reservas, setReservas] = useState([])
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState({ type: '', message: '' })
  const [reviewForm, setReviewForm] = useState(defaultReviewForm)
  const [reviewingId, setReviewingId] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const fetchReservas = async () => {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase
      .from('actividad')
      .select(`
        id,
        nombre_actividad,
        ubicacion,
        estado_pago,
        paquete:paquete(nombre_paquete, precio),
        agenda:agenda(
          id,
          fecha,
          horainicio,
          horafin,
          fotografo:usuario(username)
        )
      `)
      .eq('idusuario', user.id)
      .order('fecha', { foreignTable: 'agenda', ascending: false, nullsLast: true })
      .order('horafin', { foreignTable: 'agenda', ascending: false, nullsLast: true })

    if (error) {
      console.error('No se pudieron cargar las reservas del usuario', error)
      setReservas([])
      setFeedback({ type: 'error', message: 'No pudimos cargar tus reservas. Intenta nuevamente en unos minutos.' })
    } else {
      const baseReservas = Array.isArray(data) ? data : []

      const reservasConResena = await Promise.all(baseReservas.map(async (reserva) => {
        const { data: resenasData, error: resenasError } = await supabase
          .from('resena')
          .select('id, calificacion, comentario, fecha_resena')
          .eq('idactividad', reserva.id)
          .eq('idusuario', user.id)

        if (resenasError) {
          console.error('No se pudo verificar la reseña del usuario', resenasError)
          return { ...reserva, resenas: [] }
        }

        return { ...reserva, resenas: Array.isArray(resenasData) ? resenasData : [] }
      }))

      setReservas(reservasConResena)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchReservas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const reservasConAgenda = useMemo(() => reservas.map((reserva) => ({
    ...reserva,
    agenda: normalizeSingle(reserva.agenda),
    paquete: normalizeSingle(reserva.paquete),
    resenas: ensureArray(reserva.resenas)
  })), [reservas])

  const handleOpenReview = (reservaObjetivo) => {
    const actividadId = typeof reservaObjetivo === 'object' && reservaObjetivo !== null
      ? reservaObjetivo.id
      : reservaObjetivo
    const actividad = reservasConAgenda.find((reserva) => reserva.id === actividadId)
    if (!actividad) return

    const { resenas } = actividad
    if (resenas.length > 0) {
      setFeedback({ type: 'error', message: 'Ya calificaste este servicio.' })
      return
    }

    const pagoCompletado = isPagoCompletado(actividad?.estado_pago)

    if (!pagoCompletado) {
      setFeedback({ type: 'error', message: 'Podrás dejar una reseña una vez completado tu pago.' })
      return
    }

    setFeedback({ type: '', message: '' })
    setReviewForm(defaultReviewForm)
    setReviewingId(actividadId)
  }

  const handleCancelReview = () => {
    setReviewingId(null)
    setReviewForm(defaultReviewForm)
  }

  const updateReviewField = (field, value) => {
    setReviewForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmitReview = async (event) => {
    event.preventDefault()
    if (!user || !reviewingId) return

    const actividad = reservasConAgenda.find((reserva) => reserva.id === reviewingId)
    if (!actividad) return

    const { resenas } = actividad

    if (resenas.length > 0) {
      setFeedback({ type: 'error', message: 'Ya calificaste este servicio.' })
      handleCancelReview()
      return
    }

    const pagoCompletado = isPagoCompletado(actividad?.estado_pago)

    if (!pagoCompletado) {
      setFeedback({ type: 'error', message: 'Podrás dejar una reseña una vez completado tu pago.' })
      handleCancelReview()
      return
    }

    const calificacion = Number(reviewForm.calificacion)
    if (!Number.isFinite(calificacion) || calificacion < 1 || calificacion > 5) {
      setFeedback({ type: 'error', message: 'Selecciona una calificación entre 1 y 5 estrellas.' })
      return
    }

    const comentario = (reviewForm.comentario ?? '').trim()
    if (!comentario) {
      setFeedback({ type: 'error', message: 'Por favor escribe un comentario para tu reseña.' })
      return
    }

    setSubmitting(true)

    try {
      const { data: existingReview, error: existingReviewError } = await supabase
        .from('resena')
        .select('id')
        .eq('idusuario', user.id)
        .eq('idactividad', actividad.id)
        .maybeSingle()

      if (existingReviewError) {
        throw existingReviewError
      }

      if (existingReview) {
        setFeedback({ type: 'error', message: 'Ya calificaste este servicio.' })
        handleCancelReview()
        fetchReservas()
        return
      }

      const { error } = await supabase
        .from('resena')
        .insert([
          {
            idusuario: user.id,
            idactividad: actividad.id,
            calificacion,
            comentario,
            fecha_resena: new Date().toISOString()
          }
        ])

      if (error) {
        throw error
      }

      setFeedback({ type: 'success', message: '¡Gracias por tu reseña! Tu opinión nos ayuda a mejorar.' })
      handleCancelReview()
      fetchReservas()
    } catch (error) {
      console.error('No se pudo guardar la reseña del usuario', error)
      setFeedback({ type: 'error', message: 'No pudimos registrar tu reseña. Intenta nuevamente en unos minutos.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="container-1120 py-8 space-y-8">
      <header className="space-y-2">
        <p className="uppercase tracking-[.2em] text-xs text-umber">Mi cuenta</p>
        <h1 className="text-3xl font-display">Mis reservas</h1>
        <p className="muted text-sm md:text-base max-w-2xl">
          Consulta el estado de tus reservas, detalles de tus sesiones y comparte tu experiencia después de cada sesión.
        </p>
      </header>

      {feedback.message && (
        <p className={`text-sm ${feedback.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
          {feedback.message}
        </p>
      )}

      {loading ? (
        <div className="card p-6 text-center text-sm text-slate-600">Cargando tus reservas…</div>
      ) : reservasConAgenda.length === 0 ? (
        <div className="card p-6 text-center text-sm text-slate-600">Aún no tienes reservas registradas.</div>
      ) : (
        <div className="grid gap-6">
          {reservasConAgenda.map((reserva) => {
            const agenda = reserva.agenda ?? {}
            const paquete = reserva.paquete ?? {}
            const resenas = reserva.resenas ?? []
            const tieneResena = resenas.length > 0
            const pagoCompletado = isPagoCompletado(reserva.estado_pago)
            const puedeResenar = !tieneResena && pagoCompletado

            return (
              <article key={reserva.id} className="card p-6 space-y-4">
                <div className="flex flex-col gap-1">
                  <h2 className="text-xl font-semibold">{paquete?.nombre_paquete || 'Paquete por definir'}</h2>
                  <p className="text-sm text-slate-600">{reserva.nombre_actividad || 'Actividad sin título'}</p>
                  <p className="muted text-sm">ID de reserva: {reserva.id}</p>
                </div>

                <dl className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="muted uppercase tracking-[.2em] text-xs">📅 Fecha</dt>
                    <dd className="font-medium">{formatDate(agenda?.fecha)}</dd>
                  </div>
                  <div>
                    <dt className="muted uppercase tracking-[.2em] text-xs">🕐 Horario</dt>
                    <dd className="font-medium">{`${formatHour(agenda?.horainicio)} a ${formatHour(agenda?.horafin)}`}</dd>
                  </div>
                  <div>
                    <dt className="muted uppercase tracking-[.2em] text-xs">👤 Fotógrafo</dt>
                    <dd className="font-medium">{agenda?.fotografo?.username || 'Por asignar'}</dd>
                  </div>
                  <div>
                    <dt className="muted uppercase tracking-[.2em] text-xs">🎬 Actividad</dt>
                    <dd className="font-medium">{reserva.nombre_actividad || 'Actividad sin título'}</dd>
                  </div>
                  <div>
                    <dt className="muted uppercase tracking-[.2em] text-xs">🎁 Paquete</dt>
                    <dd className="font-medium">{paquete?.nombre_paquete || 'Sin paquete'}</dd>
                  </div>
                  <div>
                    <dt className="muted uppercase tracking-[.2em] text-xs">💰 Precio</dt>
                    <dd className="font-medium">{paquete?.precio ? `$${Number(paquete.precio).toLocaleString('es-MX')}` : 'Por definir'}</dd>
                  </div>
                  <div>
                    <dt className="muted uppercase tracking-[.2em] text-xs">📍 Ubicación</dt>
                    <dd className="font-medium">{reserva.ubicacion || 'Por definir'}</dd>
                  </div>
                  <div>
                    <dt className="muted uppercase tracking-[.2em] text-xs">💳 Estado de pago</dt>
                    <dd className="font-medium capitalize">{reserva.estado_pago || 'Pendiente'}</dd>
                  </div>
                </dl>

                <section className="space-y-3">
                  <h3 className="text-lg font-semibold">Tu experiencia</h3>
                  {tieneResena ? (
                    <div className="space-y-3">
                      <p className="text-emerald-600">✅ Ya calificaste esta sesión.</p>
                      {resenas.map((resena) => (
                        <div key={resena.id} className="rounded-xl2 border border-dashed border-umber/30 bg-sand/40 p-4 space-y-2">
                          <div className="flex items-center gap-2">
                            <span>{renderStars(resena.calificacion)}</span>
                            <span className="text-sm text-slate-600">({resena.calificacion}/5)</span>
                          </div>
                          <p className="text-sm text-slate-700 whitespace-pre-line">{resena.comentario}</p>
                          {resena.fecha_resena && (
                            <p className="text-xs text-slate-500">Publicado el {formatDate(resena.fecha_resena, 'short')}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-slate-600">
                        Comparte cómo fue tu sesión para ayudar a otros clientes.
                      </p>
                      <p className="text-sm text-slate-500">
                        Podrás dejar una reseña una vez finalizada tu sesión.
                      </p>
                      {puedeResenar && (
                        reviewingId === reserva.id ? (
                          <form onSubmit={handleSubmitReview} className="grid gap-3 p-4 border border-dashed border-umber/40 rounded-xl2 bg-sand/30">
                            <label className="grid gap-1 text-sm">
                              <span className="font-medium text-slate-700">Calificación</span>
                              <select
                                value={reviewForm.calificacion}
                                onChange={(event) => updateReviewField('calificacion', event.target.value)}
                                className="border rounded-xl2 px-3 py-2"
                              >
                                {[1, 2, 3, 4, 5].map((value) => (
                                  <option key={value} value={value}>{value} estrella{value === 1 ? '' : 's'}</option>
                                ))}
                              </select>
                            </label>
                            <label className="grid gap-1 text-sm">
                              <span className="font-medium text-slate-700">Comentario</span>
                              <textarea
                                value={reviewForm.comentario}
                                onChange={(event) => updateReviewField('comentario', event.target.value)}
                                className="border rounded-xl2 px-3 py-3 min-h-[120px]"
                                placeholder="Cuéntanos cómo fue tu experiencia con Aguín Fotografía."
                              />
                            </label>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                              <button type="button" className="btn btn-ghost sm:w-auto" onClick={handleCancelReview} disabled={submitting}>
                                Cancelar
                              </button>
                              <button type="submit" className="btn btn-primary sm:w-auto" disabled={submitting}>
                                {submitting ? 'Guardando reseña…' : 'Enviar reseña'}
                              </button>
                            </div>
                          </form>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-secondary mt-2"
                            onClick={() => handleOpenReview(reserva)}
                          >
                            ⭐ Califícanos
                          </button>
                        )
                      )}
                    </div>
                  )}
                </section>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
