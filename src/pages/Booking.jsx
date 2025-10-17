import { useEffect, useState } from 'react'
import { useAuth } from '../auth/authContext'
import { supabase } from '../lib/supabaseClient'

const horaATotalMinutos = (hora) => {
  if (!hora) return null
  const [horas, minutos] = hora.split(':')
  const h = Number(horas)
  const m = Number(minutos ?? 0)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return h * 60 + m
}

const initialForm = {
  nombre: '',
  telefono: '',
  correo: '',
  paqueteId: '',
  fecha: '',
  horaInicio: '',
  horaFin: '',
  ubicacion: '',
  formaPago: '',
  fotografoId: ''
}

export default function Booking(){
  const [form, setForm] = useState(initialForm)
  const [paquetes, setPaquetes] = useState([])
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [prefilled, setPrefilled] = useState(false)
  const [fotografos, setFotografos] = useState([])
  const [disponibilidadFotografos, setDisponibilidadFotografos] = useState({})
  const { user } = useAuth()

  useEffect(() => {
    const loadPaquetes = async () => {
      const { data, error: paquetesError } = await supabase
        .from('paquete')
        .select('id, nombre_paquete, precio')
        .order('nombre_paquete', { ascending: true })
      if (paquetesError) {
        console.error('No se pudieron cargar los paquetes', paquetesError)
      } else {
        setPaquetes(data ?? [])
      }
    }
    loadPaquetes()
  }, [])

  useEffect(() => {
    const loadFotografos = async () => {
      const { data: rolFotografo, error: rolFotografoError } = await supabase
        .from('rol')
        .select('id, nombre')
        .ilike('nombre', 'fotogra%')
        .maybeSingle()

      if (rolFotografoError || !rolFotografo) {
        console.error('No se pudo obtener el rol de fotógrafo', rolFotografoError)
        return
      }

      const { data: fotografoData, error: fotografoError } = await supabase
        .from('usuario')
        .select('id, username')
        .eq('idrol', rolFotografo.id)
        .order('username', { ascending: true })

      if (fotografoError) {
        console.error('No se pudieron cargar los fotógrafos', fotografoError)
        return
      }

      setFotografos(fotografoData ?? [])
    }

    loadFotografos()
  }, [])

  useEffect(() => {
    if (user && !prefilled) {
      const nombreUsuario = user.name ?? user.nombre ?? user.username ?? ''
      const telefonoUsuario = user.telefono ?? user.phone ?? ''
      const correoUsuario = user.correo ?? user.email ?? ''

      setForm(prev => ({
        ...prev,
        nombre: nombreUsuario || prev.nombre,
        telefono: telefonoUsuario || prev.telefono,
        correo: correoUsuario || prev.correo,
      }))
      setPrefilled(true)
    }

    if (!user && prefilled) {
      setForm({ ...initialForm })
      setPrefilled(false)
    }
  }, [user, prefilled])

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  useEffect(() => {
    const evaluarDisponibilidad = async () => {
      if (!form.fecha || !form.horaInicio || !form.horaFin || fotografos.length === 0) {
        setDisponibilidadFotografos({})
        return
      }

      const inicioCliente = horaATotalMinutos(form.horaInicio)
      const finCliente = horaATotalMinutos(form.horaFin)

      if (inicioCliente === null || finCliente === null) {
        setDisponibilidadFotografos({})
        return
      }

      if (inicioCliente >= finCliente) {
        setDisponibilidadFotografos({})
        return
      }

      const { data: agendas, error: agendaError } = await supabase
        .from('agenda')
        .select('idfotografo, horainicio, horafin, disponible')
        .eq('fecha', form.fecha)

      if (agendaError) {
        console.error('No se pudo consultar la disponibilidad de fotógrafos', agendaError)
        setDisponibilidadFotografos({})
        return
      }

      const ocupado = new Set()
      (agendas ?? []).forEach(slot => {
        const inicioAgenda = horaATotalMinutos(slot.horainicio)
        const finAgenda = horaATotalMinutos(slot.horafin)
        const reservado = slot.disponible === false
        if (reservado && inicioAgenda !== null && finAgenda !== null && inicioAgenda < finCliente && inicioCliente < finAgenda) {
          ocupado.add(slot.idfotografo)
        }
      })

      const mapaDisponibilidad = {}
      fotografos.forEach(f => {
        mapaDisponibilidad[f.id] = !ocupado.has(f.id)
      })

      setDisponibilidadFotografos(mapaDisponibilidad)
    }

    evaluarDisponibilidad()
  }, [form.fecha, form.horaInicio, form.horaFin, fotografos])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMensaje('')
    setError('')

    if (!user) {
      setError('Debes iniciar sesión para reservar una sesión.')
      return
    }

    const nombre = (form.nombre ?? '').trim()
    const telefono = (form.telefono ?? '').trim()
    const correo = (form.correo ?? '').trim()
    const paqueteId = form.paqueteId
    const fechaReserva = form.fecha
    const horaInicio = form.horaInicio
    const horaFin = form.horaFin
    const ubicacion = (form.ubicacion ?? '').trim()
    const formaPago = form.formaPago
    const fotografoId = form.fotografoId

    if (!nombre || !telefono || !correo || !paqueteId || !fechaReserva || !horaInicio || !horaFin || !ubicacion || !formaPago || !fotografoId) {
      setError('Por favor completa todos los campos antes de enviar la reserva.')
      return
    }

    const minutosInicio = horaATotalMinutos(horaInicio)
    const minutosFin = horaATotalMinutos(horaFin)

    if (minutosInicio === null || minutosFin === null || minutosInicio >= minutosFin) {
      setError('La hora de fin debe ser posterior a la hora de inicio.')
      return
    }

    if (disponibilidadFotografos[fotografoId] === false) {
      setError('El fotógrafo seleccionado no está disponible en ese horario.')
      return
    }

    try {
      setEnviando(true)

      const { data: clienteExistente, error: clienteSelectError } = await supabase
        .from('cliente')
        .select('idcliente')
        .eq('idusuario', user.id)
        .maybeSingle()

      if (clienteSelectError) {
        console.error('No se pudo verificar el registro de cliente', clienteSelectError)
        setError('No pudimos validar tu cuenta en este momento. Intenta nuevamente más tarde.')
        return
      }

      if (!clienteExistente) {
        const { error: crearClienteError } = await supabase
          .from('cliente')
          .insert([
            {
              idusuario: user.id,
              Descuento: 0
            }
          ])

        if (crearClienteError) {
          console.error('No se pudo registrar al cliente', crearClienteError)
          setError('No pudimos registrar tus datos en este momento. Intenta nuevamente más tarde.')
          return
        }
      }

      const fotografoSeleccionado = fotografos.find(f => String(f.id) === String(fotografoId))

      if (!fotografoSeleccionado) {
        setError('No pudimos validar el fotógrafo seleccionado. Intenta de nuevo.')
        return
      }

      const { data: agendaExistente, error: agendaExistenteError } = await supabase
        .from('agenda')
        .select('id, horainicio, horafin, disponible')
        .eq('fecha', fechaReserva)
        .eq('idfotografo', Number(fotografoId))

      if (agendaExistenteError) {
        console.error('No se pudo validar la disponibilidad del fotógrafo', agendaExistenteError)
        setError('No pudimos confirmar la disponibilidad del fotógrafo seleccionado. Intenta nuevamente más tarde.')
        return
      }

      const hayConflicto = (agendaExistente ?? []).some(slot => {
        if (slot.disponible === false) {
          const inicioAgenda = horaATotalMinutos(slot.horainicio)
          const finAgenda = horaATotalMinutos(slot.horafin)
          return inicioAgenda !== null && finAgenda !== null && inicioAgenda < minutosFin && minutosInicio < finAgenda
        }
        return false
      })

      if (hayConflicto) {
        setError('El fotógrafo seleccionado ya tiene una reserva en ese horario. Elige otro horario o profesional.')
        return
      }

      const agendaPayload = {
        idfotografo: Number(fotografoId),
        fecha: fechaReserva,
        horainicio: `${horaInicio}:00`,
        horafin: `${horaFin}:00`,
        disponible: false
      }

      const { data: agendaData, error: agendaError } = await supabase
        .from('agenda')
        .insert([agendaPayload])
        .select('id')
        .single()

      if (agendaError || !agendaData) {
        console.error('No se pudo crear la agenda para la actividad', agendaError)
        setError('No pudimos registrar tu reserva. Intenta nuevamente más tarde.')
        return
      }

      const paqueteSeleccionado = paquetes.find(p => String(p.id) === String(paqueteId))
      const nombreActividad = paqueteSeleccionado
        ? `${paqueteSeleccionado.nombre_paquete} - ${nombre}`
        : nombre

      const { data: actividadData, error: actividadError } = await supabase
        .from('actividad')
        .insert([
          {
            idcliente: user.id,
            idagenda: agendaData.id,
            idpaquete: Number(paqueteId),
            estado_pago: 'Pendiente',
            nombre_actividad: nombreActividad,
            ubicacion
          }
        ])
        .select('id')
        .single()

      if (actividadError || !actividadData) {
        console.error('No se pudo registrar la actividad', actividadError)
        setError('No pudimos registrar tu reserva. Intenta nuevamente más tarde.')
      } else {
        const paqueteSeleccionadoPago = paquetes.find(p => String(p.id) === String(paqueteId))
        const montoReserva = paqueteSeleccionadoPago?.precio ?? null

        const { error: pagoError } = await supabase
          .from('pago')
          .insert([
            {
              idactividad: actividadData.id,
              metodo_pago: formaPago,
              monto: montoReserva ?? 0,
              detalle_pago: 'Pago pendiente registrado desde el panel web'
            }
          ])

        if (pagoError) {
          console.error('No se pudo registrar el pago pendiente', pagoError)
          setMensaje(`Reserva enviada con éxito, pero no pudimos registrar el pago. Nuestro equipo se pondrá en contacto contigo ✅ | Fotógrafo asignado: ${fotografoSeleccionado.username}`)
        } else {
          setMensaje(`Reserva enviada con éxito ✅ | Fotógrafo asignado: ${fotografoSeleccionado.username}`)
        }
        setForm({
          ...initialForm,
          nombre,
          telefono,
          correo
        })
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="container-1120 py-6">
      <h2 className="text-2xl font-display mb-4">Reservar sesión</h2>
      {!user && (
        <div className="mb-4 rounded-xl2 border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900">
          Debes iniciar sesión o registrarte para completar una reserva.
        </div>
      )}
      <form onSubmit={handleSubmit} className="card p-4 grid gap-3 max-w-3xl">
        <input
          placeholder="Nombre"
          value={form.nombre}
          onChange={e => updateField('nombre', e.target.value)}
          className="border rounded-xl2 px-3 py-2"
          disabled={!user || enviando}
        />
        <input
          placeholder="Teléfono"
          value={form.telefono}
          onChange={e => updateField('telefono', e.target.value)}
          className="border rounded-xl2 px-3 py-2"
          disabled={!user || enviando}
        />
        <input
          placeholder="Correo electrónico"
          value={form.correo}
          onChange={e => updateField('correo', e.target.value)}
          className="border rounded-xl2 px-3 py-2"
          disabled={!user || enviando}
        />
        <select
          value={form.paqueteId}
          onChange={e => updateField('paqueteId', e.target.value)}
          className="border rounded-xl2 px-3 py-2"
          disabled={!user || enviando}
        >
          <option value="">Selecciona un paquete disponible</option>
          {paquetes.map(paquete => (
            <option key={paquete.id} value={paquete.id}>
              {paquete.nombre_paquete}
              {paquete.precio != null ? ` - $${paquete.precio}` : ''}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={form.fecha}
          onChange={e => updateField('fecha', e.target.value)}
          className="border rounded-xl2 px-3 py-2"
          disabled={!user || enviando}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            type="time"
            value={form.horaInicio}
            onChange={e => updateField('horaInicio', e.target.value)}
            className="border rounded-xl2 px-3 py-2"
            disabled={!user || enviando}
          />
          <input
            type="time"
            value={form.horaFin}
            onChange={e => updateField('horaFin', e.target.value)}
            className="border rounded-xl2 px-3 py-2"
            disabled={!user || enviando}
          />
        </div>
        <input
          placeholder="Ubicación del servicio"
          value={form.ubicacion}
          onChange={e => updateField('ubicacion', e.target.value)}
          className="border rounded-xl2 px-3 py-2"
          disabled={!user || enviando}
        />
        <select
          value={form.formaPago}
          onChange={e => updateField('formaPago', e.target.value)}
          className="border rounded-xl2 px-3 py-2"
          disabled={!user || enviando}
        >
          <option value="">Selecciona la forma de pago</option>
          <option value="Transferencia">Transferencia</option>
          <option value="Tarjeta">Tarjeta</option>
          <option value="Efectivo">Efectivo</option>
        </select>
        <select
          value={form.fotografoId}
          onChange={e => updateField('fotografoId', e.target.value)}
          className="border rounded-xl2 px-3 py-2"
          disabled={!user || enviando || fotografos.length === 0}
        >
          <option value="">Selecciona un fotógrafo disponible</option>
          {fotografos.map(fotografo => {
            const tieneDato = Object.prototype.hasOwnProperty.call(disponibilidadFotografos, fotografo.id)
            const disponible = tieneDato ? disponibilidadFotografos[fotografo.id] : null
            const etiquetaDisponibilidad = disponible === null
              ? 'Selecciona fecha y horario'
              : disponible
                ? 'Disponible'
                : 'No disponible'
            return (
              <option key={fotografo.id} value={fotografo.id} disabled={disponible === false}>
                {fotografo.username} ({etiquetaDisponibilidad})
              </option>
            )
          })}
        </select>
        {form.fecha && form.horaInicio && form.horaFin && fotografos.length > 0 && Object.keys(disponibilidadFotografos).length > 0 &&
          !Object.values(disponibilidadFotografos).some(valor => valor) && (
            <p className="text-sm text-red-600">No hay fotógrafos disponibles para el horario seleccionado.</p>
          )}
        <button className="btn btn-primary" disabled={!user || enviando}>
          {enviando ? 'Enviando…' : 'Enviar'}
        </button>
      </form>
      {error && <p className="mt-2 text-red-600 text-sm">{error}</p>}
      {mensaje && <p className="mt-2 text-green-600">{mensaje}</p>}
    </div>
  )
}
