import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Некорректный запрос" }, { status: 400 }); }
  const data = body as Record<string, unknown>;
  const name = typeof data.name === "string" ? data.name.trim().replace(/\s+/g, " ") : "";
  const playerId = typeof data.playerId === "string" ? data.playerId : "";
  if (name.length < 2 || name.length > 40 || !/^[\p{L}\p{M}0-9 ._'-]+$/u.test(name) || !/^[a-f0-9-]{36}$/i.test(playerId)) {
    return Response.json({ error: "Укажите имя от 2 до 40 символов" }, { status: 400 });
  }
  const runId = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO runs (id, player_id, name, started_at, finished) VALUES (?, ?, ?, ?, 0)")
    .bind(runId, playerId, name, Date.now()).run();
  return Response.json({ runId, duration: 60 });
}
