import { appendFileSync } from 'node:fs'
import { AxeBuilder } from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

// Auditoria WCAG 2.1 AA com axe-core. O axe só cobre o que é decidível por máquina (cerca de um terço dos
// critérios): o que ele não vê é verificado à mão em `wcag-targeted.spec.ts` e, para leitores de tela, só com
// teste manual (ver a seção "Acessibilidade" da especificação).

export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] as const

/** Entrada da lista de exceções: só falsos positivos justificados. Nada de desligar regra inteira. */
export interface AllowedViolation {
  /** Id da regra do axe. */
  rule: string
  /** Trecho do seletor CSS do nó (o mais específico possível). */
  target: string
  /** Só vale nas auditorias cujo rótulo contém este trecho (a exceção não vaza para outras telas). */
  audit: string
  /** Por que o axe está errado neste nó. */
  reason: string
  /** Critério WCAG relacionado. */
  criterion: string
}

/**
 * Falsos positivos justificados. Cada entrada vale para um nó específico, nunca para uma regra inteira
 * (`color-contrast` em especial nunca é desligado globalmente).
 */
// Menu e lista do Radix, quando abertos, são modais: o Radix põe aria-hidden no shell inteiro (hideOthers) e prende o foco
// no overlay (FocusScope; Tab é bloqueado dentro do menu). O axe lê "aria-hidden com conteúdo focável" no DOM, mas nada
// do shell é alcançável por Tab nem pelo cursor virtual enquanto o overlay está aberto. A prova está em
// `wcag-targeted.spec.ts` ("menu e lista abertos prendem o foco"). Testamos `modal={false}` no menu de tema: o menu
// reabre errado quando o usuário clica rápido no botão (a camada em saída trata o clique como fora do menu).
const RADIX_MODAL_REASON =
  'Overlay modal do Radix aberto: aria-hidden no shell e foco preso no overlay (Tab é bloqueado), então nada do shell é ' +
  'alcançável enquanto ele está aberto. Falso positivo comprovado por teste de foco em wcag-targeted.spec.ts.'

export const ALLOWED_VIOLATIONS: readonly AllowedViolation[] = [
  { rule: 'aria-hidden-focus', target: '.h-screen', audit: 'select aberto', criterion: '4.1.2 Nome, função, valor', reason: RADIX_MODAL_REASON },
  { rule: 'aria-hidden-focus', target: '.h-screen', audit: 'menu de tema (admin)', criterion: '4.1.2 Nome, função, valor', reason: RADIX_MODAL_REASON },
  { rule: 'aria-hidden-focus', target: '.min-h-screen', audit: 'menu de tema (público)', criterion: '4.1.2 Nome, função, valor', reason: RADIX_MODAL_REASON },
]

export interface ViolationNode {
  target: string
  html: string
  summary: string
}

export interface Violation {
  rule: string
  impact: string
  help: string
  helpUrl: string
  criteria: string[]
  nodes: ViolationNode[]
}

function criteriaOf(tags: readonly string[]): string[] {
  // Tags `wcag143` viram "1.4.3"; `wcag2aa` e semelhantes (níveis) são ignoradas.
  return tags
    .filter((tag) => /^wcag\d{3,}$/.test(tag))
    .map((tag) => tag.slice(4).split('').join('.'))
}

function isAllowed(rule: string, target: string, label: string): boolean {
  return ALLOWED_VIOLATIONS.some(
    (entry) => entry.rule === rule && target.includes(entry.target) && label.includes(entry.audit),
  )
}

export interface AxeOptions {
  /** Restringe a análise a um seletor (por exemplo, o diálogo aberto). */
  include?: string
  /** Rótulo da auditoria (nome da tela e combinação), usado nas exceções e no relatório. */
  label?: string
}

/** Roda o axe com as tags WCAG A e AA e devolve as violações, já sem as exceções justificadas. */
export async function scan(page: Page, options: AxeOptions = {}): Promise<Violation[]> {
  let builder = new AxeBuilder({ page }).withTags([...WCAG_TAGS])
  if (options.include) builder = builder.include(options.include)
  const results = await builder.analyze()
  const found: Violation[] = []
  for (const violation of results.violations) {
    const nodes = violation.nodes
      .map((node) => ({
        target: node.target.map((part) => (Array.isArray(part) ? part.join(' ') : String(part))).join(' >> '),
        html: node.html.slice(0, 200),
        summary: (node.failureSummary ?? '').split('\n').slice(1).join(' ').trim(),
      }))
      .filter((node) => !isAllowed(violation.id, node.target, options.label ?? ''))
    if (nodes.length === 0) continue
    found.push({
      rule: violation.id,
      impact: violation.impact ?? 'n/d',
      help: violation.help,
      helpUrl: violation.helpUrl,
      criteria: criteriaOf(violation.tags),
      nodes,
    })
  }
  return found
}

export function formatViolations(label: string, violations: readonly Violation[]): string {
  const lines = [`${violations.length} regra(s) do axe violada(s) em ${label}:`]
  for (const v of violations) {
    lines.push(
      '',
      `[${v.impact}] ${v.rule} (WCAG ${v.criteria.join(', ') || 'n/d'}): ${v.help}`,
      `  ${v.helpUrl}`,
    )
    for (const node of v.nodes.slice(0, 6)) {
      lines.push(`  - ${node.target}`, `    ${node.html}`, `    ${node.summary}`)
    }
    if (v.nodes.length > 6) lines.push(`  ... e mais ${v.nodes.length - 6} nó(s)`)
  }
  return lines.join('\n')
}

/**
 * Falha com um relatório legível (regra, impacto, seletor, link) se houver violações.
 * Com `WCAG_REPORT=<arquivo>`, também acrescenta uma linha JSON por violação: serve para contar tudo
 * de uma vez antes de corrigir (a contagem por critério do relatório de auditoria sai daí).
 */
export async function expectNoViolations(page: Page, label: string, options: AxeOptions = {}): Promise<void> {
  const violations = await scan(page, { ...options, label })
  const reportFile = process.env['WCAG_REPORT']
  if (reportFile && violations.length > 0) {
    for (const v of violations) {
      appendFileSync(
        reportFile,
        `${JSON.stringify({ label, rule: v.rule, impact: v.impact, criteria: v.criteria, nodes: v.nodes.length, sample: v.nodes[0]?.target })}\n`,
      )
    }
  }
  expect(violations.length, formatViolations(label, violations)).toBe(0)
}
