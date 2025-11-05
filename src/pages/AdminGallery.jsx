import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import AdminHelpCard from '../components/AdminHelpCard'

const defaultForm = {
  nombre: '',
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
  const [toast, setToast] = useState(null)
  const [editingPhoto, setEditingPhoto] = useState(null)
  const [editForm, setEditForm] = useState({ nombre: '', descripcion: '', url: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const fetchData = async () => {
    setLoading(true)
    setFeedback({ type: '', message: '' })

    const { data, error } = await supabase
      .from('paquete')
      .select('id, nombre_paquete, galeria:galeria_paquete ( id, nombre, url_imagen, descripcion )')
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

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3500)
    return () => window.clearTimeout(timer)
  }, [toast])

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const onSubmit = async (event) => {
    event.preventDefault()
    setFeedback({ type: '', message: '' })

    if (!form.nombre.trim()) {
      setFeedback({ type: 'error', message: 'Agrega un nombre para la fotografía.' })
      return
    }

    if (!form.url.trim()) {
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
        nombre: form.nombre.trim(),
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
    setForm(prev => ({ ...prev, nombre: '', url: '', descripcion: '' }))
    setSavingPhoto(false)
    fetchData()
  }

  const handleOpenEdit = (foto) => {
    if (!foto) return
    setEditingPhoto(foto)
    setEditForm({
      nombre: foto.nombre || '',
      descripcion: foto.descripcion || '',
      url: foto.url_imagen || ''
    })
  }

  const handleCloseEdit = () => {
    setEditingPhoto(null)
    setEditForm({ nombre: '', descripcion: '', url: '' })
    setEditSaving(false)
  }

  const updateEditField = (field, value) => {
    setEditForm(prev => ({ ...prev, [field]: value }))
  }

  const handleUpdatePhoto = async event => {
    event.preventDefault()
    if (!editingPhoto) return

    const nombre = (editForm.nombre || '').trim()
    const url = (editForm.url || '').trim()
    const descripcion = (editForm.descripcion || '').trim()

    if (!nombre) {
      setToast({ type: 'error', message: 'Agrega un nombre para la galería.' })
      return
    }

    if (!url) {
      setToast({ type: 'error', message: 'Agrega la URL pública de la imagen.' })
      return
    }

    setEditSaving(true)
    try {
      const response = await fetch(`/api/galeria/${editingPhoto.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, descripcion: descripcion || null, url })
      })

      if (!response.ok) {
        const detail = await response.text().catch(() => '')
        throw new Error(detail || 'Error al actualizar la galería')
      }
    } catch (error) {
      console.error('No se pudo actualizar la galería', error)
      setToast({ type: 'error', message: 'No se pudo actualizar la galería seleccionada.' })
      setEditSaving(false)
      return
    }

    setToast({ type: 'success', message: '✅ Galería actualizada' })
    handleCloseEdit()
    fetchData()
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    try {
      const response = await fetch(`/api/galeria/${deleteTarget.id}`, { method: 'DELETE' })
      if (!response.ok) {
        const detail = await response.text().catch(() => '')
        throw new Error(detail || 'Error al eliminar la galería')
      }
      setToast({ type: 'success', message: '🗑️ Galería eliminada' })
      setDeleteTarget(null)
      fetchData()
    } catch (error) {
      console.error('No se pudo eliminar la fotografía', error)
      setToast({ type: 'error', message: 'No se pudo eliminar la galería seleccionada.' })
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
      {toast && (
        <div className={`admin-toast admin-toast--${toast.type}`} role="status">
          <span>{toast.message}</span>
          <button type="button" onClick={() => setToast(null)} aria-label="Cerrar notificación">×</button>
        </div>
      )}
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
              <span className="font-medium text-slate-700">Nombre de la galería</span>
              <input
                value={form.nombre}
                onChange={event => updateField('nombre', event.target.value)}
                className="border rounded-xl2 px-3 py-2"
                placeholder="Ej. Sesión en exterior"
              />
            </label>
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
                  <ul className="space-y-3 p-3">
                    {paquete.galeria.map(foto => (
                      <li key={foto.id} className="gallery-card">
                        <div className="gallery-card__preview">
                          <img
                            src={foto.url_imagen}
                            alt={foto.descripcion || foto.nombre || 'Fotografía de paquete'}
                          />
                        </div>
                        <div className="gallery-card__info">
                          <p className="gallery-card__title">{foto.nombre || 'Sin título'}</p>
                          <p className="gallery-card__description">{foto.descripcion || 'Sin descripción'}</p>
                          <a
                            href={foto.url_imagen}
                            target="_blank"
                            rel="noreferrer"
                            className="gallery-card__link"
                          >
                            {foto.url_imagen}
                          </a>
                        </div>
                        <div className="gallery-card__actions">
                          <button
                            type="button"
                            className="gallery-card__button gallery-card__button--edit"
                            onClick={() => handleOpenEdit(foto)}
                          >
                            ✏️ Editar
                          </button>
                          <button
                            type="button"
                            className="gallery-card__button gallery-card__button--delete"
                            onClick={() => setDeleteTarget(foto)}
                          >
                            🗑️ Eliminar
                          </button>
                        </div>
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

      {editingPhoto && (
        <div
          className="admin-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-gallery-title"
          onClick={event => {
            if (event.target === event.currentTarget) {
              handleCloseEdit()
            }
          }}
        >
          <div className="admin-modal__content">
            <h3 id="edit-gallery-title" className="text-lg font-semibold text-umber">
              Editar galería
            </h3>
            <form onSubmit={handleUpdatePhoto} className="mt-4 grid gap-3">
              <label className="grid gap-1 text-sm">
                <span className="font-semibold text-slate-700">Nombre</span>
                <input
                  className="border rounded-xl2 px-3 py-2"
                  value={editForm.nombre}
                  onChange={event => updateEditField('nombre', event.target.value)}
                  placeholder="Ej. Sesión familiar"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-semibold text-slate-700">Descripción</span>
                <textarea
                  className="border rounded-xl2 px-3 py-2 min-h-[100px]"
                  value={editForm.descripcion}
                  onChange={event => updateEditField('descripcion', event.target.value)}
                  placeholder="Información adicional"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-semibold text-slate-700">URL de la imagen</span>
                <input
                  className="border rounded-xl2 px-3 py-2"
                  value={editForm.url}
                  onChange={event => updateEditField('url', event.target.value)}
                  placeholder="https://"
                />
              </label>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="btn btn-ghost" onClick={handleCloseEdit} disabled={editSaving}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={editSaving}>
                  {editSaving ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div
          className="admin-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-gallery-title"
          onClick={event => {
            if (event.target === event.currentTarget) {
              setDeleteTarget(null)
            }
          }}
        >
          <div className="admin-modal__content">
            <h3 id="delete-gallery-title" className="text-lg font-semibold text-umber">
              Eliminar galería
            </h3>
            <p className="muted text-sm">¿Deseas eliminar esta galería?</p>
            <div className="flex justify-end gap-3 pt-4">
              <button type="button" className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>
                Cancelar
              </button>
              <button type="button" className="btn btn-danger" onClick={handleConfirmDelete}>
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
