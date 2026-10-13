import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Некорректный запрос" }, { status: 400 }); }
  const data = body as Record<string, unknown>;
  const runId = typeof data.runId === "string" ? data.runId : "";
  const score = data.score;
  if (!/^[a-f0-9-]{36}$/i.test(runId) || !Number.isInteger(score) || (score as number) < 0 || (score as number) > 5000) {
    return Response.json({ error: "Некорректный результат" }, { status: 400 });
  }
  const row = await env.DB.prepare("SELECT player_id AS playerId, name, started_at AS startedAt, finished FROM runs WHERE id = ?")
    .bind(runId).first<{ playerId: string; name: string; startedAt: number; finished: number }>();
  if (!row || row.finished) return Response.json({ error: "Раунд не найден или уже завершён" }, { status: 409 });
  const elapsed = Date.now() - row.startedAt;
  if (elapsed < 3000 || elapsed > 10 * 60_000 || (score as number) > Math.ceil(elapsed / 1000) * 100) {
    return Response.json({ error: "Результат не прошёл проверку" }, { status: 400 });
  }
  const used = await env.DB.prepare("UPDATE runs SET finished = 1 WHERE id = ? AND finished = 0")
    .bind(runId).run();
  if (!used.meta.changes) return Response.json({ error: "Раунд уже завершён" }, { status: 409 });
  await env.DB.prepare(`INSERT INTO scores (player_id, name, score, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(player_id) DO UPDATE SET name = excluded.name,
    score = CASE WHEN excluded.score > scores.score THEN excluded.score ELSE scores.score END,
    updated_at = CASE WHEN excluded.score > scores.score THEN excluded.updated_at ELSE scores.updated_at END`)
    .bind(row.playerId, row.name, score, Date.now()).run();
  const rank = await env.DB.prepare("SELECT 1 + COUNT(*) AS rank FROM scores WHERE score > (SELECT score FROM scores WHERE player_id = ?)")
    .bind(row.playerId).first<{ rank: number }>();
  return Response.json({ saved: true, rank: rank?.rank ?? null });
}
