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
    <div className="container-1120 py-6">
      <h2 className="text-2xl font-display mb-4">Portafolio</h2>
      {loading && <p className="muted">Cargando fotografías…</p>}
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {!loading && !error && (
        <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
          {fotos.map(f => (
            <div key={f.id} className="card aspect-square bg-sand flex items-center justify-center overflow-hidden">
              <img src={f.url_imagen} alt={f.descripcion || f.paquete?.nombre_paquete || 'Fotografía'} className="w-full h-full object-cover"/>
            </div>
          ))}
          {fotos.length === 0 && (
            <p className="muted col-span-full">Aún no hay fotografías publicadas.</p>
          )}
        </div>
      )}
    </div>
  )
}
