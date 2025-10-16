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
        .select('id, nombre')
        .order('nombre', { ascending: true })
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
      const fechaReserva = form.fecha ? new Date(`${form.fecha}T00:00:00`).toISOString() : null

      const { data: cliente, error: clienteError } = await supabase
        .from('cliente')
        .insert([
          {
            nombrecompleto: form.nombre,
            telefono: form.telefono || null
          }
        ])
        .select('id, nombrecompleto, telefono')
        .single()

      if (clienteError) {
        console.error('No se pudo registrar el cliente', clienteError)
        setError('No pudimos registrar tus datos en este momento. Intenta nuevamente más tarde.')
        return
      }

      const { error: actividadError } = await supabase
        .from('actividad')
        .insert([
          {
            idcliente: cliente.id,
            comentarios: form.paquete ? `Paquete solicitado: ${form.paquete}` : null,
            estado: 'pendiente',
            fechareserva: fechaReserva
          }
        ])

      if (actividadError) {
        console.error('No se pudo registrar la reserva', actividadError)
        setError('No pudimos guardar tu reserva. Intenta nuevamente más tarde.')
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
            <option key={paquete.id} value={paquete.id}>{paquete.nombre}</option>
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
