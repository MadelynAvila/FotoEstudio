import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import AdminHelpCard from '../components/AdminHelpCard'

const defaultForm = {
  url: '',
  idgaleria: ''
}

export default function AdminGallery(){
  const [galerias, setGalerias] = useState([])
  const [fotos, setFotos] = useState([])
  const [form, setForm] = useState(defaultForm)
  const [loading, setLoading] = useState(true)
  const [savingPhoto, setSavingPhoto] = useState(false)
  const [feedback, setFeedback] = useState({ type: '', message: '' })

  const fetchData = async () => {
    setLoading(true)
    setFeedback({ type: '', message: '' })

    const [galeriasRes, fotosRes] = await Promise.all([
      supabase.from('galeria').select('id, idactividad').order('id', { ascending: true }),
      supabase.from('fotosgaleria').select('id, urlfoto, idgaleria').order('id', { ascending: false })
    ])

    const errors = [galeriasRes.error, fotosRes.error].filter(Boolean)
    if (errors.length) {
      errors.forEach(err => console.error('No se pudo cargar la galería', err))
      setFeedback({ type: 'error', message: 'No pudimos cargar la información de la galería.' })
      setGalerias([])
      setFotos([])
      setLoading(false)
      return
    }

    const galeriasData = galeriasRes.data ?? []
    const fotosData = fotosRes.data ?? []

    setGalerias(galeriasData)
    setFotos(fotosData)
    setForm(prev => ({
      ...prev,
      idgaleria: prev.idgaleria || (galeriasData[0] ? String(galeriasData[0].id) : '')
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
    if (!form.idgaleria) {
      setFeedback({ type: 'error', message: 'Selecciona una galería para asociar la fotografía.' })
      return
    }

    setSavingPhoto(true)
    const { error } = await supabase.from('fotosgaleria').insert([
      {
        idgaleria: Number(form.idgaleria),
        urlfoto: form.url
      }
    ])

    if (error) {
      console.error('No se pudo guardar la fotografía', error)
      setFeedback({ type: 'error', message: 'No se pudo guardar la fotografía. Verifica la información e intenta nuevamente.' })
      setSavingPhoto(false)
      return
    }

    setFeedback({ type: 'success', message: 'Fotografía agregada correctamente.' })
    setForm(prev => ({ ...prev, url: '' }))
    setSavingPhoto(false)
    fetchData()
  }

  const onDeletePhoto = async (id) => {
    if (!window.confirm('¿Deseas eliminar esta fotografía?')) return
    const { error } = await supabase.from('fotosgaleria').delete().eq('id', id)
    if (error) {
      console.error('No se pudo eliminar la fotografía', error)
      setFeedback({ type: 'error', message: 'No se pudo eliminar la fotografía seleccionada.' })
    } else {
      setFotos(prev => prev.filter(foto => foto.id !== id))
    }
  }

  const onCreateGallery = async () => {
    const { data, error } = await supabase
      .from('galeria')
      .insert([{ idactividad: null }])
      .select('id, idactividad')
      .single()

    if (error || !data) {
      console.error('No se pudo crear la galería', error)
      setFeedback({ type: 'error', message: 'No se pudo crear una nueva galería.' })
      return
    }

    setGalerias(prev => [...prev, data])
    setForm(prev => ({ ...prev, idgaleria: String(data.id) }))
    setFeedback({ type: 'success', message: 'Galería creada correctamente. Ya puedes agregar fotos.' })
  }

  const galeriasConFotos = useMemo(() => {
    return galerias.map(galeria => ({
      ...galeria,
      fotos: fotos.filter(foto => Number(foto.idgaleria) === Number(galeria.id))
    }))
  }, [galerias, fotos])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        <div className="card flex-1 p-5 space-y-4">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-umber">Galería de fotografías</h1>
              <p className="muted text-sm">Organiza las imágenes asociadas a tus actividades y servicios.</p>
            </div>
            <button type="button" className="btn btn-ghost" onClick={onCreateGallery}>
              Crear nueva galería
            </button>
          </header>

          <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Selecciona una galería</span>
              <select
                value={form.idgaleria}
                onChange={event => updateField('idgaleria', event.target.value)}
                className="border rounded-xl2 px-3 py-2"
              >
                <option value="">Galería</option>
                {galerias.map(galeria => (
                  <option key={galeria.id} value={galeria.id}>
                    Galería #{galeria.id}
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
                placeholder="https://…"
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
            <p>Relaciona cada galería con una actividad para mantener el orden.</p>
            <p>Elimina fotografías antiguas para mantener la colección actualizada.</p>
          </AdminHelpCard>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="text-lg font-semibold text-umber mb-3">Galerías registradas</h2>
        {loading ? (
          <p className="muted text-sm">Cargando galería…</p>
        ) : galeriasConFotos.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {galeriasConFotos.map(galeria => (
              <article key={galeria.id} className="card overflow-hidden">
                <header className="p-3 flex items-center justify-between">
                  <strong>Galería #{galeria.id}</strong>
                  <span className="text-xs text-slate-500">{galeria.fotos.length} fotos</span>
                </header>
                {galeria.fotos.length ? (
                  <ul className="divide-y">
                    {galeria.fotos.map(foto => (
                      <li key={foto.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                        <a href={foto.urlfoto} target="_blank" rel="noreferrer" className="text-umber truncate">
                          {foto.urlfoto}
                        </a>
                        <button type="button" className="btn btn-ghost" onClick={() => onDeletePhoto(foto.id)}>
                          Eliminar
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted text-sm p-3">Esta galería aún no tiene fotografías.</p>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="muted text-sm">Todavía no se han creado galerías.</p>
        )}
      </div>
    </div>
  )
}
