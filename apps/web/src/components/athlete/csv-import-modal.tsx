'use client'

import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { Upload, Download, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

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
    importMutation.reset()
    if (fileRef.current) fileRef.current.value = ''
    onClose()
  }

  const previewHeaders = rows[0] ? Object.keys(rows[0]) : []
  const previewRows = rows.slice(0, 5)

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar atletas via CSV</DialogTitle>
          <DialogDescription>
            Colunas obrigatórias: <code className="rounded bg-muted px-1">name</code>, <code className="rounded bg-muted px-1">gender</code> (M ou F).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Button type="button" variant="ghost" size="sm" onClick={downloadTemplate} className="-ml-2">
            <Download aria-hidden="true" />
            Baixar template CSV
          </Button>

          {/* Upload: o <input> real fica dentro do rótulo; o foco aparece na área inteira. */}
          {!result && (
            <label className="block cursor-pointer rounded-xl border-2 border-dashed border-field-border p-8 text-center transition-colors hover:bg-muted/40 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring">
              <Upload className="mx-auto mb-2 size-8 text-muted-foreground" aria-hidden="true" />
              <span className="block text-sm font-medium">{fileName || 'Clique para selecionar o arquivo CSV'}</span>
              <span className="mt-1 block text-xs text-muted-foreground">Apenas arquivos .csv</span>
              <input ref={fileRef} type="file" accept=".csv" className="sr-only" onChange={handleFile} />
            </label>
          )}

          {rows.length > 0 && !result && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Pré-visualização: {rows.length} linha{rows.length !== 1 ? 's' : ''} detectada{rows.length !== 1 ? 's' : ''}
                {rows.length > 5 ? ' (mostrando as primeiras 5)' : ''}
              </p>
              <div tabIndex={0} role="region" aria-label="Pré-visualização do CSV" className="max-h-48 overflow-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <caption className="sr-only">Primeiras linhas do arquivo CSV</caption>
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      {previewHeaders.map((h) => (
                        <th key={h} scope="col" className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
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

          {importMutation.isError && (
            <p role="alert" className="text-xs font-medium text-destructive">
              Não foi possível importar: {importMutation.error.message}
            </p>
          )}

          {result && (
            <div role="status" className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-success">
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  <span className="text-sm font-semibold">{result.created} importado{result.created !== 1 ? 's' : ''}</span>
                </div>
                {result.failed > 0 && (
                  <div className="flex items-center gap-1.5 text-destructive">
                    <AlertCircle className="size-4" aria-hidden="true" />
                    <span className="text-sm font-semibold">{result.failed} com erro</span>
                  </div>
                )}
              </div>
              {result.errors.length > 0 && (
                <ul className="max-h-40 space-y-1 overflow-auto rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                  {result.errors.map((err) => (
                    <li key={err.row} className="text-xs text-destructive">
                      <span className="font-semibold">Linha {err.row}:</span> {err.reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            {result ? 'Fechar' : 'Cancelar'}
          </Button>
          {rows.length > 0 && !result && (
            <Button type="button" onClick={() => importMutation.mutate(rows)} disabled={importMutation.isPending}>
              {importMutation.isPending ? 'Importando...' : `Importar ${rows.length} atleta${rows.length !== 1 ? 's' : ''}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
