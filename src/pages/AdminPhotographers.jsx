import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import AdminHelpCard from '../components/AdminHelpCard'

const ESTADOS = ['activo', 'inactivo']
const defaultForm = { id: null, nombrecompleto: '', telefono: '', correo: '', especialidad: '', estado: 'activo' }

function parseTelefono(rawValue) {
  if (!rawValue) return { telefono: '', especialidad: '' }
  const trimmed = String(rawValue).trim()
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed)
      return {
        telefono: parsed.telefono || '',
        especialidad: parsed.especialidad || ''
      }
    } catch (error) {
      console.error('No se pudo interpretar la información del fotógrafo', error)
    }
  }
  return { telefono: trimmed, especialidad: '' }
}

function serializeTelefono({ telefono, especialidad }) {
  return JSON.stringify({ telefono: telefono || '', especialidad: especialidad || '' })
}

export default function AdminPhotographers(){
  const [fotografos, setFotografos] = useState([])
  const [form, setForm] = useState(defaultForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState({ type: '', message: '' })
  const [rolFotografoId, setRolFotografoId] = useState(null)
  const [estadosUsuario, setEstadosUsuario] = useState([])

  const fetchConfiguracion = async () => {
    const [{ data: roles, error: rolesError }, { data: estados, error: estadosError }] = await Promise.all([
      supabase.from('rol').select('id, nombre'),
      supabase.from('estado_usuario').select('id, nombre_estado')
    ])

    if (rolesError) {
      console.error('No se pudo obtener el rol de fotógrafo', rolesError)
    }
    if (estadosError) {
      console.error('No se pudieron obtener los estados de usuario', estadosError)
    }

    const rolFotografo = roles?.find(item => item.nombre?.toLowerCase() === 'fotografo' || item.nombre?.toLowerCase() === 'fotógrafo')
    const rolId = rolFotografo?.id ?? null
    setRolFotografoId(rolId)
    if (!rolId) {
      setFotografos([])
      setLoading(false)
    }
    setEstadosUsuario(estados ?? [])
  }

  const fetchFotografos = async () => {
    if (!rolFotografoId) {
      setFotografos([])
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error } = await supabase
      .from('usuario')
      .select('id, username, correo, telefono, idRol, idestado, estado:estado_usuario!usuario_idestado_fkey ( id, nombre_estado )')
      .eq('idRol', rolFotografoId)
      .order('username', { ascending: true })

    if (error) {
      console.error('No se pudieron cargar los fotógrafos', error)
      setFotografos([])
      setFeedback({ type: 'error', message: 'No pudimos cargar los fotógrafos.' })
      setLoading(false)
      return
    }

    const formatted = (data ?? []).map(item => {
      const info = parseTelefono(item.telefono)
      return {
        id: item.id,
        nombrecompleto: item.username || 'Fotógrafo sin nombre',
        telefono: info.telefono,
        correo: item.correo || '',
        especialidad: info.especialidad,
        estado: item.estado?.nombre_estado?.toLowerCase() || 'activo'
      }
    })

    setFotografos(formatted)
    setFeedback({ type: '', message: '' })
    setLoading(false)
  }

  useEffect(() => {
    fetchConfiguracion()
  }, [])

  useEffect(() => {
    if (rolFotografoId) {
      fetchFotografos()
    }
  }, [rolFotografoId])

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const resetForm = () => setForm(defaultForm)

  const estadoIdFromNombre = (nombre) => {
    const match = estadosUsuario.find(estado => estado.nombre_estado?.toLowerCase() === nombre)
    return match?.id ?? null
  }

  const onSubmit = async (event) => {
    event.preventDefault()
    setFeedback({ type: '', message: '' })

    if (!form.nombrecompleto) {
      setFeedback({ type: 'error', message: 'El nombre completo es obligatorio.' })
      return
    }
    if (!rolFotografoId) {
      setFeedback({ type: 'error', message: 'Configura el rol de fotógrafo antes de registrar integrantes del equipo.' })
      return
    }

    const telefonoSerializado = serializeTelefono({ telefono: form.telefono, especialidad: form.especialidad })
    const estadoId = estadoIdFromNombre(form.estado)

    setSaving(true)

    const payload = {
      username: form.nombrecompleto,
      telefono: telefonoSerializado,
      correo: form.correo || null,
      idRol: rolFotografoId,
      idestado: estadoId
    }

    if (form.id) {
      const { error } = await supabase.from('usuario').update(payload).eq('id', form.id)
      if (error) {
        console.error('No se pudo actualizar el fotógrafo', error)
        setFeedback({ type: 'error', message: 'No se pudo actualizar al fotógrafo.' })
      } else {
        setFeedback({ type: 'success', message: 'Fotógrafo actualizado correctamente.' })
        resetForm()
        fetchFotografos()
      }
    } else {
      const { error } = await supabase.from('usuario').insert([payload])
      if (error) {
        console.error('No se pudo crear el fotógrafo', error)
        setFeedback({ type: 'error', message: 'No se pudo crear al fotógrafo.' })
      } else {
        setFeedback({ type: 'success', message: 'Fotógrafo registrado correctamente.' })
        resetForm()
        fetchFotografos()
      }
    }

    setSaving(false)
  }

  const onEdit = (fotografo) => {
    setForm({
      id: fotografo.id,
      nombrecompleto: fotografo.nombrecompleto || '',
      telefono: fotografo.telefono || '',
      correo: fotografo.correo || '',
      especialidad: fotografo.especialidad || '',
      estado: fotografo.estado || 'activo'
    })
  }

  const onDelete = async (id) => {
    if (!window.confirm('¿Eliminar este fotógrafo?')) return
    const { error } = await supabase.from('usuario').delete().eq('id', id)
    if (error) {
      console.error('No se pudo eliminar al fotógrafo', error)
      setFeedback({ type: 'error', message: 'No se pudo eliminar al fotógrafo seleccionado.' })
    } else {
      setFotografos(prev => prev.filter(item => item.id !== id))
      if (form.id === id) resetForm()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        <div className="card flex-1 p-5 space-y-4">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-umber">Equipo de fotógrafos</h1>
              <p className="muted text-sm">Controla la disponibilidad y especialidad de tu equipo.</p>
            </div>
            <button type="button" onClick={resetForm} className="btn btn-ghost">Registrar nuevo</button>
          </header>

          <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Nombre completo *</span>
              <input
                value={form.nombrecompleto}
                onChange={e => updateField('nombrecompleto', e.target.value)}
                className="border rounded-xl2 px-3 py-2"
                placeholder="Ej. Carlos Hernández"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Teléfono</span>
              <input
                value={form.telefono}
                onChange={e => updateField('telefono', e.target.value)}
                className="border rounded-xl2 px-3 py-2"
                placeholder="Ej. 4444-4444"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Correo</span>
              <input
                type="email"
                value={form.correo}
                onChange={e => updateField('correo', e.target.value)}
                className="border rounded-xl2 px-3 py-2"
                placeholder="fotografo@correo.com"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Especialidad</span>
              <input
                value={form.especialidad}
                onChange={e => updateField('especialidad', e.target.value)}
                className="border rounded-xl2 px-3 py-2"
                placeholder="Bodas, retratos, producto…"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Estado</span>
              <select
                value={form.estado}
                onChange={e => updateField('estado', e.target.value)}
                className="border rounded-xl2 px-3 py-2"
              >
                {ESTADOS.map(estado => (
                  <option key={estado} value={estado}>{estado === 'activo' ? 'Activo' : 'Inactivo'}</option>
                ))}
              </select>
            </label>
            <div className="md:col-span-2">
              <button className="btn btn-primary" disabled={saving}>
                {saving ? 'Guardando…' : form.id ? 'Actualizar fotógrafo' : 'Crear fotógrafo'}
              </button>
            </div>
            {feedback.message && (
              <p className={`md:col-span-2 text-sm ${feedback.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
                {feedback.message}
              </p>
            )}
          </form>
        </div>
        <div className="lg:w-[320px]">
          <AdminHelpCard title="Cómo administrar el equipo">
            <p>Registra a cada fotógrafo con su especialidad para asignarlo a futuras reservas desde la sección de reservas.</p>
            <p>Marca el estado en <b>inactivo</b> cuando alguien no esté disponible temporalmente.</p>
            <p>Recuerda actualizar los datos de contacto cuando cambien para evitar fallos en la comunicación.</p>
          </AdminHelpCard>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="text-lg font-semibold text-umber mb-3">Fotógrafos registrados</h2>
        {loading ? (
          <p className="muted text-sm">Cargando fotógrafos…</p>
        ) : fotografos.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-sand text-left uppercase text-xs tracking-wide text-slate-600">
                <tr>
                  <th className="p-2">Nombre</th>
                  <th className="p-2">Teléfono</th>
                  <th className="p-2">Correo</th>
                  <th className="p-2">Especialidad</th>
                  <th className="p-2">Estado</th>
                  <th className="p-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {fotografos.map(fotografo => (
                  <tr key={fotografo.id} className="border-b last:border-0">
                    <td className="p-2 font-medium text-slate-700">{fotografo.nombrecompleto}</td>
                    <td className="p-2">{fotografo.telefono || '—'}</td>
                    <td className="p-2">{fotografo.correo || '—'}</td>
                    <td className="p-2">{fotografo.especialidad || '—'}</td>
                    <td className="p-2">{fotografo.estado === 'activo' ? 'Activo' : 'Inactivo'}</td>
                    <td className="p-2">
                      <div className="flex justify-end gap-2">
                        <button type="button" className="btn btn-ghost" onClick={() => onEdit(fotografo)}>Editar</button>
                        <button type="button" className="btn btn-ghost" onClick={() => onDelete(fotografo.id)}>Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted text-sm">Todavía no hay fotógrafos registrados.</p>
        )}
      </div>
    </div>
  )
}
