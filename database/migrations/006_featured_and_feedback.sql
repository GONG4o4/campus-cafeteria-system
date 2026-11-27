-- Migration 006: Featured meals and customer feedback / reports
--
-- Adds:
--   1. menu_items.is_featured - staff can pick meals to show as "Featured".
--   2. feedback - customers can send feedback or report a problem.
--
-- Existing rows are not deleted or changed. Safe to run more than once.
-- Run it after migration 005:
--   psql -U postgres -d campus_cafeteria -f database/migrations/006_featured_and_feedback.sql

BEGIN;

-- 1. Featured meals. Existing meals start as not featured.
ALTER TABLE public.menu_items
    ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false NOT NULL;

-- 2. Feedback and problem reports.
--    type:   'feedback' (comment / suggestion) or 'report' (a problem)
--    rating: 1 to 5 stars, optional
--    status: 'new' until staff or admin marks it 'resolved'
CREATE TABLE IF NOT EXISTS public.feedback (
    feedback_id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id integer NOT NULL REFERENCES public.users(user_id) ON DELETE RESTRICT,
    type character varying(20) NOT NULL
        CHECK (type IN ('feedback', 'report')),
    subject character varying(120) NOT NULL,
    message text NOT NULL,
    rating integer CHECK (rating BETWEEN 1 AND 5),
    order_id integer REFERENCES public.orders(order_id) ON DELETE SET NULL,
    status character varying(20) DEFAULT 'new' NOT NULL
        CHECK (status IN ('new', 'resolved')),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    resolved_at timestamp without time zone,
    resolved_by integer REFERENCES public.users(user_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS feedback_created_at_idx
    ON public.feedback (created_at DESC);

CREATE INDEX IF NOT EXISTS feedback_user_idx
    ON public.feedback (user_id, created_at DESC);

COMMIT;
