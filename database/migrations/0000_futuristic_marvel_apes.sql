CREATE EXTENSION IF NOT EXISTS postgis;
CREATE TYPE "public"."metadata_status" AS ENUM('valid', 'excluded');--> statement-breakpoint
CREATE TYPE "public"."scan_status" AS ENUM('pending', 'running', 'completed', 'completed_with_errors', 'failed');--> statement-breakpoint
CREATE TYPE "public"."trip_operation" AS ENUM('split', 'merge', 'rename', 'date_change');--> statement-breakpoint
CREATE TYPE "public"."trip_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TABLE "administrative_areas" (
	"id" serial PRIMARY KEY NOT NULL,
	"dataset_source" varchar(50) NOT NULL,
	"country_code" varchar(5) NOT NULL,
	"admin_level" integer NOT NULL,
	"name" text NOT NULL,
	"parent_id" integer,
	"geometry" text,
	"geo_version" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
ALTER TABLE "administrative_areas" ADD CONSTRAINT "administrative_areas_parent_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."administrative_areas"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE "exclusion_zones" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_area_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "geocoding_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"normalized_latitude" double precision NOT NULL,
	"normalized_longitude" double precision NOT NULL,
	"admin_area_id" integer,
	"country_code" varchar(5),
	"admin_level" integer,
	"name" text,
	"geo_version" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "geocoding_cache_normalized_latitude_normalized_longitude_unique" UNIQUE("normalized_latitude","normalized_longitude")
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"file_path" text NOT NULL,
	"file_name" text NOT NULL,
	"file_type" varchar(10) NOT NULL,
	"size" bigint NOT NULL,
	"mtime" bigint NOT NULL,
	"date_time_original" timestamp NOT NULL,
	"original_latitude" double precision,
	"original_longitude" double precision,
	"metadata_status" "metadata_status" DEFAULT 'valid' NOT NULL,
	"exclusion_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "photos_file_path_size_mtime_unique" UNIQUE("file_path","size","mtime")
);
--> statement-breakpoint
CREATE TABLE "presences" (
	"id" serial PRIMARY KEY NOT NULL,
	"photo_date" date NOT NULL,
	"admin_area_id" integer,
	"photo_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "presences_photo_date_admin_area_id_unique" UNIQUE("photo_date","admin_area_id")
);
--> statement-breakpoint
CREATE TABLE "scan_errors" (
	"id" serial PRIMARY KEY NOT NULL,
	"scan_id" integer,
	"file_path" text NOT NULL,
	"error_code" varchar(50) NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scans" (
	"id" serial PRIMARY KEY NOT NULL,
	"folder" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"status" "scan_status" NOT NULL,
	"files_analyzed" integer DEFAULT 0,
	"new_photos" integer DEFAULT 0,
	"existing_photos" integer DEFAULT 0,
	"excluded_photos" integer DEFAULT 0,
	"errors" integer DEFAULT 0,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"min_photo_count_per_visit" integer DEFAULT 1 NOT NULL,
	"days_without_photos_threshold" integer DEFAULT 3 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"trip_id" integer,
	"operation" "trip_operation" NOT NULL,
	"original_trip_ids" jsonb NOT NULL,
	"result_trip_ids" jsonb NOT NULL,
	"performed_at" timestamp DEFAULT now() NOT NULL,
	"details" jsonb
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"auto_generated" boolean DEFAULT true,
	"status" "trip_status" DEFAULT 'active',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exclusion_zones" ADD CONSTRAINT "exclusion_zones_admin_area_id_administrative_areas_id_fk" FOREIGN KEY ("admin_area_id") REFERENCES "public"."administrative_areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geocoding_cache" ADD CONSTRAINT "geocoding_cache_admin_area_id_administrative_areas_id_fk" FOREIGN KEY ("admin_area_id") REFERENCES "public"."administrative_areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presences" ADD CONSTRAINT "presences_admin_area_id_administrative_areas_id_fk" FOREIGN KEY ("admin_area_id") REFERENCES "public"."administrative_areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_errors" ADD CONSTRAINT "scan_errors_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_history" ADD CONSTRAINT "trip_history_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_administrative_areas_country_level" ON "administrative_areas" USING btree ("country_code","admin_level");--> statement-breakpoint
CREATE INDEX "idx_admin_areas_parent_id" ON "administrative_areas" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_photos_date_time_original" ON "photos" USING btree ("date_time_original");--> statement-breakpoint
CREATE INDEX "idx_scan_errors_scan_id" ON "scan_errors" USING btree ("scan_id");--> statement-breakpoint
CREATE INDEX "idx_scans_started_at" ON "scans" USING btree ("started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_trip_history_trip_id" ON "trip_history" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "idx_trips_start_date" ON "trips" USING btree ("start_date" DESC NULLS LAST);