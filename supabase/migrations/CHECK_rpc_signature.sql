-- DIAGNOSTIC: Check Function Signature
-- We need to know if the function accepts p_branch_id.

SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname = 'submit_waste_report';
