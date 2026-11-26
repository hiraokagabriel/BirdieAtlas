'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Upload } from 'lucide-react'
import type { ImportReport } from '@birdie-atlas/validators'
import { ApiError, apiFetch } from '@/lib/api'
import {
  EMPTY_TOURNAMENT_FIELDS,
  TEMPLATE_FILES,
  parseImportFile,
  type ParsedImport,
  type TournamentFields,
} from '@/lib/tournament-import'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FIELD_CONTROL_CLASS } from '@/components/ui/field'

const LEVELS = ['Local', 'Regional', 'Estadual', 'Nacional', 'Internacional']

function isReport(value: unknown): value is ImportReport {
  return typeof value === 'object' && value !== null && Array.isArray((value as ImportReport).errors) && 'summary' in value
}

/** Torneio já criado na plataforma que recebe a planilha (só categorias e inscritos). */
export interface ImportTarget {
  id: string
  name: string
  /** Chamado depois de gravar, para recarregar a página do torneio. */
  onImported: () => void
}

/**
 * Importa de uma planilha .xlsx ou .csv. Sem `target`, cria um torneio inteiro (categorias, atletas, clubes, duplas e
 * inscrições); com `target`, coloca categorias e inscritos dentro de um torneio já criado.
 */
export function ImportTournamentDialog({ target }: { target?: ImportTarget } = {}) {
  const router = useRouter()
  const endpoint = target ? `/tournaments/${target.id}/import` : '/import/tournament'
  const [open, setOpen] = useState(false)
  const [fileName, setFileName] = useState('')
  const [parsed, setParsed] = useState<ParsedImport | null>(null)
  const [fields, setFields] = useState<TournamentFields>(EMPTY_TOURNAMENT_FIELDS)
  const [tab, setTab] = useState('')
  const [report, setReport] = useState<ImportReport | null>(null)
  const [busy, setBusy] = useState<'reading' | 'checking' | 'importing' | null>(null)
  const [error, setError] = useState<string | null>(null)

  function close() {
    setOpen(false)
    setFileName('')
    setParsed(null)
    setTab('')
    setFields(EMPTY_TOURNAMENT_FIELDS)
    setReport(null)
    setBusy(null)
    setError(null)
  }

  async function handleFile(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0]
    if (!file) return
    setBusy('reading')
    setError(null)
    setReport(null)
    try {
      const result = await parseImportFile(file)
      setFileName(file.name)
      setParsed(result)
      setTab(result.alternatives?.[0]?.name ?? '')
      setFields({ ...EMPTY_TOURNAMENT_FIELDS, ...result.tournament })
    } catch (err) {
      setParsed(null)
      setFileName('')
      setError(err instanceof Error ? err.message : 'Não foi possível ler o arquivo.')
    } finally {
      setBusy(null)
      ev.target.value = ''
    }
  }

  function pickTab(name: string) {
    const alternatives = parsed?.alternatives
    const next = alternatives?.find((a) => a.name === name)
    if (!alternatives || !next) return
    setTab(name)
    setParsed({ ...next.parsed, alternatives })
    setFields({ ...EMPTY_TOURNAMENT_FIELDS, ...next.parsed.tournament })
    setReport(null)
  }

  function body(dryRun: boolean) {
    const rows = { categories: parsed?.categories ?? [], entries: parsed?.entries ?? [] }
    if (target) return { dryRun, ...rows }
    return {
      dryRun,
      tournament: {
        name: fields.name,
        startDate: fields.startDate,
        endDate: fields.endDate,
        kind: fields.kind,
        level: fields.level,
        ...(fields.slug.trim() ? { slug: fields.slug.trim() } : {}),
        ...(fields.city.trim() ? { city: fields.city.trim() } : {}),
        ...(fields.state.trim() ? { state: fields.state.trim() } : {}),
        ...(fields.location.trim() ? { location: fields.location.trim() } : {}),
      },
      categories: parsed?.categories ?? [],
      entries: parsed?.entries ?? [],
    }
  }

  async function check() {
    setBusy('checking')
    setError(null)
    try {
      setReport(await apiFetch<ImportReport>(endpoint, { method: 'POST', json: body(true) }))
    } catch (err) {
      setReport(null)
      setError(err instanceof Error ? err.message : 'Não foi possível verificar a planilha.')
    } finally {
      setBusy(null)
    }
  }

  async function importNow() {
    setBusy('importing')
    setError(null)
    try {
      const done = await apiFetch<ImportReport>(endpoint, { method: 'POST', json: body(false) })
      close()
      if (target) target.onImported()
      else router.push(`/admin/tournaments/${done.tournamentId}`)
    } catch (err) {
      if (err instanceof ApiError && isReport(err.details)) setReport(err.details)
      setError(err instanceof Error ? err.message : 'Não foi possível importar.')
      setBusy(null)
    }
  }

  const set = (patch: Partial<TournamentFields>) => {
    setFields((f) => ({ ...f, ...patch }))
    setReport(null) // qualquer mudança exige verificar de novo
  }

  return (
    <>
      {/* Mesma borda e fundo dos botões Exportar do cabeçalho do torneio. */}
      <Button type="button" variant="outline" onClick={() => setOpen(true)} className="border-field-border bg-card">
        <FileSpreadsheet aria-hidden="true" />
        Importar planilha
      </Button>
      <Dialog open={open} onOpenChange={(next) => !next && close()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{target ? 'Importar inscrições por planilha' : 'Importar torneio por planilha'}</DialogTitle>
            <DialogDescription>
              {target
                ? <>As categorias e os inscritos da planilha entram em {target.name}. Categorias com o mesmo nome recebem as inscrições; as outras são criadas.</>
                : <>Uma planilha .xlsx (abas Categorias e Inscritos, e opcionalmente Torneio), uma planilha consolidada (coluna Mod/cat., uma aba por torneio) ou um .csv cria o torneio, as categorias, os atletas e clubes que ainda não existem, as duplas e as inscrições. Antes de gravar, você confere um resumo e os erros.</>}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="-ml-3 flex flex-wrap items-center gap-2">
              <Button asChild variant="ghost">
                <a href={TEMPLATE_FILES.xlsx} download>
                  <Download aria-hidden="true" />
                  Baixar modelo (.xlsx)
                </a>
              </Button>
              <Button asChild variant="ghost">
                <a href={TEMPLATE_FILES.csv} download>
                  <Download aria-hidden="true" />
                  Baixar modelo (.csv)
                </a>
              </Button>
            </div>

            <label className="block cursor-pointer rounded-xl border-2 border-dashed border-field-border p-6 text-center transition-colors hover:bg-muted/40 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring">
              <Upload className="mx-auto mb-2 size-7 text-muted-foreground" aria-hidden="true" />
              <span className="block text-sm font-medium">{busy === 'reading' ? 'Lendo o arquivo...' : fileName || 'Clique para escolher a planilha (.xlsx ou .csv)'}</span>
              <input type="file" accept=".xlsx,.csv" className="sr-only" onChange={handleFile} />
            </label>

            {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}

            {parsed?.alternatives && parsed.alternatives.length > 1 && (
              <Field label="Aba da planilha (um torneio por aba)" hint="Cada aba é importada como um torneio. Importe uma de cada vez.">
                {(props) => (
                  <select
                    {...props}
                    value={tab}
                    onChange={(e) => pickTab(e.target.value)}
                    className={`${FIELD_CONTROL_CLASS} cursor-pointer`}
                  >
                    {parsed.alternatives!.map((a) => <option key={a.name} value={a.name}>{a.name}</option>)}
                  </select>
                )}
              </Field>
            )}

            {parsed && (
              <>
                <p className="text-sm text-muted-foreground" role="status">
                  Lidas {parsed.categories.length} categoria{parsed.categories.length === 1 ? '' : 's'} e {parsed.entries.length} {parsed.entries.length === 1 ? 'inscrição' : 'inscrições'}.
                </p>
                {parsed.notes.length > 0 && (
                  <ul className="list-inside list-disc space-y-1 text-xs text-muted-foreground">
                    {parsed.notes.map((n) => <li key={n}>{n}</li>)}
                  </ul>
                )}

                {!target && (
                <fieldset className="space-y-3 rounded-xl border border-border p-4">
                  <legend className="px-1 text-sm font-semibold">Dados do torneio</legend>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Nome" required>
                      {(props) => <input {...props} value={fields.name} onChange={(e) => set({ name: e.target.value })} className={FIELD_CONTROL_CLASS} />}
                    </Field>
                    <Field label="Endereço (slug)" hint="Em branco: gerado do nome." muted>
                      {(props) => <input {...props} value={fields.slug} onChange={(e) => set({ slug: e.target.value })} className={`${FIELD_CONTROL_CLASS} font-mono`} />}
                    </Field>
                    <Field label="Tipo" muted>
                      {(props) => (
                        <select {...props} value={fields.kind} onChange={(e) => set({ kind: e.target.value })} className={`${FIELD_CONTROL_CLASS} cursor-pointer`}>
                          <option>Oficial</option>
                          <option>Amistoso</option>
                        </select>
                      )}
                    </Field>
                    <Field label="Nível" muted>
                      {(props) => (
                        <select {...props} value={fields.level} onChange={(e) => set({ level: e.target.value })} className={`${FIELD_CONTROL_CLASS} cursor-pointer`}>
                          {LEVELS.map((l) => <option key={l}>{l}</option>)}
                        </select>
                      )}
                    </Field>
                    <Field label="Início" required hint="DD/MM/AAAA ou AAAA-MM-DD.">
                      {(props) => <input {...props} value={fields.startDate} onChange={(e) => set({ startDate: e.target.value })} placeholder="15/11/2026" className={FIELD_CONTROL_CLASS} />}
                    </Field>
                    <Field label="Término" required>
                      {(props) => <input {...props} value={fields.endDate} onChange={(e) => set({ endDate: e.target.value })} placeholder="17/11/2026" className={FIELD_CONTROL_CLASS} />}
                    </Field>
                    <Field label="Cidade (opcional)" muted>
                      {(props) => <input {...props} value={fields.city} onChange={(e) => set({ city: e.target.value })} className={FIELD_CONTROL_CLASS} />}
                    </Field>
                    <div className="grid grid-cols-3 gap-3">
                      <Field label="UF" muted>
                        {(props) => <input {...props} value={fields.state} maxLength={2} onChange={(e) => set({ state: e.target.value.toUpperCase() })} className={`${FIELD_CONTROL_CLASS} uppercase`} />}
                      </Field>
                      <div className="col-span-2">
                        <Field label="Local (opcional)" muted>
                          {(props) => <input {...props} value={fields.location} onChange={(e) => set({ location: e.target.value })} className={FIELD_CONTROL_CLASS} />}
                        </Field>
                      </div>
                    </div>
                  </div>
                </fieldset>
                )}

                {report && <ReportView report={report} intoExisting={!!target} />}
              </>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>Cancelar</Button>
            {parsed && (
              <Button type="button" variant={report?.ok ? 'outline' : 'default'} onClick={check} disabled={busy !== null}>
                {busy === 'checking' ? 'Verificando...' : 'Verificar planilha'}
              </Button>
            )}
            {/* Planilha válida mas vazia (só exemplos): nada para importar. */}
            {parsed && report?.ok && (report.summary.registrations > 0 || report.summary.categories > 0) && (
              <Button type="button" onClick={importNow} disabled={busy !== null}>
                {busy === 'importing' ? 'Importando...' : target ? 'Importar inscrições' : 'Importar torneio'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function ReportView({ report, intoExisting }: { report: ImportReport; intoExisting: boolean }) {
  const s = report.summary
  return (
    <div className="space-y-3" role="status" aria-label="Resultado da verificação">
      {report.ok ? (
        <p className="flex items-center gap-2 text-sm font-semibold text-success">
          <CheckCircle2 className="size-4" aria-hidden="true" />
          Planilha válida. Confira o resumo e importe.
        </p>
      ) : (
        <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
          <AlertTriangle className="size-4" aria-hidden="true" />
          {report.errors.length} erro{report.errors.length === 1 ? '' : 's'} na planilha. Corrija o arquivo e escolha-o de novo.
        </p>
      )}

      <dl className="divide-y divide-border rounded-lg border border-border text-sm">
        {[
          ...(intoExisting
            ? [['Categorias', `${plural(s.categories, 'nova', 'novas')}, ${plural(s.existingCategories ?? 0, 'já existente', 'já existentes')}`]]
            : [
                ['Torneio', `${s.tournament.name} (${s.tournament.kind === 'friendly' ? 'amistoso' : 'oficial'})`],
                ['Endereço', s.tournament.slug || '—'],
                ['Categorias', String(s.categories)],
              ]),
          ['Inscrições', String(s.registrations)],
          ['Atletas', `${plural(s.athletes.created, 'novo', 'novos')}, ${plural(s.athletes.existing, 'já cadastrado', 'já cadastrados')}`],
          ['Clubes', `${plural(s.clubs.created, 'novo', 'novos')}, ${plural(s.clubs.existing, 'já cadastrado', 'já cadastrados')}`],
          ['Duplas', `${plural(s.pairs.created, 'nova', 'novas')}, ${plural(s.pairs.existing, 'já cadastrada', 'já cadastradas')}`],
        ].map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 px-3 py-2">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right font-medium">{value}</dd>
          </div>
        ))}
      </dl>

      {report.errors.length > 0 && <IssueTable title="Erros" issues={report.errors} tone="error" />}
      {report.warnings.length > 0 && <IssueTable title="Avisos" issues={report.warnings} tone="warning" />}
    </div>
  )
}

/** "1 nova", "2 novas". */
function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

function IssueTable({ title, issues, tone }: { title: string; issues: ImportReport['errors']; tone: 'error' | 'warning' }) {
  return (
    <div className="space-y-1.5">
    <h3 className={tone === 'error' ? 'text-sm font-semibold text-destructive' : 'text-sm font-semibold'}>{title} ({issues.length})</h3>
    <div tabIndex={0} role="region" aria-label={title} className="max-h-56 overflow-auto rounded-lg border border-border">
      <table className="w-full text-xs">
        <caption className="sr-only">{title} da planilha: aba, linha, campo e mensagem.</caption>
        <thead>
          <tr className={tone === 'error' ? 'bg-destructive/10' : 'bg-warning/10'}>
            <th scope="col" className="px-3 py-2 text-left font-medium">Aba</th>
            <th scope="col" className="px-3 py-2 text-left font-medium">Linha</th>
            <th scope="col" className="px-3 py-2 text-left font-medium">Campo</th>
            <th scope="col" className="px-3 py-2 text-left font-medium">Mensagem</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {issues.map((i, index) => (
            <tr key={`${i.sheet}-${i.row}-${i.field}-${index}`}>
              <td className="px-3 py-1.5">{i.sheet}</td>
              <td className="px-3 py-1.5 tabular-nums">{i.row > 0 ? i.row : '—'}</td>
              <td className="px-3 py-1.5">{i.field}</td>
              <td className="px-3 py-1.5">{i.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </div>
  )
}
