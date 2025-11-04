import { forwardRef, useMemo } from 'react'
import DatePicker, { registerLocale } from 'react-datepicker'
import esLocale from 'date-fns/locale/es'
import 'react-datepicker/dist/react-datepicker.css'

registerLocale('es', esLocale)

const CalendarInput = forwardRef(({ value, onClick, placeholder, icon = '📅' }, ref) => (
  <button
    type="button"
    onClick={onClick}
    ref={ref}
    className="admin-calendar__trigger"
  >
    <span className="admin-calendar__icon" aria-hidden="true">{icon}</span>
    <span className={`admin-calendar__value ${value ? 'has-value' : ''}`}>
      {value || placeholder}
    </span>
  </button>
))

CalendarInput.displayName = 'CalendarInput'

export default function AdminDatePicker({
  label,
  value,
  onChange,
  selectsRange = false,
  placeholder = 'Selecciona una fecha',
  minDate,
  maxDate,
  isClearable = true,
  dateFormat = "dd 'de' MMMM yyyy"
}) {
  const displayValue = useMemo(() => {
    if (!value) return ''
    if (selectsRange) {
      const [start, end] = value
      if (!start && !end) return ''
      if (start && !end) {
        return start.toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric' })
      }
      if (start && end) {
        const startText = start.toLocaleDateString('es-GT', { day: '2-digit', month: 'short' })
        const endText = end.toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric' })
        return `${startText} – ${endText}`
      }
      return ''
    }
    return value.toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric' })
  }, [value, selectsRange])

  const startDate = selectsRange && value ? value[0] ?? null : null
  const endDate = selectsRange && value ? value[1] ?? null : null

  return (
    <div className="admin-calendar">
      {label && <span className="admin-calendar__label">{label}</span>}
      <DatePicker
        locale="es"
        selected={!selectsRange ? value ?? null : startDate}
        onChange={(date) => onChange(date)}
        selectsRange={selectsRange}
        startDate={selectsRange ? startDate : undefined}
        endDate={selectsRange ? endDate : undefined}
        minDate={minDate}
        maxDate={maxDate}
        shouldCloseOnSelect={!selectsRange}
        placeholderText={placeholder}
        dateFormat={dateFormat}
        calendarClassName="admin-calendar__popup"
        className="admin-calendar__input"
        popperClassName="admin-calendar__popper"
        isClearable={isClearable}
        customInput={<CalendarInput value={displayValue} placeholder={placeholder} />}
        fixedHeight
      />
    </div>
  )
}
