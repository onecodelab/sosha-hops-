-- Backfill existing profiles with the default 'Main Branch' ID
-- This fixes the issue where existing users have no active branch context

DO $$
DECLARE
    main_branch_id UUID;
BEGIN
    -- 1. Get the Main Branch ID (assuming it's the one we created or the first one)
    SELECT id INTO main_branch_id FROM public.branches ORDER BY created_at ASC LIMIT 1;

    -- If no branch exists, create one (Safety fallback)
    IF main_branch_id IS NULL THEN
        INSERT INTO public.branches (name, location, is_active)
        VALUES ('Main Branch', 'HQ', true)
        RETURNING id INTO main_branch_id;
    END IF;

    -- 2. Update all profiles that have NULL home_branch_id
    UPDATE public.profiles
    SET home_branch_id = main_branch_id
    WHERE home_branch_id IS NULL;

    -- 3. Specifically ensure the users provided by the user are linked (Redundant but safe)
    -- Owner: bocheratube@gmail.com
    -- Manager: raminnaser4@gmail.com
    -- Waiter: naserlimin@gmail.com
    -- Kitchen: raminsjourney@gmail.com
    
    RAISE NOTICE 'Backfilled profiles with Main Branch ID: %', main_branch_id;
END $$;
