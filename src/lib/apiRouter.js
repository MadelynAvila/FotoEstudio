import { supabase } from './supabaseClient'

const AGENDA_DEFAULT_START = '08:00'
const AGENDA_DEFAULT_END = '17:00'

function jsonResponse(payload, status = 200){
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

function parseNumeric(value){
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

async function handleGalleryPatch(id, body){
  if (!body || typeof body !== 'object'){
    return jsonResponse({ success: false, message: 'Solicitud inválida' }, 400)
  }

  const updates = {}
  if (body.url) updates.url_imagen = body.url
  if (Object.prototype.hasOwnProperty.call(body, 'descripcion')){
    updates.descripcion = body.descripcion || null
  }
  if (body.nombre) updates.titulo = body.nombre

  if (!Object.keys(updates).length){
    return jsonResponse({ success: false, message: 'No hay cambios para aplicar' }, 400)
  }

  const { data, error } = await supabase
    .from('galeria_paquete')
    .update(updates)
    .eq('id', id)
    .select()
    .maybeSingle()

  if (error || !data){
    return jsonResponse({ success: false, message: error?.message || 'No se pudo actualizar la galería' }, 500)
  }

  const item = {
    id: data.id,
    nombre: body.nombre ?? data.titulo ?? '',
    descripcion: body.descripcion ?? data.descripcion ?? '',
    url: body.url ?? data.url_imagen
  }

  return jsonResponse({ success: true, item, message: '✅ Galería actualizada' })
}

async function handleGalleryDelete(id){
  const { error } = await supabase.from('galeria_paquete').delete().eq('id', id)
  if (error){
    return jsonResponse({ success: false, message: error.message || 'No se pudo eliminar la galería' }, 500)
  }
  return jsonResponse({ success: true, deletedId: id, message: '🗑️ Galería eliminada' })
}

function ensureRegistros(body){
  if (!body) return []
  if (Array.isArray(body.registros)) return body.registros
  if (body.fecha){
    return [{
      fecha: body.fecha,
      horainicio: body.horainicio || AGENDA_DEFAULT_START,
      horafin: body.horafin || AGENDA_DEFAULT_END,
      disponible: body.disponible !== false
    }]
  }
  return []
}

function isValidDate(value){
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function isValidTime(value){
  return /^\d{2}:\d{2}$/.test(value)
}

async function handleAgendaPatch(fotografoId, body){
  const registros = ensureRegistros(body)
  if (!registros.length){
    return jsonResponse({ success: false, message: 'No se enviaron registros para actualizar.' }, 400)
  }

  const payload = []
  for (const registro of registros){
    if (!registro.fecha || !isValidDate(registro.fecha)){
      return jsonResponse({ success: false, message: 'Cada registro debe incluir una fecha válida.' }, 400)
    }
    const inicio = registro.horainicio && isValidTime(registro.horainicio)
      ? registro.horainicio
      : AGENDA_DEFAULT_START
    const fin = registro.horafin && isValidTime(registro.horafin)
      ? registro.horafin
      : AGENDA_DEFAULT_END
    payload.push({
      idfotografo: fotografoId,
      fecha: registro.fecha,
      horainicio: inicio,
      horafin: fin,
      disponible: registro.disponible !== false
    })
  }

  const { data, error } = await supabase
    .from('agenda')
    .upsert(payload, { onConflict: 'idfotografo,fecha' })
    .select()

  if (error){
    return jsonResponse({ success: false, message: error.message || 'No se pudo actualizar la agenda.' }, 500)
  }

  return jsonResponse({ success: true, upserted: data?.length ?? 0, items: data ?? [], message: '✅ Agenda actualizada correctamente' })
}

async function handleAgendaGet(query){
  const fotografoId = parseNumeric(query.get('fotografoId'))
  if (!fotografoId){
    return jsonResponse({ success: false, message: 'Debe proporcionar un fotógrafo válido.' }, 400)
  }

  const { data, error } = await supabase
    .from('agenda')
    .select('id, fecha, horainicio, horafin, disponible')
    .eq('idfotografo', fotografoId)
    .order('fecha', { ascending: true })

  if (error){
    return jsonResponse({ success: false, message: error.message || 'No se pudo obtener la agenda.' }, 500)
  }

  return jsonResponse({ success: true, items: data ?? [] })
}

async function resolveEstadoActividad(nombre){
  if (!nombre) return null
  const normalized = nombre.toString().trim().toLowerCase()
  const { data, error } = await supabase
    .from('estado_actividad')
    .select('id, nombre_estado')
    .order('orden', { ascending: true })

  if (error){
    return null
  }

  const match = (data || []).find(item => item.nombre_estado?.toLowerCase() === normalized)
  return match?.id ?? null
}

async function handleReservaPatch(reservaId, body){
  if (!body || typeof body !== 'object'){
    return jsonResponse({ success: false, message: 'Solicitud inválida.' }, 400)
  }

  const fecha = typeof body.fecha === 'string' ? body.fecha.trim() : ''
  const hora = typeof body.hora === 'string' ? body.hora.trim() : ''
  const fotografoId = parseNumeric(body.idfotografo)
  const estadoNombre = typeof body.estado === 'string' ? body.estado.trim() : ''

  if (!isValidDate(fecha)){
    return jsonResponse({ success: false, message: 'Selecciona una fecha válida (YYYY-MM-DD).' }, 400)
  }

  if (!isValidTime(hora)){
    return jsonResponse({ success: false, message: 'Selecciona una hora válida (HH:MM).' }, 400)
  }

  const { data: actividad, error: actividadError } = await supabase
    .from('actividad')
    .select('id, idagenda, idestado_actividad')
    .eq('id', reservaId)
    .maybeSingle()

  if (actividadError || !actividad){
    return jsonResponse({ success: false, message: 'Reserva no encontrada.' }, 404)
  }

  let estadoId = actividad.idestado_actividad ?? null
  if (estadoNombre){
    const resolved = await resolveEstadoActividad(estadoNombre)
    if (!resolved){
      return jsonResponse({ success: false, message: 'El estado seleccionado no es válido.' }, 400)
    }
    estadoId = resolved
  }

  let agendaId = actividad.idagenda ?? null
  if (fotografoId){
    const { data: agendaRow, error: agendaFetchError } = await supabase
      .from('agenda')
      .select('id, disponible')
      .eq('idfotografo', fotografoId)
      .eq('fecha', fecha)
      .maybeSingle()

    if (agendaFetchError){
      return jsonResponse({ success: false, message: agendaFetchError.message }, 500)
    }

    if (agendaRow){
      agendaId = agendaRow.id
    } else {
      const { data: nuevaAgenda, error: agendaInsertError } = await supabase
        .from('agenda')
        .upsert({
          idfotografo: fotografoId,
          fecha,
          horainicio: hora,
          horafin: hora,
          disponible: false
        }, { onConflict: 'idfotografo,fecha' })
        .select()

      if (agendaInsertError){
        return jsonResponse({ success: false, message: agendaInsertError.message }, 500)
      }

      agendaId = nuevaAgenda?.[0]?.id ?? agendaId
    }

    if (agendaId){
      await supabase
        .from('agenda')
        .update({ horainicio: hora, horafin: hora, disponible: false })
        .eq('id', agendaId)
    }
  }

  const actividadUpdates = {}
  if (agendaId) actividadUpdates.idagenda = agendaId
  if (estadoId) actividadUpdates.idestado_actividad = estadoId

  if (!Object.keys(actividadUpdates).length){
    actividadUpdates.idagenda = agendaId
  }

  const { error: actividadUpdateError } = await supabase
    .from('actividad')
    .update(actividadUpdates)
    .eq('id', reservaId)

  if (actividadUpdateError){
    return jsonResponse({ success: false, message: actividadUpdateError.message || 'No se pudo actualizar la reserva.' }, 500)
  }

  const { data: reservaActualizada, error: detalleError } = await supabase
    .from('actividad')
    .select(`
      id,
      idusuario,
      idestado_actividad,
      agenda:agenda(id, fecha, horainicio, horafin, idfotografo),
      paquete:paquete(id, nombre_paquete),
      usuario:usuario(id, username)
    `)
    .eq('id', reservaId)
    .maybeSingle()

  if (detalleError || !reservaActualizada){
    return jsonResponse({ success: false, message: detalleError?.message || 'No se pudo obtener la reserva actualizada.' }, 500)
  }

  return jsonResponse({ success: true, item: reservaActualizada, message: '✅ Reserva actualizada' })
}

async function handleReservaBulk(body){
  if (!body || typeof body !== 'object'){
    return jsonResponse({ success: false, message: 'Solicitud inválida.' }, 400)
  }

  const reservas = Array.isArray(body.reservas) ? body.reservas.map(parseNumeric).filter(Boolean) : []
  const nuevoEstado = typeof body.nuevo_estado === 'string' ? body.nuevo_estado.trim() : ''

  if (!reservas.length || !nuevoEstado){
    return jsonResponse({ success: false, message: 'Debe seleccionar reservas y un estado válido.' }, 400)
  }

  const estadoId = await resolveEstadoActividad(nuevoEstado)
  if (!estadoId){
    return jsonResponse({ success: false, message: 'El estado indicado no existe.' }, 400)
  }

  const { data, error } = await supabase
    .from('actividad')
    .update({ idestado_actividad: estadoId })
    .in('id', reservas)
    .select('id')

  if (error){
    return jsonResponse({ success: false, message: error.message || 'No se pudieron actualizar las reservas.' }, 500)
  }

  return jsonResponse({ success: true, updated: data?.length ?? 0, estadoId, message: `✅ Estado actualizado para ${data?.length ?? 0} reservas.` })
}

async function handleMisReservas(query){
  const clienteId = parseNumeric(query.get('clienteId'))
  if (!clienteId){
    return jsonResponse({ success: false, message: 'Cliente inválido.' }, 400)
  }

  const { data, error } = await supabase
    .from('actividad')
    .select(`
      id,
      idestado_actividad,
      idestado_pago,
      nombre_actividad,
      ubicacion,
      estado_pago:estado_pago ( id, nombre_estado ),
      agenda:agenda ( id, fecha, horainicio, horafin, idfotografo ),
      paquete:paquete ( id, nombre_paquete, precio ),
      pago:pago ( id, monto, fecha_pago, metodo_pago, tipo_pago, idestado_pago )
    `)
    .eq('idusuario', clienteId)
    .order('fecha', { foreignTable: 'agenda', ascending: false, nullsLast: true })
    .order('horainicio', { foreignTable: 'agenda', ascending: false, nullsLast: true })

  if (error){
    return jsonResponse({ success: false, message: error.message || 'No se pudieron obtener las reservas.' }, 500)
  }

  return jsonResponse({ success: true, items: data ?? [] })
}

async function handlePagoComprobante(pagoId){
  const { data, error } = await supabase
    .from('pago')
    .select(`
      id,
      monto,
      fecha_pago,
      metodo_pago,
      tipo_pago,
      actividad:actividad (
        id,
        nombre_actividad,
        agenda:agenda ( fecha, horainicio, idfotografo ),
        paquete:paquete ( nombre_paquete ),
        usuario:usuario ( username, telefono )
      )
    `)
    .eq('id', pagoId)
    .maybeSingle()

  if (error || !data){
    return jsonResponse({ success: false, message: error?.message || 'Pago no encontrado.' }, 404)
  }

  return jsonResponse({ success: true, item: data })
}

async function dispatchApiRequest(request){
  const url = new URL(request.url, window.location.origin)
  const { pathname, searchParams } = url
  const method = request.method.toUpperCase()
  const body = method === 'GET' || method === 'HEAD' ? null : await request.json().catch(() => null)

  if (method === 'PATCH' && /^\/api\/galeria\/(\d+)$/.test(pathname)){
    const [, idMatch] = pathname.match(/^\/api\/galeria\/(\d+)$/) || []
    const id = parseNumeric(idMatch)
    if (!id) return jsonResponse({ success: false, message: 'Galería inválida.' }, 400)
    return handleGalleryPatch(id, body)
  }

  if (method === 'DELETE' && /^\/api\/galeria\/(\d+)$/.test(pathname)){
    const [, idMatch] = pathname.match(/^\/api\/galeria\/(\d+)$/) || []
    const id = parseNumeric(idMatch)
    if (!id) return jsonResponse({ success: false, message: 'Galería inválida.' }, 400)
    return handleGalleryDelete(id)
  }

  if (method === 'PATCH' && /^\/api\/agenda\/(\d+)$/.test(pathname)){
    const [, fotografoMatch] = pathname.match(/^\/api\/agenda\/(\d+)$/) || []
    const fotografoId = parseNumeric(fotografoMatch)
    if (!fotografoId) return jsonResponse({ success: false, message: 'Fotógrafo inválido.' }, 400)
    return handleAgendaPatch(fotografoId, body)
  }

  if (method === 'GET' && pathname === '/api/agenda'){
    return handleAgendaGet(searchParams)
  }

  if (method === 'PATCH' && /^\/api\/reservas\/(\d+)$/.test(pathname)){
    const [, reservaMatch] = pathname.match(/^\/api\/reservas\/(\d+)$/) || []
    const reservaId = parseNumeric(reservaMatch)
    if (!reservaId) return jsonResponse({ success: false, message: 'Reserva inválida.' }, 400)
    return handleReservaPatch(reservaId, body)
  }

  if (method === 'PATCH' && pathname === '/api/reservas/actualizar-multiples'){
    return handleReservaBulk(body)
  }

  if (method === 'GET' && pathname === '/api/mis-reservas'){
    return handleMisReservas(searchParams)
  }

  if (method === 'GET' && /^\/api\/pagos\/(\d+)\/comprobante$/.test(pathname)){
    const [, pagoMatch] = pathname.match(/^\/api\/pagos\/(\d+)\/comprobante$/) || []
    const pagoId = parseNumeric(pagoMatch)
    if (!pagoId) return jsonResponse({ success: false, message: 'Pago inválido.' }, 400)
    return handlePagoComprobante(pagoId)
  }

  return null
}

if (typeof window !== 'undefined' && !window.__fotoEstudioApiSetup){
  const originalFetch = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init)
    if (request.url.startsWith(window.location.origin + '/api/')){
      const response = await dispatchApiRequest(request)
      if (response) return response
    } else if (request.url.startsWith('/api/')){
      const absoluteRequest = new Request(new URL(request.url, window.location.origin), request)
      const response = await dispatchApiRequest(absoluteRequest)
      if (response) return response
    }
    return originalFetch(input, init)
  }
  window.__fotoEstudioApiSetup = true
}

export default null
