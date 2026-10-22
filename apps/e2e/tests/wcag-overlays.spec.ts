import { expect, test, type Page } from '@playwright/test'
import { expectNoViolations } from '../support/axe.js'
import { playWholeDraw, prepareTournament } from '../support/factories.js'
import { prepareWcagData, type WcagData } from '../support/wcag-data.js'
import { expectTheme, settle, THEMES, useTheme, VIEWPORTS } from '../support/wcag-page.js'

// Auditoria WCAG 2.1 AA (axe-core) com cada overlay ABERTO: diálogos, sheet, menus, formulários e toasts.
// O axe roda na página inteira com o overlay aberto (o fundo precisa estar inerte/oculto para leitores de tela).

let data: WcagData

test.beforeAll(async () => {
  data = await prepareWcagData()
})

interface OverlayCase {
  name: string
  /** Leva ao overlay aberto e espera ele estar pronto. */
  open: (page: Page) => Promise<void>
}

const dialog = (page: Page) => page.getByRole('dialog')
const expectOpenDialog = async (page: Page, name: string | RegExp) => {
  await expect(dialog(page)).toBeVisible()
  await expect(dialog(page)).toHaveAccessibleName(name)
}

const openTab = (page: Page, name: string) => page.getByRole('tab', { name, exact: true }).click()

async function openBracketMatch(page: Page, tournamentId: string, matchName: RegExp): Promise<void> {
  await page.goto(`/admin/tournaments/${tournamentId}`)
  await openTab(page, 'Chaveamento')
  await page.getByRole('button', { name: matchName }).first().click()
}

