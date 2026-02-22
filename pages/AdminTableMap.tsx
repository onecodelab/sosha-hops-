
import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { DashboardLayout } from '../components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, showToast, cn } from '../components/ui';
import {
  Square, Circle, Maximize2, Trash2, Save, Plus,
  MousePointer2, Info, Layout, Armchair, Loader2, RefreshCw
} from 'lucide-react';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';
import { useBranch } from '../contexts/BranchContext';

interface Table {
  id: string;
  table_number: string;
  capacity: number;
  x_position: number;
  y_position: number;
  shape: 'square' | 'round' | 'rectangle';
  status: string;
  branch_id: string;
  organization_id: string;
}

const AdminTableMap: React.FC = () => {
  const { profile } = useAuth();
  const { activeBranchId } = useBranch();
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Canvas dimensions
  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 600;

  useEffect(() => {
    fetchTables();
  }, []);

  const fetchTables = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('tables').select('*');
      if (error) throw error;
      setTables(data || []);
    } catch (err: any) {
      console.error("Fetch tables error:", err);
      // If table doesn't exist, show hint
      if (err.message.includes('does not exist')) {
        showToast("Database table 'tables' missing. Run SQL in Setup Guide.", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddTable = async (shape: 'square' | 'round' | 'rectangle') => {
    const nextNum = tables.length + 1;
    const newTable = {
      table_number: `T${nextNum}`,
      capacity: shape === 'rectangle' ? 6 : (shape === 'square' ? 4 : 2),
      shape,
      x_position: CANVAS_WIDTH / 2 - 50,
      y_position: CANVAS_HEIGHT / 2 - 50,
      status: 'available',
      branch_id: activeBranchId,
      organization_id: profile?.organization_id
    };

    try {
      const { data, error } = await supabase.from('tables').insert(newTable).select().single();
      if (error) throw error;
      setTables([...tables, data]);
      setSelectedId(data.id);
      showToast(`Table ${data.table_number} added`);
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleUpdateTable = (id: string, updates: Partial<Table>) => {
    setTables(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const handleDeleteTable = async () => {
    if (!selectedId) return;
    if (!confirm("Delete this table?")) return;

    try {
      const { error } = await supabase.from('tables').delete().eq('id', selectedId).eq('organization_id', profile?.organization_id);
      if (error) throw error;
      setTables(prev => prev.filter(t => t.id !== selectedId));
      setSelectedId(null);
      showToast("Table removed");
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleSaveLayout = async () => {
    setSaving(true);
    try {
      // Supabase upsert requires unique id
      const tablesToSave = tables.map(t => ({
        ...t,
        branch_id: activeBranchId,
        organization_id: profile?.organization_id
      }));
      const { error } = await supabase.from('tables').upsert(tablesToSave);
      if (error) throw error;
      showToast("Layout saved successfully!", "success");
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const selectedTable = tables.find(t => t.id === selectedId);

  return (
    <DashboardLayout
      title="Table Map Editor"
      subtitle="Design your restaurant floor plan"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchTables} size="icon">
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
          <Button onClick={handleSaveLayout} className="bg-primary text-black font-bold" disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Save Layout
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8 animate-in fade-in duration-500">

        {/* Toolbar */}
        <div className="xl:col-span-4 flex flex-wrap gap-4 bg-card/50 p-4 rounded-2xl border border-border backdrop-blur-md">
          <p className="w-full text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Add Elements</p>
          <Button variant="outline" size="sm" onClick={() => handleAddTable('round')} className="gap-2 border-zinc-800 hover:bg-zinc-800">
            <Circle className="w-4 h-4" /> 2-Top (Round)
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleAddTable('square')} className="gap-2 border-zinc-800 hover:bg-zinc-800">
            <Square className="w-4 h-4" /> 4-Top (Square)
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleAddTable('rectangle')} className="gap-2 border-zinc-800 hover:bg-zinc-800">
            <Maximize2 className="w-4 h-4" /> 6-Top (Rect)
          </Button>

          <div className="ml-auto flex items-center gap-2 text-xs text-muted">
            <Info className="w-3 h-3" />
            Drag tables to reposition. Click to edit properties.
          </div>
        </div>

        {/* Canvas Area */}
        <div className="xl:col-span-3">
          <div
            ref={canvasRef}
            className="relative bg-[#050505] rounded-3xl border border-border shadow-2xl overflow-hidden cursor-crosshair"
            style={{ width: '100%', height: CANVAS_HEIGHT, backgroundImage: 'radial-gradient(#27272a 1px, transparent 1px)', backgroundSize: '30px 30px' }}
            onClick={() => setSelectedId(null)}
          >
            {/* Floor Label */}
            <div className="absolute top-6 left-6 text-[10px] font-mono text-zinc-700 uppercase tracking-[0.3em] font-bold">
              Main Dining Hall / Layout Editor
            </div>

            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              tables.map((table) => (
                <motion.div
                  key={table.id}
                  drag
                  dragMomentum={false}
                  dragConstraints={canvasRef}
                  initial={{ x: table.x_position, y: table.y_position }}
                  onDragEnd={(_, info) => {
                    // Update local state with new coordinates
                    const rect = canvasRef.current?.getBoundingClientRect();
                    if (rect) {
                      handleUpdateTable(table.id, {
                        x_position: table.x_position + info.offset.x,
                        y_position: table.y_position + info.offset.y
                      });
                    }
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedId(table.id);
                  }}
                  className={cn(
                    "absolute cursor-grab active:cursor-grabbing flex flex-col items-center justify-center transition-shadow",
                    selectedId === table.id ? "ring-2 ring-primary shadow-[0_0_20px_rgba(255,184,0,0.4)] z-50" : "hover:ring-1 hover:ring-zinc-600 z-10",
                    "bg-zinc-900 border border-zinc-800 shadow-xl",
                    table.shape === 'round' ? "rounded-full" : table.shape === 'rectangle' ? "rounded-xl" : "rounded-2xl",
                    table.shape === 'rectangle' ? "w-[120px] h-[80px]" : "w-[80px] h-[80px]"
                  )}
                  style={{ left: 0, top: 0 }} // Positioned by motion.div x/y
                >
                  <span className="text-white font-bold text-sm">{table.table_number}</span>
                  <div className="flex gap-0.5 mt-1">
                    {Array.from({ length: Math.min(table.capacity, 6) }).map((_, i) => (
                      <div key={i} className="w-1 h-1 rounded-full bg-zinc-600" />
                    ))}
                  </div>
                  {selectedId === table.id && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full shadow-[0_0_10px_#FFB800]" />
                  )}
                </motion.div>
              ))
            )}

            {tables.length === 0 && !loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-600">
                <Layout className="w-12 h-12 mb-4 opacity-20" />
                <p className="text-sm font-medium">Floor is empty. Add your first table from the toolbar.</p>
              </div>
            )}
          </div>
        </div>

        {/* Properties Sidebar */}
        <div className="xl:col-span-1 space-y-6">
          <Card className="bg-[#111] border-border h-full sticky top-4">
            <CardHeader className="border-b border-border">
              <CardTitle className="text-sm uppercase tracking-widest text-muted font-bold flex items-center gap-2">
                <MousePointer2 className="w-4 h-4" /> Properties
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {!selectedTable ? (
                <div className="py-10 text-center text-zinc-600 italic text-sm">
                  Select a table on the map to edit its details.
                </div>
              ) : (
                <div className="space-y-5 animate-in slide-in-from-right-2 duration-300">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Table Identity</label>
                    <div className="relative">
                      <span className="absolute left-3 top-3 text-zinc-500 text-xs font-mono">#</span>
                      <Input
                        value={selectedTable.table_number}
                        onChange={(e) => handleUpdateTable(selectedTable.id, { table_number: e.target.value })}
                        className="pl-8 bg-black/40 border-zinc-800 font-mono"
                        placeholder="e.g. T1"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Seating Capacity</label>
                    <div className="relative">
                      <Armchair className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
                      <Input
                        type="number"
                        value={selectedTable.capacity}
                        onChange={(e) => handleUpdateTable(selectedTable.id, { capacity: parseInt(e.target.value) || 0 })}
                        className="pl-9 bg-black/40 border-zinc-800"
                        min="1"
                        max="20"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Shape</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['square', 'round', 'rectangle'] as const).map(s => (
                        <button
                          key={s}
                          onClick={() => handleUpdateTable(selectedTable.id, { shape: s })}
                          className={cn(
                            "flex items-center justify-center p-2 rounded-lg border transition-all",
                            selectedTable.shape === s ? "bg-primary/10 border-primary/40 text-primary" : "bg-black/20 border-zinc-800 text-zinc-500"
                          )}
                        >
                          {s === 'round' ? <Circle className="w-4 h-4" /> : s === 'rectangle' ? <Maximize2 className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-6 border-t border-border flex flex-col gap-3">
                    <Button
                      variant="destructive"
                      onClick={handleDeleteTable}
                      className="w-full bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20"
                    >
                      <Trash2 className="w-4 h-4 mr-2" /> Delete Table
                    </Button>
                    <p className="text-[10px] text-zinc-600 text-center">Changes are temporary until you hit "Save Layout"</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </DashboardLayout>
  );
};

export default AdminTableMap;
