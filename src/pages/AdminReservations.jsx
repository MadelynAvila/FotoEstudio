import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import AdminHelpCard from '../components/AdminHelpCard'
import AdminDataTable from '../components/AdminDataTable'
import AdminDatePicker from '../components/AdminDatePicker'

const estadoColorStyles = {
  pendiente: { bg: '#FFF8E1', text: '#8A6D3B' },
  reservada: { bg: '#E4DDCC', text: '#5B4636' },
  'en progreso': { bg: '#DDE8E8', text: '#2F4F4F' },
  'en edicion': { bg: '#E5D8F0', text: '#4C2B68' },
  impresion: { bg: '#F5EDE3', text: '#5B4636' },
  lista: { bg: '#F2E8DA', text: '#5B4636' },
  entregada: { bg: '#E6F4EA', text: '#2F6B3F' }
}

const defaultFilters = {
  search: '',
  estado: 'all',
  fotografo: 'all',
  fecha: null
}

function normalize(value) {
  if (!value) return ''
  return value
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9\s]/g, '')
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-GT', { dateStyle: 'medium' }).format(date)
}

function formatTime(value) {
  if (!value) return '—'
  const [hours = '', minutes = ''] = String(value).split(':')
  const h = hours.padStart(2, '0')
  const m = minutes.padStart(2, '0')
  return `${h}:${m}`
}

function formatTimeRange(inicio, fin) {
  if (!inicio && !fin) return '—'
  if (inicio && !fin) return formatTime(inicio)
  if (!inicio && fin) return formatTime(fin)
  return `${formatTime(inicio)} – ${formatTime(fin)}`
}

function getEstadoStyles(nombre) {
  const key = normalize(nombre)
  return estadoColorStyles[key] || { bg: '#EEE0D1', text: '#5B4636' }
}

function toDate(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date
}

function isSameDay(dateValue, targetDate) {
  if (!dateValue || !targetDate) return false
  const dateA = toDate(dateValue)
  const dateB = toDate(targetDate)
  if (!dateA || !dateB) return false
  return dateA.toISOString().slice(0, 10) === dateB.toISOString().slice(0, 10)
}

