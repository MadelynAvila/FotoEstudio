import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Packages(){
  const [paquetes, setPaquetes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const fetchData = async () => {
      setLoading(true)
      setError('')
      const { data, error: fetchError } = await supabase
        .from('paquete')
        .select('id, nombre, paqueteservicio:paqueteservicio ( servicio:servicio ( id, nombre, descripcion, precio ) )')
      if (!active) return
      if (fetchError) {
        console.error('No se pudieron cargar los paquetes', fetchError)
        setError('No pudimos obtener los paquetes. Intenta nuevamente más tarde.')
        setPaquetes([])
      } else {
        setPaquetes(data ?? [])
      }
      setLoading(false)
    }
    fetchData()
    return () => { active = false }
  }, [])

  return (
    <div className="container-1120 py-6">
      <h2 className="text-2xl font-display mb-4">Paquetes</h2>
      {loading && <p className="muted">Cargando paquetes…</p>}
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {!loading && !error && (
        <div className="grid gap-4 md:grid-cols-3">
          {paquetes.map(p => {
            const servicios = (p.paqueteservicio ?? [])
              .map(rel => rel.servicio)
              .filter(Boolean)
            const total = servicios.reduce((sum, servicio) => sum + Number(servicio?.precio ?? 0), 0)
            return (
              <article key={p.id} className="card p-4 grid gap-2">
                <h3 className="font-semibold text-lg">{p.nombre}</h3>
                {servicios.length ? (
                  <ul className="list-disc pl-4 text-sm text-slate-600">
                    {servicios.map(servicio => (
                      <li key={servicio.id}>
                        <strong>{servicio.nombre}</strong>
                        {servicio.descripcion && <span className="block muted text-xs">{servicio.descripcion}</span>}
                        {servicio.precio !== undefined && servicio.precio !== null && (
                          <span className="block text-xs text-umber font-semibold">
                            Q{Number(servicio.precio).toLocaleString('es-GT')}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted text-sm">Este paquete aún no tiene servicios asociados.</p>
                )}
                {total > 0 && (
                  <div className="text-umber font-extrabold">
                    Total estimado: Q{total.toLocaleString('es-GT')}
                  </div>
                )}
                <a className="btn btn-primary mt-2" href="/reservar">Reservar</a>
              </article>
            )
          })}
          {paquetes.length === 0 && (
            <p className="muted col-span-full">Aún no hay paquetes publicados.</p>
          )}
        </div>
      )}
    </div>
  )
}
