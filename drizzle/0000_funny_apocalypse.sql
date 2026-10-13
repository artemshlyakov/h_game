CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`name` text NOT NULL,
	`started_at` integer NOT NULL,
	`finished` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scores` (
	`player_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`score` integer NOT NULL,
	`updated_at` integer NOT NULL
);
