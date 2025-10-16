import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Services(){
  const [servicios, setServicios] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const fetchData = async () => {
      setLoading(true)
      setError('')
      const { data, error: fetchError } = await supabase
        .from('servicio')
        .select('id, nombre, descripcion, precio')
      if (!active) return
      if (fetchError) {
        console.error('No se pudieron cargar los servicios', fetchError)
        setError('No pudimos obtener los servicios. Intenta nuevamente más tarde.')
        setServicios([])
      } else {
        setServicios(data ?? [])
      }
      setLoading(false)
    }
    fetchData()
    return () => { active = false }
  }, [])

  return (
    <div className="container-1120 py-6">
      <h2 className="text-2xl font-display mb-4">Servicios</h2>
      {loading && <p className="muted">Cargando servicios…</p>}
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {!loading && !error && (
        <div className="grid gap-4 md:grid-cols-3">
          {servicios.map(s => (
            <article key={s.id} className="card p-4">
              <h3 className="font-semibold">{s.nombre}</h3>
              <p className="muted text-sm">{s.descripcion}</p>
              {s.precio !== undefined && s.precio !== null && (
                <span className="text-umber font-semibold block mt-2">
                  Q{Number(s.precio).toLocaleString('es-GT')}
                </span>
              )}
            </article>
          ))}
          {servicios.length === 0 && (
            <p className="muted col-span-full">Todavía no hay servicios configurados.</p>
          )}
        </div>
      )}
    </div>
  )
}
