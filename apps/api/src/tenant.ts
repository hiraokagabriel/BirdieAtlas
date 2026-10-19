import { eq } from 'drizzle-orm'
import { db } from './db/index.js'
import { tenants } from './db/schema.js'

// Até o Clerk trazer organizações, toda operação administrativa roda no tenant padrão:
// DEFAULT_TENANT_SLUG, ou o único tenant cadastrado quando a variável não está definida.
// O tenantId enviado pelo cliente é ignorado.

let cachedTenantId: string | null = null

export class TenantConfigError extends Error {
  readonly statusCode = 500
  readonly code = 'TENANT_NOT_CONFIGURED'
}

export async function getDefaultTenantId(): Promise<string> {
  if (cachedTenantId) return cachedTenantId

  const slug = process.env['DEFAULT_TENANT_SLUG']
  if (slug) {
    const [tenant] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, slug))
    if (!tenant) throw new TenantConfigError(`DEFAULT_TENANT_SLUG="${slug}" não corresponde a nenhum tenant.`)
    cachedTenantId = tenant.id
    return tenant.id
  }

  const all = await db.select({ id: tenants.id }).from(tenants).limit(2)
  if (all.length !== 1) {
    throw new TenantConfigError('Defina DEFAULT_TENANT_SLUG: há zero ou mais de um tenant cadastrado.')
  }
  cachedTenantId = all[0]!.id
  return cachedTenantId
}
