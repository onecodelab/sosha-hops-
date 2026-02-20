
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabase';
import { Button, Input, showToast, cn } from '../components/ui';
import { BaroLogo3D } from '../components/BaroLogo3D';
import { BaroBackground } from '../components/BaroBackground';
import { useAuth } from '../AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { ArrowLeft, Loader2 } from 'lucide-react';

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
      redirectUser(profile.role);
    }
  }, [user, profile]);

  const redirectUser = (userRole: string) => {
    navigate('/app');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Authenticate with Supabase Auth
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (signInError) throw new Error(signInError.message || "Invalid email or password.");
      if (!authData.user) throw new Error("Authentication failed.");

      setSyncing(true);

      // 2. Profile Verification Loop (Wait for DB Triggers)
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
          throw new Error("Database recursion error detected. Please run the SQL fix provided in the dashboard.");
        }

        // Wait 1 second before retrying to allow DB triggers to finish
        await new Promise(r => setTimeout(r, 1000));
      }

      // 3. Manual Sync (Only if trigger failed and record is missing)
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

        if (upsertError) {
          console.error("Sync object error:", JSON.stringify(upsertError, null, 2));
          throw new Error(`Profile sync failed: ${upsertError.message || 'Unknown RLS error'}`);
        }
      } else {
        // Just mark as online if already exists
        await supabase.from('profiles').update({ is_online: true }).eq('id', authData.user.id);
      }

      // 4. Update local context and navigate
      await refreshProfile();
      showToast(t('login.welcomeBack'), "success");

    } catch (err: any) {
      const errorMessage = err.message || JSON.stringify(err);
      console.error("Critical Login Error:", errorMessage);
      showToast(errorMessage || t('login.error'), 'error');
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  const displayRole = role ? (t(`roles.${role.toLowerCase()}`) || role) : 'Staff';

  return (
    <BaroBackground variant="landing">
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-card/90 border border-border rounded-3xl shadow-[0_24px_80px_rgba(0,0,0,0.85)] p-8 space-y-6 backdrop-blur-md">
          <div className="flex flex-col items-center text-center space-y-4">
            <BaroLogo3D size="sm" />
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight capitalize">
                {displayRole} {t('login.title')}
              </h1>
              <p className="text-muted text-sm font-medium mt-1">
                {syncing ? "Verifying secure database link..." : t('login.subtitle')}
              </p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted uppercase tracking-wider ml-1">{t('login.email')}</label>
              <Input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="bg-black/20 border-border text-foreground rounded-xl h-12"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted uppercase tracking-wider ml-1">{t('login.password')}</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="bg-black/20 border-border text-foreground rounded-xl h-12"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-black font-bold rounded-xl h-12 shadow-[0_16px_40px_var(--primary-glow)] transition-all active:scale-95"
              isLoading={loading}
              disabled={loading}
            >
              {syncing ? "Finalizing..." : (loading ? t('login.verifying') : t('login.signIn'))}
            </Button>

            <div className="flex flex-col gap-3 pt-2 text-center">
              <Link to="/signup" className="text-sm text-muted hover:text-foreground hover:underline transition-colors">
                {t('login.firstTime')}
              </Link>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="text-sm text-muted hover:text-foreground hover:underline flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-3 h-3" /> {t('login.backToRoles')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </BaroBackground>
  );
};

export default Login;
