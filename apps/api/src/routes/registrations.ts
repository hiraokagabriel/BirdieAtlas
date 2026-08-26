import type { FastifyPluginAsync } from "fastify";
import {
  registrationStatusSchema,
  tournamentRegistrationsParamsSchema,
  tournamentRegistrationsQuerySchema,
} from "@birdieatlas/validators/registration";

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

    // TODO: substituir pelo select Drizzle após confirmar os nomes do schema.
    const data: unknown[] = [];
    const filteredData = status ? data.filter((item) => {
      if (!item || typeof item !== "object" || !("status" in item)) return false;
      return registrationStatusSchema.safeParse(item.status).success && item.status === status;
    }) : data;
    const total = filteredData.length;

    return reply.send({
      data: filteredData,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
      },
      meta: { tournamentId },
    });
  });
};

export default registrationsRoute;
