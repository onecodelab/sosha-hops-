import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
      // 1. Authenticate
      const { data: { user: authUser }, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) throw error;
      if (!authUser) throw new Error("No user returned from login.");

      // 2. Check Profile Existence directly
      let { data: existingProfile, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (fetchError) {
         if (fetchError.message.includes('does not exist')) {
            markDatabaseAsMissing();
            setLoading(false);
            return;
         }
      }

      // 3. Create Profile if missing
      if (!existingProfile) {
        console.log("Profile missing. Creating...");
        
        // Fetch a restaurant ID if possible
        const { data: rData } = await supabase.from('restaurants').select('id').limit(1).maybeSingle();
        const restaurantId = rData?.id;

        const validRoles = ['owner', 'admin', 'manager', 'waiter', 'kitchen'];
        const targetRole = (role && validRoles.includes(role.toLowerCase())) ? role.toLowerCase() : 'waiter';

        const newProfile = {
           id: authUser.id,
           email: authUser.email,
           full_name: authUser.email?.split('@')[0] || 'User',
           role: targetRole,
           restaurant_id: restaurantId,
           created_at: new Date().toISOString()
        };

        const { error: insertError } = await supabase.from('users').insert([newProfile]);
        
        if (insertError) {
           console.error("Profile creation failed:", insertError);
           if (insertError.message.includes('does not exist')) {
              markDatabaseAsMissing();
              return;
           }
           throw new Error("Failed to create user profile. Please try again.");
        }
        
        // Force refresh context with the new user ID
        await refreshProfile(authUser.id);
        
        // Use the local object for immediate redirect
        existingProfile = newProfile;
        showToast("Profile initialized!", "success");
      } else {
        // Just refresh context to be safe
        await refreshProfile(authUser.id);
      }

      // 4. Redirect
      if (existingProfile) {
         redirectUser(existingProfile.role);
      }

    } catch (err: any) {
      console.error("Login Error:", err);
      showToast(err.message || 'Login failed', 'error');
      // If authenticating failed, ensure we are signed out locally
      if (err.message.includes('Invalid login')) {
          await supabase.auth.signOut();
      }
    } finally {
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
            <Button type="submit" className="w-full font-bold text-black" isLoading={loading}>
              {loading ? 'Verifying...' : 'Sign In'}
            </Button>
            <div className="text-center">
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