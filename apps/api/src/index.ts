import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "./env.js";
import affiliationsRoutes from "./routes/affiliations.js";
import athletesRoutes from "./routes/athletes.js";
import clubsRoutes from "./routes/clubs.js";
import dashboardRoutes from "./routes/dashboard.js";
import drawsRoutes from "./routes/draws.js";
import importAthletesRoutes from "./routes/import-athletes.js";
import pairsRoutes from "./routes/pairs.js";
import pointRulesRoutes from "./routes/point-rules.js";
import pointsTablesRoutes from "./routes/points-tables.js";
import rankingsRoutes from "./routes/rankings.js";
import registrationsRoutes from "./routes/registrations.js";
import tenantsRoutes from "./routes/tenants.js";
import tournamentsRoutes from "./routes/tournaments.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(affiliationsRoutes);
await app.register(athletesRoutes);
await app.register(clubsRoutes);
await app.register(dashboardRoutes);
await app.register(drawsRoutes);
await app.register(importAthletesRoutes);
await app.register(pairsRoutes);
await app.register(pointRulesRoutes);
await app.register(pointsTablesRoutes);
await app.register(rankingsRoutes);
await app.register(registrationsRoutes);
await app.register(tenantsRoutes);
await app.register(tournamentsRoutes);

await app.listen({ port: env.PORT, host: "0.0.0.0" });
