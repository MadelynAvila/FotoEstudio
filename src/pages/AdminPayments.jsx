import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import AdminHelpCard from '../components/AdminHelpCard'
import AdminDataTable from '../components/AdminDataTable'
import AdminDatePicker from '../components/AdminDatePicker'

const PAYMENT_METHODS = [
  { value: 'Transferencia', label: 'Transferencia bancaria' },
  { value: 'Efectivo', label: 'Efectivo' }
]

const defaultForm = { idactividad: '', monto: '', metodo: PAYMENT_METHODS[0].value, detalle: '' }
const defaultFilters = { search: '', metodo: 'all', rangoFechas: [null, null] }

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
  return `Q${amount.toLocaleString('es-GT')}`
}

export default function AdminPayments(){
  const [activities, setActivities] = useState([])
  const [payments, setPayments] = useState([])
  const [form, setForm] = useState(defaultForm)
  const [filters, setFilters] = useState(defaultFilters)
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState({ type: '', message: '' })

  const fetchPayments = useCallback(async () => {
    setLoading(true)
    setFeedback({ type: '', message: '' })

    const [actividadesRes, pagosRes] = await Promise.all([
      supabase
        .from('actividad')
        .select(`
          id,
          nombre_actividad,
          estado_pago,
          agenda:agenda ( fecha, horainicio ),
          cliente:usuario!actividad_idusuario_fkey ( id, username, telefono ),
          paquete:paquete ( id, nombre_paquete, precio )
        `)
        .order('id', { ascending: false }),
      supabase
        .from('pago')
        .select('id, idactividad, metodo_pago, monto, fecha_pago, detalle_pago')
        .order('fecha_pago', { ascending: false })
    ])

    if (actividadesRes.error || pagosRes.error) {
      console.error('No se pudieron cargar los pagos', actividadesRes.error || pagosRes.error)
      setActivities([])
      setPayments([])
      setFeedback({ type: 'error', message: 'No pudimos cargar la información de pagos.' })
      setLoading(false)
      return
    }

    const actividadesData = actividadesRes.data ?? []
    const pagosData = pagosRes.data ?? []

    const normalizedActivities = actividadesData.map(item => ({
      id: item.id,
      nombre: item.nombre_actividad || '',
      estadoPago: item.estado_pago || 'Pendiente',
      cliente: item.cliente?.username || 'Cliente sin nombre',
      clienteTelefono: item.cliente?.telefono || '',
      paquete: item.paquete?.nombre_paquete || 'Paquete sin definir',
      paquetePrecio: item.paquete?.precio ?? null,
      agendaFecha: item.agenda?.fecha || null,
      agendaHora: item.agenda?.horainicio || null
    }))

    const actividadMap = new Map(normalizedActivities.map(item => [Number(item.id), item]))

    const formattedPayments = pagosData.map(pago => {
      const actividad = actividadMap.get(Number(pago.idactividad)) || null
      return {
        id: pago.id,
        actividadId: pago.idactividad,
        metodoPago: pago.metodo_pago || 'Método no especificado',
        monto: Number(pago.monto ?? 0),
        fechaPago: pago.fecha_pago || null,
        detallePago: pago.detalle_pago || '',
        cliente: actividad?.cliente || 'Cliente sin nombre',
        paquete: actividad?.paquete || 'Paquete sin definir',
        estadoPago: actividad?.estadoPago || 'Pendiente',
        agendaFecha: actividad?.agendaFecha || null,
        agendaHora: actividad?.agendaHora || null,
        actividad
      }
    })

    setActivities(normalizedActivities)
    setPayments(formattedPayments)
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
    setForm(defaultForm)
    setFeedback({ type: '', message: '' })
  }

  const resetFilters = () => {
    setFilters(defaultFilters)
  }

  const activitiesWithoutPayment = useMemo(() => {
    if (!activities.length) return []
    const pagosSet = new Set(payments.map(pago => Number(pago.actividadId)))
    return activities.filter(activity => !pagosSet.has(Number(activity.id)))
  }, [activities, payments])

  const activitiesMap = useMemo(
    () => new Map(activities.map(activity => [Number(activity.id), activity])),
    [activities]
  )

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
        normalize(pago.paquete).includes(searchTerm)

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
            <span className="inline-flex w-fit items-center rounded-full bg-[#f3e6d6] px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-[#5b4636]">
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
          <button type="button" className="btn btn-ghost" onClick={() => handleViewInvoice(pago)}>
            Ver factura
          </button>
        )
      }
    ],
    [handleViewInvoice]
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

    setSaving(true)

    const actividadId = Number(form.idactividad)
    const { data: existingPayments = [], error: existingError } = await supabase
      .from('pago')
      .select('id')
      .eq('idactividad', actividadId)
      .limit(1)

    if (existingError) {
      console.error('Error verificando duplicados de pago', existingError)
    }

    if ((existingPayments ?? []).length) {
      setFeedback({ type: 'error', message: 'Esta reserva ya cuenta con un pago registrado.' })
      setSaving(false)
      return
    }

    const payload = {
      idactividad: actividadId,
      metodo_pago: form.metodo || PAYMENT_METHODS[0].value,
      monto,
      fecha_pago: new Date().toISOString(),
      detalle_pago: form.detalle ? form.detalle.trim() : null
    }

    const { data, error } = await supabase
      .from('pago')
      .insert([payload])
      .select('id, idactividad, monto, metodo_pago, fecha_pago, detalle_pago')
      .single()

    if (error || !data) {
      console.error('No se pudo registrar el pago', error)
      setFeedback({ type: 'error', message: 'No se pudo registrar el pago.' })
      setSaving(false)
      return
    }

    await supabase.from('actividad').update({ estado_pago: 'Pagado' }).eq('id', actividadId)

    const actividadAsociada = activitiesMap.get(actividadId) || null
    const nuevoPago = {
      id: data.id,
      actividadId: data.idactividad,
      metodoPago: data.metodo_pago,
      monto: Number(data.monto ?? 0),
      fechaPago: data.fecha_pago,
      detallePago: data.detalle_pago || '',
      cliente: actividadAsociada?.cliente || 'Cliente sin nombre',
      paquete: actividadAsociada?.paquete || 'Paquete sin definir',
      estadoPago: actividadAsociada?.estadoPago || 'Pagado',
      agendaFecha: actividadAsociada?.agendaFecha || null,
      agendaHora: actividadAsociada?.agendaHora || null,
      actividad: actividadAsociada || null
    }

    setSelectedInvoice({ actividad: actividadAsociada, pago: nuevoPago })
    setFeedback({ type: 'success', message: 'Pago registrado correctamente. Se actualizó el estado a pagado.' })
    setForm(defaultForm)
    setSaving(false)
    fetchPayments()
  }

  const onImprimir = () => {
    window.print()
  }

  return (
    <div className="admin-page">
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
                onChange={event => updateField('idactividad', event.target.value)}
                className="border rounded-xl2 px-3 py-2"
              >
                <option value="">Reservas sin pago registrado</option>
                {activitiesWithoutPayment.map(actividad => {
                  const fecha = actividad.agendaFecha
                    ? new Date(actividad.agendaFecha).toLocaleDateString('es-GT')
                    : 'Sin fecha'
                  return (
                    <option key={actividad.id} value={actividad.id}>
                      #{actividad.id} — {actividad.cliente} ({actividad.paquete}, {fecha})
                    </option>
                  )
                })}
              </select>
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Método de pago</span>
              <select
                value={form.metodo}
                onChange={event => updateField('metodo', event.target.value)}
                className="border rounded-xl2 px-3 py-2"
              >
                {PAYMENT_METHODS.map(metodo => (
                  <option key={metodo.value} value={metodo.value}>{metodo.label}</option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Monto cobrado (Q)</span>
              <input
                value={form.monto}
                onChange={event => updateField('monto', event.target.value)}
                className="border rounded-xl2 px-3 py-2"
                placeholder="Ej. 1800"
                inputMode="decimal"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Detalle del pago (opcional)</span>
              <textarea
                value={form.detalle}
                onChange={event => updateField('detalle', event.target.value)}
                className="border rounded-xl2 px-3 py-2"
                rows={2}
                placeholder="Número de recibo o nota interna"
              />
            </label>

            <button className="btn btn-primary w-fit" disabled={saving}>
              {saving ? 'Registrando…' : 'Registrar pago'}
            </button>
            {feedback.message && (
              <p className={`text-sm ${feedback.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
                {feedback.message}
              </p>
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
              className="border rounded-xl2 px-3 py-2"
              placeholder="Cliente o paquete"
              value={filters.search}
              onChange={event => updateFilter('search', event.target.value)}
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-700">Método de pago</span>
            <select
              className="border rounded-xl2 px-3 py-2"
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
        <div className="admin-section print:p-0">
          <header className="flex flex-wrap justify-between gap-3 mb-4 print:hidden">
            <h2 className="text-lg font-semibold text-umber">Factura del pago</h2>
            <div className="flex gap-2">
              <button className="btn btn-ghost" onClick={() => setSelectedInvoice(null)}>Cerrar</button>
              <button className="btn btn-primary" onClick={onImprimir}>Imprimir</button>
            </div>
          </header>
          <div className="grid gap-2 text-sm">
            <div><strong>Reserva:</strong> #{selectedInvoice.actividad?.id ?? selectedInvoice.pago?.actividadId}</div>
            <div><strong>Cliente:</strong> {selectedInvoice.actividad?.cliente || selectedInvoice.pago?.cliente}</div>
            <div><strong>Paquete:</strong> {selectedInvoice.actividad?.paquete || selectedInvoice.pago?.paquete}</div>
            <div><strong>Monto:</strong> {formatCurrency(selectedInvoice.pago?.monto)}</div>
            <div><strong>Método:</strong> {selectedInvoice.pago?.metodoPago}</div>
            <div><strong>Fecha de pago:</strong> {formatDate(selectedInvoice.pago?.fechaPago)}</div>
            {selectedInvoice.pago?.detallePago && (
              <div><strong>Detalle:</strong> {selectedInvoice.pago.detallePago}</div>
            )}
            {selectedInvoice.actividad?.agendaFecha && (
              <div>
                <strong>Sesión programada:</strong>{' '}
                {new Date(selectedInvoice.actividad.agendaFecha).toLocaleDateString('es-GT')}
                {selectedInvoice.actividad.agendaHora && ` · ${selectedInvoice.actividad.agendaHora.slice(0, 5)}`}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
