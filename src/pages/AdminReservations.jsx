import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import AdminHelpCard from '../components/AdminHelpCard'

const ESTADOS = ['pendiente', 'confirmada', 'en progreso', 'pagado', 'completada', 'cancelada']

const defaultForm = {
  nombre: '',
  telefono: '',
  comentarios: '',
  fecha: '',
  estado: 'pendiente',
  paqueteId: ''
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

export default function AdminReservations(){
  const [reservas, setReservas] = useState([])
  const [paquetes, setPaquetes] = useState([])
  const [form, setForm] = useState(defaultForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState({ type: '', message: '' })
  const [rolClienteId, setRolClienteId] = useState(null)
  const [rolFotografoId, setRolFotografoId] = useState(null)

  const fetchData = async () => {
    setLoading(true)
    setFeedback({ type: '', message: '' })

    const [actividadesRes, paquetesRes, rolesRes] = await Promise.all([
      supabase
        .from('actividad')
        .select(`
          id,
          estado_pago,
          nombre_actividad,
          ubicacion,
          agenda:agenda ( fecha, horainicio ),
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
  }

  const resetForm = () => setForm(defaultForm)

  const reservasPendientes = useMemo(
    () => reservas.filter(reserva => reserva.estado === 'pendiente'),
    [reservas]
  )

  const onSubmit = async (event) => {
    event.preventDefault()
    setFeedback({ type: '', message: '' })

    if (!form.nombre || !form.fecha || !form.paqueteId) {
      setFeedback({ type: 'error', message: 'El nombre del cliente, la fecha y el paquete son obligatorios.' })
      return
    }

    if (!rolClienteId) {
      setFeedback({ type: 'error', message: 'No se pudo determinar el rol de cliente. Revisa la configuración de roles.' })
      return
    }

    setSaving(true)

    const { data: usuarioData, error: usuarioError } = await supabase
      .from('usuario')
      .insert([
        {
          username: form.nombre,
          telefono: form.telefono || null,
          idRol: rolClienteId
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

    await supabase.from('cliente').insert([{ idusuario: usuarioData.id, Descuento: 0 }])

    if (!rolFotografoId) {
      setFeedback({ type: 'error', message: 'No hay fotógrafos disponibles para asignar a la reserva.' })
      setSaving(false)
      return
    }

    const { data: fotografoData } = await supabase
      .from('usuario')
      .select('id')
      .eq('idRol', rolFotografoId)
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
      horainicio: '09:00:00',
      horafin: '10:00:00',
      disponible: false
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

    const { error: actividadError } = await supabase
      .from('actividad')
      .insert([
        {
          idcliente: usuarioData.id,
          idagenda: agendaData.id,
          idpaquete: Number(form.paqueteId),
          estado_pago: form.estado,
          nombre_actividad: form.comentarios || null,
          ubicacion: null
        }
      ])

    if (actividadError) {
      console.error('No se pudo crear la reserva', actividadError)
      setFeedback({ type: 'error', message: 'Ocurrió un error al crear la reserva.' })
    } else {
      setFeedback({ type: 'success', message: 'Reserva creada correctamente.' })
      resetForm()
      fetchData()
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
                  <th className="p-2">Paquete</th>
                  <th className="p-2">Fecha</th>
                  <th className="p-2">Estado</th>
                  <th className="p-2">Comentarios</th>
                </tr>
              </thead>
              <tbody>
                {reservas.map(reserva => (
                  <tr key={reserva.id} className="border-b last:border-0">
                    <td className="p-2 font-medium text-slate-700">{reserva.nombre}</td>
                    <td className="p-2">{reserva.paquete}</td>
                    <td className="p-2">{formatDate(reserva.fecha)}</td>
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
                <div className="text-xs text-slate-500">{formatDate(reserva.fecha)}</div>
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
