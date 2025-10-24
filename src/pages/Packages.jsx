import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function Packages(){
  const [paquetes, setPaquetes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchParams] = useSearchParams()
  const evento = searchParams.get('evento')

  useEffect(() => {
    let active = true
    const fetchData = async () => {
      setLoading(true)
      setError('')
      let query = supabase
        .from('paquete')
        .select('id, nombre_paquete, descripcion, precio, incluye, tipo_evento:tipo_evento ( nombre_evento )')

      if (evento) {
        query = query.eq('id_tipo_evento', evento)
      }

      const { data, error: fetchError } = await query
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
  }, [evento])

  return (
    <section className="page-section">
      <div className="section-shell">
        <div className="section-heading">
          <span className="section-eyebrow">Paquetes</span>
          <h1 className="text-3xl md:text-4xl">
            {evento ? 'Paquetes filtrados por servicio' : 'Todos los paquetes'}
          </h1>
          <p className="section-subtitle">
            Ajusta la duración, cantidad de fotografías y servicios adicionales según la experiencia que quieras vivir.
          </p>
        </div>

        {loading && <p className="muted">Cargando paquetes…</p>}
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {!loading && !error && (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {paquetes.map(paquete => {
              const incluyeItems = (paquete.incluye || '')
                .split('\n')
                .map(item => item.trim())
                .filter(Boolean)
              return (
                <article key={paquete.id} className="card h-full flex flex-col">
                  <div className="card-body flex flex-col gap-4 flex-1">
                    <header className="space-y-1">
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{paquete.tipo_evento?.nombre_evento || 'Evento especial'}</p>
                      <h3 className="text-xl font-semibold text-umber">{paquete.nombre_paquete}</h3>
                    </header>
                    {paquete.descripcion && (
                      <p className="text-sm leading-relaxed text-slate-600 whitespace-pre-line">{paquete.descripcion}</p>
                    )}
                    {incluyeItems.length ? (
                      <ul className="grid gap-2 text-sm text-slate-600">
                        {incluyeItems.map((item, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="mt-1 h-2 w-2 rounded-full bg-umber/40"></span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted text-sm">Este paquete aún no tiene detalles de lo que incluye.</p>
                    )}
                  </div>
                  <div className="px-6 pb-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Inversión</p>
                        <p className="text-2xl font-display text-umber">Q{Number(paquete.precio ?? 0).toLocaleString('es-GT')}</p>
                      </div>
                      <a className="btn btn-primary" href="/reservar">Reservar</a>
                    </div>
                  </div>
                </article>
              )
            })}
            {paquetes.length === 0 && (
              <p className="muted col-span-full">Aún no hay paquetes publicados.</p>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
