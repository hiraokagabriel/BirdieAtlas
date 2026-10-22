import { expect, test, type Page } from '@playwright/test'
import {
  expectNoHorizontalScroll,
  focusIndicator,
  focusIsInside,
  headingLevels,
  headingProblems,
  horizontalOverflow,
  namelessControls,
  smallTargets,
  tabUntil,
  unlabeledFields,
} from '../support/a11y-checks.js'
import { prepareTournament } from '../support/factories.js'
import { prepareWcagData, type WcagData } from '../support/wcag-data.js'
import { adminPages, publicPages, type PageCase } from '../support/wcag-routes.js'
import { expectTheme, settle, THEMES, useTheme } from '../support/wcag-page.js'

// Verificações de acessibilidade que o axe não faz: teclado, foco, ordem de leitura, movimento reduzido,
// reflow, tamanho de alvo, formulários e o que depende de estrutura. Cada teste diz o critério WCAG que cobre.
// Leitor de tela de verdade não se automatiza aqui: a passada manual segue pendente (ver docs).

let data: WcagData

test.beforeAll(async () => {
  data = await prepareWcagData()
})

const getData = () => data
const everyPage = (): PageCase[] => [...publicPages(getData), ...adminPages(getData)]

async function openReady(page: Page, target: PageCase): Promise<void> {
  await page.goto(target.path())
  await target.ready(page)
  await settle(page)
}

