
import React, { useState } from 'react';
import { Button, Card, CardContent, CardHeader } from './ui';
import { Copy, Check, RefreshCw, ShieldAlert, Lock } from 'lucide-react';
import { SoshaLogo } from './SoshaLogo';

export const SetupGuide: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const sqlCode = `-- 1. ERP ENUMS & CONSTRAINTS
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_type') THEN
        CREATE TYPE public.event_type AS ENUM ('purchase', 'consumption', 'waste', 'adjustment', 'shortage');
    END IF;
END $$;

ALTER TABLE public.ingredients 
    ADD CONSTRAINT IF NOT EXISTS qty_non_negative CHECK (current_stock >= 0),
    ADD CONSTRAINT IF NOT EXISTS par_logic CHECK (par_min <= par_max);

-- 2. CORE SYNC TRIGGER (Audit Trail -> Stock)
CREATE OR REPLACE FUNCTION public.fn_sync_ingredient_stock()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.ingredients
    SET current_stock = current_stock + NEW.qty_change
    WHERE id = NEW.ingredient_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_inventory_sync ON public.inventory_events;
CREATE TRIGGER tr_inventory_sync
AFTER INSERT ON public.inventory_events
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_ingredient_stock();

-- 3. AUTOMATED CONSUMPTION (Order -> Audit Trail)
CREATE OR REPLACE FUNCTION public.consume_order_inventory(p_order_id UUID)
RETURNS VOID AS $$
DECLARE
    item_record RECORD;
    recipe_record RECORD;
BEGIN
    FOR item_record IN (SELECT menu_item_id, quantity FROM public.order_items WHERE order_id = p_order_id) LOOP
        FOR recipe_record IN (
            SELECT ri.ingredient_id, (ri.quantity / NULLIF(r.yield_servings, 0)) as unit_qty
            FROM public.recipe_ingredients ri
            JOIN public.recipes r ON ri.recipe_id = r.id
            WHERE r.menu_item_id = item_record.menu_item_id
        ) LOOP
            INSERT INTO public.inventory_events (ingredient_id, event_type, qty_change, reason)
            VALUES (recipe_record.ingredient_id, 'consumption', -(recipe_record.unit_qty * item_record.quantity), 'Order #' || p_order_id);
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.fn_on_order_fulfilled()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.status IN ('completed', 'paid', 'served') AND OLD.status NOT IN ('completed', 'paid', 'served')) THEN
        PERFORM public.consume_order_inventory(NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_order_fulfillment ON public.orders;
CREATE TRIGGER tr_order_fulfillment AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.fn_on_order_fulfilled();

-- 4. WASTE SYNC (Waste -> Audit Trail)
CREATE OR REPLACE FUNCTION public.fn_sync_waste_to_events()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.inventory_events (ingredient_id, event_type, qty_change, reason)
    VALUES (NEW.ingredient_id, 'waste', -NEW.quantity, 'Waste Log: ' || NEW.waste_category);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_waste_sync ON public.waste_logs;
CREATE TRIGGER tr_waste_sync AFTER INSERT ON public.waste_logs
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_waste_to_events();

-- 5. ANALYTICS VIEW
CREATE OR REPLACE VIEW public.ingredient_overview AS
SELECT 
    i.*,
    CASE 
        WHEN i.current_stock = 0 THEN 'EMPTY'
        WHEN i.current_stock <= i.par_min THEN 'LOW'
        ELSE 'HEALTHY'
    END as stock_status
FROM public.ingredients i;

NOTIFY pgrst, 'reload schema';
`;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 text-foreground font-sans">
      <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        <div className="space-y-6">
           <div className="w-20 h-20 mb-6"><SoshaLogo className="w-full h-full" /></div>
           <div className="flex items-center gap-2 text-primary bg-primary/10 border border-primary/20 px-3 py-1 rounded-full w-fit">
              <Lock className="w-3.5 h-3.5" /><span className="text-[10px] font-black uppercase tracking-widest">ERP Integrity Sync</span>
           </div>
           <h1 className="text-4xl font-bold text-white tracking-tight">Harden <span className="text-primary">Business Logic</span></h1>
           <p className="text-gray-400 text-sm">This script installs the automated triggers that ensure inventory is deducted exactly when food is served.</p>
           <Button onClick={() => window.location.reload()} className="w-full h-14 bg-white text-black font-black rounded-2xl">
             Refresh App After Running SQL
           </Button>
        </div>
        <Card className="bg-[#111] border-gray-800 h-[500px] flex flex-col overflow-hidden rounded-3xl shadow-2xl">
           <div className="p-4 border-b border-gray-800 flex justify-between items-center">
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Master Hardening Script</span>
              <Button size="sm" variant={copied ? 'secondary' : 'outline'} onClick={() => handleCopy(sqlCode)} className="rounded-xl h-8">
                 {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              </Button>
           </div>
           <textarea readOnly value={sqlCode} className="w-full h-full bg-[#0A0A0A] text-gray-300 font-mono text-[10px] p-6 resize-none focus:outline-none custom-scrollbar" />
        </Card>
      </div>
    </div>
  );
};
