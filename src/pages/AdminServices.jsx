import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import AdminHelpCard from '../components/AdminHelpCard'

const defaultForm = { id: null, nombre: '', descripcion: '', precio: '' }

export default function AdminServices(){
  const [servicios, setServicios] = useState([])
  const [form, setForm] = useState(defaultForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState({ type: '', message: '' })

  const fetchServicios = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('servicio')
      .select('id, nombre, descripcion, precio')
      .order('nombre', { ascending: true })

    if (error) {
      console.error('No se pudieron cargar los servicios', error)
      setServicios([])
      setFeedback({ type: 'error', message: 'No pudimos cargar los servicios.' })
    } else {
      setServicios(data ?? [])
      setFeedback({ type: '', message: '' })
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchServicios()
  }, [])

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const resetForm = () => setForm(defaultForm)

  const onSubmit = async (event) => {
    event.preventDefault()
    setFeedback({ type: '', message: '' })

    if (!form.nombre || !form.precio) {
      setFeedback({ type: 'error', message: 'Completa el nombre y el precio del servicio.' })
      return
    }

    const precio = Number(form.precio)
    if (Number.isNaN(precio)) {
      setFeedback({ type: 'error', message: 'El precio debe ser un número válido.' })
      return
    }

    setSaving(true)
    const payload = {
      nombre: form.nombre,
      descripcion: form.descripcion || null,
      precio: precio
    }

    if (form.id) {
      const { error } = await supabase.from('servicio').update(payload).eq('id', form.id)
      if (error) {
        console.error('No se pudo actualizar el servicio', error)
        setFeedback({ type: 'error', message: 'No se pudo actualizar el servicio.' })
      } else {
        setFeedback({ type: 'success', message: 'Servicio actualizado correctamente.' })
        resetForm()
        fetchServicios()
      }
    } else {
      const { error } = await supabase.from('servicio').insert([payload])
      if (error) {
        console.error('No se pudo crear el servicio', error)
        setFeedback({ type: 'error', message: 'No se pudo crear el servicio.' })
      } else {
        setFeedback({ type: 'success', message: 'Servicio registrado correctamente.' })
        resetForm()
        fetchServicios()
      }
    }

    setSaving(false)
  }

  const onEdit = (servicio) => {
    setForm({
      id: servicio.id,
      nombre: servicio.nombre || '',
      descripcion: servicio.descripcion || '',
      precio: servicio.precio ? String(servicio.precio) : ''
    })
  }

  const onDelete = async (id) => {
    if (!window.confirm('¿Eliminar este servicio? Ten en cuenta que podría estar asociado a paquetes.')) return
    const { error } = await supabase.from('servicio').delete().eq('id', id)
    if (error) {
      console.error('No se pudo eliminar el servicio', error)
      setFeedback({ type: 'error', message: 'No se pudo eliminar el servicio seleccionado.' })
    } else {
      setServicios(prev => prev.filter(item => item.id !== id))
      if (form.id === id) resetForm()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        <div className="card flex-1 p-5 space-y-4">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-umber">Servicios profesionales</h1>
              <p className="muted text-sm">Define las sesiones y productos que ofreces antes de armar paquetes.</p>
            </div>
            <button type="button" onClick={resetForm} className="btn btn-ghost">Nuevo servicio</button>
          </header>

          <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Nombre *</span>
              <input
                value={form.nombre}
                onChange={e => updateField('nombre', e.target.value)}
                className="border rounded-xl2 px-3 py-2"
                placeholder="Ej. Sesión de boda"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Precio *</span>
              <input
                value={form.precio}
                onChange={e => updateField('precio', e.target.value)}
                className="border rounded-xl2 px-3 py-2"
                placeholder="Ej. 1200"
              />
            </label>
            <label className="grid gap-1 text-sm md:col-span-2">
              <span className="font-medium text-slate-700">Descripción</span>
              <textarea
                value={form.descripcion}
                onChange={e => updateField('descripcion', e.target.value)}
                className="border rounded-xl2 px-3 py-2 min-h-[120px]"
                placeholder="Incluye duración, locaciones o entregables."
              />
            </label>
            <div className="md:col-span-2">
              <button className="btn btn-primary" disabled={saving}>
                {saving ? 'Guardando…' : form.id ? 'Actualizar servicio' : 'Crear servicio'}
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
          <AdminHelpCard title="Tips sobre servicios">
            <p>Los servicios son la base de tus paquetes. Define precios individuales para calcular el total estimado automáticamente.</p>
            <p>Puedes duplicar un servicio existente haciendo clic en editar, cambiando el nombre y guardando como nuevo.</p>
            <p>Si necesitas pausar temporalmente un servicio, elimínalo aquí y quítalo de los paquetes relacionados.</p>
          </AdminHelpCard>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="text-lg font-semibold text-umber mb-3">Servicios disponibles</h2>
        {loading ? (
          <p className="muted text-sm">Cargando servicios…</p>
        ) : servicios.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {servicios.map(servicio => (
              <article key={servicio.id} className="card border border-[var(--border)] p-4 space-y-3">
                <header>
                  <h3 className="font-semibold text-lg text-slate-800">{servicio.nombre}</h3>
                  <p className="text-sm text-umber font-semibold">
                    Q{Number(servicio.precio ?? 0).toLocaleString('es-GT')}
                  </p>
                </header>
                <p className="text-sm text-slate-600 whitespace-pre-line">
                  {servicio.descripcion || 'Sin descripción detallada.'}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn btn-ghost" onClick={() => onEdit(servicio)}>Editar</button>
                  <button type="button" className="btn btn-ghost" onClick={() => onDelete(servicio.id)}>Eliminar</button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted text-sm">No has creado servicios todavía.</p>
        )}
      </div>
    </div>
  )
}
