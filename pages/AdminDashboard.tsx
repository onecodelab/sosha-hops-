import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../AuthContext';
import { supabase } from '../supabase';
import { MenuItem, UserProfile } from '../types';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Badge, Dialog, showToast } from '../components/ui';
import { Plus, Trash2, Edit2, Search, UserPlus, Database } from 'lucide-react';
import { MENU_SEED_DATA } from '../utils/seedData';

const AdminDashboard: React.FC = () => {
  const { profile } = useAuth();
  const [stats, setStats] = useState({ revenue: 0, ordersToday: 0, topItem: 'None' });
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Dialog States
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState<Partial<MenuItem>>({});
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteData, setInviteData] = useState({ email: '', role: 'waiter', name: '' });
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    fetchStats();
    fetchMenu();
  }, []);

  const fetchStats = async () => {
    // 1. Total Revenue (Paid)
    const { data: revenueData } = await supabase
      .from('orders')
      .select('total_amount')
      .eq('status', 'paid');
    
    const revenue = revenueData?.reduce((acc, curr) => acc + curr.total_amount, 0) || 0;

    // 2. Orders Today
    const today = new Date().toISOString().split('T')[0];
    const { count: ordersToday } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${today}T00:00:00`);

    // 3. Top Item (Simplified)
    setStats({ revenue, ordersToday: ordersToday || 0, topItem: 'Special Burger' });
  };

  const fetchMenu = async () => {
    const { data } = await supabase.from('menu').select('*').order('name');
    if (data) setMenuItems(data);
    setLoading(false);
  };

  const handleSaveItem = async () => {
    if (!currentItem.name || !currentItem.price || !currentItem.category) return;

    try {
      if (currentItem.id) {
        await supabase.from('menu').update(currentItem).eq('id', currentItem.id);
        showToast('Item updated successfully');
      } else {
        await supabase.from('menu').insert([{ ...currentItem, is_available: true }]);
        showToast('Item created successfully');
      }
      setIsItemModalOpen(false);
      fetchMenu();
    } catch (error) {
      showToast('Error saving item', 'error');
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (confirm('Are you sure you want to delete this item?')) {
      await supabase.from('menu').delete().eq('id', id);
      fetchMenu();
      showToast('Item deleted');
    }
  };

  const handleInvite = async () => {
    try {
       await supabase.from('invitations').insert({
         email: inviteData.email,
         role: inviteData.role,
         token: Math.random().toString(36).substring(7),
       });
       showToast(`Invitation sent to ${inviteData.email}`);
       setIsInviteModalOpen(false);
       setInviteData({ email: '', role: 'waiter', name: '' });
    } catch (e) {
      showToast('Error sending invitation', 'error');
    }
  };

  const handleSeedMenu = async () => {
    if (!confirm(`This will attempt to add ${MENU_SEED_DATA.length} items to the menu. Continue?`)) return;
    setSeeding(true);
    try {
      const { error } = await supabase.from('menu').insert(MENU_SEED_DATA);
      if (error) throw error;
      showToast('Menu populated successfully!');
      fetchMenu();
    } catch (err: any) {
      console.error(err);
      showToast('Failed to seed menu: ' + err.message, 'error');
    } finally {
      setSeeding(false);
    }
  };

  const filteredMenu = menuItems.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout 
      title="Admin Dashboard" 
      subtitle={`Welcome back, ${profile?.name || 'Owner'}`}
      actions={
        <div className="flex gap-2">
           <Button onClick={handleSeedMenu} variant="secondary" isLoading={seeding}>
             <Database className="mr-2 h-4 w-4" /> Seed Menu
           </Button>
           <Button onClick={() => setIsInviteModalOpen(true)} variant="outline">
             <UserPlus className="mr-2 h-4 w-4" /> Invite Staff
           </Button>
        </div>
      }
    >
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Total Revenue</CardTitle>
            <div className="text-primary font-bold">ETB</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.revenue.toLocaleString()}</div>
            <p className="text-xs text-gray-500">+20.1% from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Orders Today</CardTitle>
            <div className="text-primary font-bold">#</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.ordersToday}</div>
            <p className="text-xs text-gray-500">+12% from yesterday</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Top Item</CardTitle>
            <div className="text-primary font-bold">★</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold truncate">{stats.topItem}</div>
            <p className="text-xs text-gray-500">Most ordered item</p>
          </CardContent>
        </Card>
      </div>

      {/* Menu Management */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Menu Management</h2>
          <Button onClick={() => { setCurrentItem({}); setIsItemModalOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Add Item
          </Button>
        </div>

        <div className="flex items-center gap-2 max-w-sm mb-4">
          <Search className="text-gray-500 h-4 w-4" />
          <Input 
            placeholder="Search items..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="rounded-md border border-border overflow-hidden">
          <table className="w-full text-sm text-left text-gray-400">
            <thead className="bg-gray-900 text-gray-200 uppercase">
              <tr>
                <th className="px-6 py-3">Image</th>
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Category</th>
                <th className="px-6 py-3">Price</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-4 text-center">Loading...</td></tr>
              ) : filteredMenu.map((item) => (
                <tr key={item.id} className="border-b border-border bg-card hover:bg-gray-900/50">
                  <td className="px-6 py-4">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="w-10 h-10 rounded-md object-cover bg-gray-800" />
                    ) : (
                      <div className="w-10 h-10 rounded-md bg-gray-800" />
                    )}
                  </td>
                  <td className="px-6 py-4 font-medium text-white">{item.name}</td>
                  <td className="px-6 py-4"><Badge variant="outline">{item.category}</Badge></td>
                  <td className="px-6 py-4">ETB {item.price}</td>
                  <td className="px-6 py-4">
                    <Badge variant={item.is_available ? 'success' : 'secondary'}>
                      {item.is_available ? 'Available' : 'Unavailable'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button onClick={() => { setCurrentItem(item); setIsItemModalOpen(true); }} className="text-blue-400 hover:text-blue-300">
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDeleteItem(item.id)} className="text-red-400 hover:text-red-300">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Item Modal */}
      <Dialog isOpen={isItemModalOpen} onClose={() => setIsItemModalOpen(false)} title={currentItem.id ? "Edit Item" : "New Item"}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <Input value={currentItem.name || ''} onChange={e => setCurrentItem({...currentItem, name: e.target.value})} />
          </div>
          <div>
             <label className="block text-sm font-medium mb-1">Image URL</label>
             <Input value={currentItem.image_url || ''} onChange={e => setCurrentItem({...currentItem, image_url: e.target.value})} placeholder="https://..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Price</label>
              <Input type="number" value={currentItem.price || ''} onChange={e => setCurrentItem({...currentItem, price: parseFloat(e.target.value)})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <Input value={currentItem.category || ''} onChange={e => setCurrentItem({...currentItem, category: e.target.value})} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              id="avail"
              checked={currentItem.is_available ?? true}
              onChange={e => setCurrentItem({...currentItem, is_available: e.target.checked})}
              className="rounded border-gray-600 bg-gray-800 text-primary focus:ring-primary"
            />
            <label htmlFor="avail" className="text-sm">Available for ordering</label>
          </div>
          <Button onClick={handleSaveItem} className="w-full">Save Item</Button>
        </div>
      </Dialog>

      {/* Invite Modal */}
      <Dialog isOpen={isInviteModalOpen} onClose={() => setIsInviteModalOpen(false)} title="Invite Staff">
        <div className="space-y-4">
          <div>
             <label className="block text-sm font-medium mb-1">Name</label>
             <Input value={inviteData.name} onChange={e => setInviteData({...inviteData, name: e.target.value})} />
          </div>
          <div>
             <label className="block text-sm font-medium mb-1">Email</label>
             <Input type="email" value={inviteData.email} onChange={e => setInviteData({...inviteData, email: e.target.value})} />
          </div>
          <div>
             <label className="block text-sm font-medium mb-1">Role</label>
             <select 
               className="w-full h-11 rounded-lg border border-border bg-card px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary"
               value={inviteData.role}
               onChange={e => setInviteData({...inviteData, role: e.target.value})}
             >
               <option value="manager">Manager</option>
               <option value="waiter">Waiter</option>
               <option value="kitchen">Kitchen</option>
             </select>
          </div>
          <Button onClick={handleInvite} className="w-full">Send Invitation</Button>
        </div>
      </Dialog>
    </DashboardLayout>
  );
};

export default AdminDashboard;