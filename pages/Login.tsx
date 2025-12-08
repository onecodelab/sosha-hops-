import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { Button, Input, Card, CardContent, CardHeader, CardTitle, showToast } from '../components/ui';
import { Role } from '../types';

const Login: React.FC = () => {
  const { role } = useParams<{ role: string }>();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user }, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (user) {
        // Verify role matches
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (profile?.role !== role && role !== 'admin' && profile?.role !== 'owner') { 
          // Allow owner to login via admin or owner path
           if (!(role === 'owner' && profile?.role === 'owner')) {
             showToast(`Account is registered as ${profile?.role}, not ${role}`, 'error');
             await supabase.auth.signOut();
             setLoading(false);
             return;
           }
        }

        // Redirect based on role
        if (profile?.role === 'owner') navigate('/admin');
        else if (profile?.role === 'manager') navigate('/manager');
        else if (profile?.role === 'waiter') navigate('/waiter');
        else if (profile?.role === 'kitchen') navigate('/kitchen');
      }
    } catch (err: any) {
      showToast(err.message || 'Login failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 flex flex-col items-center">
          <div className="w-24 h-24 mb-4 flex items-center justify-center">
              <img src="https://aistudiocdn.com/uploads/image_c40e53a2-0941-45bd-895c-55b63777d206.png" alt="Sosha" className="w-full h-full object-contain" />
          </div>
          <CardTitle className="text-2xl text-center capitalize">
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
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Password</label>
              <Input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" isLoading={loading}>
              Sign In
            </Button>
            <div className="text-center">
                <button type="button" onClick={() => navigate('/')} className="text-sm text-gray-500 hover:text-white">
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