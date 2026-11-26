'use client'

import {
  DEFAULT_SCORING, SCORING_PRESETS, scoringLabel, scoringRuleSchema,
  type CategoryDrawConfig, type ScoringRule,
} from '@birdie-atlas/validators'
import { Field, FIELD_CONTROL_CLASS } from '@/components/ui/field'

export const DISCIPLINES = ['MS', 'WS', 'MD', 'WD', 'XD'] as const
export type Discipline = typeof DISCIPLINES[number]
export const DISCIPLINE_LABELS: Record<string, string> = {
  MS: 'Simples Masc.', WS: 'Simples Fem.', MD: 'Duplas Masc.', WD: 'Duplas Fem.', XD: 'Misto',
}
export const DRAW_TYPE_LABELS: Record<string, string> = {
  single_elimination: 'Eliminação simples',
  round_robin: 'Todos contra todos',
  group_then_elimination: 'Grupos + eliminatória',
  swiss: 'Suíço',
  double_elimination: 'Eliminação dupla',
}

/** Estado do formulário de categoria: tudo em texto, como os campos guardam. */
export interface CategoryFormValue {
  name: string
  discipline: Discipline
  drawType: string
  maxEntries: string
  seedCount: string
  /** id de um modelo de `SCORING_PRESETS` ou `custom`. */
  scoringPreset: string
  pointsPerSet: string
  setPointCap: string
  setsToWin: string
  groupCount: string
  advancePerGroup: string
  swissRounds: string
  doubleEliminationReset: boolean
}

export interface CategoryLike {
  name: string; discipline: string; drawType?: string; maxEntries: number | null; seedCount: number
  pointsPerSet?: number; setPointCap?: number; setsToWin?: number; drawConfig?: CategoryDrawConfig | null
}

function presetOf(rule: ScoringRule): string {
  return SCORING_PRESETS.find((p) => p.rule.pointsPerSet === rule.pointsPerSet && p.rule.setPointCap === rule.setPointCap && p.rule.setsToWin === rule.setsToWin)?.id ?? 'custom'
}

export function emptyCategoryForm(): CategoryFormValue {
  return fromCategory({ name: '', discipline: 'MS', drawType: 'single_elimination', maxEntries: null, seedCount: 4 })
}

export function fromCategory(cat: CategoryLike): CategoryFormValue {
  const rule: ScoringRule = {
    pointsPerSet: cat.pointsPerSet ?? DEFAULT_SCORING.pointsPerSet,
    setPointCap: cat.setPointCap ?? DEFAULT_SCORING.setPointCap,
    setsToWin: cat.setsToWin ?? DEFAULT_SCORING.setsToWin,
  }
  const cfg = cat.drawConfig ?? {}
  return {
    name: cat.name,
    discipline: (DISCIPLINES as readonly string[]).includes(cat.discipline) ? cat.discipline as Discipline : 'MS',
    drawType: cat.drawType ?? 'single_elimination',
    maxEntries: cat.maxEntries != null ? String(cat.maxEntries) : '',
    seedCount: String(cat.seedCount),
    scoringPreset: presetOf(rule),
    pointsPerSet: String(rule.pointsPerSet),
    setPointCap: String(rule.setPointCap),
    setsToWin: String(rule.setsToWin),
    groupCount: cfg.groupCount !== undefined ? String(cfg.groupCount) : '',
    advancePerGroup: cfg.advancePerGroup !== undefined ? String(cfg.advancePerGroup) : '',
    swissRounds: cfg.swissRounds !== undefined ? String(cfg.swissRounds) : '',
    doubleEliminationReset: cfg.doubleEliminationReset ?? true,
  }
}

const int = (v: string) => (v.trim() && Number.isInteger(Number(v)) ? Number(v) : undefined)

export type CategoryFormErrors = Partial<Record<'name' | 'maxEntries' | 'seedCount' | 'scoring', string>>

