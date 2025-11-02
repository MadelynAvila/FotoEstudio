import { useCallback, useEffect, useMemo, useState } from 'react'
import DatePicker, { registerLocale } from 'react-datepicker'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import esLocale from 'date-fns/locale/es'
import 'react-datepicker/dist/react-datepicker.css'
import { useAuth } from '../auth/authContext'
import { supabase } from '../lib/supabaseClient'
import TimeWheelPicker from '../components/TimeWheelPicker'

registerLocale('es', esLocale)
dayjs.locale('es')

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
const WORK_DAY_START_MINUTES = 8 * 60
const WORK_DAY_END_MINUTES = 20 * 60
const TIME_STEP_MINUTES = 30
const MIN_RESERVATION_MINUTES = 60
const CALENDAR_RANGE_DAYS = 90

const minutosAFormato = (totalMinutos) => {
  const horas = Math.floor(totalMinutos / 60)
  const minutos = totalMinutos % 60
  return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`
}

const formatearHoraAMPM = (valor) => {
  if (!valor) return ''
  const [horasStr, minutosStr] = valor.split(':')
  const horas = Number(horasStr)
  const minutos = Number(minutosStr)
  if (Number.isNaN(horas) || Number.isNaN(minutos)) return valor
  const periodo = horas >= 12 ? 'PM' : 'AM'
  const horas12 = horas % 12 === 0 ? 12 : horas % 12
  return `${horas12}:${String(minutos).padStart(2, '0')} ${periodo}`
}

const restarIntervalo = (intervalos, intervaloOcupado) => {
  if (!Array.isArray(intervalos)) return []
  const { inicio: inicioOcupado, fin: finOcupado } = intervaloOcupado
  if (inicioOcupado == null || finOcupado == null || finOcupado <= inicioOcupado) {
    return intervalos.map(item => ({ ...item }))
  }

  const resultado = []
  intervalos.forEach(intervalo => {
    const { inicio, fin } = intervalo
    if (inicio == null || fin == null || fin <= inicio) return

    // Sin traslape
    if (finOcupado <= inicio || inicioOcupado >= fin) {
      resultado.push({ ...intervalo })
      return
    }

    // Parte previa disponible
    if (inicioOcupado > inicio) {
      const nuevoFin = Math.max(inicio, Math.min(fin, inicioOcupado))
      if (nuevoFin - inicio >= TIME_STEP_MINUTES) {
        resultado.push({ inicio, fin: nuevoFin })
      }
    }

    // Parte posterior disponible
    if (finOcupado < fin) {
      const nuevoInicio = Math.min(fin, Math.max(inicio, finOcupado))
      if (fin - nuevoInicio >= TIME_STEP_MINUTES) {
        resultado.push({ inicio: nuevoInicio, fin })
      }
    }
  })

  return resultado.map(item => ({ ...item }))
}

const unirIntervalos = (intervalos) => {
  if (!Array.isArray(intervalos) || intervalos.length === 0) return []
  const ordenados = [...intervalos]
    .filter(intervalo => intervalo && intervalo.inicio != null && intervalo.fin != null && intervalo.fin > intervalo.inicio)
    .sort((a, b) => a.inicio - b.inicio)

  if (ordenados.length === 0) return []

  const resultado = [ordenados[0]]
  for (let i = 1; i < ordenados.length; i += 1) {
    const actual = ordenados[i]
    const previo = resultado[resultado.length - 1]
    if (actual.inicio <= previo.fin) {
      previo.fin = Math.max(previo.fin, actual.fin)
    } else if (actual.inicio - previo.fin <= TIME_STEP_MINUTES) {
      // Une intervalos contiguos separados únicamente por el tamaño del paso
      previo.fin = Math.max(previo.fin, actual.fin)
    } else {
      resultado.push({ ...actual })
    }
  }

  return resultado.map(intervalo => ({ ...intervalo }))
}

const calcularDisponibilidadDia = (fotografos, sesionesDia) => {
  if (!Array.isArray(fotografos) || fotografos.length === 0) {
    return { estado: 'full', bloques: [] }
  }

  const mapaDisponibilidad = new Map()
  fotografos.forEach(fotografo => {
    mapaDisponibilidad.set(fotografo.id, [
      { inicio: WORK_DAY_START_MINUTES, fin: WORK_DAY_END_MINUTES }
    ])
  })

  const sesiones = (sesionesDia ?? []).filter(sesion => {
    if (!sesion || !sesion.idfotografo || !sesion.horainicio || !sesion.horafin) return false
    // Considera como ocupado cuando la sesión no está marcada explícitamente como disponible
    return sesion.disponible !== true
  })

  sesiones.forEach(sesion => {
    const intervalosFotografo = mapaDisponibilidad.get(sesion.idfotografo)
    if (!intervalosFotografo) return

    const inicioSesion = horaATotalMinutos(sesion.horainicio)
    const finSesion = horaATotalMinutos(sesion.horafin)
    if (inicioSesion == null || finSesion == null || finSesion <= inicioSesion) return

    const inicioBloqueado = Math.max(WORK_DAY_START_MINUTES, inicioSesion - MIN_BUFFER_MINUTES)
    const finBloqueado = Math.min(WORK_DAY_END_MINUTES, finSesion + MIN_BUFFER_MINUTES)

    const intervalosActualizados = restarIntervalo(intervalosFotografo, {
      inicio: inicioBloqueado,
      fin: finBloqueado
    })
    mapaDisponibilidad.set(sesion.idfotografo, intervalosActualizados)
  })

  const todosLosBloques = []
  mapaDisponibilidad.forEach(intervalos => {
    intervalos.forEach(intervalo => {
      if (intervalo.fin - intervalo.inicio >= MIN_RESERVATION_MINUTES) {
        todosLosBloques.push({ ...intervalo })
      }
    })
  })

  const bloquesUnidos = unirIntervalos(todosLosBloques)
  const duracionTotalDisponible = bloquesUnidos.reduce((acumulado, bloque) => acumulado + (bloque.fin - bloque.inicio), 0)
  const duracionDia = WORK_DAY_END_MINUTES - WORK_DAY_START_MINUTES

  if (bloquesUnidos.length === 0 || duracionTotalDisponible < MIN_RESERVATION_MINUTES) {
    return { estado: 'full', bloques: [] }
  }

  if (duracionTotalDisponible >= duracionDia - TIME_STEP_MINUTES) {
    return { estado: 'available', bloques: bloquesUnidos }
  }

  return { estado: 'partial', bloques: bloquesUnidos }
}

const construirMapaDisponibilidad = (fotografos, sesiones, fechaInicio) => {
  const mapaPorFecha = new Map()
  ;(sesiones ?? []).forEach(sesion => {
    const fecha = normalizarFechaInput(sesion?.fecha)
    if (!fecha) return
    if (!mapaPorFecha.has(fecha)) {
      mapaPorFecha.set(fecha, [])
    }
    mapaPorFecha.get(fecha).push(sesion)
  })

  const resultado = {}
  for (let i = 0; i <= CALENDAR_RANGE_DAYS; i += 1) {
    const fecha = fechaInicio.add(i, 'day')
    const clave = fecha.format('YYYY-MM-DD')
    const sesionesDia = mapaPorFecha.get(clave) ?? []
    resultado[clave] = calcularDisponibilidadDia(fotografos, sesionesDia)
  }

  return resultado
}

const generarOpcionesInicio = (bloques) => {
  if (!Array.isArray(bloques) || bloques.length === 0) return []
  const opciones = []
  bloques.forEach(bloque => {
    for (let minuto = bloque.inicio; minuto <= bloque.fin - MIN_RESERVATION_MINUTES; minuto += TIME_STEP_MINUTES) {
      opciones.push(minutosAFormato(minuto))
    }
  })
  return opciones
}

const generarOpcionesFin = (bloques, horaInicio) => {
  if (!horaInicio) return []
  const inicioSeleccionado = horaATotalMinutos(horaInicio)
  if (inicioSeleccionado == null) return []

  const bloque = (bloques ?? []).find(item => inicioSeleccionado >= item.inicio && inicioSeleccionado < item.fin)
  if (!bloque) return []

  const opciones = []
  for (
    let minuto = inicioSeleccionado + MIN_RESERVATION_MINUTES;
    minuto <= bloque.fin;
    minuto += TIME_STEP_MINUTES
  ) {
    opciones.push(minutosAFormato(minuto))
  }
  return opciones
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
  const [calendarAvailability, setCalendarAvailability] = useState({})
  const [availableBlocks, setAvailableBlocks] = useState([])
  const [calendarError, setCalendarError] = useState('')
  const [loadingCalendar, setLoadingCalendar] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)
  const [startOptions, setStartOptions] = useState([])
  const [endOptions, setEndOptions] = useState([])
  const { user } = useAuth()

  const fotografosList = useMemo(() => (Array.isArray(fotografos) ? fotografos : []), [fotografos])
  const today = useMemo(() => dayjs().startOf('day'), [])
  const maxSelectableDate = useMemo(() => dayjs().add(CALENDAR_RANGE_DAYS, 'day').toDate(), [])

  const fetchCalendarAvailability = useCallback(async () => {
    if (!fotografosList.length) {
      return { mapa: {}, error: null }
    }

    const hoy = dayjs().startOf('day').format('YYYY-MM-DD')
    const limite = dayjs().startOf('day').add(CALENDAR_RANGE_DAYS, 'day').format('YYYY-MM-DD')

    const { data, error: agendaError } = await supabase
      .from('agenda')
      .select('id, idfotografo, fecha, horainicio, horafin, disponible')
      .gte('fecha', hoy)
      .lte('fecha', limite)

    if (agendaError) {
      return { mapa: {}, error: agendaError }
    }

    const mapa = construirMapaDisponibilidad(fotografosList, data, dayjs(hoy))
    return { mapa, error: null }
  }, [fotografosList])

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

  useEffect(() => {
    let cancelado = false

    const cargarDisponibilidadCalendario = async () => {
      if (!fotografosList.length) {
        if (cancelado) return
        setCalendarAvailability({})
        setAvailableBlocks([])
        setCalendarError('')
        setLoadingCalendar(false)
        return
      }

      setLoadingCalendar(true)
      const { mapa, error: disponibilidadError } = await fetchCalendarAvailability()
      if (cancelado) return

      if (disponibilidadError) {
        console.error('No se pudo cargar la disponibilidad del calendario', disponibilidadError)
        setCalendarError('No pudimos cargar la disponibilidad del calendario. Intenta nuevamente en unos minutos.')
        setCalendarAvailability({})
        setAvailableBlocks([])
      } else {
        setCalendarError('')
        setCalendarAvailability(mapa)
      }

      setLoadingCalendar(false)
    }

    cargarDisponibilidadCalendario()

    return () => {
      cancelado = true
    }
  }, [fetchCalendarAvailability, fotografosList])

  useEffect(() => {
    if (!selectedDate) {
      setAvailableBlocks([])
      setStartOptions([])
      setEndOptions([])
      setForm(prev => {
        if (!prev.fecha && !prev.horaInicio && !prev.horaFin) return prev
        return { ...prev, fecha: '', horaInicio: '', horaFin: '' }
      })
      return
    }

    const clave = dayjs(selectedDate).format('YYYY-MM-DD')
    const info = calendarAvailability[clave]
    if (!info || !Array.isArray(info.bloques) || info.bloques.length === 0) {
      setAvailableBlocks([])
      setStartOptions([])
      setEndOptions([])
      setForm(prev => {
        if (!prev.fecha && !prev.horaInicio && !prev.horaFin) return prev
        return { ...prev, fecha: '', horaInicio: '', horaFin: '' }
      })
      return
    }

    setAvailableBlocks(info.bloques)
    setForm(prev => (prev.fecha === clave ? prev : { ...prev, fecha: clave }))
  }, [calendarAvailability, selectedDate])

  useEffect(() => {
    const opcionesInicio = generarOpcionesInicio(availableBlocks)
    setStartOptions(opcionesInicio)
    setForm(prev => {
      if (!prev.horaInicio && !prev.horaFin) {
        return prev
      }
      if (opcionesInicio.includes(prev.horaInicio)) {
        return prev
      }
      return { ...prev, horaInicio: '', horaFin: '' }
    })
  }, [availableBlocks])

  useEffect(() => {
    const opcionesFin = generarOpcionesFin(availableBlocks, form.horaInicio)
    setEndOptions(opcionesFin)
    setForm(prev => {
      if (!prev.horaFin) return prev
      if (opcionesFin.includes(prev.horaFin)) return prev
      return { ...prev, horaFin: '' }
    })
  }, [availableBlocks, form.horaInicio])

  const filterSelectableDate = useCallback((date) => {
    if (!date) return false
    const candidato = dayjs(date).startOf('day')
    if (candidato.isBefore(today)) return false
    if (!fotografosList.length) return false
    const clave = candidato.format('YYYY-MM-DD')
    const info = calendarAvailability[clave]
    if (!info) return false
    return info.estado !== 'full'
  }, [calendarAvailability, fotografosList, today])

  const getDayClassName = useCallback((date) => {
    if (!date) return ''
    const candidato = dayjs(date).startOf('day')
    if (candidato.isBefore(today)) return 'rsv-day-full'
    const clave = candidato.format('YYYY-MM-DD')
    const info = calendarAvailability[clave]
    if (!info) return ''
    if (info.estado === 'full') return 'rsv-day-full'
    if (info.estado === 'partial') return 'rsv-day-partial'
    if (info.estado === 'available') return 'rsv-day-available'
    return ''
  }, [calendarAvailability, today])

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
      setSelectedDate(null)
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

      const { mapa: mapaActualizado, error: calendarioActualizadoError } = await fetchCalendarAvailability()
      if (calendarioActualizadoError) {
        console.error('No se pudo actualizar la disponibilidad del calendario', calendarioActualizadoError)
      } else {
        setCalendarAvailability(mapaActualizado)
      }

      setMensaje('Reserva creada correctamente.')
      setForm({ ...initialForm, nombre, telefono, correo })
      setSelectedDate(null)
    } finally {
      setEnviando(false)
    }
  }

  /** Mensaje dinámico */
  const selectedDateKey = useMemo(
    () => (selectedDate ? dayjs(selectedDate).format('YYYY-MM-DD') : ''),
    [selectedDate]
  )
  const selectedDateInfo = selectedDateKey ? calendarAvailability[selectedDateKey] : null
  const hayBloquesDisponibles = availableBlocks.length > 0
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

  const inputClass = 'w-full rounded-lg border border-[color:var(--border)] bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-umber/30 transition disabled:opacity-50 disabled:cursor-not-allowed'

  return (
    <section className="page-section">
      <div className="section-shell">
        <div className="section-heading max-w-2xl">
          <span className="section-eyebrow">Reservas</span>
          <h1 className="leading-snug">Agenda tu experiencia fotográfica</h1>
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

            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="space-y-3">
                <DatePicker
                  selected={selectedDate}
                  onChange={date => setSelectedDate(date)}
                  className={inputClass}
                  placeholderText="Selecciona una fecha disponible"
                  locale="es"
                  dateFormat="dd 'de' MMMM, yyyy"
                  minDate={today.toDate()}
                  maxDate={maxSelectableDate}
                  filterDate={filterSelectableDate}
                  dayClassName={getDayClassName}
                  calendarClassName="booking-datepicker"
                  popperClassName="booking-datepicker-popper"
                  disabled={!user || enviando || !hayFotografos}
                  isClearable
                  showPopperArrow={false}
                />
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    Disponible
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />
                    Parcial
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-300" />
                    Sin cupo
                  </span>
                </div>
                <div className="rounded-2xl border border-dashed border-[color:var(--border)] bg-white/70 px-4 py-3 text-xs text-slate-600">
                  {calendarError ? (
                    <span className="text-red-600">{calendarError}</span>
                  ) : loadingCalendar ? (
                    <span>Consultando disponibilidad…</span>
                  ) : !selectedDate ? (
                    <span>Selecciona una fecha para ver horarios disponibles.</span>
                  ) : !hayBloquesDisponibles ? (
                    <span>Este día está completamente reservado.</span>
                  ) : (
                    <>
                      <span className="font-medium text-slate-700">Horarios disponibles</span>
                      <ul className="mt-2 space-y-1">
                        {availableBlocks.map(bloque => (
                          <li key={`${bloque.inicio}-${bloque.fin}`}>
                            {formatearHoraAMPM(minutosAFormato(bloque.inicio))} –{' '}
                            {formatearHoraAMPM(minutosAFormato(bloque.fin))}
                          </li>
                        ))}
                      </ul>
                      {selectedDateInfo?.estado === 'partial' && (
                        <p className="mt-2 text-[11px] text-slate-500">
                          Elige tu hora de inicio dentro de cualquiera de los bloques disponibles.
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className="hora-selector sm:grid sm:grid-cols-2 sm:gap-5">
                <TimeWheelPicker
                  id="booking-start-time"
                  label="Hora de inicio"
                  value={form.horaInicio}
                  options={startOptions}
                  onChange={valor => updateField('horaInicio', valor)}
                  disabled={!user || enviando || !startOptions.length}
                  placeholder={!selectedDate ? 'Selecciona un día para ver horarios' : 'No hay horas disponibles'}
                />
                <TimeWheelPicker
                  id="booking-end-time"
                  label="Hora de fin"
                  value={form.horaFin}
                  options={endOptions}
                  onChange={valor => updateField('horaFin', valor)}
                  disabled={!user || enviando || !endOptions.length}
                  placeholder={
                    !form.horaInicio
                      ? 'Selecciona una hora de inicio'
                      : 'Selecciona una hora válida'
                  }
                />
              </div>
              {form.horaInicio && !endOptions.length && (
                <p className="text-xs text-red-600">
                  La hora seleccionada solo cuenta con bloques ocupados después de las{' '}
                  {formatearHoraAMPM(form.horaInicio)}. Elige otro horario disponible.
                </p>
              )}
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

          
          