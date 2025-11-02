import { useEffect, useMemo, useRef } from 'react'

const SCROLL_DEBOUNCE_MS = 120

const formatearHoraAMPM = (valor) => {
  if (!valor || typeof valor !== 'string') return ''
  const [horasStr, minutosStr] = valor.split(':')
  const horas = Number(horasStr)
  const minutos = Number(minutosStr)
  if (Number.isNaN(horas) || Number.isNaN(minutos)) return valor
  const periodo = horas >= 12 ? 'PM' : 'AM'
  const horas12 = horas % 12 === 0 ? 12 : horas % 12
  return `${horas12}:${String(minutos).padStart(2, '0')} ${periodo}`
}

export default function TimeWheelPicker({
  id,
  label = '',
  value = '',
  onChange,
  options = [],
  disabled = false,
  placeholder = 'Sin horarios disponibles'
}) {
  const listRef = useRef(null)
  const optionRefs = useRef([])
  const scrollTimeoutRef = useRef(null)
  const labelId = id ? `${id}-label` : undefined

  const normalizados = useMemo(() => {
    if (!Array.isArray(options)) return []
    return options
      .filter(opcion => opcion != null)
      .map(opcion => {
        if (typeof opcion === 'object') {
          const valor = opcion.value ?? opcion.hora ?? opcion.label ?? ''
          const etiqueta = opcion.label ?? formatearHoraAMPM(valor)
          return { value: valor, label: etiqueta }
        }
        const valor = String(opcion)
        return { value: valor, label: formatearHoraAMPM(valor) }
      })
      .filter(opcion => opcion.value)
  }, [options])

  const valorSeleccionado = useMemo(() => {
    if (!value) return ''
    const existe = normalizados.some(opcion => opcion.value === value)
    return existe ? value : ''
  }, [value, normalizados])

  useEffect(() => {
    if (!listRef.current) return
    if (!valorSeleccionado) {
      listRef.current.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    const indice = normalizados.findIndex(opcion => opcion.value === valorSeleccionado)
    if (indice === -1) return
    const elemento = optionRefs.current[indice]
    if (!elemento) return
    elemento.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [valorSeleccionado, normalizados])

  useEffect(() => () => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current)
    }
  }, [])

  const actualizarPorScroll = () => {
    if (disabled) return
    if (!listRef.current || !normalizados.length) return

    const contenedor = listRef.current
    const centro = contenedor.scrollTop + contenedor.clientHeight / 2

    let indiceMasCercano = 0
    let diferenciaMinima = Number.POSITIVE_INFINITY

    optionRefs.current.forEach((elemento, indice) => {
      if (!elemento) return
      const centroElemento = elemento.offsetTop + elemento.offsetHeight / 2
      const diferencia = Math.abs(centroElemento - centro)
      if (diferencia < diferenciaMinima) {
        diferenciaMinima = diferencia
        indiceMasCercano = indice
      }
    })

    const opcion = normalizados[indiceMasCercano]
    if (!opcion) return
    if (opcion.value !== valorSeleccionado) {
      onChange(opcion.value)
    }
    const elemento = optionRefs.current[indiceMasCercano]
    if (elemento) {
      elemento.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }

  const manejarScroll = () => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current)
    }
    scrollTimeoutRef.current = setTimeout(actualizarPorScroll, SCROLL_DEBOUNCE_MS)
  }

  const manejarKeyDown = (event) => {
    if (disabled) return
    if (!normalizados.length) return
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    event.preventDefault()
    const paso = event.key === 'ArrowUp' ? -1 : 1
    const indiceActual = valorSeleccionado
      ? normalizados.findIndex(opcion => opcion.value === valorSeleccionado)
      : -1
    const nuevoIndice = Math.min(
      normalizados.length - 1,
      Math.max(0, indiceActual + paso)
    )
    const opcion = normalizados[nuevoIndice]
    if (opcion) {
      onChange(opcion.value)
      const elemento = optionRefs.current[nuevoIndice]
      if (elemento) {
        elemento.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }
    }
  }

  optionRefs.current = []

  return (
    <div className="time-wheel-wrapper">
      {label && (
        <span className="time-wheel-label" id={labelId}>
          {label}
        </span>
      )}
      <div className={`time-wheel-shell ${disabled ? 'time-wheel-disabled' : ''}`}>
        {normalizados.length === 0 ? (
          <div className="time-wheel-empty">
            <span>{placeholder}</span>
          </div>
        ) : (
          <div className="time-wheel" ref={listRef} onScroll={manejarScroll}>
            <div className="time-wheel-gradient time-wheel-gradient-top" aria-hidden="true" />
            <div className="time-wheel-gradient time-wheel-gradient-bottom" aria-hidden="true" />
            <div className="time-wheel-indicator" aria-hidden="true" />
            <div
              role="listbox"
              aria-label={label ? undefined : 'Selector de hora'}
              aria-labelledby={label ? labelId : undefined}
              tabIndex={disabled ? -1 : 0}
              onKeyDown={manejarKeyDown}
              className="time-wheel-items focus:outline-none"
              id={id}
            >
              {normalizados.map((opcion, indice) => {
                const seleccionado = opcion.value === valorSeleccionado
                return (
                  <button
                    role="option"
                    key={opcion.value}
                    type="button"
                    disabled={disabled}
                    aria-selected={seleccionado}
                    className={`time-wheel-option ${seleccionado ? 'time-wheel-option-active' : ''}`}
                    onClick={() => {
                      onChange(opcion.value)
                    }}
                    title={`Hora en formato 24 horas: ${opcion.value}`}
                    ref={(el) => {
                      optionRefs.current[indice] = el
                    }}
                  >
                    <span className="time-wheel-option-label">{opcion.label}</span>
                    <span
                      aria-hidden="true"
                      className={`time-wheel-option-check ${seleccionado ? 'time-wheel-option-check-visible' : ''}`}
                    >
                      ✓
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
