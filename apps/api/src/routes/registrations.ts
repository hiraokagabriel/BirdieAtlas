import type { FastifyPluginAsync } from "fastify";
import { and, asc, count, eq } from "drizzle-orm";
import {
  approveRegistrationBodySchema,
  registrationIdParamsSchema,
  tournamentRegistrationsParamsSchema,
  tournamentRegistrationsQuerySchema,
  updateRegistrationBodySchema,
} from "@birdieatlas/validators/registration";
import { db } from "../db/index.js";
import { athletes, tournamentCategories, tournamentRegistrations, tournaments } from "../db/schema.js";
import {
  canEditRegistration,
  getRegistrationStatus,
  validateRegistrationStatusChange,
} from "../domain/registration-rules.js";

const registrationsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get("/registrations/tournament/:tournamentId", async (request, reply) => {
    const paramsResult = tournamentRegistrationsParamsSchema.safeParse(request.params);
    const queryResult = tournamentRegistrationsQuerySchema.safeParse(request.query);
    if (!paramsResult.success || !queryResult.success) {
      return reply.status(400).send({ error: "Parâmetros inválidos.", code: "INVALID_REGISTRATION_QUERY", details: { params: paramsResult.success ? undefined : paramsResult.error.flatten(), query: queryResult.success ? undefined : queryResult.error.flatten() } });
    }
    const { page, pageSize, status } = queryResult.data;
    const tournamentId = paramsResult.data.tournamentId;
    const offset = (page - 1) * pageSize;
    const statusCondition = status === "approved" ? eq(tournamentRegistrations.confirmed, true) : status === "rejected" ? eq(tournamentRegistrations.withdrew, true) : status === "pending" ? and(eq(tournamentRegistrations.confirmed, false), eq(tournamentRegistrations.withdrew, false)) : undefined;
    const whereCondition = statusCondition ? and(eq(tournamentCategories.tournamentId, tournamentId), statusCondition) : eq(tournamentCategories.tournamentId, tournamentId);
    const [totalRow] = await db.select({ total: count() }).from(tournamentRegistrations).innerJoin(tournamentCategories, eq(tournamentRegistrations.categoryId, tournamentCategories.id)).where(whereCondition);
    const rows = await db.select({ id: tournamentRegistrations.id, tournamentId: tournamentCategories.tournamentId, athleteId: tournamentRegistrations.athleteId, athlete2Id: tournamentRegistrations.athlete2Id, categoryId: tournamentRegistrations.categoryId, confirmed: tournamentRegistrations.confirmed, withdrew: tournamentRegistrations.withdrew, athleteName: athletes.name, createdAt: tournamentRegistrations.createdAt, updatedAt: tournamentRegistrations.updatedAt }).from(tournamentRegistrations).innerJoin(tournamentCategories, eq(tournamentRegistrations.categoryId, tournamentCategories.id)).innerJoin(athletes, eq(tournamentRegistrations.athleteId, athletes.id)).where(whereCondition).orderBy(asc(tournamentRegistrations.createdAt)).limit(pageSize).offset(offset);
    const data = rows.map((row) => ({ id: row.id, tournamentId: row.tournamentId, athleteId: row.athleteId, pairId: row.athlete2Id, categoryId: row.categoryId, status: getRegistrationStatus({ confirmed: row.confirmed, withdrew: row.withdrew }), notes: null, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), display: { athleteName: row.athleteName } }));
    const total = Number(totalRow?.total ?? 0);
    return reply.send({ data, pagination: { page, pageSize, total, totalPages: total === 0 ? 0 : Math.ceil(total / pageSize) } });
  });

  fastify.patch("/registrations/:registrationId", async (request, reply) => {
    const paramsResult = registrationIdParamsSchema.safeParse(request.params);
    const bodyResult = updateRegistrationBodySchema.safeParse(request.body);
    if (!paramsResult.success || !bodyResult.success) return reply.status(400).send({ error: "Dados inválidos.", code: "INVALID_REGISTRATION_UPDATE", details: { params: paramsResult.success ? undefined : paramsResult.error.flatten(), body: bodyResult.success ? undefined : bodyResult.error.flatten() } });
    const [current] = await db.select({ registration: tournamentRegistrations, category: tournamentCategories, tournament: tournaments }).from(tournamentRegistrations).innerJoin(tournamentCategories, eq(tournamentRegistrations.categoryId, tournamentCategories.id)).innerJoin(tournaments, eq(tournamentCategories.tournamentId, tournaments.id)).where(eq(tournamentRegistrations.id, paramsResult.data.registrationId));
    if (!current) return reply.status(404).send({ error: "Inscrição não encontrada.", code: "REGISTRATION_NOT_FOUND" });
    if (!canEditRegistration(current.tournament.status)) return reply.status(409).send({ error: "O torneio não permite mais alterações.", code: "TOURNAMENT_LOCKED" });
    const body = bodyResult.data;
    const currentStatus = getRegistrationStatus(current.registration);
    const nextStatus = body.status ?? currentStatus;
    const transitionError = validateRegistrationStatusChange(currentStatus, nextStatus, body.notes);
    if (transitionError) return reply.status(422).send({ error: transitionError, code: "INVALID_REGISTRATION_TRANSITION" });
    if (body.categoryId && body.categoryId !== current.registration.categoryId) {
      const [targetCategory] = await db.select().from(tournamentCategories).where(and(eq(tournamentCategories.id, body.categoryId), eq(tournamentCategories.tournamentId, current.category.tournamentId)));
      if (!targetCategory) return reply.status(422).send({ error: "A categoria informada não pertence ao torneio.", code: "INVALID_REGISTRATION_CATEGORY" });
    }
    const update: { categoryId?: string; confirmed?: boolean; withdrew?: boolean; updatedAt: Date } = { updatedAt: new Date() };
    if (body.categoryId) update.categoryId = body.categoryId;
    if (body.status) { update.confirmed = body.status === "approved"; update.withdrew = body.status === "rejected"; }
    const [updated] = await db.update(tournamentRegistrations).set(update).where(eq(tournamentRegistrations.id, current.registration.id)).returning();
    return reply.send({ ...updated, status: getRegistrationStatus(updated), notes: body.notes ?? null });
  });

  fastify.post("/registrations/:registrationId/approve", async (request, reply) => {
    const paramsResult = registrationIdParamsSchema.safeParse(request.params);
    const bodyResult = approveRegistrationBodySchema.safeParse(request.body ?? {});
    if (!paramsResult.success || !bodyResult.success) return reply.status(400).send({ error: "Dados inválidos.", code: "INVALID_REGISTRATION_APPROVAL", details: { params: paramsResult.success ? undefined : paramsResult.error.flatten(), body: bodyResult.success ? undefined : bodyResult.error.flatten() } });
    const [current] = await db.select({ registration: tournamentRegistrations, category: tournamentCategories, tournament: tournaments }).from(tournamentRegistrations).innerJoin(tournamentCategories, eq(tournamentRegistrations.categoryId, tournamentCategories.id)).innerJoin(tournaments, eq(tournamentCategories.tournamentId, tournaments.id)).where(eq(tournamentRegistrations.id, paramsResult.data.registrationId));
    if (!current) return reply.status(404).send({ error: "Inscrição não encontrada.", code: "REGISTRATION_NOT_FOUND" });
    if (!canEditRegistration(current.tournament.status)) return reply.status(409).send({ error: "O torneio não permite mais alterações.", code: "TOURNAMENT_LOCKED" });
    const currentStatus = getRegistrationStatus(current.registration);
    if (currentStatus === "approved") return reply.send({ ...current.registration, status: "approved", notes: bodyResult.data.notes ?? null });
    const transitionError = validateRegistrationStatusChange(currentStatus, "approved", bodyResult.data.notes);
    if (transitionError) return reply.status(422).send({ error: transitionError, code: "INVALID_REGISTRATION_TRANSITION" });
    const [updated] = await db.update(tournamentRegistrations).set({ confirmed: true, withdrew: false, updatedAt: new Date() }).where(eq(tournamentRegistrations.id, current.registration.id)).returning();
    return reply.send({ ...updated, status: "approved", notes: bodyResult.data.notes ?? null });
  });
};

export default registrationsRoute;
