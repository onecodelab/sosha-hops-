-- Migration: Adding Urgency Metadata to Ingredients
-- Date: 2026-02-15

ALTER TABLE public.ingredients
    ADD COLUMN IF NOT EXISTS lead_time_hours INTEGER DEFAULT 24,
    ADD COLUMN IF NOT EXISTS storage_life_hours INTEGER DEFAULT NULL;

-- Comment for clarity
COMMENT ON COLUMN public.ingredients.lead_time_hours IS 'Estimated hours between order placement and delivery arrival.';
COMMENT ON COLUMN public.ingredients.storage_life_hours IS 'Estimated hours before the ingredient spoils or becomes unusable.';

-- Backfill defaults for high-reach items if needed
UPDATE public.ingredients 
SET lead_time_hours = 12 
WHERE name ILIKE '%banana%' OR name ILIKE '%meat%' OR name ILIKE '%beef%';
