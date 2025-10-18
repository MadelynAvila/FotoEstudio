import { supabase } from './supabaseClient'

const FOTOGRAFO_NAMES = ['fotografo', 'fotógrafo']

export async function getFotografos() {
  const { data: rolesData, error: rolesError } = await supabase
    .from('rol')
    .select('id, nombre')

  if (rolesError) {
    return {
      data: [],
      rolId: null,
      error: rolesError,
      rolesError,
      usuariosError: null
    }
  }

  const rolFotografo = (rolesData ?? []).find(item => {
    const nombre = item?.nombre?.toLowerCase?.() || ''
    return FOTOGRAFO_NAMES.includes(nombre)
  })

  if (!rolFotografo?.id) {
    return {
      data: [],
      rolId: null,
      error: null,
      rolesError: null,
      usuariosError: null
    }
  }

  const { data, error: usuariosError } = await supabase
    .from('usuario')
    .select(`
      id,
      username,
      correo,
      telefono,
      idrol,
      idestado,
      estado:estado_usuario ( id, nombre_estado )
    `)
    .eq('idrol', rolFotografo.id)
    .order('username', { ascending: true })

  return {
    data: data ?? [],
    rolId: rolFotografo.id,
    error: usuariosError || null,
    rolesError: null,
    usuariosError: usuariosError || null
  }
}

export async function getAgendaFotografo(idFotografo) {
  if (!idFotografo) {
    return { data: [], error: null }
  }

  const { data, error } = await supabase
    .from('agenda')
    .select('id, fecha, horainicio, horafin, disponible')
    .eq('idfotografo', idFotografo)
    .order('fecha', { ascending: true })
    .order('horainicio', { ascending: true })

  return { data: data ?? [], error }
}

export async function getActividadesFotografo(idFotografo) {
  if (!idFotografo) {
    return { data: [], error: null }
  }

  const { data: agendas, error: agendaError } = await supabase
    .from('agenda')
    .select('id')
    .eq('idfotografo', idFotografo)

  if (agendaError) {
    return { data: [], error: agendaError }
  }

  const agendaIds = (agendas ?? []).map(item => item.id)

  if (!agendaIds.length) {
    return { data: [], error: null }
  }

  const { data, error } = await supabase
    .from('actividad')
    .select(`
      id,
      nombre_actividad,
      ubicacion,
      estado_pago,
      paquete:paquete (
        id,
        nombre_paquete,
        precio
      ),
      agenda:agenda (
        id,
        fecha,
        horainicio,
        horafin,
        idfotografo
      ),
      cliente:usuario!actividad_idusuario_fkey (
        id,
        username
      )
    `)
    .in('idagenda', agendaIds)
    .order('idagenda', { ascending: true })

  if (error) {
    return { data: [], error }
  }

  const actividadesOrdenadas = [...(data ?? [])].sort((a, b) => {
    const agendaA = Array.isArray(a.agenda) ? a.agenda[0] : a.agenda
    const agendaB = Array.isArray(b.agenda) ? b.agenda[0] : b.agenda

    const fechaA = agendaA?.fecha ? new Date(agendaA.fecha).getTime() : 0
    const fechaB = agendaB?.fecha ? new Date(agendaB.fecha).getTime() : 0
    if (fechaA !== fechaB) {
      return fechaA - fechaB
    }

    const horaA = agendaA?.horainicio ? String(agendaA.horainicio) : ''
    const horaB = agendaB?.horainicio ? String(agendaB.horainicio) : ''
    return horaA.localeCompare(horaB)
  })

  return { data: actividadesOrdenadas, error: null }
}

export async function getResenasFotografo(idFotografo) {
  if (!idFotografo) {
    return { data: [], promedio: null, error: null }
  }

  const { data, error } = await supabase
    .from('resena')
    .select(`
      id,
      calificacion,
      comentario,
      fecha_resena,
      actividad:actividad!inner (
        id,
        nombre_actividad,
        agenda:agenda!inner (
          id,
          idfotografo,
          fecha,
          horainicio,
          horafin
        ),
        paquete:paquete (
          id,
          nombre_paquete
        )
      ),
      autor:usuario!resena_idusuario_fkey (
        id,
        username
      )
    `)
    .eq('actividad.agenda.idfotografo', idFotografo)
    .order('fecha_resena', { ascending: false })

  const resenas = data ?? []
  const total = resenas.reduce((acc, item) => acc + (item?.calificacion || 0), 0)
  const promedio = resenas.length ? total / resenas.length : null

  return { data: resenas, promedio, error }
}
