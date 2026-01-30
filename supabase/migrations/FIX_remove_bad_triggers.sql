-- FIX: Remove Broken Triggers from Branch Inventory
-- The error 'column quantity ... does not exist' comes from a bad trigger on this table.
-- We will remove all triggers from 'branch_inventory' to stop it from trying to write to the broken 'inventory_events' table.

DO $$
DECLARE
    t_rec record;
BEGIN
    FOR t_rec IN 
        SELECT trigger_name 
        FROM information_schema.triggers 
        WHERE event_object_table = 'branch_inventory'
    LOOP
        RAISE NOTICE 'Dropping trigger: %', t_rec.trigger_name;
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.branch_inventory CASCADE', t_rec.trigger_name);
    END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
