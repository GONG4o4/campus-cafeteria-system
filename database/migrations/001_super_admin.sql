-- Migration 001: Super Admin role, account status, audit logs, system settings
--
-- Safe to run more than once. It does not delete or change existing accounts.
-- Run it after database/schema.sql:
--   psql -U postgres -d campus_cafeteria -f database/migrations/001_super_admin.sql

BEGIN;

-- 1. Allow the new super_admin role.
-- The old values are kept so existing rows are not affected.
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS role_check;

ALTER TABLE public.users
    ADD CONSTRAINT role_check CHECK (
        (role)::text = ANY (ARRAY[
            'admin'::character varying,
            'student'::character varying,
            'staff'::character varying,
            'cafeteria_staff'::character varying,
            'super_admin'::character varying
        ]::text[])
    ) NOT VALID;

-- 2. Accounts can be activated / deactivated. Existing accounts stay active.
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true NOT NULL;

-- 3. Audit log for sensitive administrative actions.
CREATE TABLE IF NOT EXISTS public.audit_logs (
    audit_log_id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_user_id integer REFERENCES public.users(user_id) ON DELETE RESTRICT,
    action character varying(50) NOT NULL,
    target_type character varying(30) NOT NULL,
    target_id integer,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx
    ON public.audit_logs (created_at DESC);

-- 4. Approved system settings (only settings the backend actually uses).
CREATE TABLE IF NOT EXISTS public.system_settings (
    setting_key character varying(50) PRIMARY KEY,
    setting_value boolean NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_by integer REFERENCES public.users(user_id) ON DELETE RESTRICT
);

INSERT INTO public.system_settings (setting_key, setting_value)
VALUES ('allow_registration', true)
ON CONFLICT (setting_key) DO NOTHING;

COMMIT;
