import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Portfolio(){
  const [fotos, setFotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const fetchData = async () => {
      setLoading(true)
      setError('')
      const { data, error: fetchError } = await supabase
        .from('galeria_paquete')
        .select('id, url_imagen, descripcion, id_paquete, paquete:paquete ( nombre_paquete )')
      if (!active) return
      if (fetchError) {
        console.error('No se pudo cargar la galería', fetchError)
        setError('No pudimos cargar la galería en este momento. Intenta nuevamente más tarde.')
        setFotos([])
      } else {
        setFotos((data ?? []).filter(f => f.url_imagen))
      }
      setLoading(false)
    }
    fetchData()
    return () => { active = false }
  }, [])

  return (
    <section className="page-section">
      <div className="section-shell">
        <div className="section-heading">
          <span className="section-eyebrow">Portafolio</span>
          <h1 className="text-3xl md:text-4xl">Narrativas visuales que conmueven</h1>
          <p className="section-subtitle">
            Una selección de sesiones recientes que combinan composición precisa, luz envolvente y dirección emocional.
          </p>
        </div>

        {loading && <p className="muted">Cargando fotografías…</p>}
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {!loading && !error && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {fotos.map(f => (
              <article key={f.id} className="card overflow-hidden group">
                <div className="aspect-[4/5] bg-sand overflow-hidden">
                  <img
                    src={f.url_imagen}
                    alt={f.descripcion || f.paquete?.nombre_paquete || 'Fotografía'}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="px-6 py-4 space-y-1">
                  <p className="text-sm font-semibold text-umber">{f.paquete?.nombre_paquete || 'Colección personalizada'}</p>
                  {f.descripcion && (
                    <p className="text-xs text-slate-500">{f.descripcion}</p>
                  )}
                </div>
              </article>
            ))}
            {fotos.length === 0 && (
              <p className="muted col-span-full">Aún no hay fotografías publicadas.</p>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