test.describe('estrutura de cada página', () => {
  test('título único e descritivo por rota, idioma e um h1 sem salto de nível (2.4.2, 3.1.1, 1.3.1, 2.4.6)', async ({ page }) => {
    const titles = new Map<string, string>()
    const problems: string[] = []
    // Abas da mesma tela (mesma URL) compartilham o título: o critério é um título por página, não por aba.
    const seenPaths = new Set<string>()
    for (const target of everyPage()) {
      const path = target.path()
      const firstOfPath = !seenPaths.has(path)
      seenPaths.add(path)
      await openReady(page, target)
      const title = (await page.title()).trim()
      if (title.length === 0) problems.push(`${target.name}: título vazio`)
      if (!title.includes('BirdieAtlas')) problems.push(`${target.name}: o título precisa dizer o nome do site: "${title}"`)
      if (title === 'BirdieAtlas') problems.push(`${target.name}: título genérico`)
      if (firstOfPath) {
        const same = titles.get(title)
        if (same) problems.push(`${target.name}: título repetido com "${same}": ${title}`)
        titles.set(title, target.name)
      }

      if ((await page.locator('html').getAttribute('lang')) !== 'pt-BR') problems.push(`${target.name}: lang diferente de pt-BR`)
      for (const problem of headingProblems(await headingLevels(page))) problems.push(`${target.name}: cabeçalhos: ${problem}`)
    }
    expect(problems.length, problems.join(String.fromCharCode(10))).toBe(0)
  })

  test('landmarks: um main, um banner, navegações com nome e único entre as visíveis (1.3.1, 2.4.1)', async ({ page }) => {
    for (const target of everyPage()) {
      await openReady(page, target)
      await expect(page.getByRole('main'), target.name).toHaveCount(1)
      await expect(page.getByRole('banner'), target.name).toHaveCount(1)
      const navs = page.getByRole('navigation')
      const count = await navs.count()
      expect(count, `${target.name}: sem navegação`).toBeGreaterThan(0)
      const names: string[] = []
      for (let i = 0; i < count; i++) {
        const name = (await navs.nth(i).getAttribute('aria-label')) ?? ''
        expect(name, `${target.name}: <nav> sem aria-label`).not.toBe('')
        names.push(name)
      }
      expect(new Set(names).size, `${target.name}: <nav> com nome repetido: ${names.join(', ')}`).toBe(names.length)
    }
  })

  test('rota inexistente: página própria em português, com h1 e título (3.1.1, 2.4.2)', async ({ page }) => {
    const response = await page.goto('/rota-que-nao-existe')
    expect(response?.status()).toBe(404)
    await expect(page.getByRole('heading', { level: 1, name: 'Página não encontrada' })).toBeVisible()
    await expect(page).toHaveTitle(/Página não encontrada/)
  })

  test('tabelas têm cabeçalhos com escopo e nome (caption, aria-label ou aria-labelledby) (1.3.1)', async ({ page }) => {
    const withTables = [
      ...publicPages(getData).filter((p) => /ranking|clube|torneio encerrado/.test(p.name)),
      ...adminPages(getData).filter((p) => /atletas|duplas|clube \(detalhe\)|ranking \(detalhe|dashboard/.test(p.name)),
    ]
    let seen = 0
    for (const target of withTables) {
      await openReady(page, target)
      const issues = await page.evaluate(() =>
        Array.from(document.querySelectorAll('table'))
          .filter((table) => !table.closest('[aria-hidden="true"], .sr-only'))
          .flatMap((table) => {
            const problems: string[] = []
            const heads = Array.from(table.querySelectorAll('th'))
            if (heads.length === 0) problems.push('tabela sem <th>')
            if (heads.some((th) => !th.getAttribute('scope'))) problems.push('th sem scope')
            const named = table.querySelector('caption') ?? table.getAttribute('aria-label') ?? table.getAttribute('aria-labelledby')
            const region = table.closest('[role="region"][aria-label]')
            if (!named && !region) problems.push('tabela sem nome')
            return problems.map((problem) => `${problem} (${table.className.slice(0, 30)})`)
          }),
      )
      seen += await page.locator('table').count()
      expect(issues, target.name).toEqual([])
    }
    expect(seen, 'nenhuma tabela encontrada: o teste não está medindo nada').toBeGreaterThan(3)
  })

  test('todo campo tem rótulo de verdade, não só placeholder (1.3.1, 3.3.2, 4.1.2)', async ({ page }) => {
    for (const target of everyPage()) {
      await openReady(page, target)
      expect(await unlabeledFields(page), `${target.name}: campos sem rótulo`).toEqual([])
    }
  })

  test('botões, links e controles têm nome acessível (4.1.2, 2.4.4)', async ({ page }) => {
    for (const target of everyPage()) {
      await openReady(page, target)
      expect(await namelessControls(page.locator('body')), `${target.name}: controles sem nome`).toEqual([])
    }
  })

  test('navegação atual marcada com aria-current="page" (1.3.1)', async ({ page }) => {
    await page.goto('/admin/athletes')
    await expect(page.getByRole('navigation', { name: 'Navegação administrativa' }).getByRole('link', { name: 'Atletas' })).toHaveAttribute('aria-current', 'page')
    await expect(page.getByRole('navigation', { name: 'Navegação administrativa' }).getByRole('link', { name: 'Clubes' })).not.toHaveAttribute('aria-current', 'page')
    await page.goto(`/admin/tournaments/${data.running.tournament.id}`)
    await expect(page.getByRole('navigation', { name: 'Navegação administrativa' }).getByRole('link', { name: 'Torneios' })).toHaveAttribute('aria-current', 'page')
    await page.goto('/')
    await expect(page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Início' })).toHaveAttribute('aria-current', 'page')
  })

  test('estado selecionado vem de checked/selected, não só da cor (1.4.1, 4.1.2)', async ({ page }) => {
    await page.goto(`/admin/tournaments/${data.running.tournament.id}`)
    // Abas: exatamente uma selecionada.
    await expect(page.getByRole('tab', { selected: true })).toHaveCount(1)
    await page.getByRole('tab', { name: 'Chaveamento' }).click()
    await expect(page.getByRole('tab', { name: 'Chaveamento' })).toHaveAttribute('aria-selected', 'true')
    // Seletor de categoria: grupo de rádios com um marcado.
    await expect(page.getByRole('radio', { checked: true })).toHaveCount(1)
    // Ranking público: um ranking marcado.
    await page.goto('/r/fpb-sp')
    await expect(page.getByRole('radio', { checked: true }).first()).toBeVisible()
  })

  test('chave: ordem de leitura da primeira fase à final e cada partida com nome completo (1.3.2, 2.4.6)', async ({ page }) => {
    await page.goto(`/t/${data.completed.tournament.slug}`)
    const bracket = page.getByRole('region', { name: /^Chave de/ })
    await expect(bracket).toBeVisible()
    const rounds = await bracket.locator('section[aria-label]').evaluateAll((sections) => sections.map((s) => s.getAttribute('aria-label') ?? ''))
    expect(rounds, 'rodadas na ordem do DOM').toEqual(['Quartas de final', 'Semifinal', 'Final'])
    const matches = bracket.getByRole('group')
    const count = await matches.count()
    expect(count).toBe(7)
    for (let i = 0; i < count; i++) {
      const name = (await matches.nth(i).getAttribute('aria-label')) ?? ''
      expect(name, 'partida sem nome completo').toMatch(/ x | contra |BYE|definir/i)
    }
    // Campeão anunciado por texto (não só pelo troféu).
    await expect(page.getByText('Campeão').first()).toBeVisible()
  })

  test('status por texto, nunca só por cor: cartões de partida e selos (1.4.1)', async ({ page }) => {
    await page.goto(`/t/${data.running.tournament.slug}`)
    await expect(page.getByRole('region', { name: /^Chave de/ })).toBeVisible()
    const cards = page.getByRole('region', { name: /^Chave de/ }).getByRole('group')
    const count = await cards.count()
    expect(count).toBeGreaterThan(0)
    for (let i = 0; i < count; i++) {
      const text = (await cards.nth(i).innerText()).toLowerCase()
      expect(text, `cartão ${i} sem texto de status`).toMatch(/aguardando|ao vivo|encerrada|w\.o\.|ret\.|bye|a definir|agendada|\d{2}:\d{2}/)
    }
    // Pontos coloridos que acompanham o texto de status ficam fora da árvore de acessibilidade.
    const dotsWithoutText = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>('span.rounded-full[aria-hidden="true"]'))
        .filter((dot) => !(dot.parentElement?.textContent ?? '').trim()).length,
    )
    expect(dotsWithoutText, 'ponto de cor sem texto ao lado').toBe(0)
  })
})

