-- Migration 008: Queue number is given after payment
--
-- With HitPay, the order is saved first (as unpaid) and the queue number
-- is only given after the payment is confirmed (services/paymentConfirm.js).
-- So orders.queue_number must allow NULL while the order is unpaid.
-- Without this, placing an order fails with a "not-null" error.
--
-- The existing check (queue_number > 0) and the unique
-- (order_date, queue_number) rule still apply once a number is given.
-- Safe to run more than once. Run it after migration 007:
--   psql -U postgres -d campus_cafeteria -f database/migrations/008_queue_number_after_payment.sql

BEGIN;

ALTER TABLE public.orders
    ALTER COLUMN queue_number DROP NOT NULL;

COMMIT;
