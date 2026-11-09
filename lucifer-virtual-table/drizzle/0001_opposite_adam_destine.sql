CREATE TABLE `profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`color` text DEFAULT '#ad6142' NOT NULL,
	`reduced` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