test.describe('teclado e foco', () => {
  test('o primeiro Tab leva ao link "Pular para o conteúdo", e Enter move o foco para o main (2.4.1)', async ({ page }) => {
    for (const path of ['/', `/admin`]) {
      await page.goto(path)
      await expect(page.getByRole('main')).toBeVisible()
      await page.keyboard.press('Tab')
      const skip = page.getByRole('link', { name: 'Pular para o conteúdo' })
      await expect(skip).toBeFocused()
      await expect(skip).toBeVisible()
      const box = await skip.boundingBox()
      expect(box?.width ?? 0, 'o link aparece ao receber foco').toBeGreaterThan(50)
      await page.keyboard.press('Enter')
      await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('conteudo-principal')
      // O próximo Tab já está dentro do conteúdo, não de volta no cabeçalho.
      await page.keyboard.press('Tab')
      expect(await page.evaluate(() => Boolean(document.activeElement?.closest('main')))).toBe(true)
    }
  })

  for (const theme of THEMES) {
    test(`indicador de foco visível, com 2px e contraste de 3:1 nos controles (${theme}) (2.4.7, 1.4.11)`, async ({ page }) => {
      await useTheme(page, theme)
      const targets = [
        publicPages(getData)[0] as PageCase,
        adminPages(getData).find((p) => p.name === 'atletas') as PageCase,
        adminPages(getData).find((p) => p.name === 'torneio: chaveamento (em andamento)') as PageCase,
      ]
      const problems: string[] = []
      let checked = 0
      for (const target of targets) {
        await openReady(page, target)
        await expectTheme(page, theme)
        await page.locator('body').click({ position: { x: 1, y: 1 } })
        await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
        for (let i = 0; i < 18; i++) {
          await page.keyboard.press('Tab')
          await settle(page) // transições de foco (cor do contorno) precisam ter terminado
          const indicator = await focusIndicator(page)
          if (indicator.tag === 'BODY') continue
          checked++
          // Rádio escondido (sr-only): o indicador está no rótulo que o envolve (has-focus-visible), medido abaixo.
          if (indicator.kind === 'nenhum') {
            const inLabel = await page.evaluate(() => {
              const el = document.activeElement
              const label = el?.closest('label')
              return label ? getComputedStyle(label).outlineStyle !== 'none' : false
            })
            if (inLabel) continue
          }
          if (indicator.kind === 'nenhum') problems.push(`${target.name}: "${indicator.name}" (${indicator.tag}) sem indicador`)
          else if (indicator.widthPx < 2 && indicator.kind === 'outline') problems.push(`${target.name}: "${indicator.name}" contorno de ${indicator.widthPx}px`)
          else if (indicator.contrast < 3) problems.push(`${target.name}: "${indicator.name}" contraste ${indicator.contrast.toFixed(2)}:1 (${indicator.kind})`)
        }
      }
      expect(checked, 'poucos controles medidos').toBeGreaterThan(20)
      expect(problems).toEqual([])
    })
  }

  test('abas do torneio: setas, Home e End movem a seleção (2.1.1, 4.1.2)', async ({ page }) => {
    await page.goto(`/admin/tournaments/${data.running.tournament.id}`)
    const tabs = page.getByRole('tablist', { name: 'Seções do torneio' })
    await tabs.getByRole('tab', { name: 'Inscrições' }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(tabs.getByRole('tab', { name: 'Chaveamento' })).toBeFocused()
    await page.keyboard.press('End')
    await expect(tabs.getByRole('tab', { name: 'Configurações' })).toBeFocused()
    await page.keyboard.press('Home')
    await expect(tabs.getByRole('tab', { name: 'Inscrições' })).toBeFocused()
    // O painel é alcançável pelo Tab logo depois da lista de abas.
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[role="tabpanel"]')))).toBe(true)
  })

  test('menu de tema só pelo teclado: abre, anda com as setas e escolhe (2.1.1)', async ({ page }) => {
    await page.goto('/')
    await tabUntil(page, { selector: 'button[aria-label="Alterar tema"]' })
    await page.keyboard.press('Enter')
    await expect(page.getByRole('menu')).toBeVisible()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('menu')).toBeHidden()
    await expect(page.getByRole('button', { name: 'Alterar tema' })).toBeFocused()
  })

  test('lançar um resultado só pelo teclado: chave, partida, placar, confirmar (2.1.1, 2.4.3)', async ({ page }) => {
    // Torneio próprio: o resultado grava de verdade e não pode mexer nos dados dos outros testes.
    const own = await prepareTournament({ athleteCount: 4, name: `Teclado ${data.tag} ${Date.now().toString(36)}` })
    await page.goto(`/admin/tournaments/${own.tournament.id}`)
    await page.getByRole('tab', { name: 'Chaveamento' }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('region', { name: /^Chave de/ })).toBeVisible()
    await tabUntil(page, { selector: 'button', name: 'Abrir resultado' })
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: 'Lançar Resultado' })
    await expect(dialog).toBeVisible()
    expect(await focusIsInside(page, dialog), 'o foco entra no diálogo').toBe(true)

    // Quatro campos de placar, preenchidos só com o teclado, na ordem de leitura.
    await tabUntil(page, { selector: 'input[type="number"]' })
    const scores = ['21', '15', '21', '12']
    for (const [index, score] of scores.entries()) {
      await page.keyboard.press('Control+A')
      await page.keyboard.type(score)
      if (index < scores.length - 1) await page.keyboard.press('Tab')
    }
    await tabUntil(page, { selector: 'button', name: 'Confirmar resultado' })
    await page.keyboard.press('Enter')
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('button', { name: /vencedor/ }).first()).toBeVisible()
  })

  test('cadastrar atleta só pelo teclado, com o foco voltando ao botão que abriu o diálogo (2.1.1, 2.4.3)', async ({ page }) => {
    await page.goto('/admin/athletes')
    await expect(page.getByRole('table')).toBeVisible()
    await tabUntil(page, { selector: 'button', name: '^Novo atleta$' })
    const trigger = page.getByRole('button', { name: 'Novo atleta' })
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: 'Novo atleta' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByLabel('Nome completo')).toBeFocused()
    const name = `Teclado ${data.tag}`
    await page.keyboard.type(name)
    await page.keyboard.press('Enter') // submete o formulário
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
    await page.getByRole('searchbox', { name: /Buscar atletas/ }).fill(name)
    await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible()
  })
})

