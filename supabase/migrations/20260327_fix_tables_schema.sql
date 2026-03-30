-- Migration: Add missing columns to tables
-- Date: 2026-03-27

-- 1. Add qr_token column to tables
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'tables' AND column_name = 'qr_token'
    ) THEN
        ALTER TABLE public.tables ADD COLUMN qr_token TEXT UNIQUE;
    END IF;
END $$;

-- 2. Fix pos_x/pos_y naming consistency for floor map
-- Note: Some components use pos_x/pos_y, others might have tried x_position/y_position.
-- We standardize on pos_x/pos_y as used in TableStatus.tsx and add_table_positions.sql
DO $$
BEGIN
    -- If x_position exists but pos_x doesn't, rename it
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'tables' AND column_name = 'x_position'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'tables' AND column_name = 'pos_x'
    ) THEN
        ALTER TABLE public.tables RENAME COLUMN x_position TO pos_x;
    END IF;

    -- If y_position exists but pos_y doesn't, rename it
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'tables' AND column_name = 'y_position'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'tables' AND column_name = 'pos_y'
    ) THEN
        ALTER TABLE public.tables RENAME COLUMN y_position TO pos_y;
    END IF;

    -- Ensure pos_x/pos_y exist with defaults if they don't
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'tables' AND column_name = 'pos_x'
    ) THEN
        ALTER TABLE public.tables ADD COLUMN pos_x numeric DEFAULT 50;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'tables' AND column_name = 'pos_y'
    ) THEN
        ALTER TABLE public.tables ADD COLUMN pos_y numeric DEFAULT 50;
    END IF;
END $$;

-- 3. Add shape column if it exists in AdminTableMap but missing in database
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'tables' AND column_name = 'shape'
    ) THEN
        ALTER TABLE public.tables ADD COLUMN shape TEXT DEFAULT 'square';
    END IF;
END $$;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
