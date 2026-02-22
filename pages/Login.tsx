import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabase';
import { Button, Input, Card, CardContent, showToast, cn } from '../components/ui';
import { BaroLogo3D } from '../components/BaroLogo3D';
import { BaroBackground } from '../components/BaroBackground';
import { useAuth } from '../AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { ArrowLeft, Loader2, ShieldCheck, KeyRound, Mail } from 'lucide-react';

const Login: React.FC = () => {
  const { role } = useParams<{ role: string }>();
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Auto-redirect if already logged in with a valid profile
  useEffect(() => {
    if (user && profile) {
      navigate('/app');
    }
  }, [user, profile, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (signInError) throw new Error(signInError.message || "Invalid email or password.");
      if (!authData.user) throw new Error("Authentication failed.");

      setSyncing(true);

      let currentProfile = null;
      for (let i = 0; i < 4; i++) {
        const { data, error: fetchError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authData.user.id)
          .maybeSingle();

        if (data) {
          currentProfile = data;
          break;
        }

        if (fetchError && fetchError.code === '42P17') {
          throw new Error("Database recursion error detected.");
        }

        await new Promise(r => setTimeout(r, 1000));
      }

      if (!currentProfile) {
        const targetRole = role ? role.toLowerCase() : 'waiter';
        const displayName = authData.user.user_metadata?.full_name || email.split('@')[0];

        const { error: upsertError } = await supabase.from('profiles').upsert({
          id: authData.user.id,
          email: authData.user.email,
          full_name: displayName,
          name: displayName,
          role: targetRole,
          is_online: true
        }, { onConflict: 'id' });

        if (upsertError) throw new Error(`Profile sync failed: ${upsertError.message}`);
      } else {
        await supabase.from('profiles').update({ is_online: true }).eq('id', authData.user.id);
      }

      await refreshProfile();
      showToast(t('login.welcomeBack'), "success");

    } catch (err: any) {
      showToast(err.message || t('login.error'), 'error');
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  const displayRole = role ? (t(`roles.${role.toLowerCase()}`) || role) : 'Secure Staff';

  return (
    <BaroBackground variant="landing">
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 relative overflow-hidden liquid-bg">
        {/* Atmospheric Glow Overlay */}
        <div className="absolute inset-0 bg-black/40 pointer-events-none" />

        <div className="w-full max-w-md relative z-10">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="flex justify-center mb-8">
              <BaroLogo3D size="sm" animate />
            </div>
            <h1 className="text-5xl sm:text-6xl font-black uppercase tracking-tighter italic mb-4 text-white">
              Access <span className="serif-ital text-brand-green lowercase">Terminal</span>
            </h1>
            <div className="inline-flex items-center gap-3 bg-white/[0.03] backdrop-blur-xl py-2.5 px-6 rounded-full border border-white/10 shadow-2xl">
              <ShieldCheck className="w-4 h-4 text-brand-green" />
              <span className="mono-os text-[9px] font-black uppercase tracking-[0.4em] text-white/60">
                {displayRole} Verification
              </span>
            </div>
          </div>

          <Card className="bg-black/60 border border-white/10 backdrop-blur-3xl rounded-[3rem] shadow-[0_50px_100px_rgba(0,0,0,0.8)] overflow-hidden">
            <CardContent className="p-10 sm:p-12">
              <form onSubmit={handleLogin} className="space-y-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-brand-yellow uppercase tracking-[0.3em] ml-1 flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5" /> User Identifier
                  </label>
                  <Input
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="bg-white/5 border-white/10 text-white rounded-2xl h-16 px-8 focus:ring-brand-yellow/20 transition-all font-bold placeholder:opacity-10"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-brand-yellow uppercase tracking-[0.3em] ml-1 flex items-center gap-2">
                    <KeyRound className="w-3.5 h-3.5" /> Secret Key
                  </label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    placeholder="••••••••"
                    className="bg-white/5 border-white/10 text-white rounded-2xl h-16 px-8 focus:ring-brand-yellow/20 transition-all font-bold placeholder:opacity-10"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-brand-yellow hover:bg-white text-black font-black uppercase tracking-widest text-xs h-18 rounded-2xl mt-4 shadow-2xl shadow-brand-yellow/20 transition-all active:scale-[0.98] flex items-center justify-center gap-4 ripple-link"
                  isLoading={loading}
                  disabled={loading}
                >
                  {syncing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" /> Finalizing...
                    </>
                  ) : (
                    <>
                      Authorize Entry
                    </>
                  )}
                </Button>

                <div className="flex flex-col gap-5 pt-8 text-center border-t border-white/5 mt-8">
                  <Link to="/signup" className="text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-brand-yellow transition-colors">
                    First time? <span className="text-brand-yellow underline underline-offset-4 decoration-brand-yellow/30">Initialize Organization</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => navigate('/')}
                    className="text-[10px] font-black uppercase tracking-widest text-white/30 hover:text-white flex items-center justify-center gap-2 transition-colors group"
                  >
                    <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" /> Exit to Public Terminal
                  </button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Security Banner */}
          <div className="mt-12 text-center px-8 opacity-20 group-hover:opacity-40 transition-opacity">
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white leading-relaxed">
              Proprietary System. Unauthorized access is prohibited. All activity is logged in the <span className="text-brand-green">Black Box</span> auditing stream.
            </p>
          </div>
        </div>
      </div>
    </BaroBackground>
  );
};

export default Login;
