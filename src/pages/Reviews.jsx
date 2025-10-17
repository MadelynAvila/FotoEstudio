import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const defaultForm = { calificacion: 5, comentario: '' }

export default function Reviews(){
  const [resenas, setResenas] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(defaultForm)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState({ type: '', message: '' })

  const fetchResenas = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('resena')
      .select('id, calificacion, comentario, fecha_resena')
      .order('id', { ascending: false })

    if (error) {
      console.error('No se pudieron cargar las reseñas públicas', error)
      setResenas([])
    } else {
      setResenas(data ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchResenas()
  }, [])

  const promedio = useMemo(() => {
    if (!resenas.length) return null
    const total = resenas.reduce((sum, resena) => sum + Number(resena?.calificacion ?? 0), 0)
    return Math.round((total / resenas.length) * 10) / 10
  }, [resenas])

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const resetForm = () => setForm(defaultForm)

  const onSubmit = async (event) => {
    event.preventDefault()
    setFeedback({ type: '', message: '' })

    const calificacion = Number(form.calificacion)
    if (!Number.isFinite(calificacion) || calificacion < 1 || calificacion > 5) {
      setFeedback({ type: 'error', message: 'El puntaje debe ser un valor entre 1 y 5.' })
      return
    }

    const comentario = form.comentario.trim()
    if (comentario.length < 10) {
      setFeedback({ type: 'error', message: 'Por favor cuéntanos tu experiencia en al menos 10 caracteres.' })
      return
    }

    setSubmitting(true)
    const { error } = await supabase.from('resena').insert([{ calificacion, comentario }])

    if (error) {
      console.error('No se pudo registrar la reseña pública', error)
      setFeedback({ type: 'error', message: 'No pudimos registrar tu reseña. Inténtalo nuevamente en unos minutos.' })
    } else {
      setFeedback({ type: 'success', message: '¡Gracias por compartir tu experiencia! Tu reseña se publicó correctamente.' })
      resetForm()
      fetchResenas()
    }

    setSubmitting(false)
  }

  return (
    <div className="container-1120 py-8 space-y-8">
      <div className="grid gap-6 lg:grid-cols-[1.1fr,1fr]">
        <div className="card p-6 space-y-5">
          <header className="space-y-1">
            <p className="uppercase tracking-[.2em] text-xs text-umber">Comparte tu historia</p>
            <h1 className="text-3xl font-display">Reseñas de Aguín Fotografía</h1>
            <p className="muted max-w-2xl text-sm md:text-base">
              Nos encanta saber cómo nuestras sesiones fotográficas te hicieron sentir. Completa el formulario y comparte
              tu experiencia para ayudar a otros clientes a elegir con confianza.
            </p>
          </header>

          {promedio !== null && (
            <div className="flex items-center gap-3 rounded-xl2 bg-sand/60 border border-dashed border-umber/40 px-4 py-3 text-umber">
              <div className="text-3xl font-display">{promedio}</div>
              <div className="text-sm leading-tight">
                <p className="font-semibold">Puntaje promedio</p>
                <p className="muted">Basado en {resenas.length} {resenas.length === 1 ? 'reseña' : 'reseñas'} publicadas.</p>
              </div>
            </div>
          )}

          <form onSubmit={onSubmit} className="grid gap-4">
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Puntaje (1 a 5 estrellas)</span>
              <input
                type="number"
                min="1"
                max="5"
                value={form.calificacion}
                onChange={event => updateField('calificacion', event.target.value)}
                className="border rounded-xl2 px-3 py-2"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Tu reseña</span>
              <textarea
                value={form.comentario}
                onChange={event => updateField('comentario', event.target.value)}
                className="border rounded-xl2 px-3 py-3 min-h-[140px]"
                placeholder="Cuéntanos qué te gustó de la sesión, el trato del equipo y el resultado final."
              />
            </label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button type="submit" className="btn btn-primary sm:w-auto" disabled={submitting}>
                {submitting ? 'Enviando reseña…' : 'Enviar reseña'}
              </button>
              <button
                type="button"
                className="btn btn-ghost sm:w-auto"
                onClick={resetForm}
                disabled={submitting}
              >
                Limpiar formulario
              </button>
            </div>
            {feedback.message && (
              <p className={`text-sm ${feedback.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
                {feedback.message}
              </p>
            )}
          </form>
        </div>

        <aside className="card p-6 space-y-3 bg-sand/30 border border-dashed border-umber/40">
          <h2 className="text-lg font-semibold text-umber">¿Por qué compartir tu reseña?</h2>
          <ul className="list-disc pl-5 space-y-2 text-sm text-slate-600">
            <li>Ayudas a más personas a descubrir cómo trabajamos y qué pueden esperar.</li>
            <li>Nos motivas a seguir creando experiencias memorables para cada sesión.</li>
            <li>Tus comentarios nos permiten mejorar continuamente nuestro servicio.</li>
          </ul>
        </aside>
      </div>

      <section className="space-y-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-display">Lo que dicen nuestros clientes</h2>
            <p className="muted text-sm">Reseñas verificadas y publicadas directamente por nuestra comunidad.</p>
          </div>
          <button type="button" className="btn btn-ghost self-start" onClick={fetchResenas} disabled={loading}>
            {loading ? 'Actualizando…' : 'Actualizar lista'}
          </button>
        </div>

        {loading ? (
          <p className="muted text-sm">Cargando reseñas…</p>
        ) : resenas.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {resenas.map(resena => {
              const rating = Number(resena?.calificacion ?? 0)
              return (
                <article key={resena.id} className="card border border-[var(--border)] p-5 space-y-3 bg-white shadow-soft/40">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1 text-amber-500" aria-label={`Puntaje ${rating} de 5`}>
                        {[1, 2, 3, 4, 5].map(star => (
                          <span key={star}>{star <= Math.round(rating) ? '★' : '☆'}</span>
                        ))}
                      </div>
                      <span className="text-sm font-semibold text-umber">{rating.toFixed(1)} / 5</span>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 whitespace-pre-line">
                    {resena.comentario || 'El cliente no dejó un comentario.'}
                  </p>
                </article>
              )
            })}
          </div>
        ) : (
          <p className="muted text-sm">Aún no se han publicado reseñas. ¡Sé la primera persona en dejar la tuya!</p>
        )}
      </section>
    </div>
  )
}
