import type { FastifyPluginAsync } from "fastify";
import { and, asc, count, eq } from "drizzle-orm";
import {
  tournamentRegistrationsParamsSchema,
  tournamentRegistrationsQuerySchema,
} from "@birdieatlas/validators/registration";
import { db } from "../db/index.js";
import { athletes, tournamentCategories, tournamentRegistrations } from "../db/schema.js";

const registrationsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get("/registrations/tournament/:tournamentId", async (request, reply) => {
    const paramsResult = tournamentRegistrationsParamsSchema.safeParse(request.params);
    const queryResult = tournamentRegistrationsQuerySchema.safeParse(request.query);

    if (!paramsResult.success || !queryResult.success) {
      return reply.status(400).send({
        error: "Parâmetros inválidos.",
        code: "INVALID_REGISTRATION_QUERY",
        details: {
          params: paramsResult.success ? undefined : paramsResult.error.flatten(),
          query: queryResult.success ? undefined : queryResult.error.flatten(),
        },
      });
    }

    const { page, pageSize, status } = queryResult.data;
    const tournamentId = paramsResult.data.tournamentId;
    const offset = (page - 1) * pageSize;
    const statusCondition = status === "approved"
      ? eq(tournamentRegistrations.confirmed, true)
      : status === "rejected"
        ? eq(tournamentRegistrations.withdrew, true)
        : status === "pending"
          ? and(eq(tournamentRegistrations.confirmed, false), eq(tournamentRegistrations.withdrew, false))
          : undefined;
    const whereCondition = statusCondition
      ? and(eq(tournamentCategories.tournamentId, tournamentId), statusCondition)
      : eq(tournamentCategories.tournamentId, tournamentId);

    const [totalRow] = await db
      .select({ total: count() })
      .from(tournamentRegistrations)
      .innerJoin(tournamentCategories, eq(tournamentRegistrations.categoryId, tournamentCategories.id))
      .where(whereCondition);

    const rows = await db
      .select({
        id: tournamentRegistrations.id,
        tournamentId: tournamentCategories.tournamentId,
        athleteId: tournamentRegistrations.athleteId,
        athlete2Id: tournamentRegistrations.athlete2Id,
        categoryId: tournamentRegistrations.categoryId,
        confirmed: tournamentRegistrations.confirmed,
        withdrew: tournamentRegistrations.withdrew,
        athleteName: athletes.name,
        createdAt: tournamentRegistrations.createdAt,
        updatedAt: tournamentRegistrations.updatedAt,
      })
      .from(tournamentRegistrations)
      .innerJoin(tournamentCategories, eq(tournamentRegistrations.categoryId, tournamentCategories.id))
      .innerJoin(athletes, eq(tournamentRegistrations.athleteId, athletes.id))
      .where(whereCondition)
      .orderBy(asc(tournamentRegistrations.createdAt))
      .limit(pageSize)
      .offset(offset);

    const data = rows.map((row) => ({
      id: row.id,
      tournamentId: row.tournamentId,
      athleteId: row.athleteId,
      pairId: row.athlete2Id,
      categoryId: row.categoryId,
      status: row.withdrew ? "rejected" : row.confirmed ? "approved" : "pending",
      notes: null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      display: {
        athleteName: row.athleteName,
      },
    }));

    const total = Number(totalRow?.total ?? 0);
    return reply.send({
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
      },
    });
  });
};

export default registrationsRoute;
