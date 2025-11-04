const DEFAULT_STATES = [
  {
    id: 1,
    key: 'pendiente',
    label: 'Pendiente',
    badgeClass: 'bg-amber-100 text-amber-700',
    textClass: 'text-amber-700'
  },
  {
    id: 2,
    key: 'con-anticipo',
    label: 'Con anticipo',
    badgeClass: 'bg-sky-100 text-sky-700',
    textClass: 'text-sky-700'
  },
  {
    id: 3,
    key: 'pagado',
    label: 'Pagado',
    badgeClass: 'bg-emerald-100 text-emerald-700',
    textClass: 'text-emerald-700'
  }
]

function normalize(value) {
  if (typeof value === 'number') {
    return String(value)
  }
  if (!value) return ''
  return String(value)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
}

export function mapStates(states) {
  const list = Array.isArray(states) && states.length ? states : DEFAULT_STATES
  const byId = new Map()
  const byKey = new Map()

  list.forEach(state => {
    if (!state) return
    const entry = {
      ...state,
      id: state.id ?? null,
      key: normalize(state.key) || normalize(state.nombre_estado) || null,
      label: state.label || state.nombre_estado || ''
    }

    if (entry.id != null) {
      byId.set(Number(entry.id), entry)
    }
    if (entry.key) {
      byKey.set(entry.key, entry)
    }
    const normalizedLabel = normalize(entry.label)
    if (normalizedLabel && !byKey.has(normalizedLabel)) {
      byKey.set(normalizedLabel, entry)
    }
  })

  return { list, byId, byKey }
}

export function resolvePaymentState(state, lookupStates) {
  const { list, byId, byKey } = mapStates(lookupStates)

  if (state && typeof state === 'object') {
    const entry = state
    if (entry.id != null) {
      const found = byId.get(Number(entry.id))
      if (found) return found
    }
    if (entry.nombre_estado) {
      const found = byKey.get(normalize(entry.nombre_estado))
      if (found) return found
    }
    if (entry.key) {
      const found = byKey.get(normalize(entry.key))
      if (found) return found
    }
  }

  if (typeof state === 'number' && byId.has(Number(state))) {
    return byId.get(Number(state))
  }

  const normalized = normalize(state)
  if (normalized && byKey.has(normalized)) {
    return byKey.get(normalized)
  }

  return list[0]
}

export function getPaymentStateClasses(state, lookupStates) {
  const resolved = resolvePaymentState(state, lookupStates)
  return {
    label: resolved?.label || 'Pendiente',
    id: resolved?.id ?? null,
    key: resolved?.key || 'pendiente',
    badgeClass: resolved?.badgeClass || 'bg-amber-100 text-amber-700',
    textClass: resolved?.textClass || 'text-amber-700'
  }
}

export function calculatePaymentProgress(total, price) {
  const montoTotal = Number(total) || 0
  const precio = Number(price) || 0
  if (precio <= 0) {
    return {
      percentage: 0,
      remaining: 0,
      covered: montoTotal
    }
  }
  const percentage = Math.min(100, Math.round((montoTotal / precio) * 100))
  const remaining = Math.max(0, precio - montoTotal)
  return {
    percentage,
    remaining,
    covered: montoTotal
  }
}

export function summarizePayments(pagos, price, states) {
  const payments = Array.isArray(pagos) ? pagos : []
  const total = payments.reduce((acc, pago) => acc + (Number(pago?.monto) || 0), 0)
  const progress = calculatePaymentProgress(total, price)

  let overallState = resolvePaymentState(1, states)
  if (total <= 0) {
    overallState = resolvePaymentState(1, states)
  } else if (progress.percentage >= 100) {
    overallState = resolvePaymentState(3, states)
  } else {
    overallState = resolvePaymentState(2, states)
  }

  return {
    total,
    progress,
    overallState,
    payments
  }
}

export default DEFAULT_STATES