test.describe('diálogos e painéis', () => {
  interface OverlayCase {
    name: string
    open: (page: Page) => Promise<void>
    trigger: (page: Page) => ReturnType<Page['locator']>
  }
  const overlays: OverlayCase[] = [
    {
      name: 'lançar resultado',
      open: async (page) => {
        await page.goto(`/admin/tournaments/${data.running.tournament.id}`)
        await page.getByRole('tab', { name: 'Chaveamento' }).click()
        await page.getByRole('button', { name: /Abrir resultado/ }).first().click()
      },
      trigger: (page) => page.getByRole('button', { name: /Abrir resultado/ }).first(),
    },
    {
      name: 'novo atleta',
      open: async (page) => {
        await page.goto('/admin/athletes')
        await page.getByRole('button', { name: 'Novo atleta' }).click()
      },
      trigger: (page) => page.getByRole('button', { name: 'Novo atleta' }),
    },
    {
      name: 'novo clube',
      open: async (page) => {
        await page.goto('/admin/clubs')
        await page.getByRole('button', { name: 'Novo clube' }).click()
      },
      trigger: (page) => page.getByRole('button', { name: 'Novo clube' }),
    },
    {
      name: 'encerrar campeonato',
      open: async (page) => {
        await page.goto(`/admin/tournaments/${data.readyToFinalize.tournament.id}`)
        await page.getByRole('button', { name: 'Encerrar campeonato' }).click()
      },
      trigger: (page) => page.getByRole('button', { name: 'Encerrar campeonato' }),
    },
    {
      name: 'detalhes do atleta (sheet)',
      open: async (page) => {
        await page.goto('/admin/athletes')
        await page.getByRole('searchbox', { name: /Buscar atletas/ }).fill(data.champion.name)
        await page.getByRole('button', { name: new RegExp(data.champion.name) }).first().click()
      },
      trigger: (page) => page.getByRole('button', { name: new RegExp(data.champion.name) }).first(),
    },
    {
      name: 'agendar partida',
      open: async (page) => {
        await page.goto(`/admin/tournaments/${data.running.tournament.id}`)
        await page.getByRole('tab', { name: 'Agenda' }).click()
        await page.getByRole('button', { name: /^Agendar partida/ }).first().click()
      },
      trigger: (page) => page.getByRole('button', { name: /^Agendar partida/ }).first(),
    },
    {
      name: 'agenda automática',
      open: async (page) => {
        await page.goto(`/admin/tournaments/${data.running.tournament.id}`)
        await page.getByRole('tab', { name: 'Agenda' }).click()
        await page.getByRole('button', { name: 'Gerar agenda automática' }).click()
      },
      trigger: (page) => page.getByRole('button', { name: 'Gerar agenda automática' }),
    },
  ]

  for (const overlay of overlays) {
    test(`${overlay.name}: modal, foco preso, Escape fecha, foco volta ao gatilho, fundo inerte (2.1.2, 2.4.3, 4.1.2)`, async ({ page }) => {
      await overlay.open(page)
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      // Nome e descrição existem (o Radix avisa no console se faltar descrição).
      await expect(dialog).not.toHaveAccessibleName('')
      await expect(dialog).toHaveAttribute('aria-describedby', /.+/)
      expect(await focusIsInside(page, dialog), 'o foco começa dentro do diálogo').toBe(true)

      // O foco nunca escapa: Tab e Shift+Tab em volta (mais voltas que controles).
      for (let i = 0; i < 25; i++) {
        await page.keyboard.press('Tab')
        expect(await focusIsInside(page, dialog), `Tab ${i + 1} saiu do diálogo`).toBe(true)
      }
      for (let i = 0; i < 25; i++) {
        await page.keyboard.press('Shift+Tab')
        expect(await focusIsInside(page, dialog), `Shift+Tab ${i + 1} saiu do diálogo`).toBe(true)
      }

      // Fundo inerte para tecnologia assistiva: o conteúdo atrás some da árvore de acessibilidade.
      await expect(page.getByRole('main')).toHaveCount(0)

      await page.keyboard.press('Escape')
      await expect(dialog).toBeHidden()
      await expect(overlay.trigger(page)).toBeFocused()
      await expect(page.getByRole('main')).toHaveCount(1)
    })
  }

  test('menu e lista abertos prendem o foco: Tab não chega ao shell escondido pelo Radix (2.4.3, 4.1.2)', async ({ page }) => {
    // Base da exceção do axe para "aria-hidden-focus": com o overlay aberto, o shell fica aria-hidden e inalcançável.
    await page.goto('/')
    await page.getByRole('button', { name: 'Alterar tema' }).click()
    const menu = page.getByRole('menu')
    await expect(menu).toBeVisible()
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab')
      expect(await focusIsInside(page, menu), `Tab ${i + 1} saiu do menu`).toBe(true)
    }
    await page.keyboard.press('Escape')

    await page.goto(`/admin/rankings/${data.ranking.id}`)
    await page.getByRole('tab', { name: 'Regras de Pontos' }).click()
    await page.getByRole('button', { name: 'Nova Regra' }).click()
    await page.getByRole('combobox', { name: /Nível do Torneio/ }).click()
    const list = page.getByRole('listbox')
    await expect(list).toBeVisible()
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab')
      expect(await focusIsInside(page, list), `Tab ${i + 1} saiu da lista`).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(list).toBeHidden()
  })

  test('menu de tema: Escape fecha e devolve o foco ao botão (2.1.2, 2.4.3)', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Alterar tema' }).click()
    await expect(page.getByRole('menu')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('menu')).toBeHidden()
    await expect(page.getByRole('button', { name: 'Alterar tema' })).toBeFocused()
  })
})

