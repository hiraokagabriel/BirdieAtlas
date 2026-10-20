-- Converte as tabelas de pontos legadas em regras genéricas (point_rules) antes de apagá-las.
-- Uma regra pertence a um ranking; cada ranking do tenant ganha, para cada nível que a tabela cobre e
-- que ele ainda não tenha regra, uma regra genérica (todas as disciplinas, multiplicador 1, sem bônus).
-- Casos que não têm conversão fiel abortam a migração em vez de serem adivinhados.
DO $$
DECLARE
  bad integer;
  conflicts integer;
BEGIN
  SELECT count(*) INTO bad FROM points_tables
   WHERE tournament_level NOT IN ('local', 'regional', 'state', 'national', 'international');
  IF bad > 0 THEN
    RAISE EXCEPTION 'Migração abortada: % linha(s) de points_tables com nível fora do enum tournament_level. Corrija ou apague antes de migrar.', bad;
  END IF;

  SELECT count(*) INTO conflicts FROM (
    SELECT tenant_id, tournament_level FROM points_tables
     GROUP BY tenant_id, tournament_level HAVING count(DISTINCT name) > 1
  ) c;
  IF conflicts > 0 THEN
    RAISE EXCEPTION 'Migração abortada: % par(es) tenant/nível com mais de uma tabela de pontos. Uma regra por nível e ranking não representa tabelas diferentes por torneio; escolha qual manter antes de migrar.', conflicts;
  END IF;
END $$;--> statement-breakpoint
INSERT INTO point_rules (id, ranking_id, tournament_level, discipline, category, multiplier, participation_bonus, entries, created_at, updated_at)
SELECT gen_random_uuid()::text, r.id, g.level::tournament_level, NULL, NULL, 1, 0, g.entries, now(), now()
FROM rankings r
JOIN (
  SELECT tenant_id, tournament_level AS level,
         jsonb_agg(jsonb_build_object('placement', placement, 'basePoints', points) ORDER BY placement) AS entries
  FROM points_tables
  GROUP BY tenant_id, tournament_level
) g ON g.tenant_id = r.tenant_id
WHERE r.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM point_rules pr
     WHERE pr.ranking_id = r.id AND pr.deleted_at IS NULL AND pr.tournament_level = g.level::tournament_level
  );--> statement-breakpoint
DO $$
DECLARE
  lost integer;
BEGIN
  SELECT count(*) INTO lost FROM (
    SELECT DISTINCT p.tenant_id, p.tournament_level FROM points_tables p
     WHERE NOT EXISTS (SELECT 1 FROM rankings r WHERE r.tenant_id = p.tenant_id AND r.deleted_at IS NULL)
  ) x;
  IF lost > 0 THEN
    RAISE NOTICE '% nível(is) de pontos de tenants sem ranking não foram convertidos (uma regra pertence a um ranking).', lost;
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "tournaments" DROP CONSTRAINT "tournaments_points_table_id_points_tables_id_fk";--> statement-breakpoint
ALTER TABLE "tournaments" DROP COLUMN "points_table_id";--> statement-breakpoint
DROP TABLE "points_tables";
