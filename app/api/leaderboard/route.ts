import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await env.DB.prepare(
    "SELECT name, score, updated_at AS updatedAt FROM scores ORDER BY score DESC, updated_at ASC LIMIT 20",
  ).all();
  return Response.json({ leaders: rows.results }, { headers: { "Cache-Control": "no-store" } });
}
