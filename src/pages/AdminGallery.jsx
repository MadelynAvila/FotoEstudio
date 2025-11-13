import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import AdminHelpCard from '../components/AdminHelpCard'
import useFocusTrap from '../lib/useFocusTrap'

const defaultForm = {
  url: '',
  descripcion: '',
  paqueteId: ''
}

const defaultEditForm = {
  id: null,
  nombre: '',
  descripcion: '',
  url: ''
}

export default function AdminGallery(){
  const [paquetes, setPaquetes] = useState([])
  const [form, setForm] = useState(defaultForm)
  const [loading, setLoading] = useState(true)
  const [savingPhoto, setSavingPhoto] = useState(false)
  const [feedback, setFeedback] = useState({ type: '', message: '' })
  const [toast, setToast] = useState(null)
  const [editingPhoto, setEditingPhoto] = useState(null)
  const [editForm, setEditForm] = useState(defaultEditForm)
  const [processingId, setProcessingId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const editModalRef = useRef(null)
  const deleteModalRef = useRef(null)

  const fetchData = async () => {
    setLoading(true)
    setFeedback({ type: '', message: '' })

    const { data, error } = await supabase
      .from('paquete')
      .select('id, nombre_paquete, galeria:galeria_paquete ( * )')
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

  const closeToast = () => setToast(null)

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(closeToast, 4000)
    return () => clearTimeout(timer)
  }, [toast])

  const openEditModal = (foto) => {
    if (!foto) return
    setEditingPhoto(foto)
    setEditForm({
      id: foto.id,
      nombre: foto.nombre || foto.titulo || '',
      descripcion: foto.descripcion || '',
      url: foto.url_imagen || foto.url || ''
    })
  }

  const closeEditModal = () => {
    setEditingPhoto(null)
    setEditForm(defaultEditForm)
  }

  const updateEditField = (field, value) => {
    setEditForm(prev => ({ ...prev, [field]: value }))
  }

  const requestGalleryUpdate = async (id, payload) => {
    try {
      const response = await fetch(`/api/galeria/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Respuesta no exitosa del servicio de galería')
      }
      return result?.item ?? null
    } catch (error) {
      console.warn('Fallo la ruta /api/galeria, usando Supabase como respaldo', error)
      const updatePayload = {
        url_imagen: payload.url,
        descripcion: payload.descripcion || null
      }

      if (payload.nombre) {
        updatePayload.titulo = payload.nombre
      }

      const { error: supabaseError, data } = await supabase
        .from('galeria_paquete')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .maybeSingle()

      if (supabaseError) {
        const fallbackPayload = {
          url_imagen: payload.url,
          descripcion: payload.descripcion || payload.nombre || null
        }
        const { error: fallbackError, data: fallbackData } = await supabase
          .from('galeria_paquete')
          .update(fallbackPayload)
          .eq('id', id)
          .select()
          .maybeSingle()

        if (fallbackError) {
          throw fallbackError
        }
        return fallbackData
      }
      return data
    }
  }

  const requestGalleryDelete = async (id) => {
    try {
      const response = await fetch(`/api/galeria/${id}`, { method: 'DELETE' })
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'No se pudo eliminar la galería desde el backend')
      }
      return result?.deletedId ?? id
    } catch (error) {
      console.warn('Fallo la ruta /api/galeria, usando Supabase como respaldo', error)
      const { error: supabaseError } = await supabase.from('galeria_paquete').delete().eq('id', id)
      if (supabaseError) {
        throw supabaseError
      }
      return id
    }
  }

  const handleEditSubmit = async (event) => {
    event.preventDefault()
    if (!editingPhoto || !editForm.id) return

    const nombre = editForm.nombre.trim()
    const descripcion = editForm.descripcion.trim()
    const url = editForm.url.trim()

    if (!nombre) {
      setToast({ type: 'error', message: 'Agrega un nombre para la galería.' })
      return
    }

    if (!url) {
      setToast({ type: 'error', message: 'Agrega la URL de la imagen.' })
      return
    }

    setProcessingId(editForm.id)

    try {
      await requestGalleryUpdate(editForm.id, { nombre, descripcion, url })
      setToast({ type: 'success', message: '✅ Galería actualizada' })
      closeEditModal()
      await fetchData()
    } catch (error) {
      console.error('No se pudo actualizar la galería', error)
      setToast({ type: 'error', message: 'No se pudo actualizar la galería seleccionada.' })
    } finally {
      setProcessingId(null)
    }
  }

  const confirmDeletePhoto = (foto) => {
    setDeleteTarget(foto)
  }

  const closeDeleteModal = () => {
    setDeleteTarget(null)
  }

  useFocusTrap(editModalRef, Boolean(editingPhoto), closeEditModal)
  useFocusTrap(deleteModalRef, Boolean(deleteTarget), closeDeleteModal)

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) return
    const targetId = deleteTarget.id
    setProcessingId(targetId)

    try {
      await requestGalleryDelete(targetId)
      setToast({ type: 'success', message: '🗑️ Galería eliminada' })
      closeDeleteModal()
      await fetchData()
    } catch (error) {
      console.error('No se pudo eliminar la galería', error)
      setToast({ type: 'error', message: 'No se pudo eliminar la galería seleccionada.' })
    } finally {
      setProcessingId(null)
    }
  }

  const paquetesConGaleria = useMemo(() => {
    return paquetes.map(paquete => ({
      ...paquete,
      galeria: (paquete.galeria ?? [])
        .map(foto => ({
          ...foto,
          nombre: foto?.titulo || foto?.nombre || ''
        }))
        .slice()
        .sort((a, b) => b.id - a.id)
    }))
  }, [paquetes])

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`admin-toast admin-toast--${toast.type}`} role="status">
          <span>{toast.message}</span>
          <button type="button" onClick={closeToast} aria-label="Cerrar notificación">
            ×
          </button>
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
                <header className="p-4 border-b border-[#e4ddcc]/80 bg-[#faf8f4]">
                  <strong className="text-sm font-semibold text-umber">{paquete.nombre_paquete}</strong>
                  <p className="muted text-xs">{paquete.galeria.length} fotografía(s)</p>
                </header>
                {paquete.galeria.length ? (
                  <ul className="divide-y">
                    {paquete.galeria.map(foto => {
                      const isProcessing = processingId === foto.id
                      return (
                        <li key={foto.id} className="relative flex flex-col gap-3 p-4">
                          <div className="flex items-start gap-3">
                            <img
                              src={foto.url_imagen}
                              alt={foto.descripcion || foto.nombre || 'Fotografía de paquete'}
                              className="h-20 w-20 rounded-xl object-cover shadow-sm"
                            />
                            <div className="flex-1 space-y-2 overflow-hidden">
                              <div>
                                <p className="text-sm font-semibold text-umber truncate">
                                  {foto.nombre || 'Sin nombre'}
                                </p>
                                <p className="text-xs text-slate-600 line-clamp-3">
                                  {foto.descripcion || 'Sin descripción'}
                                </p>
                              </div>
                              <a
                                href={foto.url_imagen}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center text-xs text-umber underline underline-offset-2 break-all"
                              >
                                {foto.url_imagen}
                              </a>
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              className="gallery-action"
                              onClick={() => openEditModal(foto)}
                              disabled={isProcessing}
                              aria-label={`Editar galería ${foto.nombre || foto.descripcion || foto.id}`}
                            >
                              ✏️ Editar
                            </button>
                            <button
                              type="button"
                              className="gallery-action gallery-action--danger"
                              onClick={() => confirmDeletePhoto(foto)}
                              disabled={isProcessing}
                              aria-label={`Eliminar galería ${foto.nombre || foto.descripcion || foto.id}`}
                            >
                              🗑️ Eliminar
                            </button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className="muted text-sm px-4 pb-4">Este paquete aún no tiene fotografías asociadas.</p>
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
          aria-labelledby="editar-galeria-titulo"
          onClick={event => {
            if (event.target === event.currentTarget) closeEditModal()
          }}
        >
          <div ref={editModalRef} className="admin-modal__content max-w-lg" tabIndex={-1}>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <header className="space-y-2">
                <h3 id="editar-galeria-titulo" className="text-lg font-semibold text-umber">
                  Editar galería
                </h3>
                <p className="muted text-sm">
                  Actualiza el nombre, la descripción o la URL de la imagen seleccionada.
                </p>
              </header>

              <label className="grid gap-1 text-sm">
                <span className="font-medium text-slate-700">Nombre</span>
                <input
                  className="border rounded-xl2 px-3 py-2"
                  value={editForm.nombre}
                  onChange={event => updateEditField('nombre', event.target.value)}
                  placeholder="Ej. Sesión al atardecer"
                  required
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span className="font-medium text-slate-700">Descripción</span>
                <textarea
                  className="border rounded-xl2 px-3 py-2 min-h-[100px]"
                  value={editForm.descripcion}
                  onChange={event => updateEditField('descripcion', event.target.value)}
                  placeholder="Detalle opcional de la sesión"
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span className="font-medium text-slate-700">URL de la imagen</span>
                <input
                  className="border rounded-xl2 px-3 py-2"
                  value={editForm.url}
                  onChange={event => updateEditField('url', event.target.value)}
                  placeholder="https://"
                  required
                />
              </label>

              <div className="flex justify-end gap-3">
                <button type="button" className="btn btn-ghost" onClick={closeEditModal}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={processingId === editForm.id}>
                  {processingId === editForm.id ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div
          className="admin-modal"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="eliminar-galeria-titulo"
          aria-describedby="eliminar-galeria-descripcion"
          onClick={event => {
            if (event.target === event.currentTarget) closeDeleteModal()
          }}
        >
          <div ref={deleteModalRef} className="admin-modal__content max-w-md space-y-4" tabIndex={-1}>
            <div className="space-y-2">
              <h3 id="eliminar-galeria-titulo" className="text-lg font-semibold text-umber">
                ¿Eliminar galería?
              </h3>
              <p id="eliminar-galeria-descripcion" className="text-sm text-slate-600">
                ¿Deseas eliminar esta galería?
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" className="btn btn-ghost" onClick={closeDeleteModal}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleDeleteConfirmed}
                disabled={processingId === deleteTarget.id}
              >
                {processingId === deleteTarget.id ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
