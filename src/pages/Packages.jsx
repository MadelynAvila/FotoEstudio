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
        .select('id, nombre_paquete, descripcion, precio, incluye, tipo_evento:tipo_evento ( nombre_evento )')
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
          {paquetes.map(paquete => {
            const incluyeItems = (paquete.incluye || '')
              .split('\n')
              .map(item => item.trim())
              .filter(Boolean)
            return (
              <article key={paquete.id} className="card p-4 grid gap-2">
                <header className="space-y-1">
                  <h3 className="font-semibold text-lg">{paquete.nombre_paquete}</h3>
                  <p className="muted text-xs">{paquete.tipo_evento?.nombre_evento || 'Evento general'}</p>
                </header>
                {paquete.descripcion && (
                  <p className="muted text-sm whitespace-pre-line">{paquete.descripcion}</p>
                )}
                {incluyeItems.length ? (
                  <ul className="list-disc pl-4 text-sm text-slate-600">
                    {incluyeItems.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted text-sm">Este paquete aún no tiene detalles de lo que incluye.</p>
                )}
                <div className="text-umber font-extrabold">
                  Precio: Q{Number(paquete.precio ?? 0).toLocaleString('es-GT')}
                </div>
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
