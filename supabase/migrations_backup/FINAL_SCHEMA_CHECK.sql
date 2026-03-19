-- DIAGNOSTIC: Final Schema Check for waste_logs
-- We need to see the EXACT column names to stop the "does not exist" errors.

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'waste_logs';
