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
  const [magicLinkSent, setMagicLinkSent] = useState(false);

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
        // No profile exists — user must apply via onboarding first
        await supabase.auth.signOut();
        throw new Error('No account found. Please apply for access first.');
      } else {
        await supabase.from('profiles').update({ is_online: true }).eq('id', authData.user.id);
      }

      await refreshProfile();
      showToast(t('login.welcomeBack'), "success");

      // Force immediate redirect to dispatcher to handle role routing
      navigate('/app');

    } catch (err: any) {
      console.error("Login Error:", err);
      // Show the raw error message if available to help debugging
      const errorMessage = err.message || t('login.error');
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  const handleMagicLink = async () => {
    if (!email) {
      showToast("Please enter your email first.", "error");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: window.location.origin,
        }
      });
      if (error) throw error;
      setMagicLinkSent(true);
      showToast("Magic Link sent! Check your inbox.", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to send Magic Link.", 'error');
    } finally {
      setLoading(false);
    }
  };

  const displayRole = role ? (t(`roles.${role.toLowerCase()}`) || role) : 'Secure Staff';

  return (
    <BaroBackground variant="landing">
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-12 relative overflow-hidden liquid-bg min-h-screen">
        {/* Atmospheric Glow Overlay */}
        <div className="absolute inset-0 bg-foreground/5 pointer-events-none" />

        <div className="w-full max-w-md relative z-10 py-8 sm:py-0">
          {/* Header */}
          <div className="text-center mb-6 sm:mb-10">
            <div className="flex justify-center mb-4 sm:mb-8">
              <BaroLogo3D size="sm" animate className="scale-75 sm:scale-100" />
            </div>
            <h1 className="text-4xl sm:text-6xl font-black uppercase tracking-tighter italic mb-3 sm:mb-4 text-foreground">
              Access <span className="serif-ital text-brand-green lowercase">Terminal</span>
            </h1>
            <div className="inline-flex items-center gap-3 bg-foreground/[0.03] backdrop-blur-xl py-2 px-5 sm:py-2.5 sm:px-6 rounded-full border border-foreground/10 shadow-2xl">
              <ShieldCheck className="w-3.5 h-3.5 sm:w-4 h-4 text-brand-green" />
              <span className="mono-os text-[8px] sm:text-[9px] font-black uppercase tracking-[0.4em] text-foreground/60">
                {displayRole} Verification
              </span>
            </div>
          </div>

          <Card className="bg-card/90 border border-border backdrop-blur-3xl rounded-[2rem] sm:rounded-[3rem] shadow-2xl overflow-hidden">
            <CardContent className="p-6 sm:p-12">
              <form onSubmit={handleLogin} className="space-y-5 sm:space-y-8">
                <div className="space-y-2 sm:space-y-3">
                  <label className="text-[9px] sm:text-[10px] font-black text-brand-yellow uppercase tracking-[0.3em] ml-1 flex items-center gap-2">
                    <Mail className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> User Identifier
                  </label>
                  <Input
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="bg-background border-border text-foreground rounded-xl sm:rounded-2xl h-12 sm:h-16 px-6 sm:px-8 focus:ring-brand-yellow/20 transition-all font-bold placeholder:opacity-30 text-sm"
                  />
                </div>

                <div className="space-y-2 sm:space-y-3">
                  <label className="text-[9px] sm:text-[10px] font-black text-brand-yellow uppercase tracking-[0.3em] ml-1 flex items-center gap-2">
                    <KeyRound className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Secret Key
                  </label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    placeholder="••••••••"
                    className="bg-background border-border text-foreground rounded-xl sm:rounded-2xl h-12 sm:h-16 px-6 sm:px-8 focus:ring-brand-yellow/20 transition-all font-bold placeholder:opacity-30 text-sm"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-brand-yellow hover:bg-foreground hover:text-background text-black font-black uppercase tracking-widest text-[10px] sm:text-xs h-14 sm:h-18 rounded-xl sm:rounded-2xl mt-2 sm:mt-4 shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-4 ripple-link"
                  isLoading={loading && !magicLinkSent}
                  disabled={loading}
                >
                  {syncing ? (
                    <>
                      <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" /> Finalizing...
                    </>
                  ) : (
                    <>
                      Authorize Entry
                    </>
                  )}
                </Button>

                <div className="relative py-2 sm:py-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-foreground/10"></span>
                  </div>
                  <div className="relative flex justify-center text-[7px] sm:text-[8px] font-black uppercase tracking-widest">
                    <span className="bg-card px-3 sm:px-4 text-foreground/50 italic">Alternative Protocol</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleMagicLink}
                  disabled={loading || magicLinkSent}
                  className={cn(
                    "w-full h-12 sm:h-14 rounded-xl sm:rounded-2xl border border-border bg-foreground/5 text-foreground text-[8px] sm:text-[9px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all hover:bg-foreground/10 active:scale-95",
                    magicLinkSent && "border-brand-green/30 bg-brand-green/10 text-brand-green"
                  )}
                >
                  {magicLinkSent ? (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5 sm:w-4 h-4" /> Link Sent to Inbox
                    </>
                  ) : (
                    <>
                      <Mail className="w-3.5 h-3.5 sm:w-4 h-4" /> Request Magic Link
                    </>
                  )}
                </button>

                <div className="flex flex-col gap-4 sm:gap-5 pt-6 sm:pt-8 text-center border-t border-foreground/10 mt-6 sm:mt-8">
                  <Link to="/onboarding" className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-foreground/50 hover:text-brand-yellow transition-colors">
                    New here? <span className="text-brand-yellow underline underline-offset-4 decoration-brand-yellow/30">Apply for access →</span>
                  </Link>
                  <Link to="/signup" className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-foreground/40 hover:text-foreground/70 transition-colors">
                    <span className="underline underline-offset-4 decoration-foreground/20">Initialize Organization</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => navigate('/')}
                    className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-foreground/40 hover:text-foreground flex items-center justify-center gap-2 transition-colors group"
                  >
                    <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" /> Exit to Public Terminal
                  </button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Security Banner */}
          <div className="mt-8 sm:mt-12 text-center px-8 opacity-40 group-hover:opacity-60 transition-opacity">
            <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-[0.3em] text-foreground leading-relaxed">
              Proprietary System. Unauthorized access is prohibited. All activity is logged in the <span className="text-brand-green">Black Box</span> auditing stream.
            </p>
          </div>
        </div>
      </div>
    </BaroBackground>
  );
};

export default Login;