test.describe('formulários', () => {
  test('erros anunciados e ligados ao campo: aria-invalid, aria-describedby, role=alert e foco no primeiro erro (3.3.1, 3.3.3, 4.1.3)', async ({ page }) => {
    await page.goto('/admin/athletes')
    await page.getByRole('button', { name: 'Novo atleta' }).click()
    const dialog = page.getByRole('dialog', { name: 'Novo atleta' })
    await dialog.getByLabel('E-mail').fill('sem-arroba')
    await dialog.getByRole('button', { name: 'Criar atleta' }).click()

    const name = dialog.getByLabel('Nome completo')
    await expect(name).toHaveAttribute('aria-invalid', 'true')
    await expect(name).toBeFocused()
    const describedBy = (await name.getAttribute('aria-describedby')) ?? ''
    expect(describedBy).not.toBe('')
    const message = page.locator(`[id="${describedBy.split(' ')[0] ?? ''}"]`)
    await expect(message).toHaveText('Nome é obrigatório')
    await expect(message).toHaveAttribute('role', 'alert')

    const email = dialog.getByLabel('E-mail')
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    await expect(page.locator(`[id="${(await email.getAttribute('aria-describedby')) ?? ''}"]`)).toHaveText('E-mail inválido')

    // Corrigir o erro tira o estado inválido no próximo envio.
    await name.fill(`Valida ${data.tag}`)
    await email.fill('')
    await dialog.getByRole('button', { name: 'Criar atleta' }).click()
    await expect(dialog).toBeHidden()
  })

  test('erro de validação do resultado é anunciado e os campos apontam para ele (3.3.1, 4.1.3)', async ({ page }) => {
    await page.goto(`/admin/tournaments/${data.running.tournament.id}`)
    await page.getByRole('tab', { name: 'Chaveamento' }).click()
    await page.getByRole('button', { name: /Abrir resultado/ }).first().click()
    const dialog = page.getByRole('dialog', { name: 'Lançar Resultado' })
    await dialog.getByRole('button', { name: 'Confirmar resultado' }).click()
    const alert = dialog.getByRole('alert')
    await expect(alert).toBeVisible()
    const scores = dialog.getByRole('spinbutton')
    await expect(scores.first()).toHaveAttribute('aria-invalid', 'true')
    const id = await alert.getAttribute('id')
    expect(await scores.first().getAttribute('aria-describedby')).toBe(id)
    // Tipo de resultado: grupo de rádios com legenda e um marcado.
    await expect(dialog.getByRole('radio', { checked: true })).toHaveCount(1)
    await expect(dialog.getByRole('group', { name: 'Tipo de resultado' })).toBeVisible()
  })

  test('ícones de ação têm nome e tamanho: ações da lista de duplas e inscrições (4.1.2, 2.5.8)', async ({ page }) => {
    await page.goto('/admin/pairs')
    await expect(page.getByText(/Parceiro Acessível/).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /^Editar dupla/ }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /^(Desativar|Reativar) dupla/ }).first()).toBeVisible()
    await page.goto(`/admin/tournaments/${data.open.tournament.id}`)
    await expect(page.getByRole('button', { name: /^Aprovar inscrição de/ }).first()).toBeVisible()
  })
})

