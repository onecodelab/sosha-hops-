
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';
import { Button, cn, showToast } from './ui';
import { Clock, CheckCircle, XCircle, Loader2, Timer } from 'lucide-react';
import { StaffShift } from '../types';

export const ClockWidget: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [currentShift, setCurrentShift] = useState<StaffShift | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [shiftDuration, setShiftDuration] = useState<string>('00:00:00');

  useEffect(() => {
    if (user && profile) {
      if (profile.role === 'owner') {
        setLoading(false);
        return;
      }
      fetchActiveShift();
    }
  }, [user, profile]);

  useEffect(() => {
    let interval: number;
    if (currentShift) {
      interval = window.setInterval(() => {
        const start = new Date(currentShift.clock_in_time).getTime();
        const now = new Date().getTime();
        const diff = Math.max(0, now - start);
        
        const hours = Math.floor(diff / 3600000).toString().padStart(2, '0');
        const minutes = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
        const seconds = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
        
        setShiftDuration(`${hours}:${minutes}:${seconds}`);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [currentShift]);

  const fetchActiveShift = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('staff_shifts')
        .select('*')
        .eq('staff_id', user?.id)
        .is('clock_out_time', null)
        .order('clock_in_time', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        // Log clean error message, not [object Object]
        const errorMsg = error.message || (typeof error === 'string' ? error : JSON.stringify(error));
        console.error('Shift fetch error:', errorMsg);
        
        if (errorMsg.includes('staff_id')) {
           showToast("Database out of sync. Please run Repair Script in Setup Guide.", "error");
        }
        return;
      }
      setCurrentShift(data as StaffShift);
    } catch (err: any) {
      console.error('System error fetching shift:', err.message || JSON.stringify(err));
    } finally {
      setLoading(false);
    }
  };

  const handleClockIn = async () => {
    if (!user || !profile) return;
    setActionLoading(true);
    try {
      const now = new Date().toISOString();
      
      const { data: newShift, error: shiftError } = await supabase
        .from('staff_shifts')
        .insert({
          staff_id: user.id,
          staff_name: profile.full_name || profile.name || profile.email,
          role: profile.role,
          clock_in_time: now,
          status: 'active'
        })
        .select()
        .single();

      if (shiftError) throw shiftError;

      await supabase.from('staff_actions').insert({
        staff_id: user.id,
        staff_name: profile.full_name || profile.name || profile.email,
        role: profile.role,
        action_type: 'clock_in',
        entity_type: 'shift',
        shift_id: newShift.id,
        details: { timestamp: now }
      });

      await supabase.from('users').update({ is_online: true }).eq('id', user.id);

      setCurrentShift(newShift as StaffShift);
      showToast('Shift started. Good luck!', 'success');
      refreshProfile();
    } catch (err: any) {
      showToast(err.message || 'Failed to clock in', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!user || !currentShift || !profile) return;
    setActionLoading(true);
    try {
      const now = new Date().toISOString();
      const diffMins = Math.floor((new Date(now).getTime() - new Date(currentShift.clock_in_time).getTime()) / 60000);

      const { error: shiftError } = await supabase
        .from('staff_shifts')
        .update({
          clock_out_time: now,
          shift_duration_minutes: diffMins,
          status: 'completed'
        })
        .eq('id', currentShift.id);

      if (shiftError) throw shiftError;

      await supabase.from('staff_actions').insert({
        staff_id: user.id,
        staff_name: profile.full_name || profile.name || profile.email,
        role: profile.role,
        action_type: 'clock_out',
        entity_type: 'shift',
        shift_id: currentShift.id,
        details: { duration_minutes: diffMins, timestamp: now }
      });

      await supabase.from('users').update({ is_online: false }).eq('id', user.id);

      setCurrentShift(null);
      showToast(`Shift ended. Total: ${diffMins} minutes.`, 'success');
      refreshProfile();
    } catch (err: any) {
      showToast(err.message || 'Failed to clock out', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-16 flex items-center justify-center bg-black/20 rounded-2xl border border-white/5 px-6">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  if (profile?.role === 'owner') return null;

  const clockInFormatted = currentShift 
    ? new Date(currentShift.clock_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
    : '';

  return (
    <div className={cn(
      "h-16 flex items-center justify-between px-6 rounded-2xl border transition-all animate-in fade-in duration-500",
      currentShift 
        ? "bg-primary/5 border-primary/20 shadow-[0_0_20px_rgba(255,184,0,0.05)]" 
        : "bg-zinc-900 border-zinc-800"
    )}>
      <div className="flex items-center gap-4">
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center border transition-all",
          currentShift ? "bg-primary/10 border-primary/20 text-primary" : "bg-zinc-800 border-zinc-700 text-zinc-500"
        )}>
          {currentShift ? <Timer className="w-5 h-5 animate-pulse" /> : <Clock className="w-5 h-5" />}
        </div>
        
        <div>
          {currentShift ? (
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-primary uppercase tracking-widest leading-tight">
                Clocked in at {clockInFormatted}
              </span>
              <span className="text-sm font-black text-primary font-mono leading-none mt-1">
                {shiftDuration} <span className="text-white/40 text-[9px] ml-1 uppercase">Elapsed</span>
              </span>
            </div>
          ) : (
            <div className="flex flex-col">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Ready for your shift?</span>
              <span className="text-[10px] text-zinc-600 font-medium">Clock in to start production.</span>
            </div>
          )}
        </div>
      </div>

      {currentShift ? (
        <Button 
          size="sm" 
          variant="destructive" 
          className="h-10 px-6 rounded-xl text-[11px] font-black uppercase tracking-widest bg-red-600/10 text-red-500 border border-red-600/20 hover:bg-red-600 hover:text-white"
          onClick={handleClockOut}
          isLoading={actionLoading}
        >
          <XCircle className="w-4 h-4 mr-2" /> Clock Out
        </Button>
      ) : (
        <Button 
          size="sm" 
          className="h-10 px-6 rounded-xl text-[11px] font-black uppercase tracking-widest bg-green-600 text-white hover:bg-green-500 shadow-[0_8px_20px_rgba(34,197,94,0.3)]"
          onClick={handleClockIn}
          isLoading={actionLoading}
        >
          <CheckCircle className="w-4 h-4 mr-2" /> Clock In
        </Button>
      )}
    </div>
  );
};
