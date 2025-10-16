import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import AdminHelpCard from '../components/AdminHelpCard'

const defaultForm = { id: null, nombrecompleto: '', telefono: '', correo: '' }

export default function AdminClients(){
  const [clientes, setClientes] = useState([])
  const [form, setForm] = useState(defaultForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState({ type: '', message: '' })

  const fetchClientes = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('cliente')
      .select('id, nombrecompleto, telefono, correo, fecharegistro')
      .order('fecharegistro', { ascending: false })

    if (error) {
      console.error('No se pudieron cargar los clientes', error)
      setClientes([])
      setFeedback({ type: 'error', message: 'No pudimos cargar los clientes. Revisa Supabase.' })
    } else {
      setClientes(data ?? [])
      setFeedback({ type: '', message: '' })
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchClientes()
  }, [])

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const resetForm = () => {
    setForm(defaultForm)
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
      const { error } = await supabase
        .from('cliente')
        .update({
          nombrecompleto: form.nombrecompleto,
          telefono: form.telefono || null,
          correo: form.correo || null
        })
        .eq('id', form.id)
      if (error) {
        console.error('No se pudo actualizar el cliente', error)
        setFeedback({ type: 'error', message: 'No se pudo actualizar al cliente.' })
      } else {
        setFeedback({ type: 'success', message: 'Cliente actualizado correctamente.' })
        resetForm()
        fetchClientes()
      }
    } else {
      const { error } = await supabase
        .from('cliente')
        .insert([{
          nombrecompleto: form.nombrecompleto,
          telefono: form.telefono || null,
          correo: form.correo || null
        }])
      if (error) {
        console.error('No se pudo crear el cliente', error)
        setFeedback({ type: 'error', message: 'No se pudo crear el cliente.' })
      } else {
        setFeedback({ type: 'success', message: 'Cliente creado correctamente.' })
        resetForm()
        fetchClientes()
      }
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
    const { error } = await supabase.from('cliente').delete().eq('id', id)
    if (error) {
      console.error('No se pudo eliminar el cliente', error)
      setFeedback({ type: 'error', message: 'No se pudo eliminar el cliente seleccionado.' })
    } else {
      setClientes(prev => prev.filter(cliente => cliente.id !== id))
      if (form.id === id) resetForm()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        <div className="card flex-1 p-5 space-y-4">
          <header className="flex flex-wrap items-center justify-between gap-3">
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
            <p>Utiliza esta sección para mantener actualizados los datos de contacto. Así podrás comunicarse fácilmente al confirmar una sesión.</p>
            <p>El correo electrónico es opcional, pero ayuda a enviar confirmaciones y facturas.</p>
            <p>Si eliminas a un cliente que tenga reservas activas, deberás actualizar esas reservas manualmente.</p>
          </AdminHelpCard>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="text-lg font-semibold text-umber mb-3">Clientes registrados</h2>
        {loading ? (
          <p className="muted text-sm">Cargando clientes…</p>
        ) : clientes.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-sand text-left uppercase text-xs tracking-wide text-slate-600">
                <tr>
                  <th className="p-2">Nombre</th>
                  <th className="p-2">Teléfono</th>
                  <th className="p-2">Correo</th>
                  <th className="p-2">Registro</th>
                  <th className="p-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {clientes.map(cliente => (
                  <tr key={cliente.id} className="border-b last:border-0">
                    <td className="p-2 font-medium text-slate-700">{cliente.nombrecompleto}</td>
                    <td className="p-2">{cliente.telefono || '—'}</td>
                    <td className="p-2">{cliente.correo || '—'}</td>
                    <td className="p-2">{cliente.fecharegistro ? new Date(cliente.fecharegistro).toLocaleDateString('es-GT') : '—'}</td>
                    <td className="p-2">
                      <div className="flex justify-end gap-2">
                        <button type="button" className="btn btn-ghost" onClick={() => onEdit(cliente)}>Editar</button>
                        <button type="button" className="btn btn-ghost" onClick={() => onDelete(cliente.id)}>Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted text-sm">No hay clientes registrados todavía.</p>
        )}
      </div>
    </div>
  )
}
