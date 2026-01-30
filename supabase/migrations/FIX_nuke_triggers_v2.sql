-- FIX: AGGRESSIVE TRIGGER REMOVAL (V2)
-- The error persists because we missed a trigger on 'waste_logs' or 'ingredients'.
-- This script removes ALL triggers from ALL inventory-related tables.

DO $$
DECLARE
    t_rec record;
    tables text[] := ARRAY['branch_inventory', 'waste_logs', 'ingredients', 'inventory_events'];
    t_name text;
BEGIN
    FOREACH t_name IN ARRAY tables
    LOOP
        FOR t_rec IN 
            SELECT trigger_name 
            FROM information_schema.triggers 
            WHERE event_object_table = t_name
        LOOP
            RAISE NOTICE 'Dropping trigger: % on table %', t_rec.trigger_name, t_name;
            EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I CASCADE', t_rec.trigger_name, t_name);
        END LOOP;
    END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
