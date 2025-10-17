import { useEffect, useMemo, useState } from 'react'
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

export default function Booking() {
  const [form, setForm] = useState(initialForm)
  const [paquetes, setPaquetes] = useState([])
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [prefilled, setPrefilled] = useState(false)
  const [fotografos, setFotografos] = useState([])
  const [disponibilidadFotografos, setDisponibilidadFotografos] = useState({})
  const { user } = useAuth()

  const fotografosList = useMemo(
    () => (Array.isArray(fotografos) ? fotografos : []),
    [fotografos]
  )

  // Cargar paquetes
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

  // Cargar fotógrafos
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

      setFotografos(Array.isArray(fotografoData) ? fotografoData : [])
    }

    loadFotografos()
  }, [])

  // Prefill de datos de usuario
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

  // Evaluar disponibilidad de fotógrafos
  useEffect(() => {
    const evaluarDisponibilidad = async () => {
      if (!form.fecha || !form.horaInicio || !form.horaFin || fotografosList.length === 0) {
        setDisponibilidadFotografos({})
        return
      }

      const inicioCliente = horaATotalMinutos(form.horaInicio)
      const finCliente = horaATotalMinutos(form.horaFin)

      if (inicioCliente === null || finCliente === null || inicioCliente >= finCliente) {
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
        if (reservado && inicioAgenda < finCliente && inicioCliente < finAgenda) {
          ocupado.add(slot.idfotografo)
        }
      })

      const mapaDisponibilidad = {}
      fotografosList.forEach(f => {
        mapaDisponibilidad[f.id] = !ocupado.has(f.id)
      })

      setDisponibilidadFotografos(mapaDisponibilidad)
    }

    evaluarDisponibilidad()
  }, [form.fecha, form.horaInicio, form.horaFin, fotografosList])

  // Actualizar fotógrafo automáticamente si hay disponible
  useEffect(() => {
    setForm(prev => {
      if (fotografosList.length === 0) {
        return prev.fotografoId ? { ...prev, fotografoId: '' } : prev
      }

      const claves = Object.keys(disponibilidadFotografos)
      if (claves.length === 0) {
        return prev.fotografoId ? { ...prev, fotografoId: '' } : prev
      }

      const disponible = Object.entries(disponibilidadFotografos).find(([, value]) => value)
      const nuevoId = disponible ? String(disponible[0]) : ''
      if (prev.fotografoId === nuevoId) {
        return prev
      }

      return { ...prev, fotografoId: nuevoId }
    })
  }, [disponibilidadFotografos, fotografosList])

  // Envío del formulario
  const handleSubmit = async (e) => {
    e.preventDefault()
    setMensaje('')
    setError('')

    if (!user) {
      setError('Debes iniciar sesión para reservar una sesión.')
      return
    }

    const { nombre, telefono, correo, paqueteId, fecha, horaInicio, horaFin, ubicacion, formaPago, fotografoId } = form

    if (!nombre || !telefono || !correo || !paqueteId || !fecha || !horaInicio || !horaFin || !ubicacion || !formaPago) {
      setError('Por favor completa todos los campos antes de enviar la reserva.')
      return
    }

    if (!fotografoId) {
      setError('No hay fotógrafos disponibles para el horario seleccionado.')
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
        console.error('No se pudo verificar el cliente', clienteSelectError)
        setError('Error validando tu cuenta. Intenta nuevamente más tarde.')
        return
      }

      let clienteId = clienteExistente?.idcliente ?? null

      if (!clienteId) {
        const { data: nuevoCliente, error: crearClienteError } = await supabase
          .from('cliente')
          .insert([{ idusuario: user.id, Descuento: 0 }])
          .select('idcliente')
          .single()

        if (crearClienteError || !nuevoCliente) {
          console.error('Error al registrar cliente', crearClienteError)
          setError('No pudimos registrar tus datos. Intenta más tarde.')
          return
        }

        clienteId = nuevoCliente.idcliente
      }

      const { data: agendaExistente } = await supabase
        .from('agenda')
        .select('id, horainicio, horafin, disponible')
        .eq('fecha', fecha)
        .eq('idfotografo', Number(fotografoId))

      const hayConflicto = (agendaExistente ?? []).some(slot => {
        if (slot.disponible === false) {
          const inicioAgenda = horaATotalMinutos(slot.horainicio)
          const finAgenda = horaATotalMinutos(slot.horafin)
          return inicioAgenda < minutosFin && minutosInicio < finAgenda
        }
        return false
      })

      if (hayConflicto) {
        setError('El fotógrafo ya tiene una reserva en ese horario.')
        return
      }

      const { data: agendaData } = await supabase
        .from('agenda')
        .insert([
          {
            idfotografo: Number(fotografoId),
            fecha,
            horainicio: `${horaInicio}:00`,
            horafin: `${horaFin}:00`,
            disponible: false
          }
        ])
        .select('id')
        .single()

      const paqueteSeleccionado = paquetes.find(p => String(p.id) === String(paqueteId))
      const nombreActividad = paqueteSeleccionado
        ? `${paqueteSeleccionado.nombre_paquete} - ${nombre}`
        : nombre

      const { data: actividadData } = await supabase
        .from('actividad')
        .insert([
          {
            idcliente: clienteId,
            idagenda: agendaData.id,
            idpaquete: Number(paqueteId),
            estado_pago: 'Pendiente',
            nombre_actividad: nombreActividad,
            ubicacion
          }
        ])
        .select('id')
        .single()

      const montoReserva = paqueteSeleccionado?.precio ?? 0
      await supabase.from('pago').insert([
        {
          idactividad: actividadData.id,
          metodo_pago: formaPago,
          monto: montoReserva,
          detalle_pago: 'Pago pendiente registrado desde el panel web'
        }
      ])

      setMensaje('Reserva enviada con éxito ✅')
      setForm({
        ...initialForm,
        nombre,
        telefono,
        correo
      })
    } finally {
      setEnviando(false)
    }
  }

  // Estado de mensaje dinámico del fotógrafo
  const hayFotografosRegistrados = fotografosList.length > 0
  const horarioCompleto = Boolean(form.fecha && form.horaInicio && form.horaFin)
  const hayDisponibilidadCalculada = Object.keys(disponibilidadFotografos).length > 0
  const fotografoAsignado = form.fotografoId
    ? fotografosList.find(f => String(f.id) === String(form.fotografoId))
    : null
  const totalDisponibles = Object.values(disponibilidadFotografos).filter(Boolean).length

  let mensajeFotografo = ''
  let estadoFotografo = 'neutral'

  if (!hayFotografosRegistrados) {
    mensajeFotografo = 'No hay fotógrafos registrados actualmente. Comunícate con el estudio para más información.'
    estadoFotografo = 'alert'
  } else if (!horarioCompleto) {
    mensajeFotografo = 'Selecciona una fecha y un horario para revisar la disponibilidad.'
  } else if (!hayDisponibilidadCalculada) {
    mensajeFotografo = 'Consultando disponibilidad…'
  } else if (fotografoAsignado) {
    mensajeFotografo = `Fotógrafo disponible: ${fotografoAsignado.username}. Se asignará automáticamente a tu reserva.`
    estadoFotografo = 'success'
  } else if (hayDisponibilidadCalculada && totalDisponibles > 0) {
    mensajeFotografo = 'Hay fotógrafos disponibles para el horario seleccionado. Completa el formulario para continuar con la reserva.'
    estadoFotografo = 'success'
  } else {
    mensajeFotografo = 'No hay fotógrafos disponibles para el horario seleccionado. Elige otro horario o contacta al estudio.'
    estadoFotografo = 'alert'
  }

  const fotografoMessageClass = estadoFotografo === 'success'
    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
    : estadoFotografo === 'alert'
      ? 'border-red-300 bg-red-50 text-red-700'
      : 'border-[var(--border)] bg-sand/40 text-slate-600'

  const fotografoLabelClass = estadoFotografo === 'success'
    ? 'block text-xs font-semibold uppercase tracking-wide mb-1 text-emerald-700'
    : estadoFotografo === 'alert'
      ? 'block text-xs font-semibold uppercase tracking-wide mb-1 text-red-700'
      : 'block text-xs font-semibold uppercase tracking-wide mb-1 text-slate-500'

  return (
    <div className="container-1120 py-6">
      <h2 className="text-2xl font-display mb-4">Reservar sesión</h2>
      {!user && (
        <div className="mb-4 border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 rounded-xl2">
          Debes iniciar sesión o registrarte para completar una reserva.
        </div>
      )}
      <form onSubmit={handleSubmit} className="card p-4 grid gap-3 max-w-3xl">
        <input placeholder="Nombre" value={form.nombre} onChange={e => updateField('nombre', e.target.value)} className="border rounded-xl2 px-3 py-2" disabled={!user || enviando} />
        <input placeholder="Teléfono" value={form.telefono} onChange={e => updateField('telefono', e.target.value)} className="border rounded-xl2 px-3 py-2" disabled={!user || enviando} />
        <input placeholder="Correo electrónico" value={form.correo} onChange={e => updateField('correo', e.target.value)} className="border rounded-xl2 px-3 py-2" disabled={!user || enviando} />
        <select value={form.paqueteId} onChange={e => updateField('paqueteId', e.target.value)} className="border rounded-xl2 px-3 py-2" disabled={!user || enviando}>
          <option value="">Selecciona un paquete disponible</option>
          {paquetes.map(paquete => (
            <option key={paquete.id} value={paquete.id}>
              {paquete.nombre_paquete} {paquete.precio != null ? `- $${paquete.precio}` : ''}
            </option>
          ))}
        </select>

        <input type="date" value={form.fecha} onChange={e => updateField('fecha', e.target.value)} className="border rounded-xl2 px-3 py-2" disabled={!user || enviando} />

        <div className="grid gap-3 sm:grid-cols-2">
          <input type="time" value={form.horaInicio} onChange={e => updateField('horaInicio', e.target.value)} className="border rounded-xl2 px-3 py-2" disabled={!user || enviando} />
          <input type="time" value={form.horaFin} onChange={e => updateField('horaFin', e.target.value)} className="border rounded-xl2 px-3 py-2" disabled={!user || enviando} />
        </div>

        <input placeholder="Ubicación del servicio" value={form.ubicacion} onChange={e => updateField('ubicacion', e.target.value)} className="border rounded-xl2 px-3 py-2" disabled={!user || enviando} />

        <select value={form.formaPago} onChange={e => updateField('formaPago', e.target.value)} className="border rounded-xl2 px-3 py-2" disabled={!user || enviando}>
          <option value="">Selecciona la forma de pago</option>
          <option value="Transferencia">Transferencia</option>
          <option value="Tarjeta">Tarjeta</option>
          <option value="Efectivo">Efectivo</option>
        </select>

        <div className={`rounded-xl2 border px-3 py-2 text-sm ${fotografoMessageClass}`}>
          <span className={fotografoLabelClass}>Fotógrafo</span>
          <span>{mensajeFotografo}</span>
        </div>

        <button className="btn btn-primary" disabled={!user || enviando}>
          {enviando ? 'Enviando…' : 'Enviar'}
        </button>
      </form>

      {error && <p className="mt-2 text-red-600 text-sm">{error}</p>}
      {mensaje && <p className="mt-2 text-green-600">{mensaje}</p>}
    </div>
  )
}


