import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/authContext'
import { supabase } from '../lib/supabaseClient'
import DEFAULT_PAYMENT_STATES, {
  calculatePaymentProgress,
  getPaymentStateClasses
} from '../lib/paymentStates'

const defaultReviewForm = { calificacion: '5', comentario: '' }

const estadoIconos = {
  pendiente: '🕒',
  reservada: '📅',
  'en progreso': '📸',
  'en edición': '🖼️',
  'en edicion': '🖼️',
  impresión: '🖨️',
  impresion: '🖨️',
  lista: '🟢',
  entregada: '✅'
}

const defaultEstadosActividad = [
  { id: 'pendiente', nombre_estado: 'Pendiente', orden: 1 },
  { id: 'reservada', nombre_estado: 'Reservada', orden: 2 },
  { id: 'en-progreso', nombre_estado: 'En progreso', orden: 3 },
  { id: 'en-edicion', nombre_estado: 'En edición', orden: 4 },
  { id: 'impresion', nombre_estado: 'Impresión', orden: 5 },
  { id: 'lista', nombre_estado: 'Lista', orden: 6 },
  { id: 'entregada', nombre_estado: 'Entregada', orden: 7 }
]

const allowedReviewEstados = new Set(['lista', 'entregada'])

const allowedPaymentMethods = {
  transferencia: 'Transferencia bancaria',
  'transferencia bancaria': 'Transferencia bancaria',
  efectivo: 'Efectivo'
}

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

