import type { FastifyInstance } from 'fastify'
import { db } from '../db/index'
import { athletes, athleteAffiliations, clubs, tenants } from '../db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { randomUUID } from 'crypto'

const rowSchema = z.object({
  nome: z.string().min(1, 'nome é obrigatório'),
  email: z.string().email('e-mail inválido').optional().or(z.literal('')),
  sexo: z.enum(['M', 'F'], { errorMap: () => ({ message: 'sexo deve ser M ou F' }) }),
  data_nascimento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'data_nascimento deve ser AAAA-MM-DD')
    .optional()
    .or(z.literal('')),
  clube_nome: z.string().min(1, 'clube_nome é obrigatório'),
  afiliacao_inicio: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'afiliacao_inicio deve ser AAAA-MM-DD'),
  categorias: z.string().optional(),
  nacionalidade: z.string().optional(),
  foto_url: z.string().url('foto_url inválida').optional().or(z.literal('')),
})

type RowInput = z.infer<typeof rowSchema>

const importBodySchema = z.object({
  tenantId: z.string().min(1),
  rows: z.array(z.record(z.string(), z.unknown())),
})

export async function importRoutes(app: FastifyInstance) {
  /**
   * POST /import/athletes
   * Body: { tenantId: string, rows: Record<string, unknown>[] }
   * Retorna: { imported: number, errors: { row: number, field: string, message: string }[] }
   *
   * Cada linha é processada individualmente — erros não interrompem as linhas válidas.
   * Lógica:
   *   1. Valida os campos da linha com Zod
   *   2. Upsert do atleta por e-mail (se fornecido) ou cria novo
   *   3. Busca o clube pelo nome dentro do tenant
   *   4. Encerra afiliação ativa anterior (endedAt = afiliacao_inicio)
   *   5. Cria nova afiliação
   */
  app.post('/import/athletes', async (request, reply) => {
    const body = importBodySchema.parse(request.body)
    const { tenantId, rows } = body

    // Verifica que o tenant existe
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId))
    if (!tenant) return reply.status(404).send({ error: 'Tenant não encontrado' })

    // Cache de clubes do tenant para evitar N+1
    const clubList = await db
      .select({ id: clubs.id, name: clubs.name })
      .from(clubs)
      .where(eq(clubs.tenantId, tenantId))
    const clubMap = new Map(clubList.map((c) => [c.name.toLowerCase().trim(), c.id]))

    const errors: { row: number; field: string; message: string }[] = []
    let imported = 0

    for (let i = 0; i < rows.length; i++) {
      const rawRow = rows[i]
      const rowNumber = i + 1 // 1-indexed para o usuário

      // Ignora linhas completamente vazias
      const nonEmpty = Object.values(rawRow).some((v) => v !== null && v !== undefined && v !== '')
      if (!nonEmpty) continue

      // Valida com Zod
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

      const row = parsed.data as RowInput

      // Resolve clube
      const clubId = clubMap.get(row.clube_nome.toLowerCase().trim())
      if (!clubId) {
        errors.push({ row: rowNumber, field: 'clube_nome', message: `Clube "${row.clube_nome}" não encontrado neste tenant` })
        continue
      }

      try {
        await db.transaction(async (tx) => {
          // Upsert atleta por e-mail (se fornecido)
          let athleteId: string | null = null

          if (row.email) {
            const [existing] = await tx
              .select({ id: athletes.id })
              .from(athletes)
              .where(eq(athletes.email, row.email))

            if (existing) {
              athleteId = existing.id
              await tx.update(athletes).set({
                name: row.nome,
                gender: row.sexo,
                birthDate: row.data_nascimento || null,
                nationality: row.nacionalidade || 'BR',
                photoUrl: row.foto_url || null,
                updatedAt: new Date(),
              }).where(eq(athletes.id, athleteId))
            }
          }

          if (!athleteId) {
            athleteId = randomUUID()
            await tx.insert(athletes).values({
              id: athleteId,
              name: row.nome,
              email: row.email || null,
              gender: row.sexo,
              birthDate: row.data_nascimento || null,
              nationality: row.nacionalidade || 'BR',
              photoUrl: row.foto_url || null,
              active: true,
            })
          }

          // Encerra afiliação ativa anterior deste atleta neste tenant
          await tx
            .update(athleteAffiliations)
            .set({ endedAt: row.afiliacao_inicio, updatedAt: new Date() })
            .where(
              and(
                eq(athleteAffiliations.athleteId, athleteId),
                eq(athleteAffiliations.tenantId, tenantId),
                isNull(athleteAffiliations.endedAt)
              )
            )

          // Nova afiliação
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

    return { imported, errors }
  })

  /**
   * GET /import/athletes/template-columns
   * Retorna as colunas esperadas para validação no frontend antes do upload.
   */
  app.get('/import/athletes/template-columns', async () => {
    return {
      required: ['nome', 'sexo', 'clube_nome', 'afiliacao_inicio'],
      optional: ['email', 'data_nascimento', 'categorias', 'nacionalidade', 'foto_url'],
    }
  })
}
