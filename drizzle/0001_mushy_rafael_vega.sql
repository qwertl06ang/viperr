CREATE TABLE `bridge_codes` (
	`code_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`state_hash` text NOT NULL,
	`challenge` text NOT NULL,
	`audience` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_bridge_codes_user` ON `bridge_codes` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_bridge_codes_expiry` ON `bridge_codes` (`expires_at`);--> statement-breakpoint
CREATE TABLE `bridge_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_bridge_sessions_user` ON `bridge_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_bridge_sessions_expiry` ON `bridge_sessions` (`expires_at`);