/** Corpo da API (`POST /tournaments/:id/categories` ou `PATCH /tournaments/categories/:id`) ou os erros por campo. */
export function toCategoryBody(v: CategoryFormValue): { ok: true; body: Record<string, unknown> } | { ok: false; errors: CategoryFormErrors } {
  const errors: CategoryFormErrors = {}
  if (!v.name.trim()) errors.name = 'Informe o nome.'
  const maxEntries = int(v.maxEntries)
  if (v.maxEntries.trim() && (maxEntries === undefined || maxEntries < 2)) errors.maxEntries = 'Use um número a partir de 2, ou deixe em branco.'
  const seedCount = int(v.seedCount)
  if (seedCount === undefined || seedCount < 0 || seedCount > 32) errors.seedCount = 'Entre 0 e 32.'
  const preset = SCORING_PRESETS.find((p) => p.id === v.scoringPreset)
  const parsed = scoringRuleSchema.safeParse(preset ? preset.rule : { pointsPerSet: int(v.pointsPerSet), setPointCap: int(v.setPointCap), setsToWin: int(v.setsToWin) })
  if (!parsed.success) errors.scoring = parsed.error.issues[0]?.message.startsWith('O teto') ? parsed.error.issues[0].message : 'Pontos do set entre 5 e 30, teto até 50 e de 1 a 3 sets para vencer.'
  if (Object.keys(errors).length || !parsed.success) return { ok: false, errors }

  const drawConfig: CategoryDrawConfig = {}
  if (v.drawType === 'group_then_elimination') {
    const groupCount = int(v.groupCount)
    const advancePerGroup = int(v.advancePerGroup)
    if (groupCount !== undefined) drawConfig.groupCount = groupCount
    if (advancePerGroup !== undefined) drawConfig.advancePerGroup = advancePerGroup
  }
  if (v.drawType === 'swiss' && int(v.swissRounds) !== undefined) drawConfig.swissRounds = int(v.swissRounds)!
  if (v.drawType === 'double_elimination') drawConfig.doubleEliminationReset = v.doubleEliminationReset
  return {
    ok: true,
    body: {
      name: v.name.trim(),
      discipline: v.discipline,
      drawType: v.drawType,
      maxEntries: maxEntries ?? null,
      seedCount,
      scoring: parsed.data,
      drawConfig: Object.keys(drawConfig).length ? drawConfig : null,
    },
  }
}

const selectCls = `${FIELD_CONTROL_CLASS} cursor-pointer`

interface Props {
  value: CategoryFormValue
  onChange: (next: CategoryFormValue) => void
  errors?: CategoryFormErrors
  /** Na edição a disciplina não muda (as inscrições dependem dela). */
  disciplineLocked?: boolean
  /** Formato travado depois do sorteio. */
  drawTypeLocked?: boolean
  /** Pontuação travada depois do primeiro resultado. */
  scoringLocked?: boolean
}

