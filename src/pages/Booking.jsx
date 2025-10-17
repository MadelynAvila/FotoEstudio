import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const initialForm = { nombre: '', telefono: '', paqueteId: '', fecha: '' }

export default function Booking(){
  const [form, setForm] = useState(initialForm)
  const [paquetes, setPaquetes] = useState([])
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    const loadPaquetes = async () => {
      const { data, error: paquetesError } = await supabase
        .from('paquete')
        .select('id, nombre_paquete')
        .order('nombre_paquete', { ascending: true })
      if (paquetesError) {
        console.error('No se pudieron cargar los paquetes', paquetesError)
      } else {
        setPaquetes(data ?? [])
      }
    }
    loadPaquetes()
  }, [])

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMensaje('')
    setError('')

    if (!form.nombre || !form.telefono || !form.paqueteId || !form.fecha) {
      setError('Por favor completa todos los campos antes de enviar la reserva.')
      return
    }

    try {
      setEnviando(true)

      const { data: rolesData, error: rolesError } = await supabase
        .from('rol')
        .select('id, nombre')

      if (rolesError) {
        console.error('No se pudieron obtener los roles', rolesError)
        setError('Ocurrió un problema al procesar tu reserva. Intenta nuevamente más tarde.')
        return
      }

      const rolCliente = rolesData?.find(rol => rol.nombre?.toLowerCase() === 'cliente')
      const rolFotografo = rolesData?.find(rol => rol.nombre?.toLowerCase() === 'fotografo' || rol.nombre?.toLowerCase() === 'fotógrafo')

      const { data: usuarioData, error: usuarioError } = await supabase
        .from('usuario')
        .insert([
          {
            username: form.nombre,
            telefono: form.telefono || null,
            idrol: rolCliente?.id ?? null
          }
        ])
        .select('id')
        .single()

      if (usuarioError || !usuarioData) {
        console.error('No se pudo crear el usuario del cliente', usuarioError)
        setError('No pudimos registrar tus datos en este momento. Intenta nuevamente más tarde.')
        return
      }

      const { data: clienteData, error: clienteError } = await supabase
        .from('cliente')
        .insert([
          {
            idusuario: usuarioData.id,
            Descuento: 0
          }
        ])
        .select('idcliente')
        .single()

      if (clienteError || !clienteData) {
        console.error('No se pudo registrar al cliente', clienteError)
        setError('No pudimos registrar tus datos en este momento. Intenta nuevamente más tarde.')
        return
      }

      const { data: fotografoData, error: fotografoError } = await supabase
        .from('usuario')
        .select('id')
        .eq('idrol', rolFotografo?.id ?? -1)
        .limit(1)
        .single()

      if (fotografoError || !fotografoData) {
        console.error('No se encontró un fotógrafo disponible', fotografoError)
        setError('Actualmente no tenemos disponibilidad para agendar tu sesión. Intenta más tarde.')
        return
      }

      const fecha = form.fecha
      const agendaPayload = {
        idfotografo: fotografoData.id,
        fecha,
        horainicio: '09:00:00',
        horafin: '10:00:00',
        disponible: false
      }

      const { data: agendaData, error: agendaError } = await supabase
        .from('agenda')
        .insert([agendaPayload])
        .select('id')
        .single()

      if (agendaError || !agendaData) {
        console.error('No se pudo crear la agenda para la actividad', agendaError)
        setError('No pudimos registrar tu reserva. Intenta nuevamente más tarde.')
        return
      }

      const { error: actividadError } = await supabase
        .from('actividad')
        .insert([
          {
            idcliente: usuarioData.id,
            idagenda: agendaData.id,
            idpaquete: Number(form.paqueteId),
            estado_pago: 'Pendiente',
            nombre_actividad: form.nombre,
            ubicacion: null
          }
        ])

      if (actividadError) {
        console.error('No se pudo registrar la actividad', actividadError)
        setError('No pudimos registrar tu reserva. Intenta nuevamente más tarde.')
      } else {
        setMensaje('Reserva enviada con éxito ✅')
        setForm(initialForm)
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="container-1120 py-6">
      <h2 className="text-2xl font-display mb-4">Reservar sesión</h2>
      <form onSubmit={handleSubmit} className="card p-4 grid gap-3 max-w-3xl">
        <input
          placeholder="Nombre"
          value={form.nombre}
          onChange={e => updateField('nombre', e.target.value)}
          className="border rounded-xl2 px-3 py-2"
        />
        <input
          placeholder="Teléfono"
          value={form.telefono}
          onChange={e => updateField('telefono', e.target.value)}
          className="border rounded-xl2 px-3 py-2"
        />
        <select
          value={form.paqueteId}
          onChange={e => updateField('paqueteId', e.target.value)}
          className="border rounded-xl2 px-3 py-2"
        >
          <option value="">Selecciona un paquete disponible</option>
          {paquetes.map(paquete => (
            <option key={paquete.id} value={paquete.id}>{paquete.nombre_paquete}</option>
          ))}
        </select>
        <input
          type="date"
          value={form.fecha}
          onChange={e => updateField('fecha', e.target.value)}
          className="border rounded-xl2 px-3 py-2"
        />
        <button className="btn btn-primary" disabled={enviando}>
          {enviando ? 'Enviando…' : 'Enviar'}
        </button>
      </form>
      {error && <p className="mt-2 text-red-600 text-sm">{error}</p>}
      {mensaje && <p className="mt-2 text-green-600">{mensaje}</p>}
    </div>
  )
}
