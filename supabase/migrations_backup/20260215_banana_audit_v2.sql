-- Diagnostic: Banana Audit (Table Version)
-- Returns a visible table in the "Results" tab.

WITH target_ingredient AS (
    SELECT id, name 
    FROM public.ingredients 
    WHERE name ILIKE '%banana%'
    LIMIT 1
)
SELECT 
    m.name AS menu_item_name,
    ti.name AS ingredient_name,
    m.id AS menu_item_id,
    r.id AS recipe_id,
    m.status AS menu_status,
    m.is_available AS menu_available
FROM public.recipe_ingredients ri
JOIN target_ingredient ti ON ri.ingredient_id = ti.id
JOIN public.recipes r ON ri.recipe_id = r.id
JOIN public.menu m ON r.menu_item_id = m.id
ORDER BY m.name;
