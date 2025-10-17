import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import AdminHelpCard from '../components/AdminHelpCard'

const defaultForm = {
  url: '',
  descripcion: '',
  paqueteId: ''
}

export default function AdminGallery(){
  const [paquetes, setPaquetes] = useState([])
  const [form, setForm] = useState(defaultForm)
  const [loading, setLoading] = useState(true)
  const [savingPhoto, setSavingPhoto] = useState(false)
  const [feedback, setFeedback] = useState({ type: '', message: '' })

  const fetchData = async () => {
    setLoading(true)
    setFeedback({ type: '', message: '' })

    const { data, error } = await supabase
      .from('paquete')
      .select('id, nombre_paquete, galeria:galeria_paquete ( id, url_imagen, descripcion )')
      .order('id', { ascending: true })

    if (error) {
      console.error('No se pudo cargar la galería', error)
      setFeedback({ type: 'error', message: 'No pudimos cargar la información de la galería.' })
      setPaquetes([])
      setLoading(false)
      return
    }

    const dataPaquetes = data ?? []
    setPaquetes(dataPaquetes)
    setForm(prev => ({
      ...prev,
      paqueteId: prev.paqueteId || (dataPaquetes[0] ? String(dataPaquetes[0].id) : '')
    }))
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const onSubmit = async (event) => {
    event.preventDefault()
    setFeedback({ type: '', message: '' })

    if (!form.url) {
      setFeedback({ type: 'error', message: 'Agrega la URL pública de la imagen.' })
      return
    }
    if (!form.paqueteId) {
      setFeedback({ type: 'error', message: 'Selecciona un paquete para asociar la fotografía.' })
      return
    }

    setSavingPhoto(true)
    const { error } = await supabase.from('galeria_paquete').insert([
      {
        id_paquete: Number(form.paqueteId),
        url_imagen: form.url,
        descripcion: form.descripcion || null
      }
    ])

    if (error) {
      console.error('No se pudo guardar la fotografía', error)
      setFeedback({ type: 'error', message: 'No se pudo guardar la fotografía. Verifica la información e intenta nuevamente.' })
      setSavingPhoto(false)
      return
    }

    setFeedback({ type: 'success', message: 'Fotografía agregada correctamente.' })
    setForm(prev => ({ ...prev, url: '', descripcion: '' }))
    setSavingPhoto(false)
    fetchData()
  }

  const onDeletePhoto = async (id) => {
    if (!window.confirm('¿Deseas eliminar esta fotografía?')) return
    const { error } = await supabase.from('galeria_paquete').delete().eq('id', id)
    if (error) {
      console.error('No se pudo eliminar la fotografía', error)
      setFeedback({ type: 'error', message: 'No se pudo eliminar la fotografía seleccionada.' })
    } else {
      fetchData()
    }
  }

  const paquetesConGaleria = useMemo(() => {
    return paquetes.map(paquete => ({
      ...paquete,
      galeria: (paquete.galeria ?? []).slice().sort((a, b) => b.id - a.id)
    }))
  }, [paquetes])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        <div className="card flex-1 p-5 space-y-4">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-umber">Galería de fotografías</h1>
              <p className="muted text-sm">Organiza las imágenes asociadas a tus paquetes.</p>
            </div>
          </header>

          <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Selecciona un paquete</span>
              <select
                value={form.paqueteId}
                onChange={event => updateField('paqueteId', event.target.value)}
                className="border rounded-xl2 px-3 py-2"
              >
                <option value="">Paquete</option>
                {paquetes.map(paquete => (
                  <option key={paquete.id} value={paquete.id}>
                    {paquete.nombre_paquete}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm md:col-span-2">
              <span className="font-medium text-slate-700">URL de la fotografía</span>
              <input
                value={form.url}
                onChange={event => updateField('url', event.target.value)}
                className="border rounded-xl2 px-3 py-2"
                placeholder="https://"
              />
            </label>
            <label className="grid gap-1 text-sm md:col-span-2">
              <span className="font-medium text-slate-700">Descripción</span>
              <textarea
                value={form.descripcion}
                onChange={event => updateField('descripcion', event.target.value)}
                className="border rounded-xl2 px-3 py-2 min-h-[100px]"
                placeholder="Ej. Sesión en exterior"
              />
            </label>
            <div className="md:col-span-2">
              <button className="btn btn-primary" disabled={savingPhoto}>
                {savingPhoto ? 'Guardando…' : 'Agregar fotografía'}
              </button>
            </div>
          </form>
          {feedback.message && (
            <p className={`text-sm ${feedback.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
              {feedback.message}
            </p>
          )}
        </div>

        <div className="lg:w-[320px]">
          <AdminHelpCard title="Consejos para la galería">
            <p>Sube imágenes en buena resolución y alojadas en un servicio confiable.</p>
            <p>Relaciona cada fotografía con el paquete correspondiente para mantener el orden.</p>
            <p>Elimina fotografías antiguas para mantener la colección actualizada.</p>
          </AdminHelpCard>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="text-lg font-semibold text-umber mb-3">Galerías registradas</h2>
        {loading ? (
          <p className="muted text-sm">Cargando galería…</p>
        ) : paquetesConGaleria.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {paquetesConGaleria.map(paquete => (
              <article key={paquete.id} className="card overflow-hidden">
                <header className="p-3">
                  <strong>{paquete.nombre_paquete}</strong>
                  <p className="muted text-xs">{paquete.galeria.length} fotografía(s)</p>
                </header>
                {paquete.galeria.length ? (
                  <ul className="divide-y">
                    {paquete.galeria.map(foto => (
                      <li key={foto.id} className="flex items-center gap-3 p-3">
                        <img
                          src={foto.url_imagen}
                          alt={foto.descripcion || 'Fotografía de paquete'}
                          className="h-16 w-16 rounded object-cover"
                        />
                        <div className="flex-1">
                          <p className="text-sm text-slate-700 truncate">{foto.descripcion || 'Sin descripción'}</p>
                          <a href={foto.url_imagen} target="_blank" rel="noreferrer" className="muted text-xs break-all">
                            {foto.url_imagen}
                          </a>
                        </div>
                        <button type="button" className="btn btn-ghost" onClick={() => onDeletePhoto(foto.id)}>
                          Eliminar
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted text-sm px-3 pb-3">Este paquete aún no tiene fotografías asociadas.</p>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="muted text-sm">Todavía no hay fotografías registradas.</p>
        )}
      </div>
    </div>
  )
}
