import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import AdminHelpCard from '../components/AdminHelpCard'
import AdminDataTable from '../components/AdminDataTable'
import AdminDatePicker from '../components/AdminDatePicker'
import DEFAULT_PAYMENT_STATES, {
  calculatePaymentProgress,
  getPaymentStateClasses,
  mapStates,
  resolvePaymentState
} from '../lib/paymentStates'

const PAYMENT_METHODS = [
  { value: 'Transferencia', label: 'Transferencia bancaria' },
  { value: 'Efectivo', label: 'Efectivo' }
]

const PAYMENT_TYPES = [
  { value: 'Anticipo', label: 'Anticipo' },
  { value: 'Saldo', label: 'Saldo pendiente' },
  { value: 'Pago', label: 'Pago completo' }
]

const createDefaultForm = () => {
  const now = new Date()
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  return {
    idactividad: '',
    monto: '',
    metodo: PAYMENT_METHODS[0].value,
    tipoPago: PAYMENT_TYPES[0].value,
    detalle: '',
    fechaPago: now,
    horaPago: `${hours}:${minutes}`
  }
}
const defaultFilters = { search: '', metodo: 'all', rangoFechas: [null, null] }

const STUDIO_INFO = {
  name: 'FotoEstudio',
  slogan: 'Estudio fotográfico profesional'
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('es-GT', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function normalize(value) {
  if (!value) return ''
  return String(value)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9\s]/g, '')
}

function toDate(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date
}

