-- Migration 004: Save the customer's no-show policy acknowledgment on each order
--
-- Adds:
--   1. no_show_policy.policy_version - increase it whenever the policy
--      values or wording change, so we know which version a customer accepted.
--   2. orders.no_show_ack_at - server time when the customer acknowledged
--      the policy (set by the backend, never sent by the browser).
--   3. orders.no_show_policy_version - the policy version they acknowledged.
--
-- Existing orders keep NULL in the new order columns (they were placed
-- before the acknowledgment existed). Safe to run more than once.
-- Run it after migration 003:
--   psql -U postgres -d campus_cafeteria -f database/migrations/004_no_show_acknowledgment.sql

BEGIN;

ALTER TABLE public.no_show_policy
    ADD COLUMN IF NOT EXISTS policy_version integer DEFAULT 1 NOT NULL;

ALTER TABLE public.no_show_policy
    DROP CONSTRAINT IF EXISTS no_show_policy_version_check;

ALTER TABLE public.no_show_policy
    ADD CONSTRAINT no_show_policy_version_check CHECK (policy_version > 0);

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS no_show_ack_at timestamp without time zone;

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS no_show_policy_version integer;

COMMIT;
