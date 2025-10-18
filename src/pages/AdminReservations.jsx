import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import AdminHelpCard from '../components/AdminHelpCard'

const ESTADOS = ['pendiente', 'confirmada', 'en progreso', 'pagado', 'completada', 'cancelada']

const defaultForm = {
  nombre: '',
  telefono: '',
  comentarios: '',
  fecha: '',
  horaInicio: '',
  horaFin: '',
  ubicacion: '',
  estado: 'pendiente',
  paqueteId: ''
}

function formatearHoraParaDB(value) {
  if (!value) return null
  const [horas = '00', minutos = '00'] = String(value).split(':')
  return `${horas.padStart(2, '0')}:${minutos.padStart(2, '0')}:00`
}

function formatEstado(value) {
  if (!value) return 'Pendiente'
  const lower = value.toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
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

export default function AdminReservations() {
  const [reservas, setReservas] = useState([])
  const [paquetes, setPaquetes] = useState([])
  const [form, setForm] = useState(defaultForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState({ type: '', message: '' })
  const [rolClienteId, setRolClienteId] = useState(null)
  const [rolFotografoId, setRolFotografoId] = useState(null)

  const fetchData = async ({ preserveFeedback = false } = {}) => {
    setLoading(true)
    if (!preserveFeedback) setFeedback({ type: '', message: '' })

    const [actividadesRes, paquetesRes, rolesRes] = await Promise.all([
      supabase
        .from('actividad')
        .select('id, idusuario, idagenda, idpaquete, estado_pago, nombre_actividad, ubicacion')
        .order('id', { ascending: false }),
      supabase
        .from('paquete')
        .select('id, nombre_paquete')
        .order('nombre_paquete', { ascending: true }),
      supabase
        .from('rol')
        .select('id, nombre')
    ])

    const errors = [actividadesRes.error, paquetesRes.error, rolesRes.error].filter(Boolean)
    if (errors.length) {
      errors.forEach(err => console.error('Error cargando reservas', err))
      setReservas([])
      setPaquetes([])
      setFeedback({ type: 'error', message: 'Error cargando datos desde Supabase.' })
      setLoading(false)
      return
    }

    const actividades = actividadesRes.data ?? []
    const agendaIds = Array.from(new Set(actividades.map(item => item.idagenda).filter(Boolean)))
    const clienteIds = Array.from(new Set(actividades.map(item => item.idusuario).filter(Boolean)))

    const { data: agendasData = [] } = agendaIds.length
      ? await supabase.from('agenda').select('id, fecha, horainicio, horafin, idfotografo').in('id', agendaIds)
      : { data: [] }

    const fotografoIds = Array.from(new Set((agendasData ?? []).map(a => a.idfotografo).filter(Boolean)))
    const usuarioIds = Array.from(new Set([...clienteIds, ...fotografoIds]))

    const { data: usuariosData = [] } = usuarioIds.length
      ? await supabase.from('usuario').select('id, username, telefono').in('id', usuarioIds)
      : { data: [] }

    const agendaMap = new Map((agendasData ?? []).map(a => [a.id, a]))
    const usuarioMap = new Map((usuariosData ?? []).map(u => [u.id, u]))
    const paqueteMap = new Map((paquetesRes.data ?? []).map(p => [p.id, p.nombre_paquete]))

    const formatted = actividades.map(item => {
      const agenda = agendaMap.get(item.idagenda)
      const cliente = usuarioMap.get(item.idusuario)
      const fotografo = agenda ? usuarioMap.get(agenda.idfotografo) : null
      return {
        id: item.id,
        nombre: cliente?.username || 'Cliente sin nombre',
        telefono: cliente?.telefono || '—',
        comentarios: item.nombre_actividad || '',
        fecha: agenda?.fecha,
        horaInicio: agenda?.horainicio,
        horaFin: agenda?.horafin,
        fotografo: fotografo?.username || 'Sin asignar',
        fotografoTelefono: fotografo?.telefono || '—',
        ubicacion: item.ubicacion || 'No especificada',
        estado: (item.estado_pago || 'pendiente').toLowerCase(),
        paquete: paqueteMap.get(item.idpaquete) || 'Paquete sin asignar'
      }
    })

    const rolCliente = rolesRes.data?.find(r => r.nombre?.toLowerCase() === 'cliente')
    const rolFotografo = rolesRes.data?.find(r => r.nombre?.toLowerCase().includes('fotografo'))
    setRolClienteId(rolCliente?.id ?? null)
    setRolFotografoId(rolFotografo?.id ?? null)
    setReservas(formatted)
    setPaquetes(paquetesRes.data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setFeedback({ type: '', message: '' })
  }

  const resetForm = () => setForm(defaultForm)

  const reservasPendientes = useMemo(() => reservas.filter(r => r.estado === 'pendiente'), [reservas])

  const onSubmit = async e => {
    e.preventDefault()
    setFeedback({ type: '', message: '' })

    if (!form.nombre || !form.fecha || !form.paqueteId || !form.horaInicio || !form.horaFin || !form.ubicacion) {
      setFeedback({ type: 'error', message: 'Todos los campos obligatorios deben completarse.' })
      return
    }

    setSaving(true)

    // Verificar si el usuario ya existe
    const { data: usuarioExistente } = await supabase
      .from('usuario')
      .select('id, telefono, idrol')
      .eq('username', form.nombre)
      .maybeSingle()

    let usuarioId = usuarioExistente?.id ?? null

    if (!usuarioId) {
      const { data: usuarioData, error: usuarioError } = await supabase
        .from('usuario')
        .insert([{ username: form.nombre, telefono: form.telefono || null, idrol: rolClienteId }])
        .select('id')
        .single()

      if (usuarioError || !usuarioData) {
        setFeedback({ type: 'error', message: 'Error registrando al cliente.' })
        setSaving(false)
        return
      }
      usuarioId = usuarioData.id
    }

    const { data: clienteExistente } = await supabase
      .from('cliente')
      .select('idcliente, idusuario')
      .eq('idusuario', usuarioId)
      .maybeSingle()

    let clienteData = clienteExistente

    if (!clienteData) {
      const { data: nuevoClienteData, error: clienteError } = await supabase
        .from('cliente')
        .insert([{ idusuario: usuarioId, Descuento: 0 }])
        .select('idcliente, idusuario')
        .single()

      if (clienteError) {
        setFeedback({ type: 'error', message: 'Error asociando la reserva al cliente.' })
        setSaving(false)
        return
      }

      clienteData = nuevoClienteData
    }

    const { data: fotografoData } = await supabase
      .from('usuario')
      .select('id')
      .eq('idrol', rolFotografoId)
      .limit(1)
      .maybeSingle()

    const fotografoAsignado = fotografoData?.id
    if (!fotografoAsignado) {
      setFeedback({ type: 'error', message: 'No hay fotógrafos disponibles.' })
      setSaving(false)
      return
    }

    const agendaPayload = {
      idfotografo: fotografoAsignado,
      fecha: form.fecha,
      horainicio: formatearHoraParaDB(form.horaInicio),
      horafin: formatearHoraParaDB(form.horaFin),
      disponible: false
    }

    const { data: agendaData, error: agendaError } = await supabase
      .from('agenda')
      .insert([agendaPayload])
      .select('id')
      .single()

    if (agendaError || !agendaData) {
      setFeedback({ type: 'error', message: 'Error creando la agenda de la reserva.' })
      setSaving(false)
      return
    }

    const nombrePaquete = paquetes.find(p => String(p.id) === String(form.paqueteId))?.nombre_paquete
    const nombreActividad = form.comentarios || (nombrePaquete ? `Reserva para ${nombrePaquete}` : 'Reserva desde el panel de administración')

    const { error: actividadError } = await supabase
      .from('actividad')
      .insert([
        {
          idusuario: clienteData?.idusuario ?? usuarioId,
          idagenda: agendaData.id,
          idpaquete: Number(form.paqueteId),
          estado_pago: formatEstado(form.estado),
          nombre_actividad: nombreActividad,
          ubicacion: form.ubicacion
        }
      ])

    if (actividadError) {
      setFeedback({ type: 'error', message: 'Error creando la reserva.' })
    } else {
      setFeedback({ type: 'success', message: 'Reserva creada correctamente.' })
      resetForm()
      await fetchData({ preserveFeedback: true })
    }

    setSaving(false)
  }

  const onEstadoChange = async (id, nuevoEstado) => {
    const estadoNormalizado = formatEstado(nuevoEstado)
    const { error } = await supabase.from('actividad').update({ estado_pago: estadoNormalizado }).eq('id', id)
    if (error) setFeedback({ type: 'error', message: 'Error actualizando estado.' })
    else setReservas(prev => prev.map(r => (r.id === id ? { ...r, estado: nuevoEstado } : r)))
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        <div className="card flex-1 p-5 space-y-4">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-umber">Gestión de reservas</h1>
              <p className="muted text-sm">Registra nuevas solicitudes y da seguimiento a las existentes.</p>
            </div>
            <button type="button" onClick={resetForm} className="btn btn-ghost">Limpiar formulario</button>
          </header>

          <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Nombre del cliente *</span>
              <input value={form.nombre} onChange={e => updateField('nombre', e.target.value)} className="border rounded-xl2 px-3 py-2" placeholder="Ej. Juan Pérez" />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Teléfono</span>
              <input value={form.telefono} onChange={e => updateField('telefono', e.target.value)} className="border rounded-xl2 px-3 py-2" placeholder="5555-5555" />
            </label>
            <label className="grid gap-1 text-sm md:col-span-2">
              <span className="font-medium text-slate-700">Comentarios</span>
              <textarea value={form.comentarios} onChange={e => updateField('comentarios', e.target.value)} className="border rounded-xl2 px-3 py-2 min-h-[100px]" placeholder="Detalles adicionales, paquete solicitado, etc." />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Fecha solicitada *</span>
              <input type="date" value={form.fecha} onChange={e => updateField('fecha', e.target.value)} className="border rounded-xl2 px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Hora de inicio *</span>
              <input type="time" value={form.horaInicio} onChange={e => updateField('horaInicio', e.target.value)} className="border rounded-xl2 px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Hora de fin *</span>
              <input type="time" value={form.horaFin} onChange={e => updateField('horaFin', e.target.value)} className="border rounded-xl2 px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Paquete *</span>
              <select value={form.paqueteId} onChange={e => updateField('paqueteId', e.target.value)} className="border rounded-xl2 px-3 py-2">
                <option value="">Selecciona un paquete</option>
                {paquetes.map(p => <option key={p.id} value={p.id}>{p.nombre_paquete}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm md:col-span-2">
              <span className="font-medium text-slate-700">Ubicación *</span>
              <input value={form.ubicacion} onChange={e => updateField('ubicacion', e.target.value)} className="border rounded-xl2 px-3 py-2" placeholder="Dirección o referencia" />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Estado</span>
              <select value={form.estado} onChange={e => updateField('estado', e.target.value)} className="border rounded-xl2 px-3 py-2">
                {ESTADOS.map(estado => <option key={estado} value={estado}>{formatEstado(estado)}</option>)}
              </select>
            </label>
            <div className="md:col-span-2 flex items-center gap-3">
              <button className="btn btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar reserva'}</button>
              {feedback.message && <p className={`text-sm ${feedback.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>{feedback.message}</p>}
            </div>
          </form>
        </div>

        <div className="lg:w-[320px]">
          <AdminHelpCard title="Sugerencias para seguimiento">
            <p>Confirma rápidamente las reservas pendientes para mejorar la experiencia de tus clientes.</p>
            <p>Usa los estados para coordinar tareas internas y mantener al equipo informado.</p>
            <p>Agrega comentarios con detalles relevantes como locaciones o requerimientos especiales.</p>
          </AdminHelpCard>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="text-lg font-semibold text-umber mb-3">Reservas registradas</h2>
        {loading ? (
          <p className="muted text-sm">Cargando reservas…</p>
        ) : reservas.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-sand text-left uppercase text-xs tracking-wide text-slate-600">
                <tr>
                  <th className="p-2">Cliente</th>
                  <th className="p-2">Teléfono</th>
                  <th className="p-2">Paquete</th>
                  <th className="p-2">Fecha</th>
                  <th className="p-2">Horario</th>
                  <th className="p-2">Fotógrafo</th>
                  <th className="p-2">Ubicación</th>
                  <th className="p-2">Estado</th>
                  <th className="p-2">Comentarios</th>
                </tr>
              </thead>
              <tbody>
                {reservas.map(reserva => (
                  <tr key={reserva.id} className="border-b last:border-0">
                    <td className="p-2 font-medium text-slate-700">{reserva.nombre}</td>
                    <td className="p-2">{reserva.telefono}</td>
                    <td className="p-2">{reserva.paquete}</td>
                    <td className="p-2">{formatDate(reserva.fecha)}</td>
                    <td className="p-2">{formatTimeRange(reserva.horaInicio, reserva.horaFin)}</td>
                    <td className="p-2">
                      <div>{reserva.fotografo}</div>
                      <div className="text-xs text-slate-500">{reserva.fotografoTelefono}</div>
                    </td>
                    <td className="p-2 text-slate-600">{reserva.ubicacion}</td>
                    <td className="p-2">
                      <select value={reserva.estado} onChange={e => onEstadoChange(reserva.id, e.target.value)} className="border rounded-xl2 px-2 py-1">
                        {ESTADOS.map(estado => <option key={estado} value={estado}>{formatEstado(estado)}</option>)}
                      </select>
                    </td>
                    <td className="p-2 text-slate-600 whitespace-pre-line">{reserva.comentarios || 'Sin comentarios'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted text-sm">Todavía no hay reservas registradas.</p>
        )}
      </div>

      <div className="card p-5">
        <h2 className="text-lg font-semibold text-umber mb-3">Reservas pendientes</h2>
        {reservasPendientes.length ? (
          <ul className="space-y-2 text-sm">
            {reservasPendientes.map(r => (
              <li key={r.id} className="card border border-[var(--border)] p-3">
                <strong>{r.nombre}</strong> — {r.paquete}
                <div className="text-xs text-slate-500">
                  {formatDate(r.fecha)} · {formatTimeRange(r.horaInicio, r.horaFin)}
                </div>
                <div className="text-xs text-slate-500">Fotógrafo: {r.fotografo}</div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted text-sm">No tienes reservas pendientes en este momento.</p>
        )}
      </div>
    </div>
  )
}

