import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import AdminHelpCard from '../components/AdminHelpCard'

const defaultForm = {
  id: null,
  nombre: '',
  servicios: []
}

export default function AdminPackages(){
  const [paquetes, setPaquetes] = useState([])
  const [servicios, setServicios] = useState([])
  const [form, setForm] = useState(defaultForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState({ type: '', message: '' })

  const fetchData = async () => {
    setLoading(true)
    setFeedback({ type: '', message: '' })

    const [paquetesRes, serviciosRes] = await Promise.all([
      supabase
        .from('paquete')
        .select(`
          id,
          nombre,
          paqueteservicio:paqueteservicio (
            idservicio,
            servicio:servicio ( id, nombre, descripcion, precio )
          )
        `)
        .order('id', { ascending: true }),
      supabase
        .from('servicio')
        .select('id, nombre, descripcion, precio')
        .order('nombre', { ascending: true })
    ])

    const errors = [paquetesRes.error, serviciosRes.error].filter(Boolean)
    if (errors.length) {
      errors.forEach(err => console.error('No se pudieron cargar los paquetes', err))
      setFeedback({ type: 'error', message: 'No pudimos cargar los paquetes ni los servicios disponibles.' })
      setPaquetes([])
      setServicios([])
      setLoading(false)
      return
    }

    setPaquetes(paquetesRes.data ?? [])
    setServicios(serviciosRes.data ?? [])
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

  const selectedServicios = useMemo(() => {
    return servicios.filter(servicio => form.servicios.includes(String(servicio.id)))
  }, [servicios, form.servicios])

  const totalSeleccionado = selectedServicios.reduce(
    (sum, servicio) => sum + Number(servicio.precio ?? 0),
    0
  )

  const onSubmit = async (event) => {
    event.preventDefault()
    setFeedback({ type: '', message: '' })

    if (!form.nombre) {
      setFeedback({ type: 'error', message: 'Especifica un nombre para el paquete.' })
      return
    }

    setSaving(true)

    if (form.id) {
      const { error: updateError } = await supabase
        .from('paquete')
        .update({ nombre: form.nombre })
        .eq('id', form.id)

      if (updateError) {
        console.error('No se pudo actualizar el paquete', updateError)
        setFeedback({ type: 'error', message: 'No se pudo actualizar el paquete seleccionado.' })
        setSaving(false)
        return
      }

      await supabase.from('paqueteservicio').delete().eq('idpaquete', form.id)

      if (form.servicios.length) {
        const relaciones = form.servicios.map(idServicio => ({
          idpaquete: form.id,
          idservicio: Number(idServicio)
        }))
        const { error: relacionError } = await supabase.from('paqueteservicio').insert(relaciones)
        if (relacionError) {
          console.error('No se pudieron asociar los servicios', relacionError)
          setFeedback({ type: 'error', message: 'El paquete se actualizó, pero no se pudieron asociar los servicios seleccionados.' })
          setSaving(false)
          fetchData()
          return
        }
      }

      setFeedback({ type: 'success', message: 'Paquete actualizado correctamente.' })
    } else {
      const { data: paqueteCreado, error: insertError } = await supabase
        .from('paquete')
        .insert([{ nombre: form.nombre }])
        .select('id, nombre')
        .single()

      if (insertError || !paqueteCreado) {
        console.error('No se pudo crear el paquete', insertError)
        setFeedback({ type: 'error', message: 'No se pudo crear el paquete. Intenta nuevamente.' })
        setSaving(false)
        return
      }

      if (form.servicios.length) {
        const relaciones = form.servicios.map(idServicio => ({
          idpaquete: paqueteCreado.id,
          idservicio: Number(idServicio)
        }))
        const { error: relacionError } = await supabase.from('paqueteservicio').insert(relaciones)
        if (relacionError) {
          console.error('No se pudieron asociar los servicios', relacionError)
          setFeedback({ type: 'error', message: 'El paquete se creó, pero no se pudieron asociar los servicios seleccionados.' })
          setSaving(false)
          fetchData()
          return
        }
      }

      setFeedback({ type: 'success', message: 'Paquete creado correctamente.' })
    }

    setSaving(false)
    resetForm()
    fetchData()
  }

  const onEdit = (paquete) => {
    const serviciosIds = (paquete.paqueteservicio ?? []).map(rel => String(rel.idservicio))
    setForm({ id: paquete.id, nombre: paquete.nombre || '', servicios: serviciosIds })
  }

  const onDelete = async (id) => {
    if (!window.confirm('¿Eliminar este paquete?')) return

    await supabase.from('paqueteservicio').delete().eq('idpaquete', id)
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
              <span className="font-medium text-slate-700">Selecciona servicios incluidos</span>
              <select
                multiple
                value={form.servicios}
                onChange={event => {
                  const selected = Array.from(event.target.selectedOptions).map(option => option.value)
                  updateField('servicios', selected)
                }}
                className="border rounded-xl2 px-3 py-2 h-40"
              >
                {servicios.map(servicio => (
                  <option key={servicio.id} value={servicio.id}>
                    {servicio.nombre} — Q{Number(servicio.precio ?? 0).toLocaleString('es-GT')}
                  </option>
                ))}
              </select>
            </label>
            {totalSeleccionado > 0 && (
              <p className="md:col-span-2 text-sm text-umber font-semibold">
                Total estimado de servicios: Q{totalSeleccionado.toLocaleString('es-GT')}
              </p>
            )}
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
            <p>Utiliza el total estimado como referencia para definir el costo final del paquete.</p>
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
              const serviciosIncluidos = (paquete.paqueteservicio ?? [])
                .map(rel => rel.servicio)
                .filter(Boolean)
              const total = serviciosIncluidos.reduce(
                (sum, servicio) => sum + Number(servicio?.precio ?? 0),
                0
              )
              return (
                <article key={paquete.id} className="card p-4 border border-[var(--border)] grid gap-2">
                  <header className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-lg text-umber">{paquete.nombre}</h3>
                    <div className="flex gap-2">
                      <button type="button" className="btn btn-ghost" onClick={() => onEdit(paquete)}>
                        Editar
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={() => onDelete(paquete.id)}>
                        Eliminar
                      </button>
                    </div>
                  </header>
                  {serviciosIncluidos.length ? (
                    <ul className="list-disc pl-4 text-sm text-slate-600">
                      {serviciosIncluidos.map(servicio => (
                        <li key={servicio.id} className="space-y-1">
                          <strong>{servicio.nombre}</strong>
                          {servicio.descripcion && (
                            <span className="block muted text-xs">{servicio.descripcion}</span>
                          )}
                          {servicio.precio !== undefined && servicio.precio !== null && (
                            <span className="block text-xs text-umber font-semibold">
                              Q{Number(servicio.precio).toLocaleString('es-GT')}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted text-sm">Sin servicios asociados.</p>
                  )}
                  {total > 0 && (
                    <div className="text-umber font-extrabold">
                      Total estimado: Q{total.toLocaleString('es-GT')}
                    </div>
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
