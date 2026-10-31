'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { downloadFromApi } from '@/lib/download'

interface ExportCsvButtonProps {
  /** Caminho na API, ex.: `/rankings/<id>/entries/export.csv`. */
  path: string
  /** Nome usado se a API não mandar `Content-Disposition`. */
  fallbackName: string
  /** Texto do botão; padrão "Exportar CSV". */
  label?: string
  className?: string
}

/** "Exportar CSV": baixa pelo `fetch` (para tratar erro na própria tela) e mostra a falha abaixo do botão. */
export function ExportCsvButton({ path, fallbackName, label = 'Exportar CSV', className }: ExportCsvButtonProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setBusy(true)
    setError(null)
    try {
      await downloadFromApi(path, fallbackName)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível exportar o CSV.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
      >
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}
        {busy ? 'Exportando...' : label}
      </button>
      {error && (
        <p role="alert" className="mt-1.5 max-w-xs text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
