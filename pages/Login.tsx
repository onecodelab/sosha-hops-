
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabase';
import { Button, Input, showToast } from '../components/ui';
import { SoshaLogo3D } from '../components/SoshaLogo3D';
import { SoshaBackground } from '../components/SoshaBackground';
import { useAuth } from '../AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { ArrowLeft } from 'lucide-react';

const Login: React.FC = () => {
  const { role } = useParams<{ role: string }>();
  const navigate = useNavigate();
  const { user, profile, refreshProfile, markDatabaseAsMissing } = useAuth();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Auto-redirect if already logged in with a profile
  useEffect(() => {
    if (user && profile) {
      redirectUser(profile.role);
    }
  }, [user, profile]);

  const redirectUser = (userRole: string) => {
    const r = userRole.toLowerCase();
    if (r === 'owner' || r === 'admin') navigate('/admin');
    else if (r === 'manager') navigate('/manager');
    else if (r === 'waiter') navigate('/waiter');
    else if (r === 'kitchen') navigate('/kitchen');
    else navigate('/');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (signInError) throw new Error("Invalid login credentials.");
      if (!authData.user) throw new Error("Authentication failed.");

      let { data: existingProfile, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .maybeSingle();

      if (fetchError) {
         if (fetchError.message.includes('does not exist') || fetchError.message.includes('relation "public.users" does not exist')) {
            markDatabaseAsMissing();
            setLoading(false);
            return;
         }
         throw fetchError;
      }

      if (!existingProfile) {
        const targetRole = role ? role.toLowerCase() : 'waiter';
        const fullName = authData.user.user_metadata?.full_name || email.split('@')[0];
        const { error: insertError } = await supabase.from('users').insert([{
            id: authData.user.id,
            email: authData.user.email,
            full_name: fullName,
            role: targetRole,
            is_online: true
        }]);

        if (insertError) {
          await supabase.auth.signOut();
          throw new Error(`Access denied: Staff profile not found and could not be created.`);
        }
        showToast("Profile created automatically.", "success");
      }

      await refreshProfile();
      showToast(t('login.welcomeBack'), "success");
      
    } catch (err: any) {
      console.error("Login Error:", err);
      showToast(err.message || t('login.error'), 'error');
      setLoading(false);
    }
  };

  // Helper to translate role name
  const displayRole = role ? (t(`roles.${role.toLowerCase()}`) || role) : 'User';

  return (
    <SoshaBackground variant="landing">
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        
        {/* Floating Card */}
        <div className="w-full max-w-md bg-zinc-950/90 border border-zinc-800/70 rounded-3xl shadow-[0_24px_80px_rgba(0,0,0,0.85)] p-8 space-y-6 backdrop-blur-md transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_32px_90px_rgba(0,0,0,0.95)]">
          
          {/* Header */}
          <div className="flex flex-col items-center text-center space-y-4">
            <SoshaLogo3D size="sm" />
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight capitalize">
                {displayRole} {t('login.title')}
              </h1>
              <p className="text-gray-500 text-sm font-medium mt-1">
                {t('login.subtitle')}
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">{t('login.email')}</label>
              <Input 
                type="email" 
                placeholder="name@example.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-zinc-900/70 border-zinc-800 text-white placeholder:text-gray-600 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/60 rounded-xl h-12 text-sm transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">{t('login.password')}</label>
              <Input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-zinc-900/70 border-zinc-800 text-white focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/60 rounded-xl h-12 transition-all"
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full bg-yellow-400 hover:bg-yellow-300 text-black font-bold rounded-xl h-12 shadow-[0_16px_40px_rgba(250,204,21,0.45)] transition-all transform active:scale-95 text-base" 
              isLoading={loading} 
              disabled={loading}
            >
              {loading ? t('login.verifying') : t('login.signIn')}
            </Button>
            
            <div className="flex flex-col gap-3 pt-2 text-center">
                <Link to="/signup" className="text-sm text-gray-500 hover:text-white hover:underline transition-colors">
                    {t('login.firstTime')}
                </Link>
                <button 
                  type="button" 
                  onClick={() => navigate('/')} 
                  className="text-sm text-gray-500 hover:text-white hover:underline transition-colors flex items-center justify-center gap-2"
                >
                    <ArrowLeft className="w-3 h-3" /> {t('login.backToRoles')}
                </button>
            </div>
          </form>
        </div>

      </div>
    </SoshaBackground>
  );
};

export default Login;
