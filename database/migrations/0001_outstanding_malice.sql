CREATE TABLE "dataset_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	"version" varchar(50) NOT NULL,
	"description" text,
	"imported_at" timestamp DEFAULT now() NOT NULL,
	"row_count" integer DEFAULT 0
);
