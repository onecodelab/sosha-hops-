import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { Card, Button, Input, showToast, cn } from '../components/ui';
import { Search, AlertTriangle, Trash2, CheckCircle2, Scale, Info } from 'lucide-react';
import { supabase } from '../supabase';
import { useBranch } from '../contexts/BranchContext';
import { motion, AnimatePresence } from 'framer-motion';

interface SearchResult {
    id: string;
    name: string;
    unit_type: string;
    current_stock: number;
}

const WASTE_REASONS = [
    { id: 'spoiled', label: 'Spoiled / Rotten', icon: '🤢' },
    { id: 'dropped', label: 'Dropped / Spilled', icon: '🧹' },
    { id: 'burnt', label: 'Burnt / Overcooked', icon: '🔥' },
    { id: 'expired', label: 'Expired Date', icon: '📅' },
    { id: 'overproduction', label: 'Over Production', icon: '🥘' },
    { id: 'other', label: 'Other Reason', icon: '📝' },
];

const KitchenWaste: React.FC = () => {
    const { activeBranchId } = useBranch();

    // Form State
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [selectedItem, setSelectedItem] = useState<SearchResult | null>(null);
    const [quantity, setQuantity] = useState('');
    const [reason, setReason] = useState<string | null>(null);
    const [notes, setNotes] = useState('');

    const [isSearching, setIsSearching] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMode, setSuccessMode] = useState(false);

    // 1. Search Logic
    useEffect(() => {
        const search = async () => {
            if (!searchTerm || searchTerm.length < 2) {
                setSearchResults([]);
                return;
            }
            setIsSearching(true);
            try {
                // Find ingredients in branch inventory
                const { data, error } = await supabase
                    .from('ingredients')
                    .select(`
            id, name, unit_type,
            branch_inventory!inner(branch_id, current_stock)
          `)
                    .eq('branch_inventory.branch_id', activeBranchId)
                    .ilike('name', `%${searchTerm}%`)
                    .limit(5);

                if (error) throw error;

                // Transform
                const results = data.map((item: any) => ({
                    id: item.id,
                    name: item.name,
                    unit_type: item.unit_type,
                    current_stock: item.branch_inventory[0]?.current_stock || 0
                }));

                setSearchResults(results);
            } catch (err) {
                console.error("Search failed", err);
            } finally {
                setIsSearching(false);
            }
        };

        const debounce = setTimeout(search, 300);
        return () => clearTimeout(debounce);
    }, [searchTerm, activeBranchId]);

    // 2. Submit Logic
    const handleSubmit = async () => {
        if (!selectedItem || !quantity || !reason) return;

        const qtyNum = parseFloat(quantity);
        if (isNaN(qtyNum) || qtyNum <= 0) {
            showToast("Please enter a valid quantity", "error");
            return;
        }

        if (qtyNum > selectedItem.current_stock) {
            showToast(`Cannot waste more than current stock (${selectedItem.current_stock} ${selectedItem.unit_type})`, "error");
            return;
        }

        setIsSubmitting(true);
        try {
            const { error } = await supabase.rpc('submit_waste_report', {
                p_branch_id: activeBranchId,
                p_ingredient_id: selectedItem.id,
                p_quantity: qtyNum,
                p_reason: reason,
                p_notes: notes || null
            });

            if (error) throw error;

            // Success sequence
            setSuccessMode(true);
            showToast("Waste reported successfully", "success");

            // Auto reset after 2s
            setTimeout(() => {
                handleReset();
            }, 2000);

        } catch (err: any) {
            showToast(err.message, "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleReset = () => {
        setSuccessMode(false);
        setSelectedItem(null);
        setSearchTerm('');
        setQuantity('');
        setReason(null);
        setNotes('');
        setSearchResults([]);
    };

    // 3. Render
    return (
        <DashboardLayout title="Log Waste" subtitle="Inventory Incident Report">
            <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-500">

                {successMode ? (
                    <div className="h-[400px] flex flex-col items-center justify-center bg-green-500/10 border border-green-500/20 rounded-3xl animate-in zoom-in-95">
                        <CheckCircle2 className="w-24 h-24 text-green-500 mb-4 animate-bounce" />
                        <h2 className="text-2xl font-black text-white uppercase tracking-widest">Reported!</h2>
                        <p className="text-gray-400 mt-2">Inventory has been updated.</p>
                    </div>
                ) : (
                    <>
                        {/* Step 1: Search Item */}
                        {!selectedItem && (
                            <Card className="p-6 bg-card/60 backdrop-blur-xl border-white/5 rounded-3xl min-h-[400px]">
                                <div className="space-y-4">
                                    <div className="text-center mb-8">
                                        <Trash2 className="w-12 h-12 text-red-500 mx-auto mb-3 opacity-80" />
                                        <h2 className="text-xl font-black text-white uppercase">What was wasted?</h2>
                                        <p className="text-sm text-gray-500">Search for the ingredient to report an incident.</p>
                                    </div>

                                    <div className="relative">
                                        <Search className="absolute left-4 top-4 w-5 h-5 text-gray-500" />
                                        <Input
                                            placeholder="Search ingredient (e.g. Avocado)..."
                                            className="pl-12 h-14 text-lg bg-black/40 border-white/10 rounded-2xl"
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                            autoFocus
                                        />
                                    </div>

                                    <div className="space-y-2 mt-4">
                                        {searchResults.map(item => (
                                            <button
                                                key={item.id}
                                                onClick={() => setSelectedItem(item)}
                                                className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl transition-all group"
                                            >
                                                <span className="font-bold text-white text-lg">{item.name}</span>
                                                <span className={cn(
                                                    "text-xs font-black uppercase px-2 py-1 rounded",
                                                    item.current_stock > 0 ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                                                )}>
                                                    {item.current_stock} {item.unit_type} avail
                                                </span>
                                            </button>
                                        ))}
                                        {searchTerm.length > 2 && searchResults.length === 0 && !isSearching && (
                                            <div className="text-center py-8 text-gray-600">No ingredients found</div>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        )}

                        {/* Step 2: Details & Reason */}
                        {selectedItem && (
                            <Card className="p-6 bg-card/60 backdrop-blur-xl border-white/5 rounded-3xl border-t-4 border-t-red-500 shadow-2xl">
                                <div className="flex justify-between items-start mb-6 border-b border-white/5 pb-4">
                                    <div>
                                        <h2 className="text-2xl font-black text-white">{selectedItem.name}</h2>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Info className="w-4 h-4 text-gray-500" />
                                            <span className="text-sm text-gray-500 font-mono">
                                                Current Stock: {selectedItem.current_stock} {selectedItem.unit_type}
                                            </span>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={() => setSelectedItem(null)} className="text-gray-500 hover:text-white">
                                        Change Item
                                    </Button>
                                </div>

                                <div className="space-y-8">
                                    {/* Quantity Input */}
                                    <div className="space-y-3">
                                        <label className="text-xs font-black text-gray-500 uppercase tracking-widest pl-1">Quantity Wasted ({selectedItem.unit_type})</label>
                                        <div className="flex items-center gap-4">
                                            <Input
                                                type="number"
                                                className="h-16 text-3xl font-black text-center bg-black/40 border-white/10 rounded-2xl text-red-500 focus:border-red-500/50"
                                                placeholder="0.0"
                                                value={quantity}
                                                onChange={e => setQuantity(e.target.value)}
                                                autoFocus
                                            />
                                        </div>
                                    </div>

                                    {/* Reason Grid */}
                                    <div className="space-y-3">
                                        <label className="text-xs font-black text-gray-500 uppercase tracking-widest pl-1">Reason for Waste</label>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                            {WASTE_REASONS.map(r => (
                                                <button
                                                    key={r.id}
                                                    onClick={() => setReason(r.id)}
                                                    className={cn(
                                                        "flex flex-col items-center justify-center p-4 rounded-2xl border transition-all duration-200 gap-2",
                                                        reason === r.id
                                                            ? "bg-red-500 text-white border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)] scale-105"
                                                            : "bg-white/5 text-gray-400 border-white/5 hover:bg-white/10 hover:border-white/10"
                                                    )}
                                                >
                                                    <span className="text-2xl">{r.icon}</span>
                                                    <span className="text-[10px] font-black uppercase text-center loading-tight">{r.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Notes (Conditional) */}
                                    {reason === 'other' && (
                                        <Input
                                            placeholder="Please explain..."
                                            value={notes}
                                            onChange={e => setNotes(e.target.value)}
                                            className="bg-black/40 border-white/10"
                                        />
                                    )}

                                    <Button
                                        onClick={handleSubmit}
                                        className="w-full h-16 bg-red-500 hover:bg-red-600 text-white font-black uppercase tracking-widest text-lg rounded-2xl shadow-xl shadow-red-900/20"
                                        disabled={!quantity || !reason || isSubmitting}
                                        isLoading={isSubmitting}
                                    >
                                        Confirm Waste Report
                                    </Button>
                                </div>
                            </Card>
                        )}
                    </>
                )}
            </div>
        </DashboardLayout>
    );
};

export default KitchenWaste;
