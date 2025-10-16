import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import AdminHelpCard from '../components/AdminHelpCard'

const ESTADOS = ['pendiente', 'confirmada', 'en progreso', 'pagado', 'completada', 'cancelada']

const defaultForm = {
  nombre: '',
  telefono: '',
  comentarios: '',
  fecha: '',
  estado: 'pendiente'
}

function formatEstado(value) {
  if (!value) return 'Pendiente'
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-GT', { dateStyle: 'medium' }).format(date)
}

export default function AdminReservations(){
  const [reservas, setReservas] = useState([])
  const [form, setForm] = useState(defaultForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState({ type: '', message: '' })

  const fetchData = async () => {
    setLoading(true)
    setFeedback({ type: '', message: '' })

    const { data, error } = await supabase
      .from('actividad')
      .select(`
        id,
        comentarios,
        estado,
        fechareserva,
        cliente:cliente ( id, nombrecompleto, telefono ),
        pago:pagoactividad ( id )
      `)
      .order('fechareserva', { ascending: false })

    if (error) {
      console.error('No se pudieron cargar las reservas', error)
      setReservas([])
      setFeedback({ type: 'error', message: 'No pudimos obtener las reservas. Revisa tu configuración de Supabase.' })
    } else {
      const formatted = (data ?? []).map(item => ({
        id: item.id,
        nombre: item.cliente?.nombrecompleto || 'Cliente sin nombre',
        telefono: item.cliente?.telefono || '—',
        comentarios: item.comentarios || '',
        fecha: item.fechareserva,
        estado: (item.estado || 'pendiente').toLowerCase(),
        pago: Array.isArray(item.pago) ? item.pago[0] : item.pago
      }))

      setReservas(formatted)
    }

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

    if (!form.nombre || !form.fecha) {
      setFeedback({ type: 'error', message: 'El nombre del cliente y la fecha son obligatorios.' })
      return
    }

    setSaving(true)

    const { data: cliente, error: clienteError } = await supabase
      .from('cliente')
      .insert([
        {
          nombrecompleto: form.nombre,
          telefono: form.telefono || null
        }
      ])
      .select('id')
      .single()

    if (clienteError || !cliente) {
      console.error('No se pudo registrar el cliente', clienteError)
      setFeedback({ type: 'error', message: 'Ocurrió un error al registrar el cliente para la reserva.' })
      setSaving(false)
      return
    }

    const fechaReserva = form.fecha ? new Date(`${form.fecha}T00:00:00`).toISOString() : null

    const { error: actividadError } = await supabase
      .from('actividad')
      .insert([
        {
          idcliente: cliente.id,
          comentarios: form.comentarios || null,
          estado: form.estado || 'pendiente',
          fechareserva: fechaReserva
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
      .update({ estado: nuevoEstado })
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
                <span className={`text-sm ${feedback.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
                  {feedback.message}
                </span>
              )}
            </div>
          </form>
        </div>

        <div className="lg:w-[320px]">
          <AdminHelpCard title="Consejos para reservas">
            <p>Confirma los datos del cliente antes de crear una reserva para mantener registros limpios.</p>
            <p>Utiliza los estados para saber qué solicitudes requieren seguimiento inmediato.</p>
            <p>Registra un pago desde la sección de pagos cuando una reserva haya sido completada.</p>
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
                  <th className="p-2">Comentarios</th>
                  <th className="p-2">Fecha</th>
                  <th className="p-2">Estado</th>
                  <th className="p-2">Pago</th>
                </tr>
              </thead>
              <tbody>
                {reservas.map(reserva => (
                  <tr key={reserva.id} className="border-b last:border-0">
                    <td className="p-2 font-medium">{reserva.nombre}</td>
                    <td className="p-2">{reserva.telefono}</td>
                    <td className="p-2">{reserva.comentarios || '—'}</td>
                    <td className="p-2">{formatDate(reserva.fecha)}</td>
                    <td className="p-2">
                      <select
                        value={reserva.estado || 'pendiente'}
                        onChange={e => onEstadoChange(reserva.id, e.target.value)}
                        className="border rounded-xl2 px-2 py-1"
                      >
                        {ESTADOS.map(estado => (
                          <option key={estado} value={estado}>{formatEstado(estado)}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2 text-xs text-slate-600">{reserva.pago ? 'Pagado' : 'Pendiente'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted text-sm">No hay reservas registradas.</p>
        )}
      </div>

      <div className="card p-5">
        <h2 className="text-lg font-semibold text-umber mb-3">Reservas pendientes</h2>
        {loading ? (
          <p className="muted text-sm">Cargando reservas…</p>
        ) : reservasPendientes.length ? (
          <ul className="space-y-2 text-sm">
            {reservasPendientes.map(reserva => (
              <li key={reserva.id} className="flex items-center justify-between border-b last:border-0 pb-2">
                <div>
                  <p className="font-medium text-slate-700">{reserva.nombre}</p>
                  <p className="text-xs text-slate-500">{formatDate(reserva.fecha)}</p>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => onEstadoChange(reserva.id, 'confirmada')}
                >
                  Marcar confirmada
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted text-sm">No hay reservas pendientes por confirmar.</p>
        )}
      </div>
    </div>
  )
}
