import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import AdminHelpCard from '../components/AdminHelpCard'

const defaultForm = {
  id: null,
  nombre: '',
  descripcion: '',
  precio: '',
  tipoEventoId: '',
  incluye: ''
}

export default function AdminPackages(){
  const [paquetes, setPaquetes] = useState([])
  const [eventos, setEventos] = useState([])
  const [form, setForm] = useState(defaultForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState({ type: '', message: '' })

  const fetchData = async () => {
    setLoading(true)
    setFeedback({ type: '', message: '' })

    const [paquetesRes, eventosRes] = await Promise.all([
      supabase
        .from('paquete')
        .select(`
          id,
          nombre_paquete,
          descripcion,
          precio,
          incluye,
          id_tipo_evento,
          tipo_evento:tipo_evento ( id, nombre_evento )
        `)
        .order('id', { ascending: true }),
      supabase
        .from('tipo_evento')
        .select('id, nombre_evento, descripcion')
        .order('nombre_evento', { ascending: true })
    ])

    const errors = [paquetesRes.error, eventosRes.error].filter(Boolean)
    if (errors.length) {
      errors.forEach(err => console.error('No se pudieron cargar los paquetes', err))
      setFeedback({ type: 'error', message: 'No pudimos cargar los paquetes ni los tipos de evento disponibles.' })
      setPaquetes([])
      setEventos([])
      setLoading(false)
      return
    }

    setPaquetes(paquetesRes.data ?? [])
    setEventos(eventosRes.data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const resetForm = () => {
    setForm(defaultForm)
  }

  const eventoSeleccionado = useMemo(() => {
    return eventos.find(evento => String(evento.id) === String(form.tipoEventoId)) || null
  }, [eventos, form.tipoEventoId])

  const onSubmit = async (event) => {
    event.preventDefault()
    setFeedback({ type: '', message: '' })

    if (!form.nombre || !form.precio || !form.tipoEventoId) {
      setFeedback({ type: 'error', message: 'Completa el nombre, el precio y el tipo de evento del paquete.' })
      return
    }

    const precio = Number(form.precio)
    if (Number.isNaN(precio)) {
      setFeedback({ type: 'error', message: 'El precio debe ser un número válido.' })
      return
    }

    setSaving(true)

    const payload = {
      nombre_paquete: form.nombre,
      descripcion: form.descripcion || null,
      precio,
      incluye: form.incluye || null,
      id_tipo_evento: Number(form.tipoEventoId)
    }

    if (form.id) {
      const { error: updateError } = await supabase
        .from('paquete')
        .update(payload)
        .eq('id', form.id)

      if (updateError) {
        console.error('No se pudo actualizar el paquete', updateError)
        setFeedback({ type: 'error', message: 'No se pudo actualizar el paquete seleccionado.' })
        setSaving(false)
        return
      }

      setFeedback({ type: 'success', message: 'Paquete actualizado correctamente.' })
    } else {
      const { error: insertError } = await supabase
        .from('paquete')
        .insert([payload])

      if (insertError) {
        console.error('No se pudo crear el paquete', insertError)
        setFeedback({ type: 'error', message: 'No se pudo crear el paquete. Intenta nuevamente.' })
        setSaving(false)
        return
      }

      setFeedback({ type: 'success', message: 'Paquete creado correctamente.' })
    }

    setSaving(false)
    resetForm()
    fetchData()
  }

  const onEdit = (paquete) => {
    setForm({
      id: paquete.id,
      nombre: paquete.nombre_paquete || '',
      descripcion: paquete.descripcion || '',
      precio: paquete.precio ? String(paquete.precio) : '',
      tipoEventoId: paquete.id_tipo_evento ? String(paquete.id_tipo_evento) : '',
      incluye: paquete.incluye || ''
    })
  }

  const onDelete = async (id) => {
    if (!window.confirm('¿Eliminar este paquete?')) return

    const { error } = await supabase.from('paquete').delete().eq('id', id)

    if (error) {
      console.error('No se pudo eliminar el paquete', error)
      setFeedback({ type: 'error', message: 'No se pudo eliminar el paquete seleccionado.' })
    } else {
      setPaquetes(prev => prev.filter(paquete => paquete.id !== id))
      if (form.id === id) resetForm()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        <div className="card flex-1 p-5 space-y-4">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-umber">Gestión de paquetes</h1>
              <p className="muted text-sm">Combina servicios para ofrecer propuestas atractivas a tus clientes.</p>
            </div>
            <button type="button" className="btn btn-ghost" onClick={resetForm}>
              Limpiar formulario
            </button>
          </header>

          <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm md:col-span-2">
              <span className="font-medium text-slate-700">Nombre del paquete *</span>
              <input
                value={form.nombre}
                onChange={event => updateField('nombre', event.target.value)}
                className="border rounded-xl2 px-3 py-2"
                placeholder="Ej. Sesión familiar premium"
              />
            </label>
            <label className="grid gap-1 text-sm md:col-span-2">
              <span className="font-medium text-slate-700">Descripción</span>
              <textarea
                value={form.descripcion}
                onChange={event => updateField('descripcion', event.target.value)}
                className="border rounded-xl2 px-3 py-2 min-h-[100px]"
                placeholder="Detalles generales del paquete"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Precio (Q) *</span>
              <input
                value={form.precio}
                onChange={event => updateField('precio', event.target.value)}
                className="border rounded-xl2 px-3 py-2"
                placeholder="Ej. 1500"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Tipo de evento *</span>
              <select
                value={form.tipoEventoId}
                onChange={event => updateField('tipoEventoId', event.target.value)}
                className="border rounded-xl2 px-3 py-2"
              >
                <option value="">Selecciona un tipo de evento</option>
                {eventos.map(evento => (
                  <option key={evento.id} value={evento.id}>{evento.nombre_evento}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm md:col-span-2">
              <span className="font-medium text-slate-700">Incluye</span>
              <textarea
                value={form.incluye}
                onChange={event => updateField('incluye', event.target.value)}
                className="border rounded-xl2 px-3 py-2 min-h-[120px]"
                placeholder={eventoSeleccionado ? `Ej. Servicios para ${eventoSeleccionado.nombre_evento}` : 'Lista de entregables o beneficios'}
              />
            </label>
            <div className="md:col-span-2">
              <button className="btn btn-primary" disabled={saving}>
                {saving ? 'Guardando…' : form.id ? 'Actualizar paquete' : 'Crear paquete'}
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
          <AdminHelpCard title="Cómo crear paquetes competitivos">
            <p>Combina servicios populares y ofrece un precio atractivo para tus clientes.</p>
            <p>Utiliza el tipo de evento para agrupar paquetes relacionados.</p>
            <p>Actualiza o elimina paquetes antiguos para mantener tu catálogo vigente.</p>
          </AdminHelpCard>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="text-lg font-semibold text-umber mb-3">Paquetes disponibles</h2>
        {loading ? (
          <p className="muted text-sm">Cargando paquetes…</p>
        ) : paquetes.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {paquetes.map(paquete => {
              const incluyeItems = (paquete.incluye || '')
                .split('\n')
                .map(item => item.trim())
                .filter(Boolean)
              return (
                <article key={paquete.id} className="card p-4 border border-[var(--border)] grid gap-3">
                  <header className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-lg text-umber">{paquete.nombre_paquete}</h3>
                      <p className="muted text-sm">
                        {paquete.tipo_evento?.nombre_evento || 'Tipo de evento sin definir'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" className="btn btn-ghost" onClick={() => onEdit(paquete)}>
                        Editar
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={() => onDelete(paquete.id)}>
                        Eliminar
                      </button>
                    </div>
                  </header>
                  {paquete.descripcion && (
                    <p className="text-sm text-slate-600 whitespace-pre-line">{paquete.descripcion}</p>
                  )}
                  <div className="text-umber font-semibold text-sm">
                    Precio: Q{Number(paquete.precio ?? 0).toLocaleString('es-GT')}
                  </div>
                  {incluyeItems.length ? (
                    <ul className="list-disc pl-4 text-sm text-slate-600 space-y-1">
                      {incluyeItems.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted text-sm">No se han definido elementos incluidos.</p>
                  )}
                </article>
              )
            })}
          </div>
        ) : (
          <p className="muted text-sm">Todavía no hay paquetes creados.</p>
        )}
      </div>
    </div>
  )
}
