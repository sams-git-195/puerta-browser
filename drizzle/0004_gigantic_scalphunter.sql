CREATE TABLE `bookmarks` (
	`unique_id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`parent_id` text,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`url` text,
	`favicon_url` text,
	`position` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `bookmarks`(`unique_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_bookmarks_profile_id` ON `bookmarks` (`profile_id`);--> statement-breakpoint
CREATE INDEX `idx_bookmarks_parent_id` ON `bookmarks` (`parent_id`);