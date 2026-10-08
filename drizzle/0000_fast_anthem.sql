CREATE TABLE `libraries` (
	`user_id` text PRIMARY KEY NOT NULL,
	`saved_json` text DEFAULT '[]' NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `playlists` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`title` text NOT NULL,
	`album_ids` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_playlists_owner_created` ON `playlists` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `votes` (
	`user_id` text PRIMARY KEY NOT NULL,
	`album_id` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_votes_album` ON `votes` (`album_id`);