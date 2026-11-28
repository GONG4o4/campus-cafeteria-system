-- Migration 009: Same-day scheduled pickup (issue #96)
--
-- Adds:
--   1. pickup_settings - one row with the cafeteria hours and the
--      scheduling rules. Change the values with an UPDATE, no code change.
--   2. orders.pickup_type          - 'asap' (default) or 'scheduled'
--   3. orders.scheduled_pickup_at  - the pickup time the customer chose
--      (timestamptz, so it is one exact moment no matter the server's
--      time zone; the backend reads and writes it as Asia/Manila time)
--
-- Existing orders become 'asap' with no scheduled time, so they keep
-- working exactly as before. Safe to run more than once.
-- Run it after migration 008:
--   psql -U postgres -d campus_cafeteria -f database/migrations/009_scheduled_pickup.sql

BEGIN;

-- 1. Settings. Only one row is allowed (setting_id = 1).
--    open_time / close_time  : cafeteria hours (Asia/Manila)
--    slot_minutes            : pickup times are offered every N minutes
--    slot_capacity           : max scheduled orders per pickup time
--    prep_lead_minutes       : staff start preparing this long before pickup
--    booking_buffer_minutes  : extra time on top of the lead time, so the
--                              earliest pickup is now + lead + buffer
CREATE TABLE IF NOT EXISTS public.pickup_settings (
    setting_id integer DEFAULT 1 PRIMARY KEY CHECK (setting_id = 1),
    open_time time NOT NULL,
    close_time time NOT NULL,
    slot_minutes integer NOT NULL CHECK (slot_minutes BETWEEN 5 AND 120),
    slot_capacity integer NOT NULL CHECK (slot_capacity > 0),
    prep_lead_minutes integer NOT NULL CHECK (prep_lead_minutes >= 0),
    booking_buffer_minutes integer NOT NULL CHECK (booking_buffer_minutes >= 0),
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CHECK (open_time < close_time)
);

-- Values agreed for the first release:
-- 7:00 AM - 5:00 PM, 15-minute slots, 10 orders per slot, 20 minutes prep.
INSERT INTO public.pickup_settings (
    setting_id, open_time, close_time, slot_minutes, slot_capacity,
    prep_lead_minutes, booking_buffer_minutes
)
VALUES (1, '07:00', '17:00', 15, 10, 20, 10)
ON CONFLICT (setting_id) DO NOTHING;

-- 2 and 3. Order columns.
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS pickup_type character varying(10) DEFAULT 'asap' NOT NULL;

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS scheduled_pickup_at timestamp with time zone;

ALTER TABLE public.orders
    DROP CONSTRAINT IF EXISTS orders_pickup_type_check;

-- ASAP orders never have a time; scheduled orders always have one.
ALTER TABLE public.orders
    ADD CONSTRAINT orders_pickup_type_check CHECK (
        (pickup_type = 'asap' AND scheduled_pickup_at IS NULL)
        OR (pickup_type = 'scheduled' AND scheduled_pickup_at IS NOT NULL)
    );

-- Used to count how many orders are already booked in a time slot.
CREATE INDEX IF NOT EXISTS orders_scheduled_pickup_idx
    ON public.orders (scheduled_pickup_at)
    WHERE scheduled_pickup_at IS NOT NULL;

COMMIT;
