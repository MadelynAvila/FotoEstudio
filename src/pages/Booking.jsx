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

const MIN_BUFFER_MINUTES = 60

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

  useEffect(() => {
    try {
      const paqueteGuardadoRaw = localStorage.getItem('paqueteSeleccionado')
      if (!paqueteGuardadoRaw) return
      const paqueteGuardado = JSON.parse(paqueteGuardadoRaw)
      if (paqueteGuardado?.id != null && paqueteGuardado.id !== '') {
        setForm(prev => ({
          ...prev,
          paqueteId: String(paqueteGuardado.id)
        }))
      }
    } catch (storageError) {
      console.error('No se pudo recuperar el paquete seleccionado', storageError)
    }
  }, [])

  /** Cargar paquetes */
  useEffect(() => {
    const loadPaquetes = async () => {
      const { data, error: paquetesError } = await supabase
        .from('paquete')
        .select(
          `
            id,
            nombre_paquete,
            precio,
            tipo_evento(nombre_evento)
          `
        )
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
        mapaAgenda[fotografo.id] = null
      })

      ;(agendas ?? []).forEach(slot => {
        if (!agendasPorFotografo.has(slot.idfotografo)) {
          agendasPorFotografo.set(slot.idfotografo, [])
        }
        agendasPorFotografo.get(slot.idfotografo).push(slot)
      })

      fotografosList.forEach(fotografo => {
        const sesionesFotografo = agendasPorFotografo.get(fotografo.id) ?? []

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

        if (hayConflicto) {
          mapaDisponibilidad[fotografo.id] = false
          mapaAgenda[fotografo.id] = null
          return
        }

        mapaDisponibilidad[fotografo.id] = true
        mapaAgenda[fotografo.id] = {
          tipo: 'nuevo',
          fecha: fechaSeleccionada,
          horainicio: horaInicioSQL,
          horafin: horaFinSQL
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

    const {
      nombre,
      telefono,
      correo,
      paqueteId,
      fecha,
      horaInicio,
      horaFin,
      ubicacion,
      formaPago,
      fotografoId
    } = form

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
      const detalleAgenda = agendaDisponiblePorFotografo[fotografoId]
      if (detalleAgenda === null) {
        setError('El horario seleccionado está demasiado cerca de otra sesión.')
      } else {
        setError('El fotógrafo seleccionado no está disponible en ese horario.')
      }
      return
    }

    try {
      setEnviando(true)

      const { data: clienteExistente, error: clienteExistenteError } = await supabase
        .from('cliente')
        .select('idcliente')
        .eq('idusuario', user.id)
        .maybeSingle()

      if (clienteExistenteError && clienteExistenteError.code !== 'PGRST116') {
        setError('No fue posible validar la información del cliente.')
        return
      }

      if (!clienteExistente?.idcliente) {
        const { error: nuevoClienteError } = await supabase
          .from('cliente')
          .insert([{ idusuario: user.id, Descuento: 0 }])
          .select('idcliente')
          .single()

        if (nuevoClienteError) {
          setError('No fue posible registrar la información del cliente.')
          return
        }
      }

      const horaInicioSQL = formatearHoraSQL(horaInicio)
      const horaFinSQL = formatearHoraSQL(horaFin)
      if (!horaInicioSQL || !horaFinSQL) {
        setError('Selecciona un horario válido para continuar.')
        return
      }

      const { data: sesionesFotografo, error: sesionesError } = await supabase
        .from('agenda')
        .select('id, horainicio, horafin')
        .eq('idfotografo', Number(fotografoId))
        .eq('fecha', fechaSeleccionada)

      if (sesionesError) {
        setError('No fue posible validar la agenda del fotógrafo.')
        return
      }

      const conflicto = (sesionesFotografo ?? []).some(sesion => {
        const iniSesion = horaATotalMinutos(sesion.horainicio)
        const finSesion = horaATotalMinutos(sesion.horafin)
        if (iniSesion === null || finSesion === null) return false

        const seSuperponen = minutosFin > iniSesion && minutosInicio < finSesion
        if (seSuperponen) return true

        const diferenciaAnterior = minutosInicio - finSesion
        if (diferenciaAnterior >= 0 && diferenciaAnterior < MIN_BUFFER_MINUTES) return true

        const diferenciaPosterior = iniSesion - minutosFin
        if (diferenciaPosterior >= 0 && diferenciaPosterior < MIN_BUFFER_MINUTES) return true

        return false
      })

      if (conflicto) {
        setError('El horario seleccionado está demasiado cerca de otra sesión.')
        return
      }

      const { data: nuevaAgenda, error: nuevaAgendaError } = await supabase
        .from('agenda')
        .insert([
          {
            fecha: fechaSeleccionada,
            horainicio: horaInicioSQL,
            horafin: horaFinSQL,
            disponible: false,
            idfotografo: Number(fotografoId)
          }
        ])
        .select('id')
        .single()

      if (nuevaAgendaError || !nuevaAgenda?.id) {
        setError('Error creando la agenda de la reserva.')
        return
      }

      const agendaId = nuevaAgenda.id

      const paqueteSel = paquetes.find(
        p => String(p.id) === String(paqueteId) || String(p.id) === String(paqueteId?.id)
      )
      const paqueteIdFinal = paqueteSel?.id ?? (typeof paqueteId === 'object' ? paqueteId.id : paqueteId)
      const paqueteIdNumerico = paqueteIdFinal != null && paqueteIdFinal !== '' ? Number(paqueteIdFinal) : null
      const nombreActividad = paqueteSel ? `${paqueteSel.nombre_paquete} - ${nombre}` : nombre

      if (!agendaId) {
        setError('No se pudo registrar la agenda de la reserva.')
        return
      }

      if (!user?.id) {
        setError('No fue posible identificar al usuario autenticado. Inicia sesión nuevamente.')
        return
      }

      if (paqueteIdNumerico == null || Number.isNaN(paqueteIdNumerico)) {
        setError('Selecciona un paquete válido para continuar con la reserva.')
        return
      }

      const { data: actividadCreada, error: actividadError } = await supabase
        .from('actividad')
        .insert([
          {
            idusuario: user.id,
            idagenda: agendaId,
            idpaquete: paqueteIdNumerico,
            estado_pago: 'Pendiente',
            nombre_actividad: nombreActividad,
            ubicacion
          }
        ])
        .select()

      if (actividadError?.status === 409) {
        console.error('Error de conflicto al crear actividad:', actividadError.message)
      }

      const actividadGenerada = actividadCreada?.[0] ?? null

      if (actividadError || !actividadGenerada?.id) {
        setError('No fue posible crear la actividad de la reserva.')
        return
      }

      const montoReserva = paqueteSel?.precio ?? 0
      await supabase.from('pago').insert([
        {
          idactividad: actividadGenerada.id,
          metodo_pago: formaPago,
          monto: montoReserva,
          detalle_pago: 'Pago pendiente registrado desde el panel web'
        }
      ])

      setMensaje('Reserva creada correctamente.')
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
      ? 'border-emerald-300 bg-emerald-50/80 text-emerald-800'
      : estadoFotografo === 'alert'
        ? 'border-red-300 bg-red-50/80 text-red-700'
        : 'border-[color:var(--border)] bg-white/70 text-slate-600'

  const inputClass = 'w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-umber/30 transition disabled:opacity-50 disabled:cursor-not-allowed'

  return (
    <section className="page-section">
      <div className="section-shell">
        <div className="section-heading max-w-2xl">
          <span className="section-eyebrow">Reservas</span>
          <h1 className="text-3xl md:text-4xl">Agenda tu experiencia fotográfica</h1>
          <p className="section-subtitle">
            Elige el paquete ideal, indica tu disponibilidad y nosotros nos encargamos del resto. Nuestro equipo confirmará tu fecha cuanto antes.
          </p>
        </div>

        {!user && (
          <div className="rounded-3xl border border-amber-300 bg-amber-50/80 px-6 py-4 text-sm text-amber-900">
            Debes iniciar sesión o registrarte para completar una reserva.
          </div>
        )}

        <form onSubmit={handleSubmit} className="card max-w-3xl">
          <div className="card-body grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <input placeholder="Nombre" value={form.nombre} onChange={e => updateField('nombre', e.target.value)} className={inputClass} disabled={!user || enviando} />
              <input placeholder="Teléfono" value={form.telefono} onChange={e => updateField('telefono', e.target.value)} className={inputClass} disabled={!user || enviando} />
            </div>
            <input placeholder="Correo electrónico" value={form.correo} onChange={e => updateField('correo', e.target.value)} className={inputClass} disabled={!user || enviando} />
            <select
              value={form.paqueteId}
              onChange={e => updateField('paqueteId', e.target.value)}
              className={inputClass}
              disabled={!user || enviando}
            >
              <option value="">Selecciona un paquete</option>
              {paquetes.map(p => {
                const precioFormateado =
                  p.precio != null ? `Q${Number(p.precio).toLocaleString('es-GT')}` : ''
                const nombreEvento = p.tipo_evento?.nombre_evento
                return (
                  <option key={p.id} value={p.id}>
                    {nombreEvento ? `${nombreEvento} – ` : ''}
                    {p.nombre_paquete}
                    {precioFormateado ? ` – ${precioFormateado}` : ''}
                  </option>
                )
              })}
            </select>

            <div className="grid gap-4 md:grid-cols-2">
              <input
                type="date"
                value={form.fecha}
                onChange={e => updateField('fecha', e.target.value)}
                className={inputClass}
                disabled={!user || enviando}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <input
                  type="time"
                  value={form.horaInicio}
                  onChange={e => updateField('horaInicio', e.target.value)}
                  className={inputClass}
                  disabled={!user || enviando}
                />
                <input
                  type="time"
                  value={form.horaFin}
                  onChange={e => updateField('horaFin', e.target.value)}
                  className={inputClass}
                  disabled={!user || enviando}
                />
              </div>
            </div>

            <input
              placeholder="Ubicación del servicio"
              value={form.ubicacion}
              onChange={e => updateField('ubicacion', e.target.value)}
              className={inputClass}
              disabled={!user || enviando}
            />

            <select
              value={form.formaPago}
              onChange={e => updateField('formaPago', e.target.value)}
              className={inputClass}
              disabled={!user || enviando}
            >
              <option value="">Selecciona la forma de pago</option>
              <option value="Transferencia">Transferencia</option>
              <option value="Tarjeta">Tarjeta</option>
              <option value="Efectivo">Efectivo</option>
            </select>

            <div
              className={`rounded-2xl border px-4 py-3 text-sm ${fotografoMessageClass}`}
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

            <div className="flex flex-wrap items-center gap-3">
              <button
                className="btn btn-primary"
                disabled={!user || enviando}
              >
                {enviando ? 'Enviando…' : 'Enviar solicitud'}
              </button>
              {mensaje && <span className="text-sm text-emerald-700">{mensaje}</span>}
            </div>
          </div>
        </form>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </section>
  )
}

          
          