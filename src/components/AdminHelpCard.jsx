import { useState } from 'react'

export default function AdminHelpCard({ title = '¿Necesitas ayuda?', children }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-xl2 border border-[var(--border)] bg-sand/60 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-sm uppercase tracking-wide text-umber">{title}</h3>
          {open ? (
            <div className="mt-3 text-sm text-slate-600 space-y-2">
              {children}
            </div>
          ) : (
            <p className="muted text-sm mt-2">Haz clic en el botón para ver tips rápidos sobre esta sección.</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setOpen(value => !value)}
          className="btn btn-ghost whitespace-nowrap"
        >
          {open ? 'Ocultar ayuda' : 'Ver ayuda'}
        </button>
      </div>
    </div>
  )
}
