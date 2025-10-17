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

const normalizarFechaInput = (valor) => {
  if (!valor) return ''
  if (valor instanceof Date) {
    return valor.toISOString().slice(0, 10)
  }

  if (typeof valor === 'string') {
    const [fechaLimpia] = valor.split('T')
    return fechaLimpia ?? ''
  }

  return ''
}

const obtenerRangoDiaUTC = (fechaStr) => {
  if (!fechaStr || typeof fechaStr !== 'string') return null
  const [yearStr, monthStr, dayStr] = fechaStr.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  const day = Number(dayStr)
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return null

  const inicio = new Date(Date.UTC(year, month - 1, day))
  const fin = new Date(Date.UTC(year, month - 1, day + 1))

  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) return null

  return {
    inicio: inicio.toISOString(),
    fin: fin.toISOString()
  }
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
  const [agendaDisponiblePorFotografo, setAgendaDisponiblePorFotografo] = useState({})
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
    let cancelado = false

    const evaluarDisponibilidad = async () => {
      if (!form.fecha || !form.horaInicio || !form.horaFin || fotografosList.length === 0) {
        setDisponibilidadFotografos({})
        setAgendaDisponiblePorFotografo({})
        return
      }

      const inicioCliente = horaATotalMinutos(form.horaInicio)
      const finCliente = horaATotalMinutos(form.horaFin)

      if (inicioCliente === null || finCliente === null || inicioCliente >= finCliente) {
        setDisponibilidadFotografos({})
        setAgendaDisponiblePorFotografo({})
        return
      }

      const fechaSeleccionada = normalizarFechaInput(form.fecha)
      const rangoDia = obtenerRangoDiaUTC(fechaSeleccionada)

      if (!rangoDia) {
        setDisponibilidadFotografos({})
        setAgendaDisponiblePorFotografo({})
        return
      }

      const idsFotografos = fotografosList.map(fotografo => fotografo.id)

      if (!idsFotografos.length) {
        setDisponibilidadFotografos({})
        setAgendaDisponiblePorFotografo({})
        return
      }

      const consultaAgenda = supabase
        .from('agenda')
        .select('id, idfotografo, fecha, horainicio, horafin, disponible')
        .in('idfotografo', idsFotografos)
        .gte('fecha', rangoDia.inicio)
        .lt('fecha', rangoDia.fin)

      const { data: agendas, error: agendaError } = await consultaAgenda

      if (agendaError) {
        console.error('No se pudo consultar la disponibilidad de fotógrafos', agendaError)
        setDisponibilidadFotografos({})
        setAgendaDisponiblePorFotografo({})
        return
      }

      const mapaDisponibilidad = {}
      const mapaAgendaDisponible = {}
      const agendasPorFotografo = new Map()
      const listaAgendas = Array.isArray(agendas) ? agendas : []

      listaAgendas.forEach(slot => {
        const fechaSlot = normalizarFechaInput(slot.fecha)
        if (fechaSlot !== fechaSeleccionada) {
          return
        }
        if (!agendasPorFotografo.has(slot.idfotografo)) {
          agendasPorFotografo.set(slot.idfotografo, [])
        }
        agendasPorFotografo.get(slot.idfotografo).push(slot)
      })

      fotografosList.forEach(fotografo => {
        const slots = agendasPorFotografo.get(fotografo.id) ?? []
        const bloquesDisponibles = slots.filter(slot => slot.disponible === true)
        const bloquesNoDisponibles = slots.filter(slot => slot.disponible === false)

        const bloqueCompatible = bloquesDisponibles.find(slot => {
          const inicioAgenda = horaATotalMinutos(slot.horainicio)
          const finAgenda = horaATotalMinutos(slot.horafin)
          if (inicioAgenda === null || finAgenda === null) return false
          return inicioAgenda <= inicioCliente && finCliente <= finAgenda
        })

        if (!bloqueCompatible) {
          mapaDisponibilidad[fotografo.id] = false
          return
        }

        const tieneConflictos = bloquesNoDisponibles.some(slot => {
          const inicioAgenda = horaATotalMinutos(slot.horainicio)
          const finAgenda = horaATotalMinutos(slot.horafin)
          if (inicioAgenda === null || finAgenda === null) return false
          return inicioAgenda < finCliente && inicioCliente < finAgenda
        })

        if (tieneConflictos) {
          mapaDisponibilidad[fotografo.id] = false
          return
        }

        mapaDisponibilidad[fotografo.id] = true
        mapaAgendaDisponible[fotografo.id] = bloqueCompatible.id
      })

      if (cancelado) return

      setDisponibilidadFotografos(mapaDisponibilidad)
      setAgendaDisponiblePorFotografo(mapaAgendaDisponible)
    }

    evaluarDisponibilidad()

    return () => {
      cancelado = true
    }
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

      const agendaIdSeleccionada = agendaDisponiblePorFotografo[fotografoId]

      if (!agendaIdSeleccionada) {
        setError('El horario seleccionado ya no está disponible. Elige otra franja horaria.')
        return
      }

      const { data: agendaSeleccionada, error: agendaSeleccionadaError } = await supabase
        .from('agenda')
        .select('id, disponible, fecha, horainicio, horafin, idfotografo')
        .eq('id', agendaIdSeleccionada)
        .maybeSingle()

      if (agendaSeleccionadaError || !agendaSeleccionada) {
        console.error('No se pudo validar la agenda seleccionada', agendaSeleccionadaError)
        setError('No fue posible validar la disponibilidad. Intenta nuevamente.')
        return
      }

      const fechaAgenda = normalizarFechaInput(agendaSeleccionada.fecha)
      if (fechaAgenda !== fecha) {
        setError('El horario seleccionado no coincide con la fecha indicada. Actualiza la información e inténtalo de nuevo.')
        return
      }

      if (Number(agendaSeleccionada.idfotografo) !== Number(fotografoId)) {
        setError('El horario seleccionado no pertenece al fotógrafo elegido. Selecciona nuevamente el horario disponible.')
        return
      }

      const inicioAgendaSeleccionada = horaATotalMinutos(agendaSeleccionada.horainicio)
      const finAgendaSeleccionada = horaATotalMinutos(agendaSeleccionada.horafin)

      if (
        inicioAgendaSeleccionada === null ||
        finAgendaSeleccionada === null ||
        inicioAgendaSeleccionada > minutosInicio ||
        finAgendaSeleccionada < minutosFin
      ) {
        setError('El horario seleccionado ya no coincide con la agenda disponible.')
        return
      }

      if (agendaSeleccionada.disponible === false) {
        setError('El horario elegido ya fue reservado. Selecciona otro disponible.')
        return
      }

      const { data: actividadExistente, error: actividadExistenteError } = await supabase
        .from('actividad')
        .select('id')
        .eq('idagenda', agendaSeleccionada.id)
        .maybeSingle()

      if (actividadExistenteError) {
        console.error('No se pudo validar si la agenda tiene una actividad asociada', actividadExistenteError)
        setError('No se pudo validar la disponibilidad actualizada. Intenta nuevamente en unos segundos.')
        return
      }

      if (actividadExistente) {
        setError('El horario ya está reservado y pendiente de confirmación. Elige otra franja horaria.')
        return
      }

      const { error: agendaUpdateError } = await supabase
        .from('agenda')
        .update({ disponible: false })
        .eq('id', agendaSeleccionada.id)
        .eq('idfotografo', Number(fotografoId))

      if (agendaUpdateError) {
        console.error('No se pudo actualizar la agenda seleccionada', agendaUpdateError)
        setError('No fue posible confirmar la agenda. Intenta nuevamente.')
        return
      }

      const paqueteSeleccionado = paquetes.find(p => String(p.id) === String(paqueteId))
      const nombreActividad = paqueteSeleccionado
        ? `${paqueteSeleccionado.nombre_paquete} - ${nombre}`
        : nombre

      const { data: actividadData, error: crearActividadError } = await supabase
        .from('actividad')
        .insert([
          {
            idcliente: clienteId,
            idagenda: agendaSeleccionada.id,
            idpaquete: Number(paqueteId),
            estado_pago: 'Pendiente',
            nombre_actividad: nombreActividad,
            ubicacion
          }
        ])
        .select('id')
        .single()

      if (crearActividadError || !actividadData) {
        console.error('No se pudo registrar la actividad', crearActividadError)
        await supabase
          .from('agenda')
          .update({ disponible: true })
          .eq('id', agendaSeleccionada.id)
          .eq('idfotografo', Number(fotografoId))
        setError('No se pudo completar la reserva. El horario se liberó para que puedas intentarlo nuevamente.')
        return
      }

      const montoReserva = paqueteSeleccionado?.precio ?? 0
      const { error: crearPagoError } = await supabase.from('pago').insert([
        {
          idactividad: actividadData.id,
          metodo_pago: formaPago,
          monto: montoReserva,
          detalle_pago: 'Pago pendiente registrado desde el panel web'
        }
      ])

      if (crearPagoError) {
        console.error('No se pudo registrar el pago pendiente', crearPagoError)
        await supabase
          .from('actividad')
          .delete()
          .eq('id', actividadData.id)
        await supabase
          .from('agenda')
          .update({ disponible: true })
          .eq('id', agendaSeleccionada.id)
          .eq('idfotografo', Number(fotografoId))
        setError('El pago pendiente no se pudo registrar. El horario vuelve a estar disponible mientras solucionamos el inconveniente.')
        return
      }

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
  const fotografosDisponibles = fotografosList.filter(f => disponibilidadFotografos[f.id])

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
          {estadoFotografo === 'success' && fotografosDisponibles.length > 0 ? (
            <ul className="mt-2 list-disc list-inside space-y-1 text-xs text-slate-600">
              {fotografosDisponibles.map(fotografo => (
                <li key={fotografo.id}>{fotografo.username}</li>
              ))}
            </ul>
          ) : null}
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