test.describe('movimento reduzido', () => {
  test('com prefers-reduced-motion: reduce, nenhuma animação infinita roda (2.3.3, 2.2.2)', async ({ browser }) => {
    const running = (page: Page) =>
      page.evaluate(() =>
        document
          .getAnimations()
          .filter((a) => a.playState === 'running' && a.effect?.getComputedTiming().iterations === Infinity)
          .map((a) => (a.effect as KeyframeEffect | null)?.target?.className?.toString().slice(0, 50) ?? '?'),
      )

    const withMotion = await browser.newContext({ reducedMotion: 'no-preference', baseURL: test.info().project.use.baseURL ?? '' })
    const motionPage = await withMotion.newPage()
    await motionPage.goto(`/t/${data.running.tournament.slug}`)
    await expect(motionPage.getByRole('region', { name: 'Ao vivo agora' }).getByRole('article')).toBeVisible()
    expect((await running(motionPage)).length, 'sem preferência, os pontos pulsam (o teste mede algo)').toBeGreaterThan(0)
    await withMotion.close()

    const reduced = await browser.newContext({ reducedMotion: 'reduce', baseURL: test.info().project.use.baseURL ?? '' })
    const reducedPage = await reduced.newPage()
    await reducedPage.goto(`/t/${data.running.tournament.slug}`)
    await expect(reducedPage.getByRole('region', { name: 'Ao vivo agora' }).getByRole('article')).toBeVisible()
    await expect.poll(() => running(reducedPage)).toEqual([])

    // Operador: pontos de "ao vivo" e spinners também.
    await reducedPage.goto('/admin/live')
    await reducedPage.getByLabel('Torneio').selectOption({ label: data.running.tournament.name })
    await reducedPage.getByRole('button', { name: /^Quadra 1/ }).click()
    await expect(reducedPage.getByRole('region', { name: /^Partida ao vivo:/ })).toBeVisible()
    await expect.poll(() => running(reducedPage)).toEqual([])

    // Transições e entradas de diálogo viram instantâneas.
    await reducedPage.goto('/admin/athletes')
    await reducedPage.getByRole('button', { name: 'Novo atleta' }).click()
    await expect(reducedPage.getByRole('dialog')).toBeVisible()
    const durations = await reducedPage.getByRole('dialog').evaluate((el) => getComputedStyle(el).animationDuration)
    expect(durations.split(',').every((d) => parseFloat(d) <= 0.001)).toBe(true)
    await reduced.close()
  })
})

