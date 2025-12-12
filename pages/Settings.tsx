import React, { useState } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, Button, showToast } from '../components/ui';
import { Database, RefreshCw, AlertTriangle, Info, Package } from 'lucide-react';
import { supabase } from '../supabase';
import { MENU_SEED_DATA, INVENTORY_SEED_DATA } from '../utils/seedData';

const Settings: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [invLoading, setInvLoading] = useState(false);

  const handleSeedMenu = async () => {
    if (!confirm('This action attempts to populate the menu. Continue?')) return;

    setLoading(true);
    try {
      // 1. Get Restaurant ID
      const { data: rData } = await supabase.from('restaurants').select('id').limit(1).maybeSingle();
      if (!rData) throw new Error("No restaurant found. Please log out and back in to auto-create one.");

      // 2. Insert Seed Data
      const menuPayload = MENU_SEED_DATA.map(item => ({ ...item, restaurant_id: rData.id }));
      const { error } = await supabase.from('menu').insert(menuPayload);
      if (error) throw error;

      showToast('Menu seeded successfully!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to seed menu', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSeedInventory = async () => {
    if (!confirm('This action will add sample inventory items. Continue?')) return;
    
    setInvLoading(true);
    try {
        // 1. Get Restaurant ID
        const { data: rData } = await supabase.from('restaurants').select('id').limit(1).maybeSingle();
        if (!rData) throw new Error("No restaurant found.");

        // 2. Insert Inventory Data
        const invPayload = INVENTORY_SEED_DATA.map(item => ({ ...item, restaurant_id: rData.id }));
        const { error } = await supabase.from('inventory').insert(invPayload);
        if (error) throw error;

        showToast('Inventory seeded successfully!', 'success');
    } catch (err: any) {
        showToast(err.message || 'Failed to seed inventory', 'error');
    } finally {
        setInvLoading(false);
    }
  };

  return (
    <DashboardLayout title="System Settings" subtitle="Configuration & Tools">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Database Management Card */}
        <Card className="bg-[#1A1A1A] border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" /> Database Tools
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
             
             {/* Seed Menu */}
             <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-lg flex gap-3 items-start">
                <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                <div>
                   <h4 className="text-sm font-bold text-yellow-500">Seed Initial Menu</h4>
                   <p className="text-xs text-gray-400 mt-1">
                      Populate your menu with {MENU_SEED_DATA.length} demo items (Burgers, Juices, Breakfast). 
                      Useful for initial system setup.
                   </p>
                </div>
             </div>
             <Button 
                onClick={handleSeedMenu} 
                isLoading={loading}
                className="w-full bg-primary text-black font-bold hover:bg-primary/90"
             >
                <RefreshCw className="w-4 h-4 mr-2" /> Run Menu Seed
             </Button>

             {/* Seed Inventory */}
             <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg flex gap-3 items-start">
                <Package className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                <div>
                   <h4 className="text-sm font-bold text-blue-500">Seed Inventory</h4>
                   <p className="text-xs text-gray-400 mt-1">
                      Add {INVENTORY_SEED_DATA.length} sample stock items (Ingredients, Drinks) to test the inventory module.
                   </p>
                </div>
             </div>
             <Button 
                onClick={handleSeedInventory} 
                isLoading={invLoading}
                className="w-full bg-blue-600 text-white font-bold hover:bg-blue-700"
             >
                <RefreshCw className="w-4 h-4 mr-2" /> Run Inventory Seed
             </Button>

          </CardContent>
        </Card>

        {/* Application Info Card */}
        <Card className="bg-[#1A1A1A] border-gray-800">
           <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                 <Info className="w-5 h-5 text-blue-400" /> System Info
              </CardTitle>
           </CardHeader>
           <CardContent className="space-y-4 text-sm">
              <div className="flex justify-between border-b border-gray-800 pb-3">
                 <span className="text-gray-500">Version</span>
                 <span className="text-white font-mono">v1.0.0-beta</span>
              </div>
              <div className="flex justify-between border-b border-gray-800 pb-3">
                 <span className="text-gray-500">Environment</span>
                 <span className="text-white font-mono">Production</span>
              </div>
              <div className="flex justify-between border-b border-gray-800 pb-3">
                 <span className="text-gray-500">Last Sync</span>
                 <span className="text-white font-mono">{new Date().toLocaleDateString()}</span>
              </div>
              <div className="pt-2">
                 <p className="text-xs text-gray-500 text-center">Sosha OS &copy; {new Date().getFullYear()}</p>
              </div>
           </CardContent>
        </Card>

      </div>
    </DashboardLayout>
  );
};

export default Settings;