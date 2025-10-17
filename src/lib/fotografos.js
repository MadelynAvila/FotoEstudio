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

  const { data, error } = await supabase
    .from('actividad')
    .select(`
      id,
      nombre_actividad,
      ubicacion,
      estado_pago,
      agenda:agenda!inner (
        id,
        idfotografo,
        fecha,
        horainicio,
        horafin,
        disponible
      ),
      paquete:paquete (
        id,
        nombre_paquete
      ),
      cliente:usuario!actividad_idcliente_fkey (
        id,
        username
      )
    `)
    .eq('agenda.idfotografo', idFotografo)
    .order('agenda.fecha', { ascending: true })
    .order('agenda.horainicio', { ascending: true })

  return { data: data ?? [], error }
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
      autor:usuario!resena_idcliente_fkey (
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