test.describe('reflow, zoom e alvos de toque', () => {
  const reflowPages = (): PageCase[] => [
    ...publicPages(getData).filter((p) => !/inexistente/.test(p.name)),
    ...adminPages(getData).filter((p) => !/ao vivo/.test(p.name)),
  ]

  test('320 px de largura (400% de zoom em 1280): sem rolagem horizontal da página (1.4.10)', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 })
    const problems: string[] = []
    for (const target of reflowPages()) {
      await openReady(page, target)
      const overflow = await horizontalOverflow(page)
      if (overflow) problems.push(`${target.name}: ${overflow}`)
    }
    expect(problems).toEqual([])
  })

  test('console do operador em 320 px também reflui (1.4.10)', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 })
    await page.goto('/admin/live')
    await page.getByLabel('Torneio').selectOption({ label: data.running.tournament.name })
    await page.getByRole('button', { name: /^Quadra 1/ }).click()
    await expect(page.getByRole('region', { name: /^Partida ao vivo:/ })).toBeVisible()
    await expectNoHorizontalScroll(page, 'ao vivo em 320px')
  })

  test('200% de zoom (viewport de 640 px) mantém o conteúdo legível e sem corte (1.4.4)', async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 400 })
    for (const target of [publicPages(getData)[0], publicPages(getData)[4], adminPages(getData)[0], adminPages(getData)[1]]) {
      if (!target) continue
      await openReady(page, target)
      await expectNoHorizontalScroll(page, `${target.name} em 640px`)
      // Texto continua selecionável e sem fonte fixa em px minúsculos: nenhum texto abaixo de 10px.
      const tiny = await page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>('body *'))
          .filter((el) => el.children.length === 0 && (el.textContent ?? '').trim().length > 0 && parseFloat(getComputedStyle(el).fontSize) < 10)
          .map((el) => `${el.tagName.toLowerCase()} ${getComputedStyle(el).fontSize} "${(el.textContent ?? '').trim().slice(0, 20)}"`),
      )
      expect(tiny, `${target.name}: texto abaixo de 10px`).toEqual([])
    }
  })

  test('alvos de toque de pelo menos 24x24 px nas telas do admin e do público no celular (2.5.8)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const problems: string[] = []
    for (const target of reflowPages()) {
      await openReady(page, target)
      for (const small of await smallTargets(page, 24)) problems.push(`${target.name}: ${small}`)
    }
    // Lista única (sem repetir o mesmo controle de nome parecido) para o relatório caber na tela.
    const unique = [...new Set(problems.map((p) => p.replace(/[0-9a-f]{6}/g, '#')))]
    expect(problems.length, unique.join(String.fromCharCode(10))).toBe(0)
  })

  test('console do operador: alvos de 44 px ou mais (2.5.5, recomendação da especificação)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/admin/live')
    await page.getByLabel('Torneio').selectOption({ label: data.running.tournament.name })
    await page.getByRole('button', { name: /^Quadra 1/ }).click()
    const board = page.getByRole('region', { name: /^Partida ao vivo:/ })
    await expect(board).toBeVisible()
    const small = await smallTargets(page, 44, 'main')
    expect(small).toEqual([])
    // O botão "Quadra 2" e a fila também.
    await page.getByRole('button', { name: /^Quadra 2/ }).click()
    await expect(page.getByRole('button', { name: 'Iniciar' }).first()).toBeVisible()
    expect(await smallTargets(page, 44, 'main')).toEqual([])
  })
})

