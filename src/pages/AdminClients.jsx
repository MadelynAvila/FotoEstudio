import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import DEFAULT_PAYMENT_STATES, { getPaymentStateClasses } from '../lib/paymentStates'
import AdminHelpCard from '../components/AdminHelpCard'
import AdminDataTable from '../components/AdminDataTable'

const defaultForm = { id: null, nombrecompleto: '', telefono: '', correo: '' }

export default function AdminClients(){
  const [clientes, setClientes] = useState([])
  const [form, setForm] = useState(defaultForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState({ type: '', message: '' })
  const [rolClienteId, setRolClienteId] = useState(null)
  const [estadoOptions, setEstadoOptions] = useState([])
  const [updatingStatusId, setUpdatingStatusId] = useState(null)
  const [historyPanel, setHistoryPanel] = useState({ visible: false, loading: false, reservas: [], cliente: null, message: '' })

  const fetchClientes = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('cliente')
      .select('idcliente, Descuento, usuario:usuario ( id, username, telefono, correo, fecha_registro, idestado, estado:estado_usuario ( id, nombre_estado ) )')
      .order('idcliente', { ascending: false })

    if (error) {
      console.error('No se pudieron cargar los clientes', error)
      setClientes([])
      setFeedback({ type: 'error', message: 'No pudimos cargar los clientes. Revisa Supabase.' })
    } else {
      const formatted = (data ?? []).map(item => ({
        id: item.idcliente,
        usuarioId: item.usuario?.id,
        nombrecompleto: item.usuario?.username || 'Cliente sin nombre',
        telefono: item.usuario?.telefono || '',
        correo: item.usuario?.correo || '',
        fecharegistro: item.usuario?.fecha_registro,
        descuento: item.Descuento ?? 0,
        estadoId: item.usuario?.idestado || null,
        estadoNombre: item.usuario?.estado?.nombre_estado || 'Sin estado'
      }))
      setClientes(formatted)
      setFeedback({ type: '', message: '' })
    }
    setLoading(false)
  }

  const fetchRolCliente = async () => {
    const { data, error } = await supabase.from('rol').select('id, nombre')
    if (error) {
      console.error('No se pudo obtener el rol de cliente', error)
      return
    }
    const rol = data?.find(item => item.nombre?.toLowerCase() === 'cliente')
    if (rol) {
      setRolClienteId(rol.id)
    }
  }

  const fetchEstados = async () => {
    const { data, error } = await supabase.from('estado_usuario').select('id, nombre_estado').order('nombre_estado', { ascending: true })
    if (error) {
      console.error('No se pudieron cargar los estados de usuario', error)
      return
    }
    setEstadoOptions(data ?? [])
  }

  useEffect(() => {
    fetchRolCliente()
    fetchClientes()
    fetchEstados()
  }, [])

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const resetForm = () => {
    setForm(defaultForm)
  }

  const onChangeEstado = async (cliente, nuevoEstadoId) => {
    if (!cliente?.usuarioId) {
      setFeedback({ type: 'error', message: 'No se pudo identificar el usuario para actualizar el estado.' })
      return
    }

    setFeedback({ type: '', message: '' })
    setUpdatingStatusId(cliente.id)

    const { error } = await supabase
      .from('usuario')
      .update({ idestado: nuevoEstadoId || null })
      .eq('id', cliente.usuarioId)

    if (error) {
      console.error('No se pudo actualizar el estado del cliente', error)
      setFeedback({ type: 'error', message: 'No se pudo actualizar el estado del cliente.' })
    } else {
      setClientes(prev => prev.map(item => item.id === cliente.id ? { ...item, estadoId: nuevoEstadoId || null, estadoNombre: estadoOptions.find(estado => estado.id === nuevoEstadoId)?.nombre_estado || 'Sin estado' } : item))
      setFeedback({ type: 'success', message: 'Estado del cliente actualizado correctamente.' })
    }

    setUpdatingStatusId(null)
  }

  const openHistory = async (cliente) => {
    setHistoryPanel({ visible: true, loading: true, reservas: [], cliente, message: '' })

    if (!cliente?.usuarioId) {
      setHistoryPanel(prev => ({
        ...prev,
        loading: false,
        message: 'No encontramos un usuario asociado a este cliente. Verifica la información antes de consultar nuevamente.'
      }))
      return
    }

    const { data, error } = await supabase
      .from('actividad')
      .select('id, idestado_pago, estado_pago:estado_pago ( id, nombre_estado ), nombre_actividad, ubicacion, agenda:agenda ( fecha, horainicio, horafin ), paquete:paquete ( nombre_paquete )')
      .eq('idusuario', cliente.usuarioId)
      .order('id', { ascending: false })

    if (error) {
      console.error('No se pudo cargar el historial del cliente', error)
      setHistoryPanel(prev => ({ ...prev, loading: false, message: 'No se pudo cargar el historial de reservas.' }))
      return
    }

    const reservas = (data ?? []).map(item => {
      const estadoPagoInfo = getPaymentStateClasses(
        item.estado_pago?.nombre_estado || item.estado_pago || item.idestado_pago,
        DEFAULT_PAYMENT_STATES
      )
      return {
        id: item.id,
        estadoPago: estadoPagoInfo.label,
        nombreActividad: item.nombre_actividad,
        ubicacion: item.ubicacion,
        fecha: item.agenda?.fecha,
        horaInicio: item.agenda?.horainicio,
        horaFin: item.agenda?.horafin,
        paquete: item.paquete?.nombre_paquete
      }
    })

    setHistoryPanel(prev => ({ ...prev, loading: false, reservas }))
  }

  const closeHistory = () => {
    setHistoryPanel({ visible: false, loading: false, reservas: [], cliente: null, message: '' })
  }

  const onSubmit = async (event) => {
    event.preventDefault()
    setFeedback({ type: '', message: '' })

    if (!form.nombrecompleto) {
      setFeedback({ type: 'error', message: 'El nombre completo es obligatorio.' })
      return
    }

    setSaving(true)

    if (form.id) {
      const clienteActual = clientes.find(cliente => cliente.id === form.id)
      if (!clienteActual?.usuarioId) {
        setFeedback({ type: 'error', message: 'No se pudo identificar el usuario asociado.' })
        setSaving(false)
        return
      }

      const { error } = await supabase
        .from('usuario')
        .update({
          username: form.nombrecompleto,
          telefono: form.telefono || null,
          correo: form.correo || null
        })
        .eq('id', clienteActual.usuarioId)

      if (error) {
        console.error('No se pudo actualizar el cliente', error)
        setFeedback({ type: 'error', message: 'No se pudo actualizar al cliente.' })
      } else {
        setFeedback({ type: 'success', message: 'Cliente actualizado correctamente.' })
        resetForm()
        fetchClientes()
      }
    } else {
      if (!rolClienteId) {
        setFeedback({ type: 'error', message: 'No se pudo determinar el rol de cliente. Revisa la configuración de roles.' })
        setSaving(false)
        return
      }

      const { data: usuarioData, error: usuarioError } = await supabase
        .from('usuario')
        .insert([
          {
            username: form.nombrecompleto,
            telefono: form.telefono || null,
            correo: form.correo || null,
            idrol: rolClienteId
          }
        ])
        .select('id')
        .single()

      if (usuarioError || !usuarioData) {
        console.error('No se pudo crear el usuario del cliente', usuarioError)
        setFeedback({ type: 'error', message: 'No se pudo crear el cliente.' })
        setSaving(false)
        return
      }

      const { error: clienteError } = await supabase
        .from('cliente')
        .insert([{ idusuario: usuarioData.id, Descuento: 0 }])

      if (clienteError) {
        console.error('No se pudo crear el registro de cliente', clienteError)
        setFeedback({ type: 'error', message: 'No se pudo crear el cliente.' })
        setSaving(false)
        return
      }

      setFeedback({ type: 'success', message: 'Cliente creado correctamente.' })
      resetForm()
      fetchClientes()
    }

    setSaving(false)
  }

  const onEdit = (cliente) => {
    setForm({
      id: cliente.id,
      nombrecompleto: cliente.nombrecompleto || '',
      telefono: cliente.telefono || '',
      correo: cliente.correo || ''
    })
  }

  const onDelete = async (id) => {
    if (!window.confirm('¿Eliminar este cliente?')) return

    const clienteActual = clientes.find(cliente => cliente.id === id)
    if (!clienteActual) return

    const { error: clienteError } = await supabase.from('cliente').delete().eq('idcliente', id)
    if (clienteError) {
      console.error('No se pudo eliminar el cliente', clienteError)
      setFeedback({ type: 'error', message: 'No se pudo eliminar el cliente seleccionado.' })
      return
    }

    if (clienteActual.usuarioId) {
      await supabase.from('usuario').delete().eq('id', clienteActual.usuarioId)
    }

    setClientes(prev => prev.filter(cliente => cliente.id !== id))
    if (form.id === id) resetForm()
  }

  const clientColumns = useMemo(
    () => [
      {
        id: 'cliente',
        label: 'Cliente',
        render: (cliente) => (
          <div className="space-y-1">
            <p className="text-sm font-semibold text-umber">{cliente.nombrecompleto}</p>
            <p className="text-xs text-slate-500">{cliente.correo || 'Sin correo registrado'}</p>
            <p className="text-xs text-slate-500">{cliente.telefono || 'Sin teléfono registrado'}</p>
          </div>
        )
      },
      {
        id: 'estado',
        label: 'Estado',
        render: (cliente) => (
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
            <span className="inline-flex w-fit items-center rounded-full bg-[#f3e6d6] px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-[#5b4636]">
              {cliente.estadoNombre || 'Sin estado'}
            </span>
            <select
              className="rounded-2xl border border-[color:var(--border)] bg-white px-3 py-2 text-sm shadow-sm"
              value={cliente.estadoId || ''}
              onChange={event => onChangeEstado(cliente, event.target.value ? Number(event.target.value) : null)}
              disabled={updatingStatusId === cliente.id}
            >
              <option value="">Sin estado</option>
              {estadoOptions.map(estado => (
                <option key={estado.id} value={estado.id}>{estado.nombre_estado}</option>
              ))}
            </select>
          </div>
        )
      },
      {
        id: 'registro',
        label: 'Registro',
        hideOnMobile: true,
        render: (cliente) => (
          <span className="text-sm text-slate-600">
            {cliente.fecharegistro ? new Date(cliente.fecharegistro).toLocaleDateString('es-GT') : '—'}
          </span>
        )
      },
      {
        id: 'acciones',
        label: 'Acciones',
        align: 'right',
        render: (cliente) => (
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:justify-end">
            <button type="button" className="btn btn-ghost" onClick={() => openHistory(cliente)}>Historial</button>
            <button type="button" className="btn btn-ghost" onClick={() => onEdit(cliente)}>Editar</button>
            <button type="button" className="btn btn-ghost" onClick={() => onDelete(cliente.id)}>Eliminar</button>
          </div>
        )
      }
    ],
    [estadoOptions, onChangeEstado, openHistory, onEdit, onDelete, updatingStatusId]
  )

  const totalClientes = useMemo(() => clientes.length, [clientes])
  const clientesConTelefono = useMemo(() => clientes.filter(cliente => cliente.telefono).length, [clientes])
  const clientesConCorreo = useMemo(() => clientes.filter(cliente => cliente.correo).length, [clientes])
  const clientesSinEstado = useMemo(() => clientes.filter(cliente => !cliente.estadoId).length, [clientes])

  return (
    <div className="admin-page">
      <div className="admin-columns xl:grid-cols-4">
        <div className="card p-4 bg-gradient-to-br from-amber-50 to-white border border-amber-100">
          <p className="text-xs uppercase tracking-wide text-amber-600">Clientes totales</p>
          <p className="mt-2 text-3xl font-semibold text-umber">{totalClientes}</p>
          <p className="mt-1 text-xs text-slate-500">Registro actualizado automáticamente</p>
        </div>
        <div className="card p-4 border border-slate-200">
          <p className="text-xs uppercase tracking-wide text-slate-600">Con teléfono</p>
          <p className="mt-2 text-2xl font-semibold text-slate-800">{clientesConTelefono}</p>
          <p className="mt-1 text-xs text-slate-500">Contactos directos listos para confirmar sesiones</p>
        </div>
        <div className="card p-4 border border-slate-200">
          <p className="text-xs uppercase tracking-wide text-slate-600">Con correo</p>
          <p className="mt-2 text-2xl font-semibold text-slate-800">{clientesConCorreo}</p>
          <p className="mt-1 text-xs text-slate-500">Ideales para envíos de recordatorios y facturas</p>
        </div>
        <div className="card p-4 border border-slate-200">
          <p className="text-xs uppercase tracking-wide text-slate-600">Sin estado asignado</p>
          <p className="mt-2 text-2xl font-semibold text-slate-800">{clientesSinEstado}</p>
          <p className="mt-1 text-xs text-slate-500">Actualiza su estatus para ordenar tu cartera</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        <div className="admin-section flex-1 space-y-4">
          <header className="admin-header">
            <div>
              <h1 className="text-xl font-semibold text-umber">Gestión de clientes</h1>
              <p className="muted text-sm">Registra y administra la base de clientes que reservan sesiones.</p>
            </div>
            <button type="button" onClick={resetForm} className="btn btn-ghost">Limpiar formulario</button>
          </header>

          <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Nombre completo *</span>
              <input
                value={form.nombrecompleto}
                onChange={e => updateField('nombrecompleto', e.target.value)}
                className="border rounded-xl2 px-3 py-2"
                placeholder="Ej. María López"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Teléfono</span>
              <input
                value={form.telefono}
                onChange={e => updateField('telefono', e.target.value)}
                className="border rounded-xl2 px-3 py-2"
                placeholder="Ej. 5555-5555"
              />
            </label>
            <label className="grid gap-1 text-sm md:col-span-2">
              <span className="font-medium text-slate-700">Correo electrónico</span>
              <input
                type="email"
                value={form.correo}
                onChange={e => updateField('correo', e.target.value)}
                className="border rounded-xl2 px-3 py-2"
                placeholder="cliente@correo.com"
              />
            </label>
            <div className="md:col-span-2">
              <button className="btn btn-primary" disabled={saving}>
                {saving ? 'Guardando…' : form.id ? 'Actualizar cliente' : 'Crear cliente'}
              </button>
            </div>
            {feedback.message && (
              <p className={`md:col-span-2 text-sm ${feedback.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
                {feedback.message}
              </p>
            )}
          </form>
        </div>
        <div className="lg:w-[320px]">
          <AdminHelpCard title="Consejos para clientes">
            <p>Utiliza esta sección para mantener actualizados los datos de contacto. Así podrás comunicarte fácilmente al confirmar una sesión.</p>
            <p>El correo electrónico es opcional, pero ayuda a enviar confirmaciones y facturas.</p>
            <p>Si eliminas a un cliente que tenga reservas activas, deberás actualizar esas reservas manualmente.</p>
          </AdminHelpCard>
        </div>
      </div>

      <div className="admin-section">
        <div className="admin-header">
          <h2 className="text-lg font-semibold text-umber">Clientes registrados</h2>
          <span className="text-xs uppercase tracking-[0.3em] text-slate-500">{clientes.length}</span>
        </div>
        {loading ? (
          <p className="muted text-sm">Cargando clientes…</p>
        ) : clientes.length ? (
          <AdminDataTable
            columns={clientColumns}
            rows={clientes}
            rowKey={cliente => cliente.id}
            caption={`Clientes registrados: ${clientes.length}`}
          />
        ) : (
          <p className="muted text-sm">No has registrado clientes todavía.</p>
        )}
      </div>

      {historyPanel.visible && (
        <div className="admin-section">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-lg font-semibold text-umber">Historial de reservas</h3>
              <p className="text-sm text-slate-500">{historyPanel.cliente?.nombrecompleto} • {historyPanel.cliente?.correo || historyPanel.cliente?.telefono || 'Sin contacto registrado'}</p>
            </div>
            <button type="button" className="btn btn-ghost" onClick={closeHistory}>Cerrar</button>
          </div>

          {historyPanel.loading ? (
            <p className="muted text-sm">Cargando reservas…</p>
          ) : historyPanel.message ? (
            <p className="text-sm text-red-600">{historyPanel.message}</p>
          ) : historyPanel.reservas.length ? (
            <ul className="space-y-3">
              {historyPanel.reservas.map(reserva => {
                const fecha = reserva.fecha ? new Date(reserva.fecha).toLocaleDateString('es-GT') : 'Fecha por confirmar'
                const horaInicio = reserva.horaInicio ? reserva.horaInicio.slice(0, 5) : '—'
                const horaFin = reserva.horaFin ? reserva.horaFin.slice(0, 5) : '—'
                return (
                  <li key={reserva.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-800">{reserva.nombreActividad || reserva.paquete || 'Reserva sin título'}</p>
                        <p className="text-xs uppercase tracking-wide text-amber-700">Estado de pago: {reserva.estadoPago}</p>
                      </div>
                      <span className="text-sm text-slate-500">#{reserva.id}</span>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
                      <p><span className="font-medium text-slate-700">Fecha:</span> {fecha}</p>
                      <p><span className="font-medium text-slate-700">Horario:</span> {horaInicio} - {horaFin}</p>
                      <p><span className="font-medium text-slate-700">Ubicación:</span> {reserva.ubicacion || 'Por definir'}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="muted text-sm">No registra reservas previas ni pendientes.</p>
          )}
        </div>
      )}
    </div>
  )
}
