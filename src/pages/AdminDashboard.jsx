import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import AdminHelpCard from '../components/AdminHelpCard'

const defaultStats = {
  reservas: 0,
  pendientes: 0,
  pagos: 0,
  clientes: 0,
  fotografos: 0,
  servicios: 0,
  paquetes: 0,
  resenas: 0
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-GT', { dateStyle: 'medium' }).format(date)
}

function formatEstado(value) {
  if (!value) return 'Pendiente'
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export default function AdminDashboard(){
  const [stats, setStats] = useState(defaultStats)
  const [reservas, setReservas] = useState([])
  const [proximas, setProximas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    const fetchServicios = async () => {
      const response = await supabase.from('servicio').select('id')
      if (response.error?.code === '42P01') {
        console.warn(
          '[Dashboard] La tabla "servicio" no está disponible. Se usará "tipo_evento" como respaldo.',
          response.error
        )
        const fallback = await supabase.from('tipo_evento').select('id')
        return { ...fallback, _source: 'tipo_evento' }
      }
      return { ...response, _source: 'servicio' }
    }

    const load = async () => {
      setLoading(true)
      setError('')

      const [
        actividadesRes,
        pagosRes,
        usuariosRes,
        paquetesRes,
        resenasRes
      ] = await Promise.all([
        supabase
          .from('actividad')
          .select(`
            id,
            estado_pago,
            nombre_actividad,
            ubicacion,
            agenda:agenda ( fecha, horainicio, horafin ),
            cliente:usuario!actividad_idcliente_fkey ( id, username, telefono ),
            paquete:paquete ( id, nombre_paquete ),
            pago:pago ( id, monto, fecha_pago )
          `)
          .order('id', { ascending: false }),
        supabase.from('pago').select('id, idactividad'),
        supabase.from('usuario').select('id, idrol, rol:rol ( id, nombre )'),
        supabase.from('paquete').select('id'),
        supabase.from('resena').select('id')
      ])

      const serviciosResponse = await fetchServicios()

      if (!active) return

      const errorEntries = []

      const trackError = (tableName, error) => {
        if (!error) return
        const code = error.code || ''
        if (code === 'PGRST116') {
          console.warn(
            `[Dashboard] Acceso restringido al leer "${tableName}". Verifica las políticas de Row Level Security.`,
            error
          )
        } else if (code === 'PGRST404' || code === '42P01') {
          console.warn(`[Dashboard] La tabla "${tableName}" no está disponible en Supabase.`, error)
        } else {
          console.error(`[Dashboard] Error al cargar datos de "${tableName}".`, error)
        }
        errorEntries.push({ table: tableName, error })
      }

      trackError('actividad', actividadesRes.error)
      trackError('pago', pagosRes.error)
      trackError('usuario', usuariosRes.error)
      trackError(serviciosResponse._source || 'servicio', serviciosResponse.error)
      trackError('paquete', paquetesRes.error)
      trackError('resena', resenasRes.error)

      const actividades = actividadesRes.data ?? []
      const pagos = pagosRes.data ?? []
      const usuarios = usuariosRes.data ?? []
      const paquetes = paquetesRes.data ?? []
      const resenas = resenasRes.data ?? []
      const servicios = serviciosResponse.data ?? []
      const pagosPorActividad = pagos.reduce((acc, pago) => {
        if (!pago?.idactividad) return acc
        acc.add(Number(pago.idactividad))
        return acc
      }, new Set())

      const formatted = actividades.map(item => {
        const clienteNombre = item.cliente?.username || 'Cliente sin nombre'
        const fechaAgenda = item.agenda?.fecha || null
        const estado = (item.estado_pago || 'Pendiente').toLowerCase()
        const pago = Array.isArray(item.pago) ? item.pago[0] : item.pago
        return {
          id: item.id,
          cliente: clienteNombre,
          comentarios: item.nombre_actividad || item.paquete?.nombre_paquete || '',
          fecha: fechaAgenda,
          estado,
          paquete: item.paquete?.nombre_paquete || 'Paquete sin asignar',
          pago: pago || (pagosPorActividad.has(Number(item.id)) ? { id: item.id } : null)
        }
      })

      const sortedByFechaDesc = formatted
        .slice()
        .sort((a, b) => {
          const aDate = new Date(a.fecha || 0)
          const bDate = new Date(b.fecha || 0)
          return bDate - aDate
        })

      const upcoming = formatted
        .filter(item => {
          if (!item.fecha) return false
          const fecha = new Date(item.fecha)
          if (Number.isNaN(fecha.getTime())) return false
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          fecha.setHours(0, 0, 0, 0)
          return fecha >= today
        })
        .sort((a, b) => new Date(a.fecha || 0) - new Date(b.fecha || 0))

      setReservas(sortedByFechaDesc.slice(0, 5))
      setProximas(upcoming.slice(0, 5))

      const normalizarRol = (rolNombre = '') =>
        rolNombre
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
      const clientesActivos = usuarios.filter(usuario => normalizarRol(usuario.rol?.nombre) === 'cliente')
      const fotografos = usuarios.filter(usuario => normalizarRol(usuario.rol?.nombre) === 'fotografo')

      setStats({
        reservas: actividades.length,
        pendientes: formatted.filter(item => item.estado === 'pendiente').length,
        pagos: pagos.length,
        clientes: clientesActivos.length,
        fotografos: fotografos.length,
        servicios: servicios.length,
        paquetes: paquetes.length,
        resenas: resenas.length
      })

      setError(errorEntries.length ? 'Algunas métricas no se pudieron cargar. Revisa la consola para más detalles.' : '')
      setLoading(false)
    }

    load()
    return () => {
      active = false
    }
  }, [])

  const resumen = useMemo(() => ([
    { label: 'Reservas totales', value: stats.reservas },
    { label: 'Reservas pendientes', value: stats.pendientes },
    { label: 'Pagos registrados', value: stats.pagos },
    { label: 'Clientes activos', value: stats.clientes },
    { label: 'Fotógrafos', value: stats.fotografos },
    { label: 'Servicios', value: stats.servicios },
    { label: 'Paquetes', value: stats.paquetes },
    { label: 'Reseñas', value: stats.resenas }
  ]), [stats])

  return (
    <div className="space-y-6">
      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {resumen.map(item => (
          <div key={item.label} className="card p-4">
            <span className="muted text-xs uppercase tracking-wide">{item.label}</span>
            <strong className="text-3xl text-umber">{item.value}</strong>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="card flex-1 space-y-6 p-4">
          <section>
            <h3 className="font-semibold mb-2">Reservas recientes</h3>
            {loading ? (
              <p className="muted text-sm">Cargando información…</p>
            ) : reservas.length ? (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-sand text-left">
                    <tr>
                      <th className="p-2">Cliente</th>
                      <th className="p-2">Comentarios</th>
                      <th className="p-2">Fecha solicitada</th>
                      <th className="p-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reservas.map(reserva => (
                      <tr key={reserva.id} className="border-b last:border-0">
                        <td className="p-2 font-medium">{reserva.cliente}</td>
                        <td className="p-2">{reserva.comentarios || '—'}</td>
                        <td className="p-2">{formatDate(reserva.fecha)}</td>
                        <td className="p-2">
                          <span className="inline-flex items-center rounded-full bg-sand px-2 py-1 text-xs font-semibold uppercase tracking-wide">
                            {formatEstado(reserva.estado)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted text-sm">Todavía no hay reservas registradas.</p>
            )}
          </section>

          <section>
            <h3 className="font-semibold mb-2">Próximas sesiones</h3>
            {loading ? (
              <p className="muted text-sm">Cargando información…</p>
            ) : proximas.length ? (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-sand text-left">
                    <tr>
                      <th className="p-2">Cliente</th>
                      <th className="p-2">Fecha</th>
                      <th className="p-2">Estado</th>
                      <th className="p-2">Pago</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proximas.map(item => (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="p-2 font-medium text-slate-700">{item.cliente}</td>
                        <td className="p-2">{formatDate(item.fecha)}</td>
                        <td className="p-2">
                          <span className="inline-flex items-center rounded-full bg-umber/10 px-3 py-1 text-xs font-semibold uppercase text-umber">
                            {formatEstado(item.estado)}
                          </span>
                        </td>
                        <td className="p-2 text-xs text-slate-600">{item.pago ? 'Pagado' : 'Pendiente'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted text-sm">Todavía no hay sesiones programadas para las próximas fechas.</p>
            )}
          </section>
        </div>

        <div className="lg:w-[320px]">
          <AdminHelpCard title="Sugerencias de uso del panel">
            <p>Revisa este resumen a diario para validar que todas las reservas pendientes tengan un fotógrafo asignado y un pago planificado.</p>
            <p>Utiliza el historial de pagos para confirmar que las facturas hayan sido generadas y entregadas al cliente.</p>
            <p>Las reseñas ayudan a nutrir tus páginas públicas; recuerda actualizarlas desde la sección correspondiente.</p>
          </AdminHelpCard>
        </div>
      </div>
    </div>
  )
}