test.describe('regiões ao vivo', () => {
  test('poucas regiões aria-live, nenhuma assertive, e o placar público anuncia só eventos (4.1.3)', async ({ page }) => {
    for (const target of [publicPages(getData)[3], publicPages(getData)[4], adminPages(getData).find((p) => p.name.startsWith('ao vivo'))].filter((t): t is PageCase => Boolean(t))) {
      await openReady(page, target)
      const regions = await page.evaluate(() =>
        Array.from(document.querySelectorAll('[aria-live], [role="status"], [role="alert"], [role="log"]')).map((el) => ({
          live: el.getAttribute('aria-live') ?? (el.getAttribute('role') === 'alert' ? 'assertive' : 'polite'),
          role: el.getAttribute('role') ?? '',
          text: (el.textContent ?? '').trim().slice(0, 80),
        })),
      )
      expect(regions.filter((r) => r.live === 'assertive' && r.role !== 'alert'), `${target.name}: aria-live assertive`).toEqual([])
      expect(regions.length, `${target.name}: regiões ao vivo demais: ${JSON.stringify(regions)}`).toBeLessThanOrEqual(6)
      // Alertas ficam vazios até haver um erro.
      expect(regions.filter((r) => r.role === 'alert' && r.text), `${target.name}: role=alert com texto na carga`).toEqual([])
    }
  })

  test('placar do operador: uma região ao vivo, que reflete o novo placar a cada ponto (4.1.3)', async ({ page }) => {
    await page.goto('/admin/live')
    await page.getByLabel('Torneio').selectOption({ label: data.running.tournament.name })
    await page.getByRole('button', { name: /^Quadra 1/ }).click()
    const board = page.getByRole('region', { name: /^Partida ao vivo:/ })
    await expect(board).toBeVisible()
    const live = board.locator('[aria-live]')
    expect(await live.count(), 'uma única região ao vivo no placar').toBe(1)
    await expect(live).toContainText(/Placar: 1-0/)
    await board.getByRole('button', { name: `Marcar ponto para ${data.running.liveMatch.participant1 ?? ''}` }).click()
    await expect(live).toContainText(/Placar: 2-0/)
  })
})
