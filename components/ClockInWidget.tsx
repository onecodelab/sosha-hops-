
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { Clock, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '../AuthContext';

export const ClockInWidget = () => {
  const [currentShift, setCurrentShift] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { profile, refreshProfile } = useAuth();

  useEffect(() => {
    if (profile) {
      loadShiftStatus();
    }
  }, [profile]);

  const loadShiftStatus = async () => {
    if (!profile) return;
    
    // Don't show for owner
    if (profile.role === 'owner') {
      setLoading(false);
      return;
    }

    try {
      await checkCurrentShift(profile.id);
    } catch (error) {
      console.error('Profile load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkCurrentShift = async (userId: string) => {
    const { data, error } = await supabase
      .from('staff_shifts')
      .select('*')
      .eq('staff_id', userId)
      .is('clock_out_time', null)
      .order('clock_in_time', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Shift check error:', error);
      return;
    }

    setCurrentShift(data?.[0] || null);
  };

  const handleClockIn = async () => {
    if (!profile) return;
    setLoading(true);

    const { error } = await supabase
      .from('staff_shifts')
      .insert([{
        staff_id: profile.id,
        staff_name: profile.full_name || profile.email,
        role: profile.role,
        clock_in_time: new Date().toISOString()
      }]);

    if (error) {
      console.error('Clock in error:', error);
      alert('Failed to clock in: ' + error.message);
    } else {
      await checkCurrentShift(profile.id);
      refreshProfile();
    }

    setLoading(false);
  };

  const handleClockOut = async () => {
    if (!currentShift) return;
    setLoading(true);

    const now = new Date();
    const clockInTime = new Date(currentShift.clock_in_time);
    const durationMinutes = Math.floor((now.getTime() - clockInTime.getTime()) / 60000);

    const { error } = await supabase
      .from('staff_shifts')
      .update({
        clock_out_time: now.toISOString(),
        shift_duration_minutes: durationMinutes,
        status: 'completed'
      })
      .eq('id', currentShift.id);

    if (error) {
      console.error('Clock out error:', error);
      alert('Failed to clock out: ' + error.message);
    } else {
      setCurrentShift(null);
      refreshProfile();
    }

    setLoading(false);
  };

  // Don't render for owner
  if (profile?.role === 'owner') return null;
  
  if (loading) {
    return (
      <div className="bg-[#09090b] rounded-2xl p-6 border border-white/5 mb-6 animate-pulse">
        <p className="text-gray-500 text-sm font-bold uppercase tracking-widest">Loading shift status...</p>
      </div>
    );
  }

  return (
    <div className="bg-[#09090b] rounded-3xl p-6 border border-white/10 mb-8 shadow-2xl backdrop-blur-md">
      {!currentShift ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center">
              <Clock className="text-gray-400" size={24} />
            </div>
            <div>
              <p className="text-white font-bold text-lg tracking-tight">Ready for your shift?</p>
              <p className="text-gray-500 text-xs font-medium">Clock in to start production.</p>
            </div>
          </div>
          <button
            onClick={handleClockIn}
            disabled={loading}
            className="bg-[#84CC16] hover:bg-[#65A30D] disabled:bg-gray-800 text-black px-8 py-3 rounded-2xl font-black text-xs tracking-widest uppercase flex items-center gap-2 transition-all shadow-[0_10px_30px_rgba(132,204,22,0.2)] active:scale-95"
          >
            <CheckCircle size={18} />
            CLOCK IN
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Clock className="text-primary animate-pulse" size={24} />
            </div>
            <div>
              <p className="text-white font-bold text-lg tracking-tight">
                Shift Active <span className="text-gray-500 text-sm font-normal ml-2">since {new Date(currentShift.clock_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </p>
              <p className="text-primary text-xs font-black font-mono mt-1 uppercase tracking-widest">
                {Math.floor((Date.now() - new Date(currentShift.clock_in_time).getTime()) / 60000)} minutes elapsed
              </p>
            </div>
          </div>
          <button
            onClick={handleClockOut}
            disabled={loading}
            className="bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-600/20 px-8 py-3 rounded-2xl font-black text-xs tracking-widest uppercase flex items-center gap-2 transition-all active:scale-95"
          >
            <XCircle size={18} />
            CLOCK OUT
          </button>
        </div>
      )}
    </div>
  );
};
