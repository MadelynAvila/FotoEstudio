import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/authContext'
import { supabase } from '../lib/supabaseClient'

/** Convierte una hora (HH:mm) a minutos totales */
const horaATotalMinutos = (hora) => {
  if (!hora) return null
  const [horas, minutos] = hora.split(':')
  const h = Number(horas)
  const m = Number(minutos ?? 0)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return h * 60 + m
}

/** Convierte una hora a formato HH:MM:SS */
const formatearHoraSQL = (hora) => {
  if (!hora) return null
  const [horas, minutos] = hora.split(':')
  const h = Number(horas)
  const m = Number(minutos ?? 0)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  const hh = String(h).padStart(2, '0')
  const mm = String(m).padStart(2, '0')
  return `${hh}:${mm}:00`
}

/** Normaliza fecha para que siempre quede en formato YYYY-MM-DD */
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

/** Obtiene el rango UTC de un día (inicio y fin ISO) */
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

  const fotografosList = useMemo(() => (Array.isArray(fotografos) ? fotografos : []), [fotografos])

  /** Cargar paquetes */
  useEffect(() => {
    const loadPaquetes = async () => {
      const { data, error: paquetesError } = await supabase
        .from('paquete')
        .select('id, nombre_paquete, precio')
        .order('nombre_paquete', { ascending: true })
      if (paquetesError) console.error('No se pudieron cargar los paquetes', paquetesError)
      else setPaquetes(data ?? [])
    }
    loadPaquetes()
  }, [])

  /** Cargar fotógrafos */
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

  /** Rellenar automáticamente datos del usuario */
  useEffect(() => {
    if (user && !prefilled) {
      setForm(prev => ({
        ...prev,
        nombre: user.name ?? user.nombre ?? user.username ?? prev.nombre,
        telefono: user.telefono ?? user.phone ?? prev.telefono,
        correo: user.correo ?? user.email ?? prev.correo
      }))
      setPrefilled(true)
    }
    if (!user && prefilled) {
      setForm(initialForm)
      setPrefilled(false)
    }
  }, [user, prefilled])

  const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  /** Evaluar disponibilidad de fotógrafos */
  useEffect(() => {
    let cancelado = false

    const evaluarDisponibilidad = async () => {
      if (!form.fecha || !form.horaInicio || !form.horaFin || fotografosList.length === 0) {
        setDisponibilidadFotografos({})
        setAgendaDisponiblePorFotografo({})
        return
      }

      const fechaSeleccionada = normalizarFechaInput(form.fecha)
      if (!fechaSeleccionada) {
        setDisponibilidadFotografos({})
        setAgendaDisponiblePorFotografo({})
        return
      }

      const horaInicioSQL = formatearHoraSQL(form.horaInicio)
      const horaFinSQL = formatearHoraSQL(form.horaFin)
      if (!horaInicioSQL || !horaFinSQL) {
        setDisponibilidadFotografos({})
        setAgendaDisponiblePorFotografo({})
        return
      }

      const inicioCliente = horaATotalMinutos(horaInicioSQL)
      const finCliente = horaATotalMinutos(horaFinSQL)
      if (inicioCliente === null || finCliente === null || inicioCliente >= finCliente) {
        setDisponibilidadFotografos({})
        setAgendaDisponiblePorFotografo({})
        return
      }

      const idsFotografos = fotografosList.map(f => f.id)
      if (!idsFotografos.length) {
        setDisponibilidadFotografos({})
        setAgendaDisponiblePorFotografo({})
        return
      }

      const { data: agendas, error: agendaError } = await supabase
        .from('agenda')
        .select('id, idfotografo, fecha, horainicio, horafin, disponible')
        .in('idfotografo', idsFotografos)
        .eq('fecha', fechaSeleccionada)

      if (agendaError) {
        console.error('Error al consultar agenda:', agendaError)
        setDisponibilidadFotografos({})
        setAgendaDisponiblePorFotografo({})
        return
      }

      const mapaDisponibilidad = {}
      const mapaAgenda = {}
      const agendasPorFotografo = new Map()

      fotografosList.forEach(fotografo => {
        mapaDisponibilidad[fotografo.id] = false
      })

      ;(agendas ?? []).forEach(slot => {
        if (!agendasPorFotografo.has(slot.idfotografo)) {
          agendasPorFotografo.set(slot.idfotografo, [])
        }
        agendasPorFotografo.get(slot.idfotografo).push(slot)
      })

      const MIN_BUFFER_MINUTES = 60

      ;(agendas ?? []).forEach(slot => {
        if (slot.disponible !== true) return
        if (mapaDisponibilidad[slot.idfotografo]) return

        const ini = horaATotalMinutos(slot.horainicio)
        const fin = horaATotalMinutos(slot.horafin)
        if (ini === null || fin === null) return
        if (!(ini <= inicioCliente && finCliente <= fin)) return

        const sesionesFotografo = (agendasPorFotografo.get(slot.idfotografo) ?? []).filter(
          sesion => sesion.id !== slot.id && sesion.disponible !== true
        )

        const hayConflicto = sesionesFotografo.some(sesion => {
          const iniSesion = horaATotalMinutos(sesion.horainicio)
          const finSesion = horaATotalMinutos(sesion.horafin)
          if (iniSesion === null || finSesion === null) return false

          const seSuperponen = finCliente > iniSesion && inicioCliente < finSesion
          if (seSuperponen) return true

          const diferenciaAnterior = inicioCliente - finSesion
          if (diferenciaAnterior >= 0 && diferenciaAnterior < MIN_BUFFER_MINUTES) return true

          const diferenciaPosterior = iniSesion - finCliente
          if (diferenciaPosterior >= 0 && diferenciaPosterior < MIN_BUFFER_MINUTES) return true

          return false
        })

        if (!hayConflicto) {
          mapaDisponibilidad[slot.idfotografo] = true
          mapaAgenda[slot.idfotografo] = slot.id
        }
      })

      if (cancelado) return
      setDisponibilidadFotografos(mapaDisponibilidad)
      setAgendaDisponiblePorFotografo(mapaAgenda)
    }

    evaluarDisponibilidad()
    return () => { cancelado = true }
  }, [form.fecha, form.horaInicio, form.horaFin, fotografosList])

  /** Asignar fotógrafo automáticamente */
  useEffect(() => {
    setForm(prev => {
      if (fotografosList.length === 0) return { ...prev, fotografoId: '' }
      const disponible = Object.entries(disponibilidadFotografos).find(([, v]) => v)
      const nuevoId = disponible ? String(disponible[0]) : ''
      return prev.fotografoId === nuevoId ? prev : { ...prev, fotografoId: nuevoId }
    })
  }, [disponibilidadFotografos, fotografosList])

  /** Envío del formulario */
  const handleSubmit = async e => {
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

    const fechaSeleccionada = normalizarFechaInput(fecha)
    const rangoDiaSeleccionado = obtenerRangoDiaUTC(fechaSeleccionada)
    if (!fechaSeleccionada || !rangoDiaSeleccionado) {
      setError('Selecciona una fecha válida para continuar con la reserva.')
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

      const { data: clienteExistente } = await supabase
        .from('cliente')
        .select('idcliente')
        .eq('idusuario', user.id)
        .maybeSingle()

      let clienteId = clienteExistente?.idcliente ?? null
      if (!clienteId) {
        const { data: nuevoCliente } = await supabase
          .from('cliente')
          .insert([{ idusuario: user.id, Descuento: 0 }])
          .select('idcliente')
          .single()
        clienteId = nuevoCliente.idcliente
      }

      const agendaIdSeleccionada = agendaDisponiblePorFotografo[fotografoId]
      if (!agendaIdSeleccionada) {
        setError('El horario seleccionado ya no está disponible.')
        return
      }

      const { data: agendaSeleccionada, error: agendaError } = await supabase
        .from('agenda')
        .select('id, disponible, fecha, horainicio, horafin, idfotografo')
        .eq('id', agendaIdSeleccionada)
        .maybeSingle()

      if (agendaError || !agendaSeleccionada) {
        setError('No fue posible validar la disponibilidad. Intenta nuevamente.')
        return
      }

      const fechaAgenda = normalizarFechaInput(agendaSeleccionada.fecha)
      if (fechaAgenda !== fechaSeleccionada) {
        setError('El horario seleccionado no coincide con la fecha indicada.')
        return
      }

      const inicioAgenda = horaATotalMinutos(agendaSeleccionada.horainicio)
      const finAgenda = horaATotalMinutos(agendaSeleccionada.horafin)
      if (inicioAgenda === null || finAgenda === null || inicioAgenda > minutosInicio || finAgenda < minutosFin) {
        setError('El horario seleccionado ya no coincide con la agenda disponible.')
        return
      }

      if (!agendaSeleccionada.disponible) {
        setError('El horario elegido ya fue reservado.')
        return
      }

      await supabase
        .from('agenda')
        .update({ disponible: false })
        .eq('id', agendaSeleccionada.id)
        .eq('idfotografo', Number(fotografoId))
        .eq('fecha', fechaSeleccionada)

      const paqueteSel = paquetes.find(p => String(p.id) === String(paqueteId))
      const nombreActividad = paqueteSel ? `${paqueteSel.nombre_paquete} - ${nombre}` : nombre

      const { data: actividadData } = await supabase
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

      const montoReserva = paqueteSel?.precio ?? 0
      await supabase.from('pago').insert([
        {
          idactividad: actividadData.id,
          metodo_pago: formaPago,
          monto: montoReserva,
          detalle_pago: 'Pago pendiente registrado desde el panel web'
        }
      ])

      setMensaje('Reserva enviada con éxito ✅')
      setForm({ ...initialForm, nombre, telefono, correo })
    } finally {
      setEnviando(false)
    }
  }

  /** Mensaje dinámico */
  const hayFotografos = fotografosList.length > 0
  const horarioCompleto = Boolean(form.fecha && form.horaInicio && form.horaFin)
  const hayDisponibilidad = Object.keys(disponibilidadFotografos).length > 0
  const fotografoAsignado = form.fotografoId
    ? fotografosList.find(f => String(f.id) === String(form.fotografoId))
    : null
  const totalDisponibles = Object.values(disponibilidadFotografos).filter(Boolean).length

  let mensajeFotografo = ''
  let estadoFotografo = 'neutral'

  if (!hayFotografos) {
    mensajeFotografo = 'No hay fotógrafos registrados actualmente.'
    estadoFotografo = 'alert'
  } else if (!horarioCompleto) {
    mensajeFotografo = 'Selecciona una fecha y horario para revisar disponibilidad.'
  } else if (!hayDisponibilidad) {
    mensajeFotografo = 'Consultando disponibilidad…'
  } else if (fotografoAsignado) {
    mensajeFotografo = `Fotógrafo disponible: ${fotografoAsignado.username}.`
    estadoFotografo = 'success'
  } else if (hayDisponibilidad && totalDisponibles > 0) {
    mensajeFotografo = 'Hay fotógrafos disponibles. Completa el formulario para continuar.'
    estadoFotografo = 'success'
  } else {
    mensajeFotografo = 'No hay fotógrafos disponibles'
    estadoFotografo = 'alert'
  }

  const fotografoMessageClass =
    estadoFotografo === 'success'
      ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
      : estadoFotografo === 'alert'
        ? 'border-red-300 bg-red-50 text-red-700'
        : 'border-[var(--border)] bg-sand/40 text-slate-600'

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
                <select
          value={form.paqueteId}
          onChange={e => updateField('paqueteId', e.target.value)}
          className="border rounded-xl2 px-3 py-2"
          disabled={!user || enviando}
        >
          <option value="">Selecciona un paquete</option>
          {paquetes.map(p => (
            <option key={p.id} value={p.id}>
              {p.nombre_paquete} {p.precio != null ? `- $${p.precio}` : ''}
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

        <div
          className={`rounded-xl2 border px-3 py-2 text-sm ${fotografoMessageClass}`}
        >
          <span
            className={
              estadoFotografo === 'success'
                ? 'block text-xs font-semibold uppercase tracking-wide mb-1 text-emerald-700'
                : estadoFotografo === 'alert'
                  ? 'block text-xs font-semibold uppercase tracking-wide mb-1 text-red-700'
                  : 'block text-xs font-semibold uppercase tracking-wide mb-1 text-slate-500'
            }
          >
            Fotógrafo
          </span>
          <span>{mensajeFotografo}</span>
          {estadoFotografo === 'success' && totalDisponibles > 0 && (
            <ul className="mt-2 list-disc list-inside space-y-1 text-xs text-slate-600">
              {fotografosList
                .filter(f => disponibilidadFotografos[f.id])
                .map(f => (
                  <li key={f.id}>{f.username}</li>
                ))}
            </ul>
          )}
        </div>

        <button
          className="btn btn-primary"
          disabled={!user || enviando}
        >
          {enviando ? 'Enviando…' : 'Enviar'}
        </button>
      </form>

      {error && <p className="mt-2 text-red-600 text-sm">{error}</p>}
      {mensaje && <p className="mt-2 text-green-600">{mensaje}</p>}
    </div>
  )
}

          
          