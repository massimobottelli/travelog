-- Phase 4: Geographic data + geocoding
-- Adds dataset_versions table and spatial index for reverse geocoding

CREATE TABLE "dataset_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	"version" varchar(50) NOT NULL,
	"description" text,
	"imported_at" timestamp DEFAULT now() NOT NULL,
	"row_count" integer DEFAULT 0
);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_dataset_versions_name_unique" ON "dataset_versions" USING btree ("name");--> statement-breakpoint
ALTER TABLE "administrative_areas" ADD COLUMN "geom" geometry(Polygon, 4326);--> statement-breakpoint
CREATE INDEX "idx_admin_areas_geom_spatial" ON "administrative_areas" USING gist ("geom");--> statement-breakpoint
