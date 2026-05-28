'use client'

import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { Upload, Download, X, CheckCircle2, AlertCircle } from 'lucide-react'

type CsvRow = Record<string, string>

type ImportResult = {
  total: number
  created: number
  failed: number
  createdNames: string[]
  errors: { row: number; reason: string }[]
}

// Faz parse de uma string CSV simples (sem deps externas)
function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split('\n').map((l) => l.replace(/\r/g, ''))
  if (lines.length < 2) return []
  const headers = lines[0].split(',')
  return lines.slice(1).map((line) => {
    const values = line.split(',')
    return Object.fromEntries(headers.map((h, i) => [h.trim(), (values[i] ?? '').trim()]))
  })
}

// Gera e faz download de um CSV template
function downloadTemplate() {
  const content = 'name,gender,birthDate,email,nationality\nJoão Silva,M,1995-03-20,joao@email.com,BR\nMaria Santos,F,1998-07-15,,BR'
  const blob = new Blob([content], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'template-atletas.csv'
  a.click()
  URL.revokeObjectURL(url)
}

interface Props {
  open: boolean
  onClose: () => void
}

export function CsvImportModal({ open, onClose }: Props) {
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<CsvRow[]>([])
  const [fileName, setFileName] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)

  const importMutation = useMutation({
    mutationFn: (data: CsvRow[]) =>
      apiFetch<ImportResult>('/athletes/import-csv', { method: 'POST', json: data }),
    onSuccess: (data) => {
      setResult(data)
      queryClient.invalidateQueries({ queryKey: ['athletes'] })
    },
  })

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setResult(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setRows(parseCsv(text))
    }
    reader.readAsText(file, 'UTF-8')
  }

  function handleClose() {
    setRows([])
    setFileName('')
    setResult(null)
    if (fileRef.current) fileRef.current.value = ''
    onClose()
  }

  if (!open) return null

  const previewHeaders = rows[0] ? Object.keys(rows[0]) : []
  const previewRows = rows.slice(0, 5)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

      <div className="relative z-10 w-full max-w-2xl bg-background rounded-2xl border border-border shadow-2xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h3 className="text-base font-semibold">Importar atletas via CSV</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Colunas obrigatórias: <code className="bg-muted px-1 rounded">name</code>, <code className="bg-muted px-1 rounded">gender</code> (M ou F)
            </p>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Download template */}
          <button
            onClick={downloadTemplate}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Baixar template CSV
          </button>

          {/* Upload */}
          {!result && (
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors"
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">{fileName || 'Clique para selecionar o arquivo CSV'}</p>
              <p className="text-xs text-muted-foreground mt-1">Apenas arquivos .csv</p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFile}
              />
            </div>
          )}

          {/* Preview */}
          {rows.length > 0 && !result && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">
                Preview — {rows.length} linha{rows.length !== 1 ? 's' : ''} detectada{rows.length !== 1 ? 's' : ''}
                {rows.length > 5 ? ` (mostrando as primeiras 5)` : ''}
              </p>
              <div className="rounded-lg border border-border overflow-auto max-h-48">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border">
                      {previewHeaders.map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {previewRows.map((row, i) => (
                      <tr key={i}>
                        {previewHeaders.map((h) => (
                          <td key={h} className="px-3 py-1.5 text-foreground">{row[h] || '—'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Resultado */}
          {result && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-green-700">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-sm font-semibold">{result.created} importado{result.created !== 1 ? 's' : ''}</span>
                </div>
                {result.failed > 0 && (
                  <div className="flex items-center gap-1.5 text-red-600">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm font-semibold">{result.failed} com erro</span>
                  </div>
                )}
              </div>
              {result.errors.length > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-1 max-h-40 overflow-auto">
                  {result.errors.map((err) => (
                    <p key={err.row} className="text-xs text-red-700">
                      <span className="font-semibold">Linha {err.row}:</span> {err.reason}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/10">
          <button onClick={handleClose} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            {result ? 'Fechar' : 'Cancelar'}
          </button>
          {rows.length > 0 && !result && (
            <button
              onClick={() => importMutation.mutate(rows)}
              disabled={importMutation.isPending}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {importMutation.isPending ? 'Importando...' : `Importar ${rows.length} atleta${rows.length !== 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
