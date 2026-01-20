-- Add position columns to tables for floor map visualization
ALTER TABLE tables ADD COLUMN IF NOT EXISTS pos_x numeric DEFAULT 50;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS pos_y numeric DEFAULT 50;

-- Set initial positions based on zones (approximate layout from Miro design)
-- Bar Zone (top-left area)
UPDATE tables SET pos_x = 15, pos_y = 15 WHERE table_number = 'B1';
UPDATE tables SET pos_x = 30, pos_y = 15 WHERE table_number = 'B2';

-- VIP Zone (top-right area)
UPDATE tables SET pos_x = 70, pos_y = 15 WHERE table_number = 'V2';
UPDATE tables SET pos_x = 85, pos_y = 20 WHERE table_number = 'V3';

-- Indoor Zone (center area)
UPDATE tables SET pos_x = 20, pos_y = 45 WHERE table_number = 'T2';
UPDATE tables SET pos_x = 50, pos_y = 35 WHERE table_number = 'T3';
UPDATE tables SET pos_x = 45, pos_y = 55 WHERE table_number = 'T5';
UPDATE tables SET pos_x = 70, pos_y = 50 WHERE table_number = 'T6';

-- Outdoor Zone (bottom area)
UPDATE tables SET pos_x = 25, pos_y = 75 WHERE table_number = 'T4';
UPDATE tables SET pos_x = 45, pos_y = 85 WHERE table_number = 'O1';
UPDATE tables SET pos_x = 80, pos_y = 80 WHERE table_number = 'O4';

-- Comment on columns
COMMENT ON COLUMN tables.pos_x IS 'X position on floor map (0-100 percentage)';
COMMENT ON COLUMN tables.pos_y IS 'Y position on floor map (0-100 percentage)';