function startOfDay(date) {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

function endOfDay(date) {
  const result = new Date(date)
  result.setHours(23, 59, 59, 999)
  return result
}

function formatCurrency(value) {
  const amount = Number(value) || 0
  return `Q${amount.toLocaleString('es-GT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`
}

function formatDateOnly(value) {
  if (!value) return 'Fecha no disponible'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible'
  return new Intl.DateTimeFormat('es-GT', { dateStyle: 'long' }).format(date)
}

export default function AdminPayments(){
  const [activities, setActivities] = useState([])
  const [payments, setPayments] = useState([])
  const [form, setForm] = useState(createDefaultForm)
  const [filters, setFilters] = useState(defaultFilters)
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState({ type: '', message: '' })
  const [toast, setToast] = useState(null)
  const [paymentStates, setPaymentStates] = useState(DEFAULT_PAYMENT_STATES)
  const [deletingPaymentId, setDeletingPaymentId] = useState(null)

  const fetchPayments = useCallback(async () => {
    setLoading(true)
    setFeedback({ type: '', message: '' })

    const [actividadesRes, pagosRes, estadosRes] = await Promise.all([
      supabase
        .from('actividad')
        .select(`
          id,
          nombre_actividad,
          idestado_pago,
          estado_pago:estado_pago ( id, nombre_estado ),
          agenda:agenda ( fecha, horainicio ),
          cliente:usuario!actividad_idusuario_fkey ( id, username, telefono ),
          paquete:paquete ( id, nombre_paquete, precio )
        `)
        .order('id', { ascending: false }),
      supabase
        .from('pago')
        .select('id, idactividad, metodo_pago, monto, fecha_pago, detalle_pago, tipo_pago, idestado_pago, estado_pago:estado_pago ( id, nombre_estado )')
        .order('fecha_pago', { ascending: false }),
      supabase
        .from('estado_pago')
        .select('id, nombre_estado, descripcion_estado, orden')
        .order('orden', { ascending: true })
    ])

    if (actividadesRes.error || pagosRes.error) {
      console.error('No se pudieron cargar los pagos', actividadesRes.error || pagosRes.error)
      setActivities([])
      setPayments([])
      setFeedback({ type: 'error', message: 'No pudimos cargar la información de pagos.' })
      setLoading(false)
      return
    }

    if (estadosRes.error) {
      console.warn('No se pudieron cargar los estados de pago desde la base de datos.', estadosRes.error)
    }

    const actividadesData = actividadesRes.data ?? []
    const pagosData = pagosRes.data ?? []
    const rawStates = Array.isArray(estadosRes.data) ? estadosRes.data : []

    const states = rawStates.length
      ? rawStates.map(state => {
          const fallback = getPaymentStateClasses(state.nombre_estado || state.id, DEFAULT_PAYMENT_STATES)
          return {
            ...state,
            key: fallback.key,
            label: state.nombre_estado || fallback.label,
            badgeClass: fallback.badgeClass,
            textClass: fallback.textClass
          }
        })
      : DEFAULT_PAYMENT_STATES

    setPaymentStates(states)

    const normalizedActivities = actividadesData.map(item => {
      const stateSource = item.estado_pago?.nombre_estado || item.estado_pago || item.idestado_pago
      const estadoPagoInfo = getPaymentStateClasses(stateSource, states)
      return {
        id: item.id,
        nombre: item.nombre_actividad || '',
        estadoPago: estadoPagoInfo.label,
        estadoPagoId: estadoPagoInfo.id,
        estadoPagoInfo,
        cliente: item.cliente?.username || 'Cliente sin nombre',
        clienteTelefono: item.cliente?.telefono || '',
        paquete: item.paquete?.nombre_paquete || 'Paquete sin definir',
        paquetePrecio: Number(item.paquete?.precio ?? 0),
        agendaFecha: item.agenda?.fecha || null,
        agendaHora: item.agenda?.horainicio || null
      }
    })

    const actividadMap = new Map(normalizedActivities.map(item => [Number(item.id), item]))
    const paymentsByActivityMap = new Map()

    const formattedPayments = pagosData.map(pago => {
      const actividad = actividadMap.get(Number(pago.idactividad)) || null
      const estadoPagoInfo = getPaymentStateClasses(
        pago.estado_pago?.nombre_estado || pago.estado_pago || pago.idestado_pago,
        states
      )

      const entry = {
        id: pago.id,
        actividadId: pago.idactividad,
        metodoPago: pago.metodo_pago || 'Método no especificado',
        monto: Number(pago.monto ?? 0),
        fechaPago: pago.fecha_pago || null,
        detallePago: pago.detalle_pago || '',
        tipoPago: pago.tipo_pago || 'Pago',
        estadoPago: estadoPagoInfo.label,
        estadoPagoId: estadoPagoInfo.id,
        estadoPagoInfo,
        cliente: actividad?.cliente || 'Cliente sin nombre',
        paquete: actividad?.paquete || 'Paquete sin definir',
        agendaFecha: actividad?.agendaFecha || null,
        agendaHora: actividad?.agendaHora || null,
        actividad
      }

      const actividadIdNum = Number(pago.idactividad)
      if (!paymentsByActivityMap.has(actividadIdNum)) {
        paymentsByActivityMap.set(actividadIdNum, [])
      }
      paymentsByActivityMap.get(actividadIdNum).push(entry)
      return entry
    })

    const activitiesWithSummary = normalizedActivities.map(activity => {
      const pagosActividad = paymentsByActivityMap.get(Number(activity.id)) || []
      const totalPagado = pagosActividad.reduce((acc, pago) => acc + (Number(pago.monto) || 0), 0)
      const progress = calculatePaymentProgress(totalPagado, activity.paquetePrecio)

      let estadoPagoInfo = activity.estadoPagoInfo
      if (pagosActividad.length === 0 && totalPagado <= 0) {
        estadoPagoInfo = getPaymentStateClasses(activity.estadoPagoId ?? 1, states)
      } else if (progress.percentage >= 100 || activity.paquetePrecio <= 0) {
        estadoPagoInfo = getPaymentStateClasses(3, states)
      } else {
        estadoPagoInfo = getPaymentStateClasses(2, states)
      }

      return {
        ...activity,
        estadoPago: estadoPagoInfo.label,
        estadoPagoId: estadoPagoInfo.id,
        estadoPagoInfo,
        totalPagado,
        porcentajePagado: progress.percentage,
        saldoRestante: progress.remaining,
        pagos: pagosActividad
      }
    })

    const activitySummaryMap = new Map(activitiesWithSummary.map(item => [Number(item.id), item]))
    const paymentsWithActivity = formattedPayments.map(pago => ({
      ...pago,
      actividad: activitySummaryMap.get(Number(pago.actividadId)) || pago.actividad
    }))

    setActivities(activitiesWithSummary)
    setPayments(paymentsWithActivity)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchPayments()
  }, [fetchPayments])

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const updateFilter = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }))
  }

  const resetForm = () => {
    setForm(createDefaultForm())
    setFeedback({ type: '', message: '' })
  }

  const resetFilters = () => {
    setFilters(defaultFilters)
  }

  const activitiesMap = useMemo(
    () => new Map(activities.map(activity => [Number(activity.id), activity])),
    [activities]
  )

  const paymentStateIds = useMemo(() => {
    const mapped = mapStates(paymentStates)
    const pendiente = resolvePaymentState(1, paymentStates) || resolvePaymentState('Pendiente', paymentStates)
    const anticipo = resolvePaymentState(2, paymentStates) || resolvePaymentState('Con anticipo', paymentStates)
    const pagado = resolvePaymentState(3, paymentStates) || resolvePaymentState('Pagado', paymentStates)
    return {
      pendiente: pendiente?.id ?? mapped.list[0]?.id ?? 1,
      anticipo: anticipo?.id ?? mapped.list[1]?.id ?? 2,
      pagado: pagado?.id ?? mapped.list[2]?.id ?? 3
    }
  }, [paymentStates])

  const paymentsByActivity = useMemo(() => {
    const map = new Map()
    payments.forEach(pago => {
      const key = Number(pago.actividadId)
      if (!map.has(key)) {
        map.set(key, [])
      }
      map.get(key).push(pago)
    })
    return map
  }, [payments])

  const selectedActivity = form.idactividad ? activitiesMap.get(Number(form.idactividad)) || null : null
  const existingPaymentsForSelected = selectedActivity ? paymentsByActivity.get(Number(selectedActivity.id)) ?? [] : []
  const selectedProgress = selectedActivity
    ? {
        percentage: selectedActivity.porcentajePagado ?? 0,
        total: selectedActivity.totalPagado ?? 0,
        remaining: selectedActivity.saldoRestante ?? 0
      }
    : { percentage: 0, total: 0, remaining: 0 }

  const filteredPayments = useMemo(() => {
    const searchTerm = normalize(filters.search)
    const metodoFiltro = filters.metodo
    const [start, end] = filters.rangoFechas
    const startDate = start ? startOfDay(start) : null
    const endDate = end ? endOfDay(end) : null

    return payments.filter(pago => {
      const matchesSearch =
        !searchTerm ||
        normalize(pago.cliente).includes(searchTerm) ||
        normalize(pago.paquete).includes(searchTerm) ||
        normalize(pago.tipoPago).includes(searchTerm)

      const matchesMetodo = metodoFiltro === 'all' || pago.metodoPago === metodoFiltro

      const matchesFecha = (() => {
        if (!startDate && !endDate) return true
        const date = toDate(pago.fechaPago)
        if (!date) return false
        if (startDate && date < startDate) return false
        if (endDate && date > endDate) return false
        return true
      })()

      return matchesSearch && matchesMetodo && matchesFecha
    })
  }, [payments, filters])

  const handleViewInvoice = useCallback(
    (payment) => {
      if (!payment) return
      const actividad = activitiesMap.get(Number(payment.actividadId)) || payment.actividad || null
      setSelectedInvoice({ actividad, pago: payment })
    },
    [activitiesMap]
  )

  const syncActivityPaymentState = useCallback(async (actividadId, pagos, precioReferencia) => {
    const actividadIdNum = Number(actividadId)
    if (Number.isNaN(actividadIdNum)) return

    const pagosEvaluar = Array.isArray(pagos)
      ? pagos
      : paymentsByActivity.get(actividadIdNum) || []

    const montoTotal = pagosEvaluar.reduce((acc, pago) => acc + (Number(pago?.monto) || 0), 0)
    const precioObjetivo = precioReferencia != null
      ? Number(precioReferencia)
      : Number(activitiesMap.get(actividadIdNum)?.paquetePrecio ?? 0)

    let estadoObjetivo = paymentStateIds.pendiente
    if (precioObjetivo <= 0 && montoTotal > 0) {
      estadoObjetivo = paymentStateIds.pagado
    } else if (precioObjetivo > 0 && montoTotal >= precioObjetivo) {
      estadoObjetivo = paymentStateIds.pagado
    } else if (montoTotal > 0) {
      estadoObjetivo = paymentStateIds.anticipo
    }

    const { error } = await supabase
      .from('actividad')
      .update({ idestado_pago: estadoObjetivo })
      .eq('id', actividadIdNum)

    if (error) {
      console.error('No se pudo sincronizar el estado de pago de la actividad.', error)
    }
  }, [activitiesMap, paymentStateIds, paymentsByActivity])

  const handleDeletePayment = useCallback(async (payment) => {
    if (!payment) return
    const confirmed = window.confirm('¿Deseas eliminar este pago? Esta acción no se puede deshacer.')
    if (!confirmed) return

    setDeletingPaymentId(payment.id)
    const { error } = await supabase.from('pago').delete().eq('id', payment.id)

    if (error) {
      console.error('No se pudo eliminar el pago', error)
      setToast({ type: 'error', message: '❌ No se pudo eliminar el pago.' })
      setDeletingPaymentId(null)
      return
    }

    const pagosPrevios = paymentsByActivity.get(Number(payment.actividadId)) || []
    const pagosRestantes = pagosPrevios.filter(item => item.id !== payment.id)
    const actividad = activitiesMap.get(Number(payment.actividadId)) || null

    try {
      await syncActivityPaymentState(payment.actividadId, pagosRestantes, actividad?.paquetePrecio)
    } catch (syncError) {
      console.error('No se pudo actualizar el estado de la actividad tras eliminar el pago.', syncError)
    }

    setToast({ type: 'success', message: '🗑️ Pago eliminado correctamente' })
    setDeletingPaymentId(null)
    fetchPayments()
  }, [activitiesMap, fetchPayments, paymentsByActivity, syncActivityPaymentState])

  const handleSelectActivity = (value) => {
    const actividad = value ? activitiesMap.get(Number(value)) || null : null
    const saldoRestante = actividad ? Number(actividad.saldoRestante ?? 0) : 0
    const precioPaquete = actividad ? Number(actividad.paquetePrecio ?? 0) : 0
    const monto = saldoRestante > 0 ? saldoRestante : precioPaquete
    const tipoPago = saldoRestante > 0 && saldoRestante < precioPaquete
      ? 'Saldo'
      : PAYMENT_TYPES[0].value

    setForm(prev => ({
      ...createDefaultForm(),
      idactividad: value,
      monto: monto > 0 ? String(monto.toFixed(2)) : '',
      tipoPago
    }))
  }

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 4000)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (!selectedActivity) return
    if (form.tipoPago !== 'Saldo') return
    const saldo = Number(selectedActivity.saldoRestante ?? 0)
    if (saldo <= 0) return
    const montoActual = Number(form.monto)
    if (Number.isNaN(montoActual) || Math.abs(montoActual - saldo) > 0.01) {
      setForm(prev => ({ ...prev, monto: String(saldo.toFixed(2)) }))
    }
  }, [form.tipoPago, form.monto, selectedActivity])

  const paymentColumns = useMemo(
    () => [
      {
        id: 'cliente',
        label: 'Cliente',
        render: (pago) => (
          <div className="space-y-1">
            <p className="text-sm font-semibold text-umber">{pago.cliente}</p>
            <p className="text-xs text-slate-500">{pago.paquete}</p>
          </div>
        )
      },
      {
        id: 'monto',
        label: 'Monto',
        align: 'right',
        render: (pago) => (
          <div className="text-right">
            <p className="text-sm font-semibold text-umber">{formatCurrency(pago.monto)}</p>
          </div>
        )
      },
      {
        id: 'tipo',
        label: 'Tipo',
        render: (pago) => (
          <div className="space-y-1 text-sm text-slate-600">
            <p className="font-medium text-umber">{pago.tipoPago || 'Pago'}</p>
            <p className="text-xs text-slate-500">{pago.metodoPago}</p>
          </div>
        )
      },
      {
        id: 'fecha',
        label: 'Fecha y estado',
        render: (pago) => (
          <div className="space-y-1 text-sm text-slate-600">
            <p className="font-medium text-umber">{formatDate(pago.fechaPago)}</p>
            <span
              className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.25em] ${pago.estadoPagoInfo?.badgeClass || 'bg-amber-100 text-amber-700'}`}
            >
              {pago.estadoPago}
            </span>
          </div>
        )
      },
      {
        id: 'acciones',
        label: 'Acciones',
        align: 'right',
        render: (pago) => (
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => handleViewInvoice(pago)}>
              Ver factura
            </button>
            <button
              type="button"
              className="btn btn-ghost text-red-600 hover:text-red-700"
              onClick={() => handleDeletePayment(pago)}
              disabled={deletingPaymentId === pago.id}
            >
              {deletingPaymentId === pago.id ? 'Eliminando…' : 'Eliminar'}
            </button>
          </div>
        )
      }
    ],
    [deletingPaymentId, handleDeletePayment, handleViewInvoice]
  )

  const onSubmit = async (event) => {
    event.preventDefault()
    setFeedback({ type: '', message: '' })

    if (!form.idactividad || !form.monto) {
      setFeedback({ type: 'error', message: 'Selecciona una reserva y especifica el monto cobrado.' })
      return
    }

    const monto = Number(form.monto)
    if (Number.isNaN(monto) || monto <= 0) {
      setFeedback({ type: 'error', message: 'El monto debe ser un número positivo.' })
      return
    }

    const metodoValido = PAYMENT_METHODS.some(metodo => metodo.value === form.metodo)
    if (!metodoValido) {
      setFeedback({ type: 'error', message: 'Selecciona un método de pago válido (Efectivo o Transferencia bancaria).' })
      return
    }

    const tipoPagoValido = PAYMENT_TYPES.some(tipo => tipo.value === form.tipoPago)
    if (!tipoPagoValido) {
      setFeedback({ type: 'error', message: 'Selecciona un tipo de pago válido.' })
      return
    }

    setSaving(true)

    const actividadId = Number(form.idactividad)
    const actividadSeleccionada = activitiesMap.get(actividadId) || null
    const pagosPrevios = paymentsByActivity.get(actividadId) || []
    const precioPaquete = actividadSeleccionada ? Number(actividadSeleccionada.paquetePrecio ?? 0) : 0
    const totalPrevio = pagosPrevios.reduce((acc, pago) => acc + (Number(pago?.monto) || 0), 0)
    const totalSimulado = totalPrevio + monto

    let pagoEstadoId = paymentStateIds.anticipo
    if (form.tipoPago === 'Anticipo') {
      pagoEstadoId = paymentStateIds.anticipo
    } else if (precioPaquete <= 0 || totalSimulado >= precioPaquete) {
      pagoEstadoId = paymentStateIds.pagado
    }

    let fechaPago = form.fechaPago instanceof Date ? new Date(form.fechaPago) : null
    if (!fechaPago || Number.isNaN(fechaPago.getTime())) {
      fechaPago = new Date()
    }

    if (form.horaPago) {
      const [hours, minutes] = form.horaPago.split(':')
      const hoursNum = Number(hours)
      const minutesNum = Number(minutes)
      if (!Number.isNaN(hoursNum) && !Number.isNaN(minutesNum)) {
        fechaPago.setHours(hoursNum, minutesNum, 0, 0)
      }
    }

    const payload = {
      idactividad: actividadId,
      metodo_pago: form.metodo || PAYMENT_METHODS[0].value,
      monto,
      fecha_pago: fechaPago.toISOString(),
      detalle_pago: form.detalle ? form.detalle.trim() : null,
      tipo_pago: form.tipoPago,
      idestado_pago: pagoEstadoId
    }

    const { data, error } = await supabase
      .from('pago')
      .insert([payload])
      .select('id, idactividad, monto, metodo_pago, fecha_pago, detalle_pago, tipo_pago, idestado_pago')
      .single()

    if (error || !data) {
      console.error('No se pudo registrar el pago', error)
      setFeedback({ type: 'error', message: 'No se pudo registrar el pago.' })
      setSaving(false)
      return
    }

    const pagosSimulados = [...pagosPrevios, { monto }]
    try {
      await syncActivityPaymentState(actividadId, pagosSimulados, precioPaquete)
    } catch (syncError) {
      console.error('No se pudo actualizar el estado de la actividad después del pago.', syncError)
    }

    const estadoPagoInfo = getPaymentStateClasses(data.idestado_pago || pagoEstadoId, paymentStates)
    const actividadAsociada = activitiesMap.get(actividadId) || actividadSeleccionada
    const nuevoPago = {
      id: data.id,
      actividadId: data.idactividad,
      metodoPago: data.metodo_pago,
      monto: Number(data.monto ?? 0),
      fechaPago: data.fecha_pago,
      detallePago: data.detalle_pago || '',
      tipoPago: data.tipo_pago || form.tipoPago,
      estadoPago: estadoPagoInfo.label,
      estadoPagoId: estadoPagoInfo.id,
      estadoPagoInfo,
      cliente: actividadAsociada?.cliente || 'Cliente sin nombre',
      paquete: actividadAsociada?.paquete || 'Paquete sin definir',
      agendaFecha: actividadAsociada?.agendaFecha || null,
      agendaHora: actividadAsociada?.agendaHora || null,
      actividad: actividadAsociada || null
    }

    setSelectedInvoice({ actividad: actividadAsociada, pago: nuevoPago })
    setToast({ type: 'success', message: '✅ Pago registrado correctamente' })
    setFeedback({ type: '', message: '' })
    setForm(createDefaultForm())
    setSaving(false)
    fetchPayments()
  }

  const onImprimir = () => {
    window.print()
  }

  return (
    <div className="admin-page">
      {toast && (
        <div className={`admin-toast admin-toast--${toast.type}`} role="status">
          <span>{toast.message}</span>
          <button type="button" onClick={() => setToast(null)} aria-label="Cerrar notificación">×</button>
        </div>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        <div className="admin-section flex-1 space-y-4">
          <header className="admin-header">
            <div>
              <h1 className="text-xl font-semibold text-umber">Control de pagos</h1>
              <p className="muted text-sm">Registra pagos realizados y genera facturas imprimibles.</p>
            </div>
            <button type="button" className="btn btn-ghost" onClick={resetForm}>Limpiar formulario</button>
          </header>

          <form onSubmit={onSubmit} className="grid gap-3">
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Selecciona una reserva</span>
              <select
                value={form.idactividad}
                onChange={event => handleSelectActivity(event.target.value)}
                className="admin-field-select"
              >
                <option value="">Selecciona una actividad</option>
                {activities.map(actividad => {
                  const fecha = actividad.agendaFecha
                    ? new Date(actividad.agendaFecha).toLocaleDateString('es-GT')
                    : 'Sin fecha'
                  const hasPago = paymentsByActivity.has(Number(actividad.id))
                  return (
                    <option key={actividad.id} value={actividad.id}>
                      #{actividad.id} — {actividad.cliente} ({actividad.paquete}, {fecha}) {hasPago ? '• Pago existente' : ''}
                    </option>
                  )
                })}
              </select>
            </label>

            {selectedActivity && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-amber-900">Progreso de pago</span>
                  <span className="text-xs uppercase tracking-[0.3em] text-amber-700">
                    {Math.round(selectedProgress.percentage)}% pagado
                  </span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-white/80">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all"
                    style={{ width: `${Math.max(0, Math.min(100, selectedProgress.percentage || 0))}%` }}
                  />
                </div>
                <dl className="mt-3 grid gap-3 text-xs text-amber-800 sm:grid-cols-2">
                  <div>
                    <dt className="uppercase tracking-[0.2em] text-amber-700">Total del paquete</dt>
                    <dd className="font-semibold">{formatCurrency(selectedActivity.paquetePrecio)}</dd>
                  </div>
                  <div>
                    <dt className="uppercase tracking-[0.2em] text-amber-700">Pagado</dt>
                    <dd className="font-semibold">{formatCurrency(selectedProgress.total)}</dd>
                  </div>
                  <div>
                    <dt className="uppercase tracking-[0.2em] text-amber-700">Saldo pendiente</dt>
                    <dd className="font-semibold">{formatCurrency(selectedProgress.remaining)}</dd>
                  </div>
                  <div>
                    <dt className="uppercase tracking-[0.2em] text-amber-700">Estado</dt>
                    <dd>
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.25em] ${selectedActivity.estadoPagoInfo?.badgeClass || 'bg-amber-100 text-amber-700'}`}
                      >
                        {selectedActivity.estadoPago}
                      </span>
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 space-y-2">
                  <h4 className="text-sm font-semibold text-amber-900">Pagos registrados</h4>
                  {existingPaymentsForSelected.length ? (
                    existingPaymentsForSelected.map(pago => (
                      <div
                        key={pago.id}
                        className="rounded-xl border border-amber-200 bg-white/80 p-3 shadow-sm"
                      >
                        <div className="flex items-center justify-between text-sm font-semibold text-amber-900">
                          <span>{pago.tipoPago || 'Pago'}</span>
                          <span>{formatCurrency(pago.monto)}</span>
                        </div>
                        <p className="text-xs text-amber-700">{formatDate(pago.fechaPago)}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.25em]">
                          <span className={`inline-flex rounded-full px-2 py-1 ${pago.estadoPagoInfo?.badgeClass || 'bg-amber-100 text-amber-700'}`}>
                            {pago.estadoPago}
                          </span>
                          <span className="inline-flex rounded-full bg-amber-100 px-2 py-1 text-amber-700">{pago.metodoPago}</span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          <button type="button" className="btn btn-ghost" onClick={() => handleViewInvoice(pago)}>
                            Ver
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost text-red-600 hover:text-red-700"
                            onClick={() => handleDeletePayment(pago)}
                            disabled={deletingPaymentId === pago.id}
                          >
                            {deletingPaymentId === pago.id ? 'Eliminando…' : 'Eliminar'}
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-amber-700">Todavía no hay pagos registrados para esta reserva.</p>
                  )}
                </div>
              </div>
            )}

            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Método de pago</span>
              <select
                value={form.metodo}
                onChange={event => updateField('metodo', event.target.value)}
                className="admin-field-select"
              >
                {PAYMENT_METHODS.map(metodo => (
                  <option key={metodo.value} value={metodo.value}>{metodo.label}</option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Tipo de pago</span>
              <select
                value={form.tipoPago}
                onChange={event => updateField('tipoPago', event.target.value)}
                className="admin-field-select"
              >
                {PAYMENT_TYPES.map(tipo => (
                  <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                ))}
              </select>
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <AdminDatePicker
                label="Fecha del pago"
                value={form.fechaPago}
                onChange={(date) => updateField('fechaPago', Array.isArray(date) ? date[0] ?? null : date)}
                isClearable={false}
              />
              <label className="grid gap-1 text-sm">
                <span className="font-medium text-slate-700">Hora</span>
                <input
                  type="time"
                  value={form.horaPago}
                  onChange={event => updateField('horaPago', event.target.value)}
                  className="admin-field-input"
                />
              </label>
            </div>

            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Monto cobrado (Q)</span>
              <input
                value={form.monto}
                onChange={event => updateField('monto', event.target.value)}
                className="admin-field-input"
                placeholder="Ej. 1800"
                inputMode="decimal"
                type="number"
                min="0"
                step="0.01"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Detalle del pago (opcional)</span>
              <textarea
                value={form.detalle}
                onChange={event => updateField('detalle', event.target.value)}
                className="admin-field-textarea"
                rows={2}
                placeholder="Número de recibo o nota interna"
              />
            </label>

            <button className="btn btn-primary w-fit" disabled={saving}>
              {saving ? 'Registrando…' : 'Registrar pago'}
            </button>
            {feedback.message && (
              <p className={`admin-feedback admin-feedback--${feedback.type}`}>{feedback.message}</p>
            )}
          </form>
        </div>
        <div className="lg:w-[320px]">
          <AdminHelpCard title="Consejos para facturación">
            <p>Registra un pago por cada actividad completada. El estado se actualiza automáticamente a pagado.</p>
            <p>Utiliza montos exactos para llevar un historial confiable y generar reportes financieros.</p>
            <p>Imprime la factura directamente desde el navegador usando el botón dedicado.</p>
          </AdminHelpCard>
        </div>
      </div>

      <div className="admin-section space-y-4">
        <div className="admin-header">
          <div>
            <h2 className="text-lg font-semibold text-umber">Historial de pagos</h2>
            <p className="muted text-sm">Filtra por método o por rango de fechas para encontrar transacciones específicas.</p>
          </div>
          <span className="text-xs uppercase tracking-[0.3em] text-slate-500">{payments.length}</span>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-700">Buscar</span>
            <input
              className="admin-field-input"
              placeholder="Cliente o paquete"
              value={filters.search}
              onChange={event => updateFilter('search', event.target.value)}
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-700">Método de pago</span>
            <select
              className="admin-field-select"
              value={filters.metodo}
              onChange={event => updateFilter('metodo', event.target.value)}
            >
              <option value="all">Todos los métodos</option>
              {PAYMENT_METHODS.map(metodo => (
                <option key={metodo.value} value={metodo.value}>{metodo.label}</option>
              ))}
            </select>
          </label>

          <AdminDatePicker
            label="Rango de fechas"
            selectsRange
            value={filters.rangoFechas}
            onChange={(range) => {
              if (!range) {
                updateFilter('rangoFechas', [null, null])
              } else if (Array.isArray(range)) {
                updateFilter('rangoFechas', range)
              }
            }}
            placeholder="Selecciona un rango"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-ghost" onClick={resetFilters}>
            Limpiar filtros
          </button>
          <span className="text-xs uppercase tracking-[0.3em] text-slate-500">{filteredPayments.length} resultados</span>
        </div>

        {loading ? (
          <p className="muted text-sm">Cargando historial…</p>
        ) : filteredPayments.length ? (
          <AdminDataTable
            columns={paymentColumns}
            rows={filteredPayments}
            rowKey={pago => pago.id}
            caption={`Pagos encontrados: ${filteredPayments.length}`}
          />
        ) : (
          <p className="muted text-sm">Todavía no hay pagos registrados con los filtros seleccionados.</p>
        )}
      </div>

      {selectedInvoice && (
        <div className="admin-section space-y-4 print:p-0">
          <header className="flex flex-wrap items-center justify-between gap-3 print:hidden">
            <h2 className="text-lg font-semibold text-umber">Comprobante de pago</h2>
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-ghost" onClick={() => setSelectedInvoice(null)}>Cerrar</button>
              <button type="button" className="print-button" onClick={onImprimir}>
                🖨️ Imprimir comprobante
              </button>
            </div>
          </header>

          <div className="payment-invoice-wrapper">
            {(() => {
              const pago = selectedInvoice.pago || {}
              const actividad = selectedInvoice.actividad || {}
              const cliente = actividad?.cliente || pago?.cliente || 'Cliente sin nombre'
              const paquete = actividad?.paquete || pago?.paquete || 'Paquete sin definir'
              const agendaFecha = actividad?.agendaFecha || null
              const agendaHora = actividad?.agendaHora || null
              const comprobanteNumero = pago?.id ? String(pago.id).padStart(6, '0') : '—'
              const fechaSesion = agendaFecha ? formatDateOnly(agendaFecha) : 'Por definir'
              const horaSesion = agendaHora ? agendaHora.slice(0, 5) : '—'
              const fechaPago = pago?.fechaPago ? formatDate(pago.fechaPago) : 'Fecha pendiente'
              const estadoBadgeClass = pago?.estadoPagoInfo?.badgeClass || 'bg-amber-100 text-amber-700'
              const estadoPagoNombre = pago?.estadoPago || 'Pendiente'
              const detallePago = pago?.detallePago || ''
              const metodoPago = pago?.metodoPago || 'Método no especificado'
              const tipoPago = pago?.tipoPago || 'Pago'
              const reservaId = actividad?.id ?? pago?.actividadId

              return (
                <div className="payment-invoice">
                  <div className="payment-invoice__header">
                    <div className="payment-invoice__logo">FE</div>
                    <h3 className="payment-invoice__title">{STUDIO_INFO.name}</h3>
                    <p className="payment-invoice__subtitle">{STUDIO_INFO.slogan}</p>
                    <p className="payment-invoice__date">Fecha de emisión: {formatDateOnly(new Date())}</p>
                  </div>

                  <section className="payment-invoice__section">
                    <h3>Detalles del comprobante</h3>
                    <div className="payment-invoice__grid payment-invoice__grid--two">
                      <div>
                        <p className="payment-invoice__item-title">Comprobante Nº</p>
                        <p className="payment-invoice__item-value">{comprobanteNumero}</p>
                      </div>
                      <div>
                        <p className="payment-invoice__item-title">Fecha de pago</p>
                        <p className="payment-invoice__item-value">{fechaPago}</p>
                      </div>
                      <div>
                        <p className="payment-invoice__item-title">Método</p>
                        <p className="payment-invoice__item-value">{metodoPago}</p>
                      </div>
                      <div>
                        <p className="payment-invoice__item-title">Tipo</p>
                        <p className="payment-invoice__item-value">{tipoPago}</p>
                      </div>
                    </div>
                  </section>

                  <section className="payment-invoice__section">
                    <h3>Reserva asociada</h3>
                    <div className="payment-invoice__grid payment-invoice__grid--two">
                      <div>
                        <p className="payment-invoice__item-title">Cliente</p>
                        <p className="payment-invoice__item-value">{cliente}</p>
                      </div>
                      <div>
                        <p className="payment-invoice__item-title">Reserva</p>
                        <p className="payment-invoice__item-value">#{reservaId ?? '—'}</p>
                      </div>
                      <div>
                        <p className="payment-invoice__item-title">Paquete</p>
                        <p className="payment-invoice__item-value">{paquete}</p>
                      </div>
                      <div>
                        <p className="payment-invoice__item-title">Sesión programada</p>
                        <p className="payment-invoice__item-value">
                          {fechaSesion}
                          {horaSesion !== '—' ? ` · ${horaSesion}` : ''}
                        </p>
                      </div>
                    </div>
                  </section>

                  <section className="payment-invoice__section">
                    <h3>Resumen de pago</h3>
                    <div className="payment-invoice__total">
                      <span className="payment-invoice__total-amount">{formatCurrency(pago?.monto)}</span>
                      <span className={`payment-invoice__badge ${estadoBadgeClass}`}>{estadoPagoNombre}</span>
                    </div>
                    {detallePago && (
                      <p className="mt-3 text-sm text-slate-600">Observaciones: {detallePago}</p>
                    )}
                  </section>

                  <div className="payment-invoice__footer">
                    Gracias por confiar en {STUDIO_INFO.name}. Este comprobante certifica que el pago fue recibido correctamente.
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
