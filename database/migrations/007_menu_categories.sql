-- Migration 007: Menu categories
--
-- Adds menu_items.category so meals can be grouped on the menu.
-- Allowed values: rice_meals, snacks, drinks, desserts
-- Existing meals start as 'rice_meals'. Staff can change them in
-- Menu management. Safe to run more than once.
-- Run it after migration 006:
--   psql -U postgres -d campus_cafeteria -f database/migrations/007_menu_categories.sql

BEGIN;

ALTER TABLE public.menu_items
    ADD COLUMN IF NOT EXISTS category character varying(30) DEFAULT 'rice_meals' NOT NULL;

ALTER TABLE public.menu_items
    DROP CONSTRAINT IF EXISTS menu_items_category_check;

ALTER TABLE public.menu_items
    ADD CONSTRAINT menu_items_category_check
    CHECK (category IN ('rice_meals', 'snacks', 'drinks', 'desserts'));

COMMIT;
