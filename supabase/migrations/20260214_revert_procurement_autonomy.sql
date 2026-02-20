-- REVERT PROCUREMENT AUTONOMY CHANGES
-- Run this script to undo the Agent/Auto-PO related changes in the database.

-- 1. Drop Triggers
DROP TRIGGER IF EXISTS trigger_auto_draft_po ON public.branch_inventory;
DROP TRIGGER IF EXISTS trigger_process_purchase_request ON public.purchase_requests;

-- 2. Drop Functions
DROP FUNCTION IF EXISTS public.auto_draft_po_on_low_stock();
DROP FUNCTION IF EXISTS public.process_purchase_request();
DROP FUNCTION IF EXISTS public.check_policy_approval(uuid, text, numeric);
DROP FUNCTION IF EXISTS public.update_trust_score(uuid, integer, text);

-- 3. Drop Tables
DROP TABLE IF EXISTS public.agent_policies;
DROP TABLE IF EXISTS public.staff_trust_scores;

-- 4. Note: We do NOT revert the 'created_by' column nullability in 'purchase_orders'
-- because existing data might now have NULLs, and it's safe to keep it optional.
-- If you want to enforce it again, ensure no NULLs exist first:
-- UPDATE public.purchase_orders SET created_by = [SomeDefaultID] WHERE created_by IS NULL;
-- ALTER TABLE public.purchase_orders ALTER COLUMN created_by SET NOT NULL;
