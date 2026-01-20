-- Add weight_per_unit to ingredients table for unit conversion (e.g., pcs to grams)
ALTER TABLE ingredients 
ADD COLUMN IF NOT EXISTS weight_per_unit numeric DEFAULT 1;

-- Optional: Comment on column
COMMENT ON COLUMN ingredients.weight_per_unit IS 'Weight or volume of a single unit (e.g., 1 onion = 150g) for recipe cost calculations';
