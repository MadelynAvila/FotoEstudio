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
        .from('tipo_evento')
        .select('id, nombre_evento, descripcion, paquetes:paquete ( precio )')
      if (!active) return
      if (fetchError) {
        console.error('No se pudieron cargar los servicios', fetchError)
        setError('No pudimos obtener los servicios. Intenta nuevamente más tarde.')
        setServicios([])
      } else {
        const formatted = (data ?? []).map(item => {
          let descripcion = item.descripcion || ''
          let precio = null

          if (descripcion?.trim().startsWith('{')) {
            try {
              const parsed = JSON.parse(descripcion)
              descripcion = parsed.descripcion ?? descripcion
              if (parsed.precio !== undefined && parsed.precio !== null) {
                precio = parsed.precio
              }
            } catch (error) {
              console.error('No se pudo interpretar la descripción del evento', error)
            }
          }

          if (precio === null && Array.isArray(item.paquetes) && item.paquetes.length) {
            const precios = item.paquetes
              .map(paquete => Number(paquete.precio))
              .filter(value => Number.isFinite(value))
            if (precios.length) {
              precio = Math.min(...precios)
            }
          }

          return {
            id: item.id,
            nombre: item.nombre_evento,
            descripcion,
            precio
          }
        })

        setServicios(formatted)
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
          <span className="section-eyebrow">Servicios</span>
          <h1 className="text-3xl md:text-4xl">Especialidades fotográficas</h1>
          <p className="section-subtitle">
            Diseñamos sesiones enfocadas en los distintos momentos de tu vida y de tu marca. Encuentra el servicio ideal y personalízalo con nuestros paquetes.
          </p>
        </div>

        {loading && <p className="muted">Cargando servicios…</p>}
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {!loading && !error && (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {servicios.map(s => (
              <article key={s.id} className="card h-full">
                <div className="card-body space-y-4">
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold text-umber">{s.nombre}</h3>
                    <p className="text-sm leading-relaxed text-slate-600">
                      {s.descripcion || 'Próximamente agregaremos más detalles sobre este servicio.'}
                    </p>
                  </div>
                  {s.precio !== undefined && s.precio !== null && (
                    <p className="text-sm uppercase tracking-[0.3em] text-slate-500">
                      Desde <span className="block text-2xl font-display text-umber tracking-normal">Q{Number(s.precio).toLocaleString('es-GT')}</span>
                    </p>
                  )}
                  <a
                    className="text-sm font-semibold text-umber hover:underline"
                    href={`/paquetes?evento=${s.id}`}
                  >
                    Explorar paquetes relacionados
                  </a>
                </div>
              </article>
            ))}
            {servicios.length === 0 && (
              <p className="muted col-span-full">Todavía no hay servicios configurados.</p>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