const formatDateTime = (value) => {
  if (!value) return 'Fecha no disponible'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible'
  return new Intl.DateTimeFormat('es-GT', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
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

const normalizeEstadoNombre = (value) => (value || '').toString().trim().toLowerCase()

const formatCurrencyGTQ = (value) => {
  if (value === null || value === undefined || value === '') return 'Por definir'
  const numero = Number(value)
  if (!Number.isFinite(numero)) return 'Por definir'
  return `Q${numero.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function MiCuenta () {
  const { user } = useAuth()
  const [reservas, setReservas] = useState([])
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState({ type: '', message: '' })
  const [reviewForm, setReviewForm] = useState(defaultReviewForm)
  const [reviewingId, setReviewingId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [hoverRating, setHoverRating] = useState(null)
  const [estadosActividad, setEstadosActividad] = useState([])
  const [paymentStates, setPaymentStates] = useState(DEFAULT_PAYMENT_STATES)
  const [activeReservaId, setActiveReservaId] = useState(null)

  const fetchEstadosActividad = async () => {
    const { data, error } = await supabase
      .from('estado_actividad')
      .select('id, nombre_estado, descripcion_estado, orden')
      .order('orden', { ascending: true })

    if (error) {
      console.error('No se pudieron cargar los estados de la actividad', error)
      setEstadosActividad(defaultEstadosActividad)
      return
    }

    const estadosOrdenados = Array.isArray(data) && data.length
      ? data
      : defaultEstadosActividad
    setEstadosActividad(estadosOrdenados)
  }

  const fetchEstadosPago = async () => {
    const { data, error } = await supabase
      .from('estado_pago')
      .select('id, nombre_estado, descripcion_estado, orden')
      .order('orden', { ascending: true })

    if (error) {
      console.warn('No se pudieron cargar los estados de pago', error)
      setPaymentStates(DEFAULT_PAYMENT_STATES)
      return
    }

    if (Array.isArray(data) && data.length) {
      const estados = data.map(estado => {
        const info = getPaymentStateClasses(estado.nombre_estado || estado.id, DEFAULT_PAYMENT_STATES)
        return {
          ...estado,
          key: info.key,
          label: estado.nombre_estado || info.label,
          badgeClass: info.badgeClass,
          textClass: info.textClass
        }
      })
      setPaymentStates(estados)
    } else {
      setPaymentStates(DEFAULT_PAYMENT_STATES)
    }
  }

  const fetchReservas = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase
      .from('actividad')
      .select(`
        id,
        idestado_actividad,
        idestado_pago,
        nombre_actividad,
        ubicacion,
        estado_pago:estado_pago ( id, nombre_estado ),
        paquete:paquete(nombre_paquete, precio),
        agenda:agenda(
          id,
          fecha,
          horainicio,
          horafin,
          fotografo:usuario(username)
        ),
        estado_actividad:estado_actividad(id, nombre_estado, orden),
        pago:pago(
          id,
          metodo_pago,
          monto,
          fecha_pago,
          tipo_pago,
          idestado_pago,
          estado_pago:estado_pago ( id, nombre_estado )
        )
      `)
      .eq('idusuario', user.id)
      .order('fecha', { foreignTable: 'agenda', ascending: false, nullsLast: true })
      .order('horafin', { foreignTable: 'agenda', ascending: false, nullsLast: true })

    if (error) {
      console.error('No se pudieron cargar las reservas del usuario', error)
      setReservas([])
      setFeedback({ type: 'error', message: 'No pudimos cargar tus reservas. Intenta nuevamente en unos minutos.' })
      setLoading(false)
      return
    }

    const baseReservas = Array.isArray(data) ? data : []

    const reservasConResena = await Promise.all(baseReservas.map(async (reserva) => {
      const agenda = normalizeSingle(reserva.agenda)
      const paquete = normalizeSingle(reserva.paquete)
      const estadoActividad = normalizeSingle(reserva.estado_actividad)

      const pagos = ensureArray(reserva.pago)
        .map(pago => {
          const estadoPagoInfo = getPaymentStateClasses(
            pago.estado_pago?.nombre_estado || pago.estado_pago || pago.idestado_pago,
            paymentStates
          )
          const metodoNormalizado = normalizeEstadoNombre(pago.metodo_pago)
          const metodoDisplay = allowedPaymentMethods[metodoNormalizado] || pago.metodo_pago || 'Método no especificado'
          return {
            ...pago,
            tipo_pago: pago.tipo_pago || 'Pago',
            monto: Number(pago.monto ?? 0),
            estadoPagoInfo,
            estado_pago: estadoPagoInfo.label,
            idestado_pago: estadoPagoInfo.id,
            metodoPagoNombre: metodoDisplay
          }
        })
        .sort((a, b) => {
          const fechaA = new Date(a.fecha_pago || 0)
          const fechaB = new Date(b.fecha_pago || 0)
          return fechaA - fechaB
        })

      const totalPagado = pagos.reduce((acc, pago) => acc + (Number(pago.monto) || 0), 0)
      const precio = Number(paquete?.precio ?? 0)
      const progress = calculatePaymentProgress(totalPagado, precio)

      let estadoPagoInfo = getPaymentStateClasses(
        reserva.estado_pago?.nombre_estado || reserva.estado_pago || reserva.idestado_pago,
        paymentStates
      )

      if (pagos.length === 0 && totalPagado <= 0) {
        estadoPagoInfo = getPaymentStateClasses(1, paymentStates)
      } else if (progress.percentage >= 100 || precio <= 0) {
        estadoPagoInfo = getPaymentStateClasses(3, paymentStates)
      } else if (totalPagado > 0) {
        estadoPagoInfo = getPaymentStateClasses(2, paymentStates)
      }

      const { data: resenasData, error: resenasError } = await supabase
        .from('resena')
        .select('id, calificacion, comentario, fecha_resena')
        .eq('idactividad', reserva.id)
        .eq('idusuario', user.id)

      if (resenasError) {
        console.error('No se pudo verificar la reseña del usuario', resenasError)
      }

      return {
        ...reserva,
        agenda,
        paquete,
        estado_actividad: estadoActividad,
        pago: pagos,
        resenas: Array.isArray(resenasData) ? resenasData : [],
        totalPagado,
        saldoPendiente: progress.remaining,
        porcentajePagado: progress.percentage,
        estadoPagoInfo,
        estado_pago: estadoPagoInfo.label
      }
    }))

    setReservas(reservasConResena)
    setLoading(false)
  }, [paymentStates, supabase, user])

  useEffect(() => {
    fetchReservas()
  }, [fetchReservas])

  useEffect(() => {
    fetchEstadosActividad()
  }, [])

  useEffect(() => {
    fetchEstadosPago()
  }, [])

  const reservasConAgenda = useMemo(() => reservas.map((reserva) => ({
    ...reserva,
    agenda: normalizeSingle(reserva.agenda),
    paquete: normalizeSingle(reserva.paquete),
    resenas: ensureArray(reserva.resenas),
    estado_actividad: normalizeSingle(reserva.estado_actividad),
    pago: ensureArray(reserva.pago)
  })), [reservas])

  useEffect(() => {
    if (reservasConAgenda.length === 0) return
    setActiveReservaId((current) => {
      if (current && reservasConAgenda.some((reserva) => reserva.id === current)) {
        return current
      }
      return reservasConAgenda[0].id
    })
  }, [reservasConAgenda])

  const estadosOrdenados = useMemo(() => {
    if (!Array.isArray(estadosActividad) || estadosActividad.length === 0) {
      return defaultEstadosActividad
    }
    return [...estadosActividad].sort((a, b) => (a?.orden ?? 0) - (b?.orden ?? 0))
  }, [estadosActividad])

  const estadoOrdenPorId = useMemo(() => {
    const mapa = new Map()
    estadosOrdenados.forEach((estado) => {
      if (estado?.id !== undefined) {
        mapa.set(estado.id, estado.orden)
      }
    })
    return mapa
  }, [estadosOrdenados])

  const handleToggleReserva = (reservaId) => {
    setActiveReservaId((current) => (current === reservaId ? null : reservaId))
  }

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

    const estadoActualNombre = normalizeEstadoNombre(actividad?.estado_actividad?.nombre_estado)
    if (!allowedReviewEstados.has(estadoActualNombre)) {
      setFeedback({ type: 'error', message: 'Podrás dejar una reseña cuando tu sesión esté lista o entregada.' })
      return
    }

    setFeedback({ type: '', message: '' })
    setReviewForm(defaultReviewForm)
    setReviewingId(actividadId)
    setHoverRating(Number(defaultReviewForm.calificacion))
  }

  const handleCancelReview = () => {
    setReviewingId(null)
    setReviewForm(defaultReviewForm)
    setHoverRating(null)
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

    const estadoActualNombre = normalizeEstadoNombre(actividad?.estado_actividad?.nombre_estado)
    if (!allowedReviewEstados.has(estadoActualNombre)) {
      setFeedback({ type: 'error', message: 'Podrás dejar una reseña cuando tu sesión esté lista o entregada.' })
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

      setFeedback({ type: 'success', message: '✅ ¡Gracias por tu reseña!' })
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
      <header className="space-y-2 text-[#3b302a]">
        <p className="uppercase tracking-[.2em] text-xs">Mi cuenta</p>
        <h1 className="font-display text-[2rem] leading-snug text-[#3b302a]">Mis reservas</h1>
        <p className="muted text-sm md:text-base max-w-2xl text-slate-600">
          Consulta el estado de tus reservas, sigue el progreso de tus sesiones y comparte tu experiencia cuando finalicen.
        </p>
      </header>

      {feedback.message && (
        <p className={`text-sm font-medium ${feedback.type === 'error' ? 'text-red-600' : 'text-emerald-600'}`}>
          {feedback.message}
        </p>
      )}

      {loading ? (
        <div className="card p-6 text-center text-sm text-slate-600">Cargando tus reservas…</div>
      ) : reservasConAgenda.length === 0 ? (
        <div className="card p-6 text-center text-sm text-slate-600">Aún no tienes reservas registradas.</div>
      ) : (
        <div className="space-y-8">
          {reservasConAgenda.map((reserva) => {
            const agenda = reserva.agenda ?? {}
            const paquete = reserva.paquete ?? {}
            const resenas = reserva.resenas ?? []
            const tieneResena = resenas.length > 0
            const estadoActualNombre = normalizeEstadoNombre(reserva?.estado_actividad?.nombre_estado)
            const puedeResenar = !tieneResena && allowedReviewEstados.has(estadoActualNombre)
            const pagosRegistrados = ensureArray(reserva.pago)
            const pagoSeleccionado = pagosRegistrados[0] ?? null
            const progresoPago = Math.max(0, Math.min(100, reserva.porcentajePagado ?? 0))
            const totalPagadoDisplay = formatCurrencyGTQ(reserva.totalPagado)
            const saldoPendienteDisplay = formatCurrencyGTQ(reserva.saldoPendiente)
            const precioPaqueteDisplay = formatCurrencyGTQ(paquete?.precio)
            const estadoPagoInfo = reserva.estadoPagoInfo || getPaymentStateClasses(reserva.estado_pago, paymentStates)

            const estadoActualId = reserva.idestado_actividad ?? reserva?.estado_actividad?.id
            const ordenActual = estadoOrdenPorId.get(estadoActualId) ?? reserva?.estado_actividad?.orden ?? estadosOrdenados.find((estado) => normalizeEstadoNombre(estado.nombre_estado) === estadoActualNombre)?.orden ?? 0

            const pasos = estadosOrdenados.map((estado) => {
              const nombreNormalizado = normalizeEstadoNombre(estado.nombre_estado)
              const icono = estadoIconos[nombreNormalizado] || '🔆'
              let status = 'upcoming'
              if ((estado.orden ?? 0) < ordenActual) {
                status = 'completed'
              } else if ((estado.orden ?? 0) === ordenActual || (!ordenActual && nombreNormalizado === estadoActualNombre)) {
                status = 'current'
              }

              return {
                ...estado,
                icono,
                status
              }
            })

            const isActive = activeReservaId === reserva.id

            const statusStyles = {
              current: {
                container: 'bg-[#E4DDCC] border-2 border-[#8E6037] text-[#3B302A] shadow-[0_18px_36px_rgba(59,48,42,0.16)]',
                titleClass: 'text-[#3B302A]',
                descriptionClass: 'text-[#3B302A]/70'
              },
              completed: {
                container: 'bg-[#8E6037] border border-[#8E6037] text-[#FAF8F4] shadow-[0_16px_32px_rgba(59,48,42,0.24)]',
                titleClass: 'text-[#FAF8F4]',
                descriptionClass: 'text-[#FAF8F4]/80'
              },
              upcoming: {
                container: 'bg-[#8E6037]/80 border border-[#8E6037] text-[#FAF8F4] shadow-[0_14px_26px_rgba(59,48,42,0.18)]',
                titleClass: 'text-[#FAF8F4]',
                descriptionClass: 'text-[#FAF8F4]/80'
              }
            }

            return (
              <article
                key={reserva.id}
                className={`group relative rounded-[1.25rem] border transition-all duration-300 ease-out ${
                  isActive
                    ? 'border-2 border-[#8E6037] bg-white shadow-[0_24px_48px_rgba(59,48,42,0.18)]'
                    : 'border border-[#e4ddcc] bg-[#faf8f4] shadow-[0_16px_32px_rgba(59,48,42,0.12)] hover:border-[#8E6037]/70 hover:shadow-[0_22px_40px_rgba(59,48,42,0.16)]'
                }`}
              >
                <div className="flex flex-col gap-6 p-6 md:p-8">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <h2 className="text-2xl font-semibold text-[#3b302a]">{paquete?.nombre_paquete || 'Paquete por definir'}</h2>
                      <p className="text-sm text-[#3b302a]/70">{reserva.nombre_actividad || 'Actividad sin título'}</p>
                    </div>
                    <div className="flex flex-col items-start gap-3 text-sm md:items-end">
                      <span className="inline-flex items-center gap-2 rounded-full bg-[#E4DDCC] px-4 py-2 font-semibold text-[#3b302a] shadow-inner">
                        <span className="text-xs uppercase tracking-[0.3em] text-[#8E6037]/80">Estado</span>
                        <span className="text-base font-semibold">{reserva?.estado_actividad?.nombre_estado || 'Pendiente'}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleToggleReserva(reserva.id)}
                        className={`inline-flex items-center gap-2 rounded-full border-2 border-transparent px-5 py-2 text-sm font-semibold transition-all duration-300 ease-out ${
                          isActive
                            ? 'bg-[#8E6037] text-[#FAF8F4] shadow-lg shadow-[#8E6037]/30 hover:bg-[#704c2c]'
                            : 'bg-[#8E6037] text-[#FAF8F4] hover:bg-[#704c2c]'
                        }`}
                      >
                        {isActive ? 'Ocultar progreso' : 'Ver progreso'}
                      </button>
                    </div>
                  </div>

                  {isActive && (
                    <div className="space-y-6">
                      <section className="space-y-4 rounded-[1.25rem] border border-[#e4ddcc]/60 bg-white/70 p-5 shadow-inner">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <h3 className="text-lg font-semibold text-[#3b302a]">Progreso de tu sesión</h3>
                          <span className="text-sm font-medium text-[#3b302a]">
                            Estado actual: {reserva?.estado_actividad?.nombre_estado || 'Pendiente'}
                          </span>
                        </div>
                        <ol className="flex gap-4 overflow-x-auto pb-2 md:gap-6">
                          {pasos.map((paso) => {
                            const isCompleted = paso.status === 'completed'
                            const isCurrent = paso.status === 'current'
                            const estadoClave = isCurrent ? 'current' : isCompleted ? 'completed' : 'upcoming'
                            const style = statusStyles[estadoClave]

                            return (
                              <li
                                key={`${paso.id}-${paso.nombre_estado}`}
                                className={`group relative flex min-w-[220px] flex-1 shrink-0 flex-col items-center gap-3 rounded-[1rem] px-4 py-5 text-center font-['Inter',sans-serif] transition-all duration-300 ease-out ${
                                  style.container
                                } hover:-translate-y-1 hover:scale-[1.03] hover:shadow-[0_22px_44px_rgba(59,48,42,0.2)]`}
                              >
                                <span
                                  className="flex h-14 w-14 items-center justify-center rounded-full text-2xl font-semibold transition-transform duration-300 ease-out group-hover:scale-105"
                                  style={{ backgroundColor: '#E4DDCC', color: '#3B302A' }}
                                >
                                  {paso.icono}
                                </span>
                                <div className="space-y-1">
                                  <p className={`text-base font-semibold leading-tight ${style.titleClass}`}>
                                    {paso.nombre_estado}
                                  </p>
                                  {paso.descripcion_estado && (
                                    <p className={`text-sm leading-snug ${style.descriptionClass}`}>
                                      {paso.descripcion_estado}
                                    </p>
                                  )}
                                </div>
                                {isCompleted && (
                                  <span className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-[#FAF8F4]/90">
                                    Listo
                                  </span>
                                )}
                              </li>
                            )
                          })}
                        </ol>
                      </section>

                      <section className="rounded-3xl bg-[#f6f2ea] p-5 text-sm text-[#3b302a] shadow-inner">
                        <h3 className="text-lg font-semibold text-[#3b302a]">Detalles de tu reserva</h3>
                        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                          <div className="space-y-1">
                            <dt className="text-xs uppercase tracking-[.2em] text-[#3b302a]/70">📅 Fecha</dt>
                            <dd className="font-medium">{formatDate(agenda?.fecha)}</dd>
                          </div>
                          <div className="space-y-1">
                            <dt className="text-xs uppercase tracking-[.2em] text-[#3b302a]/70">🕐 Horario</dt>
                            <dd className="font-medium">{`${formatHour(agenda?.horainicio)} a ${formatHour(agenda?.horafin)}`}</dd>
                          </div>
                          <div className="space-y-1">
                            <dt className="text-xs uppercase tracking-[.2em] text-[#3b302a]/70">👤 Fotógrafo</dt>
                            <dd className="font-medium">{agenda?.fotografo?.username || 'Por asignar'}</dd>
                          </div>
                          <div className="space-y-1">
                            <dt className="text-xs uppercase tracking-[.2em] text-[#3b302a]/70">🎬 Actividad</dt>
                            <dd className="font-medium">{reserva.nombre_actividad || 'Actividad sin título'}</dd>
                          </div>
                          <div className="space-y-1">
                            <dt className="text-xs uppercase tracking-[.2em] text-[#3b302a]/70">🎁 Paquete</dt>
                            <dd className="font-medium">{paquete?.nombre_paquete || 'Sin paquete'}</dd>
                          </div>
                          <div className="space-y-1">
                            <dt className="text-xs uppercase tracking-[.2em] text-[#3b302a]/70">💰 Precio</dt>
                            <dd className="font-medium">{precioPaqueteDisplay}</dd>
                          </div>
                          <div className="space-y-1">
                            <dt className="text-xs uppercase tracking-[.2em] text-[#3b302a]/70">📍 Ubicación</dt>
                            <dd className="font-medium">{reserva.ubicacion || 'Por definir'}</dd>
                          </div>
                          <div className="space-y-1">
                            <dt className="text-xs uppercase tracking-[.2em] text-[#3b302a]/70">💳 Método de pago</dt>
                            <dd className="font-medium">{pagoSeleccionado ? pagoSeleccionado.metodoPagoNombre : 'Pendiente de registrar'}</dd>
                          </div>
                          <div className="space-y-1">
                            <dt className="text-xs uppercase tracking-[.2em] text-[#3b302a]/70">🏷️ Estado de pago</dt>
                            <dd>
                              <span
                                className={`inline-flex items-center rounded-full px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.25em] ${estadoPagoInfo?.badgeClass || 'bg-amber-100 text-amber-700'}`}
                              >
                                {reserva.estado_pago || 'Pendiente'}
                              </span>
                            </dd>
                          </div>
                        </dl>
                      </section>

                        <section className="rounded-3xl border border-[#c9b38a]/50 bg-white/80 p-5 shadow-sm">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <h3 className="text-lg font-semibold text-[#3b302a]">Estado de tu pago</h3>
                            <span className="text-xs uppercase tracking-[.3em] text-[#3b302a]/60">{Math.round(progresoPago)} % pagado</span>
                          </div>
                          <div className="mt-3 h-2 rounded-full bg-[#f6f2ea]">
                            <div
                              className="h-full rounded-full bg-[#3b302a] transition-all"
                              style={{ width: `${progresoPago}%` }}
                            />
                          </div>
                          <dl className="mt-4 grid gap-3 text-sm text-[#3b302a] sm:grid-cols-3">
                            <div>
                              <dt className="text-xs uppercase tracking-[.2em] text-[#3b302a]/70">Total del paquete</dt>
                              <dd className="font-medium">{precioPaqueteDisplay}</dd>
                            </div>
                            <div>
                              <dt className="text-xs uppercase tracking-[.2em] text-[#3b302a]/70">Pagado</dt>
                              <dd className="font-medium">{totalPagadoDisplay}</dd>
                            </div>
                            <div>
                              <dt className="text-xs uppercase tracking-[.2em] text-[#3b302a]/70">Saldo pendiente</dt>
                              <dd className="font-medium">{saldoPendienteDisplay}</dd>
                            </div>
                          </dl>
                          <div className="mt-4 space-y-3">
                            <h4 className="text-sm font-semibold text-[#3b302a]">Historial de pagos</h4>
                            {pagosRegistrados.length ? (
                              <ul className="space-y-3">
                                {pagosRegistrados.map((pago) => (
                                  <li
                                    key={pago.id || `${pago.tipo_pago}-${pago.fecha_pago}`}
                                    className="rounded-2xl border border-[#c9b38a]/40 bg-[#faf8f4] p-3 text-sm text-[#3b302a]"
                                  >
                                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                      <span className="font-semibold text-[#3b302a]">{pago.tipo_pago}</span>
                                      <span className="font-semibold text-[#3b302a]">{formatCurrencyGTQ(pago.monto)}</span>
                                    </div>
                                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-[#3b302a]/70">
                                      <span>{pago.metodoPagoNombre}</span>
                                      <span>{formatDateTime(pago.fecha_pago)}</span>
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.25em]">
                                      <span className={`inline-flex rounded-full px-2 py-1 ${pago.estadoPagoInfo?.badgeClass || 'bg-amber-100 text-amber-700'}`}>
                                        {pago.estado_pago}
                                      </span>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-sm text-slate-600">Aún no registramos pagos para esta reserva.</p>
                            )}
                          </div>
                        </section>

                        <section className="space-y-3">
                          <h3 className="text-lg font-semibold text-[#3b302a]">Tu experiencia</h3>
                          {tieneResena ? (
                            <div className="space-y-3">
                              <p className="text-emerald-700">✅ Ya calificaste esta sesión.</p>
                              {resenas.map((resena) => (
                                <div key={resena.id} className="rounded-3xl border border-[#c9b38a]/60 bg-white/80 p-4 shadow-sm">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xl text-[#3b302a]">{renderStars(resena.calificacion)}</span>
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
                                Podrás dejar una reseña cuando tu sesión esté lista o entregada.
                              </p>
                              {puedeResenar && (
                                reviewingId === reserva.id ? (
                                  <form onSubmit={handleSubmitReview} className="grid gap-4 rounded-3xl border border-[#c9b38a]/60 bg-white/90 p-5 shadow-sm">
                                    <div className="space-y-2">
                                      <span className="text-sm font-medium text-[#3b302a]">Califica tu sesión</span>
                                      <div className="flex items-center gap-2">
                                        {[1, 2, 3, 4, 5].map((valor) => {
                                          const activo = (hoverRating ?? Number(reviewForm.calificacion)) >= valor
                                          return (
                                            <button
                                              key={valor}
                                              type="button"
                                              className={`text-2xl transition-transform duration-200 ${activo ? 'scale-110 text-[#3b302a]' : 'text-[#e4ddcc]'} focus:outline-none`}
                                              onMouseEnter={() => setHoverRating(valor)}
                                              onMouseLeave={() => setHoverRating(null)}
                                              onFocus={() => setHoverRating(valor)}
                                              onBlur={() => setHoverRating(null)}
                                              onClick={() => updateReviewField('calificacion', String(valor))}
                                              aria-label={`${valor} estrella${valor === 1 ? '' : 's'}`}
                                            >
                                              ★
                                            </button>
                                          )
                                        })}
                                        <span className="text-sm text-[#3b302a]">{reviewForm.calificacion}/5</span>
                                      </div>
                                    </div>
                                    <label className="grid gap-2 text-sm">
                                      <span className="font-medium text-[#3b302a]">Comentario</span>
                                      <textarea
                                        value={reviewForm.comentario}
                                        onChange={(event) => updateReviewField('comentario', event.target.value)}
                                        className="rounded-2xl border border-[#c9b38a]/50 bg-white px-3 py-3 text-sm shadow-inner focus:border-[#3b302a] focus:outline-none"
                                        placeholder="Cuéntanos cómo fue tu sesión..."
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
                                    className="btn btn-secondary mt-2 transition-transform duration-200 hover:scale-[1.01]"
                                    onClick={() => handleOpenReview(reserva)}
                                  >
                                    ⭐ Califícanos
                                  </button>
                                )
                              )}
                            </div>
                          )}
                        </section>
                      </div>
                    )}
                  </div>
                </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