export default function AdminReservations() {
  const [reservas, setReservas] = useState([])
  const [estados, setEstados] = useState([])
  const [filters, setFilters] = useState(defaultFilters)
  const [selection, setSelection] = useState({})
  const [feedback, setFeedback] = useState({ type: '', message: '' })
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState(null)

  const reservadaEstadoId = useMemo(() => {
    const estado = estados.find(item => normalize(item?.nombre_estado) === 'reservada')
    return estado?.id ?? null
  }, [estados])

  const loadReservas = async () => {
    setLoading(true)
    setFeedback({ type: '', message: '' })

    const [actividadesRes, estadosRes] = await Promise.all([
      supabase
        .from('actividad')
        .select('id, idusuario, idagenda, idpaquete, idestado_actividad, estado_pago')
        .order('id', { ascending: false }),
      supabase
        .from('estado_actividad')
        .select('id, nombre_estado, orden')
        .order('orden', { ascending: true })
    ])

    const errors = [actividadesRes.error, estadosRes.error].filter(Boolean)
    if (errors.length) {
      errors.forEach(err => console.error('Error cargando reservas', err))
      setReservas([])
      setEstados([])
      setSelection({})
      setFeedback({ type: 'error', message: 'No se pudieron cargar las reservas. Intenta nuevamente.' })
      setLoading(false)
      return
    }

    const actividades = actividadesRes.data ?? []
    const estadosData = estadosRes.data ?? []

    const agendaIds = Array.from(new Set(actividades.map(item => item.idagenda).filter(Boolean)))
    const paqueteIds = Array.from(new Set(actividades.map(item => item.idpaquete).filter(Boolean)))
    const clienteIds = actividades.map(item => item.idusuario).filter(Boolean)

    const [{ data: agendasData = [], error: agendaError }, { data: paquetesData = [], error: paquetesError }] = await Promise.all([
      agendaIds.length
        ? supabase.from('agenda').select('id, fecha, horainicio, horafin, idfotografo').in('id', agendaIds)
        : Promise.resolve({ data: [], error: null }),
      paqueteIds.length
        ? supabase.from('paquete').select('id, nombre_paquete').in('id', paqueteIds)
        : Promise.resolve({ data: [], error: null })
    ])

    const errorsSecundarios = [agendaError, paquetesError].filter(Boolean)
    if (errorsSecundarios.length) errorsSecundarios.forEach(err => console.error('Error cargando datos relacionados', err))

    const fotografoIds = Array.from(new Set((agendasData ?? []).map(a => a.idfotografo).filter(Boolean)))
    const usuarioIds = Array.from(new Set([...clienteIds, ...fotografoIds]))

    const { data: usuariosData = [], error: usuariosError } = usuarioIds.length
      ? await supabase.from('usuario').select('id, username').in('id', usuarioIds)
      : { data: [], error: null }

    if (usuariosError) console.error('Error cargando usuarios relacionados', usuariosError)

    const agendaMap = new Map((agendasData ?? []).map(agenda => [agenda.id, agenda]))
    const paqueteMap = new Map((paquetesData ?? []).map(paquete => [paquete.id, paquete]))
    const usuarioMap = new Map((usuariosData ?? []).map(usuario => [usuario.id, usuario]))
    const estadoMap = new Map((estadosData ?? []).map(estado => [estado.id, estado]))

    const formattedReservas = actividades.map(item => {
      const agenda = agendaMap.get(item.idagenda)
      const cliente = usuarioMap.get(item.idusuario)
      const fotografo = agenda ? usuarioMap.get(agenda.idfotografo) : null
      const paquete = paqueteMap.get(item.idpaquete)
      const estado = estadoMap.get(item.idestado_actividad)

      return {
        id: item.id,
        clienteId: cliente?.id ?? null,
        cliente: cliente?.username || 'Cliente sin nombre',
        fotografoId: fotografo?.id ?? null,
        fotografo: fotografo?.username || 'Sin asignar',
        paquete: paquete?.nombre_paquete || 'Paquete sin asignar',
        fecha: agenda?.fecha || null,
        horaInicio: agenda?.horainicio || null,
        horaFin: agenda?.horafin || null,
        estadoId: item.idestado_actividad ?? null,
        estadoNombre: estado?.nombre_estado || 'Pendiente',
        estadoPago: item.estado_pago || 'Pendiente',
        agendaId: item.idagenda || null
      }
    })

    setEstados(estadosData)
    setReservas(formattedReservas)
    setSelection(
      Object.fromEntries(
        formattedReservas.map(reserva => [reserva.id, reserva.estadoId ? String(reserva.estadoId) : ''])
      )
    )
    setLoading(false)
  }

  useEffect(() => {
    loadReservas()
  }, [])

  const filteredReservas = useMemo(() => {
    const searchTerm = normalize(filters.search)
    return reservas.filter(reserva => {
      const matchesSearch =
        !searchTerm ||
        normalize(reserva.cliente).includes(searchTerm) ||
        String(reserva.id).includes(filters.search.trim())

      const matchesEstado =
        filters.estado === 'all' || String(reserva.estadoId ?? '') === String(filters.estado)

      const matchesFotografo =
        filters.fotografo === 'all' || String(reserva.fotografoId ?? '') === String(filters.fotografo)

      const matchesFecha = !filters.fecha || isSameDay(reserva.fecha, filters.fecha)

      return matchesSearch && matchesEstado && matchesFotografo && matchesFecha
    })
  }, [reservas, filters])

  const fotografoOptions = useMemo(() => {
    const unique = new Map()
    reservas.forEach(reserva => {
      if (reserva.fotografoId) unique.set(reserva.fotografoId, reserva.fotografo)
    })
    return Array.from(unique.entries()).map(([id, nombre]) => ({ id, nombre }))
  }, [reservas])

  const reservasColumns = useMemo(
    () => [
      {
        id: 'reserva',
        label: 'Reserva',
        render: (reserva) => (
          <div className="space-y-1">
            <span className="text-sm font-semibold text-umber">#{reserva.id}</span>
            <p className="text-sm text-slate-600">{reserva.cliente}</p>
            <p className="text-xs text-slate-500">{reserva.paquete}</p>
          </div>
        )
      },
      {
        id: 'programacion',
        label: 'Programación',
        render: (reserva) => {
          const fotografoNombre = reserva.fotografo && reserva.fotografo !== 'Sin asignar'
            ? reserva.fotografo
            : 'Por asignar'
          return (
            <div className="space-y-1 text-sm text-slate-600">
              <p className="font-semibold text-umber">{formatDate(reserva.fecha)}</p>
              <p className="text-xs text-slate-500">{formatTimeRange(reserva.horaInicio, reserva.horaFin)}</p>
              <p className="text-xs text-slate-500">Fotógrafo: {fotografoNombre}</p>
            </div>
          )
        }
      },
      {
        id: 'estado',
        label: 'Estado actual',
        hideOnMobile: true,
        render: (reserva) => {
          const estadoStyles = getEstadoStyles(reserva.estadoNombre)
          return (
            <span
              className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]"
              style={{ backgroundColor: estadoStyles.bg, color: estadoStyles.text }}
            >
              {reserva.estadoNombre}
            </span>
          )
        }
      },
      {
        id: 'acciones',
        label: 'Actualizar estado',
        render: (reserva) => {
          const estadoActual = normalize(reserva.estadoNombre)
          const entregada = estadoActual === 'entregada'
          const selectedValue = selection[reserva.id] ?? ''
          const hasSelection = selectedValue !== ''
          const sameEstado =
            hasSelection && reserva.estadoId != null && Number(selectedValue) === Number(reserva.estadoId)
          const disableAction = entregada || updatingId === reserva.id

          return (
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
              <select
                className="rounded-2xl border border-[color:var(--border)] bg-white px-3 py-2 text-sm shadow-sm"
                value={selectedValue}
                onChange={event => onSelectEstado(reserva.id, event.target.value)}
                disabled={entregada}
              >
                <option value="">Selecciona un estado</option>
                {estados.map(estado => (
                  <option key={estado.id} value={estado.id}>
                    {estado.nombre_estado}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => actualizarEstado(reserva)}
                disabled={disableAction || !hasSelection || sameEstado}
              >
                {updatingId === reserva.id ? 'Guardando…' : 'Confirmar cambio'}
              </button>
            </div>
          )
        }
      }
    ],
    [estados, selection, updatingId]
  )

  const onFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }))
  }

  const onSelectEstado = (reservaId, value) => {
    setSelection(prev => ({ ...prev, [reservaId]: value }))
  }

  const actualizarEstado = async reserva => {
    const nuevoEstadoId = Number(selection[reserva.id])
    if (!nuevoEstadoId || nuevoEstadoId === reserva.estadoId) return

    const estadoActual = normalize(reserva.estadoNombre)
    if (estadoActual === 'entregada') {
      setFeedback({ type: 'warning', message: 'Las reservas entregadas no pueden modificarse.' })
      return
    }

    setUpdatingId(reserva.id)
    setFeedback({ type: '', message: '' })

    const payload = { idestado_actividad: nuevoEstadoId }
    if (reservadaEstadoId && nuevoEstadoId === Number(reservadaEstadoId)) {
      payload.estado_pago = 'Confirmado'
    }

    const { error } = await supabase.from('actividad').update(payload).eq('id', reserva.id)

    if (error) {
      console.error('Error actualizando estado', error)
      setFeedback({ type: 'error', message: 'No se pudo actualizar el estado. Intenta de nuevo.' })
    } else {
      const estadoActualizado = estados.find(item => Number(item.id) === nuevoEstadoId)
      setSelection(prev => ({ ...prev, [reserva.id]: String(nuevoEstadoId) }))
      setReservas(prev =>
        prev.map(item =>
          item.id === reserva.id
            ? {
                ...item,
                estadoId: nuevoEstadoId,
                estadoNombre: estadoActualizado?.nombre_estado || item.estadoNombre,
                estadoPago:
                  reservadaEstadoId && nuevoEstadoId === Number(reservadaEstadoId)
                    ? 'Confirmado'
                    : item.estadoPago
              }
            : item
        )
      )
      setFeedback({ type: 'success', message: 'Estado actualizado correctamente.' })
    }

    setUpdatingId(null)
  }

  return (
    <div className="admin-page space-y-6">
      <div className="admin-section space-y-4">
        <header className="admin-header">
          <div>
            <h1 className="text-xl font-semibold text-umber">Gestión de reservas</h1>
            <p className="muted text-sm">Administra el estado de cada actividad y mantén al equipo alineado.</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={loadReservas} className="btn btn-ghost" disabled={loading}>
              {loading ? 'Actualizando…' : 'Actualizar datos'}
            </button>
          </div>
        </header>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-700">Búsqueda rápida</span>
            <input
              className="border rounded-xl2 px-3 py-2"
              placeholder="Cliente o ID de reserva"
              value={filters.search}
              onChange={event => onFilterChange('search', event.target.value)}
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-700">Filtrar por estado</span>
            <select
              className="border rounded-xl2 px-3 py-2"
              value={filters.estado}
              onChange={event => onFilterChange('estado', event.target.value)}
            >
              <option value="all">Todos los estados</option>
              {estados.map(estado => (
                <option key={estado.id} value={estado.id}>
                  {estado.nombre_estado}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-700">Filtrar por fotógrafo</span>
            <select
              className="border rounded-xl2 px-3 py-2"
              value={filters.fotografo}
              onChange={event => onFilterChange('fotografo', event.target.value)}
            >
              <option value="all">Todos los fotógrafos</option>
              {fotografoOptions.map(option => (
                <option key={option.id} value={option.id}>
                  {option.nombre}
                </option>
              ))}
            </select>
          </label>

          <AdminDatePicker
            label="Filtrar por fecha"
            value={filters.fecha}
            onChange={date => onFilterChange('fecha', date ?? null)}
            placeholder="Selecciona un día"
          />
        </div>

        {feedback.message && (
          <div
            className={`rounded-3xl px-4 py-3 text-sm ${
              feedback.type === 'error'
                ? 'bg-red-50 text-red-700 border border-red-100'
                : feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                : 'bg-amber-50 text-amber-700 border border-amber-100'
            }`}
          >
            {feedback.message}
          </div>
        )}
      </div>

      <div className="admin-section space-y-4">
        <div className="admin-header">
          <div>
            <h2 className="text-lg font-semibold text-umber">Reservas registradas</h2>
            <p className="muted text-sm">Visualiza y actualiza el estado de cada actividad.</p>
          </div>
          <span className="text-xs uppercase tracking-[0.3em] text-slate-500">{filteredReservas.length} registros</span>
        </div>

        {loading ? (
          <p className="muted text-sm">Cargando reservas…</p>
        ) : filteredReservas.length ? (
          <AdminDataTable
            columns={reservasColumns}
            rows={filteredReservas}
            rowKey={reserva => reserva.id}
            caption={`Total de reservas: ${filteredReservas.length}`}
          />
        ) : (
          <p className="muted text-sm">No hay reservas que coincidan con los filtros seleccionados.</p>
        )}
      </div>

      <div className="admin-section">
        <AdminHelpCard title="Consejos de seguimiento">
          <p>Aprovecha los filtros para coordinar rápidamente las actividades pendientes.</p>
          <p>Confirma las reservas recién aprobadas para notificar a tu cliente y equipo.</p>
          <p>Una vez marcada como entregada, la reserva queda bloqueada para mantener el historial.</p>
        </AdminHelpCard>
      </div>
    </div>
  )
}
