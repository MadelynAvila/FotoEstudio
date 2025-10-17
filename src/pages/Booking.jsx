import { useEffect, useState } from 'react'
import { useAuth } from '../auth/authContext'
import { supabase } from '../lib/supabaseClient'

const initialForm = { nombre: '', telefono: '', correo: '', paqueteId: '', fecha: '' }

export default function Booking(){
  const [form, setForm] = useState(initialForm)
  const [paquetes, setPaquetes] = useState([])
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [prefilled, setPrefilled] = useState(false)
  const { user } = useAuth()

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

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMensaje('')
    setError('')

    if (!user) {
      setError('Debes iniciar sesión para reservar una sesión.')
      return
    }

    const nombre = (form.nombre ?? '').trim()
    const telefono = (form.telefono ?? '').trim()
    const correo = (form.correo ?? '').trim()
    const paqueteId = form.paqueteId
    const fechaReserva = form.fecha

    if (!nombre || !telefono || !correo || !paqueteId || !fechaReserva) {
      setError('Por favor completa todos los campos antes de enviar la reserva.')
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
        console.error('No se pudo verificar el registro de cliente', clienteSelectError)
        setError('No pudimos validar tu cuenta en este momento. Intenta nuevamente más tarde.')
        return
      }

      if (!clienteExistente) {
        const { error: crearClienteError } = await supabase
          .from('cliente')
          .insert([
            {
              idusuario: user.id,
              Descuento: 0
            }
          ])

        if (crearClienteError) {
          console.error('No se pudo registrar al cliente', crearClienteError)
          setError('No pudimos registrar tus datos en este momento. Intenta nuevamente más tarde.')
          return
        }
      }

      const { data: rolFotografo, error: rolFotografoError } = await supabase
        .from('rol')
        .select('id, nombre')
        .ilike('nombre', 'fotogra%')
        .maybeSingle()

      if (rolFotografoError || !rolFotografo) {
        console.error('No se pudo obtener el rol de fotógrafo', rolFotografoError)
        setError('Actualmente no tenemos disponibilidad para agendar tu sesión. Intenta más tarde.')
        return
      }

      const { data: fotografoData, error: fotografoError } = await supabase
        .from('usuario')
        .select('id, username')
        .eq('idrol', rolFotografo.id)
        .limit(1)
        .single()

      if (fotografoError || !fotografoData) {
        console.error('No se encontró un fotógrafo disponible', fotografoError)
        setError('Actualmente no tenemos disponibilidad para agendar tu sesión. Intenta más tarde.')
        return
      }

      const agendaPayload = {
        idfotografo: fotografoData.id,
        fecha: fechaReserva,
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

      const paqueteSeleccionado = paquetes.find(p => String(p.id) === String(paqueteId))
      const nombreActividad = paqueteSeleccionado
        ? `${paqueteSeleccionado.nombre_paquete} - ${nombre}`
        : nombre

      const { error: actividadError } = await supabase
        .from('actividad')
        .insert([
          {
            idcliente: user.id,
            idagenda: agendaData.id,
            idpaquete: Number(paqueteId),
            estado_pago: 'Pendiente',
            nombre_actividad: nombreActividad,
            ubicacion: null
          }
        ])

      if (actividadError) {
        console.error('No se pudo registrar la actividad', actividadError)
        setError('No pudimos registrar tu reserva. Intenta nuevamente más tarde.')
      } else {
        setMensaje('Reserva enviada con éxito ✅')
        setForm({
          ...initialForm,
          nombre,
          telefono,
          correo
        })
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="container-1120 py-6">
      <h2 className="text-2xl font-display mb-4">Reservar sesión</h2>
      {!user && (
        <div className="mb-4 rounded-xl2 border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900">
          Debes iniciar sesión o registrarte para completar una reserva.
        </div>
      )}
      <form onSubmit={handleSubmit} className="card p-4 grid gap-3 max-w-3xl">
        <input
          placeholder="Nombre"
          value={form.nombre}
          onChange={e => updateField('nombre', e.target.value)}
          className="border rounded-xl2 px-3 py-2"
          disabled={!user || enviando}
        />
        <input
          placeholder="Teléfono"
          value={form.telefono}
          onChange={e => updateField('telefono', e.target.value)}
          className="border rounded-xl2 px-3 py-2"
          disabled={!user || enviando}
        />
        <input
          placeholder="Correo electrónico"
          value={form.correo}
          onChange={e => updateField('correo', e.target.value)}
          className="border rounded-xl2 px-3 py-2"
          disabled={!user || enviando}
        />
        <select
          value={form.paqueteId}
          onChange={e => updateField('paqueteId', e.target.value)}
          className="border rounded-xl2 px-3 py-2"
          disabled={!user || enviando}
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
          disabled={!user || enviando}
        />
        <button className="btn btn-primary" disabled={!user || enviando}>
          {enviando ? 'Enviando…' : 'Enviar'}
        </button>
      </form>
      {error && <p className="mt-2 text-red-600 text-sm">{error}</p>}
      {mensaje && <p className="mt-2 text-green-600">{mensaje}</p>}
    </div>
  )
}
