import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabase';
import { Button, Input, Card, CardContent, CardHeader, CardTitle, showToast } from '../components/ui';
import { SoshaLogo } from '../components/SoshaLogo';
import { useAuth } from '../AuthContext';
import { Loader2 } from 'lucide-react';

const Login: React.FC = () => {
  const { role } = useParams<{ role: string }>();
  const navigate = useNavigate();
  const { user, profile, refreshProfile, markDatabaseAsMissing } = useAuth();
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
      // 1. Authenticate (Strict Sign In Only)
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (signInError) {
        throw new Error("Invalid login credentials.");
      }

      if (!authData.user) {
         throw new Error("Authentication failed.");
      }

      // 2. Check for Existing Profile
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

      // 3. Auto-Create Profile if Missing (Fix for "Access denied" error)
      if (!existingProfile) {
        console.log("Profile missing. Attempting auto-creation...");
        
        // Use the role from the URL or default to 'waiter'
        const targetRole = role ? role.toLowerCase() : 'waiter';
        const fullName = authData.user.user_metadata?.full_name || email.split('@')[0];

        const { error: insertError } = await supabase.from('users').insert([
          {
            id: authData.user.id,
            email: authData.user.email,
            full_name: fullName,
            role: targetRole,
            is_online: true
          }
        ]);

        if (insertError) {
          console.error("Auto-creation failed:", insertError);
          // Only sign out if we really can't create the profile
          await supabase.auth.signOut();
          throw new Error(`Access denied: Staff profile not found and could not be created. (${insertError.message})`);
        }
        
        showToast("Profile created automatically.", "success");
      }

      // 4. Success - Refresh Context
      await refreshProfile(authData.user.id);
      showToast("Welcome back!", "success");
      
    } catch (err: any) {
      console.error("Login Error:", err);
      showToast(err.message || 'Login failed', 'error');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-[#1A1A1A] border-gray-800">
        <CardHeader className="space-y-1 flex flex-col items-center">
          <div className="w-24 h-24 mb-4 flex items-center justify-center">
              <SoshaLogo className="w-full h-full" />
          </div>
          <CardTitle className="text-2xl text-center capitalize text-white">
            {role === 'owner' ? 'Admin' : role} Login
          </CardTitle>
          <p className="text-center text-gray-400 text-sm">Enter your credentials to access the system</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Email</label>
              <Input 
                type="email" 
                placeholder="name@example.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-black/20 border-gray-700 text-white placeholder:text-gray-600 focus:border-primary"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Password</label>
              <Input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-black/20 border-gray-700 text-white focus:border-primary"
              />
            </div>
            <Button type="submit" className="w-full font-bold text-black" isLoading={loading} disabled={loading}>
              {loading ? 'Verifying...' : 'Sign In'}
            </Button>
            
            <div className="flex flex-col gap-2 pt-2 text-center">
                <Link to="/signup" className="text-sm text-primary hover:text-primary-hover transition-colors font-medium">
                    First time? Sign up here
                </Link>
                <button type="button" onClick={() => navigate('/')} className="text-sm text-gray-500 hover:text-white transition-colors">
                    Back to Role Selection
                </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;