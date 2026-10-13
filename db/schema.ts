import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const runs = sqliteTable("runs", {
  id: text("id").primaryKey(),
  playerId: text("player_id").notNull(),
  name: text("name").notNull(),
  startedAt: integer("started_at").notNull(),
  finished: integer("finished").notNull().default(0),
});

export const scores = sqliteTable("scores", {
  playerId: text("player_id").primaryKey(),
  name: text("name").notNull(),
  score: integer("score").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
