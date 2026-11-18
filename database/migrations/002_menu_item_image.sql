-- Migration 002: Optional food image for menu items
--
-- Adds an image_url column that stores a link to the meal's photo.
-- The column is optional (NULL allowed), so existing menu items stay valid.
-- Safe to run more than once.
-- Run it after database/schema.sql and migration 001:
--   psql -U postgres -d campus_cafeteria -f database/migrations/002_menu_item_image.sql

BEGIN;

ALTER TABLE public.menu_items
    ADD COLUMN IF NOT EXISTS image_url character varying(500);

COMMIT;
