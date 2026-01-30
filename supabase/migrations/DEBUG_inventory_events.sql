-- DIAGNOSTIC: Find the Source of "inventory_events" Error
-- The error implies a trigger is verifying/inserting into a table we didn't touch directly.

-- 1. Check Triggers on branch_inventory
SELECT event_object_table, trigger_name, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'branch_inventory';

-- 2. Check Triggers on waste_logs
SELECT event_object_table, trigger_name, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'waste_logs';

-- 3. Check definition of inventory_events
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'inventory_events';

-- 4. Check if submit_waste_report function was actually updated
SELECT prosrc FROM pg_proc WHERE proname = 'submit_waste_report';
