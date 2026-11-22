-- Migration 005: Payments table for HitPay
--
-- One row per HitPay payment request. The backend creates it as 'pending'
-- when the customer checks out, then marks it 'paid' when HitPay confirms
-- (through the webhook or the verify-payment check). Cancelling an order
-- marks its pending payment as 'cancelled'.
--
-- checkout_session_id is the HitPay payment request ID.
-- Safe to run more than once. Run it after migration 004:
--   psql -U postgres -d campus_cafeteria -f database/migrations/005_payments.sql

CREATE TABLE IF NOT EXISTS public.payments (
    payment_id serial PRIMARY KEY,
    order_id integer NOT NULL REFERENCES public.orders (order_id) ON DELETE CASCADE,
    checkout_session_id character varying(100) NOT NULL UNIQUE,
    reference_number character varying(100),
    amount numeric(10, 2) NOT NULL,
    status character varying(20) DEFAULT 'pending' NOT NULL
        CHECK (status IN ('pending', 'paid', 'cancelled', 'failed')),
    last_webhook_event_id character varying(150),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS payments_order_idx
    ON public.payments (order_id);
