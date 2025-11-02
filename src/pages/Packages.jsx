import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const EyeIcon = ({ className = '', ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="M1.5 12s3.75-7.5 10.5-7.5 10.5 7.5 10.5 7.5-3.75 7.5-10.5 7.5S1.5 12 1.5 12Z" />
    <path d="M12 15.375a3.375 3.375 0 1 0 0-6.75 3.375 3.375 0 0 0 0 6.75Z" />
  </svg>
)

export default function Packages(){
  const [paquetes, setPaquetes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [imagenSeleccionada, setImagenSeleccionada] = useState(null)
  const [searchParams] = useSearchParams()
  const evento = searchParams.get('evento')

  useEffect(() => {
    let active = true
    const fetchData = async () => {
      setLoading(true)
      setError('')
      let query = supabase
        .from('paquete')
        .select(`
          id,
          nombre_paquete,
          descripcion,
          precio,
          incluye,
          tipo_evento:tipo_evento ( nombre_evento ),
          galeria_paquete ( url_imagen )
        `)

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
          <h1 className="leading-snug">
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
              const primeraImagen = paquete.galeria_paquete?.[0]?.url_imagen
              return (
                <article key={paquete.id} className="card relative h-full flex flex-col">
                  {primeraImagen && (
                    <button
                      type="button"
                      onClick={() => setImagenSeleccionada(primeraImagen)}
                      className="absolute right-4 top-4 text-slate-400 transition hover:text-umber"
                      aria-label="Ver vista previa del paquete"
                    >
                      <EyeIcon className="h-5 w-5" aria-hidden="true" />
                    </button>
                  )}
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
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => {
                          localStorage.setItem(
                            'paqueteSeleccionado',
                            JSON.stringify({
                              id: paquete.id,
                              nombre: paquete.nombre_paquete,
                              evento: paquete.tipo_evento?.nombre_evento,
                              precio: paquete.precio
                            })
                          )
                          window.location.href = '/reservar'
                        }}
                      >
                        Reservar
                      </button>
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
      {imagenSeleccionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div
            className="relative max-w-md rounded-2xl bg-white p-4 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label="Vista previa del paquete"
          >
            <img
              src={imagenSeleccionada}
              alt="Vista previa del paquete"
              className="max-h-[70vh] w-full rounded-xl object-contain"
            />
            <button
              type="button"
              onClick={() => setImagenSeleccionada(null)}
              className="mt-4 w-full rounded-full bg-umber px-4 py-2 text-sm font-semibold text-white transition hover:bg-umber/90"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
