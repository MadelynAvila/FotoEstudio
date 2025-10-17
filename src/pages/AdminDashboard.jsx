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

    const load = async () => {
      setLoading(true)
      setError('')

      const [
        actividadesRes,
        pagosRes,
        clientesRes,
        usuariosRes,
        rolesRes,
        eventosRes,
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
        supabase.from('cliente').select('idcliente'),
        supabase.from('usuario').select('id, idRol'),
        supabase.from('rol').select('id, nombre'),
        supabase.from('tipo_evento').select('id'),
        supabase.from('paquete').select('id'),
        supabase.from('resena').select('id')
      ])

      if (!active) return

      const errors = [
        actividadesRes.error,
        pagosRes.error,
        clientesRes.error,
        usuariosRes.error,
        rolesRes.error,
        eventosRes.error,
        paquetesRes.error,
        resenasRes.error
      ].filter(Boolean)

      if (errors.length) {
        errors.forEach(err => console.error('Error al cargar el dashboard', err))
        setError('No pudimos obtener la información del panel. Revisa tu configuración de Supabase o intenta nuevamente.')
        setStats(defaultStats)
        setReservas([])
        setProximas([])
        setLoading(false)
        return
      }

      const actividades = actividadesRes.data ?? []
      const pagos = pagosRes.data ?? []
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
      const roles = rolesRes.data ?? []
      const usuarios = usuariosRes.data ?? []
      const rolFotografo = roles.find(rol => rol.nombre?.toLowerCase() === 'fotografo' || rol.nombre?.toLowerCase() === 'fotógrafo')
      const fotografos = usuarios.filter(usuario => rolFotografo && Number(usuario.idRol) === Number(rolFotografo.id))

      setStats({
        reservas: actividades.length,
        pendientes: formatted.filter(item => item.estado === 'pendiente').length,
        pagos: pagos.length,
        clientes: clientesRes.data?.length ?? 0,
        fotografos: fotografos.length,
        servicios: eventosRes.data?.length ?? 0,
        paquetes: paquetesRes.data?.length ?? 0,
        resenas: resenasRes.data?.length ?? 0
      })

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
