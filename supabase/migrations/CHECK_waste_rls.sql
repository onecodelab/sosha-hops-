-- DIAGNOSTIC: Check Waste Logs Access
-- 1. Check if table exists and has data
SELECT count(*) FROM waste_logs;

-- 2. Check current user's RLS visibility
-- This mimics what the frontend does
SELECT * FROM waste_logs LIMIT 5;

-- 3. Check RLS Policies
SELECT * FROM pg_policies WHERE tablename = 'waste_logs';

-- 4. Check user profile branch
SELECT id, email, home_branch_id, role FROM profiles WHERE email = 'checkwat1@gmail.com' OR email = 'naserlimin@gmail.com'; 
-- (Assuming nanserlimin is the manager trying to view)
