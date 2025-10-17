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
  if (valor instanceof Date) return valor.toISOString().slice(0, 10)
  if (typeof valor === 'string') {
    const [fechaLimpia] = valor.split('T')
    return fechaLimpia ?? ''
  }
  return ''
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

  // Cargar paquetes
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
        correo: correoUsuario || prev.correo
      }))
      setPrefilled(true)
    }

    if (!user && prefilled) {
      setForm({ ...initialForm })
      setPrefilled(false)
    }
  }, [user, prefilled])

  const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

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

      const { data: agendas, error: agendaError } = await supabase
        .from('agenda')
        .select('id, idfotografo, fecha, horainicio, horafin, disponible')
        .eq('fecha', form.fecha)

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
        if (fechaSlot !== form.fecha) return
        if (!agendasPorFotografo.has(slot.idfotografo)) agendasPorFotografo.set(slot.idfotografo, [])
        agendasPorFotografo.get(slot.idfotografo).push(slot)
      })

      fotografosList.forEach(fotografo => {
        const slots = agendasPorFotografo.get(fotografo.id) ?? []
        const bloquesDisponibles = slots.filter(s => s.disponible === true)
        const bloquesNoDisponibles = slots.filter(s => s.disponible === false)

        const bloqueCompatible = bloquesDisponibles.find(s => {
          const ini = horaATotalMinutos(s.horainicio)
          const fin = horaATotalMinutos(s.horafin)
          return ini !== null && fin !== null && ini <= inicioCliente && finCliente <= fin
        })

        if (!bloqueCompatible) {
          mapaDisponibilidad[fotografo.id] = false
          return
        }

        const conflicto = bloquesNoDisponibles.some(s => {
          const ini = horaATotalMinutos(s.horainicio)
          const fin = horaATotalMinutos(s.horafin)
          return ini !== null && fin !== null && ini < finCliente && inicioCliente < fin
        })

        if (conflicto) {
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

  // Asignar fotógrafo automáticamente
  useEffect(() => {
    setForm(prev => {
      if (fotografosList.length === 0) return prev.fotografoId ? { ...prev, fotografoId: '' } : prev
      const disponible = Object.entries(disponibilidadFotografos).find(([, v]) => v)
      const nuevoId = disponible ? String(disponible[0]) : ''
      return prev.fotografoId === nuevoId ? prev : { ...prev, fotografoId: nuevoId }
    })
  }, [disponibilidadFotografos, fotografosList])

  // Envío de formulario
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

      const { data: agendaSeleccionada, error: agendaSeleccionadaError } = await supabase
        .from('agenda')
        .select('id, disponible, fecha, horainicio, horafin, idfotografo')
        .eq('id', agendaIdSeleccionada)
        .maybeSingle()

      if (agendaSeleccionadaError || !agendaSeleccionada) {
        setError('No fue posible validar la disponibilidad. Intenta nuevamente.')
        return
      }

      const fechaAgenda = normalizarFechaInput(agendaSeleccionada.fecha)
      if (fechaAgenda !== fecha) {
        setError('El horario seleccionado no coincide con la fecha indicada. Actualiza e inténtalo de nuevo.')
        return
      }

      if (Number(agendaSeleccionada.idfotografo) !== Number(fotografoId)) {
        setError('El horario seleccionado no pertenece al fotógrafo elegido.')
        return
      }

      const inicioAgenda = horaATotalMinutos(agendaSeleccionada.horainicio)
      const finAgenda = horaATotalMinutos(agendaSeleccionada.horafin)
      if (
        inicioAgenda === null ||
        finAgenda === null ||
        inicioAgenda > minutosInicio ||
        finAgenda < minutosFin
      ) {
        setError('El horario seleccionado ya no coincide con la agenda disponible.')
        return
      }

      if (agendaSeleccionada.disponible === false) {
        setError('El horario elegido ya fue reservado.')
        return
      }

      await supabase
        .from('agenda')
        .update({ disponible: false })
        .eq('id', agendaSeleccionada.id)
        .eq('idfotografo', Number(fotografoId))
        .eq('fecha', fecha)

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

  // Mensaje dinámico
  const hayFotografos = fotografosList.length > 0
  const horarioCompleto = Boolean(form.fecha && form.horaInicio && form.horaFin)
  const hayDisponibilidad = Object.keys(disponibilidadFotografos).length > 0
  const fotografoAsignado = form.fotografoId
    ? fotografosList.find(f => String(f.id) === String(form.fotografoId))
    : null
  const totalDisponibles = Object.values(disponibilidadFotografos).filter(Boolean).length
  const disponibles = fotografosList.filter(f => disponibilidadFotografos[f.id])

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
    mensajeFotografo = 'No hay fotógrafos disponibles. Elige otro horario.'
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

        <select value={form.paqueteId} onChange={e => updateField('paqueteId', e.target.value)} className="border rounded-xl2 px-3 py-2" disabled={!user || enviando}>
          <option value="">Selecciona un paquete</option>
          {paquetes.map(p => (
            <option key={p.id} value={p.id}>
              {p.nombre_paquete} {p.precio != null ? `- $${p.precio}` : ''}
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
