import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import AdminHelpCard from '../components/AdminHelpCard'

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function normalizeTime(value, fallback = '08:00') {
  if (!value) return fallback
  const [hours = '00', minutes = '00'] = String(value).split(':')
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function formatDateKey(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDateKey(key) {
  if (!key) return null
  const [year, month, day] = key.split('-').map(Number)
  if (!year || !month || !day) return null
  const date = new Date(year, month - 1, day)
  if (Number.isNaN(date.getTime())) return null
  return date
}

function cloneAvailabilityMap(source) {
  return Object.fromEntries(
    Object.entries(source || {}).map(([fotografoId, dias]) => [
      fotografoId,
      Object.fromEntries(
        Object.entries(dias || {}).map(([fecha, info]) => [
          fecha,
          { ...info }
        ])
      )
    ])
  )
}

function buildMonthGrid(reference) {
  const base = reference instanceof Date ? reference : new Date()
  const year = base.getFullYear()
  const month = base.getMonth()
  const firstDay = new Date(year, month, 1)
  const startOffset = firstDay.getDay()
  const startDate = new Date(year, month, 1 - startOffset)
  const cells = []
  const totalCells = 42

  for (let index = 0; index < totalCells; index += 1) {
    const current = new Date(startDate)
    current.setDate(startDate.getDate() + index)
    cells.push({
      date: current,
      key: formatDateKey(current),
      inCurrentMonth: current.getMonth() === month
    })
  }

  return cells
}

function formatHumanDate(key) {
  const date = parseDateKey(key)
  if (!date) return ''
  return new Intl.DateTimeFormat('es-GT', { dateStyle: 'long' }).format(date)
}

export default function AdminAgenda() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [photographers, setPhotographers] = useState([])
  const [availability, setAvailability] = useState({})
  const [initialAvailability, setInitialAvailability] = useState({})
  const [pendingChanges, setPendingChanges] = useState({})
  const [selectedPhotographerId, setSelectedPhotographerId] = useState(null)
  const [currentMonth, setCurrentMonth] = useState(() => new Date())
  const [dragState, setDragState] = useState({ active: false, startKey: null, targetValue: null })
  const [selectedDayForFilter, setSelectedDayForFilter] = useState(() => {
    if (typeof window === 'undefined') return null
    return window.localStorage.getItem('admin-agenda-selected-day')
  })

  const monthGrid = useMemo(() => buildMonthGrid(currentMonth), [currentMonth])

  const currentAvailability = availability[selectedPhotographerId] || {}
  const cambiosPendientes = pendingChanges[selectedPhotographerId] || {}

  const totalCambios = useMemo(() => {
    return Object.values(pendingChanges).reduce((total, changes) => total + Object.keys(changes || {}).length, 0)
  }, [pendingChanges])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(timer)
  }, [toast])

  const loadAgenda = useCallback(async () => {
    setLoading(true)
    setToast(null)

    const { data: agendaData = [], error: agendaError } = await supabase
      .from('agenda')
      .select('id, idfotografo, fecha, horainicio, horafin, disponible')

    if (agendaError) {
      console.error('Error cargando agenda', agendaError)
      setLoading(false)
      setPhotographers([])
      setAvailability({})
      setInitialAvailability({})
      setPendingChanges({})
      setToast({ type: 'error', message: 'No se pudo cargar la agenda de fotógrafos.' })
      return
    }

    const photographerIds = Array.from(
      new Set(agendaData.map(item => item.idfotografo).filter(Boolean))
    )

    let photographersData = []
    if (photographerIds.length) {
      const { data, error } = await supabase
        .from('usuario')
        .select('id, username, correo')
        .in('id', photographerIds)
        .order('username', { ascending: true })

      if (error) {
        console.warn('Error cargando fotógrafos', error)
      }
      photographersData = Array.isArray(data) ? data : []
    }

    const availabilityMap = agendaData.reduce((acc, entry) => {
      if (!entry.idfotografo) return acc
      const key = formatDateKey(entry.fecha)
      if (!key) return acc
      if (!acc[entry.idfotografo]) acc[entry.idfotografo] = {}
      acc[entry.idfotografo][key] = {
        id: entry.id,
        disponible: entry.disponible !== false,
        horainicio: normalizeTime(entry.horainicio, '08:00'),
        horafin: normalizeTime(entry.horafin, '17:00')
      }
      return acc
    }, {})

    const clonedAvailability = cloneAvailabilityMap(availabilityMap)

    setPhotographers(photographersData)
    setAvailability(clonedAvailability)
    setInitialAvailability(cloneAvailabilityMap(availabilityMap))
    setPendingChanges({})

    if (!photographersData.length) {
      setSelectedPhotographerId(null)
    } else {
      setSelectedPhotographerId(prev => {
        if (prev && photographersData.some(foto => foto.id === prev)) {
          return prev
        }
        return photographersData[0]?.id ?? null
      })
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    loadAgenda()
  }, [loadAgenda])

  const updateAvailabilityForKeys = useCallback(
    (fotografoId, keys, value) => {
      if (!fotografoId || !Array.isArray(keys) || !keys.length) return

      const currentPhotographerAvailability = availability[fotografoId] || {}
      const initialPhotographerAvailability = initialAvailability[fotografoId] || {}

      const updates = keys.map(key => {
        const baseActual = currentPhotographerAvailability[key]
        const baseInicial = initialPhotographerAvailability[key] || {}
        return {
          key,
          next: {
            id: baseActual?.id ?? baseInicial?.id ?? null,
            disponible: value,
            horainicio: normalizeTime(baseActual?.horainicio || baseInicial?.horainicio, '08:00'),
            horafin: normalizeTime(baseActual?.horafin || baseInicial?.horafin, '17:00')
          }
        }
      })

      setAvailability(prev => {
        const current = { ...(prev[fotografoId] || {}) }
        updates.forEach(({ key, next }) => {
          current[key] = next
        })
        return { ...prev, [fotografoId]: current }
      })

      setPendingChanges(prev => {
        const current = { ...(prev[fotografoId] || {}) }
        updates.forEach(({ key, next }) => {
          const baseEntry = initialPhotographerAvailability[key]
          if (baseEntry && baseEntry.disponible === next.disponible) {
            delete current[key]
          } else {
            current[key] = {
              disponible: next.disponible,
              horainicio: next.horainicio,
              horafin: next.horafin
            }
          }
        })
        if (!Object.keys(current).length) {
          const { [fotografoId]: _, ...rest } = prev
          return rest
        }
        return { ...prev, [fotografoId]: current }
      })
    },
    [availability, initialAvailability]
  )

  const handlePointerEnd = useCallback(() => {
    setDragState({ active: false, startKey: null, targetValue: null })
  }, [])

  const handleDayPointerDown = useCallback(
    (event, day) => {
      event.preventDefault()
      if (!selectedPhotographerId || !day?.key) return

      const currentValue = Boolean(currentAvailability[day.key]?.disponible)
      const targetValue = !currentValue

      updateAvailabilityForKeys(selectedPhotographerId, [day.key], targetValue)
      setDragState({ active: true, startKey: day.key, targetValue })
      setSelectedDayForFilter(day.key)

      if (typeof window !== 'undefined') {
        window.localStorage.setItem('admin-agenda-selected-day', day.key)
      }
    },
    [currentAvailability, selectedPhotographerId, updateAvailabilityForKeys]
  )

  const handleDayPointerEnter = useCallback(
    (_event, day) => {
      if (!dragState.active || !dragState.startKey || !selectedPhotographerId) return
      if (!day?.key) return
      const start = parseDateKey(dragState.startKey)
      const end = parseDateKey(day.key)
      if (!start || !end) return

      const rangeKeys = []
      const direction = start <= end ? 1 : -1
      const cursor = new Date(start)
      while ((direction > 0 && cursor <= end) || (direction < 0 && cursor >= end)) {
        const keyValue = formatDateKey(cursor)
        if (keyValue) rangeKeys.push(keyValue)
        cursor.setDate(cursor.getDate() + direction)
      }

      updateAvailabilityForKeys(selectedPhotographerId, rangeKeys, dragState.targetValue)
      setSelectedDayForFilter(day.key)
    },
    [dragState, selectedPhotographerId, updateAvailabilityForKeys]
  )

  const handleDayPointerUp = useCallback(() => {
    handlePointerEnd()
  }, [handlePointerEnd])

  const handleMonthChange = direction => {
    setCurrentMonth(prev => {
      const next = new Date(prev)
      next.setMonth(prev.getMonth() + direction)
      return next
    })
  }

  const handleSaveAgenda = async () => {
    const updates = []

    Object.entries(pendingChanges).forEach(([fotografoId, cambios]) => {
      Object.entries(cambios || {}).forEach(([fecha, info]) => {
        if (!fecha) return
        const currentEntry = availability[fotografoId]?.[fecha]
        const initialEntry = initialAvailability[fotografoId]?.[fecha]
        updates.push({
          idfotografo: Number(fotografoId),
          fecha,
          horainicio: normalizeTime(info?.horainicio || currentEntry?.horainicio || initialEntry?.horainicio, '08:00'),
          horafin: normalizeTime(info?.horafin || currentEntry?.horafin || initialEntry?.horafin, '17:00'),
          disponible: Boolean(info?.disponible)
        })
      })
    })

    if (!updates.length) {
      setToast({ type: 'warning', message: 'No hay cambios pendientes para guardar.' })
      return
    }

    setSaving(true)

    try {
      await Promise.all(
        updates.map(async update => {
          if (!update.fecha) return
          const response = await fetch(`/api/agenda/${update.idfotografo}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(update)
          })

          if (!response.ok) {
            const detail = await response.text().catch(() => '')
            throw new Error(detail || 'Error en la actualización de agenda')
          }
        })
      )

      setToast({ type: 'success', message: '✅ Agenda actualizada correctamente' })
      setInitialAvailability(cloneAvailabilityMap(availability))
      setPendingChanges({})
      await loadAgenda()
    } catch (error) {
      console.error('Error guardando agenda', error)
      setToast({ type: 'error', message: 'No se pudieron guardar los cambios de agenda.' })
    } finally {
      setSaving(false)
    }
  }

  const handleNavigateToReservas = () => {
    if (!selectedDayForFilter) return
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('admin-agenda-selected-day', selectedDayForFilter)
    }
    navigate(`/admin/reservas?agendaDia=${selectedDayForFilter}`)
  }

  const handleClearSelectedDay = async () => {
    setSelectedDayForFilter(null)
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('admin-agenda-selected-day')
    }
    await loadAgenda()
    setToast({ type: 'success', message: 'Filtro de fecha eliminado' })
  }

  const renderDay = day => {
    const key = day.key
    const disponible = Boolean(currentAvailability[key]?.disponible)
    const enMes = day.inCurrentMonth
    const enRango = dragState.active && dragState.startKey && key
      ? (() => {
          const start = parseDateKey(dragState.startKey)
          const current = parseDateKey(key)
          if (!start || !current) return false
          const min = start < current ? start : current
          const max = start > current ? start : current
          return current >= min && current <= max
        })()
      : false
    const tieneCambio = Boolean(cambiosPendientes[key])
    const esSeleccionado = selectedDayForFilter === key

    const dayClassNames = [
      'agenda-day',
      disponible ? 'agenda-day--available' : 'agenda-day--busy',
      enMes ? '' : 'agenda-day--muted',
      tieneCambio ? 'agenda-day--pending' : '',
      enRango ? 'agenda-day--drag' : '',
      esSeleccionado ? 'agenda-day--selected' : ''
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <button
        key={key}
        type="button"
        className={dayClassNames}
        onPointerDown={event => handleDayPointerDown(event, day)}
        onPointerEnter={event => handleDayPointerEnter(event, day)}
        onPointerUp={handleDayPointerUp}
        onPointerCancel={handlePointerEnd}
      >
        <span className="agenda-day__number">{day.date.getDate()}</span>
      </button>
    )
  }

  return (
    <div className="admin-page space-y-6">
      {toast && (
        <div className={`admin-toast admin-toast--${toast.type}`} role="status">
          <span>{toast.message}</span>
          <button type="button" onClick={() => setToast(null)} aria-label="Cerrar notificación">
            ×
          </button>
        </div>
      )}

      <div className="admin-section space-y-4">
        <header className="admin-header">
          <div>
            <h1 className="text-xl font-semibold text-umber">Agenda de Fotógrafos</h1>
            <p className="muted text-sm">Administra los días disponibles de cada miembro del equipo.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn btn-ghost" onClick={loadAgenda} disabled={loading}>
              {loading ? 'Cargando…' : 'Recargar agenda'}
            </button>
            <button
              type="button"
              className="bulk-action-apply"
              onClick={handleSaveAgenda}
              disabled={!totalCambios || saving}
            >
              {saving ? 'Guardando…' : 'Actualizar agenda'}
            </button>
          </div>
        </header>

        <div className="agenda-layout">
          <aside className="agenda-sidebar">
            <h2 className="agenda-sidebar__title">Fotógrafos</h2>
            {loading ? (
              <p className="muted text-sm">Cargando fotógrafos…</p>
            ) : photographers.length ? (
              <ul className="agenda-sidebar__list">
                {photographers.map(fotografo => {
                  const isActive = fotografo.id === selectedPhotographerId
                  return (
                    <li key={fotografo.id}>
                      <button
                        type="button"
                        className={`agenda-sidebar__button ${isActive ? 'is-active' : ''}`}
                        onClick={() => setSelectedPhotographerId(fotografo.id)}
                      >
                        <span className="agenda-sidebar__name">{fotografo.username || 'Sin nombre'}</span>
                        <span className="agenda-sidebar__email">{fotografo.correo || '—'}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="muted text-sm">No se encontraron fotógrafos con agenda registrada.</p>
            )}
          </aside>

          <div className="agenda-main" onPointerUp={handlePointerEnd} onPointerLeave={handlePointerEnd}>
            <div className="agenda-main__header">
              <button type="button" className="agenda-nav" onClick={() => handleMonthChange(-1)}>
                ←
              </button>
              <div className="agenda-main__title">
                {new Intl.DateTimeFormat('es-GT', { month: 'long', year: 'numeric' }).format(currentMonth)}
              </div>
              <button type="button" className="agenda-nav" onClick={() => handleMonthChange(1)}>
                →
              </button>
            </div>

            {selectedPhotographerId ? (
              <div className="agenda-calendar-wrapper">
                <div className="agenda-calendar">
                  {DAY_LABELS.map(label => (
                    <div key={label} className="agenda-day agenda-day--label">
                      {label}
                    </div>
                  ))}
                  {monthGrid.map(renderDay)}
                </div>

                <div className="agenda-actions">
                  <div className="agenda-summary">
                    <span className="agenda-summary__label">Cambios pendientes</span>
                    <span className="agenda-summary__value">{totalCambios}</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={handleNavigateToReservas}
                    disabled={!selectedDayForFilter}
                  >
                    Ver reservas del {selectedDayForFilter ? formatHumanDate(selectedDayForFilter) : 'día seleccionado'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={handleClearSelectedDay}
                    disabled={!selectedDayForFilter || loading}
                  >
                    ❌ Limpiar filtro
                  </button>
                </div>
              </div>
            ) : (
              <p className="muted text-sm">Selecciona un fotógrafo para gestionar su disponibilidad.</p>
            )}
          </div>
        </div>
      </div>

      <div className="admin-section">
        <AdminHelpCard title="Consejos para la planificación">
          <p>Haz clic y arrastra sobre el calendario para habilitar rangos completos de disponibilidad.</p>
          <p>Utiliza el botón de reservas para revisar qué días necesitan cobertura.</p>
          <p>Procura actualizar la agenda cada semana para mantener al equipo alineado.</p>
        </AdminHelpCard>
      </div>
    </div>
  )
}
