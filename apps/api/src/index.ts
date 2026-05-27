import Fastify from 'fastify'
import cors from '@fastify/cors'

const app = Fastify({ logger: true })

await app.register(cors)

app.get('/health', async () => ({ ok: true }))

await app.listen({ port: 3001, host: '0.0.0.0' })