const overlays: OverlayCase[] = [
  {
    name: 'menu de tema (público)',
    open: async (page) => {
      await page.goto('/')
      await page.getByRole('button', { name: 'Alterar tema' }).click()
      await expect(page.getByRole('menu')).toBeVisible()
    },
  },
  {
    name: 'menu de tema (admin)',
    open: async (page) => {
      await page.goto('/admin')
      await page.getByRole('button', { name: 'Alterar tema' }).click()
      await expect(page.getByRole('menu')).toBeVisible()
    },
  },
  {
    name: 'toast de link copiado (compartilhar)',
    open: async (page) => {
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
      await page.goto(`/t/${data.completed.tournament.slug}`)
      await page.getByRole('button', { name: 'Compartilhar' }).click()
      await expect(page.getByText('Link copiado').first()).toBeVisible()
    },
  },
  {
    name: 'toast de erro (ranking duplicado)',
    open: async (page) => {
      await page.goto('/admin/rankings')
      await page.getByRole('button', { name: 'Novo ranking' }).click()
      await page.getByLabel(/^Nome/).fill(data.ranking.name)
      await page.getByRole('button', { name: 'Criar ranking' }).click()
      await expect(page.getByText('Erro ao criar ranking', { exact: true })).toBeVisible()
    },
  },
  {
    name: 'resultado: lançar',
    open: async (page) => {
      await openBracketMatch(page, data.running.tournament.id, /Abrir resultado/)
      await expectOpenDialog(page, 'Lançar Resultado')
    },
  },
  {
    name: 'resultado: erro de validação',
    open: async (page) => {
      await openBracketMatch(page, data.running.tournament.id, /Abrir resultado/)
      await expectOpenDialog(page, 'Lançar Resultado')
      await dialog(page).getByRole('button', { name: 'Confirmar resultado' }).click()
      await expect(dialog(page).getByRole('alert')).toBeVisible()
    },
  },
  {
    name: 'resultado: W.O.',
    open: async (page) => {
      await openBracketMatch(page, data.running.tournament.id, /Abrir resultado/)
      await expectOpenDialog(page, 'Lançar Resultado')
      // O <input> do rádio fica escondido (sr-only); o usuário clica no rótulo.
      await dialog(page).getByText('W.O.', { exact: true }).click()
      await expect(dialog(page).getByRole('radio', { name: 'W.O.' })).toBeChecked()
      await expect(dialog(page).getByText('Quem avança?')).toBeVisible()
    },
  },
  {
    name: 'resultado: editar (partida encerrada)',
    open: async (page) => {
      await page.goto(`/admin/tournaments/${data.readyToFinalize.tournament.id}`)
      await openTab(page, 'Chaveamento')
      await page.getByRole('button', { name: /Abrir resultado/ }).first().click()
      await expectOpenDialog(page, 'Editar Resultado')
    },
  },
  {
    name: 'agenda: agendar partida',
    open: async (page) => {
      await page.goto(`/admin/tournaments/${data.running.tournament.id}`)
      await openTab(page, 'Agenda')
      await page.getByRole('button', { name: /^Agendar partida/ }).first().click()
      await expectOpenDialog(page, /Agendar Partida/)
    },
  },
  {
    name: 'agenda automática: formulário',
    open: async (page) => {
      await page.goto(`/admin/tournaments/${data.running.tournament.id}`)
      await openTab(page, 'Agenda')
      await page.getByRole('button', { name: 'Gerar agenda automática' }).click()
      await expectOpenDialog(page, /agenda/i)
    },
  },
  {
    name: 'agenda automática: pré-visualização',
    open: async (page) => {
      await page.goto(`/admin/tournaments/${data.running.tournament.id}`)
      await openTab(page, 'Agenda')
      await page.getByRole('button', { name: 'Gerar agenda automática' }).click()
      await dialog(page).getByRole('button', { name: /Pré-visualizar/ }).click()
      await expect(dialog(page).getByRole('table')).toBeVisible()
    },
  },
  {
    name: 'encerrar campeonato: confirmação',
    open: async (page) => {
      await page.goto(`/admin/tournaments/${data.readyToFinalize.tournament.id}`)
      await page.getByRole('button', { name: 'Encerrar campeonato' }).click()
      await expectOpenDialog(page, 'Encerrar Campeonato')
    },
  },
  {
    name: 'encerrar campeonato: erro (chaves incompletas)',
    open: async (page) => {
      await page.goto(`/admin/tournaments/${data.running.tournament.id}`)
      await page.getByRole('button', { name: 'Encerrar campeonato' }).click()
      await dialog(page).getByRole('button', { name: 'Confirmar encerramento' }).click()
      await expect(dialog(page).getByRole('alert')).toBeVisible()
    },
  },
  {
    name: 'encerrar campeonato: relatório final',
    open: async (page) => {
      // Torneio próprio: encerrar muda o status, então não dá para reaproveitar o dos outros casos.
      const own = await prepareTournament({ athleteCount: 4, name: `Encerrar ${data.tag} ${Date.now().toString(36)}` })
      await playWholeDraw(own.draw.id)
      await page.goto(`/admin/tournaments/${own.tournament.id}`)
      await page.getByRole('button', { name: 'Encerrar campeonato' }).click()
      await dialog(page).getByRole('button', { name: 'Confirmar encerramento' }).click()
      await expect(dialog(page).getByText('Campeonato encerrado com sucesso!')).toBeVisible()
    },
  },
  {
    name: 'atleta: sheet de detalhes',
    open: async (page) => {
      await page.goto('/admin/athletes')
      await page.getByRole('searchbox', { name: /Buscar atletas/ }).fill(data.champion.name)
      await page.getByRole('button', { name: new RegExp(data.champion.name) }).first().click()
      await expectOpenDialog(page, data.champion.name)
    },
  },
  {
    name: 'atleta: novo (formulário)',
    open: async (page) => {
      await page.goto('/admin/athletes')
      await page.getByRole('button', { name: 'Novo atleta' }).click()
      await expectOpenDialog(page, 'Novo atleta')
    },
  },
  {
    name: 'atleta: novo (erros de validação)',
    open: async (page) => {
      await page.goto('/admin/athletes')
      await page.getByRole('button', { name: 'Novo atleta' }).click()
      await dialog(page).getByLabel('E-mail').fill('sem-arroba')
      await dialog(page).getByRole('button', { name: 'Criar atleta' }).click()
      await expect(dialog(page).getByText('Nome é obrigatório')).toBeVisible()
    },
  },
  {
    name: 'atleta: importar CSV (com pré-visualização)',
    open: async (page) => {
      await page.goto('/admin/athletes')
      await page.getByRole('button', { name: 'Importar CSV' }).click()
      await expectOpenDialog(page, /Importar atletas/)
      await dialog(page).locator('input[type="file"]').setInputFiles({
        name: 'atletas.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from('name,gender,birthDate,email,nationality\nJoão Silva,M,1995-03-20,joao@email.com,BR\nMaria Santos,F,1998-07-15,,BR'),
      })
      await expect(dialog(page).getByRole('table')).toBeVisible()
    },
  },
  {
    name: 'clube: novo (formulário)',
    open: async (page) => {
      await page.goto('/admin/clubs')
      await page.getByRole('button', { name: 'Novo clube' }).click()
      await expectOpenDialog(page, 'Novo clube')
    },
  },
  {
    name: 'clube: novo (erros de validação)',
    open: async (page) => {
      await page.goto('/admin/clubs')
      await page.getByRole('button', { name: 'Novo clube' }).click()
      await dialog(page).getByRole('button', { name: 'Criar clube' }).click()
      await expect(dialog(page).getByText('Nome é obrigatório')).toBeVisible()
    },
  },
  {
    name: 'clube: editar',
    open: async (page) => {
      await page.goto(`/admin/clubs/${data.club.id}`)
      await page.getByRole('button', { name: 'Editar clube' }).click()
      await expectOpenDialog(page, /Editar clube/)
    },
  },
  {
    name: 'dupla: nova',
    open: async (page) => {
      await page.goto('/admin/pairs')
      await page.getByRole('button', { name: 'Nova dupla' }).first().click()
      await expectOpenDialog(page, /dupla/i)
    },
  },
  {
    name: 'dupla: editar',
    open: async (page) => {
      await page.goto('/admin/pairs')
      await expect(page.getByText(/Parceiro Acessível/).first()).toBeVisible()
      await page.getByRole('button', { name: /^Editar dupla/ }).first().click()
      await expectOpenDialog(page, /dupla/i)
    },
  },
  {
    name: 'inscrições: formulário de inscrição',
    open: async (page) => {
      await page.goto(`/admin/tournaments/${data.open.tournament.id}`)
      await page.getByRole('button', { name: 'Inscrever' }).click()
      await expect(page.getByLabel('Buscar atleta')).toBeVisible()
    },
  },
  {
    name: 'inscrições: recusar (motivo)',
    open: async (page) => {
      await page.goto(`/admin/tournaments/${data.open.tournament.id}`)
      await page.getByRole('button', { name: /^Recusar inscrição de/ }).first().click()
      await expect(page.getByLabel('Motivo da recusa')).toBeVisible()
    },
  },
  {
    name: 'ranking: novo (formulário)',
    open: async (page) => {
      await page.goto('/admin/rankings')
      await page.getByRole('button', { name: 'Novo ranking' }).click()
      await expect(page.getByRole('heading', { name: 'Novo Ranking' })).toBeVisible()
    },
  },
  {
    name: 'ranking: editar',
    open: async (page) => {
      await page.goto(`/admin/rankings/${data.ranking.id}`)
      await page.getByRole('button', { name: 'Editar', exact: true }).click()
      await expect(page.getByRole('heading', { name: 'Editar Ranking' })).toBeVisible()
    },
  },
  {
    name: 'ranking: regras de pontos (select aberto)',
    open: async (page) => {
      await page.goto(`/admin/rankings/${data.ranking.id}`)
      await openTab(page, 'Regras de Pontos')
      await page.getByRole('button', { name: 'Nova Regra' }).click()
      await page.getByRole('combobox', { name: /Nível do Torneio/ }).click()
      await expect(page.getByRole('listbox')).toBeVisible()
    },
  },
  {
    name: 'ao vivo: confirmar encerramento da partida',
    open: async (page) => {
      await page.goto('/admin/live')
      await page.getByLabel('Torneio').selectOption({ label: data.running.tournament.name })
      await page.getByRole('button', { name: /^Quadra 1/ }).click()
      await page.getByRole('button', { name: 'Cancelar início da partida' }).click()
      await expectOpenDialog(page, 'Cancelar o início?')
    },
  },
]

test.describe('WCAG axe: overlays abertos', () => {
  for (const theme of THEMES) {
    for (const viewport of VIEWPORTS) {
      test.describe(`${theme}, ${viewport.name}`, () => {
        test.use({ viewport: { width: viewport.width, height: viewport.height } })
        for (const overlay of overlays) {
          test(overlay.name, async ({ page }) => {
            await useTheme(page, theme)
            await overlay.open(page)
            await expectTheme(page, theme)
            await settle(page)
            await expectNoViolations(page, `${overlay.name} [${theme}, ${viewport.name}]`)
          })
        }
      })
    }
  }
})
