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

function horaATotalMinutos(value) {
  if (!value) return null
  const [horas = '0', minutos = '0'] = String(value).split(':')
  const h = Number.parseInt(horas, 10)
  const m = Number.parseInt(minutos, 10)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return h * 60 + m
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

export default function AdminReservations(){
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
    if (!preserveFeedback) {
      setFeedback({ type: '', message: '' })
    }

    const [actividadesRes, paquetesRes, rolesRes] = await Promise.all([
      supabase
        .from('actividad')
        .select(`
          id,
          estado_pago,
          nombre_actividad,
          ubicacion,
          agenda:agenda (
            fecha,
            horainicio,
            horafin,
            fotografo:usuario!agenda_idfotografo_fkey (
              id,
              username,
              telefono
            )
          ),
          cliente:usuario!actividad_idcliente_fkey ( id, username, telefono ),
          paquete:paquete ( id, nombre_paquete )
        `)
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
      errors.forEach(err => console.error('No se pudieron cargar las reservas', err))
      setReservas([])
      setPaquetes([])
      setFeedback({ type: 'error', message: 'No pudimos obtener las reservas. Revisa tu configuración de Supabase.' })
      setLoading(false)
      return
    }

    const formatted = (actividadesRes.data ?? []).map(item => ({
      id: item.id,
      nombre: item.cliente?.username || 'Cliente sin nombre',
      telefono: item.cliente?.telefono || '—',
      comentarios: item.nombre_actividad || '',
      fecha: item.agenda?.fecha,
      horaInicio: item.agenda?.horainicio,
      horaFin: item.agenda?.horafin,
      fotografo: item.agenda?.fotografo?.username || 'Sin asignar',
      fotografoTelefono: item.agenda?.fotografo?.telefono || '—',
      ubicacion: item.ubicacion || 'No especificada',
      estado: (item.estado_pago || 'pendiente').toLowerCase(),
      paquete: item.paquete?.nombre_paquete || 'Paquete sin asignar'
    }))

    const rolCliente = rolesRes.data?.find(rol => rol.nombre?.toLowerCase() === 'cliente')
    const rolFotografo = rolesRes.data?.find(rol => rol.nombre?.toLowerCase() === 'fotografo' || rol.nombre?.toLowerCase() === 'fotógrafo')
    setRolClienteId(rolCliente?.id ?? null)
    setRolFotografoId(rolFotografo?.id ?? null)
    setReservas(formatted)
    setPaquetes(paquetesRes.data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setFeedback({ type: '', message: '' })
  }

  const resetForm = () => setForm(defaultForm)

  const reservasPendientes = useMemo(
    () => reservas.filter(reserva => reserva.estado === 'pendiente'),
    [reservas]
  )

  const onSubmit = async (event) => {
    event.preventDefault()
    setFeedback({ type: '', message: '' })

    if (!form.nombre || !form.fecha || !form.paqueteId || !form.horaInicio || !form.horaFin || !form.ubicacion) {
      setFeedback({ type: 'error', message: 'Nombre, fecha, horario, paquete y ubicación son obligatorios.' })
      return
    }

    if (!rolClienteId) {
      setFeedback({ type: 'error', message: 'No se pudo determinar el rol de cliente. Revisa la configuración de roles.' })
      return
    }

    const minutosInicio = horaATotalMinutos(form.horaInicio)
    const minutosFin = horaATotalMinutos(form.horaFin)

    if (minutosInicio === null || minutosFin === null || minutosInicio >= minutosFin) {
      setFeedback({ type: 'error', message: 'El horario seleccionado no es válido. Revisa las horas de inicio y fin.' })
      return
    }

    setSaving(true)

    const { data: usuarioData, error: usuarioError } = await supabase
      .from('usuario')
      .insert([
        {
          username: form.nombre,
          telefono: form.telefono || null,
          idrol: rolClienteId
        }
      ])
      .select('id')
      .single()

    if (usuarioError || !usuarioData) {
      console.error('No se pudo registrar el cliente', usuarioError)
      setFeedback({ type: 'error', message: 'Ocurrió un error al registrar el cliente para la reserva.' })
      setSaving(false)
      return
    }

    const { data: clienteData, error: clienteError } = await supabase
      .from('cliente')
      .insert([{ idusuario: usuarioData.id, Descuento: 0 }])
      .select('idcliente, idusuario')
      .single()

    if (clienteError) {
      console.error('No se pudo registrar el detalle del cliente', clienteError)
      setFeedback({ type: 'error', message: 'No se pudo asociar la reserva al cliente registrado.' })
      setSaving(false)
      return
    }

    if (!rolFotografoId) {
      setFeedback({ type: 'error', message: 'No hay fotógrafos disponibles para asignar a la reserva.' })
      setSaving(false)
      return
    }

    const { data: fotografoData } = await supabase
      .from('usuario')
      .select('id')
      .eq('idrol', rolFotografoId)
      .limit(1)
      .maybeSingle()

    const fotografoAsignado = fotografoData?.id
    if (!fotografoAsignado) {
      setFeedback({ type: 'error', message: 'No se encontró un fotógrafo disponible. Registra al menos uno en el sistema.' })
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

    const { data: agendaExistente } = await supabase
      .from('agenda')
      .select('id, horainicio, horafin, disponible')
      .eq('fecha', form.fecha)
      .eq('idfotografo', fotografoAsignado)

    const hayConflicto = (agendaExistente ?? []).some(item => {
      if (item.disponible === false) {
        const inicioAgenda = horaATotalMinutos(item.horainicio)
        const finAgenda = horaATotalMinutos(item.horafin)
        return inicioAgenda < minutosFin && minutosInicio < finAgenda
      }
      return false
    })

    if (hayConflicto) {
      setFeedback({ type: 'error', message: 'El fotógrafo asignado ya tiene una actividad registrada en ese horario.' })
      setSaving(false)
      return
    }

    const { data: agendaData, error: agendaError } = await supabase
      .from('agenda')
      .insert([agendaPayload])
      .select('id')
      .single()

    if (agendaError || !agendaData) {
      console.error('No se pudo crear la agenda', agendaError)
      setFeedback({ type: 'error', message: 'Ocurrió un error al crear la agenda de la reserva.' })
      setSaving(false)
      return
    }

    const nombrePaquete = paquetes.find(paquete => String(paquete.id) === String(form.paqueteId))?.nombre_paquete
    const nombreActividad = form.comentarios
      ? form.comentarios
      : nombrePaquete
        ? `Reserva para ${nombrePaquete}`
        : 'Reserva creada desde el panel de administración'

    const { error: actividadError } = await supabase
      .from('actividad')
      .insert([
        {
          idcliente: clienteData?.idusuario ?? usuarioData.id,
          idagenda: agendaData.id,
          idpaquete: Number(form.paqueteId),
          estado_pago: formatEstado(form.estado),

          nombre_actividad: nombreActividad,
          ubicacion: form.ubicacion
        }
      ])

    if (actividadError) {
      console.error('No se pudo crear la reserva', actividadError)
      setFeedback({ type: 'error', message: 'Ocurrió un error al crear la reserva.' })
    } else {
      setFeedback({ type: 'success', message: 'Reserva creada correctamente.' })
      resetForm()
      fetchData({ preserveFeedback: true })
    }

    setSaving(false)
  }

  const onEstadoChange = async (id, nuevoEstado) => {
    const { error } = await supabase
      .from('actividad')
      .update({ estado_pago: nuevoEstado })
      .eq('id', id)

    if (error) {
      console.error('No se pudo actualizar el estado', error)
      setFeedback({ type: 'error', message: 'No se pudo actualizar el estado de la reserva.' })
    } else {
      setReservas(prev => prev.map(reserva => (
        reserva.id === id ? { ...reserva, estado: nuevoEstado } : reserva
      )))
    }
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
              <input
                value={form.nombre}
                onChange={e => updateField('nombre', e.target.value)}
                className="border rounded-xl2 px-3 py-2"
                placeholder="Ej. Juan Pérez"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Teléfono</span>
              <input
                value={form.telefono}
                onChange={e => updateField('telefono', e.target.value)}
                className="border rounded-xl2 px-3 py-2"
                placeholder="5555-5555"
              />
            </label>
            <label className="grid gap-1 text-sm md:col-span-2">
              <span className="font-medium text-slate-700">Comentarios</span>
              <textarea
                value={form.comentarios}
                onChange={e => updateField('comentarios', e.target.value)}
                className="border rounded-xl2 px-3 py-2 min-h-[100px]"
                placeholder="Detalles adicionales, paquete solicitado, etc."
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Fecha solicitada *</span>
              <input
                type="date"
                value={form.fecha}
                onChange={e => updateField('fecha', e.target.value)}
                className="border rounded-xl2 px-3 py-2"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Hora de inicio *</span>
              <input
                type="time"
                value={form.horaInicio}
                onChange={e => updateField('horaInicio', e.target.value)}
                className="border rounded-xl2 px-3 py-2"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Hora de fin *</span>
              <input
                type="time"
                value={form.horaFin}
                onChange={e => updateField('horaFin', e.target.value)}
                className="border rounded-xl2 px-3 py-2"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Paquete *</span>
              <select
                value={form.paqueteId}
                onChange={e => updateField('paqueteId', e.target.value)}
                className="border rounded-xl2 px-3 py-2"
              >
                <option value="">Selecciona un paquete</option>
                {paquetes.map(paquete => (
                  <option key={paquete.id} value={paquete.id}>{paquete.nombre_paquete}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm md:col-span-2">
              <span className="font-medium text-slate-700">Ubicación *</span>
              <input
                value={form.ubicacion}
                onChange={e => updateField('ubicacion', e.target.value)}
                className="border rounded-xl2 px-3 py-2"
                placeholder="Dirección, zona o referencia"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Estado</span>
              <select
                value={form.estado}
                onChange={e => updateField('estado', e.target.value)}
                className="border rounded-xl2 px-3 py-2"
              >
                {ESTADOS.map(estado => (
                  <option key={estado} value={estado}>{formatEstado(estado)}</option>
                ))}
              </select>
            </label>
            <div className="md:col-span-2 flex items-center gap-3">
              <button className="btn btn-primary" disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar reserva'}
              </button>
              {feedback.message && (
                <p className={`text-sm ${feedback.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
                  {feedback.message}
                </p>
              )}
            </div>
          </form>
        </div>

        <div className="lg:w-[320px]">
          <AdminHelpCard title="Sugerencias para seguimiento">
            <p>Confirma rápidamente las reservas pendientes para mejorar la experiencia de tus clientes.</p>
            <p>Utiliza los estados para coordinar tareas internas y mantener al equipo informado.</p>
            <p>Actualiza los comentarios con detalles relevantes como locaciones o requerimientos especiales.</p>
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
                      <select
                        value={reserva.estado}
                        onChange={e => onEstadoChange(reserva.id, e.target.value)}
                        className="border rounded-xl2 px-2 py-1"
                      >
                        {ESTADOS.map(estado => (
                          <option key={estado} value={estado}>{formatEstado(estado)}</option>
                        ))}
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
            {reservasPendientes.map(reserva => (
              <li key={reserva.id} className="card border border-[var(--border)] p-3">
                <strong>{reserva.nombre}</strong> — {reserva.paquete}
                <div className="text-xs text-slate-500">
                  {formatDate(reserva.fecha)} · {formatTimeRange(reserva.horaInicio, reserva.horaFin)}
                </div>
                <div className="text-xs text-slate-500">Fotógrafo: {reserva.fotografo}</div>
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