/** Campos da categoria, usados na criação (aba Configuração) e no diálogo de edição. */
export function CategoryFormFields({ value, onChange, errors = {}, disciplineLocked, drawTypeLocked, scoringLocked }: Props) {
  const set = (patch: Partial<CategoryFormValue>) => onChange({ ...value, ...patch })
  const custom = value.scoringPreset === 'custom'

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Nome da categoria" error={errors.name} required>
          {(props) => <input {...props} value={value.name} onChange={(e) => set({ name: e.target.value })} placeholder="ex: Simples Masculino Sub 17" className={FIELD_CONTROL_CLASS} />}
        </Field>
        <Field label="Disciplina" hint={disciplineLocked ? 'Não muda depois de criada.' : undefined}>
          {(props) => (
            <select {...props} value={value.discipline} disabled={disciplineLocked} onChange={(e) => set({ discipline: e.target.value as Discipline })} className={selectCls}>
              {DISCIPLINES.map((d) => <option key={d} value={d}>{DISCIPLINE_LABELS[d]}</option>)}
            </select>
          )}
        </Field>
        <Field label="Formato da chave" hint={drawTypeLocked ? 'Não muda depois do sorteio.' : undefined}>
          {(props) => (
            <select {...props} value={value.drawType} disabled={drawTypeLocked} onChange={(e) => set({ drawType: e.target.value })} className={selectCls}>
              {Object.entries(DRAW_TYPE_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Máx. inscrições" muted error={errors.maxEntries}>
            {(props) => <input {...props} type="number" min={2} inputMode="numeric" value={value.maxEntries} onChange={(e) => set({ maxEntries: e.target.value })} placeholder="ilimitado" className={FIELD_CONTROL_CLASS} />}
          </Field>
          <Field label="Cabeças de chave" muted error={errors.seedCount}>
            {(props) => <input {...props} type="number" min={0} max={32} inputMode="numeric" value={value.seedCount} onChange={(e) => set({ seedCount: e.target.value })} className={FIELD_CONTROL_CLASS} />}
          </Field>
        </div>
      </div>

      {value.drawType === 'group_then_elimination' && (
        <fieldset className="space-y-2 border-t border-border pt-4">
          <legend className="float-left mb-2 w-full text-sm font-semibold">Fase de grupos</legend>
          <p className="text-xs text-muted-foreground">Padrão do sorteio desta categoria. Em branco: grupos de 4 pessoas e 2 classificados por grupo. Dá para ajustar de novo na hora de sortear.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Número de grupos" muted>
              {(props) => <input {...props} type="number" min={1} max={26} inputMode="numeric" value={value.groupCount} onChange={(e) => set({ groupCount: e.target.value })} placeholder="automático" className={FIELD_CONTROL_CLASS} />}
            </Field>
            <Field label="Classificados por grupo" muted>
              {(props) => <input {...props} type="number" min={1} max={16} inputMode="numeric" value={value.advancePerGroup} onChange={(e) => set({ advancePerGroup: e.target.value })} placeholder="2" className={FIELD_CONTROL_CLASS} />}
            </Field>
          </div>
        </fieldset>
      )}
      {value.drawType === 'swiss' && (
        <fieldset className="space-y-2 border-t border-border pt-4">
          <legend className="float-left mb-2 w-full text-sm font-semibold">Suíço</legend>
          <Field label="Número de rodadas" muted hint="Em branco: ⌈log₂ do número de inscritos⌉.">
            {(props) => <input {...props} type="number" min={1} max={20} inputMode="numeric" value={value.swissRounds} onChange={(e) => set({ swissRounds: e.target.value })} placeholder="automático" className={FIELD_CONTROL_CLASS} />}
          </Field>
        </fieldset>
      )}
      {value.drawType === 'double_elimination' && (
        <fieldset className="space-y-2 border-t border-border pt-4">
          <legend className="float-left mb-2 w-full text-sm font-semibold">Eliminação dupla</legend>
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input type="checkbox" checked={value.doubleEliminationReset} onChange={(e) => set({ doubleEliminationReset: e.target.checked })} className="mt-0.5 size-4 rounded accent-primary" />
            <span>
              <span className="font-medium">Grande final com reset</span>
              <span className="block text-xs text-muted-foreground">Se quem veio da chave dos perdedores vencer a grande final, os dois jogam de novo.</span>
            </span>
          </label>
        </fieldset>
      )}

      <fieldset className="space-y-2 border-t border-border pt-4" disabled={scoringLocked}>
        <legend className="float-left mb-2 w-full text-sm font-semibold">Pontuação das partidas</legend>
        <Field label="Sistema" hint={scoringLocked ? 'Não muda depois que a categoria tem resultado ou partida ao vivo.' : 'Vale para o placar ao vivo, o lançamento de resultado e o placar do W.O.'} error={custom ? undefined : errors.scoring}>
          {(props) => (
            <select
              {...props}
              value={value.scoringPreset}
              onChange={(e) => {
                const preset = SCORING_PRESETS.find((p) => p.id === e.target.value)
                set(preset
                  ? { scoringPreset: preset.id, pointsPerSet: String(preset.rule.pointsPerSet), setPointCap: String(preset.rule.setPointCap), setsToWin: String(preset.rule.setsToWin) }
                  : { scoringPreset: 'custom' })
              }}
              className={selectCls}
            >
              {SCORING_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              <option value="custom">Personalizado</option>
            </select>
          )}
        </Field>
        {custom && (
          <>
            <div className="clear-both grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Pontos do set" muted>
                {(props) => <input {...props} type="number" min={5} max={30} inputMode="numeric" value={value.pointsPerSet} onChange={(e) => set({ pointsPerSet: e.target.value })} className={FIELD_CONTROL_CLASS} />}
              </Field>
              <Field label="Teto" muted hint="No teto o set acaba, mesmo sem 2 de vantagem.">
                {(props) => <input {...props} type="number" min={5} max={50} inputMode="numeric" value={value.setPointCap} onChange={(e) => set({ setPointCap: e.target.value })} className={FIELD_CONTROL_CLASS} />}
              </Field>
              <Field label="Partida" muted>
                {(props) => (
                  <select {...props} value={value.setsToWin} onChange={(e) => set({ setsToWin: e.target.value })} className={selectCls}>
                    <option value="1">Set único</option>
                    <option value="2">Melhor de 3</option>
                    <option value="3">Melhor de 5</option>
                  </select>
                )}
              </Field>
            </div>
            {errors.scoring
              ? <p role="alert" className="text-xs font-medium text-destructive">{errors.scoring}</p>
              : <ScoringPreview value={value} />}
          </>
        )}
      </fieldset>
    </div>
  )
}

function ScoringPreview({ value }: { value: CategoryFormValue }) {
  const parsed = scoringRuleSchema.safeParse({ pointsPerSet: int(value.pointsPerSet), setPointCap: int(value.setPointCap), setsToWin: int(value.setsToWin) })
  if (!parsed.success) return null
  return <p className="text-xs text-muted-foreground">Fica: {scoringLabel(parsed.data)}.</p>
}
