-- Postgres schema for the error tracker (replaces MongoDB).
--
-- Conventions, chosen so API responses keep exactly the shape the pages
-- already expect from the Mongo days:
--   * Every table's key is "_id": a 24-char hex string, same format as a
--     Mongo ObjectId — so old ids (links, imported data) stay valid.
--   * Column names match the old document field names (quoted camelCase).
--   * Nested data is JSONB.
--
-- Idempotent: safe to run again (scripts/db-setup.mjs).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION new_id() RETURNS text
LANGUAGE sql VOLATILE AS $$ SELECT encode(gen_random_bytes(12), 'hex') $$;

-- Error tracker (was Mongo db "errors", collection "pixpro").
CREATE TABLE IF NOT EXISTS error_logs (
    "_id"          text PRIMARY KEY DEFAULT new_id(),
    "projectId"    text,
    "error"        jsonb,          -- { message, name, stack }
    "mappedStack"  jsonb NOT NULL DEFAULT '[]',
    "deviceInfo"   jsonb,
    "locationInfo" jsonb,
    "geo"          jsonb NOT NULL DEFAULT '{}',
    "city"         text,
    "state"        text,
    "country"      text,
    "screenshot"   text,
    "timestamp"    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS error_logs_ts_idx ON error_logs ("timestamp" DESC);
CREATE INDEX IF NOT EXISTS error_logs_project_idx ON error_logs ("projectId", "timestamp" DESC);

-- Gender-detection API call log (was Mongo db "apicalls", collection "analysis").
CREATE TABLE IF NOT EXISTS api_calls (
    "_id"           text PRIMARY KEY DEFAULT new_id(),
    "user_platform" text,
    "user_url"      text,
    "type"          text,
    "timestamp"     timestamptz NOT NULL DEFAULT now()
);
