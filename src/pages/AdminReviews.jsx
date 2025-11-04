import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import AdminHelpCard from '../components/AdminHelpCard'
import AdminDataTable from '../components/AdminDataTable'

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('es-GT')
}

export default function AdminReviews(){
  const [resenas, setResenas] = useState([])
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState({ type: '', message: '' })
  const [refreshing, setRefreshing] = useState(false)

  const fetchResenas = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('resena')
      .select('id, calificacion, comentario, fecha_resena')
      .order('id', { ascending: false })

    if (error) {
      console.error('No se pudieron cargar las reseñas', error)
      setResenas([])
      setFeedback({ type: 'error', message: 'No pudimos cargar las reseñas.' })
    } else {
      setResenas(data ?? [])
      setFeedback({ type: '', message: '' })
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchResenas()
  }, [])

  const onDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta reseña?')) return
    const { error } = await supabase.from('resena').delete().eq('id', id)
    if (error) {
      console.error('No se pudo eliminar la reseña', error)
      setFeedback({ type: 'error', message: 'No se pudo eliminar la reseña seleccionada.' })
    } else {
      setResenas(prev => prev.filter(item => item.id !== id))
      setFeedback({ type: 'success', message: 'Reseña eliminada correctamente.' })
    }
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await fetchResenas()
    setRefreshing(false)
  }

  const reviewColumns = useMemo(
    () => [
      {
        id: 'calificacion',
        label: 'Calificación',
        render: (resena) => (
          <span className="text-sm font-semibold text-umber">{resena.calificacion} ★</span>
        )
      },
      {
        id: 'comentario',
        label: 'Comentario',
        render: (resena) => (
          <p className="text-sm text-slate-600 whitespace-pre-line">{resena.comentario || 'Sin comentario'}</p>
        )
      },
      {
        id: 'fecha',
        label: 'Fecha',
        hideOnMobile: true,
        render: (resena) => (
          <span className="text-sm text-slate-500">{formatDate(resena.fecha_resena)}</span>
        )
      },
      {
        id: 'acciones',
        label: 'Acciones',
        align: 'right',
        render: (resena) => (
          <button type="button" className="btn btn-ghost" onClick={() => onDelete(resena.id)}>
            Eliminar
          </button>
        )
      }
    ],
    [onDelete]
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        <div className="card flex-1 p-5 space-y-4">
          <header className="space-y-1">
            <h1 className="text-xl font-semibold text-umber">Reseñas y testimonios</h1>
            <p className="muted text-sm">
              Consulta y modera las reseñas que las personas publican directamente desde el sitio web.
              Puedes eliminar comentarios que no cumplan con las políticas de la marca.
            </p>
          </header>
          <div className="grid gap-3 text-sm">
            <a href="/resenas" target="_blank" rel="noreferrer" className="btn btn-primary w-fit">
              Abrir página pública de reseñas
            </a>
            <button type="button" className="btn btn-ghost w-fit" onClick={onRefresh} disabled={refreshing}>
              {refreshing ? 'Actualizando…' : 'Actualizar listado'}
            </button>
            {feedback.message && (
              <p className={`text-sm ${feedback.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
                {feedback.message}
              </p>
            )}
          </div>
        </div>
        <div className="lg:w-[320px]">
          <AdminHelpCard title="Buenas prácticas">
            <p>Revisa con frecuencia las reseñas nuevas para detectar oportunidades de mejora.</p>
            <p>Conserva solo comentarios auténticos y respetuosos. Elimina los que no aporten valor.</p>
            <p>Comparte las experiencias positivas en tus campañas para reforzar la confianza.</p>
          </AdminHelpCard>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="text-lg font-semibold text-umber mb-3">Reseñas registradas</h2>
        {loading ? (
          <p className="muted text-sm">Cargando reseñas…</p>
        ) : resenas.length ? (
          <AdminDataTable
            columns={reviewColumns}
            rows={resenas}
            rowKey={resena => resena.id}
            caption={`Reseñas registradas: ${resenas.length}`}
          />
        ) : (
          <p className="muted text-sm">No hay reseñas registradas todavía.</p>
        )}
      </div>
    </div>
  )
}
