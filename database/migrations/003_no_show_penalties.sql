-- Migration 003: No-show tracking and customer ordering restrictions
--
-- Adds:
--   1. A 'no_show' order status.
--   2. orders.ready_at (when the order became ready for pickup).
--   3. no_show_policy  - one row with the configurable policy values.
--   4. no_show_records - one row per order that was not collected.
--   5. customer_restrictions - temporary ordering restrictions.
--
-- Existing rows are not deleted or changed (except ready_at is filled in
-- for orders that are already 'ready'). Safe to run more than once.
-- Run it after database/schema.sql and migrations 001 and 002:
--   psql -U postgres -d campus_cafeteria -f database/migrations/003_no_show_penalties.sql

BEGIN;

-- 1. Allow the new 'no_show' status. Old values are kept.
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
    ADD CONSTRAINT orders_status_check CHECK (
        (status)::text = ANY (ARRAY[
            'pending'::character varying,
            'preparing'::character varying,
            'ready'::character varying,
            'picked_up'::character varying,
            'cancelled'::character varying,
            'no_show'::character varying
        ]::text[])
    );

-- 2. Remember when an order became ready. The pickup deadline starts here.
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS ready_at timestamp without time zone;

-- Orders that are already ready: their last update was the move to 'ready'.
UPDATE public.orders
SET ready_at = updated_at
WHERE status = 'ready'
  AND ready_at IS NULL;

-- 3. Policy values. Only one row is allowed (policy_id = 1).
-- IMPORTANT: these defaults are placeholders. The project owner must approve
-- the real values. Change them with an UPDATE, no code change needed.
CREATE TABLE IF NOT EXISTS public.no_show_policy (
    policy_id integer DEFAULT 1 PRIMARY KEY CHECK (policy_id = 1),
    pickup_window_minutes integer NOT NULL CHECK (pickup_window_minutes > 0),
    grace_period_minutes integer NOT NULL CHECK (grace_period_minutes >= 0),
    offense_threshold integer NOT NULL CHECK (offense_threshold > 0),
    offense_window_days integer NOT NULL CHECK (offense_window_days > 0),
    restriction_days integer NOT NULL CHECK (restriction_days > 0),
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_by integer REFERENCES public.users(user_id) ON DELETE RESTRICT
);

INSERT INTO public.no_show_policy (
    policy_id,
    pickup_window_minutes,
    grace_period_minutes,
    offense_threshold,
    offense_window_days,
    restriction_days
)
VALUES (1, 30, 15, 3, 30, 7)
ON CONFLICT (policy_id) DO NOTHING;

-- 4. No-show history. UNIQUE (order_id) means one order can only ever
-- create one no-show record (and so at most one penalty).
CREATE TABLE IF NOT EXISTS public.no_show_records (
    no_show_id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id integer NOT NULL UNIQUE REFERENCES public.orders(order_id) ON DELETE RESTRICT,
    user_id integer NOT NULL REFERENCES public.users(user_id) ON DELETE RESTRICT,
    recorded_by integer NOT NULL REFERENCES public.users(user_id) ON DELETE RESTRICT,
    recorded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    offense_count integer NOT NULL CHECK (offense_count > 0),
    policy_result character varying(20) NOT NULL
        CHECK (policy_result IN ('warning', 'restricted'))
);

CREATE INDEX IF NOT EXISTS no_show_records_user_idx
    ON public.no_show_records (user_id, recorded_at DESC);

-- 5. Ordering restrictions. A restriction blocks new orders while
-- status = 'active' and ends_at is still in the future.
-- 'lifted' is for a staff/admin decision to end one early.
CREATE TABLE IF NOT EXISTS public.customer_restrictions (
    restriction_id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id integer NOT NULL REFERENCES public.users(user_id) ON DELETE RESTRICT,
    no_show_id integer NOT NULL UNIQUE REFERENCES public.no_show_records(no_show_id) ON DELETE RESTRICT,
    reason text NOT NULL,
    starts_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    ends_at timestamp without time zone NOT NULL,
    status character varying(20) DEFAULT 'active' NOT NULL
        CHECK (status IN ('active', 'lifted')),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS customer_restrictions_user_idx
    ON public.customer_restrictions (user_id, ends_at DESC);

COMMIT;
