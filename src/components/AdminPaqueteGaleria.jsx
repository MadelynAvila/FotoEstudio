import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const uploadModes = {
  FILES: 'files',
  URL: 'url'
}

export default function AdminPaqueteGaleria({ idPaquete, nombrePaquete = '', onGalleryUpdated }) {
  const [imagenes, setImagenes] = useState([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [mode, setMode] = useState(uploadModes.FILES)
  const [files, setFiles] = useState([])
  const [imageUrl, setImageUrl] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [feedback, setFeedback] = useState({ type: '', message: '' })
  const fileInputRef = useRef(null)

  const fetchGaleria = useCallback(async () => {
    if (!idPaquete) return
    setLoading(true)
    setFeedback({ type: '', message: '' })

    const { data, error } = await supabase
      .from('galeria_paquete')
      .select('*')
      .eq('id_paquete', idPaquete)
      .order('id', { ascending: true })

    if (error) {
      console.error('No se pudo cargar la galería del paquete', error)
      setFeedback({ type: 'error', message: 'No pudimos cargar las imágenes de este paquete.' })
      setImagenes([])
    } else {
      setImagenes(data ?? [])
    }

    setLoading(false)
  }, [idPaquete])

  useEffect(() => {
    if (!idPaquete) {
      setImagenes([])
      return
    }
    fetchGaleria()
  }, [fetchGaleria, idPaquete])

  const resetForm = () => {
    setFiles([])
    setImageUrl('')
    setDescripcion('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleFilesChange = event => {
    const fileList = Array.from(event.target.files || [])
    setFiles(fileList)
  }

  const handleSubmit = async event => {
    event.preventDefault()
    if (!idPaquete) {
      setFeedback({ type: 'error', message: 'Selecciona un paquete para administrar su galería.' })
      return
    }

    setFeedback({ type: '', message: '' })

    if (mode === uploadModes.FILES) {
      if (!files.length) {
        setFeedback({ type: 'error', message: 'Selecciona al menos una imagen.' })
        return
      }
      await handleFileUpload()
      return
    }

    const trimmedUrl = imageUrl.trim()
    if (!trimmedUrl) {
      setFeedback({ type: 'error', message: 'Agrega la URL pública de la imagen.' })
      return
    }

    await handleUrlSubmit(trimmedUrl)
  }

  const handleFileUpload = async () => {
    setSubmitting(true)
    let successCount = 0
    let errorCount = 0
    try {
      for (const file of files) {
        const filePath = `paquetes/${idPaquete}/${Date.now()}-${file.name}`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('galeria-paquetes')
          .upload(filePath, file)

        if (uploadError) {
          console.error(uploadError)
          errorCount += 1
          setFeedback({ type: 'error', message: 'Ocurrió un error al subir una de las imágenes seleccionadas.' })
          continue
        }

        const { data: publicUrlData } = supabase.storage
          .from('galeria-paquetes')
          .getPublicUrl(uploadData?.path ?? filePath)

        const publicUrl = publicUrlData?.publicUrl
        if (!publicUrl) {
          console.error('No pudimos obtener la URL pública del archivo subido.')
          errorCount += 1
          setFeedback({ type: 'error', message: 'Ocurrió un error al subir una de las imágenes seleccionadas.' })
          continue
        }

        const { error: insertError } = await supabase.from('galeria_paquete').insert({
          id_paquete: idPaquete,
          url_imagen: publicUrl,
          descripcion: descripcion.trim() ? descripcion.trim() : null
        })

        if (insertError) {
          console.error(insertError)
          errorCount += 1
          setFeedback({ type: 'error', message: 'Ocurrió un error al guardar una de las imágenes seleccionadas.' })
          continue
        }

        successCount += 1
      }

      if (successCount) {
        const successMessage =
          errorCount > 0
            ? 'Se guardaron algunas imágenes; otras no pudieron subirse.'
            : 'Imágenes agregadas correctamente.'
        setFeedback({ type: 'success', message: successMessage })
        resetForm()
        await fetchGaleria()
        onGalleryUpdated?.()
      } else {
        setFeedback({ type: 'error', message: 'No pudimos subir las imágenes seleccionadas.' })
      }
    } catch (error) {
      console.error('No se pudieron subir las imágenes', error)
      if (!successCount) {
        setFeedback({ type: 'error', message: 'No pudimos subir las imágenes seleccionadas.' })
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleUrlSubmit = async trimmedUrl => {
    setSubmitting(true)
    try {
      const { error } = await supabase.from('galeria_paquete').insert({
        id_paquete: idPaquete,
        url_imagen: trimmedUrl,
        descripcion: descripcion.trim() ? descripcion.trim() : null
      })

      if (error) {
        throw error
      }

      setFeedback({ type: 'success', message: 'Imagen registrada correctamente.' })
      resetForm()
      await fetchGaleria()
      onGalleryUpdated?.()
    } catch (error) {
      console.error('No se pudo registrar la imagen', error)
      setFeedback({ type: 'error', message: 'No pudimos registrar la URL indicada.' })
    } finally {
      setSubmitting(false)
    }
  }

  const galleryTitle = nombrePaquete ? `Galería de ${nombrePaquete}` : 'Galería del paquete'

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold text-umber">{galleryTitle}</h2>
        <p className="text-sm text-slate-600">
          Agrega fotografías desde tu equipo o usando una URL y mantenlas organizadas por paquete.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-[#e4ddcc] bg-[#faf8f4] p-4">
        <div className="flex flex-wrap gap-4 text-sm font-medium text-slate-700">
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="upload-mode"
              value={uploadModes.FILES}
              checked={mode === uploadModes.FILES}
              onChange={() => setMode(uploadModes.FILES)}
            />
            Subir desde mi computadora
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="upload-mode"
              value={uploadModes.URL}
              checked={mode === uploadModes.URL}
              onChange={() => setMode(uploadModes.URL)}
            />
            Usar URL de imagen
          </label>
        </div>

        {mode === uploadModes.FILES ? (
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="admin-gallery-files">
              Selecciona imágenes (puedes elegir varias)
            </label>
            <input
              id="admin-gallery-files"
              type="file"
              multiple
              accept="image/*"
              ref={fileInputRef}
              onChange={handleFilesChange}
              className="w-full rounded-xl2 border px-3 py-2"
              disabled={!idPaquete || submitting}
            />
          </div>
        ) : (
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="admin-gallery-url">
              URL pública de la imagen
            </label>
            <input
              id="admin-gallery-url"
              type="url"
              value={imageUrl}
              onChange={event => setImageUrl(event.target.value)}
              placeholder="https://"
              className="w-full rounded-xl2 border px-3 py-2"
              disabled={!idPaquete || submitting}
            />
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="admin-gallery-description">
            Descripción (opcional)
          </label>
          <input
            id="admin-gallery-description"
            type="text"
            value={descripcion}
            onChange={event => setDescripcion(event.target.value)}
            placeholder="Ej. Sesión al aire libre"
            className="w-full rounded-xl2 border px-3 py-2"
            disabled={!idPaquete || submitting}
          />
        </div>

        <button type="submit" className="btn btn-primary w-full md:w-auto" disabled={submitting || !idPaquete}>
          {submitting ? 'Guardando…' : 'Guardar fotografía'}
        </button>

        {feedback.message && (
          <p className={`text-sm ${feedback.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
            {feedback.message}
          </p>
        )}
      </form>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-umber">Galería registrada</h3>
          <button type="button" className="text-sm text-umber underline-offset-2 hover:underline" onClick={fetchGaleria} disabled={loading}>
            {loading ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>
        {loading ? (
          <p className="text-sm text-slate-600">Cargando imágenes…</p>
        ) : imagenes.length ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {imagenes.map(imagen => (
              <li key={imagen.id} className="rounded-2xl border border-[#e4ddcc] bg-white p-3 shadow-sm">
                <figure className="space-y-2">
                  <img
                    src={imagen.url_imagen}
                    alt={imagen.descripcion || `Fotografía ${imagen.id}`}
                    className="h-36 w-full rounded-xl object-cover"
                    loading="lazy"
                  />
                  <figcaption className="text-xs text-slate-600">
                    {imagen.descripcion || 'Sin descripción'}
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-600">Todavía no hay imágenes registradas para este paquete.</p>
        )}
      </div>
    </section>
  )
}
