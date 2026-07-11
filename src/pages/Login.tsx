import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { showToast } from '../components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { ArrowLeft, Loader2, ShieldCheck, Mail, Lock, ArrowRight } from 'lucide-react';

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
      for (let i = 0; i < 5; i++) {
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

        if (i < 4) await new Promise(r => setTimeout(r, 200 * (i + 1))); 
      }

      if (!currentProfile) {
        await supabase.auth.signOut();
        throw new Error('No account found. Please contact your restaurant administrator or sign up.');
      } else {
        await supabase.from('profiles').update({ is_online: true }).eq('id', authData.user.id);
      }

      await refreshProfile();
      showToast(t('login.welcomeBack') || "Welcome back to Baro OS!", "success");
      navigate('/app');

    } catch (err: any) {
      console.error("Login Error:", err);
      const errorMessage = err.message || t('login.error') || "Failed to sign in.";
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  const displayRole = role ? (role.charAt(0).toUpperCase() + role.slice(1)) : 'Staff';

  return (
    <div className="min-h-screen bg-[#faf9f7] text-[#0c0d0e] flex flex-col justify-between font-sans selection:bg-[#84e7a5] selection:text-[#02492a]">
      {/* Top Header */}
      <header className="py-6 px-6 sm:px-12 flex items-center justify-between max-w-7xl mx-auto w-full">
        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <span className="font-mono text-xs font-bold uppercase tracking-widest text-[#55534e] flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </span>
        </Link>
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#84e7a5]/30 border border-[#078a52]/30 text-[#02492a] text-xs font-bold font-mono">
          <ShieldCheck className="w-4 h-4 text-[#078a52]" />
          <span>ETHIOPIAN SECURITY PROTOCOL</span>
        </div>
      </header>

      {/* Main Form Center */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-8">
          {/* Card Title Header */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#fbbd41] text-[#0c0d0e] border-2 border-[#0c0d0e] shadow-[-3px_3px_0px_#0c0d0e] text-xs font-black font-mono">
              <span>{displayRole.toUpperCase()} SIGN IN</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-[#0c0d0e]">
              Sign In to Baro OS
            </h1>
            <p className="text-sm text-[#55534e] max-w-xs mx-auto">
              Enter your restaurant email and password to access your dashboard.
            </p>
          </div>

          {/* Clay Artisanal Card */}
          <div className="bg-white border-2 border-[#0c0d0e] rounded-[32px] p-7 sm:p-10 shadow-[-8px_8px_0px_#0c0d0e] space-y-6">
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <label className="block font-mono text-xs font-bold uppercase tracking-wider text-[#0c0d0e] flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-[#078a52]" /> Email Address
                </label>
                <input
                  type="email"
                  placeholder="name@restaurant.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="w-full h-13 px-4 rounded-xl border-2 border-[#0c0d0e] bg-[#faf9f7] text-[#0c0d0e] placeholder:text-[#55534e]/40 font-medium text-sm focus:outline-none focus:bg-white focus:shadow-[-3px_3px_0px_#0c0d0e] transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="block font-mono text-xs font-bold uppercase tracking-wider text-[#0c0d0e] flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-[#078a52]" /> Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  placeholder="••••••••"
                  className="w-full h-13 px-4 rounded-xl border-2 border-[#0c0d0e] bg-[#faf9f7] text-[#0c0d0e] placeholder:text-[#55534e]/40 font-medium text-sm focus:outline-none focus:bg-white focus:shadow-[-3px_3px_0px_#0c0d0e] transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-14 rounded-2xl bg-[#fbbd41] hover:bg-[#fbbd41]/90 text-[#0c0d0e] border-2 border-[#0c0d0e] shadow-[-4px_4px_0px_#0c0d0e] hover:shadow-[-2px_2px_0px_#0c0d0e] hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all font-black uppercase tracking-wider text-sm flex items-center justify-center gap-3 mt-2"
              >
                {syncing || loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> Signing In...
                  </>
                ) : (
                  <>
                    <span>Sign In to Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="pt-4 border-t border-dashed border-[#dad4c8] text-center space-y-3">
              <p className="text-xs text-[#55534e]">
                Don't have a Baro OS account yet?
              </p>
              <Link
                to="/book-demo"
                className="inline-flex items-center gap-1.5 font-bold text-xs text-[#078a52] hover:underline"
              >
                <span>Book a Free Demo for Your Restaurant →</span>
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 px-6 text-center text-xs font-mono text-[#55534e]">
        <span>Baro OS • Verified Ethiopian Restaurant Operations</span>
      </footer>
    </div>
  );
};

export default Login;
