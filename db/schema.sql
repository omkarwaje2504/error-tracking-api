-- Postgres schema for the task tracker + error tracker (replaces MongoDB).
--
-- Conventions, chosen so API responses keep exactly the shape the pages
-- already expect from the Mongo days:
--   * Every table's key is "_id": a 24-char hex string, same format as a
--     Mongo ObjectId — so old ids (links, imported data) stay valid.
--   * Column names match the old document field names (quoted camelCase).
--   * References are plain text ids with no foreign keys, mirroring Mongo's
--     $lookup semantics: a dangling reference just joins to nothing.
--   * Nested/array data (attachments, project sections, logs) is JSONB.
--   * Soft delete via "deleted" (NOT NULL, default false).
--
-- Idempotent: safe to run again (scripts/db-setup.mjs).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION new_id() RETURNS text
LANGUAGE sql VOLATILE AS $$ SELECT encode(gen_random_bytes(12), 'hex') $$;

CREATE TABLE IF NOT EXISTS users (
    "_id"        text PRIMARY KEY DEFAULT new_id(),
    "name"       text,
    "email"      text,
    "mobile"     text,
    "password"   text,
    "role"       text,
    "team"       text,
    "deleted"    boolean NOT NULL DEFAULT false,
    "createdAt"  timestamptz NOT NULL DEFAULT now(),
    "updatedAt"  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS users_email_idx ON users (lower("email"));
CREATE INDEX IF NOT EXISTS users_team_idx ON users ("team");

CREATE TABLE IF NOT EXISTS companies (
    "_id"        text PRIMARY KEY DEFAULT new_id(),
    "name"       text,
    "deleted"    boolean NOT NULL DEFAULT false,
    "createdAt"  timestamptz NOT NULL DEFAULT now(),
    "updatedAt"  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS brands (
    "_id"        text PRIMARY KEY DEFAULT new_id(),
    "name"       text,
    "company"    text,
    "deleted"    boolean NOT NULL DEFAULT false,
    "createdAt"  timestamptz NOT NULL DEFAULT now(),
    "updatedAt"  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS brands_company_idx ON brands ("company");

CREATE TABLE IF NOT EXISTS product_types (
    "_id"        text PRIMARY KEY DEFAULT new_id(),
    "name"       text,
    "createdBy"  text,
    "deleted"    boolean NOT NULL DEFAULT false,
    "createdAt"  timestamptz NOT NULL DEFAULT now(),
    "updatedAt"  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS printers (
    "_id"         text PRIMARY KEY DEFAULT new_id(),
    "name"        text,
    "email_id"    text,
    "printerType" text,
    "pageColor"   text,
    "fileType"    text,
    "fileSize"    text,
    "pageType"    text,
    "createdBy"   text,
    "deleted"     boolean NOT NULL DEFAULT false,
    "createdAt"   timestamptz NOT NULL DEFAULT now(),
    "updatedAt"   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
    "_id"           text PRIMARY KEY DEFAULT new_id(),
    "name"          text,
    "description"   text,
    "brand"         text,
    "company"       text,
    "client"        text,
    "salesPerson"   text,
    "servicePerson" text,
    "projectType"   text,
    "deadline"      text,          -- YYYY-MM-DD as typed in the form
    "link"          text,
    "status"        text,
    "currentStage"  text,
    "pinned"        boolean NOT NULL DEFAULT false,
    "attachments"   jsonb NOT NULL DEFAULT '[]',
    "sections"      jsonb NOT NULL DEFAULT '[]',
    "kickoff"       jsonb,         -- legacy, migrated into sections on read
    "createdBy"     text,
    "deleted"       boolean NOT NULL DEFAULT false,
    "createdAt"     timestamptz NOT NULL DEFAULT now(),
    "updatedAt"     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS projects_brand_idx ON projects ("brand");
CREATE INDEX IF NOT EXISTS projects_company_idx ON projects ("company");
CREATE INDEX IF NOT EXISTS projects_list_idx ON projects ("pinned" DESC, "createdAt" DESC) WHERE NOT "deleted";

CREATE TABLE IF NOT EXISTS tasks (
    "_id"           text PRIMARY KEY DEFAULT new_id(),
    "title"         text,
    "description"   text,
    "project"       text,
    "assignedTo"    text[] NOT NULL DEFAULT '{}',
    "createdBy"     text,
    "status"        text NOT NULL DEFAULT 'pending',
    "completedAt"   timestamptz,
    "revertNote"    jsonb,
    "trackProgress" boolean NOT NULL DEFAULT false,
    "unit"          text,
    "target"        double precision,
    "trackJ2K"      boolean NOT NULL DEFAULT false,
    "parentTask"    text,
    "kind"          text,          -- 'bug' on bug children, else null
    "department"    text,
    "priority"      text,
    "dueDate"       text,
    "stageType"     text,
    "stageId"       text,
    "attachments"   jsonb NOT NULL DEFAULT '[]',
    "pinned"        boolean NOT NULL DEFAULT false,
    "isEvideo"      boolean NOT NULL DEFAULT false,
    "evideoRows"    jsonb NOT NULL DEFAULT '[]',
    "deleted"       boolean NOT NULL DEFAULT false,
    "createdAt"     timestamptz NOT NULL DEFAULT now(),
    "updatedAt"     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tasks_project_idx ON tasks ("project");
CREATE INDEX IF NOT EXISTS tasks_parent_idx ON tasks ("parentTask");
CREATE INDEX IF NOT EXISTS tasks_assigned_idx ON tasks USING gin ("assignedTo");
CREATE INDEX IF NOT EXISTS tasks_created_idx ON tasks ("createdAt" DESC);

CREATE TABLE IF NOT EXISTS progress (
    "_id"        text PRIMARY KEY DEFAULT new_id(),
    "task"       text,
    "date"       text,             -- YYYY-MM-DD
    "added"      integer NOT NULL DEFAULT 0,
    "completed"  integer NOT NULL DEFAULT 0,
    "declined"   integer NOT NULL DEFAULT 0,
    "j2k"        integer NOT NULL DEFAULT 0,
    "note"       text,
    "user"       text,
    "deleted"    boolean NOT NULL DEFAULT false,
    "createdAt"  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS progress_task_idx ON progress ("task");
CREATE INDEX IF NOT EXISTS progress_user_date_idx ON progress ("user", "date");

CREATE TABLE IF NOT EXISTS discussions (
    "_id"         text PRIMARY KEY DEFAULT new_id(),
    "project"     text,
    "user"        text,
    "message"     text,
    "attachments" jsonb NOT NULL DEFAULT '[]',
    "deleted"     boolean NOT NULL DEFAULT false,
    "createdAt"   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS discussions_project_idx ON discussions ("project", "createdAt");

CREATE TABLE IF NOT EXISTS credentials (
    "_id"                text PRIMARY KEY DEFAULT new_id(),
    "service"            text,
    "name"               text,
    "username"           text,
    "notes"              text,
    "encryptedPassword"  jsonb,         -- { iv, authTag, data } from lib/crypto encrypt()
    "billingStatus"      text,
    "billingAmount"      text,
    "nextPaymentDate"    text,
    "cardLast4"          text,
    "createdBy"          text,
    "createdByName"      text,
    "lastAccessedBy"     text,
    "lastAccessedByName" text,
    "lastAccessedAt"     timestamptz,
    "accessLog"          jsonb NOT NULL DEFAULT '[]',
    "deleted"            boolean NOT NULL DEFAULT false,
    "createdAt"          timestamptz NOT NULL DEFAULT now(),
    "updatedAt"          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS posts (
    "_id"           text PRIMARY KEY DEFAULT new_id(),
    "title"         text,
    "postDate"      text,          -- YYYY-MM-DD, local day
    "caption"       text,
    "status"        text NOT NULL DEFAULT 'pending',
    "attachments"   jsonb NOT NULL DEFAULT '[]',
    "postedAt"      timestamptz,
    "postedByName"  text,
    "createdBy"     text,
    "createdByName" text,
    "deleted"       boolean NOT NULL DEFAULT false,
    "createdAt"     timestamptz NOT NULL DEFAULT now(),
    "updatedAt"     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS posts_date_idx ON posts ("postDate" DESC, "createdAt" DESC) WHERE NOT "deleted";

CREATE TABLE IF NOT EXISTS settings (
    "key"        text PRIMARY KEY,
    "value"      jsonb,
    "updatedBy"  text,
    "updatedAt"  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activity (
    "_id"        text PRIMARY KEY DEFAULT new_id(),
    "type"       text,
    "message"    text,
    "project"    text,
    "task"       text,
    "user"       text,
    "createdAt"  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS activity_created_idx ON activity ("createdAt" DESC);

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
