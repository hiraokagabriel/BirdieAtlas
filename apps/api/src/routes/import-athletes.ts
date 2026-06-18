import type { FastifyInstance } from 'fastify'
import { db } from '../db/index'
import { athletes, athleteAffiliations, clubs, tenants } from '../db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { randomUUID } from 'crypto'

// ---------------------------------------------------------------------------
// Schema de validação de cada linha da planilha
// ---------------------------------------------------------------------------
const rowSchema = z.object({
  nome: z.string().min(1, 'nome é obrigatório'),
  email: z
    .string()
    .email('e-mail inválido')
    .optional()
    .or(z.literal('')),
  sexo: z.enum(['M', 'F'], {
    errorMap: () => ({ message: 'sexo deve ser M ou F' }),
  }),
  data_nascimento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'data_nascimento deve ser AAAA-MM-DD')
    .optional()
    .or(z.literal('')),
  clube_nome: z.string().min(1, 'clube_nome é obrigatório'),
  afiliacao_inicio: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'afiliacao_inicio deve ser AAAA-MM-DD'),
  categorias: z.string().optional().or(z.literal('')),
  nacionalidade: z.string().optional().or(z.literal('')),
  foto_url: z
    .string()
    .url('foto_url inválida')
    .optional()
    .or(z.literal('')),
})

const importBodySchema = z.object({
  tenantId: z.string().min(1),
  /**
   * Array de objetos chave→valor lido da planilha.
   * O frontend parseia o XLSX e envia as linhas já como JSON.
   */
  rows: z.array(z.record(z.string(), z.unknown())),
})

export type ImportAthletesError = {
  row: number
  field: string
  message: string
}

export async function importAthletesRoutes(app: FastifyInstance) {
  /**
   * POST /import/athletes
   *
   * Importação em lote de atletas a partir de uma planilha XLSX.
   * O frontend lê o arquivo com SheetJS e envia as linhas como JSON.
   *
   * Cada linha é processada individualmente dentro de uma transação:
   *  1. Valida campos com Zod
   *  2. Upsert do atleta por e-mail (se fornecido) ou cria novo
   *  3. Resolve o clube pelo nome dentro do tenant
   *  4. Encerra afiliação ativa anterior (endedAt = afiliacao_inicio - 1 dia)
   *  5. Cria nova afiliação com startedAt = afiliacao_inicio
   *
   * Linhas com erro NÃO interrompem as linhas válidas.
   */
  app.post('/import/athletes', async (request, reply) => {
    const parseResult = importBodySchema.safeParse(request.body)
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Payload inválido',
        details: parseResult.error.issues,
      })
    }
    const { tenantId, rows } = parseResult.data

    // Verifica que o tenant existe
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
    if (!tenant) {
      return reply.status(404).send({ error: 'Tenant não encontrado' })
    }

    // Cache de clubes do tenant — evita N+1
    const clubList = await db
      .select({ id: clubs.id, name: clubs.name })
      .from(clubs)
      .where(eq(clubs.tenantId, tenantId))
    const clubMap = new Map(
      clubList.map((c) => [c.name.toLowerCase().trim(), c.id])
    )

    const errors: ImportAthletesError[] = []
    let imported = 0

    for (let i = 0; i < rows.length; i++) {
      const rawRow = rows[i]
      const rowNumber = i + 1 // 1-indexed para o usuário

      // Ignora linhas totalmente em branco
      const hasContent = Object.values(rawRow).some(
        (v) => v !== null && v !== undefined && v !== ''
      )
      if (!hasContent) continue

      // Validação Zod
      const parsed = rowSchema.safeParse(rawRow)
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          errors.push({
            row: rowNumber,
            field: issue.path.join('.'),
            message: issue.message,
          })
        }
        continue
      }

      const row = parsed.data

      // Resolve clube
      const clubId = clubMap.get(row.clube_nome.toLowerCase().trim())
      if (!clubId) {
        errors.push({
          row: rowNumber,
          field: 'clube_nome',
          message: `Clube "${row.clube_nome}" não encontrado neste tenant`,
        })
        continue
      }

      try {
        await db.transaction(async (tx) => {
          let athleteId: string | null = null

          // Tenta encontrar atleta pelo e-mail
          if (row.email) {
            const [existing] = await tx
              .select({ id: athletes.id })
              .from(athletes)
              .where(eq(athletes.email, row.email))

            if (existing) {
              athleteId = existing.id
              await tx
                .update(athletes)
                .set({
                  name: row.nome,
                  gender: row.sexo as 'M' | 'F',
                  birthDate: row.data_nascimento || null,
                  nationality: row.nacionalidade || 'BR',
                  photoUrl: row.foto_url || null,
                  updatedAt: new Date(),
                })
                .where(eq(athletes.id, athleteId))
            }
          }

          // Cria atleta se não encontrou pelo e-mail
          if (!athleteId) {
            athleteId = randomUUID()
            await tx.insert(athletes).values({
              id: athleteId,
              name: row.nome,
              email: row.email || null,
              gender: row.sexo as 'M' | 'F',
              birthDate: row.data_nascimento || null,
              nationality: row.nacionalidade || 'BR',
              photoUrl: row.foto_url || null,
              active: true,
            })
          }

          // Encerra afiliação ativa anterior deste atleta neste tenant
          // (a data de encerramento é o início da nova afiliação)
          await tx
            .update(athleteAffiliations)
            .set({
              endedAt: row.afiliacao_inicio,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(athleteAffiliations.athleteId, athleteId),
                eq(athleteAffiliations.tenantId, tenantId),
                isNull(athleteAffiliations.endedAt)
              )
            )

          // Cria nova afiliação
          await tx.insert(athleteAffiliations).values({
            id: randomUUID(),
            athleteId,
            clubId,
            tenantId,
            startedAt: row.afiliacao_inicio,
          })
        })

        imported++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push({ row: rowNumber, field: '_db', message: msg })
      }
    }

    return { imported, errors, total: rows.length }
  })

  /**
   * GET /import/athletes/template-columns
   * Retorna as colunas esperadas — usado pelo frontend para validar
   * a planilha antes de enviar.
   */
  app.get('/import/athletes/template-columns', async () => ({
    required: ['nome', 'sexo', 'clube_nome', 'afiliacao_inicio'],
    optional: [
      'email',
      'data_nascimento',
      'categorias',
      'nacionalidade',
      'foto_url',
    ],
  }))
}
