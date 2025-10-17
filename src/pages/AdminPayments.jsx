import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import AdminHelpCard from '../components/AdminHelpCard'

const defaultForm = { idactividad: '', monto: '', metodo: 'Transferencia' }

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-GT', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export default function AdminPayments(){
  const [actividades, setActividades] = useState([])
  const [form, setForm] = useState(defaultForm)
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState({ type: '', message: '' })

  const fetchActividades = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('actividad')
      .select(`
        id,
        estado_pago,
        nombre_actividad,
        agenda:agenda ( fecha, horainicio ),
        cliente:usuario!actividad_idcliente_fkey ( id, username, telefono ),
        paquete:paquete ( id, nombre_paquete, precio ),
        pago:pago ( id, monto, metodo_pago, fecha_pago )
      `)
      .order('id', { ascending: false })

    if (error) {
      console.error('No se pudieron cargar los pagos', error)
      setActividades([])
      setFeedback({ type: 'error', message: 'No pudimos cargar la información de pagos.' })
    } else {
      setActividades(data ?? [])
      setFeedback({ type: '', message: '' })
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchActividades()
  }, [])

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const actividadesSinPago = useMemo(() => {
    return actividades.filter(actividad => {
      const pago = Array.isArray(actividad.pago) ? actividad.pago[0] : actividad.pago
      return !pago
    })
  }, [actividades])

  const onSubmit = async (event) => {
    event.preventDefault()
    setFeedback({ type: '', message: '' })

    if (!form.idactividad || !form.monto) {
      setFeedback({ type: 'error', message: 'Selecciona una reserva y especifica el monto cobrado.' })
      return
    }

    const monto = Number(form.monto)
    if (Number.isNaN(monto)) {
      setFeedback({ type: 'error', message: 'El monto debe ser un número válido.' })
      return
    }

    setSaving(true)
    const payload = {
      idactividad: Number(form.idactividad),
      metodo_pago: form.metodo || 'Transferencia',
      monto,
      detalle_pago: null
    }
    const { data, error } = await supabase
      .from('pago')
      .insert([payload])
      .select('id, idactividad, monto, metodo_pago, fecha_pago')
      .single()

    if (error || !data) {
      console.error('No se pudo registrar el pago', error)
      setFeedback({ type: 'error', message: 'No se pudo registrar el pago.' })
      setSaving(false)
      return
    }

    await supabase.from('actividad').update({ estado_pago: 'Pagado' }).eq('id', payload.idactividad)

    const actividadAsociada = actividades.find(item => Number(item.id) === Number(payload.idactividad))
    const pago = data

    setSelectedInvoice({
      actividad: actividadAsociada,
      pago
    })

    setFeedback({ type: 'success', message: 'Pago registrado correctamente. Se actualizó el estado a pagado.' })
    setForm(defaultForm)
    fetchActividades()
    setSaving(false)
  }

  const onVerFactura = (actividad) => {
    const pago = Array.isArray(actividad.pago) ? actividad.pago[0] : actividad.pago
    if (!pago) return
    setSelectedInvoice({ actividad, pago })
  }

  const onImprimir = () => {
    window.print()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        <div className="card flex-1 p-5 space-y-4">
          <header>
            <h1 className="text-xl font-semibold text-umber">Control de pagos</h1>
            <p className="muted text-sm">Registra pagos realizados y genera facturas imprimibles.</p>
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
                {actividadesSinPago.map(actividad => {
                  const cliente = actividad.cliente?.username || 'Cliente sin nombre'
                  const fecha = actividad.agenda?.fecha ? new Date(actividad.agenda.fecha).toLocaleDateString('es-GT') : 'Sin fecha'
                  const paquete = actividad.paquete?.nombre_paquete || 'Paquete'
                  return (
                    <option key={actividad.id} value={actividad.id}>
                      #{actividad.id} — {cliente} ({paquete}, {fecha})
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
                <option value="Transferencia">Transferencia</option>
                <option value="Efectivo">Efectivo</option>
                <option value="Tarjeta">Tarjeta</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Monto cobrado (Q)</span>
              <input
                value={form.monto}
                onChange={event => updateField('monto', event.target.value)}
                className="border rounded-xl2 px-3 py-2"
                placeholder="Ej. 1800"
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

      <div className="card p-5">
        <h2 className="text-lg font-semibold text-umber mb-3">Historial de pagos</h2>
        {loading ? (
          <p className="muted text-sm">Cargando historial…</p>
        ) : actividades.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-sand text-left uppercase text-xs tracking-wide text-slate-600">
                <tr>
                  <th className="p-2">Reserva</th>
                  <th className="p-2">Cliente</th>
                  <th className="p-2">Estado</th>
                  <th className="p-2">Pago</th>
                  <th className="p-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {actividades.map(actividad => {
                  const pago = Array.isArray(actividad.pago) ? actividad.pago[0] : actividad.pago
                  return (
                    <tr key={actividad.id} className="border-b last:border-0">
                      <td className="p-2">
                        <div className="font-medium text-slate-700">Reserva #{actividad.id}</div>
                        <div className="text-xs text-slate-500">{actividad.agenda?.fecha ? new Date(actividad.agenda.fecha).toLocaleDateString('es-GT') : 'Sin fecha'}</div>
                      </td>
                      <td className="p-2">
                        <div className="font-medium text-slate-700">{actividad.cliente?.username || 'Cliente sin nombre'}</div>
                        <div className="text-xs text-slate-500">{actividad.paquete?.nombre_paquete || 'Paquete sin definir'}</div>
                      </td>
                      <td className="p-2">
                        <span className="inline-flex items-center rounded-full bg-sand px-2 py-1 text-xs font-semibold uppercase tracking-wide">
                          {(actividad.estado_pago || 'Pendiente')}
                        </span>
                      </td>
                      <td className="p-2">
                        {pago ? (
                          <div>
                            <div className="font-medium text-slate-700">Q{Number(pago.monto ?? 0).toLocaleString('es-GT')}</div>
                            <div className="text-xs text-slate-500">{pago.metodo_pago || 'Método no especificado'}</div>
                          </div>
                        ) : (
                          <span className="muted text-xs">Sin pago registrado</span>
                        )}
                      </td>
                      <td className="p-2 text-right">
                        {pago ? (
                          <button type="button" className="btn btn-ghost" onClick={() => onVerFactura(actividad)}>
                            Ver factura
                          </button>
                        ) : (
                          <span className="muted text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted text-sm">Todavía no hay pagos registrados.</p>
        )}
      </div>

      {selectedInvoice && (
        <div className="card p-5 print:p-0">
          <header className="flex flex-wrap justify-between gap-3 mb-4 print:hidden">
            <h2 className="text-lg font-semibold text-umber">Factura del pago</h2>
            <div className="flex gap-2">
              <button className="btn btn-ghost" onClick={() => setSelectedInvoice(null)}>Cerrar</button>
              <button className="btn btn-primary" onClick={onImprimir}>Imprimir</button>
            </div>
          </header>
          <div className="grid gap-2 text-sm">
            <div><strong>Reserva:</strong> #{selectedInvoice.actividad?.id}</div>
            <div><strong>Cliente:</strong> {selectedInvoice.actividad?.cliente?.username || 'Cliente sin nombre'}</div>
            <div><strong>Paquete:</strong> {selectedInvoice.actividad?.paquete?.nombre_paquete || 'Paquete sin definir'}</div>
            <div><strong>Monto:</strong> Q{Number(selectedInvoice.pago?.monto ?? 0).toLocaleString('es-GT')}</div>
            <div><strong>Método:</strong> {selectedInvoice.pago?.metodo_pago}</div>
            <div><strong>Fecha de pago:</strong> {formatDate(selectedInvoice.pago?.fecha_pago)}</div>
          </div>
        </div>
      )}
    </div>
  )
}
