import { useEffect, useMemo, useState } from 'react'

const DEFAULT_PAGE_SIZES = [5, 10, 20, 50]

const alignClassMap = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right'
}

export default function AdminDataTable({
  columns,
  rows,
  rowKey = 'id',
  emptyState = 'No hay registros para mostrar.',
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  defaultPageSize,
  caption
}) {
  const safePageSizeOptions = pageSizeOptions && pageSizeOptions.length ? pageSizeOptions : DEFAULT_PAGE_SIZES
  const initialPageSize = defaultPageSize && safePageSizeOptions.includes(defaultPageSize)
    ? defaultPageSize
    : safePageSizeOptions[0]

  const [pageSize, setPageSize] = useState(initialPageSize)
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPageSize(initialPageSize)
  }, [initialPageSize])

  useEffect(() => {
    setPage(1)
  }, [pageSize, rows])

  const totalPages = useMemo(() => {
    if (!rows || !rows.length) return 1
    return Math.max(1, Math.ceil(rows.length / pageSize))
  }, [rows, pageSize])

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const paginatedRows = useMemo(() => {
    if (!rows || !rows.length) return []
    const startIndex = (page - 1) * pageSize
    return rows.slice(startIndex, startIndex + pageSize)
  }, [rows, page, pageSize])

  const summaryText = useMemo(() => {
    if (!rows || !rows.length) return 'Sin registros'
    const from = (page - 1) * pageSize + 1
    const to = Math.min(page * pageSize, rows.length)
    return `Mostrando ${from.toLocaleString('es-GT')}–${to.toLocaleString('es-GT')} de ${rows.length.toLocaleString('es-GT')} registros`
  }, [rows, page, pageSize])

  const visiblePageButtons = useMemo(() => {
    const maxButtons = 5
    const buttons = []
    let start = Math.max(1, page - 2)
    let end = Math.min(totalPages, start + maxButtons - 1)

    if (end - start < maxButtons - 1) {
      start = Math.max(1, end - maxButtons + 1)
    }

    for (let current = start; current <= end; current += 1) {
      buttons.push(current)
    }

    return buttons
  }, [page, totalPages])

  const getRowKey = (row, index) => {
    if (typeof rowKey === 'function') {
      return rowKey(row, index)
    }
    if (row && row[rowKey] != null) {
      return row[rowKey]
    }
    return index
  }

  return (
    <div className="admin-data-table">
      <div className="admin-data-table__toolbar">
        <label className="admin-data-table__page-size">
          <span>Mostrar</span>
          <select
            value={pageSize}
            onChange={(event) => setPageSize(Number(event.target.value))}
          >
            {safePageSizeOptions.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <span>registros</span>
        </label>
        {caption && <p className="admin-data-table__caption">{caption}</p>}
      </div>

      <div className="admin-data-table__scroll">
        <table className="admin-data-table__table">
          <thead>
            <tr>
              {columns.map(column => {
                const alignClass = alignClassMap[column.align] || alignClassMap.left
                const visibilityClass = column.hideOnMobile ? 'hidden md:table-cell' : ''
                return (
                  <th key={column.id} className={`${alignClass} ${visibilityClass}`} scope="col">
                    {column.header ?? column.label}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {paginatedRows.length ? (
              paginatedRows.map((row, rowIndex) => (
                <tr key={getRowKey(row, rowIndex)}>
                  {columns.map(column => {
                    const alignClass = alignClassMap[column.align] || alignClassMap.left
                    const visibilityClass = column.hideOnMobile ? 'hidden md:table-cell' : ''
                    const content = column.render
                      ? column.render(row)
                      : column.accessor
                      ? row[column.accessor] ?? '—'
                      : null
                    return (
                      <td
                        key={column.id}
                        className={`${alignClass} ${visibilityClass}`}
                        data-label={column.label}
                      >
                        {content ?? '—'}
                      </td>
                    )
                  })}
                </tr>
              ))
            ) : (
              <tr>
                <td className="text-center" colSpan={columns.length}>{emptyState}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="admin-data-table__pagination">
        <p className="admin-data-table__summary">{summaryText}</p>
        <div className="admin-data-table__buttons">
          <button
            type="button"
            onClick={() => setPage(prev => Math.max(1, prev - 1))}
            disabled={page <= 1}
          >
            Anterior
          </button>
          {visiblePageButtons.map(buttonPage => (
            <button
              key={buttonPage}
              type="button"
              onClick={() => setPage(buttonPage)}
              className={buttonPage === page ? 'is-active' : ''}
            >
              {buttonPage}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
            disabled={page >= totalPages}
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  )
}
