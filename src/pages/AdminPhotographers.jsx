import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import AdminHelpCard from '../components/AdminHelpCard'

const ESTADOS = ['activo', 'inactivo']
const defaultForm = { id: null, nombrecompleto: '', telefono: '', correo: '', especialidad: '', estado: 'activo' }

export default function AdminPhotographers(){
  const [fotografos, setFotografos] = useState([])
  const [form, setForm] = useState(defaultForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState({ type: '', message: '' })

  const fetchFotografos = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('fotografo')
      .select('id, nombrecompleto, telefono, correo, especialidad, estado')
      .order('nombrecompleto', { ascending: true })

    if (error) {
      console.error('No se pudieron cargar los fotógrafos', error)
      setFotografos([])
      setFeedback({ type: 'error', message: 'No pudimos cargar los fotógrafos.' })
    } else {
      setFotografos(data ?? [])
      setFeedback({ type: '', message: '' })
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchFotografos()
  }, [])

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const resetForm = () => setForm(defaultForm)

  const onSubmit = async (event) => {
    event.preventDefault()
    setFeedback({ type: '', message: '' })

    if (!form.nombrecompleto) {
      setFeedback({ type: 'error', message: 'El nombre completo es obligatorio.' })
      return
    }

    setSaving(true)
    const payload = {
      nombrecompleto: form.nombrecompleto,
      telefono: form.telefono || null,
      correo: form.correo || null,
      especialidad: form.especialidad || null,
      estado: form.estado || 'activo'
    }

    if (form.id) {
      const { error } = await supabase.from('fotografo').update(payload).eq('id', form.id)
      if (error) {
        console.error('No se pudo actualizar el fotógrafo', error)
        setFeedback({ type: 'error', message: 'No se pudo actualizar al fotógrafo.' })
      } else {
        setFeedback({ type: 'success', message: 'Fotógrafo actualizado correctamente.' })
        resetForm()
        fetchFotografos()
      }
    } else {
      const { error } = await supabase.from('fotografo').insert([payload])
      if (error) {
        console.error('No se pudo crear el fotógrafo', error)
        setFeedback({ type: 'error', message: 'No se pudo crear al fotógrafo.' })
      } else {
        setFeedback({ type: 'success', message: 'Fotógrafo registrado correctamente.' })
        resetForm()
        fetchFotografos()
      }
    }

    setSaving(false)
  }

  const onEdit = (fotografo) => {
    setForm({
      id: fotografo.id,
      nombrecompleto: fotografo.nombrecompleto || '',
      telefono: fotografo.telefono || '',
      correo: fotografo.correo || '',
      especialidad: fotografo.especialidad || '',
      estado: fotografo.estado || 'activo'
    })
  }

  const onDelete = async (id) => {
    if (!window.confirm('¿Eliminar este fotógrafo?')) return
    const { error } = await supabase.from('fotografo').delete().eq('id', id)
    if (error) {
      console.error('No se pudo eliminar al fotógrafo', error)
      setFeedback({ type: 'error', message: 'No se pudo eliminar al fotógrafo seleccionado.' })
    } else {
      setFotografos(prev => prev.filter(item => item.id !== id))
      if (form.id === id) resetForm()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        <div className="card flex-1 p-5 space-y-4">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-umber">Equipo de fotógrafos</h1>
              <p className="muted text-sm">Controla la disponibilidad y especialidad de tu equipo.</p>
            </div>
            <button type="button" onClick={resetForm} className="btn btn-ghost">Registrar nuevo</button>
          </header>

          <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Nombre completo *</span>
              <input
                value={form.nombrecompleto}
                onChange={e => updateField('nombrecompleto', e.target.value)}
                className="border rounded-xl2 px-3 py-2"
                placeholder="Ej. Carlos Hernández"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Teléfono</span>
              <input
                value={form.telefono}
                onChange={e => updateField('telefono', e.target.value)}
                className="border rounded-xl2 px-3 py-2"
                placeholder="Ej. 4444-4444"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Correo</span>
              <input
                type="email"
                value={form.correo}
                onChange={e => updateField('correo', e.target.value)}
                className="border rounded-xl2 px-3 py-2"
                placeholder="fotografo@correo.com"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Especialidad</span>
              <input
                value={form.especialidad}
                onChange={e => updateField('especialidad', e.target.value)}
                className="border rounded-xl2 px-3 py-2"
                placeholder="Bodas, retratos, producto…"
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
                  <option key={estado} value={estado}>{estado === 'activo' ? 'Activo' : 'Inactivo'}</option>
                ))}
              </select>
            </label>
            <div className="md:col-span-2">
              <button className="btn btn-primary" disabled={saving}>
                {saving ? 'Guardando…' : form.id ? 'Actualizar fotógrafo' : 'Crear fotógrafo'}
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
          <AdminHelpCard title="Cómo administrar el equipo">
            <p>Registra a cada fotógrafo con su especialidad para asignarlo a futuras reservas desde la sección de reservas.</p>
            <p>Marca el estado en <b>inactivo</b> cuando alguien no esté disponible temporalmente.</p>
            <p>Recuerda actualizar los datos de contacto cuando cambien para evitar fallos en la comunicación.</p>
          </AdminHelpCard>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="text-lg font-semibold text-umber mb-3">Fotógrafos registrados</h2>
        {loading ? (
          <p className="muted text-sm">Cargando fotógrafos…</p>
        ) : fotografos.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-sand text-left uppercase text-xs tracking-wide text-slate-600">
                <tr>
                  <th className="p-2">Nombre</th>
                  <th className="p-2">Especialidad</th>
                  <th className="p-2">Teléfono</th>
                  <th className="p-2">Correo</th>
                  <th className="p-2">Estado</th>
                  <th className="p-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {fotografos.map(fotografo => (
                  <tr key={fotografo.id} className="border-b last:border-0">
                    <td className="p-2 font-medium text-slate-700">{fotografo.nombrecompleto}</td>
                    <td className="p-2">{fotografo.especialidad || '—'}</td>
                    <td className="p-2">{fotografo.telefono || '—'}</td>
                    <td className="p-2">{fotografo.correo || '—'}</td>
                    <td className="p-2">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase ${fotografo.estado === 'activo' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {fotografo.estado === 'activo' ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="p-2">
                      <div className="flex justify-end gap-2">
                        <button type="button" className="btn btn-ghost" onClick={() => onEdit(fotografo)}>Editar</button>
                        <button type="button" className="btn btn-ghost" onClick={() => onDelete(fotografo.id)}>Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted text-sm">No tienes fotógrafos registrados todavía.</p>
        )}
      </div>
    </div>
  )
}
