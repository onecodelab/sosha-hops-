-- Migration: 20260329_standardize_menu_views.sql
-- Purpose: Standardize menu detail views to support both underscored and non-underscored names for the AI and legacy integrations.
-- This fixes the "column viewmenudetails.ingredientslist does not exist" and "column organization_id does not exist" errors.

BEGIN;

-- 1. Ensure the underlying menu table structure and related tables have organization_id
ALTER TABLE public.menu ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE public.menu ADD COLUMN IF NOT EXISTS dietary_tags TEXT[] DEFAULT '{}';
ALTER TABLE public.menu ADD COLUMN IF NOT EXISTS ingredients_list TEXT[] DEFAULT '{}';
ALTER TABLE public.menu ADD COLUMN IF NOT EXISTS spice_level TEXT DEFAULT 'None';
ALTER TABLE public.menu ADD COLUMN IF NOT EXISTS portion_size TEXT DEFAULT 'Standard';

ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE public.credit_usage_logs ADD COLUMN IF NOT EXISTS organization_id UUID;

-- 2. Create/Update the Canonical View (Underscores)
-- This confirms m.organization_id exists for RLS and filters.
DROP VIEW IF EXISTS public.view_menu_details CASCADE;
CREATE OR REPLACE VIEW public.view_menu_details 
WITH (security_invoker = true) AS
SELECT 
  m.id,
  m.name,
  m.price,
  COALESCE(cat.name, m.category) as category,
  m.image_url,
  m.description,
  COALESCE(m.dietary_tags, '{}') as dietary_tags,
  COALESCE(
    (
      SELECT array_agg(i.name)
      FROM recipes r
      JOIN recipe_ingredients ri ON r.id = ri.recipe_id
      JOIN ingredients i ON ri.ingredient_id = i.id
      WHERE r.menu_item_id = m.id
    ),
    m.ingredients_list,
    '{}'
  ) as ingredients_list,
  m.spice_level,
  m.portion_size,
  m.organization_id,
  -- ALIAS for cases where code mistakenly looks for 'organizationid'
  m.organization_id as organizationid,
  m.status as manual_status,
  m.branch_id as scope_branch_id,
  c.recipe_id,
  COALESCE(c.calculated_cost, 0) as cost_per_plate,
  (COALESCE(m.status, 'available') = 'available') AND (COALESCE(a.is_available, true)) as is_available,
  (m.price - COALESCE(c.calculated_cost, 0)) as margin,
  CASE WHEN m.price > 0 THEN ((m.price - COALESCE(c.calculated_cost, 0)) / m.price) * 100 ELSE 0 END as margin_percent,
  COALESCE(a.branch_id, m.branch_id) as branch_id
FROM 
  menu m
LEFT JOIN 
  categories cat ON m.category_id = cat.id
LEFT JOIN 
  view_recipe_costs c ON m.id = c.menu_item_id
LEFT JOIN 
  view_menu_availability a ON m.id = a.menu_item_id 
    AND (m.branch_id = a.branch_id OR m.branch_id IS NULL OR a.branch_id IS NULL);

-- 3. Create/Update the Legacy Alias View (No Underscores)
-- Also ensuring organizationid (no underscore) column exists here.
DROP VIEW IF EXISTS public.viewmenudetails CASCADE;
CREATE OR REPLACE VIEW public.viewmenudetails 
WITH (security_invoker = true) AS
SELECT 
  *, 
  ingredients_list as ingredientslist, -- Alias for underscore-free queries
  organization_id as organizationid -- Extra confirmation for camelCase-turned-lowercase queries
FROM 
  public.view_menu_details;

-- 4. Harden the Billing Trigger to ensure it survives skips and terminal updates
CREATE OR REPLACE FUNCTION public.fn_bill_chatbot_order()
RETURNS TRIGGER AS $$
BEGIN
    -- Only trigger when source is recorded as 'chatbot'
    -- AND status is accepted/served/paid/closed (waiter-approved states)
    -- AND we havent billed this order yet
    IF (NEW.source = 'chatbot' AND NEW.status IN ('accepted', 'served', 'paid', 'closed') AND NEW.billed_for_credits = false) THEN
        
        -- A. Deduct 20 credits from the organization
        PERFORM public.increment_org_credits(NEW.organization_id, 20);
        
        -- B. Log the usage for auditing
        INSERT INTO public.credit_usage_logs (
            organization_id,
            amount,
            action_type,
            metadata
        ) VALUES (
            NEW.organization_id,
            20,
            'chatbot_order_accepted',
            jsonb_build_object(
                'order_id', NEW.id,
                'table_id', NEW.table_id,
                'source', NEW.source,
                'note', 'Billed at approval phase: ' || NEW.status
            )
        );
        
        -- C. Mark as billed to prevent double-charging
        NEW.billed_for_credits := true;
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure trigger is attached if it was missing
DROP TRIGGER IF EXISTS trig_bill_chatbot_order ON public.orders;
CREATE TRIGGER trig_bill_chatbot_order
    BEFORE UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_bill_chatbot_order();

COMMIT;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
